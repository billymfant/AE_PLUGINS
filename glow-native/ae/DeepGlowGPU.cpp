/*
 *  DeepGlowGPU.cpp
 *  Native After Effects entry point for Deep Glow.
 *
 *  MILESTONE M1 (this file): the CPU render path wired to core::bloom.
 *  --------------------------------------------------------------------
 *  This build replaces the M0 passthrough with a real soft glow:
 *
 *      - ReadParams()  converts the AE UI params -> normalized glow::Params
 *      - SmartRender() builds a glow::Image from the INPUT world (handling
 *        8/16/32-bit ARGB), calls glow::bloom(), and writes the RGBA float
 *        result back into the OUTPUT world at the right depth + offset.
 *      - PreRender()   outsets the requested input region and the result
 *        rects by the glow radius so the bloom can gather + extend past
 *        the layer edge instead of clipping.
 *
 *  The MATH lives entirely in core/ (glow_core.cpp). This file is a thin
 *  adapter: it only converts pixels in/out and calls glow::bloom(). The
 *  CUDA path (Task 11) will mirror core/, so keep this layer thin.
 *
 *  AE command flow used here:
 *      ABOUT             -> version string
 *      GLOBAL_SETUP      -> advertise flags (Smart + float, NO GPU)
 *      PARAMS_SETUP      -> add UI params (mirrors jsx/glow.jsx + cinematic)
 *      SMART_PRE_RENDER  -> checkout input (outset by radius), union rects
 *      SMART_RENDER      -> build Image, glow::bloom, write back
 *
 *  Modeled on the SDK's SDK_Invert_ProcAmp / SmartyPants samples.
 */

#include "DeepGlowGPU.h"

#include "AEConfig.h"
#include "entry.h"
#include "AEFX_SuiteHelper.h"
#include "AE_Effect.h"
#include "AE_EffectCB.h"
#include "AE_EffectCBSuites.h"
#include "AE_EffectPixelFormat.h"
#include "AE_Macros.h"
#include "AE_PluginData.h"
#include "Param_Utils.h"
#include "Smart_Utils.h"        // UnionLRect
#include "String_Utils.h"

#include "glow_core.h"          // the pure-C++ engine: glow::Image / Params / bloom

#include <string.h>
#include <math.h>
#include <algorithm>


/* ================================================================== *
 *  ABOUT
 * ================================================================== */
static PF_Err
About(PF_InData* in_data, PF_OutData* out_data,
      PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_SPRINTF(out_data->return_msg,
               "%s, v%d.%d\r%s",
               DG_NAME, DG_MAJOR_VERSION, DG_MINOR_VERSION, DG_DESCRIPTION);
    return PF_Err_NONE;
}


/* ================================================================== *
 *  GLOBAL_SETUP — advertise capabilities
 *  NOTE: out_flags / out_flags2 MUST match the PiPL hex values:
 *      out_flags  = PIX_INDEPENDENT | DEEP_COLOR_AWARE        = 0x2000400
 *      out_flags2 = SMART_RENDER | FLOAT_COLOR_AWARE
 *                   | SUPPORTS_THREADED_RENDERING             = 0x8001400
 *  GPU flags are deliberately omitted at M0/M1.
 * ================================================================== */
static PF_Err
GlobalSetup(PF_InData* in_data, PF_OutData* out_data,
            PF_ParamDef* params[], PF_LayerDef* output)
{
    out_data->my_version = PF_VERSION(DG_MAJOR_VERSION, DG_MINOR_VERSION,
                                      DG_BUG_VERSION, DG_STAGE_VERSION,
                                      DG_BUILD_VERSION);

    out_data->out_flags  = PF_OutFlag_PIX_INDEPENDENT |
                           PF_OutFlag_DEEP_COLOR_AWARE;

    out_data->out_flags2 = PF_OutFlag2_SUPPORTS_SMART_RENDER |
                           PF_OutFlag2_FLOAT_COLOR_AWARE |
                           PF_OutFlag2_SUPPORTS_THREADED_RENDERING;

    return PF_Err_NONE;
}


/* ================================================================== *
 *  PARAMS_SETUP — UI (order must match the DG_* enum in the header)
 * ================================================================== */
static PF_Err
ParamsSetup(PF_InData* in_data, PF_OutData* out_data,
            PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_Err       err = PF_Err_NONE;
    PF_ParamDef  def;

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Intensity %", 0, 1000, 0, 400, 150,
                         PF_Precision_INTEGER, 0, 0, DG_INTENSITY);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Radius (px)", 0, 500, 0, 200, 60,
                         PF_Precision_INTEGER, 0, 0, DG_RADIUS);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Threshold", 0, 255, 0, 255, 80,
                         PF_Precision_INTEGER, 0, 0, DG_THRESHOLD);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Threshold Softness", 0, 100, 0, 100, 20,
                         PF_Precision_INTEGER, 0, 0, DG_THRESHOLD_SOFT);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Source Gain %", 0, 400, 0, 400, 100,
                         PF_Precision_INTEGER, 0, 0, DG_SOURCE_GAIN);

    AEFX_CLR_STRUCT(def);
    PF_ADD_COLOR("Glow Color", 255, 255, 255, DG_GLOW_COLOR);

    AEFX_CLR_STRUCT(def);
    PF_ADD_CHECKBOX("Colorize", "", FALSE, 0, DG_COLORIZE);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Saturation", -100, 100, -100, 100, 0,
                         PF_Precision_INTEGER, 0, 0, DG_SATURATION);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Hue Shift", -180, 180, -180, 180, 0,
                         PF_Precision_INTEGER, 0, 0, DG_HUE_SHIFT);

    AEFX_CLR_STRUCT(def);
    PF_ADD_SLIDER("Passes", 1, 8, 1, 8, 2, DG_PASSES);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Falloff", 3, DG_FALLOFF_SOFT, DG_FALLOFF_CHOICES, DG_FALLOFF);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Blend", 2, DG_BLEND_SCREEN, DG_BLEND_OP_CHOICES, DG_BLEND_OP);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Glow Dimensions", 3, DG_DIM_BOTH, DG_DIMENSIONS_CHOICES, DG_DIMENSIONS);

    AEFX_CLR_STRUCT(def);
    PF_ADD_CHECKBOX("Glow Only", "", FALSE, 0, DG_GLOW_ONLY);

    /* --- cinematic params (v1 §4) ---------------------------------- */
    AEFX_CLR_STRUCT(def);
    PF_ADD_CHECKBOX("Linear Light", "", TRUE, 0, DG_LINEAR_LIGHT);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Tonemap", 3, DG_TONEMAP_SOFTCLIP, DG_TONEMAP_CHOICES, DG_TONEMAP);

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Highlight Compression", 0, 100, 0, 100, 0,
                         PF_Precision_INTEGER, 0, 0, DG_HIGHLIGHT_COMP);

    out_data->num_params = DG_NUM_PARAMS;
    return err;
}


/* ================================================================== *
 *  BRIDGE — AE UI params -> normalized glow::Params.
 *
 *  Float slider value : params[i]->u.fs_d.value   (PF_FpLong / double)
 *  Int slider value   : params[i]->u.sd.value     (A_long)
 *  Popup value        : params[i]->u.pd.value      (A_long, 1-based)
 *  Checkbox value     : params[i]->u.bd.value      (A_long 0/1)
 *  Color value        : params[i]->u.cd.value      (PF_Pixel A/R/G/B 0..255)
 *
 *  IMPORTANT (levels/Radius/Passes): per spec, Radius controls the glow
 *  size AND the mip-level COUNT. core::bloom derives levels from radius
 *  automatically when Params.levels == 0 (via autoLevels). So we set
 *  p.levels = 0 here. The "Passes" param is READ but intentionally left
 *  unwired (it does not yet feed the level weight ramp -- that is Task
 *  12's look-pass job). Do NOT set p.levels = passes, or Radius would do
 *  nothing.
 * ================================================================== */
static glow::Params
ReadParams(PF_ParamDef* params[])
{
    glow::Params p;

    p.intensity     = (float)(params[DG_INTENSITY]->u.fs_d.value / 100.0);
    p.radius        = (float)(params[DG_RADIUS]->u.fs_d.value);
    p.threshold     = (float)(params[DG_THRESHOLD]->u.fs_d.value / 255.0);
    p.thresholdSoft = (float)(params[DG_THRESHOLD_SOFT]->u.fs_d.value / 100.0);
    p.sourceGain    = (float)(params[DG_SOURCE_GAIN]->u.fs_d.value / 100.0);

    const PF_Pixel glowC = params[DG_GLOW_COLOR]->u.cd.value;   // A/R/G/B 0..255
    p.glowR = glowC.red   / 255.0f;
    p.glowG = glowC.green / 255.0f;
    p.glowB = glowC.blue  / 255.0f;

    p.colorize      = params[DG_COLORIZE]->u.bd.value != 0;
    p.saturation    = (float)(params[DG_SATURATION]->u.fs_d.value / 100.0);
    p.hueShift      = (float)(params[DG_HUE_SHIFT]->u.fs_d.value * (3.14159265358979323846 / 180.0)); // radians (currently a no-op in core)

    // Passes: READ but UNWIRED (see header note above). levels=0 -> auto from radius.
    (void)params[DG_PASSES]->u.sd.value;
    p.levels        = 0;

    p.falloff       = (int)params[DG_FALLOFF]->u.pd.value;        // DG_FALLOFF_* == glow::FALLOFF_*
    p.blendOp       = (int)params[DG_BLEND_OP]->u.pd.value;       // DG_BLEND_*   == glow::BLEND_*
    p.dimensions    = (int)params[DG_DIMENSIONS]->u.pd.value;     // DG_DIM_*     == glow::DIM_*
    p.glowOnly      = params[DG_GLOW_ONLY]->u.bd.value != 0;

    p.linearLight   = params[DG_LINEAR_LIGHT]->u.bd.value != 0;
    p.tonemap       = (int)params[DG_TONEMAP]->u.pd.value;        // DG_TONEMAP_* == glow::TONE_*
    p.highlightComp = (float)(params[DG_HIGHLIGHT_COMP]->u.fs_d.value / 100.0);

    return p;
}


/* ================================================================== *
 *  Pixel-format helpers
 * ================================================================== */
static const float k16Max = 32768.0f;   // AE 16-bit max is 0x8000, NOT 65535
static const float k8Max  = 255.0f;

static inline float clamp01(float v) { return v < 0.f ? 0.f : (v > 1.f ? 1.f : v); }

// Query a Smart-render world's pixel format via PF_WorldSuite2.
static PF_Err
GetWorldPixelFormat(PF_InData* in_data, PF_OutData* out_data,
                    PF_EffectWorld* worldP, PF_PixelFormat* fmtP)
{
    PF_Err           err = PF_Err_NONE;
    PF_WorldSuite2*  wsP = NULL;

    *fmtP = PF_PixelFormat_INVALID;

    ERR(AEFX_AcquireSuite(in_data, out_data,
                          kPFWorldSuite, kPFWorldSuiteVersion2,
                          "Couldn't load PF World Suite.",
                          (void**)&wsP));
    if (!err && wsP) {
        ERR(wsP->PF_GetPixelFormat(worldP, fmtP));
    }
    if (wsP) {
        AEFX_ReleaseSuite(in_data, out_data,
                          kPFWorldSuite, kPFWorldSuiteVersion2, NULL);
    }
    return err;
}


/* ------------------------------------------------------------------ *
 *  Build a tightly-packed RGBA-float glow::Image from an AE input
 *  world. AE channel order is ARGB; ours is RGBA. Range conversion
 *  depends on depth. Rows are walked by world->rowbytes (NOT w*px).
 * ------------------------------------------------------------------ */
static glow::Image
WorldToImage(const PF_EffectWorld* w, PF_PixelFormat fmt)
{
    glow::Image img(w->width, w->height);
    const char* baseRow = reinterpret_cast<const char*>(w->data);

    for (int y = 0; y < w->height; ++y) {
        const char* row = baseRow + (size_t)y * w->rowbytes;
        float* dst = img.at(0, y);

        if (fmt == PF_PixelFormat_ARGB128) {
            const PF_PixelFloat* s = reinterpret_cast<const PF_PixelFloat*>(row);
            for (int x = 0; x < w->width; ++x) {
                dst[0] = s[x].red;    // as-is, do NOT clamp on input (may exceed 1)
                dst[1] = s[x].green;
                dst[2] = s[x].blue;
                dst[3] = s[x].alpha;
                dst += 4;
            }
        } else if (fmt == PF_PixelFormat_ARGB64) {
            const PF_Pixel16* s = reinterpret_cast<const PF_Pixel16*>(row);
            for (int x = 0; x < w->width; ++x) {
                dst[0] = s[x].red   / k16Max;
                dst[1] = s[x].green / k16Max;
                dst[2] = s[x].blue  / k16Max;
                dst[3] = s[x].alpha / k16Max;
                dst += 4;
            }
        } else { // PF_PixelFormat_ARGB32 (8-bit)
            const PF_Pixel8* s = reinterpret_cast<const PF_Pixel8*>(row);
            for (int x = 0; x < w->width; ++x) {
                dst[0] = s[x].red   / k8Max;
                dst[1] = s[x].green / k8Max;
                dst[2] = s[x].blue  / k8Max;
                dst[3] = s[x].alpha / k8Max;
                dst += 4;
            }
        }
    }
    return img;
}


/* ------------------------------------------------------------------ *
 *  Write a glow::Image (RGBA float 0..1) into an AE output world,
 *  converting back to ARGB at the output depth. The glow image is the
 *  size of the INPUT world; output pixel (ox,oy) maps to glow pixel
 *  (ox - originX, oy - originY) where (originX,originY) is the origin
 *  of the input buffer within the output buffer.
 * ------------------------------------------------------------------ */
static void
ImageToWorld(const glow::Image& img, PF_EffectWorld* w, PF_PixelFormat fmt,
             int originX, int originY)
{
    char* baseRow = reinterpret_cast<char*>(w->data);

    for (int oy = 0; oy < w->height; ++oy) {
        int iy = oy - originY;
        char* row = baseRow + (size_t)oy * w->rowbytes;

        if (fmt == PF_PixelFormat_ARGB128) {
            PF_PixelFloat* d = reinterpret_cast<PF_PixelFloat*>(row);
            for (int ox = 0; ox < w->width; ++ox) {
                int ix = ox - originX;
                if (iy < 0 || iy >= img.h || ix < 0 || ix >= img.w) {
                    d[ox].alpha = d[ox].red = d[ox].green = d[ox].blue = 0.f;
                    continue;
                }
                const float* s = img.at(ix, iy);
                d[ox].red = s[0]; d[ox].green = s[1]; d[ox].blue = s[2]; // 32f unclamped
                d[ox].alpha = s[3];
            }
        } else if (fmt == PF_PixelFormat_ARGB64) {
            PF_Pixel16* d = reinterpret_cast<PF_Pixel16*>(row);
            for (int ox = 0; ox < w->width; ++ox) {
                int ix = ox - originX;
                if (iy < 0 || iy >= img.h || ix < 0 || ix >= img.w) {
                    d[ox].alpha = d[ox].red = d[ox].green = d[ox].blue = 0;
                    continue;
                }
                const float* s = img.at(ix, iy);
                d[ox].red   = (A_u_short)(clamp01(s[0]) * k16Max + 0.5f);
                d[ox].green = (A_u_short)(clamp01(s[1]) * k16Max + 0.5f);
                d[ox].blue  = (A_u_short)(clamp01(s[2]) * k16Max + 0.5f);
                d[ox].alpha = (A_u_short)(clamp01(s[3]) * k16Max + 0.5f);
            }
        } else { // PF_PixelFormat_ARGB32 (8-bit)
            PF_Pixel8* d = reinterpret_cast<PF_Pixel8*>(row);
            for (int ox = 0; ox < w->width; ++ox) {
                int ix = ox - originX;
                if (iy < 0 || iy >= img.h || ix < 0 || ix >= img.w) {
                    d[ox].alpha = d[ox].red = d[ox].green = d[ox].blue = 0;
                    continue;
                }
                const float* s = img.at(ix, iy);
                d[ox].red   = (A_u_char)(clamp01(s[0]) * k8Max + 0.5f);
                d[ox].green = (A_u_char)(clamp01(s[1]) * k8Max + 0.5f);
                d[ox].blue  = (A_u_char)(clamp01(s[2]) * k8Max + 0.5f);
                d[ox].alpha = (A_u_char)(clamp01(s[3]) * k8Max + 0.5f);
            }
        }
    }
}


/* ================================================================== *
 *  SMART_PRE_RENDER — checkout input, declare needed region.
 *  We outset the requested input region AND the result rects by the
 *  glow radius (margin = ceil(radius), conservative) so the bloom can
 *  gather source from beyond the output region and extend past the
 *  layer edge instead of clipping.
 * ================================================================== */
static PF_Err
PreRender(PF_InData* in_data, PF_OutData* out_data, PF_PreRenderExtra* extraP)
{
    PF_Err            err = PF_Err_NONE;
    PF_CheckoutResult in_result;
    PF_RenderRequest  req = extraP->input->output_request;

    // Read just the Radius param to size the expansion margin.
    PF_ParamDef radius_param;
    AEFX_CLR_STRUCT(radius_param);
    A_long margin = 0;
    if (!PF_CHECKOUT_PARAM(in_data, DG_RADIUS,
                           in_data->current_time, in_data->time_step,
                           in_data->time_scale, &radius_param)) {
        double r = radius_param.u.fs_d.value;
        margin = (A_long)ceil(r > 0 ? r : 0);
        PF_CHECKIN_PARAM(in_data, &radius_param);
    }

    // Outset the requested input rect by the margin on every side so the
    // engine has source pixels beyond the visible output region.
    if (req.rect.left > req.rect.right) { /* empty/invalid: leave as-is */ }
    else {
        req.rect.left   -= margin;
        req.rect.top    -= margin;
        req.rect.right  += margin;
        req.rect.bottom += margin;
    }

    ERR(extraP->cb->checkout_layer(in_data->effect_ref,
                                   DG_INPUT,
                                   DG_INPUT,
                                   &req,
                                   in_data->current_time,
                                   in_data->time_step,
                                   in_data->time_scale,
                                   &in_result));

    if (!err) {
        // Outset our own result rects by the margin so the glow can extend
        // past the layer edge (otherwise AE would clip it to the source).
        PF_LRect outR = in_result.result_rect;
        PF_LRect maxR = in_result.max_result_rect;
        outR.left -= margin; outR.top -= margin; outR.right += margin; outR.bottom += margin;
        maxR.left -= margin; maxR.top -= margin; maxR.right += margin; maxR.bottom += margin;

        UnionLRect(&outR, &extraP->output->result_rect);
        UnionLRect(&maxR, &extraP->output->max_result_rect);
    }
    return err;
}


/* ================================================================== *
 *  SMART_RENDER — build glow::Image from input, run core::bloom,
 *  write the result into the output world. Wrapped so any std/throw
 *  path returns a clean PF_Err (the dispatcher try/catch is the net).
 * ================================================================== */
static PF_Err
SmartRender(PF_InData* in_data, PF_OutData* out_data, PF_SmartRenderExtra* extraP)
{
    PF_Err err  = PF_Err_NONE;
    PF_Err err2 = PF_Err_NONE;

    PF_EffectWorld* input_worldP  = NULL;
    PF_EffectWorld* output_worldP = NULL;

    // Re-read the full param set for this frame (Smart render gets a fresh
    // params[] array; checkout each then check in).
    PF_ParamDef params_arr[DG_NUM_PARAMS];
    PF_ParamDef* params[DG_NUM_PARAMS];
    bool checked_out[DG_NUM_PARAMS] = { false };
    for (int i = 0; i < DG_NUM_PARAMS; ++i) {
        AEFX_CLR_STRUCT(params_arr[i]);
        params[i] = &params_arr[i];
    }
    for (int i = DG_INPUT + 1; i < DG_NUM_PARAMS && !err; ++i) {
        err = PF_CHECKOUT_PARAM(in_data, i,
                                in_data->current_time, in_data->time_step,
                                in_data->time_scale, &params_arr[i]);
        if (!err) checked_out[i] = true;
    }

    ERR(extraP->cb->checkout_layer_pixels(in_data->effect_ref, DG_INPUT, &input_worldP));
    ERR(extraP->cb->checkout_output(in_data->effect_ref, &output_worldP));

    if (!err && input_worldP && output_worldP &&
        input_worldP->width > 0 && input_worldP->height > 0 &&
        output_worldP->width > 0 && output_worldP->height > 0) {

        PF_PixelFormat in_fmt  = PF_PixelFormat_INVALID;
        PF_PixelFormat out_fmt = PF_PixelFormat_INVALID;
        ERR(GetWorldPixelFormat(in_data, out_data, input_worldP, &in_fmt));
        ERR(GetWorldPixelFormat(in_data, out_data, output_worldP, &out_fmt));

        if (!err) {
            glow::Params gp = ReadParams(params);

            // Build the source image from the (possibly expanded) input world.
            glow::Image src = WorldToImage(input_worldP, in_fmt);

            // Run the engine. All glow math lives in core/.
            glow::Image dst = glow::bloom(src, gp);

            // Map: origin of input buffer within the output buffer.
            // Non-zero only when the buffer was expanded in PreRender.
            int originX = (int)in_data->output_origin_x;
            int originY = (int)in_data->output_origin_y;

            ImageToWorld(dst, output_worldP, out_fmt, originX, originY);
        }
    } else if (!err) {
        err = PF_Err_BAD_CALLBACK_PARAM;
    }

    err2 = extraP->cb->checkin_layer_pixels(in_data->effect_ref, DG_INPUT);

    for (int i = DG_INPUT + 1; i < DG_NUM_PARAMS; ++i) {
        if (checked_out[i]) PF_CHECKIN_PARAM(in_data, &params_arr[i]);
    }

    return err ? err : err2;
}


/* ================================================================== *
 *  Registration entry point (required for the host to load the effect)
 * ================================================================== */
extern "C" DllExport
PF_Err PluginDataEntryFunction2(
    PF_PluginDataPtr   inPtr,
    PF_PluginDataCB2   inPluginDataCallBackPtr,
    SPBasicSuite*      inSPBasicSuitePtr,
    const char*        inHostName,
    const char*        inHostVersion)
{
    PF_Err result = PF_Err_INVALID_CALLBACK;

    result = PF_REGISTER_EFFECT_EXT2(
        inPtr,
        inPluginDataCallBackPtr,
        DG_NAME,                                 // Name
        "DKVB DeepGlowGPU",                      // Match Name (must match PiPL)
        DG_CATEGORY,                             // Category
        AE_RESERVED_INFO,                        // Reserved Info
        "EffectMain",                            // Entry point
        "https://github.com/billymfant/AE_PLUGINS"); // support URL

    return result;
}


/* ================================================================== *
 *  EffectMain — AE command dispatcher
 * ================================================================== */
extern "C" DllExport
PF_Err EffectMain(PF_Cmd cmd, PF_InData* in_data, PF_OutData* out_data,
                  PF_ParamDef* params[], PF_LayerDef* output, void* extra)
{
    PF_Err err = PF_Err_NONE;
    try {
        switch (cmd) {
            case PF_Cmd_ABOUT:
                err = About(in_data, out_data, params, output);
                break;
            case PF_Cmd_GLOBAL_SETUP:
                err = GlobalSetup(in_data, out_data, params, output);
                break;
            case PF_Cmd_PARAMS_SETUP:
                err = ParamsSetup(in_data, out_data, params, output);
                break;
            case PF_Cmd_SMART_PRE_RENDER:
                err = PreRender(in_data, out_data, reinterpret_cast<PF_PreRenderExtra*>(extra));
                break;
            case PF_Cmd_SMART_RENDER:
                err = SmartRender(in_data, out_data, reinterpret_cast<PF_SmartRenderExtra*>(extra));
                break;
            default:
                break;
        }
    } catch (PF_Err& thrown) {
        err = thrown;
    } catch (...) {
        err = PF_Err_OUT_OF_MEMORY;   // e.g. std::bad_alloc from a huge Image
    }
    return err;
}

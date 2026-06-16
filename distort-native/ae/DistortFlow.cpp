/*
 *  DistortFlow.cpp — native After Effects entry point for Distort Flow.
 *
 *  Thin adapter: AE params -> distort::Params, blit the input world into a
 *  distort::Image, call distort::warp() (all math in ../core/), write back 1:1.
 *  CPU SmartRender. Flow animates across footage time via time=current_time/time_scale.
 *  Modeled on color-native/ae/ColorLab.cpp.
 */
#include "DistortFlow.h"

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
#include "Smart_Utils.h"
#include "String_Utils.h"

#include "distort_core.h"   // distort::Image / Params / warp
#include <string.h>
#include <math.h>

/* ================================================================== ABOUT */
static PF_Err
About(PF_InData* in_data, PF_OutData* out_data, PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_SPRINTF(out_data->return_msg, "%s, v%d.%d\r%s",
               DF_NAME, DF_MAJOR_VERSION, DF_MINOR_VERSION, DF_DESCRIPTION);
    return PF_Err_NONE;
}

/* ============================================================ GLOBAL_SETUP
 * D3a is VISIBLE in the Effects menu (no I_AM_OBSOLETE) so it can be applied by
 * hand for verification. out_flags / out_flags2 MUST match the PiPL hex:
 *   out_flags  = PIX_INDEPENDENT(0x400) | DEEP_COLOR_AWARE(0x2000000)      = 0x2000400
 *   out_flags2 = SMART_RENDER(1<<10) | FLOAT_COLOR_AWARE(1<<12)
 *              | SUPPORTS_THREADED_RENDERING(1<<27)                        = 0x8001400 */
static PF_Err
GlobalSetup(PF_InData* in_data, PF_OutData* out_data, PF_ParamDef* params[], PF_LayerDef* output)
{
    out_data->my_version = PF_VERSION(DF_MAJOR_VERSION, DF_MINOR_VERSION,
                                      DF_BUG_VERSION, DF_STAGE_VERSION, DF_BUILD_VERSION);
    out_data->out_flags  = PF_OutFlag_PIX_INDEPENDENT | PF_OutFlag_DEEP_COLOR_AWARE;
    out_data->out_flags2 = PF_OutFlag2_SUPPORTS_SMART_RENDER |
                           PF_OutFlag2_FLOAT_COLOR_AWARE |
                           PF_OutFlag2_SUPPORTS_THREADED_RENDERING;
    return PF_Err_NONE;
}

/* ============================================================ PARAMS_SETUP
 * Order MUST match the DFP_* enum. */
static PF_Err
ParamsSetup(PF_InData* in_data, PF_OutData* out_data, PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_Err      err = PF_Err_NONE;
    PF_ParamDef def;

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Map Type", 4, distort::MAP_WAVE, DF_MAP_CHOICES, DFP_MAPTYPE);  // default Wave: smooth, in-place
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Angle", -180, 180, -180, 180, 0, PF_Precision_INTEGER, 0, 0, DFP_ANGLE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Spacing", 0, 32, 0, 32, 4, PF_Precision_HUNDREDTHS, 0, 0, DFP_SPACING);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Wave Frequency", 0, 20, 0, 20, 4, PF_Precision_HUNDREDTHS, 0, 0, DFP_WAVEFREQ);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Wave Phase", -360, 360, -360, 360, 0, PF_Precision_INTEGER, 0, 0, DFP_WAVEPHASE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Noise Scale", 0.5, 16, 0.5, 16, 3, PF_Precision_HUNDREDTHS, 0, 0, DFP_NOISESCALE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Noise Detail", 1, 6, 1, 6, 3, PF_Precision_INTEGER, 0, 0, DFP_NOISEDETAIL);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Noise Seed", 1, 999, 1, 999, 1, PF_Precision_INTEGER, 0, 0, DFP_NOISESEED);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Map Contrast", -100, 100, -100, 100, 0, PF_Precision_INTEGER, 0, 0, DFP_CONTRAST);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Displace Mode", 3, distort::DISP_FIXED, DF_DISP_CHOICES, DFP_DISPMODE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Amount (px)", 0, 400, 0, 400, 0, PF_Precision_HUNDREDTHS, 0, 0, DFP_AMOUNT);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Flow Direction", 4, distort::FLOW_FORWARD, DF_FLOW_CHOICES, DFP_FLOWDIR);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Flow Speed (cyc/s)", -4, 4, -4, 4, 0, PF_Precision_HUNDREDTHS, 0, 0, DFP_FLOWSPEED);
    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Loop", 3, distort::LOOP_LOOP, DF_LOOP_CHOICES, DFP_LOOP);
    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Easing", 6, distort::EASE_LINEAR, DF_EASE_CHOICES, DFP_EASING);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Jitter", 0, 100, 0, 100, 0, PF_Precision_INTEGER, 0, 0, DFP_JITTER);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Jitter Seed", 1, 999, 1, 999, 1, PF_Precision_INTEGER, 0, 0, DFP_JITTERSEED);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Phase", 0, 1, 0, 1, 0, PF_Precision_THOUSANDTHS, 0, 0, DFP_PHASE);

    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Edges", 4, distort::EDGE_MIRROR, DF_EDGE_CHOICES, DFP_EDGE);  // default Mirror: fills the canvas
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Opacity", 0, 100, 0, 100, 100, PF_Precision_INTEGER, 0, 0, DFP_OPACITY);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Mosaic Block (px)", 0, 200, 0, 200, 0, PF_Precision_INTEGER, 0, 0, DFP_MOSAIC);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Rows", 0, 64, 0, 64, 0, PF_Precision_INTEGER, 0, 0, DFP_SLATROWS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Columns", 0, 64, 0, 64, 0, PF_Precision_INTEGER, 0, 0, DFP_SLATCOLS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Slat Stagger", 0, 100, 0, 100, 0, PF_Precision_INTEGER, 0, 0, DFP_SLATSTAGGER);

    out_data->num_params = DF_NUM_PARAMS;
    return err;
}

/* ================================================== AE params -> distort::Params */
static distort::Params
ReadParams(PF_ParamDef* params[])
{
    const float PI = 3.14159265f;
    distort::Params p;
    p.mapType      = (int)params[DFP_MAPTYPE]->u.pd.value;        // 1..4 == MAP_*
    p.angleDeg     = (float)params[DFP_ANGLE]->u.fs_d.value;
    p.spacing      = (float)params[DFP_SPACING]->u.fs_d.value;
    p.waveFreq     = (float)params[DFP_WAVEFREQ]->u.fs_d.value;
    p.wavePhase    = (float)(params[DFP_WAVEPHASE]->u.fs_d.value * PI / 180.0); // deg->rad
    p.noiseScale   = (float)params[DFP_NOISESCALE]->u.fs_d.value;
    p.noiseDetail  = (int)params[DFP_NOISEDETAIL]->u.fs_d.value;
    p.noiseSeed    = (int)params[DFP_NOISESEED]->u.fs_d.value;
    p.mapContrast  = (float)(params[DFP_CONTRAST]->u.fs_d.value / 100.0);
    p.displaceMode = (int)params[DFP_DISPMODE]->u.pd.value;       // 1..3 == DISP_*
    p.amount       = (float)params[DFP_AMOUNT]->u.fs_d.value;
    p.flowDir      = (int)params[DFP_FLOWDIR]->u.pd.value;        // 1..4 == FLOW_*
    p.flowSpeed    = (float)params[DFP_FLOWSPEED]->u.fs_d.value;
    p.loopMode     = (int)params[DFP_LOOP]->u.pd.value;           // 1..3 == LOOP_*
    p.easing       = (int)params[DFP_EASING]->u.pd.value;         // 1..6 == EASE_*
    p.jitter       = (float)(params[DFP_JITTER]->u.fs_d.value / 100.0);
    p.jitterSeed   = (int)params[DFP_JITTERSEED]->u.fs_d.value;
    p.phase        = (float)params[DFP_PHASE]->u.fs_d.value;
    p.edgeMode     = (int)params[DFP_EDGE]->u.pd.value;           // 1..4 == EDGE_*
    p.opacity      = (float)(params[DFP_OPACITY]->u.fs_d.value / 100.0);
    p.mosaicBlock  = (float)params[DFP_MOSAIC]->u.fs_d.value;
    p.slatRows    = (int)params[DFP_SLATROWS]->u.fs_d.value;
    p.slatCols    = (int)params[DFP_SLATCOLS]->u.fs_d.value;
    p.slatStagger = (float)(params[DFP_SLATSTAGGER]->u.fs_d.value / 100.0);
    return p;
}

/* ================================================== pixel-format helpers */
static const float k16Max = 32768.0f;   // AE 16-bit max is 0x8000
static const float k8Max  = 255.0f;
static inline float clamp01(float v) { return v < 0.f ? 0.f : (v > 1.f ? 1.f : v); }

static PF_Err
GetWorldPixelFormat(PF_InData* in_data, PF_OutData* out_data,
                    PF_EffectWorld* worldP, PF_PixelFormat* fmtP)
{
    PF_Err err = PF_Err_NONE;
    PF_WorldSuite2* wsP = NULL;
    *fmtP = PF_PixelFormat_INVALID;
    ERR(AEFX_AcquireSuite(in_data, out_data, kPFWorldSuite, kPFWorldSuiteVersion2,
                          "Couldn't load PF World Suite.", (void**)&wsP));
    if (!err && wsP) ERR(wsP->PF_GetPixelFormat(worldP, fmtP));
    if (wsP) AEFX_ReleaseSuite(in_data, out_data, kPFWorldSuite, kPFWorldSuiteVersion2, NULL);
    return err;
}

// Blit an AE input world (ARGB, depth-dependent) into our RGBA-float Image 1:1.
static void
BlitWorldIntoImage(distort::Image& img, const PF_EffectWorld* w, PF_PixelFormat fmt)
{
    const char* baseRow = reinterpret_cast<const char*>(w->data);
    int H = w->height < img.h ? w->height : img.h;
    int W = w->width  < img.w ? w->width  : img.w;
    for (int y = 0; y < H; ++y) {
        const char* row = baseRow + (size_t)y * w->rowbytes;
        float* dst = img.at(0, y);
        if (fmt == PF_PixelFormat_ARGB128) {
            const PF_PixelFloat* s = reinterpret_cast<const PF_PixelFloat*>(row);
            for (int x = 0; x < W; ++x) { dst[0]=s[x].red; dst[1]=s[x].green; dst[2]=s[x].blue; dst[3]=s[x].alpha; dst+=4; }
        } else if (fmt == PF_PixelFormat_ARGB64) {
            const PF_Pixel16* s = reinterpret_cast<const PF_Pixel16*>(row);
            for (int x = 0; x < W; ++x) { dst[0]=s[x].red/k16Max; dst[1]=s[x].green/k16Max; dst[2]=s[x].blue/k16Max; dst[3]=s[x].alpha/k16Max; dst+=4; }
        } else { // ARGB32 (8-bit)
            const PF_Pixel8* s = reinterpret_cast<const PF_Pixel8*>(row);
            for (int x = 0; x < W; ++x) { dst[0]=s[x].red/k8Max; dst[1]=s[x].green/k8Max; dst[2]=s[x].blue/k8Max; dst[3]=s[x].alpha/k8Max; dst+=4; }
        }
    }
}

// Write our RGBA-float Image back into an AE output world 1:1, at output depth.
static void
ImageToWorld(const distort::Image& img, PF_EffectWorld* w, PF_PixelFormat fmt)
{
    char* baseRow = reinterpret_cast<char*>(w->data);
    int H = w->height < img.h ? w->height : img.h;
    int W = w->width  < img.w ? w->width  : img.w;
    for (int oy = 0; oy < H; ++oy) {
        char* row = baseRow + (size_t)oy * w->rowbytes;
        if (fmt == PF_PixelFormat_ARGB128) {
            PF_PixelFloat* d = reinterpret_cast<PF_PixelFloat*>(row);
            for (int ox = 0; ox < W; ++ox) { const float* s=img.at(ox,oy); d[ox].red=s[0]; d[ox].green=s[1]; d[ox].blue=s[2]; d[ox].alpha=s[3]; }
        } else if (fmt == PF_PixelFormat_ARGB64) {
            PF_Pixel16* d = reinterpret_cast<PF_Pixel16*>(row);
            for (int ox = 0; ox < W; ++ox) { const float* s=img.at(ox,oy);
                d[ox].red=(A_u_short)(clamp01(s[0])*k16Max+0.5f); d[ox].green=(A_u_short)(clamp01(s[1])*k16Max+0.5f);
                d[ox].blue=(A_u_short)(clamp01(s[2])*k16Max+0.5f); d[ox].alpha=(A_u_short)(clamp01(s[3])*k16Max+0.5f); }
        } else { // ARGB32 (8-bit)
            PF_Pixel8* d = reinterpret_cast<PF_Pixel8*>(row);
            for (int ox = 0; ox < W; ++ox) { const float* s=img.at(ox,oy);
                d[ox].red=(A_u_char)(clamp01(s[0])*k8Max+0.5f); d[ox].green=(A_u_char)(clamp01(s[1])*k8Max+0.5f);
                d[ox].blue=(A_u_char)(clamp01(s[2])*k8Max+0.5f); d[ox].alpha=(A_u_char)(clamp01(s[3])*k8Max+0.5f); }
        }
    }
}

/* ============================================================ SMART_PRE_RENDER (1:1) */
static PF_Err
PreRender(PF_InData* in_data, PF_OutData* out_data, PF_PreRenderExtra* extraP)
{
    PF_Err err = PF_Err_NONE;
    PF_CheckoutResult in_result;
    PF_RenderRequest  req = extraP->input->output_request;
    req.preserve_rgb_of_zero_alpha = FALSE;
    ERR(extraP->cb->checkout_layer(in_data->effect_ref, DFP_INPUT, DFP_INPUT, &req,
                                   in_data->current_time, in_data->time_step,
                                   in_data->time_scale, &in_result));
    if (!err) {
        extraP->output->result_rect     = extraP->input->output_request.rect;
        extraP->output->max_result_rect = extraP->input->output_request.rect;
    }
    return err;
}

/* ============================================================ SMART_RENDER (CPU) */
static PF_Err
SmartRender(PF_InData* in_data, PF_OutData* out_data, PF_SmartRenderExtra* extraP)
{
    PF_Err err = PF_Err_NONE, err2 = PF_Err_NONE;
    PF_EffectWorld* input_worldP  = NULL;
    PF_EffectWorld* output_worldP = NULL;

    PF_ParamDef params_arr[DF_NUM_PARAMS];
    bool checked_out[DF_NUM_PARAMS] = { false };
    PF_ParamDef* params[DF_NUM_PARAMS];
    for (int i = 0; i < DF_NUM_PARAMS; ++i) { AEFX_CLR_STRUCT(params_arr[i]); params[i] = &params_arr[i]; }
    for (int i = DFP_INPUT + 1; i < DF_NUM_PARAMS && !err; ++i) {
        err = PF_CHECKOUT_PARAM(in_data, i, in_data->current_time, in_data->time_step,
                                in_data->time_scale, &params_arr[i]);
        if (!err) checked_out[i] = true;
    }

    ERR(extraP->cb->checkout_layer_pixels(in_data->effect_ref, DFP_INPUT, &input_worldP));
    ERR(extraP->cb->checkout_output(in_data->effect_ref, &output_worldP));

    if (!err && input_worldP && output_worldP &&
        input_worldP->width > 0 && input_worldP->height > 0) {

        PF_PixelFormat in_fmt = PF_PixelFormat_INVALID, out_fmt = PF_PixelFormat_INVALID;
        ERR(GetWorldPixelFormat(in_data, out_data, input_worldP,  &in_fmt));
        ERR(GetWorldPixelFormat(in_data, out_data, output_worldP, &out_fmt));

        if (!err) {
            distort::Params dp = ReadParams(params);
            // footage time in seconds -> drives flow animation across the clip
            float t = (in_data->time_scale != 0)
                    ? (float)in_data->current_time / (float)in_data->time_scale : 0.f;
            distort::Image src(output_worldP->width, output_worldP->height);
            distort::Image dst(output_worldP->width, output_worldP->height);
            BlitWorldIntoImage(src, input_worldP, in_fmt);  // 1:1, output==input size
            distort::warp(src, dst, dp, nullptr, t);        // all math in core/
            ImageToWorld(dst, output_worldP, out_fmt);
        }
    } else if (!err) {
        err = PF_Err_BAD_CALLBACK_PARAM;
    }

    err2 = extraP->cb->checkin_layer_pixels(in_data->effect_ref, DFP_INPUT);
    for (int i = DFP_INPUT + 1; i < DF_NUM_PARAMS; ++i)
        if (checked_out[i]) PF_CHECKIN_PARAM(in_data, &params_arr[i]);
    return err ? err : err2;
}

/* ============================================================ registration */
extern "C" DllExport
PF_Err PluginDataEntryFunction2(
    PF_PluginDataPtr inPtr, PF_PluginDataCB2 inPluginDataCallBackPtr,
    SPBasicSuite* inSPBasicSuitePtr, const char* inHostName, const char* inHostVersion)
{
    PF_Err result = PF_Err_INVALID_CALLBACK;
    result = PF_REGISTER_EFFECT_EXT2(
        inPtr, inPluginDataCallBackPtr,
        DF_NAME, "DKVB DistortFlow", DF_CATEGORY, AE_RESERVED_INFO,
        "EffectMain", "https://github.com/billymfant/AE_PLUGINS");
    return result;
}

/* ============================================================ EffectMain */
extern "C" DllExport
PF_Err EffectMain(PF_Cmd cmd, PF_InData* in_data, PF_OutData* out_data,
                  PF_ParamDef* params[], PF_LayerDef* output, void* extra)
{
    PF_Err err = PF_Err_NONE;
    try {
        switch (cmd) {
            case PF_Cmd_ABOUT:            err = About(in_data, out_data, params, output); break;
            case PF_Cmd_GLOBAL_SETUP:     err = GlobalSetup(in_data, out_data, params, output); break;
            case PF_Cmd_PARAMS_SETUP:     err = ParamsSetup(in_data, out_data, params, output); break;
            case PF_Cmd_SMART_PRE_RENDER: err = PreRender(in_data, out_data, reinterpret_cast<PF_PreRenderExtra*>(extra)); break;
            case PF_Cmd_SMART_RENDER:     err = SmartRender(in_data, out_data, reinterpret_cast<PF_SmartRenderExtra*>(extra)); break;
            default: break;
        }
    } catch (PF_Err& thrown) { err = thrown; }
      catch (...)            { err = PF_Err_OUT_OF_MEMORY; }
    return err;
}

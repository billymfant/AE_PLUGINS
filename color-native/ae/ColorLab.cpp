/*
 *  ColorLab.cpp — native After Effects entry point for Color Lab.
 *
 *  Thin adapter: converts AE params -> colorlab::Params, blits the input world
 *  into a colorlab::Image, calls colorlab::grade() (all math in ../core/), and
 *  writes the result back 1:1. CPU SmartRender path (the required fallback).
 *
 *  Modeled on glow-native/ae/DeepGlowGPU.cpp (M1, CPU-only) and the SDK's
 *  SDK_Invert_ProcAmp sample. GPU SmartRender, curves/HSL params, and scope
 *  emission are follow-ups (see README) — the engine already supports them.
 */
#include "ColorLab.h"

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

#include "color_core.h"   // colorlab::Image / Params / grade
#include <cstdio>         // sprintf — tone-curve param names
#include <cmath>          // fabsf — identity-curve detection

#include <string.h>
#include <math.h>

/* ================================================================== ABOUT */
static PF_Err
About(PF_InData* in_data, PF_OutData* out_data, PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_SPRINTF(out_data->return_msg, "%s, v%d.%d\r%s",
               CL_NAME, CL_MAJOR_VERSION, CL_MINOR_VERSION, CL_DESCRIPTION);
    return PF_Err_NONE;
}

/* ============================================================ GLOBAL_SETUP
 * out_flags / out_flags2 MUST match the PiPL hex:
 *   out_flags  = PIX_INDEPENDENT(0x400) | DEEP_COLOR_AWARE(0x2000000) = 0x2000400
 *   out_flags2 = SMART_RENDER(1<<10) | FLOAT_COLOR_AWARE(1<<12)
 *              | SUPPORTS_THREADED_RENDERING(1<<27)                   = 0x8001400
 * (No GPU flag in this MVP — CPU SmartRender only, like glow's M1.) */
static PF_Err
GlobalSetup(PF_InData* in_data, PF_OutData* out_data, PF_ParamDef* params[], PF_LayerDef* output)
{
    out_data->my_version = PF_VERSION(CL_MAJOR_VERSION, CL_MINOR_VERSION,
                                      CL_BUG_VERSION, CL_STAGE_VERSION, CL_BUILD_VERSION);
    out_data->out_flags  = PF_OutFlag_PIX_INDEPENDENT | PF_OutFlag_DEEP_COLOR_AWARE;
    out_data->out_flags2 = PF_OutFlag2_SUPPORTS_SMART_RENDER |
                           PF_OutFlag2_FLOAT_COLOR_AWARE |
                           PF_OutFlag2_SUPPORTS_THREADED_RENDERING;
    return PF_Err_NONE;
}

/* ============================================================ PARAMS_SETUP
 * Order MUST match the CLP_* enum. Wheels are 12 sliders (panel drives them;
 * the AE UI being verbose is fine since users use the CEP panel). */
static PF_Err
ParamsSetup(PF_InData* in_data, PF_OutData* out_data, PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_Err      err = PF_Err_NONE;
    PF_ParamDef def;

    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Exposure (stops)", -5, 5, -5, 5, 0,
                         PF_Precision_HUNDREDTHS, 0, 0, CLP_EXPOSURE);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Contrast", -100, 100, -100, 100, 0,
                         PF_Precision_INTEGER, 0, 0, CLP_CONTRAST);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Contrast Pivot", 0, 1, 0, 1, 0.18,
                         PF_Precision_HUNDREDTHS, 0, 0, CLP_PIVOT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Temperature", -100, 100, -100, 100, 0,
                         PF_Precision_INTEGER, 0, 0, CLP_TEMP);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Tint", -100, 100, -100, 100, 0,
                         PF_Precision_INTEGER, 0, 0, CLP_TINT);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Saturation", -100, 100, -100, 100, 0,
                         PF_Precision_INTEGER, 0, 0, CLP_SAT);

    /* Lift / Gamma / Gain — R,G,B offset + master luma, as % (-50..50 -> -0.5..0.5) */
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Lift R",     -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_LIFT_R);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Lift G",     -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_LIFT_G);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Lift B",     -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_LIFT_B);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Lift Luma",  -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_LIFT_L);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gamma R",    -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAMMA_R);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gamma G",    -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAMMA_G);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gamma B",    -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAMMA_B);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gamma Luma", -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAMMA_L);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gain R",     -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAIN_R);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gain G",     -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAIN_G);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gain B",     -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAIN_B);
    AEFX_CLR_STRUCT(def); PF_ADD_FLOAT_SLIDERX("Gain Luma",  -50, 50, -50, 50, 0, PF_Precision_INTEGER, 0, 0, CLP_GAIN_L);

    AEFX_CLR_STRUCT(def);
    PF_ADD_CHECKBOX("Linear Light", "", FALSE, 0, CLP_LINEAR);   // default OFF: grade in display space
    AEFX_CLR_STRUCT(def);
    PF_ADD_POPUP("Tonemap", 3, colorlab::TONE_NONE, CL_TONEMAP_CHOICES, CLP_TONEMAP);  // default None: neutral = untouched
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Highlight Compression", 0, 100, 0, 100, 50,
                         PF_Precision_INTEGER, 0, 0, CLP_HICOMP);

    // Tone-curve LUT nodes: 4 channels (Master,R,G,B) x 16, range 0..1, identity
    // default (node i = i/15). Driven by the CEP panel; named so colorlab.jsx can
    // set them by display name ("Curve M 00".."Curve B 15").
    {
        const char* chTag[4] = { "M", "R", "G", "B" };
        char nm[32];
        for (int ch = 0; ch < 4; ++ch) {
            for (int i = 0; i < CL_CURVE_N; ++i) {
                PF_FpLong dflt = (PF_FpLong)i / (PF_FpLong)(CL_CURVE_N - 1);
                sprintf_s(nm, sizeof(nm), "Curve %s %02d", chTag[ch], i);
                AEFX_CLR_STRUCT(def);
                PF_ADD_FLOAT_SLIDERX(nm, 0, 1, 0, 1, dflt,
                                     PF_Precision_THOUSANDTHS, 0, 0,
                                     CLP_CURVE_BASE + ch * CL_CURVE_N + i);
            }
        }
    }

    out_data->num_params = CL_NUM_PARAMS;
    return err;
}

/* Rebuild one tone curve from its 16 LUT params (fixed x = i/15). If every node
 * is at its identity default, leave the curve at n=0 (evalCurve = pass-through),
 * so untouched channels cost nothing at render time. */
static void
ReadCurve(colorlab::Curve& c, PF_ParamDef* params[], int base)
{
    float y[CL_CURVE_N];
    bool  identity = true;
    for (int i = 0; i < CL_CURVE_N; ++i) {
        y[i] = (float)(params[base + i]->u.fs_d.value);
        if (fabsf(y[i] - (float)i / (float)(CL_CURVE_N - 1)) > 1e-4f) identity = false;
    }
    if (identity) { c.n = 0; return; }
    c.n = CL_CURVE_N;
    for (int i = 0; i < CL_CURVE_N; ++i) {
        c.x[i] = (float)i / (float)(CL_CURVE_N - 1);
        c.y[i] = y[i];
    }
    colorlab::prepareCurve(c);
}

/* ================================================== AE params -> colorlab::Params */
static colorlab::Params
ReadParams(PF_ParamDef* params[])
{
    colorlab::Params p;
    p.exposure      = (float)(params[CLP_EXPOSURE]->u.fs_d.value);
    p.contrast      = (float)(params[CLP_CONTRAST]->u.fs_d.value / 100.0);
    p.contrastPivot = (float)(params[CLP_PIVOT]->u.fs_d.value);
    p.temperature   = (float)(params[CLP_TEMP]->u.fs_d.value / 100.0);
    p.tint          = (float)(params[CLP_TINT]->u.fs_d.value / 100.0);
    p.saturation    = (float)(params[CLP_SAT]->u.fs_d.value / 100.0);

    p.liftR  = (float)(params[CLP_LIFT_R]->u.fs_d.value / 100.0);
    p.liftG  = (float)(params[CLP_LIFT_G]->u.fs_d.value / 100.0);
    p.liftB  = (float)(params[CLP_LIFT_B]->u.fs_d.value / 100.0);
    p.liftLuma = (float)(params[CLP_LIFT_L]->u.fs_d.value / 100.0);
    p.gammaR = (float)(params[CLP_GAMMA_R]->u.fs_d.value / 100.0);
    p.gammaG = (float)(params[CLP_GAMMA_G]->u.fs_d.value / 100.0);
    p.gammaB = (float)(params[CLP_GAMMA_B]->u.fs_d.value / 100.0);
    p.gammaLuma = (float)(params[CLP_GAMMA_L]->u.fs_d.value / 100.0);
    p.gainR  = (float)(params[CLP_GAIN_R]->u.fs_d.value / 100.0);
    p.gainG  = (float)(params[CLP_GAIN_G]->u.fs_d.value / 100.0);
    p.gainB  = (float)(params[CLP_GAIN_B]->u.fs_d.value / 100.0);
    p.gainLuma = (float)(params[CLP_GAIN_L]->u.fs_d.value / 100.0);

    p.linearLight   = params[CLP_LINEAR]->u.bd.value != 0;
    p.tonemap       = (int)params[CLP_TONEMAP]->u.pd.value;   // 1,2,3 == colorlab::TONE_*
    p.highlightComp = (float)(params[CLP_HICOMP]->u.fs_d.value / 100.0);

    // tone curves: Master + per-channel R/G/B (16-node LUTs from the panel).
    ReadCurve(p.curveMaster, params, CLP_CURVE_BASE + 0 * CL_CURVE_N);
    ReadCurve(p.curveR,      params, CLP_CURVE_BASE + 1 * CL_CURVE_N);
    ReadCurve(p.curveG,      params, CLP_CURVE_BASE + 2 * CL_CURVE_N);
    ReadCurve(p.curveB,      params, CLP_CURVE_BASE + 3 * CL_CURVE_N);
    // HSL secondary stays disabled (follow-up).
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
BlitWorldIntoImage(colorlab::Image& img, const PF_EffectWorld* w, PF_PixelFormat fmt)
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
ImageToWorld(const colorlab::Image& img, PF_EffectWorld* w, PF_PixelFormat fmt)
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
    ERR(extraP->cb->checkout_layer(in_data->effect_ref, CLP_INPUT, CLP_INPUT, &req,
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

    PF_ParamDef params_arr[CL_NUM_PARAMS];
    bool checked_out[CL_NUM_PARAMS] = { false };
    PF_ParamDef* params[CL_NUM_PARAMS];
    for (int i = 0; i < CL_NUM_PARAMS; ++i) { AEFX_CLR_STRUCT(params_arr[i]); params[i] = &params_arr[i]; }
    for (int i = CLP_INPUT + 1; i < CL_NUM_PARAMS && !err; ++i) {
        err = PF_CHECKOUT_PARAM(in_data, i, in_data->current_time, in_data->time_step,
                                in_data->time_scale, &params_arr[i]);
        if (!err) checked_out[i] = true;
    }

    ERR(extraP->cb->checkout_layer_pixels(in_data->effect_ref, CLP_INPUT, &input_worldP));
    ERR(extraP->cb->checkout_output(in_data->effect_ref, &output_worldP));

    if (!err && input_worldP && output_worldP &&
        input_worldP->width > 0 && input_worldP->height > 0) {

        PF_PixelFormat in_fmt = PF_PixelFormat_INVALID, out_fmt = PF_PixelFormat_INVALID;
        ERR(GetWorldPixelFormat(in_data, out_data, input_worldP,  &in_fmt));
        ERR(GetWorldPixelFormat(in_data, out_data, output_worldP, &out_fmt));

        if (!err) {
            colorlab::Params gp = ReadParams(params);
            colorlab::Image img(output_worldP->width, output_worldP->height);
            BlitWorldIntoImage(img, input_worldP, in_fmt);   // 1:1, output==input size
            colorlab::grade(img, gp);                        // all math in core/
            ImageToWorld(img, output_worldP, out_fmt);
        }
    } else if (!err) {
        err = PF_Err_BAD_CALLBACK_PARAM;
    }

    err2 = extraP->cb->checkin_layer_pixels(in_data->effect_ref, CLP_INPUT);
    for (int i = CLP_INPUT + 1; i < CL_NUM_PARAMS; ++i)
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
        CL_NAME, "DKVB ColorLab", CL_CATEGORY, AE_RESERVED_INFO,
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

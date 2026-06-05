/*
 *  DeepGlowGPU.cpp
 *  Native After Effects entry point for Deep Glow.
 *
 *  MILESTONE M0 (this file): a LOADABLE Smart-FX shell.
 *  --------------------------------------------------------------------
 *  This is the de-risking build: PiPL + dispatch + a PASSTHROUGH render
 *  (output == input, image unchanged). It declares the full v1 param set
 *  (incl. the 3 cinematic params) so the UI is final, but does NO image
 *  processing yet. The CPU path is wired to core::bloom in Task 10 and
 *  CUDA in Task 11; until then the GPU/CUDA code is intentionally NOT
 *  compiled in (no SUPPORTS_GPU_RENDER_F32 flag, no .cu in the build).
 *
 *  AE command flow used here:
 *      ABOUT             -> version string
 *      GLOBAL_SETUP      -> advertise flags (Smart + float, NO GPU)
 *      PARAMS_SETUP      -> add UI params (mirrors jsx/glow.jsx + cinematic)
 *      SMART_PRE_RENDER  -> checkout input, union result rects
 *      SMART_RENDER      -> copy input world -> output world (passthrough)
 *
 *  Modeled on the SDK's SDK_Invert_ProcAmp sample (GPU bits removed).
 */

#include "DeepGlowGPU.h"

#include "AEConfig.h"
#include "entry.h"
#include "AEFX_SuiteHelper.h"
#include "AE_Effect.h"
#include "AE_EffectCB.h"
#include "AE_EffectCBSuites.h"
#include "AE_Macros.h"
#include "AE_PluginData.h"
#include "Param_Utils.h"
#include "Smart_Utils.h"        // UnionLRect
#include "String_Utils.h"

#include <string.h>


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
 *  GPU flags are deliberately omitted at M0.
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
 *  SMART_PRE_RENDER — checkout input, declare needed region.
 *  At M0 we request exactly the output region (no buffer expansion);
 *  Task 10/12 will expand by the max blur radius across passes.
 * ================================================================== */
static PF_Err
PreRender(PF_InData* in_data, PF_OutData* out_data, PF_PreRenderExtra* extraP)
{
    PF_Err            err = PF_Err_NONE;
    PF_CheckoutResult in_result;
    PF_RenderRequest  req = extraP->input->output_request;

    ERR(extraP->cb->checkout_layer(in_data->effect_ref,
                                   DG_INPUT,
                                   DG_INPUT,
                                   &req,
                                   in_data->current_time,
                                   in_data->time_step,
                                   in_data->time_scale,
                                   &in_result));

    if (!err) {
        UnionLRect(&in_result.result_rect,     &extraP->output->result_rect);
        UnionLRect(&in_result.max_result_rect, &extraP->output->max_result_rect);
    }
    return err;
}


/* ================================================================== *
 *  Passthrough copy: input world -> output world.
 *  Copies the overlapping region row by row, byte for byte, so it is
 *  pixel-format agnostic (8/16/32-bit deep color all just work).
 * ================================================================== */
static PF_Err
CopyInputToOutput(PF_InData* in_data, PF_OutData* out_data,
                  PF_EffectWorld* input_worldP, PF_EffectWorld* output_worldP)
{
    PF_Err err = PF_Err_NONE;

    if (!input_worldP || !output_worldP) {
        return PF_Err_BAD_CALLBACK_PARAM;
    }

    const A_long copy_h = MIN(input_worldP->height, output_worldP->height);
    const A_long copy_w_bytes = MIN(input_worldP->rowbytes, output_worldP->rowbytes);

    const char* srcRow = reinterpret_cast<const char*>(input_worldP->data);
    char*       dstRow = reinterpret_cast<char*>(output_worldP->data);

    for (A_long y = 0; y < copy_h; ++y) {
        memcpy(dstRow, srcRow, static_cast<size_t>(copy_w_bytes));
        srcRow += input_worldP->rowbytes;
        dstRow += output_worldP->rowbytes;
    }

    return err;
}


/* ================================================================== *
 *  SMART_RENDER — passthrough. Checkout in/out worlds, copy, check in.
 * ================================================================== */
static PF_Err
SmartRender(PF_InData* in_data, PF_OutData* out_data, PF_SmartRenderExtra* extraP)
{
    PF_Err err  = PF_Err_NONE;
    PF_Err err2 = PF_Err_NONE;

    PF_EffectWorld* input_worldP  = NULL;
    PF_EffectWorld* output_worldP = NULL;

    ERR(extraP->cb->checkout_layer_pixels(in_data->effect_ref, DG_INPUT, &input_worldP));
    ERR(extraP->cb->checkout_output(in_data->effect_ref, &output_worldP));

    if (!err) {
        ERR(CopyInputToOutput(in_data, out_data, input_worldP, output_worldP));
    }

    err2 = extraP->cb->checkin_layer_pixels(in_data->effect_ref, DG_INPUT);
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
    }
    return err;
}

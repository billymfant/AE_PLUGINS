/*
 *  DeepGlowGPU.cpp
 *  Native After Effects entry point for Deep Glow (C++ / CUDA).
 *
 *  This is a Smart FX (PF_OutFlag2_SUPPORTS_SMART_RENDER) effect that also
 *  advertises GPU support (PF_OutFlag2_SUPPORTS_GPU_RENDER_F32). AE calls:
 *
 *      GLOBAL_SETUP        -> advertise flags, version
 *      PARAMS_SETUP        -> add UI params (mirrors jsx/glow.jsx)
 *      GPU_DEVICE_SETUP    -> per-device init (load CUDA module/stream)
 *      SMART_PRE_RENDER    -> checkout input, declare needed region
 *      SMART_RENDER        -> CPU fallback (Adobe-required)
 *      SMART_RENDER_GPU    -> the real path: orchestrate CUDA passes
 *      GPU_DEVICE_SETDOWN  -> per-device teardown
 *
 *  STATUS: scaffold. Compiles once the AE SDK headers + CUDA are on the
 *  include path (see README). Sections needing SDK-version verification are
 *  marked  // VERIFY .  The CPU path is real (simplified); the GPU path
 *  orchestration is wired to the launchers in DeepGlowGPU.cu.
 */

#include "AEConfig.h"
#include "AE_Effect.h"
#include "AE_EffectCB.h"
#include "AE_Macros.h"
#include "Param_Utils.h"
#include "AE_EffectCBSuites.h"
#include "AE_EffectSuites.h"
#include "AE_EffectGPUSuites.h"     // PF_GPUDeviceSuite1, world suites  // VERIFY
#include "String_Utils.h"

#include "DeepGlowGPU.h"
#include <cuda_runtime.h>
#include <math.h>

/* ---- launchers implemented in DeepGlowGPU.cu ---------------------- */
extern "C" {
    void DG_LaunchThreshold(const float4*, float4*, const GlowParams*, cudaStream_t);
    void DG_LaunchBlur     (const float4*, float4*, const GlowParams*, int, int, float, cudaStream_t);
    void DG_LaunchComposite(const float4*, const float4*, float4*, const GlowParams*, float, cudaStream_t);
}

/* ================================================================== *
 *  GLOBAL_SETUP — advertise capabilities
 * ================================================================== */
static PF_Err GlobalSetup(PF_InData* in_data, PF_OutData* out_data,
                          PF_ParamDef* params[], PF_LayerDef* output)
{
    out_data->my_version = PF_VERSION(DG_MAJOR_VERSION, DG_MINOR_VERSION,
                                      DG_BUG_VERSION, DG_STAGE_VERSION, DG_BUILD_VERSION);

    out_data->out_flags  = PF_OutFlag_DEEP_COLOR_AWARE |
                           PF_OutFlag_PIX_INDEPENDENT |
                           PF_OutFlag_I_EXPAND_BUFFER;          // glow grows the frame

    out_data->out_flags2 = PF_OutFlag2_SUPPORTS_SMART_RENDER |
                           PF_OutFlag2_FLOAT_COLOR_AWARE |
                           PF_OutFlag2_SUPPORTS_GPU_RENDER_F32; // 32-bit float GPU  // VERIFY
    return PF_Err_NONE;
}

/* ================================================================== *
 *  PARAMS_SETUP — UI (order must match the DG_* enum)
 * ================================================================== */
static PF_Err ParamsSetup(PF_InData* in_data, PF_OutData* out_data,
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

    out_data->num_params = DG_NUM_PARAMS;
    return err;
}

/* ------------------------------------------------------------------ *
 *  Fill a GlowParams from the checked-out AE params (normalized units).
 * ------------------------------------------------------------------ */
static void ReadParams(PF_ParamDef* params[], GlowParams* g)
{
    g->intensity     = params[DG_INTENSITY]->u.fs_d.value / 100.0f;
    g->radius        = (float)params[DG_RADIUS]->u.fs_d.value;
    g->threshold     = params[DG_THRESHOLD]->u.fs_d.value / 255.0f;
    g->thresholdSoft = params[DG_THRESHOLD_SOFT]->u.fs_d.value / 100.0f;
    g->sourceGain    = params[DG_SOURCE_GAIN]->u.fs_d.value / 100.0f;

    g->glowR = params[DG_GLOW_COLOR]->u.cd.value.red   / 255.0f;
    g->glowG = params[DG_GLOW_COLOR]->u.cd.value.green / 255.0f;
    g->glowB = params[DG_GLOW_COLOR]->u.cd.value.blue  / 255.0f;

    g->colorize    = params[DG_COLORIZE]->u.bd.value;
    g->saturation  = (float)(params[DG_SATURATION]->u.fs_d.value / 100.0);
    g->hueShift    = (float)(params[DG_HUE_SHIFT]->u.fs_d.value * 3.14159265358979 / 180.0);
    g->passes      = params[DG_PASSES]->u.sd.value;
    g->falloff     = params[DG_FALLOFF]->u.pd.value;
    g->blendOp     = params[DG_BLEND_OP]->u.pd.value;
    g->dimensions  = params[DG_DIMENSIONS]->u.pd.value;
    g->glowOnly    = params[DG_GLOW_ONLY]->u.bd.value;
}

/* ================================================================== *
 *  GPU RENDER — the real path. Orchestrates the CUDA passes.
 *  AE hands us device pointers (already on the GPU) for src/dst.
 * ================================================================== */
static PF_Err SmartRenderGPU(PF_InData* in_data, PF_OutData* out_data,
                             void* extraP)  // PF_GPUDeviceSuite world  // VERIFY
{
    PF_Err err = PF_Err_NONE;

    // VERIFY: pull src/dst float4* device ptrs + dims/pitch from the GPU
    //         suite (PF_SmartRenderExtra / PF_GPUDeviceSuite1). Pseudocode:
    //   float4* d_src = ...; float4* d_dst = ...;
    //   GlowParams g; ReadParams(params, &g); g.width=..; g.height=..; ...
    //   cudaStream_t stream = (cudaStream_t)device_info.command_queuePV;
    //
    // Scratch buffers (ping/pong + accumulate) allocated once per device:
    //   float4* d_extract; float4* d_blurTmp; float4* d_accum;
    //
    // Orchestration (host loop over passes, kernels run on device):
    //   cudaMemsetAsync(d_accum, 0, bytes, stream);
    //   for (int pass = 0; pass < g.passes; ++pass) {
    //       float w = DG_PassScale(pass, g.passes, g.falloff);
    //       float r = g.radius * DG_PassRadiusFactor(pass);
    //       DG_LaunchThreshold(d_src, d_extract, &g, stream);
    //       int hx = (g.dimensions != DG_DIM_VERTICAL)   ? 1 : 0;
    //       int vy = (g.dimensions != DG_DIM_HORIZONTAL) ? 1 : 0;
    //       if (hx) DG_LaunchBlur(d_extract, d_blurTmp, &g, 1, 0, r, stream);
    //       if (vy) DG_LaunchBlur(hx ? d_blurTmp : d_extract, d_extract, &g, 0, 1, r, stream);
    //       DG_LaunchComposite(d_accum, d_extract, d_accum, &g, w, stream);  // accumulate
    //   }
    //   // final composite of accum over source -> d_dst
    //
    // The exact AE GPU-suite plumbing (world->device-ptr, pitch, stream) is
    // SDK-version specific; the ProcAmp GPU sample in the AE SDK is the
    // reference. Left as VERIFY until the SDK is on this machine.

    return err;
}

/* ================================================================== *
 *  CPU RENDER — Adobe-required fallback. Real (simplified) glow so the
 *  plugin produces output even before the GPU path is finalized.
 *  NOTE: operates on the checked-out input world; full Smart-render
 *  checkout/checkin plumbing marked VERIFY.
 * ================================================================== */
static PF_Err SmartRenderCPU(PF_InData* in_data, PF_OutData* out_data,
                             PF_ParamDef* params[], PF_LayerDef* output)
{
    PF_Err err = PF_Err_NONE;
    // VERIFY: checkout input via PF_Checkout_Layer / SmartRender extra,
    //         iterate float pixels, run the same threshold->separable-blur->
    //         composite math as the .cu kernels on the CPU. Mirror the device
    //         math in DeepGlowGPU.cu exactly so CPU/GPU output matches.
    return err;
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
            case PF_Cmd_GLOBAL_SETUP:
                err = GlobalSetup(in_data, out_data, params, output); break;
            case PF_Cmd_PARAMS_SETUP:
                err = ParamsSetup(in_data, out_data, params, output); break;
            case PF_Cmd_GPU_DEVICE_SETUP:
                /* VERIFY: load CUDA module, create stream, alloc scratch */ break;
            case PF_Cmd_GPU_DEVICE_SETDOWN:
                /* VERIFY: free scratch, destroy stream */ break;
            case PF_Cmd_SMART_PRE_RENDER:
                /* VERIFY: checkout input, set result/max_result rects
                   expanded by max blur radius across passes */ break;
            case PF_Cmd_SMART_RENDER:
                err = SmartRenderCPU(in_data, out_data, params, output); break;
            case PF_Cmd_SMART_RENDER_GPU:
                err = SmartRenderGPU(in_data, out_data, extra); break;
            default: break;
        }
    } catch (PF_Err& thrown) {
        err = thrown;
    }
    return err;
}

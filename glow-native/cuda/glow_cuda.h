/*
 *  glow_cuda.h
 *  CUDA host entry for the pyramid bloom engine.
 *
 *  This mirrors glow-native/core/glow_core.cpp EXACTLY (same algorithm, weights,
 *  sampling convention and units). The CPU engine in core/ is authoritative; the
 *  CUDA kernels must reproduce its output within a small epsilon (AC4 parity).
 *
 *  The host entry owns all device allocation/free, runs the full mip-pyramid on
 *  the GPU, and copies the result back to the caller-provided host buffer.
 */
#pragma once

#include "glow_params.h"   // glow::Params (POD, device-usable)

#ifdef __cplusplus
extern "C" {
#endif

/*
 *  Run the full pyramid bloom on the GPU.
 *    rgbaIn  : host pointer, w*h*4 interleaved float RGBA (row-major, linear or
 *              sRGB exactly as the CPU engine expects — same units).
 *    rgbaOut : host pointer, w*h*4 floats; receives the composited result.
 *    w,h     : image dimensions in pixels.
 *    p       : the SAME glow::Params handed to glow::bloom on the CPU.
 *
 *  Returns 0 on success, nonzero on any CUDA error (output left untouched on
 *  early failure). All device buffers are freed before return.
 */
int glow_bloom_cuda(const float* rgbaIn, float* rgbaOut, int w, int h, const glow::Params& p);

/*
 *  GPU render-path entry for the AE plugin (PF_Cmd_SMART_RENDER_GPU).
 *
 *  Operates on DEVICE pointers handed to us by AE's GPU world suite. AE GPU
 *  worlds are float4 in B,G,R,A channel order with a row pitch (in float4
 *  elements, i.e. rowbytes/16). With PF_OutFlag_I_EXPAND_BUFFER the OUTPUT
 *  world may be LARGER than the input; the input sits at offset (offX,offY)
 *  inside the output. This routine:
 *    - allocates an OUTPUT-sized contiguous RGBA device canvas, memset 0,
 *    - unpacks the pitched BGRA input into that canvas at (offX,offY),
 *    - runs the SAME pyramid bloom as glow_bloom_cuda (identical kernels/math)
 *      at outW x outH,
 *    - writes the RGBA result back out as BGRA into the pitched output buffer
 *      (outW x outH).
 *
 *  src/dst are device pointers (already in the active CUDA context). srcPitch/
 *  dstPitch are in float4 elements. inW/inH are the input world dims; outW/outH
 *  the output (expanded) world dims; offX/offY = in_data->output_origin_{x,y}.
 *  Returns 0 on success, nonzero on CUDA error. Synchronizes internally so
 *  results are valid on return (mirrors the SDK sample).
 */
int glow_bloom_cuda_gpu(const float* srcBGRA, float* dstBGRA,
                        int srcPitch, int dstPitch,
                        int inW, int inH, int outW, int outH,
                        int offX, int offY, const glow::Params& p);

#ifdef __cplusplus
} // extern "C"
#endif

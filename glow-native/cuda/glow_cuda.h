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

#ifdef __cplusplus
} // extern "C"
#endif

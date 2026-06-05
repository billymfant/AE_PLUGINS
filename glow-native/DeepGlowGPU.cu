/*
 *  DeepGlowGPU.cu
 *  CUDA kernels for the native Deep Glow pipeline.
 *
 *  Pipeline (per glow pass, then accumulated):
 *      1. Threshold / extract bright pixels  (with soft knee)
 *      2. Separable Gaussian blur            (horizontal then vertical)
 *         - anamorphic: H-only or V-only when DG_DIM_HORIZONTAL/VERTICAL
 *      3. Tint + saturation/hue (optional)
 *      4. Composite over source              (Add or Screen), scaled by pass weight
 *
 *  Pixels are 32-bit float RGBA, premultiplied-agnostic here (AE hands us the
 *  format negotiated in GPU_DEVICE_SETUP). All launchers are extern "C" so the
 *  host (DeepGlowGPU.cpp) can call them without C++ name mangling.
 *
 *  Build: compiled by nvcc to a .ptx/.fatbin or static-linked. Target sm_89
 *  (RTX 4080). See README for the nvcc flags.
 */

#include <cuda_runtime.h>
#include "DeepGlowGPU.h"

/* float4 helpers ---------------------------------------------------- */
__device__ __forceinline__ float  dg_luma(float4 c) {
    /* Rec.709 luma */
    return 0.2126f * c.x + 0.7152f * c.y + 0.0722f * c.z;
}
__device__ __forceinline__ float  dg_clampf(float v, float lo, float hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

/* ------------------------------------------------------------------ *
 *  1. Threshold / extract
 *     Keeps pixels whose luma exceeds `threshold`, with a soft knee of
 *     width `thresholdSoft` below it. Output is pre-multiplied by a
 *     smooth mask so the blur has clean energy to spread.
 * ------------------------------------------------------------------ */
__global__ void dg_threshold_kernel(const float4* src, float4* dst, GlowParams p)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= p.width || y >= p.height) return;

    float4 c = src[y * p.srcPitch + x];
    float  l = dg_luma(c);

    float lo = p.threshold - p.thresholdSoft;
    float hi = p.threshold;
    /* smoothstep knee */
    float t;
    if (l <= lo)      t = 0.0f;
    else if (l >= hi) t = 1.0f;
    else {
        float u = (l - lo) / (hi - lo + 1e-6f);
        t = u * u * (3.0f - 2.0f * u);
    }

    float4 o;
    o.x = c.x * t * p.sourceGain;
    o.y = c.y * t * p.sourceGain;
    o.z = c.z * t * p.sourceGain;
    o.w = t;
    dst[y * p.dstPitch + x] = o;
}

/* ------------------------------------------------------------------ *
 *  2. Separable Gaussian blur.
 *     Two passes (H, then V). `radius` in px maps to sigma = radius/3.
 *     We build the weight inline (no constant-mem table) for clarity in
 *     this scaffold; a production build should precompute weights.
 * ------------------------------------------------------------------ */
__device__ __forceinline__ float dg_gauss(float i, float sigma) {
    float s2 = 2.0f * sigma * sigma;
    return expf(-(i * i) / s2);
}

__global__ void dg_blur_kernel(const float4* src, float4* dst, GlowParams p,
                               int dirX, int dirY, float radiusPx)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= p.width || y >= p.height) return;

    int   R     = (int)ceilf(radiusPx);
    if (R < 1) { dst[y * p.dstPitch + x] = src[y * p.srcPitch + x]; return; }
    float sigma = radiusPx / 3.0f;

    float4 acc = make_float4(0, 0, 0, 0);
    float  wsum = 0.0f;
    for (int i = -R; i <= R; ++i) {
        int sx = x + dirX * i;
        int sy = y + dirY * i;
        /* clamp-to-edge sampling */
        sx = sx < 0 ? 0 : (sx >= p.width  ? p.width  - 1 : sx);
        sy = sy < 0 ? 0 : (sy >= p.height ? p.height - 1 : sy);
        float w = dg_gauss((float)i, sigma);
        float4 c = src[sy * p.srcPitch + sx];
        acc.x += c.x * w; acc.y += c.y * w; acc.z += c.z * w; acc.w += c.w * w;
        wsum  += w;
    }
    float inv = wsum > 0.0f ? 1.0f / wsum : 0.0f;
    acc.x *= inv; acc.y *= inv; acc.z *= inv; acc.w *= inv;
    dst[y * p.dstPitch + x] = acc;
}

/* ------------------------------------------------------------------ *
 *  3 + 4. Tint/saturate the glow and composite over the source.
 *         `passWeight` is DG_PassScale() computed host-side per pass.
 * ------------------------------------------------------------------ */
__device__ __forceinline__ float4 dg_apply_tint(float4 g, const GlowParams& p)
{
    if (p.colorize) {
        /* replace chroma with tint, keep luminance energy */
        float l = dg_luma(g);
        g.x = l * p.glowR; g.y = l * p.glowG; g.z = l * p.glowB;
    } else {
        g.x *= p.glowR; g.y *= p.glowG; g.z *= p.glowB;
    }
    /* saturation around luma */
    if (p.saturation != 0.0f) {
        float l = dg_luma(g);
        g.x = l + (g.x - l) * (1.0f + p.saturation);
        g.y = l + (g.y - l) * (1.0f + p.saturation);
        g.z = l + (g.z - l) * (1.0f + p.saturation);
    }
    return g;
}

__global__ void dg_composite_kernel(const float4* src, const float4* glow,
                                     float4* dst, GlowParams p, float passWeight)
{
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x >= p.width || y >= p.height) return;

    float4 s = src[y * p.srcPitch + x];
    float4 g = glow[y * p.dstPitch + x];
    g = dg_apply_tint(g, p);

    float w = passWeight * p.intensity;
    g.x *= w; g.y *= w; g.z *= w;

    float4 o;
    if (p.glowOnly) {
        o = g; o.w = dg_clampf(g.w * w, 0.0f, 1.0f);
        dst[y * p.dstPitch + x] = o;
        return;
    }

    if (p.blendOp == DG_BLEND_SCREEN) {
        o.x = 1.0f - (1.0f - s.x) * (1.0f - dg_clampf(g.x, 0.0f, 1.0f));
        o.y = 1.0f - (1.0f - s.y) * (1.0f - dg_clampf(g.y, 0.0f, 1.0f));
        o.z = 1.0f - (1.0f - s.z) * (1.0f - dg_clampf(g.z, 0.0f, 1.0f));
    } else { /* Add */
        o.x = s.x + g.x; o.y = s.y + g.y; o.z = s.z + g.z;
    }
    o.w = s.w;
    dst[y * p.dstPitch + x] = o;
}

/* ================================================================== *
 *  extern "C" launchers — called from DeepGlowGPU.cpp
 *  (host owns device-buffer allocation; these just configure + launch)
 * ================================================================== */
extern "C" {

static dim3 dg_grid(int w, int h, dim3 block) {
    return dim3((w + block.x - 1) / block.x, (h + block.y - 1) / block.y);
}

void DG_LaunchThreshold(const float4* src, float4* dst, const GlowParams* p,
                        cudaStream_t stream) {
    dim3 block(16, 16);
    dg_threshold_kernel<<<dg_grid(p->width, p->height, block), block, 0, stream>>>(src, dst, *p);
}

void DG_LaunchBlur(const float4* src, float4* dst, const GlowParams* p,
                   int dirX, int dirY, float radiusPx, cudaStream_t stream) {
    dim3 block(16, 16);
    dg_blur_kernel<<<dg_grid(p->width, p->height, block), block, 0, stream>>>(
        src, dst, *p, dirX, dirY, radiusPx);
}

void DG_LaunchComposite(const float4* src, const float4* glow, float4* dst,
                        const GlowParams* p, float passWeight, cudaStream_t stream) {
    dim3 block(16, 16);
    dg_composite_kernel<<<dg_grid(p->width, p->height, block), block, 0, stream>>>(
        src, glow, dst, *p, passWeight);
}

} /* extern "C" */

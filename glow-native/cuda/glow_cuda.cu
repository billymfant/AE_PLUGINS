/*
 *  glow_cuda.cu
 *  CUDA mirror of glow-native/core/glow_core.cpp (pyramid bloom).
 *
 *  EVERY op here reproduces the CPU engine exactly: same Rec.709 luma, same
 *  smoothstep knee, same bilinear convention (fx = u - 0.5, floor, clamp-to-edge,
 *  2x2 lerp), the 13-tap Jimenez/CoD downsample, the 9-tap tent upsample with
 *  anamorphic squash, and the tint/intensity/tonemap/composite with the
 *  alpha-over output. The host below drives the SAME pyramid loop as glow::bloom
 *  (downsampleHalf of bright, repeat up to `levels`, stop when <2px, then
 *  upsampleAdd each level with levelWeight()).
 *
 *  glow::Params is POD (scalar/int/bool only) so it is passed to kernels by value.
 */

#include <cuda_runtime.h>
#include <cmath>
#include <cstdio>
#include "glow_cuda.h"
#include "glow_core.h"   // glow::Image not used on device; Params + helpers from glow_params.h

using glow::Params;

/* ------------------------------------------------------------------ *
 *  A tiny device-side image descriptor (pointer + dims). RGBA interleaved.
 * ------------------------------------------------------------------ */
struct DImg { float* p; int w; int h; };

/* ------------------------------------------------------------------ *
 *  Device helpers — bit-for-bit mirrors of the CPU inline functions.
 * ------------------------------------------------------------------ */
__device__ __forceinline__ float d_luma(float r, float g, float b) {
    return 0.2126f*r + 0.7152f*g + 0.0722f*b;
}
__device__ __forceinline__ int d_clampi(int v, int lo, int hi){ return v<lo?lo:(v>hi?hi:v); }
__device__ __forceinline__ float d_clampf(float v, float lo, float hi){ return v<lo?lo:(v>hi?hi:v); }

__device__ __forceinline__ float d_smoothstep(float e0, float e1, float x){
    float t = (x - e0) / (e1 - e0 + 1e-6f);
    t = t<0?0:(t>1?1:t);
    return t*t*(3.0f - 2.0f*t);
}

/* sampleBilinear: u,v in pixel space, fx=u-0.5, floor, clamp-to-edge, 2x2 lerp.
   Reads 4 channels from src into out[4]. */
__device__ __forceinline__ void d_sampleBilinear(const float* s, int sw, int sh,
                                                 float u, float v, float out[4]) {
    if (sw<=0 || sh<=0){ out[0]=out[1]=out[2]=out[3]=0; return; }
    float fx = u - 0.5f, fy = v - 0.5f;
    int x0 = (int)floorf(fx), y0 = (int)floorf(fy);
    float tx = fx - x0, ty = fy - y0;
    int x1=x0+1, y1=y0+1;
    x0=d_clampi(x0,0,sw-1); x1=d_clampi(x1,0,sw-1);
    y0=d_clampi(y0,0,sh-1); y1=d_clampi(y1,0,sh-1);
    const float* p00=&s[(size_t(y0)*sw+x0)*4];
    const float* p10=&s[(size_t(y0)*sw+x1)*4];
    const float* p01=&s[(size_t(y1)*sw+x0)*4];
    const float* p11=&s[(size_t(y1)*sw+x1)*4];
    #pragma unroll
    for (int c=0;c<4;++c){
        float a = p00[c]*(1-tx)+p10[c]*tx;
        float b = p01[c]*(1-tx)+p11[c]*tx;
        out[c]  = a*(1-ty)+b*ty;
    }
}

__device__ __forceinline__ float d_srgb_to_lin(float c){
    return c<=0.04045f ? c/12.92f : powf((c+0.055f)/1.055f, 2.4f);
}
__device__ __forceinline__ float d_lin_to_srgb(float c){
    return c<=0.0031308f ? c*12.92f : 1.055f*powf(c, 1.0f/2.4f)-0.055f;
}

/* ------------------------------------------------------------------ *
 *  Kernels
 * ------------------------------------------------------------------ */

/* optional sRGB->linear, in place over RGB channels (alpha untouched). */
__global__ void k_srgb_to_lin(float* px, int w, int h){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    px[i  ] = d_srgb_to_lin(px[i  ]);
    px[i+1] = d_srgb_to_lin(px[i+1]);
    px[i+2] = d_srgb_to_lin(px[i+2]);
}

/* extractBright: luma, smoothstep knee (hard compare if lo>=hi), *sourceGain. */
__global__ void k_extractBright(const float* src, float* dst, int w, int h, Params p){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    float lo = p.threshold - p.thresholdSoft;
    float hi = p.threshold;
    float l = d_luma(src[i], src[i+1], src[i+2]);
    float m = (lo >= hi) ? (l >= hi ? 1.f : 0.f) : d_smoothstep(lo, hi, l);
    dst[i  ] = src[i  ]*m*p.sourceGain;
    dst[i+1] = src[i+1]*m*p.sourceGain;
    dst[i+2] = src[i+2]*m*p.sourceGain;
    dst[i+3] = m;
}

/* downsampleHalf: dest (dw,dh); sample source at center (x+.5)*2 with 13 taps. */
__global__ void k_downsampleHalf(const float* src, int sw, int sh,
                                 float* dst, int dw, int dh){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=dw || y>=dh) return;
    float cx = (x+0.5f)*2.0f, cy = (y+0.5f)*2.0f;
    const float o = 1.0f;
    // 13-tap weights (Jimenez/CoD), order identical to core.
    const float dxs[13]={-2,0,2, -1,1, -2,0,2, -1,1, -2,0,2};
    const float dys[13]={-2,-2,-2, -1,-1, 0,0,0, 1,1, 2,2,2};
    const float ws [13]={0.03125f,0.0625f,0.03125f, 0.125f,0.125f,
                         0.0625f,0.125f,0.0625f, 0.125f,0.125f,
                         0.03125f,0.0625f,0.03125f};
    float acc[4]={0,0,0,0}; float wsum=0; float t[4];
    #pragma unroll
    for (int k=0;k<13;++k){
        d_sampleBilinear(src, sw, sh, cx+dxs[k]*o, cy+dys[k]*o, t);
        acc[0]+=t[0]*ws[k]; acc[1]+=t[1]*ws[k]; acc[2]+=t[2]*ws[k]; acc[3]+=t[3]*ws[k];
        wsum+=ws[k];
    }
    float inv = wsum>0 ? 1.0f/wsum : 0.0f;
    size_t di = (size_t(y)*dw + x)*4;
    dst[di  ]=acc[0]*inv; dst[di+1]=acc[1]*inv; dst[di+2]=acc[2]*inv; dst[di+3]=acc[3]*inv;
}

/* upsampleAdd: hi += weight * 9-tap tent of low, anamorphic squash. */
__global__ void k_upsampleAdd(const float* low, int lw, int lh,
                              float* hi, int hw, int hh,
                              float weight, int dimensions){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=hw || y>=hh) return;
    float sx = (dimensions==glow::DIM_VERTICAL)   ? 0.0f : 1.0f;
    float sy = (dimensions==glow::DIM_HORIZONTAL) ? 0.0f : 1.0f;
    float lx = (x+0.5f) * (float)lw / (float)hw;
    float ly = (y+0.5f) * (float)lh / (float)hh;
    const float c=4.f/16, e=2.f/16, k=1.f/16;
    const float dxs[9]={-1,0,1, -1,0,1, -1,0,1};
    const float dys[9]={-1,-1,-1, 0,0,0, 1,1,1};
    const float ws [9]={k,e,k, e,c,e, k,e,k};
    float acc[4]={0,0,0,0}, t[4];
    #pragma unroll
    for (int i=0;i<9;++i){
        d_sampleBilinear(low, lw, lh, lx+dxs[i]*sx, ly+dys[i]*sy, t);
        acc[0]+=t[0]*ws[i]; acc[1]+=t[1]*ws[i]; acc[2]+=t[2]*ws[i]; acc[3]+=t[3]*ws[i];
    }
    size_t hi_i = (size_t(y)*hw + x)*4;
    hi[hi_i  ]+=acc[0]*weight; hi[hi_i+1]+=acc[1]*weight;
    hi[hi_i+2]+=acc[2]*weight; hi[hi_i+3]+=acc[3]*weight;
}

__device__ __forceinline__ void d_applyTint(float& r,float& g,float& b,const Params& p){
    if (p.colorize){ float l=d_luma(r,g,b); r=l*p.glowR; g=l*p.glowG; b=l*p.glowB; }
    else           { r*=p.glowR; g*=p.glowG; b*=p.glowB; }
    if (p.saturation!=0.f){ float l=d_luma(r,g,b);
        r=l+(r-l)*(1.f+p.saturation); g=l+(g-l)*(1.f+p.saturation); b=l+(b-l)*(1.f+p.saturation); }
}
__device__ __forceinline__ float d_tonemap1(float x,const Params& p){
    if (p.tonemap==glow::TONE_NONE) return x;
    if (p.tonemap==glow::TONE_SOFTCLIP){ float k=0.2f+1.8f*(1.f-p.highlightComp); return x/(x+k)*(1.f+k); }
    float w=4.0f; return (x*(1.f+x/(w*w)))/(1.f+x);
}

/* final composite: tint/intensity/tonemap, blend over `lin`, alpha-over.
   Writes into `out`. `lin` is the (optionally linearized) source; `glow` is the
   accumulated upsample buffer. */
__global__ void k_composite(const float* lin, const float* glow, float* out,
                            int w, int h, Params p){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    float gr=glow[i], gg=glow[i+1], gb=glow[i+2];
    d_applyTint(gr,gg,gb,p);
    gr*=p.intensity; gg*=p.intensity; gb*=p.intensity;
    gr=d_tonemap1(gr,p); gg=d_tonemap1(gg,p); gb=d_tonemap1(gb,p);
    float sr=lin[i], sg=lin[i+1], sb=lin[i+2], sa=lin[i+3];
    float r,g,b;
    if (p.glowOnly){ r=gr; g=gg; b=gb; }
    else if (p.blendOp==glow::BLEND_SCREEN){
        r=1.f-(1.f-sr)*(1.f-d_clampf(gr,0,1));
        g=1.f-(1.f-sg)*(1.f-d_clampf(gg,0,1));
        b=1.f-(1.f-sb)*(1.f-d_clampf(gb,0,1));
    } else { r=sr+gr; g=sg+gg; b=sb+gb; }
    float gA = d_clampf(glow[i+3], 0.f, 1.f);
    out[i  ]=r; out[i+1]=g; out[i+2]=b;
    out[i+3]= p.glowOnly ? gA : d_clampf(sa + gA*(1.f - sa), 0.f, 1.f);
}

/* optional linear->sRGB, in place over RGB (alpha untouched). */
__global__ void k_lin_to_srgb(float* px, int w, int h){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    px[i  ] = d_lin_to_srgb(px[i  ]);
    px[i+1] = d_lin_to_srgb(px[i+1]);
    px[i+2] = d_lin_to_srgb(px[i+2]);
}

/* ------------------------------------------------------------------ *
 *  Host helpers
 * ------------------------------------------------------------------ */
static dim3 grid2d(int w, int h, dim3 block){
    return dim3((w + block.x - 1)/block.x, (h + block.y - 1)/block.y);
}

#define CU_TRY(call) do{ cudaError_t _e=(call); if(_e!=cudaSuccess){ \
    fprintf(stderr,"CUDA error %s at %s:%d: %s\n", #call, __FILE__, __LINE__, \
            cudaGetErrorString(_e)); goto fail; } }while(0)

/* A device buffer with dims, tracked for cleanup. */
struct DevBuf { float* p=nullptr; int w=0; int h=0; };

extern "C" int glow_bloom_cuda(const float* rgbaIn, float* rgbaOut,
                               int w, int h, const Params& p){
    if (w<=0 || h<=0 || !rgbaIn || !rgbaOut) return 1;

    const dim3 block(16,16);
    cudaError_t err = cudaSuccess;

    // Up to 10 mip levels (autoLevels caps at 10).
    const int MAX_MIPS = 16;
    DevBuf mips[MAX_MIPS];
    int nmips = 0;

    float* dLin   = nullptr;  // (optionally linearized) source
    float* dBright= nullptr;  // extractBright output (full res)
    float* dGlow  = nullptr;  // accumulated upsample (full res, zeroed)
    float* dOut   = nullptr;  // composited output (full res)

    size_t full = (size_t)w*h*4*sizeof(float);

    CU_TRY(cudaMalloc(&dLin,   full));
    CU_TRY(cudaMalloc(&dBright,full));
    CU_TRY(cudaMalloc(&dGlow,  full));
    CU_TRY(cudaMalloc(&dOut,   full));

    CU_TRY(cudaMemcpy(dLin, rgbaIn, full, cudaMemcpyHostToDevice));
    CU_TRY(cudaMemset(dGlow, 0, full));

    {
        dim3 g = grid2d(w,h,block);

        // 0. optional linearize (in place on dLin)
        if (p.linearLight){
            k_srgb_to_lin<<<g,block>>>(dLin, w, h);
            CU_TRY(cudaGetLastError());
        }

        // 1. extract bright
        k_extractBright<<<g,block>>>(dLin, dBright, w, h, p);
        CU_TRY(cudaGetLastError());

        // 2. build mip chain (mirror glow::bloom)
        int minDim = w<h?w:h;
        int levels = p.levels>0 ? p.levels : glow::autoLevels(p.radius, minDim);

        // mips[0] = downsampleHalf(bright)
        {
            int dw=(w+1)/2, dh=(h+1)/2;
            CU_TRY(cudaMalloc(&mips[0].p, (size_t)dw*dh*4*sizeof(float)));
            mips[0].w=dw; mips[0].h=dh; nmips=1;
            k_downsampleHalf<<<grid2d(dw,dh,block),block>>>(dBright, w, h, mips[0].p, dw, dh);
            CU_TRY(cudaGetLastError());
        }
        for (int l=1;l<levels && nmips<MAX_MIPS;++l){
            DevBuf& prev = mips[nmips-1];
            if (prev.w<2 || prev.h<2) break;
            int dw=(prev.w+1)/2, dh=(prev.h+1)/2;
            CU_TRY(cudaMalloc(&mips[nmips].p, (size_t)dw*dh*4*sizeof(float)));
            mips[nmips].w=dw; mips[nmips].h=dh;
            k_downsampleHalf<<<grid2d(dw,dh,block),block>>>(prev.p, prev.w, prev.h,
                                                            mips[nmips].p, dw, dh);
            CU_TRY(cudaGetLastError());
            ++nmips;
        }

        // 3. accumulate upsample at full res, weighted by level falloff
        for (int l=0;l<nmips;++l){
            float wgt = glow::levelWeight(l, nmips, p.falloff);
            k_upsampleAdd<<<g,block>>>(mips[l].p, mips[l].w, mips[l].h,
                                       dGlow, w, h, wgt, p.dimensions);
            CU_TRY(cudaGetLastError());
        }

        // 4. composite
        k_composite<<<g,block>>>(dLin, dGlow, dOut, w, h, p);
        CU_TRY(cudaGetLastError());

        // 5. optional de-linearize
        if (p.linearLight){
            k_lin_to_srgb<<<g,block>>>(dOut, w, h);
            CU_TRY(cudaGetLastError());
        }

        CU_TRY(cudaDeviceSynchronize());
        CU_TRY(cudaMemcpy(rgbaOut, dOut, full, cudaMemcpyDeviceToHost));
    }

    err = cudaSuccess;
fail:
    for (int i=0;i<nmips;++i) if (mips[i].p) cudaFree(mips[i].p);
    if (dLin)    cudaFree(dLin);
    if (dBright) cudaFree(dBright);
    if (dGlow)   cudaFree(dGlow);
    if (dOut)    cudaFree(dOut);
    return err==cudaSuccess ? 0 : 2;
}

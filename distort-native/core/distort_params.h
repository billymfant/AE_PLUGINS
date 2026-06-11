#pragma once
#include <cmath>

// Shared host/device marker (mirrors color's CL_HD). nvcc defines __CUDACC__.
#ifdef __CUDACC__
#define DS_HD __host__ __device__
#else
#define DS_HD
#endif

namespace distort {

enum MapType      { MAP_GRADIENT=1, MAP_RADIAL=2, MAP_WAVE=3, MAP_NOISE=4, MAP_LAYER=5 };
enum DisplaceMode { DISP_FIXED=1, DISP_ALONG_GRADIENT=2, DISP_PUSH_PULL=3 };
enum FlowDir      { FLOW_FORWARD=1, FLOW_REVERSE=2, FLOW_CENTER_OUT=3, FLOW_EDGES_IN=4 };
enum LoopMode     { LOOP_LOOP=1, LOOP_PINGPONG=2, LOOP_ONCE=3 };
enum Easing       { EASE_LINEAR=1, EASE_IN=2, EASE_OUT=3, EASE_INOUT=4, EASE_SINE=5, EASE_EXP=6 };
enum EdgeMode     { EDGE_CLAMP=1, EDGE_WRAP=2, EDGE_MIRROR=3, EDGE_TRANSPARENT=4 };

// All defaults = identity warp (amount 0 -> output == input).
struct Params {
    // map
    int   mapType     = MAP_GRADIENT;
    float angleDeg    = 0.f;
    float spacing     = 1.f;     // ramp repeats across frame (0 => uniform -1 field)
    float waveFreq    = 1.f;
    float wavePhase   = 0.f;
    float noiseScale  = 3.f;
    int   noiseDetail = 3;       // fbm octaves (>=1)
    int   noiseSeed   = 1;
    float mapContrast = 0.f;     // -1..1 steepen(+)/flatten(-) the field around 0
    int   mapChannel  = 0;       // 0=luma 1=R 2=G 3=B (MAP_LAYER source)
    // amount
    int   displaceMode= DISP_FIXED;
    float amount      = 0.f;     // pixels
    // flow
    int   flowDir     = FLOW_FORWARD;
    float flowSpeed   = 0.f;     // cycles/sec; 0 => static (flowScalar==1)
    int   loopMode    = LOOP_LOOP;
    int   easing      = EASE_LINEAR;
    float jitter      = 0.f;     // 0..1 seeded per-pixel field noise
    int   jitterSeed  = 1;
    float phase       = 0.f;     // 0..1 base phase
    // output
    int   edgeMode    = EDGE_CLAMP;
    float opacity     = 1.f;     // 0..1 blend warped over source
};

DS_HD inline float ds_clamp(float v,float lo,float hi){ return v<lo?lo:(v>hi?hi:v); }
DS_HD inline float ds_frac(float v){ return v - floorf(v); }
DS_HD inline float lumaRec709(float r,float g,float b){ return 0.2126f*r+0.7152f*g+0.0722f*b; }

// signed contrast remap: steepen (c>0) or flatten (c<0) a field in [-1,1] around 0.
DS_HD inline float ds_remap(float f,float c){
    if (c==0.f) return f;
    float s = f<0.f?-1.f:1.f, a = fabsf(f);
    float k = 1.f + (c>0.f ? c*3.f : c*0.9f);   // exponent strength
    a = powf(a, c>0.f ? 1.f/k : k);
    return s*a;
}

// easing t in [0,1] -> [0,1]
DS_HD inline float ds_ease(int mode,float t){
    t = ds_clamp(t,0.f,1.f);
    switch(mode){
        case EASE_IN:    return t*t;
        case EASE_OUT:   return 1.f-(1.f-t)*(1.f-t);
        case EASE_INOUT: return t*t*(3.f-2.f*t);
        case EASE_SINE:  return 0.5f-0.5f*cosf(3.14159265f*t);
        case EASE_EXP:   return t<=0.f?0.f:(t>=1.f?1.f:powf(2.f,10.f*(t-1.f)));
        default:         return t;
    }
}

// integer hash -> [0,1)
DS_HD inline float ds_hash(int x){
    unsigned int h = (unsigned int)x*374761393u + 668265263u;
    h = (h ^ (h>>13))*1274126177u;
    return ((h ^ (h>>16)) & 0xFFFFFFu) / float(0x1000000);
}

} // namespace distort

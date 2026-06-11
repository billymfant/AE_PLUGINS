#pragma once
#include "distort_params.h"
namespace distort {

// Time-driven modulation in [-1,1]. speed==0 -> 1 (static displacement).
DS_HD inline float flowScalar(const Params& P,float time){
    if (P.flowSpeed==0.f) return 1.f;
    float ph = P.phase + time*P.flowSpeed;          // cycles
    float t;
    if (P.loopMode==LOOP_ONCE)      t = ds_clamp(ph,0.f,1.f);
    else                            t = ds_frac(ph);
    if (P.loopMode==LOOP_PINGPONG)  t = (t<0.5f) ? t*2.f : 2.f-2.f*t;
    float e = ds_ease(P.easing, t);
    return 2.f*e - 1.f;                              // sweep -1..1
}

// Per-pixel directional weight in [-1,1]. u,v normalized centered (-1..1).
DS_HD inline float flowWeight(const Params& P,float u,float v){
    const float SQRT2=1.41421356f;
    float rr=sqrtf(u*u+v*v)/SQRT2;                   // 0..1
    switch(P.flowDir){
        case FLOW_REVERSE:    return -1.f;
        case FLOW_CENTER_OUT: return 2.f*rr-1.f;     // edges +, center -
        case FLOW_EDGES_IN:   return 1.f-2.f*rr;     // center +, edges -
        default:              return 1.f;            // forward
    }
}

// Seeded per-pixel field jitter in [-jitter,jitter].
DS_HD inline float flowJitter(const Params& P,int x,int y){
    if (P.jitter<=0.f) return 0.f;
    float r = ds_hash((x*92837111) ^ (y*689287499) ^ (P.jitterSeed*283923481));
    return (2.f*r-1.f)*P.jitter;
}

} // namespace distort

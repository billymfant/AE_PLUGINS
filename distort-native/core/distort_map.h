#pragma once
#include "distort_params.h"
namespace distort {

// --- value noise / fbm (host+device safe; no lambdas) ---
DS_HD inline float dm_h2(int a,int b,int seed){
    return ds_hash((a*73856093) ^ (b*19349663) ^ (seed*83492791));
}
DS_HD inline float dm_vnoise(float x,float y,int seed){
    int xi=(int)floorf(x), yi=(int)floorf(y);
    float xf=x-(float)xi, yf=y-(float)yi;
    float v00=dm_h2(xi,yi,seed),   v10=dm_h2(xi+1,yi,seed);
    float v01=dm_h2(xi,yi+1,seed), v11=dm_h2(xi+1,yi+1,seed);
    float u=xf*xf*(3.f-2.f*xf), w=yf*yf*(3.f-2.f*yf);
    float a=v00+(v10-v00)*u, b=v01+(v11-v01)*u;
    return a+(b-a)*w;                              // 0..1
}
DS_HD inline float dm_fbm(float x,float y,int seed,int oct){
    if (oct<1) oct=1;
    float s=0.f, amp=0.5f, f=1.f, norm=0.f;
    for(int i=0;i<oct;i++){ s+=amp*dm_vnoise(x*f,y*f,seed+i); norm+=amp; amp*=0.5f; f*=2.f; }
    return norm>0.f ? s/norm : 0.f;                // 0..1
}

// Signed displacement field in [-1,1] from the generator. u,v are normalized
// centered coords in (-1,1). MAP_LAYER is handled by the caller (needs the layer
// pixels) — this returns 0 for MAP_LAYER.
DS_HD inline float mapValue(const Params& P,float u,float v){
    const float SQRT2=1.41421356f, PI=3.14159265f;
    float th=P.angleDeg*PI/180.f, c=cosf(th), s=sinf(th);
    float f;
    if (P.mapType==MAP_RADIAL){
        float rr=sqrtf(u*u+v*v)/SQRT2;             // 0..1
        f=2.f*ds_frac(rr*P.spacing)-1.f;
    } else if (P.mapType==MAP_WAVE){
        float proj=(u*c+v*s);
        f=sinf(proj*P.waveFreq*PI + P.wavePhase);
    } else if (P.mapType==MAP_NOISE){
        f=2.f*dm_fbm((u*0.5f+0.5f)*P.noiseScale,(v*0.5f+0.5f)*P.noiseScale,P.noiseSeed,P.noiseDetail)-1.f;
    } else if (P.mapType==MAP_LAYER){
        return 0.f;                                // caller substitutes layer luma
    } else { // MAP_GRADIENT
        float proj01=0.5f+0.5f*(u*c+v*s)/SQRT2;    // 0..1
        f=2.f*ds_frac(proj01*P.spacing)-1.f;
    }
    return ds_remap(ds_clamp(f,-1.f,1.f), P.mapContrast);
}

// Unit direction of the field gradient (for DISP_ALONG_GRADIENT), via central diff.
DS_HD inline void mapGradientDir(const Params& P,float u,float v,float& gx,float& gy){
    const float e=0.01f;
    gx=(mapValue(P,u+e,v)-mapValue(P,u-e,v))/(2.f*e);
    gy=(mapValue(P,u,v+e)-mapValue(P,u,v-e))/(2.f*e);
    float L=sqrtf(gx*gx+gy*gy)+1e-6f; gx/=L; gy/=L;
}

} // namespace distort

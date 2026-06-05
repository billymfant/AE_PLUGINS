#include "glow_core.h"
#include <algorithm>
#include <cmath>

namespace glow {

float luma(float r, float g, float b) { return 0.2126f*r + 0.7152f*g + 0.0722f*b; }

static inline int clampi(int v, int lo, int hi){ return v<lo?lo:(v>hi?hi:v); }

void sampleBilinear(const Image& s, float u, float v, float out[4]) {
    if (s.w<=0 || s.h<=0){ out[0]=out[1]=out[2]=out[3]=0; return; }
    float fx = u - 0.5f, fy = v - 0.5f;
    int x0 = (int)std::floor(fx), y0 = (int)std::floor(fy);
    float tx = fx - x0, ty = fy - y0;
    int x1=x0+1, y1=y0+1;
    x0=clampi(x0,0,s.w-1); x1=clampi(x1,0,s.w-1);
    y0=clampi(y0,0,s.h-1); y1=clampi(y1,0,s.h-1);
    const float* p00=s.at(x0,y0); const float* p10=s.at(x1,y0);
    const float* p01=s.at(x0,y1); const float* p11=s.at(x1,y1);
    for (int c=0;c<4;++c){
        float a = p00[c]*(1-tx)+p10[c]*tx;
        float b = p01[c]*(1-tx)+p11[c]*tx;
        out[c]  = a*(1-ty)+b*ty;
    }
}

static inline float smoothstep(float e0, float e1, float x){
    float t = (x - e0) / (e1 - e0 + 1e-6f);
    t = t<0?0:(t>1?1:t);
    return t*t*(3.0f - 2.0f*t);
}

Image extractBright(const Image& src, const Params& p) {
    Image out(src.w, src.h);
    float lo = p.threshold - p.thresholdSoft;   // knee start
    float hi = p.threshold;                      // full pass at/above
    for (int y=0;y<src.h;++y) for (int x=0;x<src.w;++x){
        const float* s = src.at(x,y);
        float l = luma(s[0],s[1],s[2]);
        float m = (lo >= hi) ? (l >= hi ? 1.f : 0.f) : smoothstep(lo, hi, l);
        float* o = out.at(x,y);
        o[0]=s[0]*m*p.sourceGain; o[1]=s[1]*m*p.sourceGain; o[2]=s[2]*m*p.sourceGain; o[3]=m;
    }
    return out;
}

Image downsampleHalf(const Image& s) {
    int w = (s.w+1)/2, h = (s.h+1)/2;
    Image d(w,h);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        // sample source at the center of this dest texel, in source pixel coords
        float cx = (x+0.5f)*2.0f, cy = (y+0.5f)*2.0f;
        float acc[4]={0,0,0,0};
        // 13-tap weights (Jimenez/CoD): center group + ring; normalized below.
        const float o = 1.0f; // one source pixel
        struct T{float dx,dy,w;};
        const T taps[13]={
            {-2,-2,0.03125f},{0,-2,0.0625f},{2,-2,0.03125f},
            {-1,-1,0.125f},{1,-1,0.125f},
            {-2,0,0.0625f},{0,0,0.125f},{2,0,0.0625f},
            {-1,1,0.125f},{1,1,0.125f},
            {-2,2,0.03125f},{0,2,0.0625f},{2,2,0.03125f}
        };
        float wsum=0; float t[4];
        for (const T& tp: taps){ sampleBilinear(s, cx+tp.dx*o, cy+tp.dy*o, t);
            acc[0]+=t[0]*tp.w; acc[1]+=t[1]*tp.w; acc[2]+=t[2]*tp.w; acc[3]+=t[3]*tp.w; wsum+=tp.w; }
        float inv = wsum>0?1.0f/wsum:0.0f;
        float* dd=d.at(x,y); dd[0]=acc[0]*inv; dd[1]=acc[1]*inv; dd[2]=acc[2]*inv; dd[3]=acc[3]*inv;
    }
    return d;
}

void upsampleAdd(const Image& low, Image& hi, float weight, int dimensions) {
    float sx = (dimensions==DIM_VERTICAL)   ? 0.0f : 1.0f;  // anamorphic: kill horizontal spread
    float sy = (dimensions==DIM_HORIZONTAL) ? 0.0f : 1.0f;  // kill vertical spread
    for (int y=0;y<hi.h;++y) for (int x=0;x<hi.w;++x){
        // map hi texel center into low-res pixel coords
        float lx = (x+0.5f) * (float)low.w / (float)hi.w;
        float ly = (y+0.5f) * (float)low.h / (float)hi.h;
        // 9-tap tent (offsets in low-res pixels), squashed per anamorphic axis
        const float c=4.f/16, e=2.f/16, k=1.f/16;
        struct T{float dx,dy,w;};
        const T taps[9]={{-1,-1,k},{0,-1,e},{1,-1,k},{-1,0,e},{0,0,c},{1,0,e},{-1,1,k},{0,1,e},{1,1,k}};
        float acc[4]={0,0,0,0}, t[4];
        for (const T& tp: taps){ sampleBilinear(low, lx+tp.dx*sx, ly+tp.dy*sy, t);
            acc[0]+=t[0]*tp.w; acc[1]+=t[1]*tp.w; acc[2]+=t[2]*tp.w; acc[3]+=t[3]*tp.w; }
        float* hh=hi.at(x,y);
        hh[0]+=acc[0]*weight; hh[1]+=acc[1]*weight; hh[2]+=acc[2]*weight; hh[3]+=acc[3]*weight;
    }
}

} // namespace glow

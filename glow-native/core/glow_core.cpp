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

} // namespace glow

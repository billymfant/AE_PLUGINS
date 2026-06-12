#include "distort_core.h"
#include "distort_map.h"
#include "distort_flow.h"
#include <cmath>

namespace distort {

int edgeIndex(int i,int n,int mode){
    if (n<=1) return 0;
    if (i>=0 && i<n) return i;
    if (mode==EDGE_WRAP){ i%=n; if(i<0) i+=n; return i; }
    if (mode==EDGE_MIRROR){
        int period=2*n; int m=i%period; if(m<0) m+=period;
        return m<n ? m : period-1-m;
    }
    return i<0 ? 0 : n-1;                              // clamp (and transparent fallback)
}

static inline void tap(const Image& im,int x,int y,int edge,float w,float acc[4]){
    int xi=edgeIndex(x,im.w,edge), yi=edgeIndex(y,im.h,edge);
    const float* p=im.at(xi,yi);
    acc[0]+=p[0]*w; acc[1]+=p[1]*w; acc[2]+=p[2]*w; acc[3]+=p[3]*w;
}

void sampleBilinear(const Image& im,float fx,float fy,int edge,float out[4]){
    out[0]=out[1]=out[2]=out[3]=0.f;
    if (im.w<=0 || im.h<=0) return;
    if (edge==EDGE_TRANSPARENT){
        // zero contribution from taps outside [0,w-1]x[0,h-1]; fully-outside -> 0000
        int x0=(int)floorf(fx), y0=(int)floorf(fy);
        float tx=fx-x0, ty=fy-y0;
        float wgt[4]={(1-tx)*(1-ty),tx*(1-ty),(1-tx)*ty,tx*ty};
        int xs[4]={x0,x0+1,x0,x0+1}, ys[4]={y0,y0,y0+1,y0+1};
        for(int k=0;k<4;k++){
            int x=xs[k],y=ys[k];
            if(x<0||x>=im.w||y<0||y>=im.h) continue;
            const float* p=im.at(x,y);
            out[0]+=p[0]*wgt[k]; out[1]+=p[1]*wgt[k]; out[2]+=p[2]*wgt[k]; out[3]+=p[3]*wgt[k];
        }
        return;
    }
    int x0=(int)floorf(fx), y0=(int)floorf(fy);
    float tx=fx-x0, ty=fy-y0;
    tap(im,x0,  y0,  edge,(1-tx)*(1-ty),out);
    tap(im,x0+1,y0,  edge,tx*(1-ty),    out);
    tap(im,x0,  y0+1,edge,(1-tx)*ty,    out);
    tap(im,x0+1,y0+1,edge,tx*ty,        out);
}

// warp() is implemented in Task 5.

} // namespace distort

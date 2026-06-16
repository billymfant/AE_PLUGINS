#include "distort_core.h"
#include "distort_map.h"
#include "distort_flow.h"
#include <cmath>
#include <thread>
#include <vector>
#include <algorithm>

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

// Signed map field in [-1,1] at a pixel anchor (ax,ay). Generators via mapValue;
// MAP_LAYER samples the layer's luma/channel. Shared by the smooth and slat paths.
static inline float fieldAtAnchor(const Params& P, const Image* mapLayer,
                                  int W, int H, float ax, float ay){
    float u=((ax+0.5f)/W)*2.f-1.f;
    float v=((ay+0.5f)/H)*2.f-1.f;
    if (P.mapType==MAP_LAYER && mapLayer){
        float mx=((ax+0.5f)/W)*mapLayer->w-0.5f;
        float my=((ay+0.5f)/H)*mapLayer->h-0.5f;
        float m[4]; sampleBilinear(*mapLayer,mx,my,EDGE_CLAMP,m);
        float val=(P.mapChannel==1)?m[0]:(P.mapChannel==2)?m[1]:(P.mapChannel==3)?m[2]:lumaRec709(m[0],m[1],m[2]);
        return ds_remap(ds_clamp(2.f*val-1.f,-1.f,1.f), P.mapContrast);
    }
    return mapValue(P,u,v);
}

// One horizontal band [y0,y1) of the warp. Pure per-pixel work, no shared writes
// outside dst's own rows, so bands run safely on separate threads.
static void warpBand(const Image& src, Image& dst, const Params& P, const Image* mapLayer,
                     float ca, float sa, float modul, int y0, int y1){
    for(int y=y0;y<y1;y++){
        for(int x=0;x<src.w;x++){
            // ── Slats (auto-weave): rigid Rows/Cols that slide. Mutually exclusive
            //    with the smooth/mosaic path (rows->X shift, cols->Y shift). ──────
            if (P.slatRows>0 || P.slatCols>0){
                float shiftX=0.f, shiftY=0.f;
                if (P.slatRows>0){
                    float rowH=(float)src.h/(float)P.slatRows;
                    int ri=(int)floorf((float)y/rowH);
                    if(ri<0) ri=0; if(ri>=P.slatRows) ri=P.slatRows-1;
                    float axc=(float)src.w*0.5f;                 // rows uniform across x
                    float ayc=((float)ri+0.5f)*rowH;             // band center
                    float uc=((axc+0.5f)/src.w)*2.f-1.f;
                    float vc=((ayc+0.5f)/src.h)*2.f-1.f;
                    float fld=fieldAtAnchor(P,mapLayer,src.w,src.h,axc,ayc);
                    float ff=ds_clamp(fld*flowWeight(P,uc,vc)*modul + flowJitter(P,ri,0),-1.f,1.f);
                    float sign=(1.f-P.slatStagger)+P.slatStagger*((ri&1)?-1.f:1.f);
                    shiftX+=ff*P.amount*sign;
                }
                if (P.slatCols>0){
                    float colW=(float)src.w/(float)P.slatCols;
                    int ci=(int)floorf((float)x/colW);
                    if(ci<0) ci=0; if(ci>=P.slatCols) ci=P.slatCols-1;
                    float axc=((float)ci+0.5f)*colW;             // band center
                    float ayc=(float)src.h*0.5f;                 // cols uniform across y
                    float uc=((axc+0.5f)/src.w)*2.f-1.f;
                    float vc=((ayc+0.5f)/src.h)*2.f-1.f;
                    float fld=fieldAtAnchor(P,mapLayer,src.w,src.h,axc,ayc);
                    float ff=ds_clamp(fld*flowWeight(P,uc,vc)*modul + flowJitter(P,0,ci),-1.f,1.f);
                    float sign=(1.f-P.slatStagger)+P.slatStagger*((ci&1)?-1.f:1.f);
                    shiftY+=ff*P.amount*sign;
                }
                float sm[4]; sampleBilinear(src,(float)x+shiftX,(float)y+shiftY,P.edgeMode,sm);
                float* o=dst.at(x,y);
                if (P.opacity>=1.f){ o[0]=sm[0];o[1]=sm[1];o[2]=sm[2];o[3]=sm[3]; }
                else { const float* s0=src.at(x,y); for(int k=0;k<4;k++) o[k]=s0[k]+(sm[k]-s0[k])*P.opacity; }
                continue;                                        // skip smooth/mosaic path
            }
            // mosaic: snap the sample anchor to block centers so each block is a solid
            // tile that displaces as one unit ("blocky" warp). Off when mosaicBlock<1.
            float ax=(float)x, ay=(float)y;
            if (P.mosaicBlock>=1.f){
                ax=(floorf((float)x/P.mosaicBlock)+0.5f)*P.mosaicBlock;
                ay=(floorf((float)y/P.mosaicBlock)+0.5f)*P.mosaicBlock;
            }
            float u=((ax+0.5f)/src.w)*2.f-1.f;
            float v=((ay+0.5f)/src.h)*2.f-1.f;
            float field = fieldAtAnchor(P, mapLayer, src.w, src.h, ax, ay);
            float ff = ds_clamp(field*flowWeight(P,u,v)*modul + flowJitter(P,(int)ax,(int)ay), -1.f, 1.f);
            // displacement vector
            float dx,dy;
            if (P.displaceMode==DISP_PUSH_PULL){
                float L=sqrtf(u*u+v*v)+1e-6f; dx=(u/L)*ff*P.amount; dy=(v/L)*ff*P.amount;
            } else if (P.displaceMode==DISP_ALONG_GRADIENT){
                float gx,gy; mapGradientDir(P,u,v,gx,gy); dx=gx*ff*P.amount; dy=gy*ff*P.amount;
            } else {
                dx=ca*ff*P.amount; dy=sa*ff*P.amount;
            }
            float sm[4]; sampleBilinear(src, ax+dx, ay+dy, P.edgeMode, sm);
            float* o=dst.at(x,y);
            if (P.opacity>=1.f){ o[0]=sm[0];o[1]=sm[1];o[2]=sm[2];o[3]=sm[3]; }
            else { const float* s0=src.at(x,y); for(int k=0;k<4;k++) o[k]=s0[k]+(sm[k]-s0[k])*P.opacity; }
        }
    }
}

// Spatial warp, multithreaded across row-bands. Each band is independent (reads
// src anywhere, writes only its own dst rows), so this is a clean parallel-for.
// Small frames run inline to avoid thread-spawn overhead (keeps unit tests fast).
void warp(const Image& src, Image& dst, const Params& P, const Image* mapLayer, float time){
    const float PI=3.14159265f;
    if (dst.w!=src.w || dst.h!=src.h) dst = Image(src.w, src.h);
    float th=P.angleDeg*PI/180.f, ca=cosf(th), sa=sinf(th);
    float modul=flowScalar(P,time);
    if (src.h<=0 || src.w<=0) return;

    unsigned hw = std::thread::hardware_concurrency(); if (hw==0) hw=4;
    int nThreads = (int)hw;
    // Don't spawn more threads than ~one per 16 rows, and never for tiny images.
    int maxByRows = src.h / 16; if (maxByRows < 1) maxByRows = 1;
    if (nThreads > maxByRows) nThreads = maxByRows;

    if (nThreads <= 1){
        warpBand(src, dst, P, mapLayer, ca, sa, modul, 0, src.h);
        return;
    }
    std::vector<std::thread> pool;
    pool.reserve(nThreads);
    int band = (src.h + nThreads - 1) / nThreads;   // ceil division
    for(int t=0; t<nThreads; ++t){
        int y0 = t*band, y1 = std::min(src.h, y0+band);
        if (y0 >= y1) break;
        pool.emplace_back(warpBand, std::cref(src), std::ref(dst), std::cref(P),
                          mapLayer, ca, sa, modul, y0, y1);
    }
    for(auto& th2 : pool) th2.join();
}

} // namespace distort

#include <cstdio>
#include <cmath>
#include "distort_params.h"
#include "distort_map.h"
#include "distort_flow.h"
#include "distort_core.h"
using namespace distort;

static int g_fail = 0;
#define CHECK(cond) do{ if(!(cond)){ printf("FAIL %s:%d  %s\n",__FILE__,__LINE__,#cond); ++g_fail; } }while(0)
#define NEAR(a,b,eps) CHECK(std::fabs((a)-(b)) <= (eps))

static void test_clamp_frac(){
    NEAR(ds_clamp(5.f,0.f,1.f), 1.f, 0.f);
    NEAR(ds_clamp(-5.f,0.f,1.f), 0.f, 0.f);
    NEAR(ds_frac(2.25f), 0.25f, 1e-6f);
}

static void test_map_gradient_center(){
    Params P; P.mapType=MAP_GRADIENT; P.spacing=1.f; P.angleDeg=0.f;
    // center (u=0): proj01=0.5, triangle(0.5) = -1 (continuous ramp, no tear)
    NEAR(mapValue(P, 0.f, 0.f), -1.f, 1e-5f);
}
static void test_map_gradient_uniform_when_spacing_zero(){
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f;
    NEAR(mapValue(P,-0.7f, 0.3f), 1.f, 1e-5f);   // tri(0)=+1 uniform everywhere
    NEAR(mapValue(P, 0.6f,-0.2f), 1.f, 1e-5f);
}
static void test_map_wave_phase_zero_center(){
    Params P; P.mapType=MAP_WAVE; P.wavePhase=0.f; P.waveFreq=1.f; P.angleDeg=0.f;
    NEAR(mapValue(P, 0.f, 0.f), 0.f, 1e-5f);      // sin(0)=0
}
static void test_map_in_range(){
    Params P;
    for (int t=MAP_GRADIENT; t<=MAP_NOISE; ++t){
        P.mapType=t;
        for (float v=-1.f; v<=1.f; v+=0.25f)
            for (float u=-1.f; u<=1.f; u+=0.25f){
                float f = mapValue(P,u,v);
                CHECK(f >= -1.0001f && f <= 1.0001f);
            }
    }
}

static void test_ease_endpoints_monotonic(){
    int modes[6]={EASE_LINEAR,EASE_IN,EASE_OUT,EASE_INOUT,EASE_SINE,EASE_EXP};
    for(int i=0;i<6;i++){
        NEAR(ds_ease(modes[i],0.f),0.f,1e-4f);
        NEAR(ds_ease(modes[i],1.f),1.f,1e-4f);
        float prev=-1.f;
        for(float t=0.f;t<=1.f;t+=0.05f){ float e=ds_ease(modes[i],t); CHECK(e>=prev-1e-4f); prev=e; }
    }
}
static void test_flow_static_is_one(){
    Params P; P.flowSpeed=0.f;                     // static
    NEAR(flowScalar(P, 3.7f), 1.f, 1e-6f);
}
static void test_flow_weight_dir(){
    Params P;
    P.flowDir=FLOW_FORWARD; NEAR(flowWeight(P,0.3f,0.2f), 1.f, 1e-6f);
    P.flowDir=FLOW_REVERSE; NEAR(flowWeight(P,0.3f,0.2f),-1.f, 1e-6f);
    P.flowDir=FLOW_CENTER_OUT; NEAR(flowWeight(P,0.f,0.f), -1.f, 1e-4f); // center
    P.flowDir=FLOW_EDGES_IN;   NEAR(flowWeight(P,0.f,0.f),  1.f, 1e-4f);
}
static void test_flow_jitter_deterministic_and_bounded(){
    Params P; P.jitter=0.5f; P.jitterSeed=7;
    float a=flowJitter(P,10,20), b=flowJitter(P,10,20);
    NEAR(a,b,0.f);                                  // same input -> same output
    CHECK(a>=-0.5f && a<=0.5f);
    NEAR(flowJitter(P,10,20)*0.f,0.f,0.f);          // (no-op, keeps a referenced)
    Params Q; Q.jitter=0.f; NEAR(flowJitter(Q,10,20),0.f,0.f);
}

static Image solid_rgba(int w,int h,float r,float g,float b,float a){
    Image im(w,h);
    for(int i=0;i<w*h;++i){ float* p=&im.px[i*4]; p[0]=r;p[1]=g;p[2]=b;p[3]=a; }
    return im;
}
static void test_bilinear_integer_exact(){
    Image im(2,1);
    im.at(0,0)[0]=0.2f; im.at(1,0)[0]=0.8f;
    float o[4]; sampleBilinear(im, 1.f, 0.f, EDGE_CLAMP, o);
    NEAR(o[0], 0.8f, 1e-5f);
}
static void test_bilinear_midpoint_average(){
    Image im(2,1);
    im.at(0,0)[0]=0.2f; im.at(1,0)[0]=0.8f;
    float o[4]; sampleBilinear(im, 0.5f, 0.f, EDGE_CLAMP, o);
    NEAR(o[0], 0.5f, 1e-5f);                          // (0.2+0.8)/2
}
static void test_edge_clamp_outside(){
    Image im = solid_rgba(2,2, 0.3f,0,0, 1.f);
    float o[4]; sampleBilinear(im, -5.f, -5.f, EDGE_CLAMP, o);
    NEAR(o[0], 0.3f, 1e-5f);                          // clamped to (0,0)
}
static void test_edge_transparent_outside(){
    Image im = solid_rgba(2,2, 0.3f,0,0, 1.f);
    float o[4]; sampleBilinear(im, -5.f, 0.f, EDGE_TRANSPARENT, o);
    NEAR(o[0], 0.f, 1e-5f); NEAR(o[3], 0.f, 1e-5f);   // fully outside -> 0000
}

static Image ramp_x(int w,int h){                     // red channel = x index
    Image im(w,h);
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float* p=im.at(x,y); p[0]=(float)x; p[1]=0;p[2]=0;p[3]=1.f; }
    return im;
}
static Image ramp_y(int w,int h){                     // red channel = y index
    Image im(w,h);
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float* p=im.at(x,y); p[0]=(float)y; p[1]=0;p[2]=0;p[3]=1.f; }
    return im;
}
static void test_warp_identity_when_amount_zero(){
    Image src=ramp_x(8,4), dst(8,4);
    Params P; P.amount=0.f;
    warp(src,dst,P,nullptr,0.f);
    for(size_t i=0;i<src.px.size();++i) NEAR(dst.px[i],src.px[i],1e-4f);
}
static void test_warp_known_shift(){
    // gradient spacing=0 -> tri(0)=+1 field everywhere; fixed dir angle 0, amount 2
    // dst(x,y) samples src at x + cos0*(+1)*2 = x+2  => dst red == src red at x+2 (clamped)
    Image src=ramp_x(8,1), dst(8,1);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.displaceMode=DISP_FIXED;
    P.angleDeg=0.f; P.amount=2.f; P.edgeMode=EDGE_CLAMP;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(3,0)[0], 5.f, 1e-4f);                 // src x=5
    NEAR(dst.at(6,0)[0], 7.f, 1e-4f);                 // x+2=8 -> clamp to 7
}
static void test_warp_mosaic_blocks(){
    // mosaicBlock=4, amount 0 -> no displacement; each block samples its own center.
    // block [0,4) center ax=2 -> red 2 across it; block [4,8) center ax=6 -> red 6.
    Image src=ramp_x(8,1), dst(8,1);
    Params P; P.mapType=MAP_GRADIENT; P.amount=0.f; P.mosaicBlock=4.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(1,0)[0], 2.f, 1e-4f);
    NEAR(dst.at(5,0)[0], 6.f, 1e-4f);
}
static void test_warp_slats_rows_uniform_shift(){
    // gradient spacing=0 -> field +1 everywhere; rows=2, stagger=0, amount=2.
    // auto-weave rows slide +X by amount => dst red == src red at x+2 (clamp).
    Image src=ramp_x(8,4), dst(8,4);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=2.f;
    P.edgeMode=EDGE_CLAMP; P.slatRows=2; P.slatStagger=0.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(3,0)[0], 5.f, 1e-4f);                 // x=3 -> src 5, band 0
    NEAR(dst.at(3,3)[0], 5.f, 1e-4f);                 // band 1 same (spacing0 uniform)
    NEAR(dst.at(6,0)[0], 7.f, 1e-4f);                 // x+2=8 -> clamp 7
}
static void test_warp_slats_stagger_alternates_bands(){
    // spacing0 field +1, rows=2 over h=4 (band0=y0..1, band1=y2..3), stagger=1, amount=2.
    // band0 (ri=0 even) sign +1 -> shift +2; band1 (ri=1 odd) sign -1 -> shift -2.
    Image src=ramp_x(8,4), dst(8,4);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=2.f;
    P.edgeMode=EDGE_CLAMP; P.slatRows=2; P.slatStagger=1.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(3,0)[0], 5.f, 1e-4f);                 // band0: x+2 = 5
    NEAR(dst.at(3,2)[0], 1.f, 1e-4f);                 // band1: x-2 = 1
}
static void test_warp_slats_cols_uniform_shift(){
    // cols=2, spacing0 field +1, stagger0, amount2 -> shift +Y by 2. ramp_y red=y.
    Image src=ramp_y(4,8), dst(4,8);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=2.f;
    P.edgeMode=EDGE_CLAMP; P.slatCols=2; P.slatStagger=0.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(0,3)[0], 5.f, 1e-4f);                 // y=3 -> src 5
    NEAR(dst.at(0,6)[0], 7.f, 1e-4f);                 // y+2=8 -> clamp 7
    NEAR(dst.at(2,3)[0], 5.f, 1e-4f);                 // column band 1 (x=2): y+2 = 5
}
static void test_warp_opacity_zero_is_source(){
    Image src=ramp_x(8,2), dst(8,2);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=4.f; P.opacity=0.f;
    warp(src,dst,P,nullptr,0.f);
    for(size_t i=0;i<src.px.size();++i) NEAR(dst.px[i],src.px[i],1e-4f);
}
static void test_warp_layer_map_luma(){
    // MAP_LAYER: a white map -> luma 1 -> field 2*1-1=+1; fixed angle0 amount2
    // dst samples src at x + 1*2 = x+2
    Image src=ramp_x(8,1), dst(8,1);
    Image map=solid_rgba(8,1, 1.f,1.f,1.f, 1.f);
    Params P; P.mapType=MAP_LAYER; P.mapChannel=0; P.displaceMode=DISP_FIXED;
    P.angleDeg=0.f; P.amount=2.f; P.edgeMode=EDGE_CLAMP;
    warp(src,dst,P,&map,0.f);
    NEAR(dst.at(3,0)[0], 5.f, 1e-4f);                 // src x=5
}

int main(){
    test_clamp_frac();
    test_map_gradient_center(); test_map_gradient_uniform_when_spacing_zero(); test_map_wave_phase_zero_center(); test_map_in_range();
    test_ease_endpoints_monotonic(); test_flow_static_is_one(); test_flow_weight_dir(); test_flow_jitter_deterministic_and_bounded();
    test_bilinear_integer_exact(); test_bilinear_midpoint_average(); test_edge_clamp_outside(); test_edge_transparent_outside();
    test_warp_identity_when_amount_zero(); test_warp_known_shift(); test_warp_opacity_zero_is_source(); test_warp_layer_map_luma();
    test_warp_mosaic_blocks();
    test_warp_slats_rows_uniform_shift(); test_warp_slats_stagger_alternates_bands(); test_warp_slats_cols_uniform_shift();
    if (g_fail==0) printf("ALL PASS\n"); else printf("%d FAILED\n", g_fail);
    return g_fail==0 ? 0 : 1;
}

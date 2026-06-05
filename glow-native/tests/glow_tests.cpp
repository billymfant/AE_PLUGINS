#include <cstdio>
#include <cmath>
#include "glow_core.h"
using namespace glow;

static int g_fail = 0;
#define CHECK(cond) do{ if(!(cond)){ printf("FAIL %s:%d  %s\n",__FILE__,__LINE__,#cond); ++g_fail; } }while(0)
#define NEAR(a,b,eps) CHECK(std::fabs((a)-(b)) <= (eps))

static void test_luma() {
    NEAR(luma(1,1,1), 1.0f, 1e-6f);
    NEAR(luma(0,0,0), 0.0f, 1e-6f);
    NEAR(luma(1,0,0), 0.2126f, 1e-4f);
}

static void test_bilinear_center() {
    Image im(2,2);
    im.at(0,0)[0]=0; im.at(1,0)[0]=1; im.at(0,1)[0]=0; im.at(1,1)[0]=1; // red ramps L->R
    float o[4];
    // Pixel centers sit at integer+0.5: left pixel center = u=0.5, right = u=1.5.
    // Midpoint between the two pixel centers is u=1.0 -> expected blend = 0.5.
    // (The plan's u=0.5 lands exactly on the left pixel center, giving 0.0 with clamp-to-edge.)
    sampleBilinear(im, 1.0f, 0.5f, o);   // midpoint between pixel centers x=0 and x=1
    NEAR(o[0], 0.5f, 1e-5f);
}

static Image whiteSquare(int W,int H,int sq){      // white square centered on black, alpha=1
    Image im(W,H);
    int x0=(W-sq)/2, y0=(H-sq)/2;
    for(int y=0;y<H;++y)for(int x=0;x<W;++x){
        float v=(x>=x0&&x<x0+sq&&y>=y0&&y<y0+sq)?1.f:0.f;
        float* p=im.at(x,y); p[0]=p[1]=p[2]=v; p[3]=1.f;
    }
    return im;
}
static float energy(const Image& im){ double s=0; for(size_t i=0;i<im.px.size();i+=4) s+=im.px[i]; return (float)s; }

static Image lumaRamp(int W,int H){               // horizontal black->white ramp, alpha=1
    Image im(W,H);
    for(int y=0;y<H;++y)for(int x=0;x<W;++x){
        float v = (W>1) ? (float)x/(float)(W-1) : 0.f;
        float* p=im.at(x,y); p[0]=p[1]=p[2]=v; p[3]=1.f;
    }
    return im;
}

static void test_downsample_dims_and_energy() {
    Image src = whiteSquare(64,64,16);
    Image half = downsampleHalf(src);
    CHECK(half.w==32 && half.h==32);
    // energy per unit area roughly preserved (within 25%): downsample averages.
    float eFull = energy(src), eHalf = energy(half);
    CHECK(eHalf > eFull*0.25f*0.6f && eHalf < eFull*0.25f*1.4f);
}
static void test_upsample_adds_and_spreads() {
    Image src = whiteSquare(64,64,16);
    Image half = downsampleHalf(src);
    Image acc(64,64);                         // zero
    upsampleAdd(half, acc, 1.0f, DIM_BOTH);
    // a pixel just OUTSIDE the original square edge should now be non-zero (spread happened)
    int x0=(64-16)/2, y0=32;
    CHECK(acc.at(x0-1, y0)[0] > 0.0f);
}

static void test_AC1_threshold_direction() {
    // AC1: raising the threshold must monotonically REDUCE extracted energy (guards the
    // inverted/mis-scaled-threshold bug). A pure-white square can't show this — every
    // luma-1.0 pixel passes any threshold below 1.0 — so the fixture is a 0..1 luma ramp.
    Image src = lumaRamp(64,64);
    Params lo;  lo.threshold = 0.10f; lo.thresholdSoft = 0.0f; lo.sourceGain = 1.f;
    Params mid = lo; mid.threshold = 0.50f;
    Params hi  = lo; hi.threshold  = 0.90f;
    float elo  = energy(extractBright(src, lo));
    float emid = energy(extractBright(src, mid));
    float ehi  = energy(extractBright(src, hi));
    CHECK(elo > 200.0f);                  // low threshold extracts a strong, obvious amount
    CHECK(elo > emid && emid > ehi);      // higher threshold => less extracted (NOT inverted)
}

static void test_AC2_soft_round_falloff() {
    Image src = whiteSquare(128,128,32);
    Params p; p.threshold=0.10f; p.thresholdSoft=0.05f; p.radius=40.f; p.levels=0;
    p.blendOp=BLEND_ADD; p.glowOnly=true; p.intensity=1.0f; p.linearLight=false; p.tonemap=TONE_NONE;
    Image g = bloom(src, p);
    // sample outward from the right edge of the square along the center row
    int y=64, xEdge=(128+32)/2;             // first pixel outside the square
    float prev = 1e9f; bool anyGlow=false;
    for (int d=0; d<24; ++d){
        float val = g.at(xEdge+d, y)[0];
        if (val>0.0005f) anyGlow=true;
        CHECK(val <= prev + 1e-4f);          // monotonic non-increasing => no hard secondary box
        prev = val;
    }
    CHECK(anyGlow);                          // there IS a halo (not "no glow")
}

static void test_AC3_source_preserved() {
    Image src = whiteSquare(64,64,16);
    Params p; p.threshold=0.10f; p.blendOp=BLEND_ADD; p.glowOnly=false; p.linearLight=false; p.tonemap=TONE_NONE;
    Image g = bloom(src, p);
    // interior pixel stays at least as bright as the source (glow adds, never punches a hole)
    CHECK(g.at(32,32)[0] >= 1.0f - 1e-3f);
}

static void test_glow_alpha_over_transparent() {
    // Bright square on a TRANSPARENT background (alpha 0 outside the square).
    // In composited (not glow-only) mode the halo outside the square must be
    // VISIBLE -> output alpha > 0 there. Regression: alpha used to be copied
    // straight from the (transparent) source, hiding the halo in AE on shape/
    // text layers. whiteSquare can't catch this (its background alpha is 1).
    Image src(64,64);
    int sq=16, x0=(64-sq)/2, y0=(64-sq)/2;
    for(int y=0;y<64;++y)for(int x=0;x<64;++x){
        bool in = (x>=x0 && x<x0+sq && y>=y0 && y<y0+sq);
        float* px=src.at(x,y);
        px[0]=px[1]=px[2]= in?1.f:0.f;
        px[3]= in?1.f:0.f;                 // transparent outside the square
    }
    Params p; p.threshold=0.10f; p.thresholdSoft=0.05f; p.radius=20.f;
    p.glowOnly=false; p.blendOp=BLEND_ADD; p.linearLight=false; p.tonemap=TONE_NONE;
    Image g = bloom(src, p);
    int x=x0+sq+1, y=32;                    // just outside the square edge
    CHECK(g.at(x,y)[0] > 0.001f);           // halo color present
    CHECK(g.at(x,y)[3] > 0.001f);           // halo is VISIBLE (alpha raised)
    CHECK(g.at(32,32)[3] >= 1.0f - 1e-3f);  // opaque interior stays opaque
}

int main() {
    test_luma();
    test_bilinear_center();
    test_AC1_threshold_direction();
    test_downsample_dims_and_energy();
    test_upsample_adds_and_spreads();
    test_AC2_soft_round_falloff();
    test_AC3_source_preserved();
    test_glow_alpha_over_transparent();
    if (g_fail) { printf("%d CHECK(s) failed\n", g_fail); return 1; }
    printf("ALL TESTS PASSED\n"); return 0;
}

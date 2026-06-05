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

int main() {
    test_luma();
    test_bilinear_center();
    test_AC1_threshold_direction();
    if (g_fail) { printf("%d CHECK(s) failed\n", g_fail); return 1; }
    printf("ALL TESTS PASSED\n"); return 0;
}

#include <cstdio>
#include <cmath>
#include "color_params.h"
#include "color_core.h"
using namespace colorlab;

static int g_fail = 0;
#define CHECK(cond) do{ if(!(cond)){ printf("FAIL %s:%d  %s\n",__FILE__,__LINE__,#cond); ++g_fail; } }while(0)
#define NEAR(a,b,eps) CHECK(std::fabs((a)-(b)) <= (eps))

// ---- helpers ----
static void test_srgb_roundtrip() {
    for (float c = 0.f; c <= 1.f; c += 0.1f)
        NEAR(linear_to_srgb(srgb_to_linear(c)), c, 1e-4f);
}
static void test_srgb_known() {
    NEAR(srgb_to_linear(0.f), 0.f, 1e-6f);
    NEAR(srgb_to_linear(1.f), 1.f, 1e-5f);
    NEAR(srgb_to_linear(0.5f), 0.2140f, 2e-3f); // ~0.214 linear for 0.5 sRGB
}
static void test_luma() {
    NEAR(lumaRec709(1,1,1), 1.0f, 1e-6f);
    NEAR(lumaRec709(1,0,0), 0.2126f, 1e-4f);
}

// ---- pipeline ----
static Image solid(int w,int h,float r,float g,float b){
    Image im(w,h);
    for(int i=0;i<w*h;++i){ float* p=&im.px[i*4]; p[0]=r;p[1]=g;p[2]=b;p[3]=1.f; }
    return im;
}
static void test_identity_is_noop() {            // AC1
    Image im = solid(4,4,0.2f,0.5f,0.8f);
    Image ref = im;
    Params P;                                     // all defaults = identity
    grade(im, P);
    for (size_t i=0;i<im.px.size();++i) NEAR(im.px[i], ref.px[i], 1e-4f);
}
static void test_exposure_doubles_linear() {      // AC2
    Image im = solid(2,2,0.25f,0.25f,0.25f);
    Params P; P.linearLight=true; P.exposure=1.0f; // +1 stop = x2 in linear
    float lin = srgb_to_linear(0.25f);
    grade(im, P);
    float expect = linear_to_srgb(lin * 2.f);
    NEAR(im.px[0], expect, 2e-3f);
}
static void test_desaturate_to_gray() {           // AC2
    Image im = solid(2,2,0.8f,0.2f,0.1f);
    Params P; P.saturation=-1.0f;                 // fully desaturate
    grade(im, P);
    NEAR(im.px[0], im.px[1], 2e-3f); NEAR(im.px[1], im.px[2], 2e-3f);
}
static void test_lift_raises_blacks() {           // AC2 direction
    Image im = solid(2,2,0.0f,0.0f,0.0f);
    Params P; P.liftLuma=0.2f;
    grade(im, P);
    CHECK(im.px[0] > 0.05f);                       // black got lifted
}
static void test_alpha_preserved() {
    Image im = solid(2,2,0.3f,0.6f,0.9f);
    im.px[3] = 0.42f;
    Params P; P.exposure=0.7f; P.saturation=0.5f;
    grade(im, P);
    NEAR(im.px[3], 0.42f, 1e-6f);                  // alpha untouched
}

int main() {
    test_srgb_roundtrip();
    test_srgb_known();
    test_luma();
    test_identity_is_noop();
    test_exposure_doubles_linear();
    test_desaturate_to_gray();
    test_lift_raises_blacks();
    test_alpha_preserved();
    if (g_fail) { printf("%d CHECK(S) FAILED\n", g_fail); return 1; }
    printf("ALL PASS\n"); return 0;
}

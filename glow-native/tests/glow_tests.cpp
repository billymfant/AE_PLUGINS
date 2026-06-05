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

int main() {
    test_luma();
    test_bilinear_center();
    if (g_fail) { printf("%d CHECK(s) failed\n", g_fail); return 1; }
    printf("ALL TESTS PASSED\n"); return 0;
}

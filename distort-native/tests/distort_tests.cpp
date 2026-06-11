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

static void test_map_gradient_center_zero(){
    Params P; P.mapType=MAP_GRADIENT; P.spacing=1.f; P.angleDeg=0.f;
    // center (u=0): proj01=0.5, spacing 1 -> frac(0.5)=0.5 -> field 0
    NEAR(mapValue(P, 0.f, 0.f), 0.f, 1e-5f);
}
static void test_map_gradient_uniform_when_spacing_zero(){
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f;
    NEAR(mapValue(P,-0.7f, 0.3f), -1.f, 1e-5f);   // frac(0)=0 -> 2*0-1 = -1 everywhere
    NEAR(mapValue(P, 0.6f,-0.2f), -1.f, 1e-5f);
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

int main(){
    test_clamp_frac();
    test_map_gradient_center_zero(); test_map_gradient_uniform_when_spacing_zero(); test_map_wave_phase_zero_center(); test_map_in_range();
    if (g_fail==0) printf("ALL PASS\n"); else printf("%d FAILED\n", g_fail);
    return g_fail==0 ? 0 : 1;
}

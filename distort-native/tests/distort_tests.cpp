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

int main(){
    test_clamp_frac();
    test_map_gradient_center_zero(); test_map_gradient_uniform_when_spacing_zero(); test_map_wave_phase_zero_center(); test_map_in_range();
    test_ease_endpoints_monotonic(); test_flow_static_is_one(); test_flow_weight_dir(); test_flow_jitter_deterministic_and_bounded();
    if (g_fail==0) printf("ALL PASS\n"); else printf("%d FAILED\n", g_fail);
    return g_fail==0 ? 0 : 1;
}

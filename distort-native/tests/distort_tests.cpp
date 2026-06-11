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

int main(){
    test_clamp_frac();
    if (g_fail==0) printf("ALL PASS\n"); else printf("%d FAILED\n", g_fail);
    return g_fail==0 ? 0 : 1;
}

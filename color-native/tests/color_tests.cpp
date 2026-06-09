#include <cstdio>
#include <cmath>
#include "color_params.h"
#include "color_core.h"
#include "color_scopes.h"
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

// ---- curves ----
static Curve mkCurve3(float x0,float y0,float x1,float y1,float x2,float y2){
    Curve c; c.n=3; c.x[0]=x0;c.y[0]=y0; c.x[1]=x1;c.y[1]=y1; c.x[2]=x2;c.y[2]=y2;
    prepareCurve(c); return c;
}
static void test_curve_identity_returns_x(){
    Curve c;                                      // n=0 => identity
    NEAR(evalCurve(c,0.3f),0.3f,1e-6f); NEAR(evalCurve(c,0.9f),0.9f,1e-6f);
}
static void test_curve_endpoints(){
    Curve c = mkCurve3(0,0, 0.5f,0.75f, 1,1);
    NEAR(evalCurve(c,0.f),0.f,1e-5f); NEAR(evalCurve(c,1.f),1.f,1e-5f);
    NEAR(evalCurve(c,0.5f),0.75f,1e-5f);
}
static void test_curve_monotonic_no_overshoot(){
    Curve c = mkCurve3(0,0, 0.5f,0.75f, 1,1);     // lifted mids
    float prev=-1.f;
    for(float x=0;x<=1.f;x+=0.05f){
        float v=evalCurve(c,x);
        CHECK(v >= prev-1e-5f);                   // monotonic increasing
        CHECK(v >= -1e-4f && v <= 1.0001f);       // no overshoot inside [0,1]
        prev=v;
    }
}
static void test_curve_in_pipeline(){
    Image im = solid(2,2,0.3f,0.3f,0.3f);
    Params P; P.linearLight=false;                // isolate the curve
    P.curveMaster = mkCurve3(0,0, 0.5f,0.8f, 1,1);// raise mids
    grade(im,P);
    CHECK(im.px[0] > 0.3f);                       // 0.3 pushed up toward ~0.8 region
}

// ---- HSL secondary ----
static void test_hsl_helpers(){
    NEAR(hueOf(1,0,0), 0.f, 1e-4f);
    NEAR(hueOf(0,1,0), 1.f/3.f, 1e-3f);
    NEAR(hsvSat(1,0,0), 1.f, 1e-4f);
    NEAR(hsvSat(0.5f,0.5f,0.5f), 0.f, 1e-4f);
    CHECK(hueMask(0.f,0.f,0.1f,0.02f) > 0.95f);    // at center
    CHECK(hueMask(0.5f,0.f,0.1f,0.02f) < 0.05f);   // opposite hue
}
static void test_hsl_mask_outside_is_zero(){
    Image im = solid(2,2, 0.1f, 0.8f, 0.1f);       // pure green
    Image ref = im;
    Params P; P.linearLight=false; P.hslEnable=true;
    P.hslCenterHue=0.f; P.hslHueWidth=0.05f; P.hslSoftness=0.02f; P.hslSatAdj=-1.f;
    grade(im,P);                                   // qualifier on red -> green untouched
    for(size_t i=0;i<im.px.size();++i) NEAR(im.px[i], ref.px[i], 2e-3f);
}
static void test_hsl_applies_at_center(){
    Image im = solid(2,2, 0.8f, 0.1f, 0.1f);       // pure red
    Params P; P.linearLight=false; P.hslEnable=true;
    P.hslCenterHue=0.f; P.hslHueWidth=0.1f; P.hslSoftness=0.05f; P.hslSatAdj=-1.f;
    grade(im,P);                                   // desaturate red within mask
    CHECK(std::fabs(im.px[0]-im.px[1]) < std::fabs(0.8f-0.1f)); // moved toward gray
}

// ---- scopes ----
static unsigned sumArr(const std::vector<unsigned>& a){ unsigned s=0; for(unsigned v:a) s+=v; return s; }

static void test_scopes_histogram_counts(){
    Image im = solid(32,16, 0.5f,0.5f,0.5f);          // 512 px mid-gray
    ScopeData s; computeScopes(im, s, 3);
    // luma histogram total == pixel count
    unsigned ly=0; for(int i=0;i<ScopeData::HBINS;++i) ly += s.hist[3*ScopeData::HBINS+i];
    CHECK(ly == 512u);
    // peak luma bin is the mid bin (~128)
    int peak=0; unsigned best=0;
    for(int i=0;i<ScopeData::HBINS;++i){ unsigned c=s.hist[3*ScopeData::HBINS+i]; if(c>best){best=c;peak=i;} }
    CHECK(peak >= 126 && peak <= 130);
    CHECK(s.srcW==32 && s.srcH==16 && s.frame==3);
}
static void test_scopes_waveform_solid_column(){
    Image im = solid(32,16, 0.5f,0.5f,0.5f);
    ScopeData s; computeScopes(im, s);
    // column 0 should have all its mass (16 rows mapped) in a single luma bin
    unsigned colSum=0, colMax=0;
    for(int b=0;b<ScopeData::WFH;++b){ unsigned c=s.waveform[0*ScopeData::WFH+b]; colSum+=c; if(c>colMax)colMax=c; }
    CHECK(colSum>0 && colMax==colSum);                 // single populated bin
}
static void test_scopes_file_roundtrip(){
    Image im = solid(8,8, 0.2f,0.6f,0.9f);
    ScopeData a; computeScopes(im, a, 7);
    CHECK(writeScopeFile("color-native/build/scope_rt.bin", a));
    ScopeData b;
    CHECK(readScopeFile("color-native/build/scope_rt.bin", b));
    CHECK(b.srcW==a.srcW && b.srcH==a.srcH && b.frame==7);
    CHECK(sumArr(b.hist)==sumArr(a.hist));
    CHECK(sumArr(b.waveform)==sumArr(a.waveform));
    CHECK(sumArr(b.vec)==sumArr(a.vec));
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
    test_curve_identity_returns_x();
    test_curve_endpoints();
    test_curve_monotonic_no_overshoot();
    test_curve_in_pipeline();
    test_hsl_helpers();
    test_hsl_mask_outside_is_zero();
    test_hsl_applies_at_center();
    test_scopes_histogram_counts();
    test_scopes_waveform_solid_column();
    test_scopes_file_roundtrip();
    if (g_fail) { printf("%d CHECK(S) FAILED\n", g_fail); return 1; }
    printf("ALL PASS\n"); return 0;
}

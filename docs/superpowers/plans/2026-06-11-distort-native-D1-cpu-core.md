# Distort Native — D1: CPU Core + CLI + Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the portable C++ CPU core of the native Distort/Flow engine — map generators (gradient/radial/wave/fractal-noise + use-a-layer), the **spatial** warp (bilinear, edge-handled), and the flow/animation math — plus a PNG-in/out CLI and a passing test suite. No After Effects, no CUDA yet.

**Architecture:** Mirrors `color-native/`. One header of shared host/device math (`distort_params.h`, marker `DS_HD` like color's `CL_HD`), pure inline map + flow headers, an `Image` + `warp()` core compiled to a CLI and a test binary via MSVC. The same math will later be reused verbatim by the CUDA mirror (D2) and the AE `.aex` (D3+).

**Tech Stack:** C++17, MSVC (`cl`), stb_image/stb_image_write (vendored, copied from `color-native/cli/`). Build via `distort-native/build-cli.bat` (vswhere-located VS dev env, same as `color-native/build-cli.bat`).

**Scope note:** D1 is **spatial only**. Temporal time-slice (`distort_time`, multi-frame `FrameSampler`) is deferred to D4 per the spec — do not build it here (YAGNI).

---

## File Structure (created in this plan)

```
distort-native/
├─ core/
│  ├─ distort_params.h    DS_HD macro · enums · Params struct · small math (clamp, frac, ease, remap, hash, luma)
│  ├─ distort_map.h       header-inline value-noise/fbm + mapValue() (signed field) + mapGradientDir()
│  ├─ distort_flow.h      header-inline flowScalar(time) · flowWeight(u,v) · flowJitter(x,y)
│  ├─ distort_core.h      Image struct · edgeIndex · sampleBilinear · warp() decl
│  └─ distort_core.cpp    edgeIndex / sampleBilinear / warp() implementations
├─ cli/
│  ├─ distort_cli.cpp     PNG in -> warp -> PNG out, arg parser
│  ├─ stb_image.h         (copy of color-native/cli/stb_image.h)
│  └─ stb_image_write.h   (copy of color-native/cli/stb_image_write.h)
├─ tests/
│  └─ distort_tests.cpp   CHECK/NEAR harness; map/flow/bilinear/warp tests
├─ build-cli.bat          builds distort_tests.exe + distort_cli.exe
└─ README.md              build/run + D1 status
```

**Convention reminders (match color-native):** all code in `namespace distort`. Image is RGBA float, row-major, 4 floats/px. Math helpers are `DS_HD inline` so nvcc can reuse them in D2. Normalized centered coords used by the map: `u=((x+0.5)/w)*2-1`, `v=((y+0.5)/h)*2-1`, both in (-1,1).

---

## Task 1: Scaffold + params header + green test harness

**Files:**
- Create: `distort-native/core/distort_params.h`
- Create: `distort-native/tests/distort_tests.cpp`
- Create: `distort-native/build-cli.bat`
- Copy: `distort-native/cli/stb_image.h`, `distort-native/cli/stb_image_write.h` (from `color-native/cli/`)

- [ ] **Step 1: Copy the stb headers and create the build script**

```bash
mkdir -p distort-native/core distort-native/cli distort-native/tests
cp color-native/cli/stb_image.h        distort-native/cli/stb_image.h
cp color-native/cli/stb_image_write.h  distort-native/cli/stb_image_write.h
```

Create `distort-native/build-cli.bat` (adapted from `color-native/build-cli.bat`):

```bat
@echo off
REM Locate the VS Developer environment and compile the CPU core, CLI and tests with MSVC.
setlocal
where cl >nul 2>nul
if %errorlevel%==0 goto :have_cl
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" ( echo [!] vswhere not found and cl not on PATH; run from a VS x64 Native Tools prompt & exit /b 1 )
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VSPATH=%%i"
if not defined VSPATH ( echo [!] Visual Studio not found via vswhere & exit /b 1 )
call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
where cl >nul 2>nul || ( echo [!] vcvars64 did not provide cl & exit /b 1 )
:have_cl
pushd "%~dp0"
if not exist build mkdir build
echo Building distort_tests.exe ...
cl /nologo /EHsc /O2 /std:c++17 /I core tests\distort_tests.cpp core\distort_core.cpp /Fo:build\ /Fe:build\distort_tests.exe || (popd & exit /b 1)
echo Building distort_cli.exe ...
cl /nologo /EHsc /O2 /std:c++17 /I core /I cli cli\distort_cli.cpp core\distort_core.cpp /Fo:build\ /Fe:build\distort_cli.exe || (popd & exit /b 1)
echo OK
popd
endlocal
```

- [ ] **Step 2: Write `distort-native/core/distort_params.h`** (full file)

```cpp
#pragma once
#include <cmath>

// Shared host/device marker (mirrors color's CL_HD). nvcc defines __CUDACC__.
#ifdef __CUDACC__
#define DS_HD __host__ __device__
#else
#define DS_HD
#endif

namespace distort {

enum MapType      { MAP_GRADIENT=1, MAP_RADIAL=2, MAP_WAVE=3, MAP_NOISE=4, MAP_LAYER=5 };
enum DisplaceMode { DISP_FIXED=1, DISP_ALONG_GRADIENT=2, DISP_PUSH_PULL=3 };
enum FlowDir      { FLOW_FORWARD=1, FLOW_REVERSE=2, FLOW_CENTER_OUT=3, FLOW_EDGES_IN=4 };
enum LoopMode     { LOOP_LOOP=1, LOOP_PINGPONG=2, LOOP_ONCE=3 };
enum Easing       { EASE_LINEAR=1, EASE_IN=2, EASE_OUT=3, EASE_INOUT=4, EASE_SINE=5, EASE_EXP=6 };
enum EdgeMode     { EDGE_CLAMP=1, EDGE_WRAP=2, EDGE_MIRROR=3, EDGE_TRANSPARENT=4 };

// All defaults = identity warp (amount 0 -> output == input).
struct Params {
    // map
    int   mapType     = MAP_GRADIENT;
    float angleDeg    = 0.f;
    float spacing     = 1.f;     // ramp repeats across frame (0 => uniform -1 field)
    float waveFreq    = 1.f;
    float wavePhase   = 0.f;
    float noiseScale  = 3.f;
    int   noiseDetail = 3;       // fbm octaves (>=1)
    int   noiseSeed   = 1;
    float mapContrast = 0.f;     // -1..1 steepen(+)/flatten(-) the field around 0
    int   mapChannel  = 0;       // 0=luma 1=R 2=G 3=B (MAP_LAYER source)
    // amount
    int   displaceMode= DISP_FIXED;
    float amount      = 0.f;     // pixels
    // flow
    int   flowDir     = FLOW_FORWARD;
    float flowSpeed   = 0.f;     // cycles/sec; 0 => static (flowScalar==1)
    int   loopMode    = LOOP_LOOP;
    int   easing      = EASE_LINEAR;
    float jitter      = 0.f;     // 0..1 seeded per-pixel field noise
    int   jitterSeed  = 1;
    float phase       = 0.f;     // 0..1 base phase
    // output
    int   edgeMode    = EDGE_CLAMP;
    float opacity     = 1.f;     // 0..1 blend warped over source
};

DS_HD inline float ds_clamp(float v,float lo,float hi){ return v<lo?lo:(v>hi?hi:v); }
DS_HD inline float ds_frac(float v){ return v - floorf(v); }
DS_HD inline float lumaRec709(float r,float g,float b){ return 0.2126f*r+0.7152f*g+0.0722f*b; }

// signed contrast remap: steepen (c>0) or flatten (c<0) a field in [-1,1] around 0.
DS_HD inline float ds_remap(float f,float c){
    if (c==0.f) return f;
    float s = f<0.f?-1.f:1.f, a = fabsf(f);
    float k = 1.f + (c>0.f ? c*3.f : c*0.9f);   // exponent strength
    a = powf(a, c>0.f ? 1.f/k : k);
    return s*a;
}

// easing t in [0,1] -> [0,1]
DS_HD inline float ds_ease(int mode,float t){
    t = ds_clamp(t,0.f,1.f);
    switch(mode){
        case EASE_IN:    return t*t;
        case EASE_OUT:   return 1.f-(1.f-t)*(1.f-t);
        case EASE_INOUT: return t*t*(3.f-2.f*t);
        case EASE_SINE:  return 0.5f-0.5f*cosf(3.14159265f*t);
        case EASE_EXP:   return t<=0.f?0.f:(t>=1.f?1.f:powf(2.f,10.f*(t-1.f)));
        default:         return t;
    }
}

// integer hash -> [0,1)
DS_HD inline float ds_hash(int x){
    unsigned int h = (unsigned int)x*374761393u + 668265263u;
    h = (h ^ (h>>13))*1274126177u;
    return ((h ^ (h>>16)) & 0xFFFFFFu) / float(0x1000000);
}

} // namespace distort
```

- [ ] **Step 3: Write `distort-native/tests/distort_tests.cpp`** (harness + first two trivial tests)

```cpp
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
```

> Note: the test file `#include`s `distort_map.h`, `distort_flow.h`, `distort_core.h` now; create empty-but-valid versions in Step 4 so it compiles. They get filled in later tasks.

- [ ] **Step 4: Create minimal valid stubs so the harness compiles**

`distort-native/core/distort_map.h`:
```cpp
#pragma once
#include "distort_params.h"
namespace distort {
// (filled in Task 2)
} // namespace distort
```

`distort-native/core/distort_flow.h`:
```cpp
#pragma once
#include "distort_params.h"
namespace distort {
// (filled in Task 3)
} // namespace distort
```

`distort-native/core/distort_core.h`:
```cpp
#pragma once
#include <vector>
#include "distort_params.h"
namespace distort {
struct Image {
    int w=0,h=0; std::vector<float> px;          // w*h*4 RGBA
    Image(){}
    Image(int W,int H):w(W),h(H),px((size_t)W*H*4,0.f){}
    float* at(int x,int y){ return &px[((size_t)y*w+x)*4]; }
    const float* at(int x,int y) const { return &px[((size_t)y*w+x)*4]; }
};
// (warp/sampleBilinear filled in Tasks 4-5)
} // namespace distort
```

`distort-native/core/distort_core.cpp`:
```cpp
#include "distort_core.h"
namespace distort {
// (filled in Tasks 4-5)
} // namespace distort
```

- [ ] **Step 5: Build and run — verify green**

Run: `distort-native\build-cli.bat`
Expected: prints `OK` (compiles cleanly).
Run: `distort-native\build\distort_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 6: Commit**

```bash
git add distort-native/
git commit -m "feat(distort-native): D1 scaffold — params header, test harness, build script"
```

---

## Task 2: Map generators (`distort_map.h`)

**Files:**
- Modify: `distort-native/core/distort_map.h`
- Test: `distort-native/tests/distort_tests.cpp`

- [ ] **Step 1: Write the failing tests** (add to `distort_tests.cpp`, and call them in `main`)

```cpp
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
```

Add to `main()` (before the PASS print): `test_map_gradient_center_zero(); test_map_gradient_uniform_when_spacing_zero(); test_map_wave_phase_zero_center(); test_map_in_range();`

- [ ] **Step 2: Run to verify it fails**

Run: `distort-native\build-cli.bat`
Expected: FAIL to compile — `mapValue` undefined.

- [ ] **Step 3: Implement `distort_map.h`** (full file)

```cpp
#pragma once
#include "distort_params.h"
namespace distort {

// --- value noise / fbm (host+device safe; no lambdas) ---
DS_HD inline float dm_h2(int a,int b,int seed){
    return ds_hash((a*73856093) ^ (b*19349663) ^ (seed*83492791));
}
DS_HD inline float dm_vnoise(float x,float y,int seed){
    int xi=(int)floorf(x), yi=(int)floorf(y);
    float xf=x-(float)xi, yf=y-(float)yi;
    float v00=dm_h2(xi,yi,seed),   v10=dm_h2(xi+1,yi,seed);
    float v01=dm_h2(xi,yi+1,seed), v11=dm_h2(xi+1,yi+1,seed);
    float u=xf*xf*(3.f-2.f*xf), w=yf*yf*(3.f-2.f*yf);
    float a=v00+(v10-v00)*u, b=v01+(v11-v01)*u;
    return a+(b-a)*w;                              // 0..1
}
DS_HD inline float dm_fbm(float x,float y,int seed,int oct){
    if (oct<1) oct=1;
    float s=0.f, amp=0.5f, f=1.f, norm=0.f;
    for(int i=0;i<oct;i++){ s+=amp*dm_vnoise(x*f,y*f,seed+i); norm+=amp; amp*=0.5f; f*=2.f; }
    return norm>0.f ? s/norm : 0.f;                // 0..1
}

// Signed displacement field in [-1,1] from the generator. u,v are normalized
// centered coords in (-1,1). MAP_LAYER is handled by the caller (needs the layer
// pixels) — this returns 0 for MAP_LAYER.
DS_HD inline float mapValue(const Params& P,float u,float v){
    const float SQRT2=1.41421356f, PI=3.14159265f;
    float th=P.angleDeg*PI/180.f, c=cosf(th), s=sinf(th);
    float f;
    if (P.mapType==MAP_RADIAL){
        float rr=sqrtf(u*u+v*v)/SQRT2;             // 0..1
        f=2.f*ds_frac(rr*P.spacing)-1.f;
    } else if (P.mapType==MAP_WAVE){
        float proj=(u*c+v*s);
        f=sinf(proj*P.waveFreq*PI + P.wavePhase);
    } else if (P.mapType==MAP_NOISE){
        f=2.f*dm_fbm((u*0.5f+0.5f)*P.noiseScale,(v*0.5f+0.5f)*P.noiseScale,P.noiseSeed,P.noiseDetail)-1.f;
    } else if (P.mapType==MAP_LAYER){
        return 0.f;                                // caller substitutes layer luma
    } else { // MAP_GRADIENT
        float proj01=0.5f+0.5f*(u*c+v*s)/SQRT2;    // 0..1
        f=2.f*ds_frac(proj01*P.spacing)-1.f;
    }
    return ds_remap(ds_clamp(f,-1.f,1.f), P.mapContrast);
}

// Unit direction of the field gradient (for DISP_ALONG_GRADIENT), via central diff.
DS_HD inline void mapGradientDir(const Params& P,float u,float v,float& gx,float& gy){
    const float e=0.01f;
    gx=(mapValue(P,u+e,v)-mapValue(P,u-e,v))/(2.f*e);
    gy=(mapValue(P,u,v+e)-mapValue(P,u,v-e))/(2.f*e);
    float L=sqrtf(gx*gx+gy*gy)+1e-6f; gx/=L; gy/=L;
}

} // namespace distort
```

- [ ] **Step 4: Run to verify pass**

Run: `distort-native\build-cli.bat` then `distort-native\build\distort_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add distort-native/core/distort_map.h distort-native/tests/distort_tests.cpp
git commit -m "feat(distort-native): D1 map generators (gradient/radial/wave/fbm) + tests"
```

---

## Task 3: Flow / animation math (`distort_flow.h`)

**Files:**
- Modify: `distort-native/core/distort_flow.h`
- Test: `distort-native/tests/distort_tests.cpp`

- [ ] **Step 1: Write the failing tests** (add + call in `main`)

```cpp
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
```

Add to `main()`: `test_ease_endpoints_monotonic(); test_flow_static_is_one(); test_flow_weight_dir(); test_flow_jitter_deterministic_and_bounded();`

- [ ] **Step 2: Run to verify it fails**

Run: `distort-native\build-cli.bat`
Expected: FAIL to compile — `flowScalar`/`flowWeight`/`flowJitter` undefined.

- [ ] **Step 3: Implement `distort_flow.h`** (full file)

```cpp
#pragma once
#include "distort_params.h"
namespace distort {

// Time-driven modulation in [-1,1]. speed==0 -> 1 (static displacement).
DS_HD inline float flowScalar(const Params& P,float time){
    if (P.flowSpeed==0.f) return 1.f;
    float ph = P.phase + time*P.flowSpeed;          // cycles
    float t;
    if (P.loopMode==LOOP_ONCE)      t = ds_clamp(ph,0.f,1.f);
    else                            t = ds_frac(ph);
    if (P.loopMode==LOOP_PINGPONG)  t = (t<0.5f) ? t*2.f : 2.f-2.f*t;
    float e = ds_ease(P.easing, t);
    return 2.f*e - 1.f;                              // sweep -1..1
}

// Per-pixel directional weight in [-1,1]. u,v normalized centered (-1..1).
DS_HD inline float flowWeight(const Params& P,float u,float v){
    const float SQRT2=1.41421356f;
    float rr=sqrtf(u*u+v*v)/SQRT2;                   // 0..1
    switch(P.flowDir){
        case FLOW_REVERSE:    return -1.f;
        case FLOW_CENTER_OUT: return 2.f*rr-1.f;     // edges +, center -
        case FLOW_EDGES_IN:   return 1.f-2.f*rr;     // center +, edges -
        default:              return 1.f;            // forward
    }
}

// Seeded per-pixel field jitter in [-jitter,jitter].
DS_HD inline float flowJitter(const Params& P,int x,int y){
    if (P.jitter<=0.f) return 0.f;
    float r = ds_hash((x*92837111) ^ (y*689287499) ^ (P.jitterSeed*283923481));
    return (2.f*r-1.f)*P.jitter;
}

} // namespace distort
```

- [ ] **Step 4: Run to verify pass**

Run: `distort-native\build-cli.bat` then `distort-native\build\distort_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add distort-native/core/distort_flow.h distort-native/tests/distort_tests.cpp
git commit -m "feat(distort-native): D1 flow math (easing/scalar/weight/jitter) + tests"
```

---

## Task 4: Bilinear sampler + edge handling (`distort_core`)

**Files:**
- Modify: `distort-native/core/distort_core.h`, `distort-native/core/distort_core.cpp`
- Test: `distort-native/tests/distort_tests.cpp`

- [ ] **Step 1: Write the failing tests** (add + call in `main`)

```cpp
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
```

Add to `main()`: `test_bilinear_integer_exact(); test_bilinear_midpoint_average(); test_edge_clamp_outside(); test_edge_transparent_outside();`

- [ ] **Step 2: Run to verify it fails**

Run: `distort-native\build-cli.bat`
Expected: FAIL to compile — `sampleBilinear` undefined.

- [ ] **Step 3: Add declarations to `distort_core.h`** (replace the `// (warp/...)` comment with)

```cpp
// Map an out-of-range index to a valid one per edge mode (clamp/wrap/mirror).
int edgeIndex(int i,int n,int mode);

// Bilinear RGBA sample at floating (fx,fy). EDGE_TRANSPARENT returns 0000 for
// taps fully outside; clamp/wrap/mirror fold coords back in.
void sampleBilinear(const Image& im,float fx,float fy,int edge,float out[4]);

// Spatial warp: dst(x,y) <- src sampled at (x,y)+displacement(map,flow). mapLayer
// is required only when P.mapType==MAP_LAYER (else pass nullptr). time drives flow.
void warp(const Image& src, Image& dst, const Params& P, const Image* mapLayer, float time=0.f);
```

- [ ] **Step 4: Implement sampler in `distort_core.cpp`** (replace the stub body with)

```cpp
#include "distort_core.h"
#include "distort_map.h"
#include "distort_flow.h"
#include <cmath>

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

// warp() is implemented in Task 5.

} // namespace distort
```

- [ ] **Step 5: Run to verify pass**

> The test file calls `warp` only from Task 5 tests (not added yet), so this builds.

Run: `distort-native\build-cli.bat` then `distort-native\build\distort_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 6: Commit**

```bash
git add distort-native/core/distort_core.h distort-native/core/distort_core.cpp distort-native/tests/distort_tests.cpp
git commit -m "feat(distort-native): D1 bilinear sampler + edge handling + tests"
```

---

## Task 5: The spatial warp (`warp()`)

**Files:**
- Modify: `distort-native/core/distort_core.cpp`
- Test: `distort-native/tests/distort_tests.cpp`

- [ ] **Step 1: Write the failing tests** (add + call in `main`)

```cpp
static Image ramp_x(int w,int h){                     // red channel = x index
    Image im(w,h);
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float* p=im.at(x,y); p[0]=(float)x; p[1]=0;p[2]=0;p[3]=1.f; }
    return im;
}
static void test_warp_identity_when_amount_zero(){
    Image src=ramp_x(8,4), dst(8,4);
    Params P; P.amount=0.f;
    warp(src,dst,P,nullptr,0.f);
    for(size_t i=0;i<src.px.size();++i) NEAR(dst.px[i],src.px[i],1e-4f);
}
static void test_warp_known_shift(){
    // gradient spacing=0 -> field=-1 everywhere; fixed dir angle 0, amount 2
    // dst(x,y) samples src at x + cos0*(-1)*2 = x-2  => dst red == src red at x-2 (clamped)
    Image src=ramp_x(8,1), dst(8,1);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.displaceMode=DISP_FIXED;
    P.angleDeg=0.f; P.amount=2.f; P.edgeMode=EDGE_CLAMP;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(5,0)[0], 3.f, 1e-4f);                 // src x=3
    NEAR(dst.at(1,0)[0], 0.f, 1e-4f);                 // x-2=-1 -> clamp to 0
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
```

Add to `main()`: `test_warp_identity_when_amount_zero(); test_warp_known_shift(); test_warp_opacity_zero_is_source(); test_warp_layer_map_luma();`

- [ ] **Step 2: Run to verify it fails**

Run: `distort-native\build-cli.bat`
Expected: FAIL — `warp` is declared but unimplemented (linker error) / tests fail.

- [ ] **Step 3: Implement `warp()`** — replace the `// warp() is implemented in Task 5.` line in `distort_core.cpp` with:

```cpp
void warp(const Image& src, Image& dst, const Params& P, const Image* mapLayer, float time){
    const float PI=3.14159265f;
    if (dst.w!=src.w || dst.h!=src.h) dst = Image(src.w, src.h);
    float th=P.angleDeg*PI/180.f, ca=cosf(th), sa=sinf(th);
    float modul=flowScalar(P,time);
    for(int y=0;y<src.h;y++){
        for(int x=0;x<src.w;x++){
            float u=((x+0.5f)/src.w)*2.f-1.f;
            float v=((y+0.5f)/src.h)*2.f-1.f;
            // base field: generator, or sampled layer luma/channel for MAP_LAYER
            float field;
            if (P.mapType==MAP_LAYER && mapLayer){
                float mx=((x+0.5f)/src.w)*mapLayer->w-0.5f;
                float my=((y+0.5f)/src.h)*mapLayer->h-0.5f;
                float m[4]; sampleBilinear(*mapLayer,mx,my,EDGE_CLAMP,m);
                float val = (P.mapChannel==1)?m[0]:(P.mapChannel==2)?m[1]:(P.mapChannel==3)?m[2]:lumaRec709(m[0],m[1],m[2]);
                field = ds_remap(ds_clamp(2.f*val-1.f,-1.f,1.f), P.mapContrast);
            } else {
                field = mapValue(P,u,v);
            }
            float ff = ds_clamp(field*flowWeight(P,u,v)*modul + flowJitter(P,x,y), -1.f, 1.f);
            // displacement vector
            float dx,dy;
            if (P.displaceMode==DISP_PUSH_PULL){
                float L=sqrtf(u*u+v*v)+1e-6f; dx=(u/L)*ff*P.amount; dy=(v/L)*ff*P.amount;
            } else if (P.displaceMode==DISP_ALONG_GRADIENT){
                float gx,gy; mapGradientDir(P,u,v,gx,gy); dx=gx*ff*P.amount; dy=gy*ff*P.amount;
            } else {
                dx=ca*ff*P.amount; dy=sa*ff*P.amount;
            }
            float sm[4]; sampleBilinear(src, x+dx, y+dy, P.edgeMode, sm);
            float* o=dst.at(x,y);
            if (P.opacity>=1.f){ o[0]=sm[0];o[1]=sm[1];o[2]=sm[2];o[3]=sm[3]; }
            else { const float* s0=src.at(x,y); for(int k=0;k<4;k++) o[k]=s0[k]+(sm[k]-s0[k])*P.opacity; }
        }
    }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `distort-native\build-cli.bat` then `distort-native\build\distort_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add distort-native/core/distort_core.cpp distort-native/tests/distort_tests.cpp
git commit -m "feat(distort-native): D1 spatial warp (fixed/gradient/push-pull, layer map) + tests"
```

---

## Task 6: CLI harness (`distort_cli.cpp`)

**Files:**
- Create: `distort-native/cli/distort_cli.cpp`

- [ ] **Step 1: Write `distort_cli.cpp`** (full file — mirrors `color-native/cli/color_cli.cpp` style)

```cpp
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include "distort_core.h"
using namespace distort;

static int argMap(const char* s){
    if(!strcmp(s,"gradient"))return MAP_GRADIENT; if(!strcmp(s,"radial"))return MAP_RADIAL;
    if(!strcmp(s,"wave"))return MAP_WAVE; if(!strcmp(s,"noise"))return MAP_NOISE;
    if(!strcmp(s,"layer"))return MAP_LAYER; return MAP_GRADIENT;
}
static int argMode(const char* s){
    if(!strcmp(s,"fixed"))return DISP_FIXED; if(!strcmp(s,"gradient"))return DISP_ALONG_GRADIENT;
    if(!strcmp(s,"pushpull"))return DISP_PUSH_PULL; return DISP_FIXED;
}
static int argEdge(const char* s){
    if(!strcmp(s,"clamp"))return EDGE_CLAMP; if(!strcmp(s,"wrap"))return EDGE_WRAP;
    if(!strcmp(s,"mirror"))return EDGE_MIRROR; if(!strcmp(s,"transparent"))return EDGE_TRANSPARENT; return EDGE_CLAMP;
}

int main(int argc,char**argv){
    if(argc<3){ printf("usage: distort_cli in.png out.png [--map gradient|radial|wave|noise] [--angle d] [--spacing s] [--wave f] [--phase p] [--noise s] [--detail n] [--seed n] [--contrast c] [--mode fixed|gradient|pushpull] [--amount px] [--edge clamp|wrap|mirror|transparent] [--opacity o] [--mapfile m.png] [--channel 0..3] [--time t] [--speed s] [--loop loop|pingpong|once] [--ease 1..6] [--flowdir 1..4] [--jitter j]\n"); return 1; }
    const char* inP=argv[1]; const char* outP=argv[2];
    Params P; const char* mapFile=nullptr; float time=0.f;
    for(int i=3;i<argc;i++){
        const char* a=argv[i]; const char* n=(i+1<argc)?argv[i+1]:"0";
        if(!strcmp(a,"--map")){P.mapType=argMap(n);i++;}
        else if(!strcmp(a,"--angle")){P.angleDeg=(float)atof(n);i++;}
        else if(!strcmp(a,"--spacing")){P.spacing=(float)atof(n);i++;}
        else if(!strcmp(a,"--wave")){P.waveFreq=(float)atof(n);i++;}
        else if(!strcmp(a,"--phase")){P.wavePhase=(float)atof(n);i++;}
        else if(!strcmp(a,"--noise")){P.noiseScale=(float)atof(n);i++;}
        else if(!strcmp(a,"--detail")){P.noiseDetail=atoi(n);i++;}
        else if(!strcmp(a,"--seed")){P.noiseSeed=atoi(n);i++;}
        else if(!strcmp(a,"--contrast")){P.mapContrast=(float)atof(n);i++;}
        else if(!strcmp(a,"--mode")){P.displaceMode=argMode(n);i++;}
        else if(!strcmp(a,"--amount")){P.amount=(float)atof(n);i++;}
        else if(!strcmp(a,"--edge")){P.edgeMode=argEdge(n);i++;}
        else if(!strcmp(a,"--opacity")){P.opacity=(float)atof(n);i++;}
        else if(!strcmp(a,"--mapfile")){mapFile=n;P.mapType=MAP_LAYER;i++;}
        else if(!strcmp(a,"--channel")){P.mapChannel=atoi(n);i++;}
        else if(!strcmp(a,"--time")){time=(float)atof(n);i++;}
        else if(!strcmp(a,"--speed")){P.flowSpeed=(float)atof(n);i++;}
        else if(!strcmp(a,"--loop")){ P.loopMode=!strcmp(n,"pingpong")?LOOP_PINGPONG:(!strcmp(n,"once")?LOOP_ONCE:LOOP_LOOP); i++; }
        else if(!strcmp(a,"--ease")){P.easing=atoi(n);i++;}
        else if(!strcmp(a,"--flowdir")){P.flowDir=atoi(n);i++;}
        else if(!strcmp(a,"--jitter")){P.jitter=(float)atof(n);i++;}
    }
    int w,h,c; unsigned char* img=stbi_load(inP,&w,&h,&c,4);
    if(!img){ printf("[!] cannot load %s\n",inP); return 1; }
    Image src(w,h);
    for(int i=0;i<w*h*4;i++) src.px[i]=img[i]/255.f;
    stbi_image_free(img);

    Image mapImg; Image* mapPtr=nullptr;
    if(mapFile){
        int mw,mh,mc; unsigned char* m=stbi_load(mapFile,&mw,&mh,&mc,4);
        if(!m){ printf("[!] cannot load mapfile %s\n",mapFile); return 1; }
        mapImg=Image(mw,mh); for(int i=0;i<mw*mh*4;i++) mapImg.px[i]=m[i]/255.f; stbi_image_free(m);
        mapPtr=&mapImg;
    }
    Image dst(w,h);
    warp(src,dst,P,mapPtr,time);

    std::vector<unsigned char> out((size_t)w*h*4);
    for(size_t i=0;i<out.size();i++){ float v=dst.px[i]*255.f+0.5f; out[i]=(unsigned char)(v<0?0:(v>255?255:v)); }
    if(!stbi_write_png(outP,w,h,4,out.data(),w*4)){ printf("[!] cannot write %s\n",outP); return 1; }
    printf("wrote %s (%dx%d)\n",outP,w,h);
    return 0;
}
```

- [ ] **Step 2: Build**

Run: `distort-native\build-cli.bat`
Expected: `OK` (both `distort_tests.exe` and `distort_cli.exe` build).

- [ ] **Step 3: Smoke-test the CLI on a real image**

Run (use any PNG you have, e.g. one under `test/`):
```
distort-native\build\distort_cli.exe test\some.png distort-native\build\out_wave.png --map wave --angle 30 --wave 6 --amount 40
```
Expected: prints `wrote ... (WxH)`; open `out_wave.png` and confirm a visible wavy spatial distortion. Also try `--map gradient --spacing 12 --amount 30` (slit-scan stripes) and `--map noise --amount 25`.

- [ ] **Step 4: Commit**

```bash
git add distort-native/cli/distort_cli.cpp
git commit -m "feat(distort-native): D1 distort_cli PNG-in/out harness"
```

---

## Task 7: README + final verification

**Files:**
- Create: `distort-native/README.md`
- Modify: `PROJECT_MAP.md` (add a one-line pointer to the new engine)

- [ ] **Step 1: Write `distort-native/README.md`**

```markdown
# distort-native/ — native Distort/Flow engine (TimeSlice + map-driven warp)

Compiled distortion engine for the AE suite
(spec: `docs/superpowers/specs/2026-06-11-native-distort-flow-design.md`).
Mirrors `color-native/` / `glow-native/`. **D1 = CPU core + CLI + tests (spatial only; no AE).**

- `core/`  portable C++: `distort_params.h` (params + shared math), `distort_map.h`
  (gradient/radial/wave/fbm generators), `distort_flow.h` (easing/scalar/weight/jitter),
  `distort_core.{h,cpp}` (Image + bilinear + `warp()`).
- `cli/`   `distort_cli` — PNG-in/PNG-out harness (stb).
- `tests/` `distort_tests` — map/flow/bilinear/warp acceptance tests.

## Build & run (Windows; VS dev env located via vswhere)
```
distort-native\build-cli.bat
distort-native\build\distort_tests.exe                 REM -> "ALL PASS"
distort-native\build\distort_cli.exe in.png out.png --map wave --angle 30 --wave 6 --amount 40
```

Status: **D1 DONE** — spatial map-driven warp (gradient/radial/wave/noise + use-a-layer),
fixed/along-gradient/push-pull displace modes, flow modulation (easing/direction/loop/jitter),
clamp/wrap/mirror/transparent edges. **Next: D2 CUDA mirror + parity, then D3 AE `.aex` + panel.**
Temporal TimeSlice (multi-frame) is D4.
```

- [ ] **Step 2: Add the pointer in `PROJECT_MAP.md`**

In the "Where is…?" table, add a row (near the Color Lab engine rows):
```
| The **Distort/Flow engine source** (map-driven warp + TimeSlice math) | `distort-native/core/` (CPU) — D1 spatial; CUDA/AE/temporal are later phases |
```

- [ ] **Step 3: Full clean build + test**

Run: `distort-native\build-cli.bat`
Expected: `OK`
Run: `distort-native\build\distort_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**

```bash
git add distort-native/README.md PROJECT_MAP.md
git commit -m "docs(distort-native): D1 README + PROJECT_MAP pointer; D1 complete"
```

---

## Self-Review (completed during planning)

**Spec coverage (D1 portion of the spec):**
- Map generators gradient/radial/wave/fractal-noise → Task 2 ✓
- Map from selected layer (luma/R/G/B) → Task 5 `test_warp_layer_map_luma` + warp() MAP_LAYER branch ✓
- Map contrast remap → `ds_remap` (params.h) applied in map + layer paths ✓
- Spatial displace modes (along-gradient/fixed/push-pull) → Task 5 ✓
- Flow direction/speed/loop/easing/jitter/phase → Task 3 + applied in warp() ✓
- Edge handling clamp/wrap/mirror/transparent → Task 4 ✓
- Output opacity blend → Task 5 `test_warp_opacity_zero_is_source` ✓
- CLI harness → Task 6 ✓
- **Deferred to later phases (correctly out of D1):** TimeSlice temporal sampler (D4), CUDA parity (D2), AE shell + panel params/Mode dropdown (D3), presets (D5).

**Placeholder scan:** none — every step has full code/commands.

**Type consistency:** `Params`, `Image`, `mapValue`, `mapGradientDir`, `flowScalar`,
`flowWeight`, `flowJitter`, `edgeIndex`, `sampleBilinear(im,fx,fy,edge,out[4])`,
`warp(src,dst,P,mapLayer,time)` are spelled identically across header, core.cpp, tests,
and cli. Enum names (`MAP_*`, `DISP_*`, `FLOW_*`, `LOOP_*`, `EASE_*`, `EDGE_*`) are
consistent throughout.
```

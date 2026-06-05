# Native GPU Deep Glow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compiled, GPU-accelerated cinematic-bloom After Effects effect (`.aex`) that does its own image math, looks like a real soft glow (not a box), and ships a CPU fallback faithful to the GPU path.

**Architecture:** A pure-C++ `core/` bloom library (mip-pyramid: threshold → downsample chain → weighted upsample → tonemap → composite) with zero AE/CUDA deps. A standalone `glow_cli` PNG-in/PNG-out runner and property-based tests validate the look (acceptance criteria AC1–AC4) without AE. The AE `.aex` calls `core/` for its CPU path; CUDA kernels mirror `core/` for the GPU path and are checked for parity against it.

**Tech Stack:** C++17, CUDA 13.3 (`sm_89`), After Effects 2025 SDK (25.6), VS2022/MSVC, CMake. PiPL min-version = AE 2024. Vendored `stb_image` for PNG I/O in the harness only.

**Spec:** `docs/superpowers/specs/2026-06-05-native-glow-gpu-design.md`

---

## File structure

```
glow-native/
  CMakeLists.txt                # builds: glow_core (lib), glow_cli (exe), glow_tests (exe). AE .aex built by ae/ vcxproj (M0).
  core/
    glow_params.h               # Params POD + enums + levelWeight() (shared host/CUDA/CPU). No deps.
    glow_core.h                 # Image struct + engine API. STL only.
    glow_core.cpp               # CPU engine: extractBright, downsampleHalf, upsampleAdd, tonemap, composite, bloom()
  cli/
    glow_cli.cpp                # PNG in -> Params -> bloom() -> PNG out
    stb_image.h                 # vendored (public domain), harness/tests only
    stb_image_write.h           # vendored (public domain), harness/tests only
  tests/
    glow_tests.cpp              # tiny CHECK runner + AC1..AC4 property tests (fixtures generated in code)
  ae/
    DeepGlowGPU.h               # AE param enum + GlowParams<->core::Params bridge
    DeepGlowGPU.cpp             # AE entry: dispatch, ParamsSetup, pre-render, GPU+CPU render
    DeepGlowGPU.cu              # CUDA kernels mirroring core/
    DeepGlowGPUPiPL.h           # PiPL numeric codes
    DeepGlowGPU.r               # PiPL resource (min version AE 2024)
    DeepGlowGPU.vcxproj / .sln  # VS2022 project copied from SDK SDK_Invert_ProcAmp
  README.md                     # (exists) update build steps
```

The existing scaffold files (`glow-native/DeepGlowGPU.{h,cpp,cu}`, first sketch) are superseded: their math moves into `core/`, their AE shell moves into `ae/`. Delete the root-level scaffold copies in Task 1.

---

## Milestone M1 first (the testable core), then M0 (loads in AE), then M2 (CUDA), then M3 (cinematic params)

> We build the pure-C++ core FIRST because it is the part we can prove correct in isolation (it directly addresses last attempt's boxy-halo + inverted-threshold bug). M0 (SDK/PiPL/build wiring) is sequenced after so the first AE load already has a real engine behind it.

---

## Task 1: Project skeleton + CMake + vendored PNG I/O

**Files:**
- Create: `glow-native/CMakeLists.txt`
- Create: `glow-native/cli/stb_image.h`, `glow-native/cli/stb_image_write.h` (download vendored)
- Move: `glow-native/DeepGlowGPU.{h,cpp,cu}` → `glow-native/ae/` (the first-sketch AE shell + kernels become the starting point for the `ae/` plugin in M0/M2; the math is re-homed into `core/`)

- [ ] **Step 1: Move the scaffold into `ae/`** (keep the AE dispatch/ParamsSetup/kernels as a base, don't throw them away)

```bash
mkdir -p glow-native/ae
git mv glow-native/DeepGlowGPU.h   glow-native/ae/DeepGlowGPU.h
git mv glow-native/DeepGlowGPU.cpp glow-native/ae/DeepGlowGPU.cpp
git mv glow-native/DeepGlowGPU.cu  glow-native/ae/DeepGlowGPU.cu
```
Note: `ae/DeepGlowGPU.h`'s old `GlowParams` POD is superseded by `core::Params`; in Task 10 it's repurposed to hold only the AE param enum + the `ReadParams → core::Params` bridge.

- [ ] **Step 2: Vendor stb single-header libs** (public domain PNG load/write)

Download into `glow-native/cli/`:
```bash
curl -L https://raw.githubusercontent.com/nothings/stb/master/stb_image.h        -o glow-native/cli/stb_image.h
curl -L https://raw.githubusercontent.com/nothings/stb/master/stb_image_write.h  -o glow-native/cli/stb_image_write.h
```
Expected: two files, each > 100 KB.

- [ ] **Step 3: Write the top-level CMakeLists** (core lib + cli + tests; AE plugin is a separate vcxproj added in M0)

```cmake
cmake_minimum_required(VERSION 3.20)
project(glow_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Pure-C++ bloom engine — no AE, no CUDA.
add_library(glow_core STATIC core/glow_core.cpp)
target_include_directories(glow_core PUBLIC core)

# PNG-in/PNG-out harness.
add_executable(glow_cli cli/glow_cli.cpp)
target_link_libraries(glow_cli PRIVATE glow_core)
target_include_directories(glow_cli PRIVATE cli)

# Property-based acceptance tests.
add_executable(glow_tests tests/glow_tests.cpp)
target_link_libraries(glow_tests PRIVATE glow_core)

enable_testing()
add_test(NAME glow_tests COMMAND glow_tests)
```

- [ ] **Step 4: Commit**

```bash
git add glow-native/CMakeLists.txt glow-native/cli/stb_image.h glow-native/cli/stb_image_write.h
git commit -m "build(glow-native): cmake skeleton + vendored stb PNG I/O; drop first-sketch scaffold"
```

---

## Task 2: Shared params + level weights (`core/glow_params.h`)

**Files:**
- Create: `glow-native/core/glow_params.h`
- Test: covered by Task 8 (levelWeight asserted there)

- [ ] **Step 1: Write the params header** (POD + enums + the falloff→level weight, reusing the `jsx/glow.jsx` `_glowPassScale` semantics so the native look matches the ExtendScript intent)

```cpp
#pragma once
#include <cmath>

namespace glow {

enum Falloff   { FALLOFF_LINEAR = 1, FALLOFF_SOFT = 2, FALLOFF_EXP = 3 };
enum BlendOp   { BLEND_ADD = 1, BLEND_SCREEN = 2 };
enum Dimensions{ DIM_BOTH = 1, DIM_HORIZONTAL = 2, DIM_VERTICAL = 3 };
enum Tonemap   { TONE_NONE = 1, TONE_SOFTCLIP = 2, TONE_FILMIC = 3 };

// Normalized parameters (UI ranges converted by the caller; see DeepGlowGPU.h bridge).
struct Params {
    float intensity     = 1.5f;          // 150% / 100
    float radius        = 60.0f;         // px
    float threshold     = 80.0f / 255.f; // 0..1 luma compare (UI 0..255 / 255)
    float thresholdSoft = 20.0f / 100.f; // 0..1 knee width below threshold
    float sourceGain    = 1.0f;          // 0..4
    float glowR = 1.f, glowG = 1.f, glowB = 1.f; // tint 0..1
    bool  colorize      = false;
    float saturation    = 0.0f;          // -1..1
    float hueShift      = 0.0f;          // radians
    int   levels        = 0;             // mip levels; 0 = auto from radius (was "Passes")
    int   falloff       = FALLOFF_SOFT;
    int   blendOp       = BLEND_SCREEN;
    int   dimensions    = DIM_BOTH;
    bool  glowOnly      = false;
    bool  linearLight   = true;
    int   tonemap       = TONE_SOFTCLIP;
    float highlightComp = 0.5f;          // 0..1 tonemap knee strength
};

// Weight applied to mip LEVEL l (0 = finest) when accumulating the upsample.
// Mirrors _glowPassScale() in jsx/glow.jsx: level 0 -> 1.0.
inline float levelWeight(int l, int levels, int falloff) {
    if (levels < 1) levels = 1;
    if (falloff == FALLOFF_LINEAR) {
        float denom = (levels - 1) > 1 ? float(levels - 1) : 1.0f;
        float v = 1.0f - (float(l) / denom) * 0.9f;
        return v < 0.05f ? 0.05f : v;
    }
    if (falloff == FALLOFF_EXP) {
        float v = 1.0f;
        for (int i = 0; i < l; ++i) v *= 0.45f;
        return v;
    }
    return 1.0f / std::sqrt(float(l + 1)); // SOFT (default)
}

// Number of mip levels to build for an image of min-dimension `minDim`.
// radius -> how many halvings reach that spread; capped by image size and 10.
inline int autoLevels(float radius, int minDim) {
    int byRadius = int(std::ceil(std::log2(radius > 2.f ? radius : 2.f))); // e.g. 60->6, 300->9
    int byImage  = int(std::floor(std::log2(minDim > 2 ? minDim : 2))) - 1;
    int n = byRadius < byImage ? byRadius : byImage;
    if (n < 1)  n = 1;
    if (n > 10) n = 10;
    return n;
}

} // namespace glow
```

- [ ] **Step 2: Commit**

```bash
git add glow-native/core/glow_params.h
git commit -m "feat(core): shared Params POD + falloff level weights (jsx parity)"
```

---

## Task 3: Image type + bilinear sampling (`core/glow_core.h`)

**Files:**
- Create: `glow-native/core/glow_core.h`

- [ ] **Step 1: Write the engine API header**

```cpp
#pragma once
#include <vector>
#include <cstddef>
#include "glow_params.h"

namespace glow {

// RGBA interleaved, linear float, row-major.
struct Image {
    int w = 0, h = 0;
    std::vector<float> px;               // size w*h*4
    Image() = default;
    Image(int W, int H) : w(W), h(H), px(size_t(W) * H * 4, 0.0f) {}
    float*       at(int x, int y)       { return &px[(size_t(y) * w + x) * 4]; }
    const float* at(int x, int y) const { return &px[(size_t(y) * w + x) * 4]; }
};

float luma(float r, float g, float b);                 // Rec.709
void  sampleBilinear(const Image& s, float u, float v, float out[4]); // u,v in pixel space, clamp-to-edge

Image extractBright(const Image& src, const Params& p);          // threshold/knee*gain -> bright buffer
Image downsampleHalf(const Image& src);                          // 13-tap -> ceil(w/2) x ceil(h/2)
void  upsampleAdd(const Image& low, Image& hi, float weight, int dimensions); // 9-tap tent, hi += w*up(low)
Image bloom(const Image& src, const Params& p);                  // full pipeline -> composited output

} // namespace glow
```

- [ ] **Step 2: Commit**

```bash
git add glow-native/core/glow_core.h
git commit -m "feat(core): Image type + engine API surface"
```

---

## Task 4: `luma` + `sampleBilinear` (first real code + first test)

**Files:**
- Create: `glow-native/core/glow_core.cpp`
- Create: `glow-native/tests/glow_tests.cpp`

- [ ] **Step 1: Write the failing test** (`tests/glow_tests.cpp` — minimal runner + first checks)

```cpp
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
    sampleBilinear(im, 0.5f, 0.0f, o);   // halfway between x=0 and x=1
    NEAR(o[0], 0.5f, 1e-5f);
}

int main() {
    test_luma();
    test_bilinear_center();
    if (g_fail) { printf("%d CHECK(s) failed\n", g_fail); return 1; }
    printf("ALL TESTS PASSED\n"); return 0;
}
```

- [ ] **Step 2: Configure + build + run, verify it FAILS to link** (functions undefined)

Run (from a VS2022 "x64 Native Tools" prompt, repo root):
```bash
cmake -S glow-native -B glow-native/build -G "Visual Studio 17 2022" -A x64
cmake --build glow-native/build --config Debug --target glow_tests
```
Expected: link error `unresolved external symbol ... luma` / `sampleBilinear`.

- [ ] **Step 3: Implement `luma` + `sampleBilinear`** (start `core/glow_core.cpp`)

```cpp
#include "glow_core.h"
#include <algorithm>
#include <cmath>

namespace glow {

float luma(float r, float g, float b) { return 0.2126f*r + 0.7152f*g + 0.0722f*b; }

static inline int clampi(int v, int lo, int hi){ return v<lo?lo:(v>hi?hi:v); }

void sampleBilinear(const Image& s, float u, float v, float out[4]) {
    if (s.w<=0 || s.h<=0){ out[0]=out[1]=out[2]=out[3]=0; return; }
    float fx = u - 0.5f, fy = v - 0.5f;
    int x0 = (int)std::floor(fx), y0 = (int)std::floor(fy);
    float tx = fx - x0, ty = fy - y0;
    int x1=x0+1, y1=y0+1;
    x0=clampi(x0,0,s.w-1); x1=clampi(x1,0,s.w-1);
    y0=clampi(y0,0,s.h-1); y1=clampi(y1,0,s.h-1);
    const float* p00=s.at(x0,y0); const float* p10=s.at(x1,y0);
    const float* p01=s.at(x0,y1); const float* p11=s.at(x1,y1);
    for (int c=0;c<4;++c){
        float a = p00[c]*(1-tx)+p10[c]*tx;
        float b = p01[c]*(1-tx)+p11[c]*tx;
        out[c]  = a*(1-ty)+b*ty;
    }
}

} // namespace glow
```

- [ ] **Step 4: Rebuild + run, verify PASS**

```bash
cmake --build glow-native/build --config Debug --target glow_tests
glow-native/build/Debug/glow_tests.exe
```
Expected: `ALL TESTS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add glow-native/core/glow_core.cpp glow-native/tests/glow_tests.cpp
git commit -m "feat(core): luma + bilinear sampling, with tests"
```

---

## Task 5: `extractBright` + AC1 (threshold direction/units)

**Files:**
- Modify: `glow-native/core/glow_core.cpp`
- Modify: `glow-native/tests/glow_tests.cpp`

- [ ] **Step 1: Write the failing test** (AC1 — low threshold on a white square produces strong extraction; raising threshold reduces it)

Add to `tests/glow_tests.cpp` (and call from `main`):
```cpp
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

static void test_AC1_threshold_direction() {
    Image src = whiteSquare(64,64,16);
    Params lo; lo.threshold = 0.10f; lo.thresholdSoft = 0.0f; lo.sourceGain = 1.f;
    Params hi = lo; hi.threshold = 0.90f;
    Image elo = extractBright(src, lo);
    Image ehi = extractBright(src, hi);
    CHECK(energy(elo) > 200.0f);            // white square (luma 1.0) clearly passes at 10%
    CHECK(energy(elo) > energy(ehi));       // lower threshold => more extracted (NOT inverted)
}
```

- [ ] **Step 2: Build + run, verify FAIL** (link error: `extractBright` undefined)

```bash
cmake --build glow-native/build --config Debug --target glow_tests
```
Expected: unresolved external `extractBright`.

- [ ] **Step 3: Implement `extractBright`**

Add to `core/glow_core.cpp`:
```cpp
static inline float smoothstep(float e0, float e1, float x){
    float t = (x - e0) / (e1 - e0 + 1e-6f);
    t = t<0?0:(t>1?1:t);
    return t*t*(3.0f - 2.0f*t);
}

Image extractBright(const Image& src, const Params& p) {
    Image out(src.w, src.h);
    float lo = p.threshold - p.thresholdSoft;   // knee start
    float hi = p.threshold;                      // full pass at/above
    for (int y=0;y<src.h;++y) for (int x=0;x<src.w;++x){
        const float* s = src.at(x,y);
        float l = luma(s[0],s[1],s[2]);
        float m = (lo >= hi) ? (l >= hi ? 1.f : 0.f) : smoothstep(lo, hi, l);
        float* o = out.at(x,y);
        o[0]=s[0]*m*p.sourceGain; o[1]=s[1]*m*p.sourceGain; o[2]=s[2]*m*p.sourceGain; o[3]=m;
    }
    return out;
}
```

- [ ] **Step 4: Build + run, verify PASS**

```bash
cmake --build glow-native/build --config Debug --target glow_tests
glow-native/build/Debug/glow_tests.exe
```
Expected: `ALL TESTS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add glow-native/core/glow_core.cpp glow-native/tests/glow_tests.cpp
git commit -m "feat(core): extractBright with soft knee; AC1 threshold-direction test"
```

---

## Task 6: `downsampleHalf` + `upsampleAdd` (the pyramid filters)

**Files:**
- Modify: `glow-native/core/glow_core.cpp`
- Modify: `glow-native/tests/glow_tests.cpp`

- [ ] **Step 1: Write the failing tests** (downsample halves dims and conserves rough energy; upsample adds weighted, larger-support content)

```cpp
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
```

- [ ] **Step 2: Build + run, verify FAIL** (unresolved `downsampleHalf` / `upsampleAdd`).

```bash
cmake --build glow-native/build --config Debug --target glow_tests
```

- [ ] **Step 3: Implement both filters** (13-tap downsample, 9-tap tent upsample; anamorphic squashes one axis of the upsample tent)

Add to `core/glow_core.cpp`:
```cpp
Image downsampleHalf(const Image& s) {
    int w = (s.w+1)/2, h = (s.h+1)/2;
    Image d(w,h);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        // sample source at the center of this dest texel, in source pixel coords
        float cx = (x+0.5f)*2.0f, cy = (y+0.5f)*2.0f;
        float acc[4]={0,0,0,0};
        // 13-tap weights (Jimenez/CoD): center group + ring; normalized below.
        const float o = 1.0f; // one source pixel
        struct T{float dx,dy,w;};
        const T taps[13]={
            {-2,-2,0.03125f},{0,-2,0.0625f},{2,-2,0.03125f},
            {-1,-1,0.125f},{1,-1,0.125f},
            {-2,0,0.0625f},{0,0,0.125f},{2,0,0.0625f},
            {-1,1,0.125f},{1,1,0.125f},
            {-2,2,0.03125f},{0,2,0.0625f},{2,2,0.03125f}
        };
        float wsum=0; float t[4];
        for (const T& tp: taps){ sampleBilinear(s, cx+tp.dx*o, cy+tp.dy*o, t);
            acc[0]+=t[0]*tp.w; acc[1]+=t[1]*tp.w; acc[2]+=t[2]*tp.w; acc[3]+=t[3]*tp.w; wsum+=tp.w; }
        float inv = wsum>0?1.0f/wsum:0.0f;
        float* dd=d.at(x,y); dd[0]=acc[0]*inv; dd[1]=acc[1]*inv; dd[2]=acc[2]*inv; dd[3]=acc[3]*inv;
    }
    return d;
}

void upsampleAdd(const Image& low, Image& hi, float weight, int dimensions) {
    float sx = (dimensions==DIM_VERTICAL)   ? 0.0f : 1.0f;  // anamorphic: kill horizontal spread
    float sy = (dimensions==DIM_HORIZONTAL) ? 0.0f : 1.0f;  // kill vertical spread
    for (int y=0;y<hi.h;++y) for (int x=0;x<hi.w;++x){
        // map hi texel center into low-res pixel coords
        float lx = (x+0.5f) * (float)low.w / (float)hi.w;
        float ly = (y+0.5f) * (float)low.h / (float)hi.h;
        // 9-tap tent (offsets in low-res pixels), squashed per anamorphic axis
        const float c=4.f/16, e=2.f/16, k=1.f/16;
        struct T{float dx,dy,w;};
        const T taps[9]={{-1,-1,k},{0,-1,e},{1,-1,k},{-1,0,e},{0,0,c},{1,0,e},{-1,1,k},{0,1,e},{1,1,k}};
        float acc[4]={0,0,0,0}, t[4];
        for (const T& tp: taps){ sampleBilinear(low, lx+tp.dx*sx, ly+tp.dy*sy, t);
            acc[0]+=t[0]*tp.w; acc[1]+=t[1]*tp.w; acc[2]+=t[2]*tp.w; acc[3]+=t[3]*tp.w; }
        float* hh=hi.at(x,y);
        hh[0]+=acc[0]*weight; hh[1]+=acc[1]*weight; hh[2]+=acc[2]*weight; hh[3]+=acc[3]*weight;
    }
}
```

- [ ] **Step 4: Build + run, verify PASS**

```bash
cmake --build glow-native/build --config Debug --target glow_tests
glow-native/build/Debug/glow_tests.exe
```

- [ ] **Step 5: Commit**

```bash
git add glow-native/core/glow_core.cpp glow-native/tests/glow_tests.cpp
git commit -m "feat(core): mip-pyramid downsample(13-tap)+upsample(9-tap tent), anamorphic-aware"
```

---

## Task 7: `bloom()` pipeline + AC2 (soft round falloff) + AC3 (source preserved)

**Files:**
- Modify: `glow-native/core/glow_core.cpp`
- Modify: `glow-native/tests/glow_tests.cpp`

- [ ] **Step 1: Write the failing tests** (AC2: radial profile from a square edge is monotonic non-increasing and smooth — NO box; AC3: composited interior stays >= source)

```cpp
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
```

- [ ] **Step 2: Build + run, verify FAIL** (unresolved `bloom`).

- [ ] **Step 3: Implement `bloom()`** (extract → build mip chain → weighted upsample accumulate → tint/sat → tonemap → composite; linear-light optional)

Add to `core/glow_core.cpp`:
```cpp
#include <vector>

static inline float srgb_to_lin(float c){ return c<=0.04045f? c/12.92f : std::pow((c+0.055f)/1.055f,2.4f); }
static inline float lin_to_srgb(float c){ return c<=0.0031308f? c*12.92f : 1.055f*std::pow(c,1.0f/2.4f)-0.055f; }
static inline float clampf(float v,float lo,float hi){ return v<lo?lo:(v>hi?hi:v); }

static void applyTint(float& r,float& g,float& b,const Params& p){
    if (p.colorize){ float l=luma(r,g,b); r=l*p.glowR; g=l*p.glowG; b=l*p.glowB; }
    else           { r*=p.glowR; g*=p.glowG; b*=p.glowB; }
    if (p.saturation!=0.f){ float l=luma(r,g,b);
        r=l+(r-l)*(1.f+p.saturation); g=l+(g-l)*(1.f+p.saturation); b=l+(b-l)*(1.f+p.saturation); }
}
static inline float tonemap1(float x,const Params& p){
    if (p.tonemap==TONE_NONE) return x;
    if (p.tonemap==TONE_SOFTCLIP){ float k=0.2f+1.8f*(1.f-p.highlightComp); return x/(x+k)*(1.f+k); }
    // Filmic (Reinhard-extended)
    float w=4.0f; return (x*(1.f+x/(w*w)))/(1.f+x);
}

Image bloom(const Image& src, const Params& p) {
    // 0. optional linearize
    Image lin = src;
    if (p.linearLight) for (size_t i=0;i<lin.px.size();i+=4){
        lin.px[i]=srgb_to_lin(lin.px[i]); lin.px[i+1]=srgb_to_lin(lin.px[i+1]); lin.px[i+2]=srgb_to_lin(lin.px[i+2]); }

    // 1. extract bright source
    Image bright = extractBright(lin, p);

    // 2. build mip chain
    int minDim = src.w<src.h?src.w:src.h;
    int levels = p.levels>0 ? p.levels : autoLevels(p.radius, minDim);
    std::vector<Image> mips; mips.reserve(levels);
    mips.push_back(downsampleHalf(bright));
    for (int l=1;l<levels;++l){
        if (mips.back().w<2 || mips.back().h<2) break;
        mips.push_back(downsampleHalf(mips.back()));
    }

    // 3. accumulate upsample at full res, weighted by falloff per level
    Image glow(src.w, src.h);
    int n = (int)mips.size();
    for (int l=0;l<n;++l) upsampleAdd(mips[l], glow, levelWeight(l,n,p.falloff), p.dimensions);

    // 4. per-pixel tint, intensity, tonemap, composite
    Image out(src.w, src.h);
    for (int y=0;y<src.h;++y) for (int x=0;x<src.w;++x){
        const float* s = lin.at(x,y);
        float gr=glow.at(x,y)[0], gg=glow.at(x,y)[1], gb=glow.at(x,y)[2];
        applyTint(gr,gg,gb,p);
        gr*=p.intensity; gg*=p.intensity; gb*=p.intensity;
        gr=tonemap1(gr,p); gg=tonemap1(gg,p); gb=tonemap1(gb,p);
        float r,g,b;
        if (p.glowOnly){ r=gr; g=gg; b=gb; }
        else if (p.blendOp==BLEND_SCREEN){
            r=1.f-(1.f-s[0])*(1.f-clampf(gr,0,1)); g=1.f-(1.f-s[1])*(1.f-clampf(gg,0,1)); b=1.f-(1.f-s[2])*(1.f-clampf(gb,0,1));
        } else { r=s[0]+gr; g=s[1]+gg; b=s[2]+gb; }
        float* o=out.at(x,y);
        o[0]=r; o[1]=g; o[2]=b; o[3]=p.glowOnly? clampf(glow.at(x,y)[3],0,1) : s[3];
    }

    // 5. optional de-linearize
    if (p.linearLight) for (size_t i=0;i<out.px.size();i+=4){
        out.px[i]=lin_to_srgb(out.px[i]); out.px[i+1]=lin_to_srgb(out.px[i+1]); out.px[i+2]=lin_to_srgb(out.px[i+2]); }
    return out;
}
```

- [ ] **Step 4: Build + run, verify PASS** (all AC1–AC3 property tests green)

```bash
cmake --build glow-native/build --config Debug --target glow_tests
glow-native/build/Debug/glow_tests.exe
```
Expected: `ALL TESTS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add glow-native/core/glow_core.cpp glow-native/tests/glow_tests.cpp
git commit -m "feat(core): bloom() pipeline (linear+tonemap+composite); AC2 soft-falloff + AC3 source-preserved tests"
```

---

## Task 8: CLI harness `glow_cli` (eyeball the look on real PNGs)

**Files:**
- Create: `glow-native/cli/glow_cli.cpp`

- [ ] **Step 1: Write the harness** (load PNG → 0..1 float RGBA → `bloom()` → write PNG; flags for the main params)

```cpp
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include "glow_core.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
using namespace glow;

int main(int argc, char** argv){
    if (argc < 3){ printf("usage: glow_cli in.png out.png [--threshold 0..255] [--radius px] [--intensity %%] [--glowonly]\n"); return 2; }
    Params p;
    for (int i=3;i<argc;++i){
        if(!strcmp(argv[i],"--threshold")&&i+1<argc) p.threshold=(float)atof(argv[++i])/255.f;
        else if(!strcmp(argv[i],"--radius")&&i+1<argc) p.radius=(float)atof(argv[++i]);
        else if(!strcmp(argv[i],"--intensity")&&i+1<argc) p.intensity=(float)atof(argv[++i])/100.f;
        else if(!strcmp(argv[i],"--glowonly")) p.glowOnly=true;
    }
    int w,h,n; unsigned char* data = stbi_load(argv[1], &w,&h,&n, 4);
    if(!data){ printf("could not load %s\n", argv[1]); return 1; }
    Image src(w,h);
    for (int i=0;i<w*h*4;++i) src.px[i] = data[i]/255.f;
    stbi_image_free(data);

    Image out = bloom(src, p);
    std::vector<unsigned char> o((size_t)w*h*4);
    for (size_t i=0;i<o.size();++i){ float v=out.px[i]; v=v<0?0:(v>1?1:v); o[i]=(unsigned char)(v*255.f+0.5f); }
    if(!stbi_write_png(argv[2], w,h,4,o.data(), w*4)){ printf("could not write %s\n",argv[2]); return 1; }
    printf("wrote %s (%dx%d)\n", argv[2], w,h);
    return 0;
}
```

- [ ] **Step 2: Build the CLI**

```bash
cmake --build glow-native/build --config Debug --target glow_cli
```
Expected: builds `glow-native/build/Debug/glow_cli.exe`.

- [ ] **Step 3: Manual smoke — reproduce last attempt's bug case and confirm it's a real glow now**

Create a quick white-square PNG with the CLI's own fixture or any bright-on-dark image, then:
```bash
glow-native/build/Debug/glow_cli.exe square.png out_glow.png --threshold 25 --radius 60 --intensity 150 --glowonly
```
Expected: `out_glow.png` shows a **soft, round halo** that fades smoothly — NOT a hard box. (This is the human check that complements AC2.)

- [ ] **Step 4: Commit**

```bash
git add glow-native/cli/glow_cli.cpp
git commit -m "feat(cli): glow_cli PNG-in/PNG-out harness for look iteration"
```

**Milestone M1 complete:** the engine produces a real cinematic glow, proven by AC1–AC3 tests + the CLI.

---

## Task 9 (M0): AE plugin project that LOADS — PiPL + dispatch + passthrough

> This is the riskiest wiring. Do it by copying the SDK's GPU sample and swapping sources. The sample is at:
> `AfterEffectsSDK_25.6_61_win\ae25.6_61.64bit.AfterEffectsSDK\Examples\Effect\SDK_Invert_ProcAmp`

**Files:**
- Create: `glow-native/ae/DeepGlowGPU.vcxproj`, `.sln` (copied from the sample, renamed)
- Create: `glow-native/ae/DeepGlowGPUPiPL.h`, `glow-native/ae/DeepGlowGPU.r`
- Modify: `glow-native/ae/DeepGlowGPU.h`, `glow-native/ae/DeepGlowGPU.cpp` (already moved here in Task 1; the scaffold's `EffectMain` dispatch + `ParamsSetup` are the starting point — strip the render body to a passthrough for now)

- [ ] **Step 1: Copy the sample project as the starting point**

```bash
cp -r "AfterEffectsSDK_25.6_61_win/ae25.6_61.64bit.AfterEffectsSDK/Examples/Effect/SDK_Invert_ProcAmp" glow-native/ae-sample-ref
```
Keep `ae-sample-ref/` as a read-only reference (git-ignore it). Recreate its `.vcxproj`, `.r`, and PiPL structure under `glow-native/ae/` with the name `DeepGlowGPU`, matching include paths to `...\Examples\Headers`, `...\Examples\Headers\SP`, `...\Examples\Util`.

- [ ] **Step 2: Write the PiPL** (`ae/DeepGlowGPU.r`) with a UNIQUE match name and **min AE version = 2024**

Model it on the sample's `.r`. Key fields: `Name "Deep Glow Native"`, `Category "AE Plugin Suite"`, unique `AE_Effect_Match_Name "DKVB DeepGlowGPU"`, and set the version-min so AE 2024 accepts it. (The sample's PiPL is the template; only names/codes change here.)

- [ ] **Step 3: Reduce `ae/DeepGlowGPU.cpp` to a loadable passthrough** — the moved scaffold already has `GLOBAL_SETUP`, `PARAMS_SETUP` (all v1 params), and the `EffectMain` dispatch. Add the three cinematic params (Linear Light checkbox, Tonemap popup, Highlight Compression slider) to `ParamsSetup`, replace the render bodies with `SMART_PRE_RENDER` (checkout input, copy rect) + `SMART_RENDER` (copy input→output), and drop the `// VERIFY` GPU code for now. Align the command/checkout calls with `ae-sample-ref` for SDK 25.6.

- [ ] **Step 4: Build the `.aex`**

Open `glow-native/ae/DeepGlowGPU.sln` in VS2022, Release x64, Build. Expected: `DeepGlowGPU.aex` produced (a renamed DLL).

- [ ] **Step 5: Install + verify it loads in AE 2024 (manual)**

```bash
cp glow-native/ae/x64/Release/DeepGlowGPU.aex "/c/Program Files/Adobe/Adobe After Effects 2024/Support Files/Plug-ins/"
```
Launch AE 2024 → new comp → solid → **Effect ▸ AE Plugin Suite ▸ Deep Glow Native**. Expected: applies with all params visible; image unchanged (passthrough). This proves PiPL + build + load before any GPU/CUDA work.

- [ ] **Step 6: Commit**

```bash
echo "glow-native/ae-sample-ref/" >> .gitignore
git add .gitignore glow-native/ae
git commit -m "feat(ae): M0 - DeepGlowGPU plugin loads in AE 2024 (PiPL + passthrough, all params)"
```

---

## Task 10 (M0→M1 bridge): wire the CPU path to `core::bloom`

**Files:**
- Create: `glow-native/ae/DeepGlowGPU.h` (param enum + AE→`core::Params` bridge)
- Modify: `glow-native/ae/DeepGlowGPU.cpp` (SMART_RENDER calls `core::bloom`)
- Modify: `glow-native/ae/DeepGlowGPU.vcxproj` (add `core/glow_core.cpp` to the build, include `core/`)

- [ ] **Step 1: Write the bridge** (`ae/DeepGlowGPU.h`): the `enum` of AE param indices (from the spec §4) and a `ReadParams(PF_ParamDef* params[]) -> glow::Params` that converts UI units (Intensity/100, Threshold/255, Hue°→rad, popups→enums, etc.), reusing the existing scaffold's `ReadParams` body as the starting point.

- [ ] **Step 2: Implement `SMART_RENDER`** to: checkout input (32-bit float world), wrap it in a `glow::Image`, call `glow::bloom(img, ReadParams(params))`, write the result to the output world. Expand `SMART_PRE_RENDER`'s `max_result_rect`/`result_rect` by the max effective radius so the bloom doesn't clip at layer edges.

- [ ] **Step 3: Build + install + verify in AE (manual)** — apply to a bright text/solid layer; a real soft glow now renders on the CPU path. Re-run the exact past repro: square + threshold 10% → strong soft glow (AC1/AC2 visually confirmed in-host).

- [ ] **Step 4: Commit**

```bash
git add glow-native/ae/DeepGlowGPU.h glow-native/ae/DeepGlowGPU.cpp glow-native/ae/DeepGlowGPU.vcxproj
git commit -m "feat(ae): CPU render path via core::bloom; pre-render rect expansion"
```

---

## Task 11 (M2): CUDA kernels mirroring `core/`, + GPU render path

**Files:**
- Create: `glow-native/ae/DeepGlowGPU.cu` (kernels: extract, downsample, upsample, composite — same math as `core/glow_core.cpp`)
- Modify: `glow-native/ae/DeepGlowGPU.cpp` (`GPU_DEVICE_SETUP/SETDOWN`, `SMART_RENDER_GPU`)
- Modify: `glow-native/ae/DeepGlowGPU.vcxproj` (CUDA build customization, `cudart` link, `sm_89`)

- [ ] **Step 1: Port the four core functions to CUDA kernels** — `extractBright`, `downsampleHalf`, `upsampleAdd`, and the composite/tonemap, one kernel each, reading the SAME `glow::Params` values. Allocate the mip-chain ping-pong buffers at `GPU_DEVICE_SETUP`, sized to the comp, reallocating on size change; free at `GPU_DEVICE_SETDOWN`. Mirror the buffer/stream plumbing from `ae-sample-ref` (ProcAmp's `SMART_RENDER_GPU`).

- [ ] **Step 2: Add the CPU↔GPU parity test (AC4)** in `tests/glow_tests.cpp` guarded behind a CUDA build flag, OR as a `glow_cli --gpu` mode that renders both and diffs. Concretely: extend `glow_cli` with `--gpu`, render the same fixture on CPU and CUDA, assert max per-channel abs diff < 1e-3. Run it on the white-square + a gradient fixture.

```bash
glow-native/build/Release/glow_cli.exe square.png /tmp/cpu.png --radius 60
# (--gpu path added in this task)
glow-native/ae/x64/Release/glow_cli_gpu.exe square.png /tmp/gpu.png --radius 60
# assert diff within epsilon (the --gpu mode prints PASS/FAIL)
```
Expected: `PARITY PASS (max diff < 1e-3)`.

- [ ] **Step 3: Verify real-time in AE (manual)** — apply to 4K footage, scrub the timeline; GPU path should scrub smoothly where the CPU path stutters.

- [ ] **Step 4: Commit**

```bash
git add glow-native/ae/DeepGlowGPU.cu glow-native/ae/DeepGlowGPU.cpp glow-native/ae/DeepGlowGPU.vcxproj glow-native/cli/glow_cli.cpp
git commit -m "feat(ae): CUDA GPU render path mirroring core; AC4 CPU/GPU parity check"
```

---

## Task 12 (M3): cinematic params wired + preset-intent look pass

**Files:**
- Modify: `glow-native/ae/DeepGlowGPU.cpp` / `.h` (ensure Linear Light, Tonemap, Highlight Compression, anamorphic, Colorize/Sat/Hue all map through both paths)
- Modify: `glow-native/tests/glow_tests.cpp` (tonemap + anamorphic property tests)

- [ ] **Step 1: Add tonemap + anamorphic property tests** to `core` tests:

```cpp
static void test_tonemap_compresses_highlights(){
    Image src=whiteSquare(64,64,32);
    Params a; a.threshold=0.1f; a.intensity=8.f; a.tonemap=TONE_NONE; a.glowOnly=true; a.linearLight=false;
    Params b=a; b.tonemap=TONE_SOFTCLIP; b.highlightComp=0.9f;
    float pa=bloom(src,a).at(40,32)[0], pb=bloom(src,b).at(40,32)[0];
    CHECK(pb < pa);                           // tonemap reduces blown-out highlight
}
static void test_anamorphic_horizontal_wider(){
    Image src=whiteSquare(128,128,16);
    Params p; p.threshold=0.1f; p.radius=40.f; p.glowOnly=true; p.linearLight=false; p.tonemap=TONE_NONE;
    p.dimensions=DIM_HORIZONTAL; Image g=bloom(src,p);
    int cx=64,cy=64;
    float horiz=g.at(cx+30,cy)[0], vert=g.at(cx,cy+30)[0];
    CHECK(horiz > vert);                      // streaks horizontally
}
```

- [ ] **Step 2: Build + run tests, verify PASS.**

```bash
cmake --build glow-native/build --config Debug --target glow_tests && glow-native/build/Debug/glow_tests.exe
```

- [ ] **Step 3: Look pass in AE (manual)** — recreate the `jsx/glow.jsx` preset intents (Soft Bloom, Neon, Cinematic) by hand on the native effect; tune default param values until they read right. Record good defaults in `ae/DeepGlowGPU.h`.

- [ ] **Step 4: Update README + commit**

```bash
git add glow-native/ae glow-native/tests/glow_tests.cpp glow-native/README.md
git commit -m "feat(ae): M3 - cinematic params (linear/tonemap/anamorphic) wired + look pass"
```

**Milestone v1 complete.** Post-v1: OpenCL backend (mirror the CUDA kernels via the sample's OpenCL path), then lens dirt / chromatic / RGB-radius / iris / Mac-Metal.

---

## Notes for the implementer

- **TDD order matters:** `core/` Tasks 4–7 are pure and fast — keep them green before touching AE/CUDA. The AE/CUDA tasks can't be unit-tested in CI; their guardrail is the `glow_cli` parity check (AC4) plus the manual AE checklist.
- **The math has ONE home:** `core/glow_core.cpp`. The CUDA kernels in Task 11 must reproduce it exactly (same weights, same threshold units). If you change a weight, change both and re-run AC4.
- **Build environment:** all `cmake`/`cl`/`nvcc` commands assume a "x64 Native Tools Command Prompt for VS 2022". `AESDK_ROOT` = `F:\APPS\AE_PLUGIN\AfterEffectsSDK_25.6_61_win\ae25.6_61.64bit.AfterEffectsSDK`.
- **If AE won't load the .aex** (Task 9): it's almost always the PiPL (match name / version-min) — diff against `ae-sample-ref` until it loads, before debugging anything else.

# Color Tool P1 — CPU Core + CLI + Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the portable C++ color-grading **CPU core** (linear-light primary pipeline + 3-way lift/gamma/gain), a PNG-in/out CLI harness, and acceptance tests — all buildable and verifiable **without After Effects**.

**Architecture:** Mirror `glow-native/`. A header-only-ish `core/` with a `Params` struct and `CL_HD`-marked color-science helpers shared host/device, an `Image` struct, and a `grade()` entry point. A `cli/` PNG harness (vendored `stb_*`). A `tests/` file with tiny `CHECK/NEAR` macros (no framework). This phase is CPU-only; CUDA is P2, the `.aex` shell is later, the panel is later.

**Tech Stack:** C++17, MSVC `cl` (via VS Developer environment, located with `vswhere`), stb_image / stb_image_write (public domain).

**Scope of P1 (from spec §10):** linearize → exposure → white balance → lift/gamma/gain → contrast → saturation → tone-map → delinearize. **Curves (P3) and HSL secondary (P4) are out of P1** — the pipeline leaves them as no-op hooks.

---

## File structure (created in this phase)

```
color-native/
├─ core/
│  ├─ color_params.h   Params struct + CL_HD color-science helpers (the math)
│  ├─ color_core.h     Image struct + grade()/gradePixel() declarations
│  └─ color_core.cpp   grade() implementation (loops gradePixel over the image)
├─ cli/
│  ├─ color_cli.cpp    load PNG → grade() → write PNG (param flags)
│  ├─ stb_image.h      vendored (copied from glow-native/cli)
│  └─ stb_image_write.h vendored (copied from glow-native/cli)
├─ tests/
│  └─ color_tests.cpp  AC1–AC3 + helper property tests
├─ build/              (gitignored) build output
├─ build-cli.bat       locate VS env via vswhere, compile cli + tests with cl
└─ README.md           what this is + build/run steps + status
```

---

### Task 1: Scaffold `color-native/` and vendor stb

**Files:**
- Create: `color-native/README.md`
- Create: `color-native/cli/stb_image.h` (copy)
- Create: `color-native/cli/stb_image_write.h` (copy)
- Modify: `.gitignore` (add `color-native/build/`)

- [ ] **Step 1: Create dirs and copy vendored PNG I/O from the proven glow harness**

```bash
cd "D:/apps/AE_PLUGINS"
mkdir -p color-native/core color-native/cli color-native/tests color-native/build
cp glow-native/cli/stb_image.h       color-native/cli/stb_image.h
cp glow-native/cli/stb_image_write.h color-native/cli/stb_image_write.h
```

- [ ] **Step 2: Write `color-native/README.md`**

```markdown
# color-native/ — native Color grading engine

Compiled color-correction engine for the AE suite (spec: docs/superpowers/specs/2026-06-09-color-tool-native-design.md).
Mirrors glow-native/. P1 = CPU core + CLI + tests (this build, no AE needed).

- core/  portable C++ pipeline (single source of truth): linearize → exposure → white balance →
         lift/gamma/gain → contrast → saturation → tone-map → delinearize.
- cli/   color_cli — PNG-in/PNG-out harness (stb).
- tests/ color_tests — acceptance/property tests (AC1–AC3).

## Build & run (Windows, VS Developer env located via vswhere)
    build-cli.bat
    build\color_tests.exe          # all tests pass -> "ALL PASS"
    build\color_cli.exe in.png out.png --exposure 1.0 --sat 1.4

Status: P1 in progress. CUDA (P2), .aex shell, and panel are later phases.
```

- [ ] **Step 3: Ignore build output**

Add to `.gitignore`:
```
color-native/build/
```

- [ ] **Step 4: Commit**

```bash
git add color-native/README.md color-native/cli/stb_image.h color-native/cli/stb_image_write.h .gitignore
git commit -m "feat(color-native): scaffold P1 dirs + vendor stb PNG I/O"
```

---

### Task 2: `color_params.h` — Params + color-science helpers (TDD)

**Files:**
- Create: `color-native/core/color_params.h`
- Create: `color-native/tests/color_tests.cpp` (initial)

- [ ] **Step 1: Write the failing test** (`color-native/tests/color_tests.cpp`)

```cpp
#include <cstdio>
#include <cmath>
#include "color_params.h"
using namespace colorlab;

static int g_fail = 0;
#define CHECK(cond) do{ if(!(cond)){ printf("FAIL %s:%d  %s\n",__FILE__,__LINE__,#cond); ++g_fail; } }while(0)
#define NEAR(a,b,eps) CHECK(std::fabs((a)-(b)) <= (eps))

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

int main() {
    test_srgb_roundtrip();
    test_srgb_known();
    test_luma();
    if (g_fail) { printf("%d CHECK(S) FAILED\n", g_fail); return 1; }
    printf("ALL PASS\n"); return 0;
}
```

- [ ] **Step 2: Write `color_params.h`**

```cpp
#pragma once
#include <cmath>

// Shared host/device marker (mirrors glow's GLOW_HD). nvcc defines __CUDACC__.
#ifdef __CUDACC__
#define CL_HD __host__ __device__
#else
#define CL_HD
#endif

namespace colorlab {

enum Tonemap { TONE_NONE = 1, TONE_SOFTCLIP = 2, TONE_FILMIC = 3 };

// Normalized params. Wheel RGB pushes ~[-0.5,0.5], luma ~[-0.5,0.5]; defaults = identity.
struct Params {
    // primaries
    float exposure      = 0.0f;   // stops (linear *= 2^exposure)
    float contrast      = 0.0f;   // -1..1 (factor = 1+contrast)
    float contrastPivot = 0.18f;  // linear mid-grey pivot
    float temperature   = 0.0f;   // -1..1 (+ = warmer)
    float tint          = 0.0f;   // -1..1 (+ = magenta)
    float saturation    = 0.0f;   // -1..1 (factor = 1+saturation)
    // 3-way wheels (shadows/mids/highs): per-channel push + master luma
    float liftR=0, liftG=0, liftB=0, liftLuma=0;
    float gammaR=0, gammaG=0, gammaB=0, gammaLuma=0;
    float gainR=0, gainG=0, gainB=0, gainLuma=0;
    // output
    bool  linearLight   = true;
    int   tonemap       = TONE_NONE;
    float highlightComp = 0.5f;   // 0..1 soft-clip knee strength
};

// ---- sRGB transfer (IEC 61966-2-1) ----
CL_HD inline float srgb_to_linear(float c) {
    if (c <= 0.f) return 0.f;
    return c <= 0.04045f ? c / 12.92f : powf((c + 0.055f) / 1.055f, 2.4f);
}
CL_HD inline float linear_to_srgb(float c) {
    if (c <= 0.f) return 0.f;
    return c <= 0.0031308f ? c * 12.92f : 1.055f * powf(c, 1.f / 2.4f) - 0.055f;
}
CL_HD inline float lumaRec709(float r, float g, float b) {
    return 0.2126f * r + 0.7152f * g + 0.0722f * b;
}

// ---- white balance: per-channel gains in linear (approx chromatic adaptation) ----
CL_HD inline void applyWhiteBalance(float& r, float& g, float& b, float temp, float tint) {
    float rGain = 1.f + 0.50f * temp + 0.20f * tint;
    float gGain = 1.f - 0.30f * tint;
    float bGain = 1.f - 0.50f * temp + 0.20f * tint;
    r *= rGain; g *= gGain; b *= bGain;
}

// ---- 3-way lift/gamma/gain on ONE channel (shadows -> mids -> highs) ----
// lift lifts blacks (shadow-weighted), gamma is a mid power, gain multiplies highs.
CL_HD inline float applyLGGChannel(float c, float lift, float gamma, float gain) {
    c = c + lift * (1.f - c);                 // lift (shadow-weighted offset)
    float p = 1.f + gamma;                    // gamma push -> power 1/p
    if (p < 0.05f) p = 0.05f;
    c = c < 0.f ? 0.f : powf(c, 1.f / p);
    c = c * (1.f + gain);                     // gain (highlight multiply)
    return c;
}

// ---- contrast around a pivot (linear) ----
CL_HD inline float applyContrast(float c, float contrast, float pivot) {
    return (c - pivot) * (1.f + contrast) + pivot;
}

// ---- luma-preserving saturation ----
CL_HD inline void applySaturation(float& r, float& g, float& b, float sat) {
    float y = lumaRec709(r, g, b);
    float s = 1.f + sat;
    r = y + (r - y) * s; g = y + (g - y) * s; b = y + (b - y) * s;
}

// ---- soft-clip tone-map (Reinhard-style, knee = highlightComp) ----
CL_HD inline float toneSoftClip(float c, float knee) {
    if (c <= 0.f) return 0.f;
    float k = 0.25f + 1.75f * knee;           // stronger knee = earlier roll-off
    return c / (1.f + c * k) * (1.f + k);     // normalized so small values ~unchanged
}

} // namespace colorlab
```

- [ ] **Step 3: Build the test** (see Task 6 for `build-cli.bat`; until then compile directly)

Run (PowerShell, from a VS Developer prompt or after Task 6's batch):
```
build-cli.bat
```
Expected: produces `build\color_tests.exe`.

- [ ] **Step 4: Run the test**

Run: `build\color_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add color-native/core/color_params.h color-native/tests/color_tests.cpp
git commit -m "feat(color-native): color-science helpers (sRGB, WB, LGG, contrast, sat, tonemap) + tests"
```

---

### Task 3: `color_core` — Image + grade() pipeline (TDD)

**Files:**
- Create: `color-native/core/color_core.h`
- Create: `color-native/core/color_core.cpp`
- Modify: `color-native/tests/color_tests.cpp` (add pipeline tests + include)

- [ ] **Step 1: Write failing tests** — append to `color_tests.cpp` and add `#include "color_core.h"` near the top, then call the new tests from `main()`:

```cpp
// (add near other includes)
#include "color_core.h"

static colorlab::Image solid(int w,int h,float r,float g,float b){
    colorlab::Image im(w,h);
    for(int i=0;i<w*h;++i){ float* p=&im.px[i*4]; p[0]=r;p[1]=g;p[2]=b;p[3]=1.f; }
    return im;
}

static void test_identity_is_noop() {            // AC1
    colorlab::Image im = solid(4,4,0.2f,0.5f,0.8f);
    colorlab::Image ref = im;
    colorlab::Params P;                           // all defaults = identity
    colorlab::grade(im, P);
    for (size_t i=0;i<im.px.size();++i) NEAR(im.px[i], ref.px[i], 1e-4f);
}
static void test_exposure_doubles_linear() {      // AC2
    colorlab::Image im = solid(2,2,0.25f,0.25f,0.25f);
    colorlab::Params P; P.linearLight=true; P.exposure=1.0f; // +1 stop = x2 in linear
    float lin = colorlab::srgb_to_linear(0.25f);
    colorlab::grade(im, P);
    float expect = colorlab::linear_to_srgb(lin * 2.f);
    NEAR(im.px[0], expect, 2e-3f);
}
static void test_desaturate_to_gray() {           // AC2
    colorlab::Image im = solid(2,2,0.8f,0.2f,0.1f);
    colorlab::Params P; P.saturation=-1.0f;       // fully desaturate
    colorlab::grade(im, P);
    NEAR(im.px[0], im.px[1], 2e-3f); NEAR(im.px[1], im.px[2], 2e-3f);
}
static void test_lift_raises_blacks() {           // AC2 direction
    colorlab::Image im = solid(2,2,0.0f,0.0f,0.0f);
    colorlab::Params P; P.liftLuma=0.2f;
    colorlab::grade(im, P);
    CHECK(im.px[0] > 0.05f);                       // black got lifted
}
```

Add to `main()` before the pass/fail print:
```cpp
    test_identity_is_noop();
    test_exposure_doubles_linear();
    test_desaturate_to_gray();
    test_lift_raises_blacks();
```

- [ ] **Step 2: Write `color_core.h`**

```cpp
#pragma once
#include <vector>
#include "color_params.h"

namespace colorlab {

// RGBA float image, row-major, 4 floats/pixel.
struct Image {
    int w = 0, h = 0;
    std::vector<float> px;             // size w*h*4
    Image() {}
    Image(int W, int H) : w(W), h(H), px((size_t)W*H*4, 0.f) {}
    float* at(int x, int y) { return &px[((size_t)y*w + x) * 4]; }
    const float* at(int x, int y) const { return &px[((size_t)y*w + x) * 4]; }
};

// Grade one RGB triplet in place (alpha untouched by caller). Pure point op.
CL_HD void gradePixel(float& r, float& g, float& b, const Params& P);

// Grade a whole image in place.
void grade(Image& im, const Params& P);

} // namespace colorlab
```

- [ ] **Step 3: Write `color_core.cpp`**

```cpp
#include "color_core.h"

namespace colorlab {

CL_HD void gradePixel(float& r, float& g, float& b, const Params& P) {
    // 1. linearize
    if (P.linearLight) { r=srgb_to_linear(r); g=srgb_to_linear(g); b=srgb_to_linear(b); }
    // 2. exposure (stops)
    if (P.exposure != 0.f) { float m=exp2f(P.exposure); r*=m; g*=m; b*=m; }
    // 3. white balance
    if (P.temperature != 0.f || P.tint != 0.f) applyWhiteBalance(r,g,b,P.temperature,P.tint);
    // 4. lift/gamma/gain (per channel = master luma + channel push)
    r = applyLGGChannel(r, P.liftLuma+P.liftR, P.gammaLuma+P.gammaR, P.gainLuma+P.gainR);
    g = applyLGGChannel(g, P.liftLuma+P.liftG, P.gammaLuma+P.gammaG, P.gainLuma+P.gainG);
    b = applyLGGChannel(b, P.liftLuma+P.liftB, P.gammaLuma+P.gammaB, P.gainLuma+P.gainB);
    // 5. contrast (pivot)
    if (P.contrast != 0.f) {
        r=applyContrast(r,P.contrast,P.contrastPivot);
        g=applyContrast(g,P.contrast,P.contrastPivot);
        b=applyContrast(b,P.contrast,P.contrastPivot);
    }
    // 6. (curves P3, HSL P4 — no-op hooks here)
    // 7. saturation
    if (P.saturation != 0.f) applySaturation(r,g,b,P.saturation);
    // 8. tone-map
    if (P.tonemap == TONE_SOFTCLIP) { r=toneSoftClip(r,P.highlightComp); g=toneSoftClip(g,P.highlightComp); b=toneSoftClip(b,P.highlightComp); }
    // 9. delinearize
    if (P.linearLight) { r=linear_to_srgb(r); g=linear_to_srgb(g); b=linear_to_srgb(b); }
}

void grade(Image& im, const Params& P) {
    const size_t n = (size_t)im.w * im.h;
    for (size_t i = 0; i < n; ++i) {
        float* p = &im.px[i*4];
        gradePixel(p[0], p[1], p[2], P);   // alpha p[3] untouched
    }
}

} // namespace colorlab
```

- [ ] **Step 4: Build and run tests**

Run: `build-cli.bat && build\color_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add color-native/core/color_core.h color-native/core/color_core.cpp color-native/tests/color_tests.cpp
git commit -m "feat(color-native): grade() linear-light primary pipeline + pipeline tests (AC1-AC2)"
```

---

### Task 4: `color_cli` — PNG-in/out harness

**Files:**
- Create: `color-native/cli/color_cli.cpp`

- [ ] **Step 1: Write `color_cli.cpp`**

```cpp
// color_cli in.png out.png [--exposure f][--contrast f][--temp f][--tint f]
//   [--sat f][--lift r g b l][--gamma r g b l][--gain r g b l][--no-linear][--softclip f]
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include "../core/color_core.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
using namespace colorlab;

static float f(const char* s){ return (float)atof(s); }

int main(int argc, char** argv){
    if (argc < 3){ printf("usage: color_cli in.png out.png [params]\n"); return 2; }
    int w,h,c; unsigned char* data = stbi_load(argv[1], &w,&h,&c, 4);
    if (!data){ printf("load failed: %s\n", argv[1]); return 1; }

    Image im(w,h);
    for (int i=0;i<w*h;++i){ for(int k=0;k<4;++k) im.px[i*4+k] = data[i*4+k]/255.f; }
    stbi_image_free(data);

    Params P;
    for (int i=3;i<argc;++i){
        const char* a=argv[i];
        if      (!strcmp(a,"--exposure")) P.exposure=f(argv[++i]);
        else if (!strcmp(a,"--contrast")) P.contrast=f(argv[++i]);
        else if (!strcmp(a,"--temp"))     P.temperature=f(argv[++i]);
        else if (!strcmp(a,"--tint"))     P.tint=f(argv[++i]);
        else if (!strcmp(a,"--sat"))      P.saturation=f(argv[++i]);
        else if (!strcmp(a,"--lift")) { P.liftR=f(argv[++i]);P.liftG=f(argv[++i]);P.liftB=f(argv[++i]);P.liftLuma=f(argv[++i]); }
        else if (!strcmp(a,"--gamma")){ P.gammaR=f(argv[++i]);P.gammaG=f(argv[++i]);P.gammaB=f(argv[++i]);P.gammaLuma=f(argv[++i]); }
        else if (!strcmp(a,"--gain")) { P.gainR=f(argv[++i]);P.gainG=f(argv[++i]);P.gainB=f(argv[++i]);P.gainLuma=f(argv[++i]); }
        else if (!strcmp(a,"--no-linear")) P.linearLight=false;
        else if (!strcmp(a,"--softclip")) { P.tonemap=TONE_SOFTCLIP; P.highlightComp=f(argv[++i]); }
    }

    grade(im, P);

    std::vector<unsigned char> out((size_t)w*h*4);
    for (size_t i=0;i<out.size();++i){ float v=im.px[i]; v=v<0?0:(v>1?1:v); out[i]=(unsigned char)(v*255.f+0.5f); }
    if (!stbi_write_png(argv[2], w,h,4, out.data(), w*4)){ printf("write failed\n"); return 1; }
    printf("wrote %s (%dx%d)\n", argv[2], w, h);
    return 0;
}
```

- [ ] **Step 2: Build**

Run: `build-cli.bat`
Expected: produces `build\color_cli.exe` (and `build\color_tests.exe`).

- [ ] **Step 3: Smoke-test on a real image**

Run: `build\color_cli.exe docs\reference\glow-selection-reference.png build\graded.png --exposure 0.5 --sat 1.3 --temp 0.2`
Expected: `wrote build\graded.png (...)`; open it — visibly warmer/brighter/more saturated.

- [ ] **Step 4: Commit**

```bash
git add color-native/cli/color_cli.cpp
git commit -m "feat(color-native): color_cli PNG-in/out harness"
```

---

### Task 5: `build-cli.bat` — VS-env build via vswhere

**Files:**
- Create: `color-native/build-cli.bat`

> Note: in TDD order this is referenced by Tasks 2–4; create it first in practice. Listed here so its content is fully specified.

- [ ] **Step 1: Write `build-cli.bat`**

```bat
@echo off
REM Locate the VS Developer environment and compile the CPU core, CLI and tests with MSVC.
setlocal
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VSPATH=%%i"
if not defined VSPATH ( echo Visual Studio not found via vswhere & exit /b 1 )
call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 ( echo vcvars64 failed & exit /b 1 )

pushd "%~dp0"
if not exist build mkdir build
echo Building color_tests.exe ...
cl /nologo /EHsc /O2 /std:c++17 /I core tests\color_tests.cpp core\color_core.cpp /Fo:build\ /Fe:build\color_tests.exe || (popd & exit /b 1)
echo Building color_cli.exe ...
cl /nologo /EHsc /O2 /std:c++17 /I core cli\color_cli.cpp core\color_core.cpp /Fo:build\ /Fe:build\color_cli.exe || (popd & exit /b 1)
echo OK
popd
endlocal
```

- [ ] **Step 2: Run it**

Run: `color-native\build-cli.bat`
Expected: ends with `OK`; `build\color_tests.exe` and `build\color_cli.exe` exist.

- [ ] **Step 3: Run tests**

Run: `color-native\build\color_tests.exe`
Expected: `ALL PASS`

- [ ] **Step 4: Commit**

```bash
git add color-native/build-cli.bat
git commit -m "build(color-native): vswhere-based MSVC build script for cli + tests"
```

---

### Task 6: Phase wrap — verify AC1–AC3 & update status

**Files:**
- Modify: `color-native/README.md` (status line)
- Modify: `C:/Users/USER/.claude/projects/D--apps-AE-PLUGINS/memory/MEMORY.md` + a new memory file (progress)

- [ ] **Step 1: Full clean build + test**

Run: `color-native\build-cli.bat && color-native\build\color_tests.exe`
Expected: `OK` then `ALL PASS` (AC1 identity, AC2 exposure/sat/lift, sRGB round-trip).

- [ ] **Step 2: Update README status line** to `Status: P1 DONE (CPU core + CLI + tests pass). Next: P2 CUDA mirror + parity.`

- [ ] **Step 3: Record progress memory** (new file `color-native-progress.md` + one MEMORY.md index line) summarizing: P1 done, where the core lives, build command, next = P2.

- [ ] **Step 4: Commit**

```bash
git add color-native/README.md
git commit -m "docs(color-native): mark P1 complete (CPU core verified via CLI + tests)"
```

---

## Self-Review

**Spec coverage (P1 portion of spec §2/§4/§10):**
- Linear working space ✓ (Task 2 srgb helpers, Task 3 steps 1 & 9)
- Exposure, white balance, lift/gamma/gain, contrast, saturation, tone-map ✓ (Tasks 2–3)
- 3-way wheels params (RGB push + master luma) ✓ (Params + applyLGGChannel)
- CLI harness for visual iteration ✓ (Task 4) · acceptance tests AC1–AC3 ✓ (Tasks 2–3)
- Curves (P3) / HSL (P4) / CUDA (P2) / .aex / panel — correctly **out of P1**, hooks left in `gradePixel`.

**Placeholder scan:** none — every step has full code or exact commands.

**Type consistency:** namespace `colorlab` throughout; `Params` field names match between `color_params.h`, `color_core.cpp`, tests, and CLI; `Image` API (`.px`, `.at`, `(W,H)` ctor) consistent; helper names (`srgb_to_linear`, `linear_to_srgb`, `lumaRec709`, `applyWhiteBalance`, `applyLGGChannel`, `applyContrast`, `applySaturation`, `toneSoftClip`, `gradePixel`, `grade`) used identically everywhere.

---

## Next phases (separate plans)
- **P2:** `cuda/color_cuda.cu` mirror + `color_parity.cpp` (CPU↔GPU < 1e-3) — own plan.
- **P3:** curves LUT engine + curve-editor canvas section.
- **P4:** HSL secondary qualifier + eyedropper.
- **P5:** scopes (engine emit via mmap + panel canvas).
- **`.aex` shell + panel** (`js/plugins/colorlab/ui.js`, `jsx/colorlab.jsx` rewrite) once core is proven.

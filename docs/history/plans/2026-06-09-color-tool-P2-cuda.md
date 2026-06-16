# Color Tool P2 — CUDA Mirror + CPU↔GPU Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or subagent-driven-development. Checkbox (`- [ ]`) steps.

**Goal:** Run the P1 color pipeline on the GPU via CUDA, proving CPU↔GPU parity (< 1e-3) on a param sweep — the same correctness gate Deep Glow used (AC4).

**Architecture:** The pipeline math is already `CL_HD` (host+device). Make `gradePixel` a **header-inline `CL_HD`** function so the GPU kernel calls the identical code — parity by construction, zero duplicated math. Add a tiny CUDA wrapper `gradeCuda()` and a `color_parity` harness that diffs CPU `grade()` vs GPU `gradeCuda()`.

**Tech Stack:** CUDA 13.3 (`nvcc`, `-arch=sm_89`, RTX 4080), MSVC host compiler, C++17.

---

## File structure (this phase)

```
color-native/
├─ core/
│  ├─ color_core.h     MODIFY: gradePixel becomes `CL_HD inline` here (moved from .cpp)
│  └─ color_core.cpp   MODIFY: drop gradePixel definition; keep grade()
├─ cuda/
│  ├─ color_cuda.h     NEW: gradeCuda(Image&, const Params&) decl
│  ├─ color_cuda.cu    NEW: __global__ kernel calling gradePixel + host wrapper
│  └─ color_parity.cpp NEW: CPU vs GPU diff harness over a param sweep
└─ build-cuda.bat      NEW: nvcc build (ensures cl on PATH, else vcvars via vswhere)
```

---

### Task 1: Make `gradePixel` device-callable (header-inline)

**Files:**
- Modify: `color-native/core/color_core.h`
- Modify: `color-native/core/color_core.cpp`

- [ ] **Step 1:** In `color_core.h`, replace the declaration
  `CL_HD void gradePixel(float& r, float& g, float& b, const Params& P);`
  with the full **`CL_HD inline`** definition (the body currently in `color_core.cpp`):

```cpp
// Grade one RGB triplet in place (alpha untouched). Pure point op — host & device.
CL_HD inline void gradePixel(float& r, float& g, float& b, const Params& P) {
    if (P.linearLight) { r=srgb_to_linear(r); g=srgb_to_linear(g); b=srgb_to_linear(b); }
    if (P.exposure != 0.f) { float m=exp2f(P.exposure); r*=m; g*=m; b*=m; }
    if (P.temperature != 0.f || P.tint != 0.f) applyWhiteBalance(r,g,b,P.temperature,P.tint);
    r = applyLGGChannel(r, P.liftLuma+P.liftR, P.gammaLuma+P.gammaR, P.gainLuma+P.gainR);
    g = applyLGGChannel(g, P.liftLuma+P.liftG, P.gammaLuma+P.gammaG, P.gainLuma+P.gainG);
    b = applyLGGChannel(b, P.liftLuma+P.liftB, P.gammaLuma+P.gammaB, P.gainLuma+P.gainB);
    if (P.contrast != 0.f) {
        r=applyContrast(r,P.contrast,P.contrastPivot);
        g=applyContrast(g,P.contrast,P.contrastPivot);
        b=applyContrast(b,P.contrast,P.contrastPivot);
    }
    if (P.saturation != 0.f) applySaturation(r,g,b,P.saturation);
    if (P.tonemap == TONE_SOFTCLIP) { r=toneSoftClip(r,P.highlightComp); g=toneSoftClip(g,P.highlightComp); b=toneSoftClip(b,P.highlightComp); }
    if (P.linearLight) { r=linear_to_srgb(r); g=linear_to_srgb(g); b=linear_to_srgb(b); }
}
```

- [ ] **Step 2:** In `color_core.cpp`, delete the old `gradePixel` definition; keep only `grade()` (which calls `gradePixel`).

- [ ] **Step 3:** Rebuild CPU + run tests to prove the refactor is behavior-preserving.

Run: `color-native\build-cli.bat && color-native\build\color_tests.exe`
Expected: `OK` then `ALL PASS`.

- [ ] **Step 4: Commit**

```bash
git add color-native/core/color_core.h color-native/core/color_core.cpp
git commit -m "refactor(color-native): gradePixel header-inline CL_HD (device-callable, single source)"
```

---

### Task 2: CUDA kernel + host wrapper

**Files:**
- Create: `color-native/cuda/color_cuda.h`
- Create: `color-native/cuda/color_cuda.cu`

- [ ] **Step 1:** Write `color_cuda.h`

```cpp
#pragma once
#include "../core/color_core.h"
namespace colorlab {
// Grade an image on the GPU (in place). Same math as grade() — see gradePixel.
void gradeCuda(Image& im, const Params& P);
}
```

- [ ] **Step 2:** Write `color_cuda.cu`

```cpp
#include "color_cuda.h"
#include <cuda_runtime.h>
#include <cstdio>

namespace colorlab {

__global__ void gradeKernel(float* px, int n, Params P) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    float* p = px + (size_t)i * 4;
    gradePixel(p[0], p[1], p[2], P);     // identical host/device code
}

void gradeCuda(Image& im, const Params& P) {
    int n = im.w * im.h;
    if (n <= 0) return;
    size_t bytes = (size_t)n * 4 * sizeof(float);
    float* d = nullptr;
    cudaMalloc(&d, bytes);
    cudaMemcpy(d, im.px.data(), bytes, cudaMemcpyHostToDevice);
    int threads = 256, blocks = (n + threads - 1) / threads;
    gradeKernel<<<blocks, threads>>>(d, n, P);
    cudaDeviceSynchronize();
    cudaMemcpy(im.px.data(), d, bytes, cudaMemcpyDeviceToHost);
    cudaFree(d);
}

} // namespace colorlab
```

(No standalone build here — built+linked by the parity harness in Task 4.)

---

### Task 3: Parity harness

**Files:**
- Create: `color-native/cuda/color_parity.cpp`

- [ ] **Step 1:** Write `color_parity.cpp`

```cpp
#include <cstdio>
#include <cmath>
#include <vector>
#include "../core/color_core.h"
#include "color_cuda.h"
using namespace colorlab;

static Image randomImg(int w, int h, unsigned seed) {
    Image im(w, h);
    unsigned s = seed;
    for (size_t i = 0; i < im.px.size(); ++i) {
        s = s * 1664525u + 1013904223u;          // LCG
        im.px[i] = (s >> 8) / 16777215.0f;        // 0..1
    }
    return im;
}

static float maxDiff(const Image& a, const Image& b) {
    float m = 0.f;
    for (size_t i = 0; i < a.px.size(); ++i) {
        float d = std::fabs(a.px[i] - b.px[i]);
        if (d > m) m = d;
    }
    return m;
}

int main() {
    Image base = randomImg(128, 128, 7u);

    std::vector<Params> sweep;
    { Params p; p.exposure=1.2f; sweep.push_back(p); }
    { Params p; p.contrast=0.4f; p.contrastPivot=0.18f; sweep.push_back(p); }
    { Params p; p.temperature=0.5f; p.tint=-0.3f; sweep.push_back(p); }
    { Params p; p.saturation=0.7f; sweep.push_back(p); }
    { Params p; p.liftLuma=0.15f; p.gammaG=0.2f; p.gainR=0.3f; sweep.push_back(p); }
    { Params p; p.exposure=-0.8f; p.contrast=0.3f; p.saturation=0.4f;
      p.temperature=0.2f; p.tonemap=TONE_SOFTCLIP; p.highlightComp=0.6f; sweep.push_back(p); }

    float worst = 0.f; int idx = 0;
    for (size_t k = 0; k < sweep.size(); ++k) {
        Image a = base, b = base;
        grade(a, sweep[k]);          // CPU
        gradeCuda(b, sweep[k]);      // GPU
        float d = maxDiff(a, b);
        printf("param set %zu: max|CPU-GPU| = %.3e\n", k, d);
        if (d > worst) { worst = d; idx = (int)k; }
    }
    printf("WORST = %.3e (set %d)\n", worst, idx);
    const float TOL = 1e-3f;
    if (worst <= TOL) { printf("PARITY PASS (<= %.0e)\n", TOL); return 0; }
    printf("PARITY FAIL (> %.0e)\n", TOL); return 1;
}
```

---

### Task 4: `build-cuda.bat` + verify parity

**Files:**
- Create: `color-native/build-cuda.bat`

- [ ] **Step 1:** Write `build-cuda.bat`

```bat
@echo off
setlocal
REM Ensure MSVC cl (nvcc host compiler) is available.
where cl >nul 2>nul
if not %errorlevel%==0 (
  set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
  if not exist "%VSWHERE%" ( echo [!] cl not on PATH and vswhere missing & exit /b 1 )
  for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VSPATH=%%i"
  call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
)
where nvcc >nul 2>nul || ( echo [!] nvcc not found on PATH & exit /b 1 )

pushd "%~dp0"
if not exist build mkdir build
echo Building color_parity.exe (nvcc, sm_89) ...
nvcc -O2 -std=c++17 -arch=sm_89 -I core cuda\color_parity.cpp cuda\color_cuda.cu core\color_core.cpp -o build\color_parity.exe || (popd & exit /b 1)
echo OK
popd
endlocal
```

- [ ] **Step 2:** Build

Run: `color-native\build-cuda.bat`
Expected: `OK`; `build\color_parity.exe` exists.

- [ ] **Step 3:** Run parity

Run: `color-native\build\color_parity.exe`
Expected: each set prints a tiny diff; final `PARITY PASS (<= 1e-03)`.

- [ ] **Step 4:** Re-run CPU tests (refactor still green)

Run: `color-native\build\color_tests.exe`
Expected: `ALL PASS`.

- [ ] **Step 5: Commit**

```bash
git add color-native/cuda/ color-native/build-cuda.bat
git commit -m "feat(color-native): P2 CUDA mirror + CPU/GPU parity harness (PASS < 1e-3)"
```

---

## Self-Review

- **Spec coverage (§3 cuda/, §9 parity):** GPU mirror ✓ (Task 2), parity gate < 1e-3 ✓ (Tasks 3–4). Single-source math (no drift) enforced by header-inline `gradePixel` ✓ (Task 1).
- **Placeholder scan:** none — full code + exact commands throughout.
- **Type consistency:** `gradeCuda` matches `color_cuda.h`; `Image.px`/`grade`/`gradePixel`/`Params` identical to P1; namespace `colorlab`; kernel takes `Params` by value (POD).
- **Risk:** if `nvcc`+`cl` toolchain quirks block the build (per [[aex-build-recipe]] version-drift notes), the harness still documents the gate; fix toolchain and re-run. Parity tolerance 1e-3 is generous (Glow hit ~1e-7).

## Next: P3 (curves LUT + curve-editor section) — own plan.

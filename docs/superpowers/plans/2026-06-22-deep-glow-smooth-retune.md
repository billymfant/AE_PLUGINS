# Deep Glow "Smooth & Soft" Retune — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune Deep Glow so the bloom is gentle and tameable by default (full power still reachable), Radius changes spread not brightness, Threshold is perceptual, the eyedropper samples real footage with a real histogram, and the 5 factory presets read soft & highlight-targeted.

**Architecture:** Three engine math changes — (1a) energy-normalize the across-mip-levels accumulation, (1b) a perceptual power curve on Intensity, (1c) compute the bright-selection mask in display/sRGB space while keeping the extracted color linear. The glow math has two homes that must stay bit-identical: `glow-native/core/glow_core.cpp` (CPU, authoritative) and `glow-native/cuda/glow_cuda.cu` (GPU mirror); 1a and 1c land in both, 1b is host-only in `glow-native/ae/DeepGlowGPU.cpp`. The panel side adds a real frame grab (`glow.grabFrame()` in `jsx/glow.jsx`), an in-panel frame thumbnail + real histogram + click-to-pick in `js/plugins/glow/ui.js`, and a rebuilt glow preset block in `js/factory-presets.js`.

**Tech Stack:** C++17 (engine), CUDA 13.3 (GPU mirror), CMake (tests/parity), MSBuild + AE 2025 SDK (`.aex`), ExtendScript (`jsx/`), CEP/vanilla JS (`js/`). Build/parity toolchain (VS2022 + CUDA 13.3 + AE SDK) is on this PC.

**The parity rule (holds throughout):** Any pixel-math change to a "home" (`glow_core.cpp` / `glow_cuda.cu`) must be made in BOTH, then verified with `glow_parity.exe` (`<1e-3` across all configs). Host-side scalar changes (the Intensity curve) feed both paths and are parity-trivial.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `glow-native/core/glow_params.h` | Shared host+device helpers (`GLOW_HD`) | Add `levelWeightNorm()` (energy-normalization factor) |
| `glow-native/core/glow_core.h` | Engine declarations | Change `extractBright` signature to `(disp, lin, p)` |
| `glow-native/core/glow_core.cpp` | CPU engine (authoritative math) | 1a normalize in `bloom()`; 1c mask-from-display in `extractBright()` |
| `glow-native/cuda/glow_cuda.cu` | GPU mirror | Mirror 1a (wnorm into composite) + 1c (display buffer for mask) in both host entries |
| `glow-native/ae/DeepGlowGPU.cpp` | AE adapter / param bridge | 1b perceptual Intensity curve in `ReadParams()` |
| `glow-native/tests/glow_tests.cpp` | CPU acceptance tests | New tests for 1a + 1c; update existing `extractBright` callers to 3-arg |
| `glow-native/cuda/glow_parity.cpp` | CPU/GPU parity guardrail | No edit (existing configs exercise both changes) |
| `jsx/glow.jsx` | Native effect driver | Add `grabFrame()` (saveFrameToPng + RQ fallback) |
| `jsx/dispatcher.jsx` | ExtendScript router | Route `glow.grabFrame` |
| `js/plugins/glow/ui.js` | Panel UI | JS qualifier mirror, real histogram, frame thumbnail, click-to-pick, grab button |
| `js/factory-presets.js` | Factory presets | Rewrite the 5 glow presets with the full native field set |

---

## Setup Task: Baseline green build

**Files:** none (configures the CMake build directory and confirms a clean baseline before any change).

- [ ] **Step 1: Configure the CMake build directory**

This build compiles the CPU tests (`glow_tests`) and the CPU/GPU parity guardrail (`glow_parity`). It needs `nvcc` discoverable — run from a shell where `nvcc --version` works (CUDA v13.3 on PATH). PowerShell:

```powershell
cmake -S glow-native -B glow-native/build-cuda -G "Visual Studio 17 2022" -A x64
```

Expected: configures successfully and prints `CUDA found (...) — building glow_parity (AC4)`. If it instead prints `CUDA not found`, fix the CUDA PATH before continuing (parity cannot be verified without it).

- [ ] **Step 2: Build the test + parity targets**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_tests glow_parity
```

Expected: both `glow_tests.exe` and `glow_parity.exe` build with no errors under `glow-native/build-cuda/Release/`.

- [ ] **Step 3: Run both and confirm the green baseline**

```powershell
& glow-native/build-cuda/Release/glow_tests.exe
& glow-native/build-cuda/Release/glow_parity.exe
```

Expected: `ALL TESTS PASSED` and `ALL PARITY CONFIGS PASSED`. Do not proceed until both are green — every later task re-runs these.

---

## Task 1: Energy-normalize the bloom accumulation (CPU) — decouples Radius from brightness

**Files:**
- Modify: `glow-native/core/glow_params.h` (add `levelWeightNorm`)
- Modify: `glow-native/core/glow_core.cpp:135-160` (`bloom()` steps 3–4)
- Test: `glow-native/tests/glow_tests.cpp`

Root cause: `bloom()` sums every mip level weighted by `levelWeight()` **without dividing by the total weight** (Soft falloff over ~6 levels ≈ 3.6× built-in gain), so raising Radius also raises brightness. Fix: divide the accumulated glow color by the sum of the level weights. Because `applyTint()` is linear (homogeneous degree 1) in its RGB input, scaling the glow RGB by `wnorm` before tint/intensity is identical to multiplying it in at composite read — we scale at the composite read for a single, explicit edit. Alpha (glow coverage) is intentionally left un-normalized.

- [ ] **Step 1: Write the failing test**

Add these two helpers and the test to `glow-native/tests/glow_tests.cpp` (place the helpers after the existing `lumaRamp` helper near line 45, and the test after `test_AC1_threshold_direction`):

```cpp
static Image brightField(int W,int H){            // fully bright opaque field
    Image im(W,H);
    for(size_t i=0;i<im.px.size();i+=4){ im.px[i]=im.px[i+1]=im.px[i+2]=1.f; im.px[i+3]=1.f; }
    return im;
}

static void test_AC_energy_normalized_radius_decoupled(){
    // On a fully-bright field every qualifying pixel = 1.0, so a downsample +
    // upsample of the uniform field is still 1.0 at each level. After energy-
    // normalization the accumulated glow peak ~= 1.0 (the source brightness),
    // INDEPENDENT of how many mip levels the radius produced. Pre-fix the
    // un-normalized weight sum inflated this to ~3.6x for Soft falloff.
    Image src = brightField(128,128);
    Params a; a.threshold=0.10f; a.radius=30.f;  a.glowOnly=true; a.intensity=1.f;
    a.linearLight=false; a.tonemap=TONE_NONE; a.falloff=FALLOFF_SOFT; a.blendOp=BLEND_ADD;
    Params b=a; b.radius=240.f;
    float pa = bloom(src,a).at(64,64)[0];
    float pb = bloom(src,b).at(64,64)[0];
    CHECK(pa > 0.80f && pa < 1.25f);     // ~1x source brightness, NOT 3.6x
    CHECK(pb > 0.80f && pb < 1.25f);
    CHECK(std::fabs(pa-pb) < 0.15f);     // brightness decoupled from radius
}
```

Register it in `main()` (add the call right after `test_AC1_threshold_direction();`):

```cpp
    test_AC_energy_normalized_radius_decoupled();
```

- [ ] **Step 2: Build and run — verify it FAILS**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_tests
& glow-native/build-cuda/Release/glow_tests.exe
```

Expected: FAIL on `test_AC_energy_normalized_radius_decoupled` — `pa` (and `pb`) report ~3.6 (the un-normalized Soft-falloff weight sum), tripping `CHECK(pa < 1.25f)`.

- [ ] **Step 3: Add the shared normalization helper**

In `glow-native/core/glow_params.h`, add directly after `levelWeight()` (after line 63, before `autoLevels`):

```cpp
// Energy-normalization factor for the across-levels accumulation: 1 / sum of
// the per-level weights. Multiplying the accumulated glow by this makes the
// bloom energy-preserving, so Radius/Layers change spread & softness only, not
// brightness. Host-only (called on the host side of BOTH engines), so it stays
// in parity by construction.
inline float levelWeightNorm(int levels, int falloff) {
    if (levels < 1) levels = 1;
    float s = 0.f;
    for (int l = 0; l < levels; ++l) s += levelWeight(l, levels, falloff);
    return (s > 1e-6f) ? 1.f / s : 1.f;
}
```

- [ ] **Step 4: Apply the normalization in `bloom()`**

In `glow-native/core/glow_core.cpp`, in `bloom()` step 4, replace the glow-read line. Change:

```cpp
    // 4. per-pixel tint, intensity, tonemap, composite
    Image out(src.w, src.h);
    for (int y=0;y<src.h;++y) for (int x=0;x<src.w;++x){
        const float* s = lin.at(x,y);
        float gr=glow.at(x,y)[0], gg=glow.at(x,y)[1], gb=glow.at(x,y)[2];
```

to:

```cpp
    // 4. per-pixel tint, intensity, tonemap, composite
    //    Energy-normalize the accumulated glow color so Radius (= mip-level
    //    count) changes spread, not brightness. Alpha (coverage) is left as-is.
    const float wnorm = levelWeightNorm(n, p.falloff);
    Image out(src.w, src.h);
    for (int y=0;y<src.h;++y) for (int x=0;x<src.w;++x){
        const float* s = lin.at(x,y);
        float gr=glow.at(x,y)[0]*wnorm, gg=glow.at(x,y)[1]*wnorm, gb=glow.at(x,y)[2]*wnorm;
```

- [ ] **Step 5: Build and run — verify it PASSES**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_tests
& glow-native/build-cuda/Release/glow_tests.exe
```

Expected: `ALL TESTS PASSED`.

- [ ] **Step 6: Commit**

```powershell
git add glow-native/core/glow_params.h glow-native/core/glow_core.cpp glow-native/tests/glow_tests.cpp
git commit -m @'
feat(glow): energy-normalize bloom accumulation (CPU)

Divide the across-mip-levels glow by the sum of the level weights so Radius
changes spread, not brightness. Adds levelWeightNorm() shared helper + a
fully-bright-field test proving peak glow ~= source brightness regardless of
radius (was ~3.6x for Soft falloff).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 2: Energy-normalize the bloom accumulation (CUDA mirror) + parity

**Files:**
- Modify: `glow-native/cuda/glow_cuda.cu` (`k_composite` kernel + both host entries)
- Verify: `glow-native/cuda/glow_parity.cpp` (no edit; existing configs cover it)

Mirror Task 1 on the GPU: `k_composite` must scale the glow color by the same `wnorm`, computed host-side via the same `glow::levelWeightNorm(nmips, p.falloff)` and passed into the kernel.

- [ ] **Step 1: Add `wnorm` to the composite kernel**

In `glow-native/cuda/glow_cuda.cu`, change the `k_composite` signature and the glow read. Change:

```cpp
__global__ void k_composite(const float* lin, const float* glow, float* out,
                            int w, int h, Params p){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    float gr=glow[i], gg=glow[i+1], gb=glow[i+2];
```

to:

```cpp
__global__ void k_composite(const float* lin, const float* glow, float* out,
                            int w, int h, float wnorm, Params p){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    // Energy-normalize the glow color (mirror glow_core.cpp step 4). Alpha
    // (glow[i+3], read below) stays un-normalized — it is coverage, not energy.
    float gr=glow[i]*wnorm, gg=glow[i+1]*wnorm, gb=glow[i+2]*wnorm;
```

- [ ] **Step 2: Pass `wnorm` at both call sites**

In `glow_bloom_cuda` (the CPU-callable / parity path), change:

```cpp
        // 4. composite
        k_composite<<<g,block>>>(dLin, dGlow, dOut, w, h, p);
        CU_TRY(cudaGetLastError());
```

to:

```cpp
        // 4. composite
        float wnorm = glow::levelWeightNorm(nmips, p.falloff);
        k_composite<<<g,block>>>(dLin, dGlow, dOut, w, h, wnorm, p);
        CU_TRY(cudaGetLastError());
```

In `glow_bloom_cuda_gpu` (the AE GPU path), change:

```cpp
        k_composite<<<g,block>>>(dLin, dGlow, dOut, w, h, p);
        CU_TRY(cudaGetLastError());
```

to:

```cpp
        float wnorm = glow::levelWeightNorm(nmips, p.falloff);
        k_composite<<<g,block>>>(dLin, dGlow, dOut, w, h, wnorm, p);
        CU_TRY(cudaGetLastError());
```

(In `glow_bloom_cuda_gpu` this block sits right before the `if (p.linearLight){ k_lin_to_srgb... }` line.)

- [ ] **Step 3: Build and run parity — verify CPU == GPU**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_parity
& glow-native/build-cuda/Release/glow_parity.exe
```

Expected: `ALL PARITY CONFIGS PASSED` (every config `max diff < 1e-3`). If a config fails, the `wnorm` value diverges between homes — confirm both call `glow::levelWeightNorm(nmips, p.falloff)` with the actual built mip count.

- [ ] **Step 4: Commit**

```powershell
git add glow-native/cuda/glow_cuda.cu
git commit -m @'
feat(glow): mirror energy-normalization in CUDA + verify parity

k_composite scales glow color by wnorm (glow::levelWeightNorm), computed
host-side identically to the CPU engine. glow_parity stays <1e-3 across all
configs.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 3: Perceptual threshold (CPU) — selection matches the number

**Files:**
- Modify: `glow-native/core/glow_core.h:21` (declaration)
- Modify: `glow-native/core/glow_core.cpp:35-50` (`extractBright`) and `:122` (call in `bloom()`)
- Test: `glow-native/tests/glow_tests.cpp` (new test + update existing 3 callers)

Root cause: `extractBright` runs the qualifier on the already-linearized image, but the 0..255 Threshold is an sRGB-style number, so it qualifies far more of the frame than the number implies. Fix: compute the **mask** from the display/sRGB source while the **extracted color** stays linear. Refactor `extractBright(disp, lin, p)`: mask from `disp`, output color `= lin * mask * gain`. When `linearLight` is off, `disp == lin` and behavior is unchanged.

- [ ] **Step 1: Write the failing test**

Add this test to `glow-native/tests/glow_tests.cpp` after `test_range_default_is_legacy_highpass`:

```cpp
static void test_AC_perceptual_threshold_mask_from_display(){
    // The mask is built from the DISPLAY (sRGB) values so the Threshold number
    // matches what the user sees; the extracted COLOR stays linear so the blur
    // is physically correct. A mid-gray sRGB 0.5 patch (linear ~0.214) must
    // qualify at threshold 0.40. Pre-fix the mask ran on linear 0.214 (< 0.40
    // => wrongly excluded).
    Image disp(4,4), lin(4,4);
    for (size_t i=0;i<disp.px.size();i+=4){
        disp.px[i]=disp.px[i+1]=disp.px[i+2]=0.5f;   disp.px[i+3]=1.f; // sRGB 0.5
        lin.px[i] =lin.px[i+1] =lin.px[i+2] =0.214f; lin.px[i+3]=1.f;  // linear of 0.5
    }
    Params p; p.threshold=0.40f; p.thresholdSoft=0.0f; p.sourceGain=1.f;
    Image e = extractBright(disp, lin, p);
    CHECK(e.at(0,0)[3] > 0.99f);                       // mask from DISPLAY 0.5 >= 0.40 -> selected
    CHECK(std::fabs(e.at(0,0)[0]-0.214f) < 1e-4f);     // color stays LINEAR
}
```

Register it in `main()` after `test_range_default_is_legacy_highpass();`:

```cpp
    test_AC_perceptual_threshold_mask_from_display();
```

- [ ] **Step 2: Build — verify it FAILS to compile**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_tests
```

Expected: compile error — `extractBright` does not take 3 arguments yet. (This is the red state; the signature change in Step 3 makes it compile.)

- [ ] **Step 3: Change the signature, the body, the call site, and update existing callers**

In `glow-native/core/glow_core.h`, change line 21:

```cpp
Image extractBright(const Image& src, const Params& p);          // threshold/knee*gain -> bright buffer
```

to:

```cpp
Image extractBright(const Image& disp, const Image& lin, const Params& p); // mask from display, color from lin
```

In `glow-native/core/glow_core.cpp`, replace the whole `extractBright` function (lines 35-50) with:

```cpp
Image extractBright(const Image& disp, const Image& lin, const Params& p) {
    Image out(lin.w, lin.h);
    // The selection is a trapezoidal band on the chosen channel (luminance /
    // saturation / hue), feathered on both feet and optionally inverted. The
    // mask is qualified from `disp` (display / sRGB space) so the 0..255
    // Threshold matches what the user sees; the extracted COLOR comes from
    // `lin` (linear light) so the downstream blur stays physically correct.
    // With linearLight off the caller passes disp == lin and this is a no-op
    // change, so existing looks are unchanged.
    for (int y=0;y<lin.h;++y) for (int x=0;x<lin.w;++x){
        const float* d = disp.at(x,y);
        const float* l = lin.at(x,y);
        float v = selValue(d[0], d[1], d[2], p.rangeMode);
        float m = rangeMask(v, p.threshold, p.thresholdSoft,
                            p.rangeHigh, p.rangeSoftHigh, p.invertRange);
        float* o = out.at(x,y);
        o[0]=l[0]*m*p.sourceGain; o[1]=l[1]*m*p.sourceGain; o[2]=l[2]*m*p.sourceGain; o[3]=m;
    }
    return out;
}
```

In `glow-native/core/glow_core.cpp`, in `bloom()`, change the extract call (line 122):

```cpp
    // 1. extract bright source
    Image bright = extractBright(lin, p);
```

to:

```cpp
    // 1. extract bright source — mask from the display-space src (perceptual
    //    threshold), color from the (optionally linearized) lin.
    Image bright = extractBright(src, lin, p);
```

In `glow-native/tests/glow_tests.cpp`, update the existing direct callers to pass the same image as both `disp` and `lin` (these fixtures are already in display space and do not linearize, so `disp == lin` keeps them valid). Replace all occurrences of `extractBright(src,` with `extractBright(src, src,`:
- `test_AC1_threshold_direction`: `extractBright(src, lo)` / `(src, mid)` / `(src, hi)` → `extractBright(src, src, lo)` / `(src, src, mid)` / `(src, src, hi)`
- `test_range_band_selects_midtones`: `extractBright(src, p)` → `extractBright(src, src, p)`
- `test_range_invert_flips`: `extractBright(src, p)` → `extractBright(src, src, p)`
- `test_range_default_is_legacy_highpass`: `extractBright(src,lo)` → `extractBright(src, src, lo)` and `extractBright(src,hi)` → `extractBright(src, src, hi)`

- [ ] **Step 4: Build and run — verify it PASSES**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_tests
& glow-native/build-cuda/Release/glow_tests.exe
```

Expected: `ALL TESTS PASSED` (the new test passes; the updated legacy tests — including `test_range_default_is_legacy_highpass` — still pass because `disp == lin` makes them mask-equivalent to before).

- [ ] **Step 5: Commit**

```powershell
git add glow-native/core/glow_core.h glow-native/core/glow_core.cpp glow-native/tests/glow_tests.cpp
git commit -m @'
feat(glow): perceptual threshold — mask from display space (CPU)

extractBright(disp, lin, p): qualify the selection band on the display/sRGB
source so the 0..255 Threshold matches what the user sees, while the extracted
color stays linear for a physically-correct blur. linearLight off => disp==lin
(unchanged). Existing fixtures updated to the 3-arg form.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 4: Perceptual threshold (CUDA mirror) + parity

**Files:**
- Modify: `glow-native/cuda/glow_cuda.cu` (`k_extractBright` kernel + both host entries; add a display buffer)

Mirror Task 3 on the GPU: `k_extractBright` must qualify the mask from a display buffer (`dDisp`, the pre-linearization pixels) and pull color from the linear buffer (`dLin`). Add a `dDisp` device buffer to both host entries.

- [ ] **Step 1: Change the extract kernel to take separate display + linear inputs**

In `glow-native/cuda/glow_cuda.cu`, replace `k_extractBright`:

```cpp
__global__ void k_extractBright(const float* src, float* dst, int w, int h, Params p){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    float v = glow::selValue(src[i], src[i+1], src[i+2], p.rangeMode);
    float m = glow::rangeMask(v, p.threshold, p.thresholdSoft,
                              p.rangeHigh, p.rangeSoftHigh, p.invertRange);
    dst[i  ] = src[i  ]*m*p.sourceGain;
    dst[i+1] = src[i+1]*m*p.sourceGain;
    dst[i+2] = src[i+2]*m*p.sourceGain;
    dst[i+3] = m;
}
```

with:

```cpp
/* extractBright: mask qualified from `disp` (display/sRGB space) so the
   Threshold matches the user-visible number; color pulled from `lin` (linear)
   so the blur stays physically correct. Mirrors glow_core.cpp extractBright. */
__global__ void k_extractBright(const float* disp, const float* lin, float* dst,
                                int w, int h, Params p){
    int x = blockIdx.x*blockDim.x + threadIdx.x;
    int y = blockIdx.y*blockDim.y + threadIdx.y;
    if (x>=w || y>=h) return;
    size_t i = (size_t(y)*w + x)*4;
    float v = glow::selValue(disp[i], disp[i+1], disp[i+2], p.rangeMode);
    float m = glow::rangeMask(v, p.threshold, p.thresholdSoft,
                              p.rangeHigh, p.rangeSoftHigh, p.invertRange);
    dst[i  ] = lin[i  ]*m*p.sourceGain;
    dst[i+1] = lin[i+1]*m*p.sourceGain;
    dst[i+2] = lin[i+2]*m*p.sourceGain;
    dst[i+3] = m;
}
```

- [ ] **Step 2: Add a display buffer in `glow_bloom_cuda` (parity / CPU-callable path)**

In `glow_bloom_cuda`, add the `dDisp` declaration alongside the other buffers. Change:

```cpp
    float* dLin   = nullptr;  // (optionally linearized) source
    float* dBright= nullptr;  // extractBright output (full res)
    float* dGlow  = nullptr;  // accumulated upsample (full res, zeroed)
    float* dOut   = nullptr;  // composited output (full res)

    size_t full = (size_t)w*h*4*sizeof(float);

    CU_TRY(cudaMalloc(&dLin,   full));
    CU_TRY(cudaMalloc(&dBright,full));
    CU_TRY(cudaMalloc(&dGlow,  full));
    CU_TRY(cudaMalloc(&dOut,   full));

    CU_TRY(cudaMemcpy(dLin, rgbaIn, full, cudaMemcpyHostToDevice));
    CU_TRY(cudaMemset(dGlow, 0, full));
```

to:

```cpp
    float* dLin   = nullptr;  // (optionally linearized) source
    float* dDisp  = nullptr;  // display-space source (mask qualifier, pre-linearize)
    float* dBright= nullptr;  // extractBright output (full res)
    float* dGlow  = nullptr;  // accumulated upsample (full res, zeroed)
    float* dOut   = nullptr;  // composited output (full res)

    size_t full = (size_t)w*h*4*sizeof(float);

    CU_TRY(cudaMalloc(&dLin,   full));
    CU_TRY(cudaMalloc(&dDisp,  full));
    CU_TRY(cudaMalloc(&dBright,full));
    CU_TRY(cudaMalloc(&dGlow,  full));
    CU_TRY(cudaMalloc(&dOut,   full));

    CU_TRY(cudaMemcpy(dLin,  rgbaIn, full, cudaMemcpyHostToDevice));
    CU_TRY(cudaMemcpy(dDisp, rgbaIn, full, cudaMemcpyHostToDevice)); // display copy for the mask
    CU_TRY(cudaMemset(dGlow, 0, full));
```

Then change the linearize + extract block:

```cpp
        // 0. optional linearize (in place on dLin)
        if (p.linearLight){
            k_srgb_to_lin<<<g,block>>>(dLin, w, h);
            CU_TRY(cudaGetLastError());
        }

        // 1. extract bright
        k_extractBright<<<g,block>>>(dLin, dBright, w, h, p);
        CU_TRY(cudaGetLastError());
```

to:

```cpp
        // 0. optional linearize (in place on dLin; dDisp stays display-space)
        if (p.linearLight){
            k_srgb_to_lin<<<g,block>>>(dLin, w, h);
            CU_TRY(cudaGetLastError());
        }

        // 1. extract bright — mask from dDisp (display), color from dLin (linear)
        k_extractBright<<<g,block>>>(dDisp, dLin, dBright, w, h, p);
        CU_TRY(cudaGetLastError());
```

Finally add `dDisp` to the cleanup at `fail:`. Change:

```cpp
fail:
    for (int i=0;i<nmips;++i) if (mips[i].p) cudaFree(mips[i].p);
    if (dLin)    cudaFree(dLin);
    if (dBright) cudaFree(dBright);
    if (dGlow)   cudaFree(dGlow);
    if (dOut)    cudaFree(dOut);
    return err==cudaSuccess ? 0 : 2;
}

/* ================================================================== *
 *  AE GPU render path (PF_Cmd_SMART_RENDER_GPU).
```

to (this is the cleanup for `glow_bloom_cuda` — the first of the two; be sure to edit the one immediately preceding the "AE GPU render path" banner):

```cpp
fail:
    for (int i=0;i<nmips;++i) if (mips[i].p) cudaFree(mips[i].p);
    if (dLin)    cudaFree(dLin);
    if (dDisp)   cudaFree(dDisp);
    if (dBright) cudaFree(dBright);
    if (dGlow)   cudaFree(dGlow);
    if (dOut)    cudaFree(dOut);
    return err==cudaSuccess ? 0 : 2;
}

/* ================================================================== *
 *  AE GPU render path (PF_Cmd_SMART_RENDER_GPU).
```

- [ ] **Step 3: Add a display buffer in `glow_bloom_cuda_gpu` (AE GPU path)**

In `glow_bloom_cuda_gpu`, add the declaration. Change:

```cpp
    float* dLin   = nullptr;
    float* dBright= nullptr;
    float* dGlow  = nullptr;
    float* dOut   = nullptr;
```

to:

```cpp
    float* dLin   = nullptr;
    float* dDisp  = nullptr;  // display-space source (mask qualifier, pre-linearize)
    float* dBright= nullptr;
    float* dGlow  = nullptr;
    float* dOut   = nullptr;
```

Change the allocation block:

```cpp
    CU_TRY(cudaMalloc(&dLin,   full));
    CU_TRY(cudaMalloc(&dBright,full));
    CU_TRY(cudaMalloc(&dGlow,  full));
    CU_TRY(cudaMalloc(&dOut,   full));
    CU_TRY(cudaMemset(dGlow, 0, full));
    // Zero the canvas first so areas outside the input are transparent black.
    CU_TRY(cudaMemset(dLin,  0, full));
```

to:

```cpp
    CU_TRY(cudaMalloc(&dLin,   full));
    CU_TRY(cudaMalloc(&dDisp,  full));
    CU_TRY(cudaMalloc(&dBright,full));
    CU_TRY(cudaMalloc(&dGlow,  full));
    CU_TRY(cudaMalloc(&dOut,   full));
    CU_TRY(cudaMemset(dGlow, 0, full));
    // Zero both canvases first so areas outside the input are transparent black.
    CU_TRY(cudaMemset(dLin,  0, full));
    CU_TRY(cudaMemset(dDisp, 0, full));
```

Change the unpack + linearize + extract block:

```cpp
        // unpack AE BGRA(pitched) input (inW x inH) -> RGBA canvas (outW x outH)
        // at offset (offX,offY). Iterate the INPUT extent.
        k_bgra_to_rgba_offset<<<grid2d(inW,inH,block),block>>>(
            srcBGRA, srcPitch, inW, inH, dLin, w, h, offX, offY);
        CU_TRY(cudaGetLastError());

        if (p.linearLight){ k_srgb_to_lin<<<g,block>>>(dLin, w, h); CU_TRY(cudaGetLastError()); }

        k_extractBright<<<g,block>>>(dLin, dBright, w, h, p);
        CU_TRY(cudaGetLastError());
```

to:

```cpp
        // unpack AE BGRA(pitched) input (inW x inH) -> RGBA canvas (outW x outH)
        // at offset (offX,offY). Iterate the INPUT extent.
        k_bgra_to_rgba_offset<<<grid2d(inW,inH,block),block>>>(
            srcBGRA, srcPitch, inW, inH, dLin, w, h, offX, offY);
        CU_TRY(cudaGetLastError());

        // Keep a display-space copy for the mask qualifier before linearizing.
        CU_TRY(cudaMemcpy(dDisp, dLin, full, cudaMemcpyDeviceToDevice));

        if (p.linearLight){ k_srgb_to_lin<<<g,block>>>(dLin, w, h); CU_TRY(cudaGetLastError()); }

        k_extractBright<<<g,block>>>(dDisp, dLin, dBright, w, h, p);
        CU_TRY(cudaGetLastError());
```

Add `dDisp` to the `glow_bloom_cuda_gpu` cleanup. Change its `fail:` block:

```cpp
fail:
    for (int i=0;i<nmips;++i) if (mips[i].p) cudaFree(mips[i].p);
    if (dLin)    cudaFree(dLin);
    if (dBright) cudaFree(dBright);
    if (dGlow)   cudaFree(dGlow);
    if (dOut)    cudaFree(dOut);
    return err==cudaSuccess ? 0 : 2;
}
```

to:

```cpp
fail:
    for (int i=0;i<nmips;++i) if (mips[i].p) cudaFree(mips[i].p);
    if (dLin)    cudaFree(dLin);
    if (dDisp)   cudaFree(dDisp);
    if (dBright) cudaFree(dBright);
    if (dGlow)   cudaFree(dGlow);
    if (dOut)    cudaFree(dOut);
    return err==cudaSuccess ? 0 : 2;
}
```

(There are two identical `fail:` blocks; this is the second one — at the end of `glow_bloom_cuda_gpu`, the last function in the file.)

- [ ] **Step 4: Build and run parity — verify CPU == GPU**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_parity
& glow-native/build-cuda/Release/glow_parity.exe
```

Expected: `ALL PARITY CONFIGS PASSED`. The `DEFAULTS` config (linearLight=true) now exercises mask-from-display on both homes; both changed identically, so the bound stays `<1e-3`.

- [ ] **Step 5: Commit**

```powershell
git add glow-native/cuda/glow_cuda.cu
git commit -m @'
feat(glow): mirror perceptual threshold in CUDA + verify parity

k_extractBright qualifies the mask from a display-space buffer (dDisp) and
pulls color from the linear buffer (dLin), matching glow_core.cpp. Adds dDisp
to both CUDA host entries. glow_parity stays <1e-3.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 5: Perceptual Intensity curve (host-only, AE bridge)

**Files:**
- Modify: `glow-native/ae/DeepGlowGPU.cpp:263` (`ReadParams`)

Root cause: Intensity is a raw linear multiplier (`value/100`), so default 150 → 1.5× stacking on the (previously un-normalized) glow, with the top 80% of slider travel doing little. Fix: a power curve so low/mid travel is fine-grained and gentle while the top still reaches extreme HDR bloom. This feeds both CPU + GPU paths (`ReadParams` is shared) and is parity-trivial. `glow-native/ae/DeepGlowGPU.cpp` is NOT part of the CMake test build, so it is verified in-host (Task 11), not by `glow_tests`.

- [ ] **Step 1: Replace the linear Intensity mapping with the power curve**

In `glow-native/ae/DeepGlowGPU.cpp`, in `ReadParams`, change:

```cpp
    p.intensity     = (float)(params[DG_INTENSITY]->u.fs_d.value / 100.0);
```

to:

```cpp
    // Perceptual Intensity curve: remap the raw % through a power curve so the
    // low/mid slider travel is fine-grained (gentle default) while the top
    // still reaches extreme HDR bloom (re-curve, not a cap). Pnom is the % that
    // maps to a neutral ~1.0x glow; g is the curve exponent. Starting points —
    // tune live on the 4080 against the cookie shot, then lock the comment.
    {
        const float Pnom = 150.f;   // % -> ~1.0x neutral glow (with normalization)
        const float g    = 2.0f;    // exponent: gentle below Pnom, extreme at the top
        float P = (float)params[DG_INTENSITY]->u.fs_d.value;   // 0..1000 native
        p.intensity = powf(P / Pnom, g);
    }
```

- [ ] **Step 2: Confirm it compiles as part of the `.aex` build**

This file builds only in the `.aex` MSBuild (Task 11), not the CMake test build. Defer the build to Task 11; here, just re-read the edited block to confirm the curve is syntactically correct and `Pnom`/`g`/`P` are all used.

- [ ] **Step 3: Commit**

```powershell
git add glow-native/ae/DeepGlowGPU.cpp
git commit -m @'
feat(glow): perceptual Intensity power curve in ReadParams

Map the Intensity % through pow(P/Pnom, g) so low/mid travel is gentle and
controllable while the top still reaches extreme HDR bloom. Host-only, feeds
both CPU+GPU. Pnom/g are starting points to tune live.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 6: Grab the current frame (JSX `grabFrame` + dispatcher route)

**Files:**
- Modify: `jsx/glow.jsx` (add `grabFrame` + a render-queue fallback, export it)
- Modify: `jsx/dispatcher.jsx:22` (route `glow.grabFrame`)

Render the active comp's current frame to a temp PNG so the panel can show a real thumbnail + histogram and sample pixels. Primary path: `CompItem.saveFrameToPng(time, file)` (AE 2025+). Fallback: a minimal render-queue grab. Returns `{ path, width, height }` or `{ error }`.

- [ ] **Step 1: Add `grabFrame` (and the RQ fallback) to the Glow module**

In `jsx/glow.jsx`, add these two functions inside the IIFE, right before the `return { apply: apply };` line:

```javascript
  // Best-effort render-queue grab of the current frame to `file` (a File).
  // Fallback only — saveFrameToPng is the primary path on AE 2025+. PNG-sequence
  // output appends a frame number, so we locate + rename the produced file.
  function _rqGrab(comp, file) {
    var rqItem = app.project.renderQueue.items.add(comp);
    try {
      rqItem.timeSpanStart    = comp.time;
      rqItem.timeSpanDuration = comp.frameDuration;
      var om = rqItem.outputModule(1);
      try { om.applyTemplate('PNG Sequence'); } catch (e) {}
      om.file = file;
      rqItem.render = true;
      app.project.renderQueue.render();
      if (!file.exists) {
        var base = file.name.replace(/\.png$/i, '');
        var produced = file.parent.getFiles(function (f) {
          return f.name.indexOf(base) === 0 && /\.png$/i.test(f.name);
        });
        if (produced && produced.length) { produced[0].rename(file.name); }
      }
      return file.exists;
    } finally {
      try { rqItem.remove(); } catch (e2) {}
    }
  }

  // Render the active comp's current frame to a temp PNG. Returns { path, width,
  // height } for the panel to load (thumbnail + real histogram + click-to-pick).
  function grabFrame() {
    try {
      var comp = requireComp();
      var tmp = new File(Folder.temp.fsName + '/ae_glow_frame_' +
                         (new Date().getTime()) + '.png');
      var ok = false;
      if (typeof comp.saveFrameToPng === 'function') {
        comp.saveFrameToPng(comp.time, tmp);
        ok = tmp.exists;
      }
      if (!ok) { ok = _rqGrab(comp, tmp); }
      if (!ok) { return { error: 'Could not grab the current frame.' }; }
      return { path: tmp.fsName, width: comp.width, height: comp.height };
    } catch (e) {
      return { error: e.toString() };
    }
  }
```

Then change the export line:

```javascript
  return { apply: apply };
```

to:

```javascript
  return { apply: apply, grabFrame: grabFrame };
```

- [ ] **Step 2: Route the action in the dispatcher**

In `jsx/dispatcher.jsx`, change:

```javascript
        if      (action === 'glow.apply')          result = Glow.apply(params);
```

to:

```javascript
        if      (action === 'glow.apply')          result = Glow.apply(params);
        else if (action === 'glow.grabFrame')      result = Glow.grabFrame(params);
```

- [ ] **Step 3: Verify the JSX parses (syntax check)**

These files load into AE's ExtendScript engine; there is no standalone runner. Re-read the edited regions of both files and confirm: `grabFrame` and `_rqGrab` are inside the IIFE (above `return`), the export object includes `grabFrame`, and the dispatcher `else if` chain is intact. In-host smoke-test happens in Task 8 (the Grab button) and Task 11.

- [ ] **Step 4: Commit**

```powershell
git add jsx/glow.jsx jsx/dispatcher.jsx
git commit -m @'
feat(glow): grabFrame() — render current comp frame to temp PNG

Glow.grabFrame uses CompItem.saveFrameToPng with a render-queue fallback,
returns { path, width, height }. Routed via dispatcher as glow.grabFrame for
the panel frame preview / real histogram / click-to-pick.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 7: JS qualifier mirror + histogram (pure functions)

**Files:**
- Modify: `js/plugins/glow/ui.js` (add `selValueJS` + `computeHistogram` near the top of the IIFE)

Port `glow::selValue` (from `glow_params.h`) to JS so the panel computes the same luminance/saturation/hue qualifier the engine uses, for both the click-to-pick value and the real histogram. Display space, inputs 0..1.

- [ ] **Step 1: Add the qualifier + histogram functions**

In `js/plugins/glow/ui.js`, add these inside the `GlowUI` IIFE, right after the `function getParams() { ... }` line (around line 34):

```javascript
  // Mirror of glow::selValue (glow_params.h): qualifier value 0..1 for a pixel
  // under the current Range Mode, in DISPLAY space (matches the engine's now-
  // perceptual threshold). Keep bit-aligned with the C++ helper.
  function selValueJS(r, g, b, mode) {
    if (mode === 2) {                                  // saturation (HSV)
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mx <= 1e-6 ? 0 : (mx - mn) / mx;
    }
    if (mode === 3) {                                  // hue 0..1
      var hmx = Math.max(r, g, b), hmn = Math.min(r, g, b), d = hmx - hmn;
      if (d <= 1e-6) return 0;
      var h;
      if      (hmx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (hmx === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      return h / 6;
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;       // luminance (Rec.709)
  }

  // 256-bin distribution of the qualifier over a canvas ImageData, normalized
  // to 0..1 (peak bin = 1). Skips fully-transparent pixels. Drawn behind the
  // selection band on the same 0..255 axis.
  function computeHistogram(imageData, mode) {
    var bins = new Array(256), i;
    for (i = 0; i < 256; i++) bins[i] = 0;
    var px = imageData.data, n = px.length, mx = 0;
    for (var p = 0; p < n; p += 4) {
      if (px[p + 3] === 0) continue;
      var v = selValueJS(px[p] / 255, px[p + 1] / 255, px[p + 2] / 255, mode);
      var b = v < 0 ? 0 : (v > 1 ? 255 : Math.round(v * 255));
      bins[b]++; if (bins[b] > mx) mx = bins[b];
    }
    if (mx > 0) for (var k = 0; k < 256; k++) bins[k] /= mx;
    return bins;
  }
```

- [ ] **Step 2: Verify the qualifier matches the C++ helper (Node, optional)**

If Node is installed, sanity-check `selValueJS` against known values of `glow::selValue`. Run:

```powershell
node -e "function selValueJS(r,g,b,mode){if(mode===2){var mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx<=1e-6?0:(mx-mn)/mx;}if(mode===3){var hmx=Math.max(r,g,b),hmn=Math.min(r,g,b),d=hmx-hmn;if(d<=1e-6)return 0;var h;if(hmx===r)h=(g-b)/d+(g<b?6:0);else if(hmx===g)h=(b-r)/d+2;else h=(r-g)/d+4;return h/6;}return 0.2126*r+0.7152*g+0.0722*b;} var ok=Math.abs(selValueJS(1,0,0,1)-0.2126)<1e-4 && Math.abs(selValueJS(0.5,0.5,0.5,1)-0.5)<1e-4 && Math.abs(selValueJS(1,0,0,2)-1)<1e-4 && Math.abs(selValueJS(1,0,0,3)-0)<1e-4 && Math.abs(selValueJS(0,1,0,3)-(1/3))<1e-4; console.log(ok?'QUALIFIER OK':'QUALIFIER MISMATCH'); process.exit(ok?0:1);"
```

Expected: `QUALIFIER OK`. (Red=luma 0.2126, gray 0.5; red saturation 1.0; red hue 0.0; green hue 1/3.) If Node is not installed, skip — the in-host histogram in Task 8/11 is the real check.

- [ ] **Step 3: Commit**

```powershell
git add js/plugins/glow/ui.js
git commit -m @'
feat(glow): JS qualifier mirror + histogram helpers

selValueJS ports glow::selValue (luma/sat/hue) to the panel; computeHistogram
builds a 256-bin normalized distribution from canvas pixels. Used by the real
histogram backdrop and click-to-pick.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 8: In-panel frame preview, real histogram, and click-to-pick

**Files:**
- Modify: `js/plugins/glow/ui.js` (`makeGlowSelection` histogram backdrop + setter; `init()` thumbnail, grab button, click-to-pick, mode-change refresh)

Replace the synthetic decorative histogram with a real one computed from a grabbed frame; add a clickable frame thumbnail that is the real eyedropper. The panel can't intercept AE-viewer clicks, so picking happens on the in-panel frame.

- [ ] **Step 1: Give the selection widget a real-histogram backdrop + a setter**

In `js/plugins/glow/ui.js`, in `makeGlowSelection`, add a closure variable. Change:

```javascript
    var ctx = cv.getContext('2d');
    var W = 300, H = 150, PAD = 2, railTop = 18, railBot = H - 22, IMAX = 400;
    var dragging = null, eyedrop = false;
```

to:

```javascript
    var ctx = cv.getContext('2d');
    var W = 300, H = 150, PAD = 2, railTop = 18, railBot = H - 22, IMAX = 400;
    var dragging = null, eyedrop = false, frameHist = null; // real 256-bin histogram or null
```

Replace the decorative backdrop block in `draw()`:

```javascript
      // decorative distribution backdrop (placeholder until real AE histogram)
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.moveTo(PAD, railBot);
      for (var x = 0; x <= W; x += 4) { var t = x / W;
        var h = Math.exp(-Math.pow((t - 0.42) / 0.16, 2)) * 0.7 + Math.exp(-Math.pow((t - 0.8) / 0.08, 2)) * 0.45;
        ctx.lineTo(PAD + x, railBot - (railBot - railTop) * h * 0.9); }
      ctx.lineTo(W - PAD, railBot); ctx.closePath(); ctx.fill();
```

with:

```javascript
      // distribution backdrop: a REAL qualifier histogram of the grabbed frame
      // when available (on the same 0..255 axis as the band), else a faint
      // placeholder curve so the widget still reads before any grab.
      ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.beginPath(); ctx.moveTo(PAD, railBot);
      if (frameHist) {
        for (var hx = 0; hx <= 255; hx++) {
          ctx.lineTo(xOf(hx), railBot - (railBot - railTop) * frameHist[hx] * 0.92);
        }
      } else {
        for (var x = 0; x <= W; x += 4) { var t = x / W;
          var h = Math.exp(-Math.pow((t - 0.42) / 0.16, 2)) * 0.7 + Math.exp(-Math.pow((t - 0.8) / 0.08, 2)) * 0.45;
          ctx.lineTo(PAD + x, railBot - (railBot - railTop) * h * 0.9); }
      }
      ctx.lineTo(W - PAD, railBot); ctx.closePath(); ctx.fill();
```

Then expose a setter on the returned object. Change:

```javascript
    return {
      el: cv, draw: draw, fit: fit,
      setMode: function(m){ state.rangeMode = m; draw(); },
      setEyedrop: function(on){ eyedrop = on; cv.style.cursor = on ? 'copy' : 'crosshair'; }
    };
```

to:

```javascript
    return {
      el: cv, draw: draw, fit: fit,
      setMode: function(m){ state.rangeMode = m; draw(); },
      setHistogram: function(arr){ frameHist = arr; draw(); },
      setEyedrop: function(on){ eyedrop = on; cv.style.cursor = on ? 'copy' : 'crosshair'; }
    };
```

- [ ] **Step 2: Add the frame thumbnail, grab button, and click-to-pick in `init()`**

In `js/plugins/glow/ui.js`, in `init()`, the block that creates `_glowSel` and appends it currently reads (around line 227):

```javascript
    _glowSel = makeGlowSelection(_state, _applyLive, syncSliders);
    container.appendChild(_glowSel.el);
    _rangeModeGroup = new ButtonGroup({
```

Replace it with (inserts the thumbnail + grab button + a histogram-refresh helper between the band and the Range Mode buttons):

```javascript
    _glowSel = makeGlowSelection(_state, _applyLive, syncSliders);
    container.appendChild(_glowSel.el);

    // ── Frame preview (real eyedropper) ──────────────────────────────────────
    // A grabbed comp frame. Clicking it samples the real pixel and centers the
    // band; grabbing also rebuilds the histogram behind the band.
    var _thumbCv = Utils.el('canvas', { class: 'glow-thumb' });
    _thumbCv.style.width = '100%'; _thumbCv.style.height = '90px';
    _thumbCv.style.display = 'block'; _thumbCv.style.borderRadius = '8px';
    _thumbCv.style.cursor = 'crosshair'; _thumbCv.style.marginTop = '6px';
    var _thumbCtx = _thumbCv.getContext('2d');
    var _thumbLoaded = false;
    container.appendChild(_thumbCv);

    function refreshHistogram() {
      if (!_thumbLoaded) return;
      var data = _thumbCtx.getImageData(0, 0, _thumbCv.width, _thumbCv.height);
      _glowSel.setHistogram(computeHistogram(data, _state.rangeMode));
    }

    var grabBtn = Utils.el('button', { class: 'mini-btn' }, 'Grab Frame ⤓');
    grabBtn.addEventListener('click', function () {
      var old = grabBtn.textContent; grabBtn.disabled = true; grabBtn.textContent = 'grabbing frame…';
      Bridge.call('glow.grabFrame', {}).then(function (r) {
        grabBtn.disabled = false; grabBtn.textContent = old;
        if (!r || r.error) {
          if (_status) { _status.className = 'status-bar error'; _status.textContent = (r && r.error) || 'Grab failed.'; }
          return;
        }
        var img = new Image();
        img.onload = function () {
          var dpr = window.devicePixelRatio || 1;
          var cw = _thumbCv.clientWidth || 280, ch = 90;
          _thumbCv.width = Math.round(cw * dpr); _thumbCv.height = Math.round(ch * dpr);
          _thumbCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          _thumbCtx.clearRect(0, 0, cw, ch);
          _thumbCtx.drawImage(img, 0, 0, cw, ch);
          _thumbLoaded = true;
          refreshHistogram();
          if (_status) { _status.className = 'status-bar success'; _status.textContent = 'Frame grabbed — click it to pick.'; }
        };
        img.onerror = function () {
          if (_status) { _status.className = 'status-bar error'; _status.textContent = 'Could not load grabbed frame.'; }
        };
        img.src = 'file:///' + String(r.path).replace(/\\/g, '/');
      }).catch(function (e) {
        grabBtn.disabled = false; grabBtn.textContent = old;
        if (_status) { _status.className = 'status-bar error'; _status.textContent = e.message; }
      });
    });
    container.appendChild(grabBtn);

    // Click the frame: sample the pixel, compute its qualifier for the current
    // Range Mode, and center the band on it with soft feet (mirrors centerBand).
    _thumbCv.addEventListener('click', function (e) {
      if (!_thumbLoaded) return;
      var r = _thumbCv.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var px = Math.round((e.clientX - r.left) * dpr);
      var py = Math.round((e.clientY - r.top) * dpr);
      px = Math.max(0, Math.min(_thumbCv.width - 1, px));
      py = Math.max(0, Math.min(_thumbCv.height - 1, py));
      var d = _thumbCtx.getImageData(px, py, 1, 1).data;
      var v = selValueJS(d[0] / 255, d[1] / 255, d[2] / 255, _state.rangeMode) * 255;
      _state.threshold = Math.max(0, v - 22);
      _state.rangeHigh = Math.min(255, v + 22);
      _state.thresholdSoftness = 14; _state.rangeHighSoft = 14;
      _glowSel.draw(); syncSliders(); _applyLive();
    });

    _rangeModeGroup = new ButtonGroup({
```

- [ ] **Step 3: Rebuild the histogram when the Range Mode changes**

In the same `init()`, the `_rangeModeGroup` `onChange` currently reads:

```javascript
      onChange: function(v) { _state.rangeMode = v; _glowSel.setMode(v); _applyLive(); }
```

Change it to also refresh the histogram for the new qualifier:

```javascript
      onChange: function(v) { _state.rangeMode = v; _glowSel.setMode(v); refreshHistogram(); _applyLive(); }
```

- [ ] **Step 4: Repoint the legacy "Pick ⌖" button as a secondary affordance**

The existing `eyeBtn` (strip eyedrop) stays as a secondary affordance — no code change required; the frame thumbnail is now the primary, real eyedropper. Leave `eyeBtn` and its handler as-is.

- [ ] **Step 5: In-host smoke check (deferred to Task 11)**

There is no JS test runner in this project. The thumbnail load, histogram, and click-to-pick are verified live in AE in Task 11 (open the panel, click **Grab Frame**, confirm the frame shows, the histogram behind the band matches the footage, and clicking the frame recenters the band). Confirm now only that the file parses (no syntax errors) by re-reading the edited regions.

- [ ] **Step 6: Commit**

```powershell
git add js/plugins/glow/ui.js
git commit -m @'
feat(glow): real frame preview, histogram, and click-to-pick

Grab Frame renders the current comp frame (glow.grabFrame), shows it as a
clickable thumbnail, and replaces the synthetic backdrop with a real qualifier
histogram. Clicking the frame samples the pixel and centers the selection band;
the histogram rebuilds on Range Mode change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 9: Rebuild the 5 factory presets (bright-spectrum, smooth & soft)

**Files:**
- Modify: `js/factory-presets.js:5-36` (the `glow` block)

Rewrite the 5 presets (keep the names) with the **full native field set** so `applyPreset()` drives the native engine fully. Every preset targets the bright spectrum (higher feathered `threshold`, open `rangeHigh`), reads soft (`falloff: 'soft'`, generous `radius`, `linearLight: true`, `tonemap: 2` with `highlightComp`), and uses gentle intensity in the new perceptual-curve units (150 ≈ neutral). Numbers are starting points — tune live on the cookie shot.

- [ ] **Step 1: Replace the glow preset block**

In `js/factory-presets.js`, replace the entire `glow: { ... }` block (lines 5-36) with:

```javascript
  glow: {
    // Every preset targets the BRIGHT spectrum (feathered threshold, open top)
    // and reads soft (soft falloff, big radius, linear light, soft-clip tonemap).
    // Intensity is in the new perceptual-curve units (150 ~= neutral 1.0x).
    // Numbers are starting points — tuned live on real footage (cookie shot).
    'Soft Bloom': {
      intensity: 150, radius: 120, layers: 3, falloff: 'soft',
      threshold: 190, thresholdSoftness: 55,
      rangeMode: 1, rangeHigh: 255, rangeHighSoft: 0, invertRange: false,
      sourceGain: 100, glowColor: '#ffffff', colorize: false, tintAmount: 0,
      saturation: 0, hueShift: 0, blendMode: 'screen', glowDimensions: 'both',
      glowOnly: false, linearLight: true, tonemap: 2, highlightComp: 40,
      quality: 'quality'
    },
    'Neon': {
      intensity: 220, radius: 55, layers: 3, falloff: 'soft',
      threshold: 175, thresholdSoftness: 45,
      rangeMode: 1, rangeHigh: 255, rangeHighSoft: 0, invertRange: false,
      sourceGain: 110, glowColor: '#ff5bf0', colorize: true, tintAmount: 0,
      saturation: 25, hueShift: 0, blendMode: 'screen', glowDimensions: 'both',
      glowOnly: false, linearLight: true, tonemap: 2, highlightComp: 35,
      quality: 'quality'
    },
    'Aura': {
      intensity: 170, radius: 200, layers: 4, falloff: 'soft',
      threshold: 150, thresholdSoftness: 70,
      rangeMode: 1, rangeHigh: 255, rangeHighSoft: 0, invertRange: false,
      sourceGain: 100, glowColor: '#7c8cff', colorize: true, tintAmount: 0,
      saturation: 12, hueShift: 6, blendMode: 'screen', glowDimensions: 'both',
      glowOnly: false, linearLight: true, tonemap: 2, highlightComp: 45,
      quality: 'quality'
    },
    'Flare': {
      intensity: 240, radius: 90, layers: 3, falloff: 'soft',
      threshold: 215, thresholdSoftness: 35,
      rangeMode: 1, rangeHigh: 255, rangeHighSoft: 0, invertRange: false,
      sourceGain: 100, glowColor: '#fff4d6', colorize: false, tintAmount: 0,
      saturation: 0, hueShift: 0, blendMode: 'add', glowDimensions: 'both',
      glowOnly: false, linearLight: true, tonemap: 2, highlightComp: 30,
      quality: 'quality'
    },
    'Dreamy': {
      intensity: 130, radius: 220, layers: 3, falloff: 'soft',
      threshold: 165, thresholdSoftness: 75,
      rangeMode: 1, rangeHigh: 255, rangeHighSoft: 0, invertRange: false,
      sourceGain: 100, glowColor: '#ffd9bf', colorize: true, tintAmount: 0,
      saturation: -12, hueShift: 0, blendMode: 'screen', glowDimensions: 'both',
      glowOnly: false, linearLight: true, tonemap: 2, highlightComp: 50,
      quality: 'quality'
    }
  },
```

- [ ] **Step 2: Verify the file parses (Node, optional)**

If Node is installed, confirm the object literal is valid and every preset carries the full field set:

```powershell
node -e "global.window={}; require('./js/factory-presets.js'); var g=global.window.FactoryPresets.glow; var need=['intensity','radius','layers','falloff','threshold','thresholdSoftness','rangeMode','rangeHigh','rangeHighSoft','invertRange','sourceGain','glowColor','colorize','tintAmount','saturation','hueShift','blendMode','glowDimensions','glowOnly','linearLight','tonemap','highlightComp','quality']; var names=Object.keys(g); var ok = names.length===5; names.forEach(function(n){ need.forEach(function(k){ if(!(k in g[n])){ ok=false; console.log('MISSING',n,k);} }); }); console.log(ok?'PRESETS OK ('+names.join(', ')+')':'PRESETS INCOMPLETE'); process.exit(ok?0:1);"
```

Expected: `PRESETS OK (Soft Bloom, Neon, Aura, Flare, Dreamy)`. If Node is unavailable, skip — visual acceptance is in Task 11.

- [ ] **Step 3: Commit**

```powershell
git add js/factory-presets.js
git commit -m @'
feat(glow): rebuild 5 factory presets for the native engine

Same 5 names, now with the full native field set (rangeMode, thresholdSoftness,
rangeHigh, linearLight, tonemap, highlightComp, glowDimensions, sourceGain,
glowColor). Every preset targets the bright spectrum and reads soft. Numbers
are starting points to tune live.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Task 10: Full engine build + parity gate

**Files:** none (verification gate over all engine changes from Tasks 1–4).

- [ ] **Step 1: Rebuild both engine targets clean**

```powershell
cmake --build glow-native/build-cuda --config Release --target glow_tests glow_parity
```

Expected: both build with no warnings-as-errors / failures.

- [ ] **Step 2: Run the CPU acceptance tests**

```powershell
& glow-native/build-cuda/Release/glow_tests.exe
```

Expected: `ALL TESTS PASSED` — including the two new tests (`test_AC_energy_normalized_radius_decoupled`, `test_AC_perceptual_threshold_mask_from_display`) and all updated legacy tests.

- [ ] **Step 3: Run the CPU/GPU parity gate**

```powershell
& glow-native/build-cuda/Release/glow_parity.exe
```

Expected: `ALL PARITY CONFIGS PASSED` (all configs `< 1e-3`). This is the hard gate confirming 1a + 1c are bit-identical across both homes.

- [ ] **Step 4: No commit** — verification only. If anything fails, return to the owning task before continuing.

---

## Task 11: Build the `.aex`, install, restart AE, in-host verify

**Files:** none (produces `glow-native/build-ae/DeepGlowGPU.aex` and verifies the whole retune in AE). Several steps are human-in-the-loop (admin copy, AE restart, subjective tuning) — flag them clearly to the user.

- [ ] **Step 1: Build the `.aex`**

Run in an **x64 Native Tools Command Prompt for VS 2022** (so the PiPL step's `cl.exe` is on PATH), per the project build recipe:

```bat
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
set "AE_PLUGIN_BUILD_DIR=D:\apps\AE_PLUGINS\glow-native\build-ae\"
msbuild glow-native\ae\DeepGlowGPU.vcxproj /p:Configuration=Release /p:Platform=x64 "/p:CudaToolkitDir=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.3\"
```

Expected: `Build succeeded`, output `glow-native\build-ae\DeepGlowGPU.aex`. (This is the build that compiles the Task 5 Intensity curve in `DeepGlowGPU.cpp`. If it fails on the curve edit, fix it here.)

- [ ] **Step 2: Install the plugin (admin) and restart AE — USER ACTION**

Copying into the AE Plug-ins folder needs elevation, and a panel reload does NOT reload the `.aex`. Ask the user to: close AE, copy `glow-native\build-ae\DeepGlowGPU.aex` into `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Plug-ins\` (Explorer drag → "Continue" UAC, or an elevated shell), then relaunch AE. Wait for confirmation before proceeding.

- [ ] **Step 3: Verify the engine retune on real footage — USER-OBSERVED**

On a bright real shot (e.g. the cookie/product shot), apply Deep Glow from the panel and confirm:
- **Intensity feels smooth end-to-end** — small moves stay controllable across the whole range; the default is a gentle bloom, and the top still reaches extreme HDR bloom. If the default or the feel is off, tune `Pnom`/`g` in `ReadParams` (Task 5), rebuild (Step 1), reinstall (Step 2), and re-check. Lock the final values in the code comment.
- **Radius changes spread, not brightness** — sweeping Radius widens/softens the glow without making it brighter or dimmer.
- **Threshold selects intuitively** — the 0..255 number matches what gets glowing (highlights only at high threshold), not "everything glows."

- [ ] **Step 4: Verify the real eyedropper + histogram — USER-OBSERVED**

In the Glow Selection widget: click **Grab Frame** → the current frame appears as a thumbnail and the histogram behind the band matches the footage's actual distribution (not the old synthetic curve). Click a bright spot on the thumbnail → the band recenters on that value and the glow updates live. Switch Range Mode (Luma/Sat/Hue) → the histogram rebuilds for the new qualifier.

- [ ] **Step 5: Verify the presets — USER-OBSERVED**

Apply each of the 5 presets (Soft Bloom, Neon, Aura, Flare, Dreamy) to the cookie footage. Each must produce a **soft, highlight-targeted** glow that does **not** wash the frame. Tune the preset numbers in `js/factory-presets.js` (Task 9) as needed; preset edits are panel-side and need only a panel reload, not an `.aex` rebuild.

- [ ] **Step 6: Final commit (any in-host tuning)**

If `Pnom`/`g` or preset numbers were tuned during verification, commit the final values:

```powershell
git add glow-native/ae/DeepGlowGPU.cpp js/factory-presets.js
git commit -m @'
chore(glow): lock tuned Intensity curve + preset values

Final Pnom/g and preset numbers from the in-host pass on real footage.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
'@
```

---

## Self-Review

**Spec coverage:**
- WS1.1a energy-normalize → Tasks 1 (CPU) + 2 (CUDA/parity). ✔
- WS1.1b perceptual Intensity curve → Task 5 (host-only), tuned in Task 11. ✔
- WS1.1c perceptual threshold → Tasks 3 (CPU, signature refactor + fixtures) + 4 (CUDA/parity). ✔
- Parity rule → Tasks 2, 4, 10 (`glow_parity.exe < 1e-3`). ✔
- WS2.2a `grabFrame` (saveFrameToPng + RQ fallback, returns path+dims) → Task 6. ✔
- WS2.2b in-panel preview + real histogram (replaces synthetic backdrop) → Tasks 7 + 8. ✔
- WS2.2c click-to-pick (qualifier per Range Mode, center band w/ soft feet) → Tasks 7 + 8. ✔
- WS3 preset rebuild (5 names, full native field set, bright-spectrum + soft) → Task 9. ✔
- WS4 build · parity · verify (tests, parity, `.aex`, restart, in-host) → Tasks 10 + 11. ✔
- Non-goals respected: no hard cap (curve only), Source Gain unchanged, no panel-layout redesign, no new params, tonemap default unchanged. ✔

**Type/signature consistency:** `extractBright(disp, lin, p)` is changed identically in `glow_core.h` (decl), `glow_core.cpp` (def + `bloom()` call), `glow_tests.cpp` (callers), and `glow_cuda.cu` (`k_extractBright` + both host entries). `levelWeightNorm(int levels, int falloff)` is defined once in `glow_params.h` and called by name in both homes. `k_composite` gains a `float wnorm` parameter, added at both call sites. `glow.grabFrame` is exported in `glow.jsx`, routed in `dispatcher.jsx`, and called as `'glow.grabFrame'` in `ui.js`. `selValueJS`/`computeHistogram`/`refreshHistogram`/`setHistogram` names are consistent across Tasks 7–8.

**Placeholder scan:** every code step shows complete code; no TBD/TODO/"handle edge cases". The only deliberately-deferred items are the subjective curve/preset numbers (explicitly "starting points, tune live" per the spec) and the human-in-the-loop install/restart/observe steps in Task 11.

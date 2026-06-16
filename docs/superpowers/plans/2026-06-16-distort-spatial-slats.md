# Distort Flow — Spatial Rows/Slats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Slats mode to Distort Flow — frame sliced into Rows/Columns that slide (auto-weave), driven by the existing map+flow — plus a Distort Flow preset set.

**Architecture:** Single-frame extension of the CPU engine. A new mutually-exclusive branch in `warpBand` computes a per-band rigid shift (rows→X, cols→Y) from the map field sampled at each band's center, reusing `mapValue`/`flowWeight`/`flowJitter`/`sampleBilinear`. Three new params flow through `distort_params.h` → `DistortFlow.aex` → the CEP panel. Presets are flat param blobs in `factory-presets.js`.

**Tech Stack:** C++ (portable core, MSVC), AE SDK 25.6 (`DistortFlow.aex`), CEP panel JS/ExtendScript.

**Spec:** `docs/superpowers/specs/2026-06-16-distort-spatial-slats-design.md`

**Build/test commands (PowerShell, from repo root `D:\apps\AE_PLUGINS`):**
- Core tests: `& ".\distort-native\build-cli.bat"; & ".\distort-native\build\distort_tests.exe"` → prints `ALL PASS`
- `.aex`: `cmd /c '"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" && msbuild distort-native\ae\DistortFlow.vcxproj /p:Configuration=Release /p:Platform=x64'` → `distort-native\build-ae\DistortFlow.aex`

---

## File Structure

- `distort-native/core/distort_params.h` — add 3 slat fields to `Params`.
- `distort-native/core/distort_core.cpp` — extract `fieldAtAnchor` helper (DRY refactor of the existing inline field block), add the slat branch in `warpBand`.
- `distort-native/tests/distort_tests.cpp` — `ramp_y` helper + 3 slat tests.
- `distort-native/ae/DistortFlow.h` — 3 enum entries.
- `distort-native/ae/DistortFlow.cpp` — `ParamsSetup` + `ReadParams` for the 3 params.
- `js/plugins/distortions/ui.js` — Slats section, 3 state fields, harden `applyPreset` built-in setValue calls.
- `jsx/distortflow.jsx` — push 3 params by display name.
- `js/factory-presets.js` — 6 Distort Flow presets + `engine:'builtin'` tags on the 5 existing presets.

---

## Task 1: Extract `fieldAtAnchor` helper (DRY refactor, no behavior change)

**Files:**
- Modify: `distort-native/core/distort_core.cpp` (the inline field block in `warpBand`, lines ~68-78)

- [ ] **Step 1: Add the helper above `warpBand`**

Insert after `sampleBilinear` (after line 51), before the `warpBand` comment:

```cpp
// Signed map field in [-1,1] at a pixel anchor (ax,ay). Generators via mapValue;
// MAP_LAYER samples the layer's luma/channel. Shared by the smooth and slat paths.
static inline float fieldAtAnchor(const Params& P, const Image* mapLayer,
                                  int W, int H, float ax, float ay){
    float u=((ax+0.5f)/W)*2.f-1.f;
    float v=((ay+0.5f)/H)*2.f-1.f;
    if (P.mapType==MAP_LAYER && mapLayer){
        float mx=((ax+0.5f)/W)*mapLayer->w-0.5f;
        float my=((ay+0.5f)/H)*mapLayer->h-0.5f;
        float m[4]; sampleBilinear(*mapLayer,mx,my,EDGE_CLAMP,m);
        float val=(P.mapChannel==1)?m[0]:(P.mapChannel==2)?m[1]:(P.mapChannel==3)?m[2]:lumaRec709(m[0],m[1],m[2]);
        return ds_remap(ds_clamp(2.f*val-1.f,-1.f,1.f), P.mapContrast);
    }
    return mapValue(P,u,v);
}
```

- [ ] **Step 2: Replace the inline field block in `warpBand` with a helper call**

Replace lines ~66-78 (from `float u=((ax+0.5f)...` through the `field = mapValue(P,u,v); }` block) with:

```cpp
            float u=((ax+0.5f)/src.w)*2.f-1.f;
            float v=((ay+0.5f)/src.h)*2.f-1.f;
            float field = fieldAtAnchor(P, mapLayer, src.w, src.h, ax, ay);
```

(The lines below — `float ff = ds_clamp(field*flowWeight(P,u,v)...` onward — stay unchanged.)

- [ ] **Step 3: Build + run tests, expect no regression**

Run: `& ".\distort-native\build-cli.bat"; & ".\distort-native\build\distort_tests.exe"`
Expected: `ALL PASS` (identity, known_shift, mosaic, layer_map, opacity all still pass — proves the refactor is behavior-preserving).

- [ ] **Step 4: Commit**

```bash
git add distort-native/core/distort_core.cpp
git commit -m "refactor(distort-native): extract fieldAtAnchor helper (no behavior change)"
```

---

## Task 2: Slat params + weave branch in the engine (TDD)

**Files:**
- Modify: `distort-native/core/distort_params.h` (add fields)
- Modify: `distort-native/core/distort_core.cpp` (`warpBand` slat branch)
- Test: `distort-native/tests/distort_tests.cpp`

- [ ] **Step 1: Add the slat fields to `Params`**

In `distort-native/core/distort_params.h`, after the `mosaicBlock` line (line 49), inside `struct Params`:

```cpp
    // slats (auto-weave): rigid Rows/Cols that slide (rows->X, cols->Y). 0 = off.
    int   slatRows    = 0;
    int   slatCols    = 0;
    float slatStagger = 0.f;   // 0..1; alternate bands flip direction (over/under weave)
```

- [ ] **Step 2: Add `ramp_y` helper + 3 slat tests to the test file**

In `distort-native/tests/distort_tests.cpp`, after `ramp_x` (line 106) add:

```cpp
static Image ramp_y(int w,int h){                     // red channel = y index
    Image im(w,h);
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float* p=im.at(x,y); p[0]=(float)y; p[1]=0;p[2]=0;p[3]=1.f; }
    return im;
}
```

After `test_warp_mosaic_blocks` (line 131) add:

```cpp
static void test_warp_slats_rows_uniform_shift(){
    // gradient spacing=0 -> field +1 everywhere; rows=2, stagger=0, amount=2.
    // auto-weave rows slide +X by amount => dst red == src red at x+2 (clamp).
    Image src=ramp_x(8,4), dst(8,4);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=2.f;
    P.edgeMode=EDGE_CLAMP; P.slatRows=2; P.slatStagger=0.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(3,0)[0], 5.f, 1e-4f);                 // x=3 -> src 5, band 0
    NEAR(dst.at(3,3)[0], 5.f, 1e-4f);                 // band 1 same (spacing0 uniform)
    NEAR(dst.at(6,0)[0], 7.f, 1e-4f);                 // x+2=8 -> clamp 7
}
static void test_warp_slats_stagger_alternates_bands(){
    // spacing0 field +1, rows=2 over h=4 (band0=y0..1, band1=y2..3), stagger=1, amount=2.
    // band0 (ri=0 even) sign +1 -> shift +2; band1 (ri=1 odd) sign -1 -> shift -2.
    Image src=ramp_x(8,4), dst(8,4);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=2.f;
    P.edgeMode=EDGE_CLAMP; P.slatRows=2; P.slatStagger=1.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(3,0)[0], 5.f, 1e-4f);                 // band0: x+2 = 5
    NEAR(dst.at(3,2)[0], 1.f, 1e-4f);                 // band1: x-2 = 1
}
static void test_warp_slats_cols_uniform_shift(){
    // cols=2, spacing0 field +1, stagger0, amount2 -> shift +Y by 2. ramp_y red=y.
    Image src=ramp_y(4,8), dst(4,8);
    Params P; P.mapType=MAP_GRADIENT; P.spacing=0.f; P.amount=2.f;
    P.edgeMode=EDGE_CLAMP; P.slatCols=2; P.slatStagger=0.f;
    warp(src,dst,P,nullptr,0.f);
    NEAR(dst.at(0,3)[0], 5.f, 1e-4f);                 // y=3 -> src 5
    NEAR(dst.at(0,6)[0], 7.f, 1e-4f);                 // y+2=8 -> clamp 7
}
```

Register them in `main()` (after the `test_warp_mosaic_blocks();` line, line 155):

```cpp
    test_warp_slats_rows_uniform_shift(); test_warp_slats_stagger_alternates_bands(); test_warp_slats_cols_uniform_shift();
```

- [ ] **Step 3: Run tests, verify the 3 new ones FAIL**

Run: `& ".\distort-native\build-cli.bat"; & ".\distort-native\build\distort_tests.exe"`
Expected: FAIL lines for the slat tests (engine ignores the new params — output == smooth path, so shifts are wrong).

- [ ] **Step 4: Implement the slat branch in `warpBand`**

In `distort-native/core/distort_core.cpp`, at the very top of the `for(int x...)` loop body in `warpBand` (immediately after `for(int x=0;x<src.w;x++){`, before the mosaic comment), insert:

```cpp
            // ── Slats (auto-weave): rigid Rows/Cols that slide. Mutually exclusive
            //    with the smooth/mosaic path (rows->X shift, cols->Y shift). ──────
            if (P.slatRows>0 || P.slatCols>0){
                float shiftX=0.f, shiftY=0.f;
                if (P.slatRows>0){
                    float rowH=(float)src.h/(float)P.slatRows;
                    int ri=(int)floorf((float)y/rowH);
                    if(ri<0) ri=0; if(ri>=P.slatRows) ri=P.slatRows-1;
                    float axc=(float)src.w*0.5f;                 // rows uniform across x
                    float ayc=((float)ri+0.5f)*rowH;             // band center
                    float uc=((axc+0.5f)/src.w)*2.f-1.f;
                    float vc=((ayc+0.5f)/src.h)*2.f-1.f;
                    float fld=fieldAtAnchor(P,mapLayer,src.w,src.h,axc,ayc);
                    float ff=ds_clamp(fld*flowWeight(P,uc,vc)*modul + flowJitter(P,ri,0),-1.f,1.f);
                    float sign=(1.f-P.slatStagger)+P.slatStagger*((ri&1)?-1.f:1.f);
                    shiftX+=ff*P.amount*sign;
                }
                if (P.slatCols>0){
                    float colW=(float)src.w/(float)P.slatCols;
                    int ci=(int)floorf((float)x/colW);
                    if(ci<0) ci=0; if(ci>=P.slatCols) ci=P.slatCols-1;
                    float axc=((float)ci+0.5f)*colW;             // band center
                    float ayc=(float)src.h*0.5f;                 // cols uniform across y
                    float uc=((axc+0.5f)/src.w)*2.f-1.f;
                    float vc=((ayc+0.5f)/src.h)*2.f-1.f;
                    float fld=fieldAtAnchor(P,mapLayer,src.w,src.h,axc,ayc);
                    float ff=ds_clamp(fld*flowWeight(P,uc,vc)*modul + flowJitter(P,0,ci),-1.f,1.f);
                    float sign=(1.f-P.slatStagger)+P.slatStagger*((ci&1)?-1.f:1.f);
                    shiftY+=ff*P.amount*sign;
                }
                float sm[4]; sampleBilinear(src,(float)x+shiftX,(float)y+shiftY,P.edgeMode,sm);
                float* o=dst.at(x,y);
                if (P.opacity>=1.f){ o[0]=sm[0];o[1]=sm[1];o[2]=sm[2];o[3]=sm[3]; }
                else { const float* s0=src.at(x,y); for(int k=0;k<4;k++) o[k]=s0[k]+(sm[k]-s0[k])*P.opacity; }
                continue;                                        // skip smooth/mosaic path
            }
```

- [ ] **Step 5: Run tests, verify ALL PASS**

Run: `& ".\distort-native\build-cli.bat"; & ".\distort-native\build\distort_tests.exe"`
Expected: `ALL PASS` (3 new slat tests + all existing).

- [ ] **Step 6: Commit**

```bash
git add distort-native/core/distort_params.h distort-native/core/distort_core.cpp distort-native/tests/distort_tests.cpp
git commit -m "feat(distort-native): Spatial Rows/Slats auto-weave mode + tests"
```

---

## Task 3: AE plugin params + `.aex` rebuild

**Files:**
- Modify: `distort-native/ae/DistortFlow.h` (enum)
- Modify: `distort-native/ae/DistortFlow.cpp` (`ParamsSetup`, `ReadParams`)

- [ ] **Step 1: Add enum entries**

In `distort-native/ae/DistortFlow.h`, in the `enum { ... }`, replace the `DFP_MOSAIC,` / `DF_NUM_PARAMS` tail (lines 50-51) with:

```cpp
    DFP_MOSAIC,       /* px    0..200      default 0   (>=1 => blocky mosaic)    */
    /* slats (auto-weave) */
    DFP_SLATROWS,     /* int   0..64       default 0   (>0 => weave mode)        */
    DFP_SLATCOLS,     /* int   0..64       default 0                            */
    DFP_SLATSTAGGER,  /* %     0..100      default 0   (-> 0..1)                */
    DF_NUM_PARAMS     /* keep last */
```

- [ ] **Step 2: Add the param controls in `ParamsSetup`**

In `distort-native/ae/DistortFlow.cpp`, after the Mosaic block (line 107, the `PF_ADD_FLOAT_SLIDERX("Mosaic Block (px)"...` line), insert:

```cpp
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Rows", 0, 64, 0, 64, 0, PF_Precision_INTEGER, 0, 0, DFP_SLATROWS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Columns", 0, 64, 0, 64, 0, PF_Precision_INTEGER, 0, 0, DFP_SLATCOLS);
    AEFX_CLR_STRUCT(def);
    PF_ADD_FLOAT_SLIDERX("Slat Stagger", 0, 100, 0, 100, 0, PF_Precision_INTEGER, 0, 0, DFP_SLATSTAGGER);
```

- [ ] **Step 3: Read the params in `ReadParams`**

In `distort-native/ae/DistortFlow.cpp`, after the `p.mosaicBlock = ...` line (line 139), insert:

```cpp
    p.slatRows    = (int)params[DFP_SLATROWS]->u.fs_d.value;
    p.slatCols    = (int)params[DFP_SLATCOLS]->u.fs_d.value;
    p.slatStagger = (float)(params[DFP_SLATSTAGGER]->u.fs_d.value / 100.0);
```

- [ ] **Step 4: Rebuild the `.aex`**

Run: `cmd /c '"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" && msbuild distort-native\ae\DistortFlow.vcxproj /p:Configuration=Release /p:Platform=x64'`
Expected: `Build succeeded`, output `distort-native\build-ae\DistortFlow.aex` (size grows slightly from 72 KB). If the VS path differs, use the one in memory `aex-build-recipe`.

- [ ] **Step 5: Commit**

```bash
git add distort-native/ae/DistortFlow.h distort-native/ae/DistortFlow.cpp distort-native/build-ae/DistortFlow.aex
git commit -m "feat(distort-native): expose Rows/Columns/Slat Stagger params in DistortFlow.aex"
```

> **Install note (user, manual):** admin-copy `distort-native/build-ae/DistortFlow.aex` over the installed one in `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Plug-ins\`, relaunch AE, apply a FRESH effect instance.

---

## Task 4: Panel UI — Slats section + harden applyPreset

**Files:**
- Modify: `js/plugins/distortions/ui.js`

- [ ] **Step 1: Add slat defaults to `_state`**

In `js/plugins/distortions/ui.js`, in the `_state` object after `dfMosaic: 0,` (before `dfTargetMode`):

```javascript
    dfSlatRows:   0,
    dfSlatCols:   0,
    dfSlatStagger:0,
```

- [ ] **Step 2: Add the Slats section in `_buildFlow`**

In `_buildFlow`, after the Output section's `container.appendChild(_df.dfMosaic.el);` line, insert:

```javascript
    // Slats (auto-weave)
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Slats (Weave)'));
    _df.dfSlatRows = _mk('dfSlatRows', { label: 'Rows', min: 0, max: 64, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Horizontal slat bands that slide along X (0 = off). Any Rows/Columns > 0 switches to weave mode.' });
    _df.dfSlatCols = _mk('dfSlatCols', { label: 'Columns', min: 0, max: 64, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Vertical slat bands that slide along Y (0 = off).' });
    _df.dfSlatStagger = _mk('dfSlatStagger', { label: 'Stagger %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Alternate bands shift in opposite directions (over/under weave).' });
    container.appendChild(_df.dfSlatRows.el);
    container.appendChild(_df.dfSlatCols.el);
    container.appendChild(_df.dfSlatStagger.el);
```

- [ ] **Step 3: Harden the built-in setValue calls in `applyPreset`**

So a Distort Flow preset (which omits built-in fields) can't push `undefined` into the built-in sliders. In `applyPreset`, replace the unconditional block:

```javascript
    _typeGroup.setValue(p.distType);
    _sliders.intensity.setValue(p.intensity);
    _sliders.radius.setValue(p.radius);
    _sliders.feather.setValue(p.feather !== undefined ? p.feather : 0);
    _sliders.blendOpacity.setValue(p.blendOpacity);
    _sliders.centerX.setValue(p.centerX !== undefined ? p.centerX : 0.5);
    _sliders.centerY.setValue(p.centerY !== undefined ? p.centerY : 0.5);
    _showSection(p.distType);
```

with:

```javascript
    if (p.distType !== undefined)     { _typeGroup.setValue(p.distType); _showSection(p.distType); }
    if (p.intensity !== undefined)    { _sliders.intensity.setValue(p.intensity); }
    if (p.radius !== undefined)       { _sliders.radius.setValue(p.radius); }
    if (p.feather !== undefined)      { _sliders.feather.setValue(p.feather); }
    if (p.blendOpacity !== undefined) { _sliders.blendOpacity.setValue(p.blendOpacity); }
    if (p.centerX !== undefined)      { _sliders.centerX.setValue(p.centerX); }
    if (p.centerY !== undefined)      { _sliders.centerY.setValue(p.centerY); }
```

- [ ] **Step 4: Syntax-check**

Run: `node --check js/plugins/distortions/ui.js`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add js/plugins/distortions/ui.js
git commit -m "feat(distort-native): Slats sliders in panel + guard applyPreset built-in fields"
```

---

## Task 5: ExtendScript setters + presets

**Files:**
- Modify: `jsx/distortflow.jsx`
- Modify: `js/factory-presets.js`

- [ ] **Step 1: Push the slat params in `distortflow.jsx`**

In `jsx/distortflow.jsx`, in `apply()`, after the `_set(fx, 'Mosaic Block (px)', ...)` line, insert:

```javascript
        // slats
        _set(fx, 'Rows',          num(params.dfSlatRows, 0));
        _set(fx, 'Columns',       num(params.dfSlatCols, 0));
        _set(fx, 'Slat Stagger',  num(params.dfSlatStagger, 0));
```

- [ ] **Step 2: Tag the existing built-in presets with `engine:'builtin'`**

In `js/factory-presets.js`, add `engine: 'builtin',` as the first key of each of the 5 existing `distortions` presets (Fisheye, Barrel, Vortex, Ocean, Magnify). Example for Fisheye:

```javascript
    'Fisheye': {
      engine: 'builtin',
      distType: 'lens', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
```

- [ ] **Step 3: Add the 6 Distort Flow presets**

In `js/factory-presets.js`, inside the `distortions: { ... }` block, after `'Magnify': {...},` add:

```javascript
    'Woven Slats': {
      engine: 'flow', dfMapType: 3, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 60, dfFlowDir: 1, dfFlowSpeed: 0.3, dfLoop: 1, dfEasing: 1,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 3, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 16, dfSlatCols: 16, dfSlatStagger: 60, dfTargetMode: 'selectedLayers'
    },
    'Venetian Blinds': {
      engine: 'flow', dfMapType: 3, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 6, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 40, dfFlowDir: 1, dfFlowSpeed: 0.2, dfLoop: 1, dfEasing: 1,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 3, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 24, dfSlatCols: 0, dfSlatStagger: 100, dfTargetMode: 'selectedLayers'
    },
    'Ripple Grid': {
      engine: 'flow', dfMapType: 2, dfAngle: 0, dfSpacing: 6, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 50, dfFlowDir: 3, dfFlowSpeed: 0.4, dfLoop: 1, dfEasing: 5,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 3, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 20, dfSlatCols: 20, dfSlatStagger: 40, dfTargetMode: 'selectedLayers'
    },
    'Liquid Wave': {
      engine: 'flow', dfMapType: 3, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 50, dfFlowDir: 1, dfFlowSpeed: 0.5, dfLoop: 1, dfEasing: 5,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 3, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0, dfTargetMode: 'selectedLayers'
    },
    'Noise Drift': {
      engine: 'flow', dfMapType: 4, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 4, dfNoiseDetail: 4, dfNoiseSeed: 7, dfContrast: 10,
      dfDispMode: 2, dfAmount: 60, dfFlowDir: 1, dfFlowSpeed: 0.4, dfLoop: 1, dfEasing: 1,
      dfJitter: 10, dfJitterSeed: 3, dfPhase: 0, dfEdge: 3, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0, dfTargetMode: 'selectedLayers'
    },
    'Mosaic Shuffle': {
      engine: 'flow', dfMapType: 4, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 40, dfFlowDir: 1, dfFlowSpeed: 0.5, dfLoop: 1, dfEasing: 1,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 3, dfOpacity: 100, dfMosaic: 24,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0, dfTargetMode: 'selectedLayers'
    },
```

- [ ] **Step 3b: Syntax-check both files**

Run: `node --check js/factory-presets.js` and (via temp `.js` copy) `jsx/distortflow.jsx`.
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add jsx/distortflow.jsx js/factory-presets.js
git commit -m "feat(distort-native): push slat params + Distort Flow presets (engine-tagged)"
```

---

## Task 6: Verify end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Engine — numeric verification**

Run: `& ".\distort-native\build-cli.bat"; & ".\distort-native\build\distort_tests.exe"`
Expected: `ALL PASS`.

- [ ] **Step 2: Panel — browser preview check**

Open `preview.html` under a headless browser (puppeteer-core + installed Chrome, as in the D3b verification). Steps to drive:
1. Switch Engine → Distort Flow.
2. Confirm the **Slats (Weave)** section renders (Rows / Columns / Stagger %).
3. Load the **Woven Slats** preset via the PresetBar dropdown.
4. Click **Apply Distort Flow**; capture the `distortflow.apply` payload.
Expected: payload has `engine:'flow'`, `dfSlatRows:16`, `dfSlatCols:16`, `dfSlatStagger:60`, `dfMapType:3`; status "Distort Flow applied."; zero JS errors. Screenshot `test/slats-panel.png`.

- [ ] **Step 3: In-AE eyeball (user, manual)**

After admin-copying the rebuilt `.aex` + relaunch: apply Distort Flow to footage, load **Woven Slats**, scrub the timeline. Expected: interwoven horizontal+vertical slat shifts (basket weave), animating via flow, filling the canvas (Edge=Mirror). Try **Venetian Blinds** (rows-only) and **Ripple Grid**.

- [ ] **Step 4: Update memory + handoff**

Update memory `distort-native-d3a-verified` with a Slats-done note; refresh `docs/handoffs/2026-06-12-distort-native-resume.md` (Slats shipped → Distort Flow v1 feature-complete; remaining D2 CUDA / D4 temporal).

---

## Self-Review

**Spec coverage:** §2 decisions → Task 2 (grid/auto-weave/count/own-mode/stagger). §3 engine math → Task 1+2. §4 params → Task 2 Step 1. §5 AE → Task 3. §6 panel → Task 4. §7 presets + builtin tags → Task 5. §8 tests → Task 2 Step 2. §9 phasing → Tasks 1-6. All covered.

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output.

**Type consistency:** `Params` fields `slatRows`/`slatCols`/`slatStagger` used identically in core, tests, and `ReadParams`. AE display names `'Rows'`/`'Columns'`/`'Slat Stagger'` match between `ParamsSetup` (Task 3) and `distortflow.jsx` `_set` (Task 5). Panel state keys `dfSlatRows`/`dfSlatCols`/`dfSlatStagger` consistent across `_state`, `_buildFlow`, presets, and `distortflow.jsx` `params.*`. `fieldAtAnchor` signature consistent between Task 1 definition and Task 2 usage.

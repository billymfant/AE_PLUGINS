# ae/ — Color Lab After Effects plugin (`ColorLab.aex`)

Thin AE-SDK adapter over the `../core/` engine. Match-name **`DKVB ColorLab`**, category
"AE Plugin Suite". Mirrors `glow-native/ae/` (same SDK plumbing, build, PiPL flow).

## Status: ✅ builds + links · ⏳ runtime not yet eyeballed in AE
Compiles and links clean against AE SDK 25.6 (VS 2022) → `../build-ae/ColorLab.aex` (66 KB).
The SDK lives at repo `./sdk/` (git-ignored); the project's `AE_SDK` macro points there.
Still to verify: apply it to a layer in AE and confirm the grade looks right (the engine
math is already test-proven; only the AE-SDK glue is unverified at runtime).

## Scope (this build)
CPU SmartRender path only (glow did the same in its M1). Exposes:
- **Primaries:** Exposure (stops), Contrast, Contrast Pivot, Temperature, Tint, Saturation
- **3-way wheels:** Lift / Gamma / Gain — each R, G, B (% → ±0.5 offset) + master Luma
- **Curves:** Master + per-channel R/G/B — each a 16-node LUT (`Curve M 00`..`Curve B 15`,
  value 0..1, identity default), driven by the CEP panel. `ReadCurve()` rebuilds each
  `colorlab::Curve` (n=16, x=i/15) + `prepareCurve()`; untouched channels stay n=0 (no-op).
- **Output:** Linear Light, Tonemap (None/Soft-clip/Filmic), Highlight Compression

`ReadParams()` maps these to `colorlab::Params`; `SmartRender` blits the input world into a
`colorlab::Image`, calls `colorlab::grade()`, writes back 1:1.

> ✅ **Curves built into `../build-ae/ColorLab.aex`** (rebuilt 2026-06-09, VS 2022 / AE SDK
> 25.6, clean compile + link). Install: copy the `.aex` into AE's `Plug-ins` folder and fully
> relaunch AE, then the panel's curve editor drives the render. Runtime in AE not yet eyeballed.

## Build
```
MSBuild color-native\ae\ColorLab.vcxproj /p:Configuration=Release /p:Platform=x64
```
(or open `ColorLab.sln` in VS 2022, Release|x64) → `../build-ae/ColorLab.aex`.
Install: copy `ColorLab.aex` into AE's `Plug-ins` folder, relaunch AE. The CEP panel's
Color tab drives it by match-name `DKVB ColorLab`.

## Follow-ups (engine already supports; wiring deferred)
1. **GPU SmartRender** — reuse the parity-proven kernel; add `SUPPORTS_GPU_RENDER_F32`, a
   `..\cuda\color_cuda.cu` BGRA-world kernel + GPU device setup (mirror glow's GPU path).
2. **Curve space** — curves currently evaluate in *linear* light (step 6 of `gradePixel`,
   between linearize and delinearize). A display-space curve usually "feels" more intuitive;
   revisit under the color-correction pass (would change `core/` + need CPU/GPU re-parity).
3. **HSL secondary** — add the `hsl*` params (all scalar sliders) + enable checkbox.
4. **Scopes** — call `computeScopes()` after grade, write the blob to a memory-mapped temp file
   for the panel (spec §6).

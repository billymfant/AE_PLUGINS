# ae/ — Color Lab After Effects plugin (`ColorLab.aex`)

Thin AE-SDK adapter over the `../core/` engine. Match-name **`DKVB ColorLab`**, category
"AE Plugin Suite". Mirrors `glow-native/ae/` (same SDK plumbing, build, PiPL flow).

## Status: ✅ builds + links · ⏳ runtime not yet eyeballed in AE
Compiles and links clean against AE SDK 25.6 (VS 2022) → `../build-ae/ColorLab.aex` (66 KB).
The SDK lives at repo `./sdk/` (git-ignored); the project's `AE_SDK` macro points there.
Still to verify: apply it to a layer in AE and confirm the grade looks right (the engine
math is already test-proven; only the AE-SDK glue is unverified at runtime).

## MVP scope (this build)
CPU SmartRender path only (glow did the same in its M1). Exposes:
- **Primaries:** Exposure (stops), Contrast, Contrast Pivot, Temperature, Tint, Saturation
- **3-way wheels:** Lift / Gamma / Gain — each R, G, B (% → ±0.5 offset) + master Luma
- **Output:** Linear Light, Tonemap (None/Soft-clip/Filmic), Highlight Compression

`ReadParams()` maps these to `colorlab::Params`; `SmartRender` blits the input world into a
`colorlab::Image`, calls `colorlab::grade()`, writes back 1:1.

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
2. **Curves** — need a `PF_Param_ARBITRARY_DATA` param to carry control points (or a baked LUT)
   from the panel; then `prepareCurve()` + feed `Params.curve*`.
3. **HSL secondary** — add the `hsl*` params (all scalar sliders) + enable checkbox.
4. **Scopes** — call `computeScopes()` after grade, write the blob to a memory-mapped temp file
   for the panel (spec §6).

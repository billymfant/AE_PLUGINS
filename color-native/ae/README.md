# ae/ — Color Lab After Effects plugin (`ColorLab.aex`)

Thin AE-SDK adapter over the `../core/` engine. Match-name **`DKVB ColorLab`**, category
"AE Plugin Suite". Mirrors `glow-native/ae/` (same SDK plumbing, build, PiPL flow).

## ⚠️ Status: written, NOT yet built/verified in AE
This was authored in a dev environment **without After Effects**. It must be built and
eyeballed on the AE machine (VS 2022 + vendored AE SDK 25.6, per [[aex-build-recipe]]),
exactly like Deep Glow was. Expect a debug pass.

## MVP scope (this build)
CPU SmartRender path only (glow did the same in its M1). Exposes:
- **Primaries:** Exposure (stops), Contrast, Contrast Pivot, Temperature, Tint, Saturation
- **3-way wheels:** Lift / Gamma / Gain — each R, G, B (% → ±0.5 offset) + master Luma
- **Output:** Linear Light, Tonemap (None/Soft-clip/Filmic), Highlight Compression

`ReadParams()` maps these to `colorlab::Params`; `SmartRender` blits the input world into a
`colorlab::Image`, calls `colorlab::grade()`, writes back 1:1.

## Build (on the AE machine)
Open `ColorLab.sln` in VS 2022 (Release|x64) → outputs `../build-ae/ColorLab.aex`, or:
```
MSBuild color-native\ae\ColorLab.vcxproj /p:Configuration=Release /p:Platform=x64
```
Install: copy `ColorLab.aex` into AE's `Plug-ins` folder. The CEP panel drives it by match-name.

## Follow-ups (engine already supports; wiring deferred)
1. **GPU SmartRender** — reuse the parity-proven kernel; add `SUPPORTS_GPU_RENDER_F32`, a
   `..\cuda\color_cuda.cu` BGRA-world kernel + GPU device setup (mirror glow's GPU path).
2. **Curves** — need a `PF_Param_ARBITRARY_DATA` param to carry control points (or a baked LUT)
   from the panel; then `prepareCurve()` + feed `Params.curve*`.
3. **HSL secondary** — add the `hsl*` params (all scalar sliders) + enable checkbox.
4. **Scopes** — call `computeScopes()` after grade, write the blob to a memory-mapped temp file
   for the panel (spec §6).

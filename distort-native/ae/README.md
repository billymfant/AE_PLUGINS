# ae/ — Distort Flow After Effects plugin (`DistortFlow.aex`)

Thin AE-SDK adapter over the `../core/` warp engine. Match-name **`DKVB DistortFlow`**,
category "AE Plugin Suite". Mirrors `color-native/ae/` (same SDK plumbing, build, PiPL flow).

## Status: ✅ builds + links → `../build-ae/DistortFlow.aex` (68 KB) · ⏳ not yet eyeballed in AE
Compiles + links clean against AE SDK 25.6 (VS 2022, v143). The engine math is already
test-proven (`../build/distort_tests.exe` = ALL PASS); only the AE-SDK glue is unverified at
runtime. Next: apply it to a footage layer in AE and confirm the warp animates correctly.

## Scope (D3a build)
CPU SmartRender, **generator maps** (Gradient/Radial/Wave/Noise), spatial warp with
fixed/along-gradient/push-pull displacement, flow modulation (direction/speed/loop/easing/
jitter/phase) animated across **footage time** (`time = current_time/time_scale`), edge
handling (clamp/wrap/mirror/transparent), opacity blend. **Visible in the Effects menu**
(Effect ▸ AE Plugin Suite ▸ Distort Flow) for manual apply + verification.

`ReadParams()` maps the AE params to `distort::Params`; `SmartRender` blits the input world
into a `distort::Image`, calls `distort::warp(src,dst,P,nullptr,time)`, writes back 1:1.

## Build
```
MSBuild distort-native\ae\DistortFlow.vcxproj /p:Configuration=Release /p:Platform=x64
```
(run inside a VS 2022 x64 dev env so `cl.exe` is on PATH for the PiPL step).
Output: `../build-ae/DistortFlow.aex`.
Install: copy the `.aex` into `C:\Program Files\Adobe\Adobe After Effects 2026\Support
Files\Plug-ins\` (admin/UAC), relaunch AE.

## Follow-ups
1. **CEP panel (D3b)** — `jsx/distortflow.jsx` apply-by-match-name `DKVB DistortFlow`,
   dispatcher route, new section in the Distortions tab, then re-add `I_AM_OBSOLETE` to hide
   the effect from the menu (panel-only, like ColorLab).
2. **Layer map** — `MAP_LAYER`: a `PF_ADD_LAYER` param + second `checkout_layer_pixels`.
3. **Refract lens mode** — blob/SDF map + `DISP_REFRACT` + cross-wave (spec addendum 2026-06-12).
4. **GPU SmartRender (D2)** and **temporal TimeSlice (D4, the "wave timecut")**.

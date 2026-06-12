# Distort Native — Resume Handoff (2026-06-12)

**Branch:** `feat/distort-native` · working tree clean at commit `a3500f4`.
**Read first:** memory `distort-native-d3a-verified` + `distort-native-plan`. Specs/plans below.

## Status — what works
- **D1 CPU core** done: map gens (gradient/radial/wave/noise) + flow math + bilinear sampler +
  spatial `warp()`. Tests pass: `distort-native\build-cli.bat` → `build\distort_tests.exe` = `ALL PASS`.
- **D3a `DistortFlow.aex`** BUILT + **user-verified on real footage** ("really good"). CPU
  SmartRender wraps `distort::warp`; flow animates via `time=current_time/time_scale`. Match-name
  `DKVB DistortFlow`, **visible in Effect ▸ AE Plugin Suite ▸ Distort Flow** (no CEP panel yet).
- **Perf:** `warp()` multithreaded across cores (commit `a3500f4`). ⚠️ User must reinstall the
  rebuilt `.aex` (admin copy to AE Plug-ins + relaunch) to get the speedup.

## Build + install (recipe in memory `aex-build-recipe`)
```
cmd /c '"...\VC\Auxiliary\Build\vcvars64.bat" && msbuild distort-native\ae\DistortFlow.vcxproj /p:Configuration=Release /p:Platform=x64'
```
→ `distort-native\build-ae\DistortFlow.aex` (68 KB). Install = ADMIN copy to
`C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Plug-ins\` + relaunch AE
(dev shell is non-admin → user does this via Explorer/elevated PS).

## DONE 2026-06-12 (commit `7b8e8e9`) — canvas fix + mosaic SHIPPED in the .aex
1. ✅ **Footage-drift / transparent-gaps fix.** Gradient/Radial now use a continuous zero-mean
   TRIANGLE field (`ds_tri` in `distort_params.h`) instead of frac() sawtooth → no tear, no net
   translation (distorts in place). `.aex` defaults changed to **Map=Wave + Edge=Mirror** so it
   fills the whole canvas out of the box. (Did NOT do PreRender input-rect expansion — risky
   without AE to test; mirror-edge + zero-mean covers it for opaque footage. Revisit only if
   the user still sees edge gaps.)
3. ✅ **Mosaic = blocky displacement.** New `mosaicBlock` param + `Mosaic Block (px)` slider
   (0..200); snaps each block to one sampled tile that displaces as a unit. `distort_tests`
   updated + ALL PASS. `DistortFlow.aex` rebuilt (72 KB).
   ⚠️ Both need the user to **reinstall the rebuilt .aex** (admin copy + relaunch AE) + eyeball.

## STILL OPEN
2. **Animate the rows — UNDECIDED.** Re-ask next session: spatial Rows/Slats mode (easy,
   single-frame) vs time-slice slit-scan (D4 temporal, hard) vs scroll bands via flow. Once
   decided → spec → plan → implement.
- Later: D3b CEP panel wiring · D2 GPU · D4 temporal · refract lens mode.

## Key paths
- Engine math: `distort-native/core/` (`distort_core.cpp warp()`, `distort_map.h mapValue`)
- AE shell: `distort-native/ae/` (`DistortFlow.cpp` = params/blit/SmartRender)
- Spec: `docs/superpowers/specs/2026-06-11-native-distort-flow-design.md` (+ 2026-06-12 refract addendum)
- Plans: `docs/superpowers/plans/2026-06-11-distort-native-D1-cpu-core.md`,
  `docs/superpowers/plans/2026-06-12-distort-native-D3-ae-plugin.md`
- Later phases: D3b CEP panel · D2 GPU/CUDA · D4 temporal "wave timecut" · refract lens mode.

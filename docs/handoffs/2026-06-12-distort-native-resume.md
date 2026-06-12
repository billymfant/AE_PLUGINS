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

## NEXT SESSION — 3 open items (brainstorm paused mid-flow; design NOT written; no impl started)
1. **PRIORITY BUG — effect drifts footage + transparent gaps** (`test/dist_issue1,2.png`).
   Cause: gradient `frac()` sawtooth = non-zero-mean → net push + tears; edges smear/transparent.
   **Decision: "distort in place, fill whole canvas"** — zero-mean displacement (no translation),
   never reveal transparency, on footage AND adjustment layers. Fix in `core/distort_core.cpp`
   `warp()`/`mapValue` (+ maybe expand PreRender input rect by `amount`; default edge=mirror).
2. **Animate the rows — UNDECIDED.** Re-ask: spatial Rows/Slats (easy) vs time-slice slit-scan
   (D4 temporal, hard) vs scroll bands via flow.
3. **Mosaic = "blocky mosaic displacement"** — quantize warp sample coord/field to a block grid
   (block-size param) → chunky shuffle; animates via existing flow. New map/mode on the engine.

**Flow:** finish brainstorm (#2) → spec → plan → implement, leading with #1 (whole-canvas fix).

## Key paths
- Engine math: `distort-native/core/` (`distort_core.cpp warp()`, `distort_map.h mapValue`)
- AE shell: `distort-native/ae/` (`DistortFlow.cpp` = params/blit/SmartRender)
- Spec: `docs/superpowers/specs/2026-06-11-native-distort-flow-design.md` (+ 2026-06-12 refract addendum)
- Plans: `docs/superpowers/plans/2026-06-11-distort-native-D1-cpu-core.md`,
  `docs/superpowers/plans/2026-06-12-distort-native-D3-ae-plugin.md`
- Later phases: D3b CEP panel · D2 GPU/CUDA · D4 temporal "wave timecut" · refract lens mode.

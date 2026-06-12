# Distort Native — Resume Handoff (2026-06-12)

**Branch:** `feat/distort-native` (pushed to origin) · tip ≈ `0ce2e37` (canvas-fix + mosaic done).
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

## ⚠️ 2026-06-12 (session 2) — the "gaps still there" screenshots were a STALE INSTALL, not a code bug
User dropped `test/dist_issue1.png` / `dist_issue2.png` (transparent smear-comb at the bottom +
footage shifted up) thinking the canvas fix failed. **It did not.** Timeline evidence settled it:
- Installed `.aex` = **68096 bytes @ 11:14** = the PRE-fix D3a build (EDGE_CLAMP + frac() sawtooth).
- Screenshots taken **11:22–11:23** → against that stale 68 KB build.
- Canvas fix (`7b8e8e9`) committed **13:15**, rebuilt to **72192 bytes @ 13:14** — **never installed.**
The smear-comb is the EDGE_CLAMP signature; the shift is the sawtooth (non-zero-mean) signature —
both already fixed by Map=Wave + Edge=Mirror + zero-mean triangle. With EDGE_MIRROR, `sampleBilinear`
cannot return transparency on opaque footage, so the fix covers the canvas. **No new code needed.**

**ACTION FOR USER (do this first on the other computer):**
1. Admin-copy the freshly rebuilt `distort-native/build-ae/DistortFlow.aex` (72 KB, now COMMITTED)
   over the stale one in `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Plug-ins\`.
2. Relaunch AE. **Apply to a FRESH effect instance** (delete the old Distort Flow + re-add) — AE
   keeps OLD stored param values (Gradient/Clamp) on existing instances, so an old instance will
   still look broken even with the new .aex. Confirm Map=Wave, Edge=Mirror on the new instance.
3. Eyeball: gaps/drift should be gone. If gaps STILL appear ONLY where footage doesn't fill the
   comp (footage has its own alpha/bounds), that's inherent — mirror can't invent content beyond
   the layer; the PreRender input-rect expansion wouldn't help either (no footage out there).

## STILL OPEN — animate-rows: DECIDED = Spatial Rows/Slats
User said "whatever is optimal"; decision = **Spatial Rows/Slats** mode (N horizontal bands, animate
per-band offsets via existing flow). Rationale: single-frame, builds on the current engine, and
matches the woven-slat SYSTMS look (see `docs/reference/timeslice-target-look.png`). True time-slice
slit-scan (each row = a different TIME) stays as its own later **D4 temporal** phase (hard:
multi-frame PF_CHECKOUT_LAYER). **Next session: brainstorm → spec → plan → implement Spatial Rows.**
GPU (D2 CUDA) confirmed on roadmap — core/ is written portably to mirror into distort_cuda.cu later.
- Later: D3b CEP panel wiring · D2 GPU/CUDA · D4 temporal slit-scan · refract lens mode.

## Key paths
- Engine math: `distort-native/core/` (`distort_core.cpp warp()`, `distort_map.h mapValue`)
- AE shell: `distort-native/ae/` (`DistortFlow.cpp` = params/blit/SmartRender)
- Spec: `docs/superpowers/specs/2026-06-11-native-distort-flow-design.md` (+ 2026-06-12 refract addendum)
- Plans: `docs/superpowers/plans/2026-06-11-distort-native-D1-cpu-core.md`,
  `docs/superpowers/plans/2026-06-12-distort-native-D3-ae-plugin.md`
- Later phases: D3b CEP panel · D2 GPU/CUDA · D4 temporal "wave timecut" · refract lens mode.

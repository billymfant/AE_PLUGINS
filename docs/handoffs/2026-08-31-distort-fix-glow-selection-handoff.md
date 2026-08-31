# Distort smear fix + Glow Selection redesign — Handoff (2026-08-31)

**Branch:** `feat/distort-native` (16 ahead of `origin`, now pushed; `main` merged IN on 2026-08-31).
**Read also:** `docs/superpowers/plans/2026-06-22-distort-finalization.md`, memory
`distort-phase2-smear-fixed`, `glow-smooth-retune-plan`.

## Session summary

Resumed from the distort finalization plan. Phases 2 and 3 landed and were committed; `main` was
merged in to pull the Deep Glow retune onto this branch; then two Glow panel fixes on top.

## The big find — the installed .aex was two fixes behind

AE 2026 had `DistortFlow.aex` at **68,096 bytes @ 2026-06-12 11:14** — the pre-canvas-fix D3a
build. The repo had 73,728 bytes. **Every "it still smears" observation to date was against stale
code.** Confirm the installed binary before debugging a render complaint.

## DONE

### Distort — Phases 2 + 3 (commit `c31df28`)
- **Smear/tear fixed.** Root cause (headless repro, not guessed): out-of-bounds warp samples were
  resolved by a content-REPLICATING edge mode defaulting everywhere → vertical streaks. Fixed to
  **Transparent** in 3 layers (`core/distort_params.h`, `ae/DistortFlow.cpp`,
  `js/plugins/distortions/ui.js` `dfEdge: 4`), + 2 regression tests.
- **New harness** `distort-native/cli/distort_cli.cpp` — PNG in → warp → PNG out, `--synth`/`--card`.
  Evidence: `test/r_slatcol_mirror.png` (streak) vs `test/r_fixed_default.png` (clean).
- **Panel simplified**: Look = **Style · Strength · Scale · Speed**; the ~25-knob wall is under one
  collapsed **Advanced** (reuses `Sections.makeCollapsible`). Apply Target + Apply button sit
  OUTSIDE Advanced so collapsing can't hide them. `STYLE_PRESETS` + `SCALE_MAP` in
  `js/plugins/distortions/ui.js`.
- **Style amounts retuned for the Transparent default** — the old values were tuned when Mirror hid
  the holes; Noise Warp at the old amount shredded the frame. Mosaic needs a HIGH-frequency,
  HIGH-contrast map (`noiseScale 10`, `contrast 70`) or it reads as pixelation, not a shuffle.
- **6 Distort Flow factory presets flipped `dfEdge` 3 → 4** — they'd have re-introduced the smear.

### Glow (commits `b16e5af`, `2ad6396`)
- **Canvas sharpness fixed.** Root cause: `Dist` is the default tab and `.tab-pane{display:none}`,
  so `fit()` ran against a **0-width** canvas at init and on every resize spent on another tab, took
  its `r.width || 300` fallback, and baked a 300px bitmap that CSS then stretched (~1.6× at a 475px
  panel). `fit()` now refuses a zero box and is driven by a **ResizeObserver** (+ a re-arming dppx
  query for DPR changes). The grabbed-frame thumbnail had the same flaw and now retains the source
  Image and repaints on resize.
- **Selection widget redesigned** (user-approved via an interactive before/after preview):
  the **histogram is now the widget** — bars lit by the same weighting curve the engine applies
  (`weightOf`), dimmed elsewhere. Two thin markers (1px + cap, 14px `HANDLE_HIT`) replace the two
  thick 8px bars. Trapezoid, foot triangles and the hidden vertical-drag-for-Intensity are gone.
  Threshold/Range High/Softness now sit together under Glow Selection; the two softness values
  collapse to ONE **Softness** slider (engine still takes both, so asymmetric presets load fine).
  Labels shortened to fit `.slider-label`'s fixed **58px** column, which had been truncating
  "Threshold Softness" and "Range High Soft" to indistinguishable ellipses.
- **Latent crash fixed:** `applyPreset` called `_sliders.thresholdSoftness.setValue()` unguarded —
  would throw on all 5 factory glow presets once that slider was removed.

### Installs (AE **Beta**, `C:\Program Files\Adobe\Adobe After Effects (Beta)\Support Files\Plug-ins\`)
All three installed + hash-verified: `DistortFlow.aex` (73,728, fresh build), `ColorLab.aex`
(69,120), `DeepGlowGPU.aex` (287,232). The latter two were copied from the AE 2026 install because
those are the exact binaries verified in-host; note the branch's committed glow `.aex` was the
PRE-retune build until `main` was merged. Install needs elevation (`Start-Process -Verb RunAs`).

## Verified / NOT verified

- **Verified by user in AE:** Color Lab ("works very smoothly"); Deep Glow renders correctly **on an
  adjustment layer**.
- **Investigated and dismissed:** a reported "glow offsets the footage". Measured the screenshot —
  the photo renders at exactly 90.0% in BOTH axes anchored top-left, i.e. a *scale*, not a shift;
  its edge carries a soft drop shadow (a clipped render cuts hard, it can't produce a dark
  gradient); and the selection handles sat at the comp corners, so the selected layer wasn't the
  photo. It was the template's layout (`MR_RENDER` / `PLACEHOLDER` mockup), not the effect. The
  render path is strictly 1:1 with buffer expansion explicitly OFF (`DeepGlowGPU.cpp:99`, `:483`).
- **NOT verified in AE:** **Distort Flow itself** — the fixed `.aex` is installed but the user has
  not confirmed the smear is gone, nor eyeballed the 4 new Styles. Also unverified: the redesigned
  Glow Selection widget and the thumbnail repaint-on-resize (headless + syntax only).

## Testing

- Engine: `distort-native\build-cli.bat` → `build\distort_tests.exe` = **ALL PASS**.
- Panels: headless node harnesses over the REAL `ui.js` with a stubbed DOM (in the session
  scratchpad, not committed) — distortions Style/Scale, and glow canvas fit + preset loading +
  redraw 200→520px. All pass; the pre-fix glow file fails the same assertions.

## NEXT

1. **User eyeballs Distort Flow in AE** — fresh effect instance (AE keeps old param values on
   existing ones), confirm Edges = Transparent, no smear, and each of the 4 Styles looks good.
2. **User eyeballs the redesigned Glow Selection** after a panel reload.
3. **Merge `feat/distort-native` → `main`** (Phase 4). `main` is already merged in, so this
   direction should be clean.
4. Open questions: the **"Pick ⌖" button is now redundant** (it puts the histogram canvas into pick
   mode; the real picker is clicking the grabbed thumbnail) — recommend cutting it. The 6 Distort
   Flow factory presets still carry **Mirror-era amounts**, deliberately not retuned.

## Deferred

**Synapse** tool (`docs/superpowers/specs/2026-06-16-synapse-blob-tracking-design.md`, not started);
Distort D2 CUDA · D4 temporal slit-scan · refract lens.

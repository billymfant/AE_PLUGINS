# Distortions — Finalization Plan

**Date:** 2026-06-22
**Branch:** `feat/distort-native` (~31 commits ahead of `main`; not yet merged)
**Status:** Repo cleaned; distort finalization scoped. Bug fix pending diagnosis.

## Context

The Distortions tool (hero tool `dist`) is feature-complete on paper — **Distort Flow v1** and
**Spatial Slats** ship in `distort-native/build-ae/DistortFlow.aex`, with live preview wired in
the panel — but the user (a motion designer) reports two blocking problems:

1. **"Distortions doesn't work as it should."** A real render bug: on Apply, the warp **smears /
   tears the image into vertical streaks at the bottom edge** (see `test/dist_issue1.png`,
   `test/dist_issue2.png` — a pinecone object dragged into vertical slat-streaks below it). This
   is the render artifact the 2026-06-16 handoff flagged as an open question.
2. **"The panel was very confusing — so many functions."** The panel exposes the full raw engine
   (~25 knobs). The user already chose the fix style: **"fewer knobs + better defaults"** (not a
   preset gallery).

Goal: make the distort tool **work** (kill the smear bug) and make it **usable** (simplify the
panel), verify in AE, then merge to `main`.

## Done — repo cleanup (2026-06-22)

Cleaned the project locally and in git to "only what we need":

- **Removed locally** (not in git): `image.png` (stray glow screenshot), `native/` (obsolete
  SDK-sample build output, 0 tracked files), `assets/` (empty).
- **Removed from git:** `electron-app/` — the "superseded standalone controller, not the product"
  (per `PROJECT_MAP.md`). Recoverable from history + tag `archive/pre-scope-reduction-2026-06-04`.
- **Kept:** `sdk/`, `vendor/`, the AE SDK zip + extracted `AfterEffectsSDK_25.6_61_win/` (builds
  need them), `.preview/` (dev screenshot helper), `test/` (the `dist_issue*` shots are evidence
  for the bug below), and all product code (panel `js/jsx/css/CSXS/lib`, the 3 native engines,
  `docs/`).
- Repo stays well-governed by `.gitignore` (build intermediates + SDK ignored; the 3 `.aex` are
  tracked by design).

## Phase 1 — Verify the live preview in AE (user)

The live-preview fix (`jsx/distortflow.jsx` `liveOnly` + debounced `_liveFlow()` in
`js/plugins/distortions/ui.js`) was built but never eyeballed. The CEP panel is junctioned to this
repo, so just **reload the panel** on `feat/distort-native`.

- Select layer → **Apply Distort Flow** once → drag Strength/Speed → confirm the layer updates
  live (~150 ms debounce).
- **Crucially, reproduce the bug:** confirm the smear/tear appears on Apply, and capture the exact
  params/footage that trigger it. This feeds Phase 2.

## Phase 2 — Diagnose + fix the smear/tear render bug

**Use the systematic-debugging skill.** Do NOT guess-patch. The `dist_issue*` images show pixels
dragged into vertical streaks off the bottom edge — the signature of **out-of-bounds map sampling
or displacement reading past the layer edge** (edge clamp / address mode), or a displacement that
pushes UVs below `v=0/1` without clamping, in the native warp.

Likely home: `distort-native/core/` (the map-driven warp math: gradient/radial/wave/noise maps,
triangle in-place fields, fixed/gradient/push-pull displace, mosaic/slats). The CPU engine is
authoritative; if the bug is in the warp sampler it lives there (and must be mirrored if a CUDA
path exists). The built-in-stack path (`jsx/distortions.jsx`, AE native effects) is a separate
mode — confirm which mode the user hit (the `dist_issue` shots are the **native DistortFlow**
slat/displace look, so start in `distort-native/`).

Steps:
1. **Reproduce headlessly** with the existing `distort-native/cli` PNG-in/PNG-out harness on a test
   image at the params from Phase 1 — get the smear to show without AE in the loop.
2. **Find root cause** (read the warp sampler + displace + slat/mosaic edge handling; check UV
   clamp / address mode at the bottom edge; check the I_EXPAND_BUFFER/offset path like the glow
   edge work). Write a failing test in `distort-native/tests/` that asserts no streaking past the
   source extent.
3. **Fix in the core** (and mirror to CUDA + re-run parity if a GPU path exists), make the test
   pass, rebuild `DistortFlow.aex`, reinstall (admin), restart AE, confirm the smear is gone.

## Phase 3 — Simplify the panel ("fewer knobs, better defaults")

Panel-only — `js/plugins/distortions/ui.js` (the `_buildFlow` block) + a small style→params map.
No `.aex` rebuild. Per the 2026-06-16 UX handoff (design already chosen by the user):

- Replace the control wall with **Style ▾ · Strength · Scale · Speed**, everything else under a
  collapsed **Advanced ▾** (reuse the existing `_df` widgets).
- **Style** bakes the fiddly params (map type, displace mode, mosaic/slat config, edges) to
  known-good values per look:
  - **Liquid Wave** (default) · **Noise Warp** · **Mosaic** · **Woven Slats**.
- **Strength** = `dfAmount`. **Speed** = `dfFlowSpeed`. **Scale** = the most relevant size knob per
  style (Wave→`dfWaveFreq`, Noise→`dfNoiseScale`, Mosaic→`dfMosaic`, Woven Slats→`dfSlatRows` +
  `dfSlatCols`).
- Tune each style's defaults so **pick a Style + Apply looks good immediately**.
- Keep the live-preview wiring (Style change + the 3 sliders fire `_liveFlow`).

## Phase 4 — Verify + merge

1. In AE: each Style + Apply looks good out of the box; sliders live; **no smear**.
2. Merge `feat/distort-native` → `main` (it carries Distort Flow v1 + Spatial Slats + live preview
   + bug fix + simplified panel). `main` already has the Deep Glow retune; resolve the expected
   small overlaps in `jsx/dispatcher.jsx` and `js/factory-presets.js` (both tools added their own
   blocks — keep both).

## Open questions

- Is the smear ONLY on the native DistortFlow, or also the built-in-stack distort mode?
- After the live fix: is "working weird" fully the smear bug, or is there also a separate
  responsiveness issue? (Phase 1 answers both.)

## Deferred (later, fresh budget)

- **Synapse** tool (blob-tracking HUD) — spec at `docs/superpowers/specs/2026-06-16-synapse-blob-tracking-design.md`.
- Distort: D2 CUDA · D4 temporal slit-scan · refract lens.

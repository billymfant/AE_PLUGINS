# Synapse — Blob-Tracking HUD Tool (Design Spec)

**Date:** 2026-06-16
**Status:** Design approved, implementation not started
**Working name:** Synapse · match-name `DKVB Synapse`
**Native folder:** `synapse-native/` (mirrors `glow-native/` · `color-native/` · `distort-native/`)

---

## 1. Summary

Synapse is a **new, 4th tool** in the AE Plugin Suite (joining Distortions, Color Lab,
Deep Glow). It is a **blob-tracking HUD generator** inspired by SYNAPS8: it analyzes
footage to find connected regions ("blobs"), tracks them across time with persistent
identity, and renders a sci-fi / glitchcore **HUD overlay** on them — bounding boxes,
crosshairs, ID labels, connecting "synapse" lines, and motion trails.

It is **not** a distortion. Distort Flow *warps existing pixels*; Synapse *analyzes the
image and draws new graphics on top of it*. Different compute model, different engine,
its own tool — by deliberate design (separate `.aex` per tool, they never collide).

## 2. Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Tracking fidelity | **True cross-frame tracking** — persistent blob IDs over time |
| Blob source | **Luminance threshold + Motion/difference + Color/chroma key** (all three) |
| HUD elements | **Boxes+crosshairs, IDs+labels, connecting lines, trails+scan FX** — *every element independently toggleable* (first-class requirement) |
| Tracking architecture | **Analyze pass → then render** (Mocha/AE-tracker model; robust, order-independent) |
| Compute path | **CPU-first, GPU (CUDA) later** — matches the rest of the suite |
| Output | **HUD composited over footage** by default, with a toggle to hide footage (HUD-on-black) |

## 3. Key architectural insight

Because tracking runs in a **pre-analysis pass**, the genuinely hard AE-SDK problem —
seeing footage over time inside an effect — is removed from the render path entirely.
The analyzer builds a **track database** once; the `.aex` is then a **single-frame
effect** (exactly like Glow and Color) that looks up "which blobs are active at time *t*"
and rasterizes the HUD. No fragile multi-frame `PF_CHECKOUT_LAYER` at render time.

## 4. User workflow

1. Set detection params in the panel (mode, threshold, min/max blob size, morphology).
2. Click **Analyze** → the panel renders the source layer's work area to a temp frame
   sequence (at a reduced "analysis resolution" for speed), then the native analyzer
   (`synapse_cli`) scans it and writes a track DB. Panel reports "Analyzed N frames,
   M tracks" and stores the DB path on the effect.
3. Tweak HUD style + toggles live — re-render is instant. Re-analysis is only needed
   when **detection** params change, not when **style** params change.

## 5. Architecture — `synapse-native/`

```
synapse-native/
├─ core/                  portable CPU engine (the math; no AE/CUDA deps)
│  ├─ detect.{h,cpp}      per-frame detection: luminance threshold / motion frame-diff /
│  │                      color-key → binary mask → morphological open/close (erode/dilate)
│  │                      → connected-component labeling → region props (bbox, centroid, area)
│  ├─ track.{h,cpp}       temporal association across frames: greedy nearest-centroid
│  │                      matching with a distance gate → persistent IDs, per-track
│  │                      velocity, age, birth/death/occlusion handling
│  ├─ hud.{h,cpp}         vector HUD renderer: given active blobs + style/toggle params,
│  │                      rasterize boxes/crosshairs/labels/lines/trails into an RGBA
│  │                      overlay buffer, then alpha-composite over the footage frame
│  ├─ trackdb.{h,cpp}     track DB serialize/load (compact binary primary, JSON for debug)
│  └─ synapse_params.h    shared param struct (detection + style + toggles)
├─ cli/
│  └─ synapse_cli.cpp     analyzer: frame-sequence + detection params → track DB.
│                         Also a render-test mode: track DB + frame + style → composited PNG
│                         (offline verification oracle, no AE needed)
├─ tests/
│  └─ synapse_tests.cpp   acceptance tests (synthetic-image detection, tracking-association
│                         correctness, HUD render determinism)
├─ ae/
│  ├─ Synapse.{cpp,h,r,vcxproj}   AE SDK shell — single-frame SmartRender; loads track DB
│  │                              from a file-path param, renders HUD via core/hud,
│  │                              composites over input. Match-name `DKVB Synapse`.
│  └─ README.md           build + install steps + status
└─ build-ae/ Synapse.aex  ►► the installable compiled plugin
```

### Detection modes (all three feed the same labeling → tracking pipeline)
- **Luminance threshold** — track bright (or dark) regions past a threshold. v1 default, works on any footage.
- **Motion / frame-difference** — track regions that are moving (abs diff vs previous frame, thresholded).
- **Color / chroma key** — track regions matching a picked hue/color within a tolerance.

### HUD elements (all four groups; each has its own on/off + style)
- **Boxes + crosshairs** — bounding boxes (square / rounded / bracket-corner styles) + center reticles.
- **IDs + data labels** — persistent ID number + readout text (coords, size, velocity); glued to its track.
- **Connecting "synapse" lines** — graph between active blobs (nearest-neighbor or distance-threshold).
- **Trails + scan FX** — per-track path history (from the DB look-back) + global scanlines / glitch overlay.

## 6. Panel side (CEP)

- `js/plugins/synapse/ui.js` — new tab: detection-param group + **Analyze** button +
  per-element toggle/style panels.
- `jsx/synapse.jsx` — exports work-area frames to a temp sequence, invokes `synapse_cli`,
  applies the `DKVB Synapse` effect, writes the **Track Data path** + style/toggle params.
- `jsx/dispatcher.jsx` — add `synapse.*` route; register the new tab in the panel.

## 7. Data flow

```
panel detection params
  → jsx exports work-area frames (analysis res) to temp dir
    → synapse_cli reads sequence → detect → track → writes track DB (binary)
      → jsx applies DKVB Synapse, sets Track Data path + style/toggle params
        → .aex loads DB (cached), per frame t looks up active blobs
          → core/hud rasterizes enabled elements → composites over footage
```

## 8. Phasing (each phase independently verifiable)

- **S1** — CPU `detect` + `track` core + `synapse_cli` analyzer + tests. Luminance first,
  then motion, then color. Output: a track DB from a frame sequence, verified offline.
- **S2** — CPU `hud` renderer (boxes/crosshairs → IDs/labels → lines → trails) + offline
  render-test PNGs. Every element toggleable.
- **S3** — `Synapse.aex` (single-frame, loads DB, renders HUD). First in-AE verify via a
  manually-set Track Data path (no panel yet).
- **S4** — CEP panel + jsx: frame export + analyzer invocation + one-click **Analyze** +
  apply/wire. New tab. Full workflow.
- **S5** — presets + global scan/glitch FX + polish.
- **S6 (later)** — CUDA parity for detection if perf demands it.

## 9. Risks & constraints (flagged at design time)

- **Text rendering in C++:** an `.aex` cannot use system fonts. HUD labels require a
  **bundled bitmap/vector font**; v1 scopes glyphs to digits + uppercase + a few symbols.
  (New territory — Glow/Color never drew text.)
- **Analyze cost / the CEP→C++ bridge:** ExtendScript cannot hand raw pixels to an external
  exe, so the analyze pass exports a frame sequence to disk. Mitigated by analyzing at a
  reduced "analysis resolution" over the **work area only**.
- **Occlusion / merge quality:** greedy centroid tracking is solid for distinct blobs;
  overlapping/merging blobs will sometimes swap IDs. v1 accepts this (the glitchcore look
  is forgiving). Kalman / Hungarian assignment is a later upgrade, not v1.
- **Scope:** this is the **largest build in the suite** — more surface area than Distort
  Flow. The phasing keeps each step shippable and independently verifiable to contain risk.

## 10. Open / deferred (explicitly not v1)

- CUDA acceleration (S6).
- Advanced tracking (Kalman/Hungarian, re-identification after long occlusion).
- Alpha/matte-driven detection (deferred; the three chosen modes cover v1).
- 3D / camera-aware HUD.
- Preset library beyond a small starter set (S5).

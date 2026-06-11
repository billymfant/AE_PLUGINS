# Native Distort/Flow Engine — TimeSlice + Map-Driven Displacement
_Date: 2026-06-11 · Status: design approved, not yet implemented_

## Overview

A new, **from-scratch native compiled `.aex`** distortion engine for the AE suite —
explicitly **not** built by stacking AE's built-in effects. Inspired by
[SYSTMS Time Slice](https://timeslice.systms.ai/) and Sapphire TimeSlice: a **temporal
slit-scan / time-displacement** look ("wave timecut animations") plus general
**map-driven distortion** — "distort in any shape and pattern with any flow I give it."

A **map** (a wave, gradient, radial, fractal-noise field, or *any layer the user
selects*) drives how far each pixel is displaced — in **space** (push pixels along/by the
map) and in **time** (each region samples a different frame of moving footage). The
**flow** is how that map animates over time (direction, loop, easing, jitter).

This is the **4th native engine**, `distort-native/`, mirroring the proven
`color-native/` and `glow-native/` plugins. It is added as a **new native section inside
the existing Distortions tab** — the working built-in distortions (lens/warp/swirl/wave/
bulge in `jsx/distortions.jsx`) stay as-is.

### Locked decisions
- **From scratch / native `.aex`** (not AE built-ins).
- Scope = **spatial warp + temporal time-slice + wave**, all map-driven.
- Map source = **both** built-in generators **and** any user-selected layer.
- Phasing = **spatial-first** (de-risk; the hard part is temporal multi-frame sampling).
- Placement = **new native section in the Distortions tab** (keep existing built-ins).

### Key feasibility note (drives the phasing)
Color Lab and Deep Glow are **single-frame** effects — they transform the current frame
only. **TimeSlice is fundamentally different: it must read the source layer at *other
points in time*.** In the AE SDK this is done via multi-frame layer checkout
(`PF_CHECKOUT_LAYER` at offset times; harder still on the GPU/SmartFX path). The spatial
warp and the entire map/flow system are single-frame and comparatively easy. Therefore we
build the reusable map + flow + spatial engine first and isolate the temporal checkout as
its own flagship phase. This is a Color-Lab-sized effort.

## Architecture — `distort-native/` (mirrors `color-native/`)

```
distort-native/
├─ core/      portable C++ (single source of math, header-inline `DS_HD` like color's CL_HD)
│  ├─ distort_params.h     param struct + inline math shared by CPU & GPU
│  ├─ distort_map.{h,cpp}  map generators (gradient/radial/wave/fractal-noise) + map-from-layer
│  │                       luminance; remap (contrast/levels); outputs a signed field + gradient dir
│  ├─ distort_spatial.{h,cpp}  per-pixel spatial warp; bilinear sample of input at displaced UV
│  ├─ distort_time.{h,cpp}     temporal sampler: pixel <- frame at (t + map*maxOffset) via a
│  │                           FrameSampler interface (AE shell supplies frames via checkout;
│  │                           CLI supplies an image sequence) — keeps core AE-free
│  └─ distort_flow.{h,cpp}     phase(time) -> map offset; direction (fwd/rev/center-out/edges-in),
│                              loop/pingpong/once, easing (lin/in/out/inout/sine/exp), seeded jitter
├─ cuda/     distort_cuda.cu mirror + distort_parity.cpp (CPU<->GPU <1e-3; spatial+map first)
├─ ae/       DistortFlow.cpp/.h/.r/.vcxproj -> DistortFlow.aex   (match name `DKVB DistortFlow`)
├─ cli/      distort_cli  PNG-in/out (spatial+map); image-sequence in/out (--frames dir --time) for temporal
├─ tests/    distort_tests.cpp  (identity, map generators, bilinear, flow easing, temporal sampler)
├─ build-cli.bat · build-cuda.bat · README.md
└─ build-ae/ ►► DistortFlow.aex (installable)
```

The math is a single header-inline source (`DS_HD`, mirroring color-native's `CL_HD`)
shared verbatim by the CPU and CUDA paths, so panel preview, CLI, CPU render, and GPU
render all agree.

Reuses the existing build recipe (memory `aex-build-recipe`): VS2022 + CUDA 13.3 + AE SDK
25.6, `-arch=sm_89`, `HAS_HLSL 0`, boost-preprocessor vendored; deploy = admin copy to
`...\Adobe After Effects 2026\Support Files\Plug-ins\`.

## Components & responsibilities

| Unit | Does | Depends on |
|---|---|---|
| `distort_params.h` | Holds all params; inline helpers (easing, remap) shared CPU/GPU | nothing (POD + math) |
| `distort_map` | Turn params (+ optional map-layer buffer) into a per-pixel signed displacement field + gradient direction | `distort_params` |
| `distort_spatial` | Warp: output(x,y) = bilinear(input, (x,y) + displacement) | `distort_map` |
| `distort_time` | Time-slice: output(x,y) = `FrameSampler`(t + field(x,y)·maxOffset) | `distort_map`, a `FrameSampler` provided by caller |
| `distort_flow` | Map the current comp time to a map phase/offset given direction/loop/easing/jitter | `distort_params` |
| `cli/distort_cli` | PNG in/out (spatial); image-sequence in/out (temporal) test harness | core |
| `ae/DistortFlow` | AE SDK shell: read controls, run core, single-frame (D3) then multi-frame checkout (D4) | core, AE SDK |
| `jsx/distortflow.jsx` | Apply `DKVB DistortFlow` by match-name; push params by display name | dispatcher, panel |
| `js/plugins/distortions/ui.js` | New "Flow Engine" section + Apply | components, bridge |

The `FrameSampler` interface is the seam that keeps `core/` free of AE: the CLI implements
it over an image sequence; the AE shell implements it via layer checkout. Core math is
identical either way.

## Parameter set (panel ↔ native, set by display name)

- **Mode**: `Spatial` | `TimeSlice`
- **Map**: Type (Gradient/Radial/Wave/Fractal Noise/Layer) · Angle° · Spacing/Scale ·
  Wave Frequency · Wave Phase · Noise Scale/Detail/Seed · Map Layer (selected) · Map
  Channel (Luma/R/G/B) · Map Contrast (remap black/white points)
- **Amount**: *Spatial* → Displacement Amount (px), Displace Mode (Along Gradient / Fixed
  Direction / Push-Pull). *TimeSlice* → Max Time Offset (frames), Time Resolution (fps)
- **Flow**: Direction (Forward/Reverse/Center-out/Edges-in) · Speed · Loop
  (Loop/Ping-pong/Once) · Easing (Linear/In/Out/In-out/Sine/Exp) · Jitter (± / Seed) · Phase
- **Output**: Blend/Opacity · Edge handling (Clamp/Wrap/Mirror/Transparent)

Params not relevant to the current Mode/Map Type are hidden in the panel but always sent
with safe defaults, so an older `.aex` still applies what it understands (same graceful
`_set` model as `jsx/colorlab.jsx`).

## Panel integration

- New ExtendScript module **`jsx/distortflow.jsx`** mirroring `jsx/colorlab.jsx`: apply
  ONE effect by match-name `DKVB DistortFlow`, reuse-on-layer-else-add (`_fx`), push
  params by display name, live-update-vs-Apply semantics (live only updates an existing
  effect; the Apply button is the only thing that adds it). Add a `distortflow.apply`
  route to `jsx/dispatcher.jsx`. **Leave `jsx/distortions.jsx` (built-ins) untouched.**
- **`js/plugins/distortions/ui.js`** gains a clearly separated collapsible section
  "Flow Engine (TimeSlice / Displace)" with the params above, plus its own Apply button.
  Existing built-in distortion controls stay in their section. Follows the suite design
  system (`docs/design/DESIGN_LANGUAGE.md`); Distortions accent cyan `#22b8cf`.

## Phasing — each phase gets its own spec→plan→implement cycle

- **D1 — CPU core + CLI + tests** (no AE). Map generators + spatial warp + flow +
  map-from-image. `distort_cli` PNG-in/out. Tests pass. *First buildable artifact.*
- **D2 — CUDA mirror + parity** (spatial/map). `PARITY PASS (<1e-3)`.
- **D3 — AE shell + panel (spatial)**. `DistortFlow.aex` single-frame spatial; new native
  section in the Distortions tab; verified in AE. **First shippable in After Effects.**
- **D4 — Temporal TimeSlice** (flagship). Multi-frame checkout in the AE shell (CPU path
  first, then GPU); CLI image-sequence temporal mode for offline testing. The "wave timecut."
- **D5 — Presets + polish**. Wave-timecut presets echoing the reference (angle sweep,
  center-out ping-pong, edges-in), edge-handling polish.

## Critical files
- **New**: `distort-native/**`, `jsx/distortflow.jsx`
- **Modify**: `jsx/dispatcher.jsx` (add route), `js/plugins/distortions/ui.js` (new
  section), `index.html` (script tag if a new JS module is split out), `PROJECT_MAP.md`
  (document the new engine)
- **Reference patterns to copy**: `color-native/` (layout, build `.bat`, README, core math
  style), `jsx/colorlab.jsx` (match-name apply / live-vs-Apply), `color-native/ae/` (SDK shell)

## Verification
- **D1/D2**: `distort-native\build-cli.bat` → `distort_tests.exe` = `ALL PASS`;
  `distort_parity.exe` = `PARITY PASS`; eyeball `distort_cli in.png out.png --map wave
  --angle 30 --amount 40`.
- **D3**: build `.aex` (recipe), admin-copy to Plug-ins, apply via panel on a still →
  spatial warp matches the CLI render. `node --check` JS; pipe `.jsx` via
  `--input-type=commonjs`.
- **D4**: apply on moving footage → time-slice; compare to a `distort_cli` image-sequence
  render of the same frames/params.

## Out of scope (this spec)
- Realtime GPU live-preview inside the panel (D2 gives a GPU render path; an in-panel WebGL
  preview is a later, separate idea).
- Mesh/handle-based manual warping (this engine is map-driven, not handle-driven).
- Changes to the existing built-in distortions.

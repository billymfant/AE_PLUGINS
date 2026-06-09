# Color Tool — Native Engine Design (SP-3 rebuild)

**Date:** 2026-06-09
**Status:** Design — awaiting review
**Supersedes:** the ExtendScript Color Lab (`jsx/colorlab.jsx`), which stacks AE built-in effects
**Design language:** follows [`docs/design/DESIGN_LANGUAGE.md`](../../design/DESIGN_LANGUAGE.md)
**Precedent:** mirrors the Deep Glow native effort (`glow-native/`, see [[deep-glow-aex-plan]])

---

## 1. Goal

A fast, self-contained **color-correction tool for motion designers** — grade scenes (motion-design
elements + footage) at speed, without leaving for DaVinci Resolve or stacking 15 native AE effects.
Like Deep Glow, the grading is done by **our own compiled engine**, not AE's built-in color effects.

**Principle (non-negotiable):** the engine quality is the product. The panel is a thin, minimal,
premium control surface over it.

---

## 2. Scope

### In scope (v1)
- **Primary correction:** exposure, contrast (with pivot), temperature, tint, saturation.
- **3-way color wheels:** Lift / Gamma / Gain (shadows / mids / highlights), each = RGB offset + master luma.
- **Curves:** RGB master + per-channel (R/G/B) + luma, via editable control points.
- **HSL secondary (qualifier):** pick/define a hue–sat–luma window with softness, adjust H/S/L inside it.
- **Scopes:** waveform, vectorscope, histogram — fed by **engine-emitted** stats (§6).
- **Smart apply:** adjustment layer over the scene by default; button to apply to selected layer(s) (§7).
- **Live debounced preview** (~160 ms) via a reused effect instance.
- **Engine:** Windows, portable CPU core + CUDA GPU mirror (mirrors `glow-native/`).
- **Working space:** linearized grading (§4).

### Out of scope (deferred)
- **Looks / LUT library / `.cube` import** — explicitly v1.1+ (no 3D-LUT sampler or `.cube` parser in v1).
- **macOS / Metal** — post-v1 (suite is going to macOS later; CPU core is written portable to ease it).
- OpenCL (AMD/Intel) paths.

---

## 3. Architecture

New top-level `color-native/` mirroring `glow-native/`:

```
color-native/
├─ core/      portable C++ color pipeline — color_core.cpp/.h, color_params.h  (single source of truth)
├─ cuda/      GPU mirror of core — color_cuda.cu  + color_parity.cpp (CPU↔GPU AC test)
├─ ae/        AE SDK shell — ColorLab.cpp/.h/.cu/.r/.vcxproj → builds ColorLab.aex (PiPL, CPU + CUDA)
├─ cli/       color_cli — PNG-in/PNG-out harness for the core
├─ tests/     color_tests.cpp — acceptance/property tests (AC1..)
├─ build-ae/  ►► ColorLab.aex (installable)
└─ README.md  build steps + status
```

- **One AE effect**, match-name `DKVB ColorLab`. The panel applies it once and **reuses the instance**,
  pushing params on change (same model as Deep Glow's `DKVB DeepGlowGPU`).
- Build recipe parallels [[aex-build-recipe]] (VS2022 MSVC + CUDA 13.3 sm_89 + AE SDK 25.6).

---

## 4. Color pipeline (the math — this is the quality)

All processing in **32-bit float, linear light**. Order is fixed and chosen for correctness:

```
1.  input pixels (project/display encoded)
2.  LINEARIZE        (sRGB/Rec709 → linear; reversible)
3.  Exposure         (linear multiply, stops)
4.  White balance    (Temperature + Tint as chromatic-adaptation scaling in linear)
5.  Lift/Gamma/Gain  (per tonal range; Lift = offset on shadows, Gamma = power on mids,
                      Gain = multiply on highlights; each carries RGB push + master luma)
6.  Contrast         (around a configurable pivot, in linear)
7.  Curves           (RGB master → per-channel R/G/B → luma; from monotonic-cubic LUTs, 1024-entry)
8.  HSL secondary    (compute soft qualifier mask from H/S/L windows + softness; apply H/S/L deltas
                      only within the mask)
9.  Saturation       (global, luma-preserving)
10. TONE-MAP         (optional soft-clip/filmic roll-off so boosts don't hard-clip — reuse Glow's approach)
11. DELINEARIZE      (linear → output encoding)
12. output
```

- **Curves:** control points → monotonic cubic (Fritsch–Carlson) → baked 1024-entry LUT per channel;
  engine samples the LUT (cheap, smooth, no overshoot).
- **HSL qualifier mask:** per-pixel membership in hue/sat/luma windows, each edge feathered by a
  softness term → single 0..1 mask; adjustments are `mask * delta`.
- Everything is a per-pixel point operation (no neighbor sampling) → trivially parallel on CPU & CUDA,
  and far cheaper than Glow's pyramid blur. 4K-ready.

---

## 5. Parameters (panel ↔ effect contract)

Grouped to match the panel sections. (Names indicative; final match-names assigned in the effect.)

- **Color Wheels:** `liftR/G/B`, `liftLuma`; `gammaR/G/B`, `gammaLuma`; `gainR/G/B`, `gainLuma`.
- **Primary:** `exposure`, `contrast`, `contrastPivot`, `temperature`, `tint`, `saturation`.
- **Curves:** control-point arrays for `curveMaster`, `curveR`, `curveG`, `curveB`, `curveLuma`.
- **HSL Secondary:** `hslEnable`, `hslCenterHue`, `hslHueWidth`, `hslSatRange`, `hslLumaRange`,
  `hslSoftness`, `hslHueAdj`, `hslSatAdj`, `hslLumaAdj`, plus eyedropper-set center.
- **Output:** `linearLight` (default on), `tonemap` (None/Soft/Filmic), `highlightComp`.

Param transport reuses the existing `Bridge.call('color.apply', params)` → `jsx/` dispatcher → effect.

---

## 6. Scopes (engine-emitted, with fallback)

**Chosen path:** the engine computes scope stats from the **graded output buffer** and the panel reads them.

- During render, `color_core` accumulates: a **256-bin per-channel histogram**, a **downsampled
  waveform** (e.g. 256 columns × luma/RGB distribution), and **vectorscope** point density (U/V bins).
- The effect writes this compact stats blob to a **memory-mapped temp file** at a known path
  (e.g. `%TEMP%/dkvb_colorlab_scope.bin`), versioned with a frame/sequence counter.
- The CEP panel polls that file (debounced) and redraws the scope `<canvas>`.

**Caveats (accepted):**
1. Scopes update **when AE renders the frame** (on change / playback), not as a continuous live feed.
2. Requires the mmap/IPC plumbing to be solid in real AE.

**Fallback (documented, not built unless needed):** ExtendScript saves a ~256px frame to a temp image,
the panel reads it and computes scopes in JS. Same scope UI, decoupled from the effect. Kept as a
safety net if engine-emit proves flaky.

---

## 7. Apply model (Smart)

- **Default:** find/create one adjustment layer named **"Color Lab"** at the top of the comp, apply/
  reuse `DKVB ColorLab` on it → grades the whole scene. (Reuse enables live preview; mirrors current
  `jsx/colorlab.jsx` layer-reuse behavior, but with our effect instead of stacked AE effects.)
- **Apply to selection:** a button applies/reuses the effect directly on each selected layer instead.
- All changes are debounced-pushed to the reused instance; the full-width **"Apply Color"** button is a
  commit/confirm, not the only path. Undo-wrapped (reuse `jsx/core/undo.jsx`).

---

## 8. Panel UI (follows DESIGN_LANGUAGE.md)

- New `js/plugins/colorlab/ui.js` (replaces the AE-effect-stacking logic), `jsx/colorlab.jsx` rewritten
  to drive `DKVB ColorLab`. Accent: magenta `#e0559a` (already reserved).
- **Layout:** single vertical scroll (Option A) with a **sticky, collapsible live Scope pinned on top**
  (Option C's strength). Scope type chosen via a small ButtonGroup (Wave / Vector / Histo).
- **Sections (collapsible), in order:** `Color Wheels` (hero, open) → `Primary` (open) →
  `Curves` (collapsed) → `HSL Secondary` (collapsed) → `Output` (collapsed). Only hero + Primary
  expanded by default — minimal, one focus at a time.
- **Hero wheels:** reuse/upgrade the existing `.cl-wheels-row` component in `components.css` — premium
  dark trackballs, faint rim hue-ring, crisp crosshair, glowing magenta handle, mono readouts, per-wheel
  luma mini-slider + reset.
- **Curves & HSL** render as their own collapsible `<canvas>` sections — never crammed into the hero.
- Components reused as-is (Slider, ButtonGroup, Dropdown, Toggle, ColorPicker, section-label,
  action-btn, status-bar). Curve editor + wheels + scope are new canvas widgets following the hero-widget pattern.

---

## 9. CPU ↔ GPU parity & tests

- `core/` is the reference; `cuda/` must match within tolerance (target < 1e-3, à la Glow's AC4).
- `tests/color_tests.cpp` property tests: identity params = no-op; linearize∘delinearize ≈ identity;
  curve LUT monotonic; HSL mask = 0 outside window, = 1 at center; exposure in stops doubles linear value.
- `cli/color_cli` for PNG-in/out visual diffing during development.

---

## 10. Build order (phased; each phase usable)

1. **P1 — Core + Primaries:** `core/` pipeline through lift/gamma/gain + primary + linear space; `.aex`
   CPU path; panel wheels + Primary section + live apply. **← usable grading tool.**
2. **P2 — CUDA:** GPU mirror + parity tests. 4K performance.
3. **P3 — Curves:** LUT engine + curve-editor canvas section.
4. **P4 — HSL secondary:** qualifier mask + eyedropper + HSL section.
5. **P5 — Scopes:** engine stats emit + mmap + panel scope canvas (+ fallback if needed).

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Scope IPC (engine→panel) flaky in AE | Documented panel-render fallback (§6) |
| CUDA/CPU drift | Parity test gate (§9), same as Glow |
| Panel too dense | Progressive disclosure: only hero + Primary open by default |
| Curve editor UX in narrow panel | Full-width canvas section; one curve channel at a time via ButtonGroup |
| Linear round-trip color shifts | identity round-trip test; reuse Glow's proven linear handling |

---

## 12. Acceptance criteria

- AC1 — Identity: default params produce output visually identical to input (round-trip safe).
- AC2 — Each primary control + each wheel changes the image in the expected direction, in linear.
- AC3 — Curves: editing a control point bends the response smoothly with no overshoot/banding.
- AC4 — HSL secondary: adjustments affect only the qualified range; softness feathers the edge.
- AC5 — CPU↔CUDA parity < 1e-3 on a test image across a param sweep.
- AC6 — Scopes reflect the graded result and update on frame re-render.
- AC7 — Panel matches DESIGN_LANGUAGE.md (minimal, magenta, hero wheels, pinned scope, live apply).
- AC8 — A motion designer can do a full primary grade of a scene in well under a minute without leaving AE.

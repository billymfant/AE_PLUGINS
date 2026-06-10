# Color Lab — Panel Polish (Phase A) Design

**Date:** 2026-06-10
**Status:** Approved (design); ready for implementation plan
**Scope:** CEP panel only (`js/` + `css/`). **No `.aex` rebuild** — the native engine is untouched.

## Context

After the display-space grading fix, the user tested Color Lab in AE and raised UI/UX
issues with the panel:

1. **Color wheels** — three small wheels (Lift/Gamma/Gain) are cramped; the user wants
   **one larger wheel at a time** with a way to switch, plus a **bold DaVinci-style colour
   ring** around the trackball so the push direction is readable in real colour. (Today's
   wheel has only a barely-visible dim rim.)
2. **Curve editor** — looks **pixelated/blurry when the panel is enlarged** and feels
   poorly designed. The canvas is a fixed 256×168 bitmap stretched by CSS. The user also
   wants a **graph behind the curve "showcasing the colour space"**.

This phase is the first of three agreed efforts (sequence: **Polish → Presets → Log**).
Phases B and C are out of scope here (see below) but recorded so the plan stays coherent.

## Goals (Phase A)

- Single large colour wheel with **segmented `Lift | Gamma | Gain` tabs** and a **bold
  hue ring**.
- Curve editor that is **crisp at any panel size** (HiDPI) and **redesigned** with a
  **gradient backdrop** (tone ramp on the axes; channel-tinted on R/G/B).
- Shared **HiDPI canvas crispness** fix applied to both the wheel and curve canvases.

## Non-goals (explicitly deferred)

- **RGB + luma histogram behind the curve** — approved look, but it needs the engine→panel
  pixel pipeline (scopes). Deferred to the next phase; the gradient backdrop stands in now.
- **Phase B — Preset overhaul:** the 16 presets in `js/factory-presets.js` hard-code
  `linearLight:true` and were tuned for the old linear pipeline — they are broken for the
  new display-space engine and feel like heavy filters. Re-author later for display space +
  cinematic looks.
- **Phase C — Log / input color management:** input transforms for log footage
  (S-Log3, LogC, V-Log, C-Log, D-Log…), ProRes/log-ProRes, and a user `.cube` LUT loader.
  Its own engine + panel + assets design. (User needs all of: Rec.709, camera log, ProRes,
  own LUTs.)

## Design

All changes live in `js/plugins/colorlab/ui.js` (the wheel cells + `_makeCurveEditor`) and
`css/components.css` (+ maybe `css/layout.css`). State shape in `_state` is unchanged, so
`getParams`/`applyPreset`/`jsx` and the `.aex` need no changes.

### 1. Shared HiDPI canvas helper

Root cause of "pixelated when enlarged": both canvases use a fixed backing-store size and
let CSS upscale. Add one small helper used by the wheel and the curve editor:

- Measure the canvas's **CSS display size**, set `canvas.width/height = cssW*dpr ×
  cssH*dpr` (`dpr = window.devicePixelRatio || 1`), and `ctx.setTransform(dpr,0,0,dpr,0,0)`
  so all drawing stays in CSS-pixel coordinates.
- Re-run on size change via a `ResizeObserver` on the canvas/container, then redraw.
- All existing geometry math keeps working in CSS-pixel units (no coordinate rewrite).

### 2. Color wheels — single wheel + tabs + hue ring

- Replace the 3-cell `cl-wheels-row` (Lift/Gamma/Gain) with **one wheel cell** driven by a
  **segmented control** (`Lift | Gamma | Gain`, magenta active). A local `activeWheel`
  variable selects which channel's state (`liftX/Y/Luma`, `gammaX/Y/Luma`, `gainX/Y/Luma`)
  the wheel + luma slider read/write. Switching a tab repaints from that channel's values.
- **Bigger wheel** (~150–160 CSS px vs 96) → more precision and, with HiDPI, a sharp render.
- **Bold hue ring:** rework `_wheelBackground` so the rim is a **full-saturation conic ring**
  (R→Y→G→Cy→B→Mg) clearly wrapping the dark machined trackball — not the current dim
  0.16-ish blend. Keep the machined body, crosshair, centre pip.
- **Unchanged behaviour:** relative-drag (grab & nudge), Shift = fine, double-click = reset,
  `×` reset, magenta handle + centre→handle guide line, luma mini-slider with `_setLumaBg`,
  and the hue/strength value readout.

### 3. Curve editor — crisp + gradient backdrop

- **Crisp/responsive:** drop the fixed `W=256,H=168`; size the canvas to its displayed
  width (full panel width) × DPR via the helper + `ResizeObserver`. `gx/gy/ux/uy` use the
  current measured `W/H`, so the editor grows (and stays sharp) when the panel is enlarged.
- **Gradient backdrop:** a black→white tone ramp strip under the X axis and up the Y axis;
  on the **R/G/B tabs** the ramps tint to the channel colour (black→red / →green / →blue).
  Optional subtle horizontal gradient in the plot background. Keep the faint grid, dashed
  identity diagonal, and ghosted inactive-channel curves.
- **Polish:** rounded frame, slightly larger point handles (~5px) for easier grabbing.
- **Unchanged:** monotone-cubic eval (mirrors `color_params.h`), click-add / drag /
  double-click-remove, M/R/G/B tabs + per-channel reset.

## Verification

- **Headless:** open `preview.html` in a browser (panel runs without AE). Confirm: wheel
  tabs switch and edit the right channel; hue ring reads direction; resizing the window
  keeps wheel + curve **crisp**; curve gradient backdrop tints per channel. `node --check
  js/plugins/colorlab/ui.js`.
- **In AE:** reload the panel (junction = live), grade a layer; confirm wheels switch, ring
  is legible, curves are sharp when the panel is enlarged, and grading still applies.

## Risks / notes

- `preview.html` must load the updated `ui.js` (it already mirrors the panel). Confirm the
  3-tab mock still wires Color Lab.
- CEP runs Chromium, so `ResizeObserver` + `devicePixelRatio` are available; verify the AE
  panel reports a sensible `devicePixelRatio`.
- No `.aex`, `.jsx`, preset, or `_state` schema changes — keeps this phase isolated and
  reversible.

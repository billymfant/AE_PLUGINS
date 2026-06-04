# SP-1 — Shared UI/UX Redesign Design

**Date:** 2026-06-04
**Status:** Approved (visual design validated by user via companion mockups)
**Parent:** `2026-06-04-suite-scope-reduction-design.md`
**Builds on:** `docs/handoffs/2026-05-28-ui-ux-redesign.md`

---

## Goal

Fix the one repeated layout flaw across every tab (edge-to-edge sliders, tiny labels, no
hierarchy, breaks at docked width) by redesigning the **shared component library + CSS**.
UI-only: `.jsx` logic does not change. All three hero tools inherit the result.

## Chosen direction: "Compact Inline" (option B)

One control per row, everything on a single line: **`[label · 58px] [slider track · flex]
[value · 38px] [↺ reset · 14px]`**. Densest readable option — fits the most parameters
before scrolling, which suits param-heavy tools at ~288–300px docked width.

## Design system spec

### Layout / canvas
- Panel target width ~288–300px; height scrolls. Layout must hold at that width (root
  cause of the old bug: no width constraint → controls stretched when undocked).
- Vertical rhythm: ~10px between controls, ~11px section spacing. Body padding 13px.

### Per-tool accent (CSS variable `--acc` set on the active pane/panel)
- **Distortions** = cyan `#22b8cf`
- **Color Lab** = magenta `#e0559a`
- **Deep Glow** = warm amber `#f0a83a`
- Accent drives: active tab underline (with soft glow), slider fill, toggle-on, segmented
  active segment, Apply button, "live" pill. Gives instant orientation per tool.

### Components (all inherit `--acc`)
- **Section header** — collapsible: chevron ▾ + uppercase tracked label (`#8a8a8a`, 10px,
  600) + thin divider line filling the row. Click toggles the section's controls
  open/closed.
- **Slider (compact inline)** — label left (58px, 11px `#b2b2b2`), 4px track (`#363636`)
  with accent fill + 12px white knob, mono value box (38px, `#262626`/`#383838`), reset ↺
  (14px). **Hover/focus state:** track lightens, knob gets a 4px accent ring, value box
  border turns accent + text white, ↺ brightens. Value box is click-to-type editable.
- **Paired row** — for natural pairs (e.g. Center X/Y): one label + two mini value fields
  side-by-side, instead of two full sliders. Saves height.
- **Dropdown** — label left (58px) + full-width select (28px, `#242424`/`#393939`, ▾).
- **Toggle** — label left, pill switch pushed right; 34×18px, accent when on.
- **Segmented (button group)** — label left + full-width segmented control; active segment
  filled with accent, dark text.
- **Color picker** — label left, swatch (18px) + hex chip pushed right.
- **Tab strip** — 3 tabs, icon over short label; active tab brighter with accent underline
  + glow. (Markup already trimmed to 3 in `index.html` during SP-0.)
- **Preset bar** — preset select (flex) + load/save icon buttons (28px square).
- **Apply button** — full-width, accent gradient, dark text, soft accent shadow.
- **Status bar** — dot + small message, pinned at panel bottom.

## ⚠️ CEP runtime constraint (critical for implementation)
CEP's embedded Chromium is **old (~Chrome 88)**. The companion mockups used
`color-mix()`, which is **Chrome 111+** and will NOT render in CEP. Implementation MUST:
- Avoid `color-mix()`, `:has()`, CSS container queries, CSS nesting.
- Use **precomputed hex/rgba** per accent (define accent + its tints/shadow-rgba as
  explicit CSS vars per tool, e.g. `--acc`, `--acc-soft`, `--acc-glow`).
- Use flexbox for all adaptive layout (no fancy grid).
- Verify by eye-balling in a Chrome-88-equivalent if possible; otherwise keep CSS
  conservative.

## File map (what changes)
- `css/theme.css` — accent variable system (per-tool `--acc` + precomputed tints),
  spacing/radius/type scale tokens.
- `css/layout.css` — tab strip, name bar, pane scroll, status bar.
- `css/components.css` — all component styles above (the bulk of the work).
- `js/components/Slider.js` — structural markup for inline layout + value box + reset ↺;
  hover/edit state; keep `new Slider({...})` API.
- `js/components/{Dropdown,ButtonGroup,Toggle,ColorPicker,PresetBar}.js` — markup/visual
  adjustments to match; keep public APIs.
- Possibly a small **paired-row** helper/option on Slider or a new `PairField` for X/Y.
- Section headers: add collapse behavior (in the component that renders sections, or a
  small shared helper used by each plugin UI).
- `index.html` — accent var hookup per pane (tab strip already 3 tabs from SP-0).

## Success criteria
- All three hero panels render in the Compact Inline style, readable at ~288px docked.
- Per-tool accent visibly differs across Dist/Color/Glow.
- Sections collapse/expand; sliders show hover/edit/reset; values are type-editable.
- No `color-mix()`/modern-only CSS; renders correctly in CEP's old Chromium.
- Component public APIs unchanged (plugin UI call sites keep working); `node --check`
  passes on all touched JS.
- User verifies readability/feel in real AE (screenshot loop).

## Out of scope (later sub-projects)
- Per-tool *output quality* work (SP-2 Distortions, SP-3 Color Lab + Reset button,
  SP-4 Deep Glow rebuild). SP-1 is purely the shared UI.

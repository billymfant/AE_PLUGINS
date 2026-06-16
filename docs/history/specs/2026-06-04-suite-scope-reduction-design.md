# AE Plugin Suite — Scope Reduction Design

**Date:** 2026-06-04
**Status:** Approved (scope locked with user)
**Supersedes scope in:** `CLAUDE.md` (5 plugins) and the 11-tab build in `js/app.js`

---

## Why this exists

The suite grew to **11 tabs** (slides, grids, glow, sorter, dist, colorlab, gradient,
patterns, physics, particles, glitchmosh). Empirically, **only one tab actually works
well** (Distortions). Effort was spread so thin that no tool reached the "Boris FX
quality" bar. The CEP plumbing (panel, bridge, dispatcher, components) is solid — the
failure is **per-tool creative output quality + crashes**, plus a shared **UI/UX
readability** flaw on every tab.

Decision: **stop spreading thin. Reduce to 3 hero tools, make them genuinely excellent,
verify in real After Effects.** Everything else is archived (kept in repo, removed from
the panel), not deleted.

## Ground-truth assessment (from in-AE screenshots, 2026-06-04)

| Tool | Observed behavior | Disposition |
|---|---|---|
| **Distortions** | Wave/smear distortion renders correctly, looks intentional/good | ✅ **Hero** — perfect + extend |
| **Color Lab** | Works; AE-effect-based; quality "good not perfect"; no Reset button | ✅ **Hero** — polish + Reset |
| **Deep Glow** | Crashes every run | ✅ **Hero** — rebuild stable + beautiful |
| **Slides** | Settings say 4×4 grid; output is a single image | 📦 Archive (broken generation) |
| **Grids** | Panel error: `TypeError: null is not an object` on Generate | 📦 Archive (crashes) |
| **Gradient Studio** | Linear + noise work; other two types are poor | 📦 Archive |
| **Pixel Sorter** | Runs but output ≈ untouched image (blur-fake ceiling) | 📦 Archive (ExtendScript ceiling) |
| **Pattern Pro** | Crashes badly | 📦 Archive |
| **Physics Rig** | Crashes badly | 📦 Archive |
| **Particle Engine** | Crashes badly | 📦 Archive |
| **GlitchMosh** | Does not work | 📦 Archive (+ ExtendScript ceiling) |

**Why the archived "wow" tools can't be heroes in pure ExtendScript:** Pixel Sorter,
Particles, Physics, GlitchMosh/Datamosh need real per-pixel processing (a compiled
`.aex`). ExtendScript can only orchestrate AE's built-in effects/layers, so these have a
low quality ceiling regardless of effort. They are deferred, not abandoned.

## Target state

A panel with **3 clean, excellent tabs** instead of 11 messy ones:

1. **Distortions** — already good. Perfect it; **add an animated pixel/mosaic
   distortion type** (user request).
2. **Color Lab** — polish output quality; **add a Reset button** (user request).
3. **Deep Glow** — rebuild: eliminate the crash; produce a genuinely beautiful,
   stable multi-pass glow.

Plus a **shared UI/UX redesign** (foundational) that all three inherit.

## Success criteria

- Panel shows exactly 3 tabs; all 3 run in real After Effects without crashing.
- Each hero's output is something the user would actually use on a paying job
  (Distortions is the quality bar; the other two must match or beat it).
- UI is readable and usable at the real docked panel width (~300px), with clear
  hierarchy and grouping — not edge-to-edge sliders.
- Archived tools' code is preserved on an archive branch / in-repo, removable from the
  panel cleanly (no broken tabs, no dead imports, no console errors).

## Decomposition (each sub-project gets its own spec + plan; built one at a time)

- **SP-0 — Archive the 8 non-hero tools.** Remove from `_tabs`/`_pluginNames` in
  `js/app.js`, tab strip in `index.html`, dispatcher routes, theme/layout color vars,
  factory presets; preserve code on an archive branch. Verify panel loads clean with 3
  tabs and no console errors.
- **SP-1 — Shared UI/UX redesign (START HERE).** Fix the repeated layout flaw across the
  shared component library so tools are polished once, on the good layout. Build on
  `docs/handoffs/2026-05-28-ui-ux-redesign.md`.
- **SP-2 — Distortions:** perfect + add animated pixel/mosaic type.
- **SP-3 — Color Lab:** polish output quality + Reset button.
- **SP-4 — Deep Glow:** rebuild stable + beautiful (highest risk; last).

## Constraints (from prior UI handoff + CEP reality)

- **No frameworks** — pure vanilla JS + CSS. No React/Tailwind build step.
- **Dark theme only** (AE is always dark).
- **CEP Chromium is old (~Chrome 88)** — no `:has()`, no CSS container queries; use
  flexbox, not fancy grid, for adaptive layout.
- **Panel ~300px wide**, height scrollable. Layout must look right docked at that width,
  not just undocked/maximized (the current edge-to-edge stretch is the bug).
- **Existing component API stays** (`new Slider({...})`, `new Dropdown({...})`, etc.) —
  SP-1 changes visuals/structure, not the call sites, where possible.
- **`.jsx` logic files don't change for SP-1** (UI-only).
- **No After Effects in the dev environment** — validate JS with `node --check`; final
  output quality must be verified by the user in AE (screenshot loop).

## Open items for later

- Whether any archived tool (esp. Slides as the original flagship) gets rebuilt after the
  3 heroes ship.
- Whether the "wow" tools (Pixel Sorter, Particles, etc.) ever justify a compiled `.aex`.

# UI/UX Redesign Handoff — AE Plugin Suite

**Date:** 2026-05-28  
**Status:** Ready to execute after Claude Code restart  
**Next action:** Run `superpowers:ui-ux-pro-max` skill + brainstorm the redesign

---

## What Was Just Done

### Quality & Completeness Pass (all 9 tasks completed)
All previously-ignored parameters are now fully wired:

| Fix | File |
|-----|------|
| Glow falloff (linear/soft/exponential) + quality (Draft mode) | `jsx/glow.jsx` |
| Pixel Sorter rewritten — Directional Blur + luma matte + Color Key + Turbulent Displace | `jsx/sorter.jsx` |
| Distortions feather mask + centerX/centerY sliders | `jsx/distortions.jsx`, `js/plugins/distortions/ui.js` |
| Grids stroke-draw animation (Trim Paths) + Easy Ease on all anims | `jsx/grids.jsx` |
| Slides animation Easy Ease on all types | `jsx/slides.jsx` |
| Tooltip component (hover, floating, `data-tooltip` attr) | `js/components/Tooltip.js`, `css/components.css` |
| Slider reset-to-default (↺ button) + tooltip on all components | `js/components/Slider.js` + 4 others |
| All 5 plugin UIs wired with tooltip + defaultValue on every control | all `js/plugins/*/ui.js` |
| Factory presets updated to use all fixed params | `js/factory-presets.js` |

### Skills Installed (restart required)
All cloned to `C:\Users\USER\.claude\plugins\cache\user-custom-skills\`:

| Plugin key | Path | Key skills |
|------------|------|------------|
| `ui-ux-pro-max@user-custom-skills` | `ui-ux-pro-max-skill/` | `ui-ux-pro-max` — 67 styles, 161 palettes, 57 font pairings |
| `andrej-karpathy-skills@user-custom-skills` | `andrej-karpathy-skills/` | `karpathy-guidelines` |
| `vercel-agent-skills@user-custom-skills` | `vercel-agent-skills/` | `web-design-guidelines`, `composition-patterns`, `react-best-practices` |
| `trailofbits-skills@user-custom-skills` | `trailofbits-skills/` | 35 security/dev skills |
| `awesome-claude-skills@user-custom-skills` | `awesome-claude-skills/` | curated index |

---

## What to Do After Restart

### Step 1 — Verify skills loaded
Type `/skills` in the Claude Code interface and confirm the new plugins appear.

### Step 2 — Run the UI/UX redesign session
Tell Claude:

> "Read the handoff at `docs/handoffs/2026-05-28-ui-ux-redesign.md`. We want to redesign the AE Plugin Suite panel UI/UX. Use the `ui-ux-pro-max` skill and brainstorm a better design — keep it lightweight, no frameworks, pure CSS/JS. The panel is a CEP panel ~300px wide inside After Effects."

### Step 3 — Constraints to communicate
- **No frameworks** — pure vanilla JS + CSS (no React, no Tailwind). CEP panels run in an embedded Chromium, Tailwind CDN would work but adds weight.
- **Lightweight** — no animations that cause jank, no heavy shadows/blurs
- **Dark theme only** — AE always runs dark
- **Panel width** ~300px, height flexible/scrollable
- **5 tabs** must stay — Slides, Grids, Glow, Sort, Dist
- **Existing component API must stay** — `new Slider({...})`, `new Dropdown({...})` etc. — only visuals change
- **CEP Chromium version** is old (Chrome ~88 equivalent) — no CSS container queries, no `:has()`, use flexbox not grid for complex layouts

---

## Current UI Pain Points (to address in redesign)

1. **Sliders** — label and number input on same line but cramped; track below feels disconnected
2. **Section labels** — plain text, no visual separation weight
3. **Button groups** — buttons feel flat and hard to tell active state
4. **Color pickers** — swatch + hex input look unpolished
5. **Tab bar** — icons + text but no active indicator other than color
6. **Preset bar** — functional but visually isolated from the pane
7. **Status bar** — appears and disappears with no transition
8. **Overall density** — too much padding wasting vertical space in a compact panel
9. **No visual hierarchy** — everything looks the same weight

---

## File Map (what CSS/JS to touch for the redesign)

```
css/
  theme.css        ← CSS variables (colors, spacing, radius, fonts)
  layout.css       ← tab strip, pane layout, scrollable areas
  components.css   ← all component styles (slider, dropdown, toggle, etc.)

js/components/
  Slider.js        ← may need structural HTML changes
  Dropdown.js      ← minor
  ButtonGroup.js   ← active state improvement
  Toggle.js        ← visual polish
  ColorPicker.js   ← swatch + hex layout
  PresetBar.js     ← preset dropdown area

index.html         ← tab strip SVG icons, structure
```

The `.jsx` files and plugin logic files **do not need to change** for a UI-only redesign.

---

## Current CSS Variable Reference

Check `css/theme.css` for current variables before proposing changes — the redesign should extend/replace these, not add parallel systems.

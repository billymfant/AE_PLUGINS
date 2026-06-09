# AE Plugin Suite — Design Language

> The shared visual + interaction language for the suite, distilled from the **Deep Glow** panel
> (the design bar we love) and the applicable UI/UX rules. **The Color grading tool follows this doc.**
> Source of truth for tokens: `css/theme.css`, `css/components.css`, `css/layout.css`.

---

## 1. Philosophy (read this first)

1. **Engine first, panel second.** The product is the color science under the hood. The panel is a
   thin, beautiful control surface over a fast native engine. A gorgeous panel over mediocre math is worthless.
2. **Minimal. One thing in focus.** Never a wall of controls. Use progressive disclosure
   (collapsible sections) so the user sees the hero + essentials, and opens depth only when needed.
3. **Premium-dark, not decorative.** Depth, restraint, precise instruments. No rainbow toys, no
   gratuitous animation. Every pixel earns its place.
4. **One signature hero per tool.** Each tool has exactly one large, custom, interactive canvas
   widget that defines it (Glow → Glow-Selection band; **Color → color wheels + live scope**).
   Everything else is compact, quiet controls beneath it.
5. **Live feedback.** Dragging a control updates the result in-host in real time (debounced),
   so the user grades by eye, not by guessing-then-applying.

**Anti-patterns to avoid:** cramming multiple heroes on screen at once; sub-tabs that hide tools
behind clicks; tiny edge-to-edge sliders with no hierarchy; emoji as icons; fast/janky animation;
gray-on-gray low contrast.

---

## 2. Platform constraints (CEP)

- Runtime is CEP's Chromium ≈ **Chrome 88**. **No `:has()`, no container queries, no `color-mix()`.**
- **Vanilla JS + CSS only** (no framework, no build step). Keep the existing component API.
- **Dark theme only.** Panel docks **narrow (~300–340px)** and tall — design for a single vertical column.
- Respect `prefers-reduced-motion` (already handled globally in `theme.css`).

---

## 3. Design tokens (from `theme.css` — use the vars, never raw hex in components)

### Surfaces (deep-dark, layered)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0d0d0d` | app background, segmented-control wells, action-btn track |
| `--surface` | `#171717` | panes, bars |
| `--surface-2` | `#202020` | inputs, swatches |
| `--surface-3` | `#2a2a2a` | numeric fields |
| `--surface-4` | `#343434` | slider rail unfilled, active segment |
| `--surface-5` | `#3e3e3e` | scrollbar hover |

### Borders & text
`--border #2a2a2a` · `--border-light #3a3a3a` · `--border-focus #4d9fff`
`--text #c8c8c8` · `--text-bright #efefef` · `--text-muted #7a7a7a` · `--text-dim #555`

### Accent — per-tool (set on the pane, drives everything via `--tab-color`)
- **Color tool: `--colorlab-color: #e0559a`** (magenta) with
  `--tab-soft: rgba(224,85,154,.18)` and `--tab-glow: rgba(224,85,154,.32)`.
- Glow (reference): `#f0a83a`. Distortions: `#22b8cf`.
- Components read `var(--tab-color, var(--accent))` — so the same widgets recolor per tool automatically.
- Semantic: `--success #4ade80` · `--warning #fbbf24` · `--danger #f87171`.

### Sizing / type / motion
- Radius: `--radius 3px` · `--radius-md 5px` · `--radius-lg 8px` · `--radius-pill 99px`. Base spacing `8px`.
- Type: base **11px**, `Inter` UI font; **`Consolas` mono for all numeric readouts** (values, RGB, hue).
  Labels uppercase 9.5–10px with `0.1em` letter-spacing.
- Transitions: `--t-fast .1s` · `--t-base .15s` · `--t-slow .25s`. Animate `transform`/`opacity`/`filter`/`color` only.
- Shadows: `--shadow-sm/md/lg`. Accent glow on primary actions uses `--tab-glow`.

---

## 4. Panel anatomy (top → bottom)

```
┌ tab-strip ───────────────┐  46px, icon+label, active = colored top-border + --tab-color
├ plugin-bar ──────────────┤  26px, UPPERCASE tool name in --tab-color + a Reset
├ [PINNED HERO ZONE] ──────┤  ← Color tool: sticky live Scope (collapsible) sits here
├ pane-scroll ─────────────┤  flex:1, overflow-y:auto, the vertical tool column:
│   section-label          │     ▸ collapsible header (chevron + accent tick + rule line)
│   …compact controls…     │     Color order: Wheels (hero) → Primary → Curves → HSL → (Output)
│   section-label          │
│   …                      │
│   action-btn             │     full-width, --tab-color, glowing on hover ("Apply Color")
├ status-bar ──────────────┤  26px, colored dot + message (success/error/warning)
└ preset-bar ──────────────┘  preset dropdown + save/load icon-btns
```

**Minimalism rule:** only the **hero** (wheels) + **Primary** section are expanded by default.
Curves, HSL Secondary, Output start **collapsed**. The pinned scope is shown by default, collapsible.

---

## 5. Component vocabulary (reuse — do not reinvent)

All in `js/components/*` + `css/components.css`. They already auto-recolor via `--tab-color`.

- **Slider (compact inline)** `.component-slider` → `[ label · track · value · ↺ ]`. Track fills in
  accent up to value; thumb is `#f2f2f2` with an accent halo on hover. Label turns accent when
  value ≠ default (`[data-modified]`). Reset glyph appears on hover. **This is the primary control.**
- **ButtonGroup (segmented)** `.component-btn-group` → mutually-exclusive choices in a `--bg` well;
  active button raised with accent text. Use for modes (e.g. scope type, S/M/H selector).
- **Dropdown** `.component-dropdown` → labelled native select, custom chevron.
- **Toggle** `.component-toggle` → 28×15 pill; on = accent track. For booleans (Linear, etc.).
- **ColorPicker** `.component-color` → swatch + hex. (See [[colorpicker-cep-fix]] — native
  `<input type=color>` is dead in AE; use the custom HSV popup.)
- **Section label (collapsible)** `.section-label` + `js/core/sections.js` `Sections.makeCollapsible()`
  → the progressive-disclosure backbone. Accent tick + uppercase + trailing rule line + chevron.
- **Action button** `.action-btn` → full-width accent CTA, uppercase, glow on hover, spinner when loading.
- **Status bar** `.status-bar` → `.success/.error/.warning` recolor + a leading dot.

### The hero-widget pattern (the signature element)
A full-width `<canvas>` (≈150px tall, `--radius-lg`, `--surface-2` bg, `--border`) that the user
manipulates directly, with handles drawn in `--tab-color` and a glow. It **drives the same state as
the sliders below it** (two-way sync) and **debounce-applies live** (~160ms). Reference implementation:
`makeGlowSelection()` in `js/plugins/glow/ui.js`.

### Color wheels (already scaffolded in `components.css`)
`.cl-wheels-row` (3-up grid) → `.cl-wheel-cell` { `.cl-wheel-canvas` (round trackball, hover scale,
crosshair, glowing accent handle) + `.cl-luma-mini` (master luma slider, accent thumb) +
`.cl-wheel-value`/`.cl-luma-val` mono readouts that turn accent when non-zero + corner `↺` reset }.
**Make them premium:** dark machined disc, *faint* rim hue-ring (not a saturated rainbow), crisp
crosshair, glowing magenta handle, soft accent halo on the active wheel.

---

## 6. Interaction rules

- **Live + debounced.** Any control change redraws the hero canvas and pushes params to the native
  effect after ~160ms idle (`Bridge.call('<tool>.apply', params)`); the effect instance is **reused**
  on the layer so it updates in place. The big button is a *commit/confirm*, not the only path.
- **Modified state is visible.** A control whose value ≠ default shows its label/readout in accent.
- **Reset everywhere.** Per-control `↺` (hover-reveal), per-wheel corner reset, per-tool Reset in plugin-bar.
- **Targets & feedback.** ≥ comfortable hit area; `cursor:pointer` on everything clickable;
  `touch-action: manipulation`. Disable + spinner on async commit.
- **Focus & a11y.** Keep `:focus-visible` rings (accent). Don't convey state by color alone — pair with
  the readout text. Contrast ≥ 4.5:1 for text on surfaces (the token text colors satisfy this).

---

## 7. Color-tool application of this language (the brief)

- **Accent:** magenta `#e0559a` (already reserved). Tool name in `plugin-bar`: **"COLOR"**.
- **Hero:** the 3 color wheels (Lift/Gamma/Gain) — premium trackballs — as the first section.
- **Pinned:** a sticky **live scope** above the scroll (Waveform / Vectorscope / Histogram via a
  small ButtonGroup), collapsible. It's the grading feedback loop; it never scrolls away.
- **Sections (vertical, collapsible), in order:** `Color Wheels` (open) → `Primary`
  (exposure/contrast/temp/tint/saturation, open) → `Curves` (collapsed) → `HSL Secondary`
  (eyedropper-qualify + H/S/L, collapsed) → `Output` (collapsed).
- **Curves & HSL are never crammed into the hero view** — they live as their own collapsible canvas
  sections, opened on demand. One thing in focus at a time.
- **Commit:** full-width `action-btn` "Apply Color"; live preview already reflects changes.

---

## 8. Pre-delivery checklist (CEP-adapted)

- [ ] Uses token vars, no raw hex in component CSS
- [ ] Works in a ~300px-wide column, no horizontal scroll
- [ ] No `:has()`, container queries, or `color-mix()`
- [ ] Only the hero + Primary expanded by default; rest collapsed
- [ ] Live debounced apply wired; effect instance reused (no re-add per change)
- [ ] Modified controls show accent; resets present at all three levels
- [ ] SVG icons only (no emoji); `cursor:pointer` on clickables
- [ ] `:focus-visible` rings intact; text contrast ≥ 4.5:1; `prefers-reduced-motion` respected
- [ ] Numeric readouts in mono; transitions 100–250ms on transform/opacity/color only

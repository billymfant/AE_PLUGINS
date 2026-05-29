# GlitchMosh — Design Spec
_Date: 2026-05-29_

## Overview

GlitchMosh is the 6th plugin tab in the AE Plugin Suite. It simulates professional-grade datamosh visual effects directly inside After Effects using a 7-stage native AE effect rig. No external tools required. All parameters are standard AE Effect Controls — fully keyframeable on the timeline.

---

## Workflow

1. User duplicates a video layer in AE and cuts the section they want glitched
2. User selects that duplicate layer
3. User hits **Apply GlitchMosh** in the panel
4. Plugin builds a precomp containing the layer + a single adjustment layer with all 7 effect stages wired via expressions
5. All parameters appear in AE Effect Controls as sliders
6. User keyframes sliders normally in the AE timeline

---

## The 7-Stage Effect Rig

Every stage is independently toggleable. All parameters are driven by expression-linked slider controls on the adjustment layer.

### Stage 1 — Frame Bleed
**AE Effects:** Echo + Time Displacement (luma-driven)

Previous frames ghost into the current one. Time Displacement uses the layer's own luma map so bright pixels bleed more than dark ones — more organic than plain Echo alone.

**Parameters:** Bleed Amount · Decay Rate · Frame Offset · Luma Threshold

---

### Stage 2 — Pixel Smear
**AE Effects:** Channel Blur + Displacement Map + CC Smear

Directional pixel stretching. Displacement map is driven by the layer's luma so bright pixels streak in the motion direction. CC Smear adds the stretched rubber pixel look.

**Parameters:** Smear Length · Direction (H / V / Diagonal) · Luma Threshold · Stretch Amount

---

### Stage 3 — Block Corruption
**AE Effects:** Turbulent Displace + Fractal Noise-driven grid offset + Posterize Time

Macroblock-style codec corruption. Fractal Noise drives randomised per-cell grid offsets. Posterize Time creates frame-drop stutters. Each block independently shifts, duplicates, or colour-shifts.

**Parameters:** Block Size · Offset Amount · Chaos · Frame Drop Rate · Color Shift

---

### Stage 4 — RGB + Chroma Bleed
**AE Effects:** Shift Channels × 3 duplicate layers + per-channel Echo

R/G/B channels shift independently AND each channel bleeds its own previous frames separately. This replicates the colour channel desync that real datamosh produces.

**Parameters:** H Split · V Split · Channel Rotation · Chroma Bleed Amount

---

### Stage 5 — Temporal Stutter
**AE Effects:** Posterize Time + CC Wide Time + hold-frame expressions

Simulates dropped and frozen frames — the decoder-lost-sync look. Seeded random expressions drive stutter timing so it never looks mechanical but is fully reproducible.

**Parameters:** Stutter Rate · Hold Duration · Random Seed · Frame Rate Lock

---

### Stage 6 — Compression Noise
**AE Effects:** Fractal Noise overlay + Add Grain + edge ringing (Unsharp Mask inverted)

The grit that makes glitch look real. Fractal Noise adds digital noise bursts. Add Grain simulates codec quantisation noise. Edge ringing fakes compression halos around high-contrast edges.

**Parameters:** Noise Amount · Grain Size · Ring Intensity · Noise Blend Mode

---

### Stage 7 — Glitch Mask + Organic Randomness
**AE Effects:** Luma Matte + seeded random expressions

Controls where the glitch hits: bright areas only, dark areas only, edges only, or full frame. Seeded random expressions ensure the glitch animates organically — never the same twice, but fully reproducible from the same seed.

**Parameters:** Mask Mode (Full / Bright / Dark / Edges) · Feather · Random Seed · Glitch Intensity Master

---

## Panel UI

### Tab: GlitchMosh (6th icon in the plugin tab bar)

**Master section:**
- Intensity Master slider (scales all 7 stages proportionally)
- Master Random Seed input (seeds both Stage 5 stutter and Stage 7 mask randomness simultaneously; individual stages also expose their own seed overrides)
- Apply GlitchMosh button (shows error if no layer is selected)

**Per-stage sections (collapsible):**
- Toggle on/off
- Stage-specific sliders (as listed above)

**Preset bar (shared suite preset system):**
Ships with 5 built-in presets:
- `Heavy Bleed` — High frame bleed, moderate smear, low blocks
- `Block Party` — Max block corruption, low bleed, RGB drift
- `Subtle Glitch` — Low intensity across all stages, good for a light touch
- `RGB Drift` — RGB split + chroma bleed dominant, minimal bleed
- `Full Corrupt` — All 7 stages at high intensity, chaos mode

---

## Architecture

### Files to create / modify

| File | Action | Purpose |
|------|--------|---------|
| `jsx/glitchmosh.jsx` | Create | ExtendScript rig builder — builds the precomp + adjustment layer + all effects |
| `js/plugins/glitchmosh/ui.js` | Create | Panel UI module (GlitchMoshUI) |
| `jsx/dispatcher.jsx` | Modify | Add `glitchmosh.apply` route |
| `js/app.js` | Modify | Register GlitchMosh tab |
| `index.html` | Modify | Add GlitchMosh tab icon + script tag |
| `assets/presets/glitchmosh/` | Create | 5 built-in preset JSON files |

### JSX rig builder (`jsx/glitchmosh.jsx`)

Receives params from the panel via `dispatch('glitchmosh.apply', params)`. Performs:

1. Validates selected layer is a video/footage layer
2. Precomps the layer (`app.project.activeItem.layers.precompose`)
3. Adds an adjustment layer to the precomp
4. Applies all 7 effect stages to the adjustment layer via `layer.Effects.addProperty()`
5. Wires all effect parameters to slider controls via `expression` strings
6. Returns status to the panel

### Animation

Every parameter is a native AE effect slider on the adjustment layer. Users keyframe them directly in the AE timeline. No special animation mode in the panel is needed.

### Shared systems used

- `jsx/core/utils.jsx` — helpers, JSON polyfill
- `jsx/core/undo.jsx` — `withUndo()` wrapper around rig build
- `js/components/` — Slider, Toggle, ButtonGroup, PresetBar (existing components)
- Preset system — shared JSON format in `~/Documents/AE Plugin Suite Presets/glitchmosh/`

---

## Out of Scope (this spec)

- Electron app / FFmpeg-based true datamosh (deferred — separate spec)
- Animation support upgrades for existing tools (separate spec)
- Fixes for broken tools in AE (separate spec, one tool at a time)

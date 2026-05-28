# AE Plugin Suite — Claude Code Project

## Project Overview
A 5-plugin After Effects suite built in ExtendScript (JavaScript for AE), targeting Boris FX quality. Single unified panel with shared UI/UX across all 5 plugins.

## Plugins
1. **Slides Generator** (Q1) — procedural slide/layout generation
2. **Grids Pro** (Q1) — parametric grid patterns (rect, hex, triangular, radial)
3. **Deep Glow** (Q2) — photorealistic multi-layer glow with edge detection
4. **Pixel Sorter** (Q2) — glitch art via brightness/hue/saturation pixel sorting
5. **Distortions Suite** (Q2) — lens distort, mesh warp, swirl, wave, bulge

## Architecture
- **Language:** ExtendScript (ES3-compatible JavaScript for Adobe AE)
- **UI:** ScriptUI panel (CEP or ScriptUI depending on approach)
- **Single unified panel** — all 5 plugins accessible from one panel
- **Shared preset system** — JSON format, `~/Documents/AE Plugin Suite Presets/`
- **Shared UI component library** — sliders, color pickers, preview panes, dropdowns
- **Distribution:** AEScripts marketplace + standalone website

## Development Approach
- All plugins share the same panel container and UI component library
- Modular architecture: each plugin is a self-contained module loaded into the panel
- Preset format is unified JSON across all plugins
- Performance: quality toggles, debounced previews (150ms), progressive rendering

## Full Spec
See `AE_PLUGIN_SUITE_SPECIFICATION.md` for complete requirements, parameters, and timeline.

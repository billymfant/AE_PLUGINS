# AE Plugin Suite — Developer Handoff

**Date:** 2026-05-28  
**Status:** All 10 plugins implemented, browser preview functional, pending AE deployment & end-to-end testing

---

## What Was Built

A 10-plugin After Effects panel suite with a shared HTML/CSS/JS front-end communicating with ExtendScript via a CEP bridge. Every plugin is accessible from a single tabbed panel.

| # | Plugin | Tab | AE Action | Status |
|---|--------|-----|-----------|--------|
| 1 | Slides Generator | slides | `slides.apply` | ✓ Implemented |
| 2 | Grids Pro | grids | `grids.apply` | ✓ Implemented |
| 3 | Deep Glow | glow | `glow.apply` | ✓ Implemented |
| 4 | Pixel Sorter | sorter | `sorter.apply` | ✓ Implemented |
| 5 | Distortions Suite | dist | `distortions.apply` | ✓ Implemented |
| 6 | Color Lab | colorlab | `colorlab.apply` | ✓ Implemented |
| 7 | Gradient Studio | gradient | `gradient.apply` | ✓ Implemented |
| 8 | Pattern Pro | patterns | `patterns.generate` | ✓ Implemented |
| 9 | Physics Rig | physics | `physics.simulate` | ✓ Implemented |
| 10 | Particle Engine | particles | `particles.generate` | ✓ Implemented |

---

## Repository Structure

```
AE_PLUGINS/
├── index.html              # CEP panel entry point (production)
├── preview.html            # Standalone browser preview (no AE needed)
├── CSXS/manifest.xml       # CEP extension manifest
├── css/
│   ├── theme.css           # Design tokens, tab colors, component vars
│   ├── layout.css          # Panel layout, tab system, pane rules
│   └── components.css      # Slider, ColorPicker, ButtonGroup, Dropdown styles
├── js/
│   ├── app.js              # Tab router, plugin registry, preset wiring
│   ├── bridge.js           # CEP ↔ ExtendScript bridge wrapper
│   ├── factory-presets.js  # All 10 plugin preset libraries
│   └── plugins/
│       ├── slides/ui.js
│       ├── grids/ui.js
│       ├── glow/ui.js
│       ├── sorter/ui.js
│       ├── distortions/ui.js
│       ├── colorlab/ui.js
│       ├── gradient/ui.js
│       ├── patterns/ui.js
│       ├── physics/ui.js
│       └── particles/ui.js
├── jsx/
│   ├── dispatcher.jsx      # Entry point — routes Bridge.call() to plugin modules
│   ├── core/               # Shared ExtendScript utilities (requireComp, withUndo, etc.)
│   ├── slides.jsx
│   ├── grids.jsx
│   ├── glow.jsx
│   ├── sorter.jsx
│   ├── distortions.jsx
│   ├── colorlab.jsx
│   ├── gradient.jsx
│   ├── patterns.jsx
│   ├── physics.jsx
│   └── particles.jsx
├── lib/                    # Third-party JS (no npm — CEP constraint)
└── assets/                 # Icons, images
```

---

## Architecture

### Front-end → Back-end Flow

```
User clicks button in HTML panel
  → JS UI module calls Bridge.call('plugin.action', params)
    → bridge.js serializes to JSON, calls csInterface.evalScript()
      → dispatcher.jsx deserializes, routes to jsx module
        → jsx module performs AE operations
          → returns JSON result string
            → Bridge.call() promise resolves
              → UI shows success/error in status bar
```

### Shared Component Library (`js/`)

All UI modules use these constructors (defined in `lib/` or `js/`):

| Constructor | Usage |
|-------------|-------|
| `new Slider(opts)` | Numeric parameter with drag/input. `opts.onChange(value)` receives raw number. |
| `new ColorPicker(opts)` | Hex color swatch + picker. `opts.onChange(hexString)`. |
| `new ButtonGroup(opts)` | Mutually exclusive radio-style buttons. `opts.onChange(value)`. |
| `new Dropdown(opts)` | `<select>` wrapper. `opts.onChange(value)`. |
| `Utils.el(tag, attrs, text)` | Element factory. `attrs` maps to HTML attributes. |
| `Utils.deepClone(obj)` | Safe state clone for preset application. |

### Preset System

`js/factory-presets.js` exports `window.FactoryPresets` — an object keyed by plugin ID:

```javascript
window.FactoryPresets = {
  colorlab:  [{ name: 'Bleach Bypass', params: {...} }, ...],
  gradient:  [...],
  patterns:  [...],
  physics:   [...],
  particles: [...],
  // + slides, grids, glow, sorter, dist
};
```

`js/app.js` reads this on startup, renders a `PresetBar` per plugin, and calls `UIModule.applyPreset(params)` on click.

---

## Plugin Technical Notes

### Color Lab (`colorlab.jsx`)
Creates an AE **adjustment layer** and stacks built-in effects:
- `ADBE HUE SATURATION` — global Hue/Sat/Lightness
- `ADBE Brightness & Contrast 2` — Brightness/Contrast
- `ADBE Color Balance (HLS)` — Shadows/Midtones/Highlights per-channel
- `ADBE Tint` — two-color tint with amount
- `ADBE Noise` — film grain simulation
- `ADBE Lens Correction` — vignette via Vignette Amount property

Film look presets bake combined parameter sets. "Look Intensity" is implemented via each effect's opacity/amount property scaled by the intensity fraction.

### Gradient Studio (`gradient.jsx`)
Four gradient types — all create new layers:

| Type | Implementation |
|------|----------------|
| Linear / Radial | Solid + `ADBE Ramp` effect (shape=1 linear, shape=2 radial) |
| Conic | N shape layers as pie wedges (interpolated fill colors), parented to null |
| Mesh | Black BG solid + blurred colored solids at control points, `BlendingMode.ADD` |
| Noise | Solid + `ADBE Fractal Noise` + optional `ADBE Tint` |

### Pattern Pro (`patterns.jsx`)
Two pattern engines:

**L-System:** Grammar string expansion → turtle walk → AE shape layer strokes
- 7 built-in presets: Koch Snowflake, Dragon Curve, Sierpinski Triangle, Plant, Hilbert Curve, Lévy C Curve, Gosper Curve
- Safety caps: 200k chars on string expansion, 500 max shape segments
- Optional Trim Paths animation ("Draw On" mode)

**Spirograph:** Epitrochoid formula → single closed path shape layer
```
x(t) = (R+r)*cos(t) - d*cos(((R+r)/r)*t)
y(t) = (R+r)*sin(t) - d*sin(((R+r)/r)*t)
```

### Physics Rig (`physics.jsx`)
Verlet integration — bakes position/rotation keyframes per frame across `duration` seconds.

**Body type convention** (layer name prefix):
```
[static]    — immovable, acts as ground/wall
[kinematic] — AE-animated, other bodies react to it
[dormant]   — asleep until first collision
            — (no prefix) = dynamic (default)
```

**Per-body property overrides** via layer comment string:
```
density:1.5,friction:0.3,bounce:0.8,gravscale:2
```

**Physics features:**
- Gravity (X/Y), per-body gravity scale
- Restitution (bounce), air friction (drag), ground friction
- Wall collisions (viewport bounds)
- Rotation simulation (angular velocity, moment of inertia approx.)
- Magnetism: inverse-square attract/repulse between all dynamic body pairs
- Distance constraints: rigid rods between layer pairs (suffix `_distN` where N matches)
- Spring constraints: Hooke's law between layer pairs (suffix `_springN`)
- Contact marker export: AE layer markers written at collision frames

### Particle Engine (`particles.jsx`)
Pre-allocated shape layer pool — no dynamic layer creation during simulation.

**Pool size:** capped at 200 layers. Unused layers stay opacity=0.

**Emitter types:** Point | Box (random XY within bounds) | Ring (random angle at radius)

**Per-particle physics:** gravity XY, wind (constant X force), turbulence (random per-frame force), drag (velocity damping per frame)

**Life cycle:** spawn at `opacityStart`/`sizeStart` → lerp to `opacityEnd`/`sizeEnd` over `lifeFrames` → removed from active list

All particle layers are parented to a null named `"Particles — {emitterType}"`.

---

## Deployment to After Effects

### Step 1: CEP Extension Path

Copy the entire project folder to:
```
Windows: %APPDATA%\Adobe\CEP\extensions\com.aeplugins.suite\
Mac:     ~/Library/Application Support/Adobe/CEP/extensions/com.aeplugins.suite/
```

### Step 2: Enable Debug Mode (dev only)
Registry key on Windows (run as admin):
```
reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
```
(Replace `CSXS.11` with the version matching your AE — check `CSXS/manifest.xml` `<RequiredRuntime>` version)

### Step 3: Verify manifest
`CSXS/manifest.xml` must have:
- Correct `<ExtensionBundleId>` matching the folder name (`com.aeplugins.suite`)
- `<MainPath>./index.html</MainPath>`
- `<ScriptPath>./jsx/dispatcher.jsx</ScriptPath>`

### Step 4: Launch
Window → Extensions → AE Plugin Suite (in After Effects)

---

## Browser Preview (No AE)

Open `preview.html` directly in Chrome. All 10 plugin UIs render with live preset switching. Bridge calls log to console instead of executing in AE.

---

## Known Limitations & Next Steps

| Item | Detail |
|------|--------|
| No AE end-to-end testing | All 10 plugins implemented but not yet verified inside actual After Effects |
| Physics collision detection | AABB only (axis-aligned bounding box) — no polygon collision, no circle vs box |
| Particle recycling | Pool is consumed left-to-right; particles don't recycle (nextSlot never resets) — for long animations increase maxParticles |
| Conic gradient seam | At 0°/360° boundary, the final segment may have a 1px gap due to floor rounding |
| L-System Plant preset | Branch angles produce dense overlap at high iterations — keep ≤ 4 |
| ExtendScript synchronous | All operations block AE — long simulations (physics 10s at 60fps) will freeze AE for several seconds |
| Preset storage | Factory presets are hardcoded in JS. User-saved presets (`~/Documents/AE Plugin Suite Presets/`) are wired via `presets_io.jsx` but save/load UI not yet surfaced per plugin |

---

## Development Commands

```bash
# Open browser preview
open preview.html

# Lint ExtendScript (basic)
# No JSX linter — use VS Code + Adobe ExtendScript Toolkit extension

# Deploy to AE (Windows)
xcopy /E /I /Y "D:\apps\AE_PLUGINS" "%APPDATA%\Adobe\CEP\extensions\com.aeplugins.suite"
```

---

## Contact / Repo

- **GitHub:** https://github.com/billymfant/AE_PLUGINS
- **Distribution target:** AEScripts marketplace + standalone site

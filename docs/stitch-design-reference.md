# AE Plugin Suite — Stitch Design Reference

> Complete UI inventory for redesign. Every section, control, option, and CTA for all 11 plugins.

---

## Global Shell

**Layout:** Single panel. Dark theme (`color-scheme: dark`).

**Tab Strip** — horizontal row of 11 icon+label buttons at the top:

| Tab key | Label | Icon description |
|---------|-------|-----------------|
| slides | Slides | 4 small rectangles (2×2 grid) |
| grids | Grids | 3×3 line grid |
| glow | Glow | Sunburst / radial rays |
| sorter | Sort | Descending lines + arrow |
| dist | Dist | Two sine waves |
| colorlab | Color | Circle with 3 spoke lines |
| gradient | Grad | Rect with vertical gradient lines |
| patterns | Patt | Cross + diagonal hash |
| physics | Phys | Two circles connected by arc |
| particles | Parts | Upward dot scatter |
| glitchmosh | Mosh | Octagon with horizontal scan lines |

**Plugin Name Bar** — thin bar below tab strip, shows active plugin's full name. Color accent updates to match the active tab's `--tab-color` CSS variable.

**Pane** — scrollable content area below the bar. Each pane = section labels + controls + preset bar + action button + status bar.

**Preset Bar** — appears at the bottom of every pane. Load/save/delete presets per plugin. Presets stored in `~/Documents/AE Plugin Suite Presets/`.

**Status Bar** — single line below CTA. States: neutral / `.error` (red) / `.success` (green).

**Footer** — shows `AE <version>` string pulled from the host app.

---

## Shared UI Components

| Component | Behavior |
|-----------|----------|
| **Slider** | Label + drag track + numeric input. Supports min/max/step/decimals/tooltip. Double-click to reset to default. |
| **Toggle** | Label + checkbox-style switch. On/off boolean. |
| **ColorPicker** | Label + color swatch. Opens native/custom picker. Stores hex string. |
| **Dropdown** | Label + `<select>`. Stores string or number value. |
| **ButtonGroup** | Horizontal radio buttons. Mutually exclusive. Stores string or number value. |
| **section-label** | Gray uppercase section heading. Purely visual grouping. |
| **row-2** | Two controls side-by-side (50/50 split). |
| **row-3** | Three controls side-by-side. |
| **help-text** | Small muted hint text block. |

---

## 1. Slides Generator

**CTA:** `Generate Slides`

### Source
| Control | Type | Values | Default |
|---------|------|--------|---------|
| Source | Dropdown | Empty Slides / Selected Layers | Empty Slides |

### Grid
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Rows | Slider | 1–20, step 1 | 3 |
| Cols | Slider | 1–20, step 1 | 3 |
*(Rows + Cols in row-2)*

### Slide Size
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Width px | Slider | 20–1920 | 200 |
| Height px | Slider | 20–1080 | 150 |
*(in row-2)*

### Spacing
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Gap H | Slider | 0–200 | 10 |
| Gap V | Slider | 0–200 | 10 |
*(in row-2)*

### Randomization
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Position Jitter % | Slider | 0–100 | 0 |
| Rotation ° | Slider | 0–180 | 0 |
| Scale Jitter % | Slider | 0–50 | 0 |
| Random Seed | Slider | 1–9999 | 1 |

### Card Style
| Control | Type | Default |
|---------|------|---------|
| Use Background | Toggle | ON |
| Background | ColorPicker | `#222222` |
| Card Opacity % | Slider 0–100 | 100 |
| Use Stroke | Toggle | OFF |
| Stroke Width | Slider 0–50 | 2 |
| Stroke Color | ColorPicker | `#ffffff` |
| Roundness | Slider 0–200 | 0 |

### Animation
| Control | Type | Options / Range | Default |
|---------|------|----------------|---------|
| Entrance Type | Dropdown | None / Fade In / Scale In / Slide Up / Slide Down / Slide Left / Slide Right / Pop In / Flip In / Rotate In / Blur In / Random Entrance | None |
| Stagger Mode | Dropdown | By Index / By Row / By Column / From Center / From Edges / Random | By Index |
| Duration (frames) | Slider 1–120 | | 18 |
| Stagger (frames) | Slider 0–60 | | 5 |
| Slide Offset px | Slider 0–500 | | 100 |
| Scale From % | Slider 0–200 | | 80 |
| Opacity From % | Slider 0–100 | | 0 |
| Rotate From ° | Slider −180–180 | | 0 |
| Overshoot | Toggle | | OFF |
| Overshoot % | Slider 0–50 | | 8 |

### Options
| Control | Type | Default |
|---------|------|---------|
| Auto-create text layers | Toggle | OFF |

### Live Controller
| Control | Type | Default |
|---------|------|---------|
| Create Live Controller | Toggle | OFF |
> Creates `SLIDES_CONTROL` null + `SLIDES_GROUP` with expression-driven layout.

---

## 2. Grids Pro

Two independent sub-tools in one tab: **Generate Grid** (pattern generator) + **Create Layout Rig** (selected-layer rig). Each has its own CTA.

### Grid Type
| Control | Type | Options |
|---------|------|---------|
| Grid Type | ButtonGroup | Rect / Hex / Tri / Radial / Circle |

### Dimensions
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Width px | Slider | 50–4000 | 500 |
| Height px | Slider | 50–4000 | 500 |
*(in row-2)*
| Cell Size px | Slider | 4–400 | 40 |
| Rotation ° | Slider | 0–360 | 0 |

### Style
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Line Width px | Slider | 0.5–20, step 0.5 | 1 |
| Line Color | ColorPicker | | `#4d9fff` |
| Fill Color | ColorPicker | | `#000000` |
| Fill Opacity % | Slider 0–100 | | 0 |

### Animation
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Entrance | Dropdown | None / Fade In / Scale In / Stroke Draw | None |
| Stagger (frames) | Slider 0–30 | | 3 |

**CTA:** `Generate Grid`

---

### Layout Rig (selected layers)
*Header: "Layout Rig (selected layers)"*

| Control | Type | Range | Default |
|---------|------|-------|---------|
| Columns | Slider | 1–20 | 3 |
| Gap X px | Slider 0–300 | | 24 |
| Gap Y px | Slider 0–300 | | 24 |
*(Gap in row-2)*
| Margin X px | Slider 0–500 | | 60 |
| Margin Y px | Slider 0–500 | | 60 |
*(Margin in row-2)*
| Grid Width px | Slider 0–4000 | | 0 (= comp) |
| Grid Height px | Slider 0–4000 | | 0 (= comp) |
*(Grid size in row-2)*
| Fit Mode | Dropdown | None / Fill / Fit W / Fit H / Fit Best / Stretch | Fit Best |
| Item Scale % | Slider 1–300 | | 100 |
| Offset X px | Slider −2000–2000 | | 0 |
| Offset Y px | Slider −2000–2000 | | 0 |
*(Offset in row-2)*
| Alt Row Offset px | Slider −500–500 | | 0 |
| Alt Col Offset px | Slider −500–500 | | 0 |
*(Alt in row-2)*
| Prog Shift X px | Slider −200–200 | | 0 |
| Prog Shift Y px | Slider −200–200 | | 0 |
*(Prog in row-2)*

**CTA:** `Create Layout Rig`
> Creates `GRID_CONTROL` null with 16 sliders + baked position/scale expressions.

---

## 3. Deep Glow

**CTA:** `Apply Glow`

### Glow
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Intensity % | Slider | 0–500 | 150 |
| Radius px | Slider | 0–500 | 60 |
| Glow Layers | Slider | 1–5 | 2 |

### Source
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Source Gain % | Slider | 0–300 | 100 |
| Threshold Softness | Slider | 0–100 | 20 |

### Falloff
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Falloff | ButtonGroup | Linear / Soft / Exp | Soft |
| Threshold (0–255) | Slider | 0–255 | 80 |

### Color
| Control | Type | Default |
|---------|------|---------|
| Glow Color | ColorPicker | `#ffffff` |
| Colorize glow | Toggle | OFF |
| Tint Amount % | Slider 0–100 | 0 |
| Saturation Boost | Slider −100–100 | 0 |
| Hue Shift ° | Slider −180–180 | 0 |

### Output
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Blend Mode | Dropdown | Screen / Add / Overlay / Lighten | Screen |
| Quality | ButtonGroup | Fast / Quality | Quality |
| Glow Only | Toggle | | OFF |
| Create Live Controller | Toggle | | ON |
> Creates `GLOW_CONTROLLER` null with expression-linked Radius/Intensity/Threshold.

---

## 4. Pixel Sorter

**CTA:** `Apply Pixel Sort`

### Target
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Target | ButtonGroup | Selected / Duplicate / Adjustment / Precomp Rig | Selected |
| Apply Mode | ButtonGroup | Quick / Rig | Quick |

### Sort Mode
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Sort Mode | ButtonGroup | Bright / Hue / Sat / Red / Green / Blue / Alpha / Edge | Bright |

### Direction
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Direction | ButtonGroup | H / V / Diag / Radial / Angle | H |
| Angle ° | Slider | 0–360 | 0 |

### Sort
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Sort Length px | Slider | 1–2000 | 200 |
| Threshold Low (0–100) | Slider | 0–100 | 60 |
| Threshold High (0–100) | Slider | 0–100 | 100 |
| Softness | Slider | 0–100 | 10 |
| Randomness % | Slider | 0–100 | 0 |
| Iterations | Slider | 1–10 | 1 |

### Color Key (mask sort area)
| Control | Type | Default |
|---------|------|---------|
| Enable Color Key | Toggle | OFF |
| Key Color | ColorPicker | `#ff0000` |
| Hue Tolerance ° | Slider 1–180 | 30 |
> Key Color + Hue Tolerance dimmed (opacity 0.4) when Color Key disabled.

### Animation
| Control | Type | Options / Range | Default |
|---------|------|----------------|---------|
| Animate Pixel Sort | Toggle | | OFF |
| Animation Style | Dropdown | Drift / Pulse / Threshold Sweep / Length Wave / Random Flicker / Scanline Move | Drift |
| Speed | Slider | 0–10, step 0.1 | 1 |
| Anim Amount | Slider | 0–500 | 50 |
| Loop Sec | Slider | 0.25–20, step 0.25 | 2 |

---

## 5. Distortions Suite

**CTA:** `Apply Distortion`

### Distortion Type
| Control | Type | Options |
|---------|------|---------|
| Distortion Type | ButtonGroup | Lens / Warp / Swirl / Wave / Bulge / Pinch |

### Common
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Intensity % | Slider | −200–200 | 50 |
| Radius px | Slider | 10–2000 | 200 |
| Feather px | Slider | 0–200 | 0 |
| Opacity % | Slider | 0–100 | 100 |

### Center Point
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Center X | Slider | 0–1, step 0.01 | 0.5 |
| Center Y | Slider | 0–1, step 0.01 | 0.5 |
*(in row-2)*

### Lens *(shown when type = Lens)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Focal Length mm | Slider | 10–300 | 50 |

### Mesh Warp *(shown when type = Warp)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Mesh Cols | Slider | 2–20 | 5 |
| Mesh Rows | Slider | 2–20 | 5 |

### Swirl *(shown when type = Swirl)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Angle ° | Slider | −720–720 | 90 |

### Wave *(shown when type = Wave)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Amplitude px | Slider | 0–200 | 20 |
| Frequency | Slider | 0.1–20, step 0.1 | 5 |
| Speed | Slider | 0–10, step 0.1 | 1 |

*Bulge and Pinch use only the Common controls; no extra section.*

### Apply Target
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Apply Target | ButtonGroup | Selected / Duplicate / New Adj / Sel Adj / Precomp Adj | Selected |

### Animation
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Animated | ButtonGroup | Static / Animated | Static |
| Animation Mode | ButtonGroup | Loop / Ping Pong / Drift / Pulse / Keys | Loop |
| Output | ButtonGroup | Expressions / Keyframes | Expressions |
| Loop Duration | Slider 0.25–20, step 0.05 | | 2.0 |
| Speed | Slider 0–10, step 0.1 | | 1.0 |
| Anim Amount | Slider 0–200 | | 25 |
| Random Seed | Slider 1–9999 | | 1 |

---

## 6. Color Lab

**CTA:** `Apply Grade`  
**Live Preview:** dot indicator (glows when live-sending to AE, 450ms debounce). Every control fires live preview on change.

### Film Look
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Look Preset | Dropdown | None / Bleach Bypass / Teal & Orange / Vintage / Cool Blue / Warm Golden / Horror / Golden Hour / Moonlight / Neon Noir / Faded Film / Cross Process / Cyberpunk / Documentary / Studio Portrait / Infrared | None |
| Intensity % | Slider 0–100 | | 100 |

### Exposure & Temperature
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Exposure (stops) | Slider | −3–3, step 0.1 | 0 |
| Temperature | Slider | −100–100 | 0 |
| Tint | Slider | −100–100 | 0 |
*(Temperature + Tint in row-2)*

### Color Wheels
Three DaVinci-style canvas wheels side-by-side: **Lift · Gamma · Gain**

Each wheel cell contains:
- Title label
- **88×88 canvas** — outer hue ring (18% of radius) + inner saturation disc + white center point. Drag disc to set color direction + saturation.
- **Reset ×** button (resets XY only, preserves luma)
- **Luma mini-slider** — range input −100→100, center-origin fill, below the canvas
- **Value readout** — shows direction (Red/Ylw/Grn/Cyn/Blu/Mag) + distance %

State fields: `liftX/liftY/liftLuma`, `gammaX/gammaY/gammaLuma`, `gainX/gainY/gainLuma`

### Global
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Hue ° | Slider | −180–180 | 0 |
| Saturation | Slider | −100–100 | 0 |
| Lightness | Slider | −100–100 | 0 |
| Brightness | Slider | −150–150 | 0 |
| Contrast | Slider | −100–100 | 0 |
*(Brightness + Contrast in row-2)*

### HSL Selective
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Enable selective color | Toggle | | OFF |
| Target Color | Dropdown | Reds / Yellows / Greens / Cyans / Blues / Magentas | Reds |
| Hue Adjust ° | Slider −60–60 | | 0 |
| Saturation | Slider −100–100 | | 0 |
| Lightness | Slider −100–100 | | 0 |
*(Saturation + Lightness in row-2)*

### Skin Protection
| Control | Type | Default |
|---------|------|---------|
| Protect skin tones | Toggle | OFF |
| Strength % | Slider 0–100 | 50 |

### Tint
| Control | Type | Default |
|---------|------|---------|
| Amount % | Slider 0–100 | 0 |
| Map Black | ColorPicker | `#000000` |
| Map White | ColorPicker | `#ffffff` |
*(Map Black + Map White in row-2)*

### Grain
| Control | Type | Default |
|---------|------|---------|
| Amount % | Slider 0–100 | 0 |
| Chromatic grain (RGB per channel) | Toggle | OFF |

### Vignette
| Control | Type | Default |
|---------|------|---------|
| Strength | Slider 0–100 | 0 |
| Midpoint % | Slider 0–100 | 50 |
*(in row-2)*

**Apply row layout:** `● Live` dot + "Live" label + `Apply Grade` button (inline flex)

---

## 7. Gradient Studio

**CTA:** `Generate Gradient`

### Type
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Type | ButtonGroup | Linear / Radial / Conic / Mesh / Noise | Linear |

### Colors
| Control | Type | Default |
|---------|------|---------|
| Start / From | ColorPicker | `#0a0a2e` |
| End / To | ColorPicker | `#ff6b6b` |
*(in row-2)*

### Position *(Linear + Radial only)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Start X % | Slider 0–100 | | 10 |
| Start Y % | Slider 0–100 | | 50 |
*(in row-2)*
| End X % | Slider 0–100 | | 90 |
| End Y % | Slider 0–100 | | 50 |
*(in row-2)*
| Scatter | Slider 0–100 | | 0 |

### Center *(Conic only)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Center X % | Slider 0–100 | | 50 |
| Center Y % | Slider 0–100 | | 50 |
*(in row-2)*
| Segments | Slider 4–36 | | 16 |

### Mesh *(Mesh only)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Blur Radius px | Slider 50–600, step 10 | | 200 |
*Help text: "Edit meshStops in saved presets for custom control points."*

### Noise *(Noise only)*
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Noise Type | Dropdown | Basic / Turbulent | Basic |
| Scale | Slider 50–1000, step 10 | | 250 |
| Complexity | Slider 1–8 | | 3 |
| Colorize | Toggle | | ON |

### Output
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Blend Mode | Dropdown | Normal / Add / Screen / Multiply / Overlay / Soft Light | Normal |

---

## 8. Pattern Pro

**CTA:** `Generate Pattern`

### Pattern Type
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Pattern Type | ButtonGroup | L-System / Spirograph | L-System |

### Grammar *(L-System only)*
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Pattern | Dropdown | Koch Snowflake / Dragon Curve / Sierpinski Triangle / Plant / Hilbert Curve / Lévy C Curve / Gosper Curve | Koch Snowflake |
| Iterations | Slider 1–7 | | 4 |
| Angle ° | Slider 1–180 | | 60 |

### Spirograph *(Spirograph only)*
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Outer R | Slider 10–300 | | 100 |
| Inner R | Slider 1–300 | | 40 |
*(in row-2)*
| Pen Dist | Slider 1–400 | | 60 |
| Steps | Slider 60–2000, step 10 | | 720 |

### Appearance
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Size px (0=auto) | Slider 0–2000, step 10 | | 0 |
| Stroke px | Slider 0.5–20, step 0.5 | | 1.5 |
*(in row-2)*
| Stroke Color | ColorPicker | | `#a3e635` |

### Animation
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Animation | ButtonGroup | None / Draw On | Draw On |
| Duration (s) | Slider 0.5–10, step 0.5 | | 2 |

---

## 9. Physics Rig

**CTA:** `Simulate Physics`

*Help text at top:* "Prefix layer name with [static], [kinematic], or [dormant] to set body type. Add layer comment like `density:2,friction:0.3,bounce:0.8` for per-layer overrides."

### Gravity
| Control | Type | Range | Default |
|---------|------|-------|---------|
| X px/s² | Slider | −2000–2000, step 10 | 0 |
| Y px/s² | Slider | −2000–2000, step 10 | 980 |
*(in row-2)*
| Gravity Scale | Slider −3–5, step 0.1 | | 1 |

### Material (Global Defaults)
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Bounce % | Slider 0–100 | | 55 |
| Air Friction % | Slider 0–20, step 0.5 | | 1 |
| Ground Friction % | Slider 0–80 | | 15 |
| Default Density | Slider 0.1–10, step 0.1 | | 1 |

### Initial Velocity
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Vel X px/s | Slider −2000–2000, step 10 | | 0 |
| Vel Y px/s | Slider −2000–2000, step 10 | | −200 |
*(in row-2)*

### Magnetism
| Control | Type | Default |
|---------|------|---------|
| Enable magnetism | Toggle | OFF |
*(Collapsed section shown when enabled:)*
| Type | ButtonGroup Attract/Repulse | | Attract |
| Strength | Slider 10–2000, step 10 | | 200 |
| Range px | Slider 50–2000, step 10 | | 400 |

### Simulation
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Duration (s) | Slider 0.5–10, step 0.5 | | 3 |
| Bounce off walls | Toggle | | ON |
| Simulate rotation | Toggle | | ON |
| Export contact markers | Toggle | | OFF |

*Help text before CTA:* "Select the layers you want to simulate, then click Simulate."

---

## 10. Particle Engine

**CTA:** `Generate Particles`

### Emitter
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Emitter | ButtonGroup | Point / Box / Ring | Point |
| Emitter X % | Slider 0–100 | | 50 |
| Emitter Y % | Slider 0–100 | | 80 |
*(in row-2)*
| Width px | Slider 0–1000, step 10 | | 100 |
| Height px | Slider 0–1000, step 10 | | 100 |
*(in row-2)*

### Emission
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Rate /frame | Slider 1–30 | | 8 |
| Max particles | Slider 10–200, step 10 | | 100 |
*(in row-2)*
| Life (s) | Slider 0.2–8, step 0.1 | | 1.5 |
| Life Var % | Slider 0–100 | | 30 |
*(in row-2)*

### Direction
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Direction ° | Slider −180–180 | | −90 (up) |
| Spread ° | Slider 0–360 | | 30 |
| Velocity px/s | Slider 0–2000, step 10 | | 200 |
| Vel Var % | Slider 0–100 | | 40 |
*(Velocity + Vel Var in row-2)*

### Physics
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Gravity X | Slider −1000–1000, step 10 | | 0 |
| Gravity Y | Slider −1000–1000, step 10 | | 200 |
*(in row-2)*
| Wind | Slider −500–500, step 10 | | 0 |
| Turb | Slider 0–500, step 10 | | 0 |
| Drag % | Slider 0–20, step 0.5 | | 2 |
*(Wind + Turb + Drag in row-3)*

### Appearance
| Control | Type | Default |
|---------|------|---------|
| Color | ColorPicker | `#ffffff` |
| Size Born px | Slider 1–100 | 10 |
| Size Die px | Slider 0–100 | 2 |
*(in row-2)*
| Opacity Born % | Slider 0–100 | 100 |
| Opacity Die % | Slider 0–100 | 0 |
*(in row-2)*

### Output
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Duration (s) | Slider 0.5–10, step 0.5 | | 3 |

---

## 11. GlitchMosh

**CTA:** `Apply GlitchMosh`

Seven stages. Each stage has a **Toggle** at its header (enable/disable that stage). Controls underneath are always visible regardless of toggle state.

### Master
| Control | Type | Range | Default |
|---------|------|-------|---------|
| Intensity % | Slider 0–100 | | 100 |
| Random Seed | Slider 0–999 | | 42 |

### Stage 1: Frame Bleed
| Control | Type | Range | Default |
|---------|------|-------|---------|
| *(toggle)* Frame Bleed | Toggle | | ON |
| Amount % | Slider 0–100 | | 70 |
| Decay % | Slider 0–100 | | 80 |
| Frame Offset | Slider 1–10 | | 3 |
| Luma Thresh | Slider 0–100 | | 50 |

### Stage 2: Pixel Smear
| Control | Type | Range | Default |
|---------|------|-------|---------|
| *(toggle)* Pixel Smear | Toggle | | ON |
| Smear Length | Slider 0–300 | | 120 |
| Direction | ButtonGroup | H / V / Both | H (0) |
| Stretch | Slider 0–100 | | 50 |

### Stage 3: Block Corruption
| Control | Type | Range | Default |
|---------|------|-------|---------|
| *(toggle)* Block Corruption | Toggle | | ON |
| Block Size | Slider 4–128 | | 32 |
| Offset | Slider 0–100 | | 40 |
| Chaos | Slider 0–100 | | 50 |
| Drop Rate fps | Slider 1–30 | | 6 |
| Color Shift | Slider 0–100 | | 20 |

### Stage 4: RGB + Chroma Bleed
| Control | Type | Range | Default |
|---------|------|-------|---------|
| *(toggle)* RGB + Chroma Bleed | Toggle | | ON |
| H Split px | Slider 0–40 | | 8 |
| V Split px | Slider 0–40 | | 2 |
| Chroma Bleed | Slider 0–100 | | 40 |

### Stage 5: Temporal Stutter
| Control | Type | Range | Default |
|---------|------|-------|---------|
| *(toggle)* Temporal Stutter | Toggle | | ON |
| Stutter fps | Slider 1–30 | | 8 |
| Hold Frames | Slider 1–10 | | 2 |
| Stutter Seed | Slider 0–99 | | 7 |

### Stage 6: Compression Noise
| Control | Type | Range | Default |
|---------|------|-------|---------|
| *(toggle)* Compression Noise | Toggle | | ON |
| Noise % | Slider 0–100 | | 20 |
| Grain Size | Slider 1–10 | | 2 |
| Ring % | Slider 0–100 | | 15 |

### Glitch Mask
| Control | Type | Options | Default |
|---------|------|---------|---------|
| Mask Mode | ButtonGroup | Full / Bright / Dark / Edges | Full (0) |
| Feather | Slider 0–100 | | 20 |

---

## Plugin Summary Table

| # | Name | Tab | CTA | AE object created |
|---|------|-----|-----|-------------------|
| 1 | Slides Generator | slides | Generate Slides | Shape layers (cards) + optional SLIDES_CONTROL null |
| 2 | Grids Pro | grids | Generate Grid / Create Layout Rig | Shape layer (pattern) / GRID_CONTROL null |
| 3 | Deep Glow | glow | Apply Glow | Glow pass layers + optional GLOW_CONTROLLER null |
| 4 | Pixel Sorter | sorter | Apply Pixel Sort | Effect stack on layer / PIXEL_SORT_CONTROL null |
| 5 | Distortions Suite | dist | Apply Distortion | Effect on layer or new adjustment layer |
| 6 | Color Lab | colorlab | Apply Grade | Adjustment layer with stacked color effects |
| 7 | Gradient Studio | gradient | Generate Gradient | New solid/shape layer with gradient effect |
| 8 | Pattern Pro | patterns | Generate Pattern | Shape layer (L-System strokes / Spirograph path) |
| 9 | Physics Rig | physics | Simulate Physics | Baked position/rotation keyframes on selected layers |
| 10 | Particle Engine | particles | Generate Particles | Pool of shape layers parented to null |
| 11 | GlitchMosh | glitchmosh | Apply GlitchMosh | Multi-stage effect rig on selected layer |

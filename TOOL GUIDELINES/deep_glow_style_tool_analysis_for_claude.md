# Cinematic Glow / Bloom Tool Analysis for Claude

## Purpose of this document

This document is meant to be fed into Claude or another AI builder inside a VS Code workflow. The goal is to design an original After Effects tool inspired by modern cinematic glow/bloom plugins such as Deep Glow, without copying their code, UI, branding, presets, or exact implementation.

The product direction should be:

**Cinematic Glow Rig Builder**  
or  
**Optical Bloom Designer**

The tool should help motion designers create editable, high-quality glow/bloom looks for neon text, product highlights, UI elements, sci-fi graphics, logo reveals, energy effects, and cinematic light bloom.

---

# 1. Reference Product Summary: Deep Glow

Deep Glow 2 is an After Effects plugin sold on aescripts. Its product page describes it as a high-quality glow plugin with new features such as cinematic tonemapping, RGB radius multipliers, lens dirt texturing, multicolor tint, image-based glow, higher quality, and faster performance.

The purpose of this analysis is not to clone Deep Glow. The goal is to understand the category and create an original tool with a similar broad purpose: better cinematic glow than the default After Effects Glow effect.

## Core category idea

A glow/bloom tool generally does this:

```text
Input Layer
   ↓
Detect bright or emissive pixels
   ↓
Extract those pixels into a glow source
   ↓
Blur/spread the source using one or more passes
   ↓
Color-process the glow
   ↓
Composite the glow back over the original image
```

A strong glow tool should feel softer, deeper, and more cinematic than simply applying Gaussian Blur or the default AE Glow.

---

# 2. Original Tool Concept

Build an After Effects ScriptUI or UXP panel that creates a non-destructive glow rig using native After Effects effects and layers.

## Product Name Options

```text
Cinematic Glow Rig Builder
Optical Bloom Designer
LumaGlow Studio
BloomStack
Neon Bloom Rig
```

## Main product promise

```text
Create editable cinematic glow, bloom, neon, lens dirt, chromatic glow, and product-lighting effects using native After Effects layers and effect stacks.
```

## Important legal/product direction

Do not copy:

```text
- Deep Glow name
- Deep Glow UI layout
- Deep Glow presets
- Deep Glow source code
- Deep Glow exact internal algorithm
- Deep Glow marketing language
```

Do build:

```text
- An original AE panel
- Original naming
- Original UI structure
- Original presets
- Native AE-based glow stack
- Editable precomp/adjustment-layer workflow
```

---

# 3. Recommended Build Path

There are two possible build paths.

## Path A: Script / UXP Panel using native AE effects

This is the recommended MVP.

The tool creates glow rigs using:

```text
- Precomps
- Adjustment layers
- Duplicate layers
- Track mattes
- Levels
- Curves
- Exposure
- Tint
- Fill
- Gaussian Blur / Fast Box Blur
- Set Matte / Shift Channels
- Blending modes such as Add or Screen
- Expressions
- Effect controls on a master controller null
```

### Pros

```text
- Faster to build
- Good for VS Code + Claude workflow
- Does not require C++
- Editable by motion designers
- Works as a production helper tool
```

### Cons

```text
- Slower than a compiled plugin
- Less physically accurate
- Harder to create custom blur kernels
- Harder to support true GPU acceleration
```

## Path B: Real compiled AE plugin

This would require the After Effects SDK, C++, and probably GPU/render pipeline work.

### Pros

```text
- Real effect plugin
- Faster performance
- Custom pixel processing
- Better 8/16/32 bpc support
- Commercial plugin potential
```

### Cons

```text
- Much harder
- Requires C++ and AE SDK knowledge
- Requires Mac/Windows builds
- Much longer development cycle
```

## Recommendation

Start with Path A. Build a native-effect-stack panel first. Once the controls, UX, and looks are validated, consider converting the core into a compiled plugin later.

---

# 4. MVP Feature Set

The MVP should create a useful glow rig quickly.

## MVP user flow

```text
1. User selects one or more layers.
2. User clicks "Create Glow Rig".
3. Tool creates a non-destructive glow setup.
4. Tool adds a master controller layer.
5. Tool creates blur passes or adjustment layers.
6. User controls intensity, radius, threshold, tint, and quality.
```

## MVP controls

```text
Glow Intensity
Glow Radius
Threshold
Threshold Softness
Source Gain
Tint Color
Source Color Amount
Blend Mode
Glow Only Toggle
Quality Mode
```

## MVP effect stack idea

For each selected layer:

```text
Selected Layer
   ↓
Duplicate or precomp layer as Glow Source
   ↓
Apply threshold using Levels/Curves
   ↓
Create multiple blur passes
   ↓
Tint or preserve source color
   ↓
Composite glow over original using Add/Screen
   ↓
Expose controls on master null
```

---

# 5. Core Architecture

## Layer structure

When the user selects a layer called `LOGO`, the tool can create:

```text
LOGO                         // original untouched layer
LOGO_GLOW_PRECOMP             // optional precomp containing source
LOGO_GLOW_PASS_01_TIGHT        // small radius, high intensity
LOGO_GLOW_PASS_02_SOFT         // medium radius
LOGO_GLOW_PASS_03_WIDE         // large radius
LOGO_GLOW_PASS_04_ATMOSPHERE   // huge radius, low intensity
GLOW_CONTROLLER                // master controls
```

Alternative cleaner structure:

```text
GLOW_CONTROLLER
GLOW_STACK_LOGO_PRECOMP
   ├── SOURCE_ISOLATION
   ├── BLUR_PASS_TIGHT
   ├── BLUR_PASS_MEDIUM
   ├── BLUR_PASS_WIDE
   └── FINAL_COMPOSITE
```

## Master controller effect controls

Create a null or adjustment layer called:

```text
GLOW_CONTROLLER
```

Add controls:

```text
Slider: Glow Intensity
Slider: Glow Radius
Slider: Threshold
Slider: Threshold Softness
Slider: Source Gain
Slider: Saturation Bias
Slider: Tint Amount
Color Control: Tint Color
Dropdown: Color Mode
Dropdown: Blend Mode
Dropdown: Quality
Checkbox: Glow Only
Checkbox: Use Lens Dirt
Checkbox: Use Chromatic Aberration
Slider: Chromatic Amount
Slider: Anamorphic Stretch
Dropdown: Tonemap Mode
Slider: Exposure
Slider: Highlight Compression
```

---

# 6. Glow Source Extraction

The first stage is detecting what part of the image should glow.

## Source modes

```text
Luminance
Alpha
RGB Brightness
Red Channel
Green Channel
Blue Channel
Manual Matte Layer
```

## Controls

```text
Source Channel
Threshold
Threshold Softness
Source Gain
Source Blur
Invert Source
Use Alpha
```

## Conceptual logic

```text
luma = dot(rgb, [0.2126, 0.7152, 0.0722])
mask = smoothstep(threshold, threshold + softness, luma)
glowSource = inputColor * mask * sourceGain
```

## Claude instruction

```text
Implement a glow source isolation module. It should duplicate or precomp the selected layer and apply native AE effects to isolate bright areas using luminance, alpha, or RGB. Use Levels/Curves where possible. Expose Threshold and Threshold Softness on the GLOW_CONTROLLER.
```

---

# 7. Multi-Pass Blur System

A good cinematic glow should not use just one blur. Use several blur passes with different radii.

## Pass design

```text
Pass 1: Tight Core       radius = Glow Radius * 0.10, intensity = 1.00
Pass 2: Soft Body        radius = Glow Radius * 0.35, intensity = 0.60
Pass 3: Wide Bloom       radius = Glow Radius * 0.80, intensity = 0.30
Pass 4: Atmosphere       radius = Glow Radius * 1.60, intensity = 0.12
```

## Why this matters

```text
- Tight pass keeps the glow connected to the source.
- Medium pass creates the visible bloom.
- Wide pass creates cinematic atmosphere.
- Huge low-opacity pass creates depth.
```

## Controls

```text
Glow Radius
Glow Intensity
Falloff
Pass Count
Quality
```

## Claude instruction

```text
Create a multi-pass glow system using duplicated/precomped layers with native blur effects. Each pass should have an expression-driven blur radius based on the master Glow Radius slider. Composite the passes together using Add or Screen blending. Provide Draft, Preview, and Final quality modes that change the number of passes or blur samples.
```

---

# 8. Falloff Modes

The tool should support different glow personalities.

## Falloff presets

```text
Soft Bloom
Cinematic
Hard Neon
Exponential
Inverse-Square Inspired
Atmospheric
```

## Pass intensity examples

### Soft Bloom

```text
[1.0, 0.7, 0.4, 0.2]
```

### Hard Neon

```text
[1.2, 0.5, 0.15, 0.04]
```

### Atmospheric

```text
[0.5, 0.6, 0.45, 0.3]
```

## Claude instruction

```text
Add a Falloff Mode dropdown. Based on the dropdown, adjust the opacity/intensity multipliers of each glow pass. Do not hard-code only one look. The user should be able to switch between soft bloom, hard neon, cinematic, and atmospheric behavior.
```

---

# 9. Color System

## Color modes

```text
Original Color
Single Tint
Tint Mix
Gradient Tint
Heatmap
RGB Split
Palette Mode
```

## Controls

```text
Color Mode
Tint Color
Tint Amount
Source Color Amount
Saturation Bias
Hue Shift
Color Intensity
```

## Saturation bias concept

Saturation bias controls whether highly saturated colors contribute more or less to the glow.

Conceptual formula:

```text
saturation = max(rgb) - min(rgb)
glowStrength = baseStrength * mix(1.0, saturation, saturationBias)
```

## Claude instruction

```text
Add a color module. The glow should either preserve the original source colors or be recolored with a tint. Add a Tint Amount slider to mix between source color and tint color. Add Saturation Bias as an advanced control.
```

---

# 10. RGB Radius Multipliers

This gives each color channel a slightly different blur radius.

## Controls

```text
Red Radius Multiplier
Green Radius Multiplier
Blue Radius Multiplier
```

## Example

```text
Red: 1.05
Green: 1.00
Blue: 0.95
```

This creates subtle optical separation.

## Native AE implementation idea

For a script-based rig:

```text
1. Create three glow precomps or duplicated passes.
2. Isolate R, G, and B using Shift Channels or Channel Combiner.
3. Apply slightly different blur radii to each channel.
4. Recombine using Add blending.
```

## Claude instruction

```text
Implement optional RGB Radius Multipliers. If enabled, create separate red, green, and blue glow passes. Each channel should have its own blur radius multiplier. Keep this disabled by default because it is heavier.
```

---

# 11. Chromatic Aberration

Chromatic aberration offsets color channels slightly to create a lens-like glow.

## Controls

```text
Enable Chromatic Aberration
Chromatic Amount
Chromatic Direction
Center Point
Affect Glow Only
```

## Simple implementation

```text
Red glow pass offset slightly one way.
Blue glow pass offset slightly the other way.
Green stays centered.
```

## Claude instruction

```text
Add optional chromatic aberration on the glow only. Create separated RGB glow layers and offset the red and blue channels using expressions based on a Chromatic Amount slider. Keep the default value very subtle.
```

---

# 12. Lens Dirt / Texture Module

Lens dirt makes bright glow reveal dust, scratches, smudges, or optical texture.

## Controls

```text
Enable Lens Dirt
Dirt Texture Layer
Dirt Intensity
Dirt Contrast
Dirt Scale
Dirt Opacity
Dirt Blend Mode
```

## Implementation idea

```text
Glow Composite
   ↓
Multiply / Screen with Lens Dirt Texture
   ↓
Composite over original
```

The script can ask the user to select a lens dirt layer, or it can generate a procedural noise layer.

## Claude instruction

```text
Add a Lens Dirt module. Allow the user to choose a texture layer or generate a procedural noise texture. Use the texture to modulate the glow intensity, so dirt is only visible where the glow is bright.
```

---

# 13. Anamorphic Glow

Anamorphic glow stretches light horizontally or vertically.

## Controls

```text
Enable Anamorphic
Stretch Amount
Stretch Direction
Horizontal Radius
Vertical Radius
```

## Implementation idea

Use separate blur dimensions if available, or scale the glow precomp in one axis before/after blur.

## Claude instruction

```text
Add Anamorphic Glow. It should stretch the glow horizontally or vertically for lens streak/product-light looks. Use directional blur, separated blur dimensions, or precomp scaling depending on what is easiest in native AE.
```

---

# 14. Image-Based Glow / Iris Shape

A more advanced version can shape the glow using a custom image or iris pattern.

## Shape modes

```text
Round
Wide / Anamorphic
Star
Hex Iris
Custom Image Layer
```

## Claude instruction

```text
Add an advanced Image-Based Glow mode later. The user can select a custom iris/shape layer that influences the glow pattern. This is a post-MVP feature.
```

---

# 15. Tonemapping / Highlight Control

Glow can easily clip to ugly white. Add tonemapping-style controls.

## Controls

```text
Tonemap Mode
Exposure
Highlight Compression
White Point
Black Point
Gamma
Soft Clip
```

## Modes

```text
None
Soft Clip
Reinhard Inspired
Filmic Inspired
ACES Inspired
```

## Claude instruction

```text
Add a Tonemapping section. In the native AE version, approximate tonemapping with Curves, Exposure, Levels, and/or Lumetri where practical. Include Soft Clip, Filmic Inspired, and Reinhard Inspired presets. The goal is to avoid harsh clipping and preserve pleasant highlights.
```

---

# 16. Gamma / Linear Workflow

Glow looks more natural when processed in linear space.

## Controls

```text
Linearize Input
Process Glow in Linear
Output Gamma
Gamma Value
```

## Claude instruction

```text
Add a Gamma Correction toggle. If possible, apply gamma correction before and after the glow processing to approximate a linear workflow inside a standard After Effects project.
```

---

# 17. Compositing Modes

## Modes

```text
Original + Glow
Glow Only
Glow Behind
Add
Screen
Linear Dodge
Soft Light
```

## Controls

```text
Composite Mode
Glow Opacity
Glow Only View
Preserve Alpha
Unmult Glow
```

## Claude instruction

```text
Add compositing controls. The user should be able to view the final result, view only the glow, or place the glow behind the original layer. Use Add or Screen blending by default.
```

---

# 18. Quality Modes

Quality modes help with performance.

## Modes

```text
Draft
Preview
Final
Ultra
```

## Example behavior

```text
Draft: 2 passes, lower blur radius, faster effects
Preview: 3 passes
Final: 4-5 passes, full radius
Ultra: 5+ passes, RGB split optional
```

## Claude instruction

```text
Add quality presets that change pass count, blur quality, and whether heavy features are enabled. Draft should be fast. Final should look better.
```

---

# 19. Presets

Create original presets.

## Preset list

```text
Soft Product Bloom
Neon Sign
Sci-Fi HUD
Logo Reveal Glow
Energy Core
Warm Lamp Bloom
Cold Screen Glow
Cyberpunk Edge
Luxury Product Highlight
Lens Bloom with Dirt
Anamorphic Product Streak
```

## Preset structure

Each preset should set:

```text
Intensity
Radius
Threshold
Tint
Color Mode
Falloff Mode
Anamorphic Amount
Lens Dirt
Tonemap Mode
Quality
```

## Claude instruction

```text
Add a preset system. Presets should be original and stored as JSON objects inside the project. Selecting a preset updates the controller values.
```

---

# 20. Suggested UI Layout

## Simple tab

```text
[Create Glow Rig]

Glow Intensity
Glow Radius
Threshold
Tint Color
Preset Dropdown
Quality Dropdown
Glow Only Checkbox
```

## Advanced tab

```text
Source
- Source Channel
- Threshold
- Threshold Softness
- Source Gain

Glow Shape
- Radius
- Falloff
- Pass Count
- Anamorphic Stretch

Color
- Color Mode
- Tint Color
- Tint Amount
- Saturation Bias
- RGB Radius Multipliers

Optics
- Chromatic Aberration
- Lens Dirt
- Iris Shape

Tone
- Exposure
- Gamma
- Tonemap Mode
- Highlight Compression

Output
- Blend Mode
- Glow Only
- Preserve Alpha
- Bake Rig
- Remove Rig
```

---

# 21. VS Code Project Structure

Use this folder structure:

```text
cinematic-glow-rig-builder/
  README.md
  package.json
  src/
    main.jsx
    ui.jsx
    createGlowRig.jsx
    controllers.jsx
    effects.jsx
    presets.jsx
    utils.jsx
    constants.jsx
  presets/
    glow-presets.json
  docs/
    architecture.md
    roadmap.md
    implementation-notes.md
  test-projects/
    README.md
```

## File responsibilities

### `main.jsx`

```text
Entry point. Loads UI and connects buttons to functions.
```

### `ui.jsx`

```text
Creates ScriptUI panel. Contains buttons, sliders, dropdowns, and checkboxes.
```

### `createGlowRig.jsx`

```text
Main logic for building glow rigs from selected layers.
```

### `controllers.jsx`

```text
Functions to create GLOW_CONTROLLER and add expression controls.
```

### `effects.jsx`

```text
Utility functions for applying AE effects such as blur, levels, curves, tint, exposure, and channel effects.
```

### `presets.jsx`

```text
Loads and applies preset values.
```

### `utils.jsx`

```text
Selection validation, naming, layer duplication, precomp creation, error handling.
```

### `constants.jsx`

```text
Effect names, control names, dropdown IDs, default values.
```

---

# 22. Pseudo-Code: Create Glow Rig

```js
function createGlowRig() {
  app.beginUndoGroup("Create Cinematic Glow Rig");

  var comp = app.project.activeItem;
  if (!comp || !(comp instanceof CompItem)) {
    alert("Please open a composition.");
    return;
  }

  var selectedLayers = comp.selectedLayers;
  if (!selectedLayers || selectedLayers.length === 0) {
    alert("Select at least one layer.");
    return;
  }

  var controller = createGlowController(comp);

  for (var i = 0; i < selectedLayers.length; i++) {
    var layer = selectedLayers[i];
    buildGlowStackForLayer(comp, layer, controller);
  }

  app.endUndoGroup();
}
```

---

# 23. Pseudo-Code: Controller Creation

```js
function createGlowController(comp) {
  var nullLayer = comp.layers.addNull();
  nullLayer.name = "GLOW_CONTROLLER";
  nullLayer.label = 11;

  addSlider(nullLayer, "Glow Intensity", 1.0);
  addSlider(nullLayer, "Glow Radius", 80);
  addSlider(nullLayer, "Threshold", 70);
  addSlider(nullLayer, "Threshold Softness", 20);
  addSlider(nullLayer, "Source Gain", 1.0);
  addColor(nullLayer, "Tint Color", [1, 0.8, 0.35]);
  addSlider(nullLayer, "Tint Amount", 0);
  addSlider(nullLayer, "Anamorphic Stretch", 0);
  addSlider(nullLayer, "Chromatic Amount", 0);
  addCheckbox(nullLayer, "Glow Only", false);

  return nullLayer;
}
```

---

# 24. Pseudo-Code: Multi-Pass Glow Stack

```js
function buildGlowStackForLayer(comp, sourceLayer, controller) {
  var passSettings = [
    { name: "TIGHT", radiusMultiplier: 0.10, opacity: 100 },
    { name: "SOFT", radiusMultiplier: 0.35, opacity: 60 },
    { name: "WIDE", radiusMultiplier: 0.80, opacity: 30 },
    { name: "ATMOS", radiusMultiplier: 1.60, opacity: 12 }
  ];

  for (var i = 0; i < passSettings.length; i++) {
    var pass = sourceLayer.duplicate();
    pass.name = sourceLayer.name + "_GLOW_" + passSettings[i].name;
    pass.moveBefore(sourceLayer);
    pass.blendingMode = BlendingMode.ADD;

    applySourceIsolation(pass, controller);
    applyBlur(pass, controller, passSettings[i].radiusMultiplier);
    applyTintOrColor(pass, controller);
    applyOpacityExpression(pass, controller, passSettings[i].opacity);
  }
}
```

---

# 25. Expression Ideas

## Blur radius expression

```js
ctrl = thisComp.layer("GLOW_CONTROLLER");
radius = ctrl.effect("Glow Radius")("Slider");
radius * 0.35;
```

## Opacity expression

```js
ctrl = thisComp.layer("GLOW_CONTROLLER");
intensity = ctrl.effect("Glow Intensity")("Slider");
baseOpacity = 60;
baseOpacity * intensity;
```

## Tint amount expression

```js
ctrl = thisComp.layer("GLOW_CONTROLLER");
ctrl.effect("Tint Amount")("Slider");
```

---

# 26. Roadmap

## Version 0.1 MVP

```text
- ScriptUI panel
- Create controller null
- Duplicate selected layers
- Create 3 blur passes
- Add intensity/radius/threshold controls
- Add tint color
- Add glow only mode
```

## Version 0.2 Better controls

```text
- Falloff presets
- Quality modes
- Preset dropdown
- Remove rig button
- Bake rig button
```

## Version 0.3 Optical features

```text
- Chromatic aberration
- RGB radius multipliers
- Anamorphic glow
```

## Version 0.4 Texture features

```text
- Lens dirt texture layer
- Procedural dirt/noise generator
- Dirt intensity/contrast controls
```

## Version 0.5 Advanced color/tone

```text
- Tonemapping approximations
- Gamma correction
- Saturation bias
- Gradient tint
```

## Version 1.0

```text
- Clean UI
- Presets
- Documentation
- Error handling
- Production-ready naming
- Works on multiple selected layers
```

---

# 27. Claude Build Prompt

Copy this into Claude after giving it this document:

```text
Build a VS Code project for an After Effects ScriptUI panel named "Cinematic Glow Rig Builder".

The panel should create a non-destructive glow rig for selected layers using native After Effects effects. Do not build a compiled C++ plugin yet.

Core MVP requirements:
1. Validate that an active comp exists.
2. Validate that at least one layer is selected.
3. Create a GLOW_CONTROLLER null.
4. Add expression controls to the controller:
   - Glow Intensity
   - Glow Radius
   - Threshold
   - Threshold Softness
   - Source Gain
   - Tint Color
   - Tint Amount
   - Quality
   - Glow Only
5. For each selected layer, create multiple duplicate glow passes:
   - Tight pass
   - Soft pass
   - Wide pass
   - Atmosphere pass
6. Apply native AE effects to isolate bright pixels, blur the layer, tint it optionally, and composite it using Add or Screen blending.
7. Connect blur radius and opacity to the GLOW_CONTROLLER using expressions.
8. Add a simple preset system with at least these presets:
   - Soft Product Bloom
   - Neon Sign
   - Sci-Fi HUD
   - Logo Reveal Glow
   - Energy Core
9. Include clean comments in the code.
10. Include a README explaining installation, usage, and limitations.

Use a clean folder structure:
- src/main.jsx
- src/ui.jsx
- src/createGlowRig.jsx
- src/controllers.jsx
- src/effects.jsx
- src/presets.jsx
- src/utils.jsx
- presets/glow-presets.json
- README.md

Prioritize working ExtendScript/JSX code for After Effects first.
```

---

# 28. Final Design Principle

The tool should not just apply a single glow. It should create an editable glow system.

Weak version:

```text
Apply Glow effect to selected layer.
```

Strong version:

```text
Build a reusable cinematic glow rig with multiple blur passes, source isolation, tinting, lens options, and a master controller.
```

This makes the tool more valuable for motion designers and template builders.

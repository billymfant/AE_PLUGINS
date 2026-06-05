# Slides Tool v2 Upgrade Spec

## Purpose

This file is for upgrading the existing `SlidesUI` tool, not replacing it.

The current Slides tool is a quick slide/card grid generator. It should remain focused on generating slide layouts fast, but it should become more powerful, editable, and future-ready.

The goal is:

```text
Slides Tool v2 = current slide/card generator + better animation + optional live controller + selected-layer support + placeholder/precomp workflow.
```

This is different from a full Grid/Flex layout rig tool. A future Grid/Flex system can share some logic, but this Slides tool should stay as a simple, fast production tool.

---

## Current Tool Summary

The current code defines:

```js
window.SlidesUI = (function() { ... })();
```

Current state:

```js
var _state = {
  rows: 3,
  cols: 3,
  slideW: 200,
  slideH: 150,
  gapH: 10,
  gapV: 10,
  randomize: 0,
  rotationRandom: 0,
  scaleRandom: 0,
  animType: 'none',
  animStagger: 5,
  useText: false
};
```

Current UI sections:

```text
Grid
Slide Size
Spacing
Randomization
Animation
Options
Generate Slides button
```

Current bridge call:

```js
Bridge.call('slides.generate', getParams())
```

This means the front-end UI is already clean and modular. The upgrade should preserve this structure and expand it carefully.

---

## Correct Product Direction

Do not delete this tool.

Do not fully replace it with the Grid/Flex builder.

Instead, upgrade it into:

```text
Slides Tool v2
A fast After Effects slide/card generator for creating grids, carousels, placeholders, text cards, product cards, and simple animated slide layouts.
```

The bigger Grid/Flex rig system can be a separate tool later, or an advanced mode, but this Slides tool should remain quick and simple.

---

## Main Problems in Current Version

The current Slides tool is useful, but limited:

```text
1. It probably generates static slides only.
2. It has no live controller after generation.
3. It does not clearly support selected layers as slide contents.
4. It does not expose animation timing deeply enough.
5. It has no placeholder/precomp workflow.
6. It has no styling controls for slide cards.
7. It has no ability to update an existing generated layout.
8. It has no bake/release workflow.
```

---

## Upgrade Goals

Slides Tool v2 should allow the user to:

```text
1. Generate empty slide cards.
2. Generate slides from selected layers.
3. Generate precomp placeholders.
4. Add optional text layers.
5. Apply entrance animations.
6. Apply randomization.
7. Create a controller layer for later editing.
8. Update an existing slide layout.
9. Add frames/backgrounds/rounded corners.
10. Optionally add simple responsive grid behavior later.
```

---

# UI Upgrade Plan

## 1. Source Section

Add a new section before Grid:

```text
Source
- Empty Slides
- Selected Layers
- Selected Comps
- Placeholder Precomps
```

State additions:

```js
sourceMode: 'empty', // empty, selectedLayers, selectedComps, placeholders
useSelectedLayers: false,
createPrecomps: false,
replaceOriginals: false
```

UI controls:

```js
_sourceDD = new Dropdown({
  label: 'Source',
  options: [
    { value: 'empty', label: 'Empty Slides' },
    { value: 'selectedLayers', label: 'Selected Layers' },
    { value: 'selectedComps', label: 'Selected Comps' },
    { value: 'placeholders', label: 'Placeholder Precomps' }
  ],
  value: 'empty',
  onChange: function(v) { _state.sourceMode = v; }
});
```

---

## 2. Layout Section

Keep the existing controls, but rename internally for consistency:

```js
rows -> rows
cols -> cols
slideW -> cellW
slideH -> cellH
gapH -> gapX
gapV -> gapY
```

For backward compatibility, the UI can still say:

```text
Width px
Height px
Gap H
Gap V
```

Add:

```js
fitToComp: false,
alignToComp: true,
layoutAnchor: 'center',
orderMode: 'leftToRight'
```

New UI:

```text
Fit to Comp
Anchor: Center / Top Left / Top / Bottom / Custom
Order: Left to Right / Right to Left / Top to Bottom / Snake / Random
```

---

## 3. Card Style Section

Add style controls for generated slide cards:

```js
useFrames: true,
bgColor: '#222222',
strokeEnabled: false,
strokeWidth: 2,
strokeColor: '#ffffff',
roundness: 0,
cardOpacity: 100
```

UI:

```text
Use Background
Background Color
Card Opacity
Use Stroke
Stroke Width
Stroke Color
Roundness
```

Implementation:

Each slide can be a shape layer rectangle or a precomp with a background shape.

---

## 4. Text Section

Current tool has only:

```js
useText: false
```

Upgrade to:

```js
useText: false,
textMode: 'number', // number, customPrefix, layerName, none
textPrefix: 'Slide',
textSize: 32,
textColor: '#ffffff',
textPosition: 'center'
```

UI:

```text
Auto-create text layers
Text Mode: Number / Prefix / Layer Name
Text Prefix
Text Size
Text Color
Text Position
```

Generated text examples:

```text
01
Slide 01
Product 01
Layer name
```

---

# Animation Upgrade Plan

## Current Animation State

Current:

```js
animType: 'none',
animStagger: 5
```

This is too basic.

## New Animation State

```js
animType: 'none',
animDuration: 18,
animStagger: 5,
animEase: 'smooth',
animDirection: 'byIndex',
animOffset: 100,
animScaleFrom: 80,
animRotateFrom: 0,
animOpacityFrom: 0,
useOvershoot: false,
overshootAmount: 8
```

## New Animation Types

```text
None
Fade In
Scale In
Slide Up
Slide Down
Slide Left
Slide Right
Pop In
Flip In
Rotate In
Blur In
Random Entrance
```

## Stagger Modes

```text
By Index
By Row
By Column
From Center
From Edges
Random
```

## Backend Animation Logic

For each slide index:

```js
var delayFrames = params.animStagger * orderIndex;
var delay = delayFrames / comp.frameRate;
var startTime = comp.time + delay;
var endTime = startTime + params.animDuration / comp.frameRate;
```

Apply keyframes based on animation type.

Example for Scale In:

```js
scaleProp.setValueAtTime(startTime, [params.animScaleFrom, params.animScaleFrom]);
scaleProp.setValueAtTime(endTime, [100, 100]);
```

Example for Fade In:

```js
opacityProp.setValueAtTime(startTime, params.animOpacityFrom);
opacityProp.setValueAtTime(endTime, 100);
```

Example for Slide Up:

```js
positionProp.setValueAtTime(startTime, [finalX, finalY + params.animOffset]);
positionProp.setValueAtTime(endTime, [finalX, finalY]);
```

Use easing after setting keyframes.

---

# Live Controller Upgrade

## Why Add a Controller

The current tool likely creates the slides once. After generation, the user cannot easily change rows, columns, gap, slide size, or randomization without regenerating.

Add optional live controller:

```js
useController: true
```

UI:

```text
Create Live Controller
```

## Controller Layer

Create a null named:

```text
SLIDES_CONTROL
```

Add expression controls:

```text
Rows
Columns
Slide Width
Slide Height
Gap X
Gap Y
Jitter
Rotation Random
Scale Random
Seed
```

## Expressions

Each slide position should optionally be expression-driven from the controller.

Position expression concept:

```js
ctrl = thisComp.layer('SLIDES_CONTROL');
cols = Math.max(1, Math.round(ctrl.effect('Columns')('Slider')));
w = ctrl.effect('Slide Width')('Slider');
h = ctrl.effect('Slide Height')('Slider');
gapX = ctrl.effect('Gap X')('Slider');
gapY = ctrl.effect('Gap Y')('Slider');
seed = ctrl.effect('Seed')('Slider');
jitter = ctrl.effect('Jitter')('Slider');

idx = parseInt(name.split('_').pop(), 10) - 1;
row = Math.floor(idx / cols);
col = idx % cols;

x = col * (w + gapX);
y = row * (h + gapY);

seedRandom(idx + seed, true);
x += random(-jitter, jitter);
y += random(-jitter, jitter);

[x, y]
```

The script should offset all slides around comp center or inside a parent group null.

Recommended structure:

```text
SLIDES_CONTROL
SLIDES_GROUP
  SLIDE_001
  SLIDE_002
  SLIDE_003
```

If using expressions, parent slide layers to `SLIDES_GROUP`, and let the individual slide positions be relative to the group.

---

# Selected Layer Support

## Goal

Allow users to select existing layers and arrange them as slides.

New behavior:

```text
If sourceMode = selectedLayers:
- use selected layers as slide content
- optionally precomp each selected layer
- arrange them into grid positions
- optionally create masks/background frames behind them
```

Important options:

```js
fitMode: 'contain', // contain, cover, stretch, none
createMasks: false,
precompSelected: false
```

Fit logic:

```js
scaleX = cellW / sourceW * 100;
scaleY = cellH / sourceH * 100;

contain = Math.min(scaleX, scaleY);
cover = Math.max(scaleX, scaleY);
stretch = [scaleX, scaleY];
```

---

# Placeholder / Precomp Workflow

## Why This Matters

For motion templates and agency work, each slide should optionally become a placeholder comp.

Add:

```js
usePlaceholderComps: false,
placeholderPrefix: 'SLIDE_PLACEHOLDER',
placeholderDuration: 5,
placeholderBg: true
```

Behavior:

```text
Create SLIDE_PLACEHOLDER_001 comp
Create SLIDE_PLACEHOLDER_002 comp
Create SLIDE_PLACEHOLDER_003 comp
Place each placeholder comp into the main comp grid
```

This makes it easy to replace slide contents later.

---

# Update Existing Layout

Add a second button:

```text
Update Selected Slides Layout
```

Bridge call:

```js
Bridge.call('slides.update', getParams())
```

Behavior:

```text
Find existing SLIDES_CONTROL and SLIDE_### layers
Update controller values
Refresh expressions if needed
Do not recreate everything unless requested
```

---

# Bake / Release

Add advanced options:

```text
Bake Expressions to Keyframes
Release From Controller
```

Bridge calls:

```js
Bridge.call('slides.bake', getParams())
Bridge.call('slides.release', getParams())
```

Bake means:

```text
Convert expression-driven positions/scales/rotations to static values or keyframes.
```

Release means:

```text
Remove expressions and keep current visual layout.
```

---

# Proposed New State Object

Replace or extend the current `_state` with:

```js
var _state = {
  // Source
  sourceMode: 'empty',
  useSelectedLayers: false,
  createPrecomps: false,
  replaceOriginals: false,

  // Grid
  rows: 3,
  cols: 3,
  slideW: 200,
  slideH: 150,
  gapH: 10,
  gapV: 10,
  fitToComp: false,
  layoutAnchor: 'center',
  orderMode: 'leftToRight',

  // Randomization
  randomize: 0,
  rotationRandom: 0,
  scaleRandom: 0,
  randomSeed: 1,

  // Card style
  useFrames: true,
  bgColor: '#222222',
  cardOpacity: 100,
  strokeEnabled: false,
  strokeWidth: 2,
  strokeColor: '#ffffff',
  roundness: 0,

  // Content fitting
  fitMode: 'contain',
  createMasks: false,

  // Animation
  animType: 'none',
  animDuration: 18,
  animStagger: 5,
  animEase: 'smooth',
  animDirection: 'byIndex',
  animOffset: 100,
  animScaleFrom: 80,
  animRotateFrom: 0,
  animOpacityFrom: 0,
  useOvershoot: false,
  overshootAmount: 8,

  // Text
  useText: false,
  textMode: 'number',
  textPrefix: 'Slide',
  textSize: 32,
  textColor: '#ffffff',
  textPosition: 'center',

  // Live controller
  useController: true,
  controllerName: 'SLIDES_CONTROL',
  groupName: 'SLIDES_GROUP'
};
```

---

# Backend Bridge Commands

Current:

```js
slides.generate
```

Add:

```js
slides.generate
slides.update
slides.bake
slides.release
slides.replaceContent
```

## `slides.generate`

Creates a new slide layout.

## `slides.update`

Updates an existing generated slide layout.

## `slides.bake`

Bakes expression-driven values.

## `slides.release`

Removes controller/expression dependency while preserving current visual layout.

## `slides.replaceContent`

Replaces placeholder comps or slide contents later.

---

# MVP Implementation Order

Build in this order:

```text
1. Keep current SlidesUI working.
2. Add animation duration, direction, and more entrance types.
3. Add card style controls: background, stroke, roundness.
4. Add selected-layer source mode.
5. Add live controller option.
6. Add update existing layout.
7. Add placeholder precomp mode.
8. Add bake/release.
```

Do not jump directly to full Flex behavior inside this tool.

---

# Relationship to Future Grid/Flex Tool

This Slides tool should stay focused on fast slide/card generation.

Future Grid/Flex tool should handle:

```text
Responsive grids
Weighted rows/columns
Bento layouts
Neighbor push behavior
Cell spanning
Advanced rigged comps
```

Slides Tool v2 can borrow small features from the future system, but it should remain simpler.

Clear distinction:

```text
Slides Tool = fast card/slide generator.
Grid/Flex Tool = advanced responsive layout rig builder.
```

---

# Claude Builder Prompt

Use this prompt in Claude:

```text
I have an existing After Effects panel module called SlidesUI. It currently generates a grid of slides using rows, columns, slide width, slide height, gaps, random position/rotation/scale, simple entrance animation, stagger, and optional text.

I do not want to replace this tool with a full Grid/Flex tool. I want to upgrade the existing Slides tool into Slides Tool v2.

Please modify and extend the existing SlidesUI code and the backend bridge command `slides.generate`.

The upgraded tool should remain a fast slide/card generator, but add these features:

1. Source modes: Empty Slides, Selected Layers, Selected Comps, Placeholder Precomps.
2. Better layout controls: fit to comp, anchor, order mode.
3. Card styling: background, opacity, stroke, stroke width, stroke color, roundness.
4. Better text options: number, prefix, layer name, text size, color, and position.
5. Better animation: duration, stagger, direction, offset, scale-from, opacity-from, rotation-from, overshoot, and entrance types like fade, scale, slide directions, pop, flip, rotate, blur, and random.
6. Optional live controller: create a null named SLIDES_CONTROL with sliders for rows, columns, slide width, slide height, gap X/Y, jitter, rotation random, scale random, and seed.
7. Optional expression-driven layout so the generated slides can be edited after creation.
8. Add a `slides.update` bridge command that updates an existing generated slide layout instead of regenerating everything.
9. Add placeholder/precomp support so each slide can become a replaceable comp.
10. Add bake/release commands later to remove expressions while preserving the visual layout.

Please keep the existing code style: `_state`, `_sliders`, `init(container)`, `applyPreset(p)`, `getParams()`, and Bridge calls.

Prioritize a clean MVP first:
- keep current generate behavior working
- add advanced animation controls
- add card styling
- add selected-layer source mode
- add optional live controller

Do not overcomplicate it with full Flex responsive behavior yet. That belongs to a separate advanced tool.
```

---

# Final Recommendation

Keep the Slides tool.

Upgrade it into Slides Tool v2.

Do not make it carry the entire Grid/Flex concept. Let it become the fast, simple, reliable slide/card generator. Later, the future Grid/Flex tool can share backend layout utilities with it.

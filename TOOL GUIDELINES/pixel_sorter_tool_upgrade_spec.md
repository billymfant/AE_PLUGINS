# Pixel Sorter Tool Upgrade Spec for VS Code / Claude

## Context

You are upgrading an existing After Effects panel module named `SorterUI`. The current UI is good as a basic front-end. It stores state, exposes controls, and calls:

```js
Bridge.call('sorter.apply', getParams())
```

The current state includes:

```js
sortMode: 'brightness',
direction: 'horizontal',
sortLength: 200,
threshold: 60,
randomness: 0,
useColorKey: false,
keyColor: '#ff0000',
keyHueTol: 30,
iterations: 1
```

The goal is to turn this into a more powerful pixel sorting / glitch distortion tool inspired by professional pixel sorter plugins, but with an original implementation, UI, naming, preset system, and workflow.

Do not copy any proprietary plugin. Build an original After Effects tool that creates editable pixel-sorting looks using native AE effects, precomps, mattes, expressions, and optional future plugin architecture.

---

# 1. What the existing tool already does

The current `SorterUI` already has a clear structure:

- Sort mode selector
- Direction selector
- Sort length
- Threshold
- Randomness
- Iterations
- Optional color key masking
- Apply button
- Status messages

Current modes:

```text
Brightness
Hue
Saturation
Red
```

Current directions:

```text
Horizontal
Vertical
Diagonal
Radial
```

This should remain, but the system needs to become deeper and more controllable.

---

# 2. Main problem with the current version

The current UI suggests a pixel sorter, but the likely backend implementation is probably creating an approximation using blur/matte layers. That is okay for MVP, but it needs:

1. Better animation controls
2. Better masking controls
3. Better target modes
4. Adjustment-layer support
5. Layer/precomp-safe workflow
6. More pixel-sort-style parameters
7. A live controller system
8. Better presets
9. A clearer separation between quick mode and advanced mode

---

# 3. Desired product direction

Build this as:

```text
Pixel Sort FX Builder
```

or:

```text
Sort Glitch Designer
```

Core promise:

```text
Create animated pixel-sorting, scanline smears, data-stretch artifacts, color-keyed glitch distortion, and threshold-driven digital breakdowns inside After Effects.
```

The tool should support both:

```text
1. Quick apply mode
2. Advanced rig mode
```

Quick apply mode = applies effect stack quickly.
Advanced rig mode = creates a controller + precomp/mattes so the sort can be animated and edited after creation.

---

# 4. Important architectural note

A true pixel sorter usually requires reading pixel rows/columns, detecting intervals based on thresholds, sorting pixel values inside those intervals, and writing the result back. A normal JSX script cannot directly process pixels per frame like a compiled AE effect plugin can.

Therefore, there are two possible implementations:

## Path A — Native AE Rig Approximation

Use native After Effects effects:

- Threshold / Levels / Extract
- Set Matte / Track Matte
- Directional Blur
- Transform
- Turbulent Displace
- Displacement Map
- Mosaic / Posterize / Block Dissolve
- Fractal Noise matte
- Channel operations
- Tint / Curves / Hue/Saturation
- Echo / Time Displacement for animated looks

Pros:

- Buildable now with JSX/UXP
- Non-destructive
- Editable
- Works with adjustment layers
- Good for motion design

Cons:

- Not a true mathematical pixel sorting algorithm
- More like pixel-sort-inspired smear/glitch

## Path B — Real Pixel Sort Plugin

Use After Effects SDK / C++ / GPU or CPU image buffer processing.

Pros:

- True row/column/radial sorting
- Faster and cleaner
- Can sort pixels per frame correctly
- More like a real commercial pixel sorter

Cons:

- Much harder
- Requires compiled plugin builds
- Requires AE SDK knowledge

Recommended: build Path A first as a high-quality native AE rig builder. Later, if the UI and workflow work well, convert the core sorting algorithm into a compiled effect.

---

# 5. Upgrade the current UI state

Replace the existing state with this expanded state:

```js
var _state = {
  // source / target
  targetMode: 'selectedLayers', // selectedLayers, adjustmentLayer, duplicateLayer, precompRig
  applyMode: 'quick',           // quick, rig, baked

  // sorting
  sortMode: 'brightness',       // brightness, hue, saturation, red, green, blue, alpha, lumaInvert
  direction: 'horizontal',      // horizontal, vertical, diagonal, radial, angle
  angle: 0,
  sortLength: 200,
  thresholdLow: 60,
  thresholdHigh: 100,
  thresholdSoftness: 10,
  sortOrder: 'ascending',       // ascending, descending, alternate, random
  intervalMode: 'threshold',    // threshold, edges, colorKey, alpha, noise, maskLayer

  // look shaping
  randomness: 0,
  seed: 1,
  iterations: 1,
  smearOpacity: 100,
  sourceMix: 100,
  sharpen: 0,
  contrast: 0,
  colorPreserve: 100,

  // masks / keys
  useColorKey: false,
  keyColor: '#ff0000',
  keyHueTol: 30,
  useMaskLayer: false,
  maskLayerName: '',
  maskBlur: 0,
  maskExpand: 0,

  // animation
  animate: false,
  animStyle: 'drift',           // drift, pulse, scan, randomFlicker, thresholdSweep, lengthWave
  animSpeed: 1,
  animAmount: 50,
  loopDuration: 2,
  phaseOffset: 0,
  autoKeyframes: false,
  expressionDriven: true,

  // glitch extras
  chromaticSplit: 0,
  scanlineAmount: 0,
  blockSize: 1,
  posterize: 0,
  noiseAmount: 0,

  // workflow
  createController: true,
  createGlowSafePrecomp: false,
  preserveOriginal: true,
  addLabels: true
};
```

---

# 6. UI layout recommendation

Use two UI modes:

```text
Simple
Advanced
```

## Simple UI

Show only:

```text
Sort Mode
Direction
Amount
Threshold
Length
Randomness
Animate Toggle
Apply Pixel Sort
```

## Advanced UI

Sections:

```text
Target
Sort Source
Threshold / Intervals
Direction
Look
Masking
Animation
Glitch Extras
Workflow
Presets
```

---

# 7. Target modes

This is crucial.

The tool must be able to apply pixel sorting in different ways.

## Mode 1 — Selected Layers

Apply the effect stack directly to selected layers.

Use when the user wants fast results.

## Mode 2 — Duplicate Layer

Duplicate the selected layer, apply sorting to the duplicate, and blend it over the original.

Use for non-destructive editing.

## Mode 3 — Adjustment Layer

Create an adjustment layer above selected layers or apply to an existing selected adjustment layer.

This is very important because the user wants to affect multiple layers/comps at once.

Backend behavior:

```js
if (params.targetMode === 'adjustmentLayer') {
  // If selected layer is already adjustment layer, use it.
  // Otherwise create a new adjustment layer above selected layer stack.
  // Apply pixel-sort-inspired effect stack to that adjustment layer.
}
```

## Mode 4 — Precomp Rig

Precomp selected layers, create a controlled pixel sort rig inside or above the precomp.

Use when the user wants a clean reusable setup.

---

# 8. Adjustment layer support

The tool should create or support adjustment layers.

Recommended UI:

```text
Target Mode:
[ Selected Layers ] [ Duplicate ] [ Adjustment Layer ] [ Precomp Rig ]
```

Adjustment layer behavior:

```text
If user selects an adjustment layer:
- Apply sorter effects to it.

If user selects normal layers and chooses Adjustment Layer:
- Create new adjustment layer above the top selected layer.
- Match comp size.
- Set adjustmentLayer = true.
- Name it PIXEL_SORT_ADJ.
- Apply controller/effects to the adjustment layer.
```

Important:

Pixel-sort-inspired effects on adjustment layers should work best with native effects like:

```text
Directional Blur
Displacement Map
Turbulent Displace
Levels/Curves
Threshold matte precomp
Transform offset
Channel blur / RGB split
```

True per-pixel sort cannot be created with JSX alone, but an adjustment-layer rig can convincingly create the visual style.

---

# 9. Animation system

The current tool has no animation controls. Add an Animation section.

Controls:

```text
Animate Sort: checkbox
Animation Style: dropdown
Speed
Amount
Loop Duration
Phase Offset
Auto Keyframes: checkbox
Expression Driven: checkbox
```

Animation styles:

```text
Drift
Pulse
Threshold Sweep
Length Wave
Scanline Move
Random Flicker
Noise Crawl
Direction Rotate
```

## Expression-driven animation

Instead of only applying static values, add expressions to effect properties.

Example for sort length / blur length:

```js
base = effect('Sort Length')('Slider');
amount = effect('Anim Amount')('Slider');
speed = effect('Anim Speed')('Slider');
base + Math.sin(time * speed * Math.PI * 2) * amount;
```

Example for threshold sweep:

```js
base = effect('Threshold')('Slider');
amount = effect('Anim Amount')('Slider');
speed = effect('Anim Speed')('Slider');
base + Math.sin(time * speed * Math.PI * 2) * amount;
```

Example for randomness flicker:

```js
seedRandom(index + Math.floor(time * 12), true);
base = effect('Randomness')('Slider');
base + random(-20, 20);
```

## Auto-keyframe animation

If `autoKeyframes` is true:

- Add keyframes over 1–2 seconds
- Animate threshold, length, displacement amount, or opacity
- Use easy ease

Recommended keyframe presets:

```text
Glitch Hit: 0 → high → 0
Data Fall: length increases downward
Signal Break: threshold jumps randomly
Pulse Sort: sort amount pulses twice
Sweep Reveal: threshold sweeps across image
```

---

# 10. Controller layer system

For rig mode, create a null controller:

```text
PIXEL_SORT_CONTROL
```

Add expression controls:

```text
Slider: Sort Length
Slider: Threshold Low
Slider: Threshold High
Slider: Threshold Softness
Slider: Randomness
Slider: Iterations
Slider: Angle
Slider: Anim Speed
Slider: Anim Amount
Slider: Loop Duration
Slider: Smear Opacity
Slider: Chromatic Split
Checkbox: Animate
Dropdown: Sort Mode
Dropdown: Direction
Dropdown: Animation Style
Color: Key Color
```

All generated effect stack properties should reference this controller.

This gives the user the power to animate the controller once and drive the whole pixel sorter rig.

---

# 11. Native AE effect stack approximation

For a strong MVP, create this stack on a duplicate layer or adjustment layer:

```text
1. Extract/Levels/Curves for threshold mask
2. Fractal Noise or Turbulent Noise for randomness
3. Directional Blur for the sorting smear
4. Displacement Map for jagged movement
5. Posterize/Mosaic for digital breakup
6. Tint/Curves for color processing
7. RGB channel split duplicates for chromatic artifacts
8. Opacity/source mix controls
```

## Horizontal mode

Use Directional Blur angle 90 or 0 depending on AE's angle convention.

## Vertical mode

Use Directional Blur perpendicular to horizontal.

## Diagonal mode

Use Directional Blur angle 45.

## Angle mode

Expose custom angle slider.

## Radial mode

Radial true sorting is hard with native effects. Approximate with:

- CC Radial Blur
- Polar Coordinates precomp trick
- Directional blur in polar space
- Convert back

Backend optional method:

```text
Precomp selected layer
Apply Polar Coordinates Rect to Polar
Apply horizontal sort smear
Apply Polar Coordinates Polar to Rect
```

---

# 12. Sort modes

The UI currently supports brightness, hue, saturation, and red.

Add:

```text
Brightness
Luma
Luma Invert
Hue
Saturation
Red
Green
Blue
Alpha
Edges
Noise Map
Color Key
```

Backend mapping:

```text
brightness/luma -> use Levels/Threshold based on luminance
hue -> use Hue/Saturation / Color Range approximation
saturation -> isolate saturated areas
red/green/blue -> Shift Channels or Channel Combiner
alpha -> use alpha as matte
edges -> Find Edges + Threshold
noiseMap -> Fractal Noise as matte
colorKey -> use key color matte approximation
```

---

# 13. Interval / mask modes

Pixel sorting depends on intervals: sections of pixels that get sorted.

Add interval controls:

```text
Interval Mode:
- Threshold
- Between Low/High
- Edge Detect
- Color Key
- Alpha
- Noise Map
- External Matte Layer
```

Add controls:

```text
Threshold Low
Threshold High
Softness
Mask Blur
Mask Expand
Invert Mask
```

This will make the tool feel far more like a real pixel sorter.

---

# 14. Presets

Add presets that update UI values and optionally animation.

Recommended presets:

```text
Classic Bright Sort
Dark Area Melt
Vertical Data Fall
Horizontal Scan Smear
Radial Face Melt
Red Channel Break
Cyberpunk Hue Sort
Text Glitch Reveal
VHS Signal Tear
Datamosh Lines
Soft Editorial Sort
Noise Driven Sort
Color Key Blood Red
Alpha Edge Sort
```

Preset example:

```js
{
  name: 'Vertical Data Fall',
  sortMode: 'brightness',
  direction: 'vertical',
  sortLength: 450,
  thresholdLow: 55,
  thresholdHigh: 100,
  thresholdSoftness: 8,
  randomness: 20,
  iterations: 2,
  animate: true,
  animStyle: 'lengthWave',
  animSpeed: 0.8,
  animAmount: 120,
  chromaticSplit: 2,
  targetMode: 'adjustmentLayer'
}
```

---

# 15. Backend functions to implement

Create or update these backend handlers:

```js
Bridge.register('sorter.apply', function(params) {
  return SorterEngine.apply(params);
});
```

Core engine:

```js
var SorterEngine = {
  apply: function(params) {},
  getTargets: function(params) {},
  createAdjustmentLayer: function(comp, selectedLayers, params) {},
  duplicateTargets: function(layers, params) {},
  createController: function(comp, params) {},
  applyEffectStack: function(layer, controller, params) {},
  applyMaskSystem: function(layer, controller, params) {},
  applyAnimationExpressions: function(layer, controller, params) {},
  bakeKeyframes: function(layer, params) {},
  createRadialPrecompRig: function(layer, params) {},
  addChromaticSplit: function(layer, controller, params) {},
  cleanExistingRig: function(layer) {}
};
```

---

# 16. Suggested UI code changes

Add these variables:

```js
var _targetDD, _applyModeDD, _animToggle, _animStyleDD;
```

Add Target section before Sort Mode:

```js
container.appendChild(Utils.el('div', { class: 'section-label' }, 'Target'));
_targetDD = new Dropdown({
  label: 'Apply To',
  options: [
    { value: 'selectedLayers', label: 'Selected Layers' },
    { value: 'duplicateLayer', label: 'Duplicate Layer' },
    { value: 'adjustmentLayer', label: 'Adjustment Layer' },
    { value: 'precompRig', label: 'Precomp Rig' }
  ],
  value: 'selectedLayers',
  onChange: function(v) { _state.targetMode = v; }
});
container.appendChild(_targetDD.el);
```

Add Animation section:

```js
container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
_animToggle = new Toggle({
  label: 'Animate Pixel Sort',
  value: false,
  onChange: function(v) { _state.animate = v; }
});
_animStyleDD = new Dropdown({
  label: 'Animation Style',
  options: [
    { value: 'drift', label: 'Drift' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'thresholdSweep', label: 'Threshold Sweep' },
    { value: 'lengthWave', label: 'Length Wave' },
    { value: 'randomFlicker', label: 'Random Flicker' },
    { value: 'scanlineMove', label: 'Scanline Move' }
  ],
  value: 'drift',
  onChange: function(v) { _state.animStyle = v; }
});
container.appendChild(_animToggle.el);
container.appendChild(_animStyleDD.el);
```

Add sliders:

```js
_sliders.animSpeed = new Slider({ label: 'Speed', min: 0, max: 10, value: 1, step: 0.1, decimals: 1, defaultValue: 1,
  onChange: function(v) { _state.animSpeed = v; } });
_sliders.animAmount = new Slider({ label: 'Anim Amount', min: 0, max: 500, value: 50, step: 1, defaultValue: 50,
  onChange: function(v) { _state.animAmount = v; } });
_sliders.loopDuration = new Slider({ label: 'Loop Sec', min: 0.25, max: 20, value: 2, step: 0.25, decimals: 2, defaultValue: 2,
  onChange: function(v) { _state.loopDuration = v; } });
```

---

# 17. Adjustment layer backend pseudocode

```js
function createPixelSortAdjustmentLayer(comp, selectedLayers, params) {
  var adj = comp.layers.addSolid([1,1,1], 'PIXEL_SORT_ADJ', comp.width, comp.height, comp.pixelAspect, comp.duration);
  adj.adjustmentLayer = true;
  adj.startTime = comp.time;

  if (selectedLayers && selectedLayers.length > 0) {
    adj.moveBefore(selectedLayers[0]);
  }

  return adj;
}
```

Then apply the sorter effect stack to `adj`.

---

# 18. Animation expression examples

## Length wave

Apply to Directional Blur > Blur Length:

```js
ctrl = thisComp.layer('PIXEL_SORT_CONTROL');
base = ctrl.effect('Sort Length')('Slider');
amount = ctrl.effect('Anim Amount')('Slider');
speed = ctrl.effect('Anim Speed')('Slider');
animated = ctrl.effect('Animate')('Checkbox');
animated ? base + Math.sin(time * speed * Math.PI * 2) * amount : base;
```

## Threshold pulse

Apply to Levels / Threshold equivalent:

```js
ctrl = thisComp.layer('PIXEL_SORT_CONTROL');
base = ctrl.effect('Threshold Low')('Slider');
amount = ctrl.effect('Anim Amount')('Slider');
speed = ctrl.effect('Anim Speed')('Slider');
base + Math.sin(time * speed * Math.PI * 2) * amount;
```

## Random flicker

```js
ctrl = thisComp.layer('PIXEL_SORT_CONTROL');
base = ctrl.effect('Sort Length')('Slider');
amount = ctrl.effect('Anim Amount')('Slider');
speed = ctrl.effect('Anim Speed')('Slider');
seedRandom(Math.floor(time * speed * 12), true);
base + random(-amount, amount);
```

---

# 19. Minimum viable v2

Build this first:

```text
1. Keep the current UI.
2. Add Target Mode with Adjustment Layer option.
3. Add Animate toggle, Style, Speed, Amount.
4. Add Threshold Low/High instead of one threshold.
5. Add Angle for custom direction.
6. Add Green/Blue/Alpha/Edges sort modes.
7. Create controller null when applyMode is rig.
8. Apply expression-driven animation to blur length, displacement, threshold, or opacity.
9. Make adjustment layer creation reliable.
10. Add 8 strong presets.
```

---

# 20. Claude implementation prompt

Copy this into Claude:

```text
I have an existing After Effects panel module called SorterUI. It is a JavaScript UI file that stores pixel sorter parameters and calls Bridge.call('sorter.apply', getParams()). I want to upgrade it into a stronger Pixel Sort FX Builder.

Use my existing UI style and components: Utils.el, Slider, ButtonGroup, Dropdown, Toggle, ColorPicker, Bridge.call.

Keep the current features:
- sortMode
- direction
- sortLength
- threshold
- randomness
- iterations
- useColorKey
- keyColor
- keyHueTol

Add these new features:
1. Target Mode dropdown: Selected Layers, Duplicate Layer, Adjustment Layer, Precomp Rig.
2. Apply Mode dropdown: Quick, Rig, Baked.
3. Advanced sort modes: brightness, lumaInvert, hue, saturation, red, green, blue, alpha, edges, noiseMap.
4. Direction modes: horizontal, vertical, diagonal, radial, angle. Add Angle slider.
5. Threshold Low, Threshold High, Threshold Softness instead of a single basic threshold.
6. Animation controls: Animate toggle, Animation Style dropdown, Speed, Amount, Loop Duration, Phase Offset, Auto Keyframes toggle.
7. Glitch extras: Chromatic Split, Scanline Amount, Block Size, Posterize, Noise Amount.
8. Workflow options: Create Controller, Preserve Original, Add Labels.

Also create or update the backend sorter.apply handler architecture with functions:
- getTargets
- createAdjustmentLayer
- createController
- applyEffectStack
- applyMaskSystem
- applyAnimationExpressions
- bakeKeyframes
- createRadialPrecompRig
- addChromaticSplit

Important: This should be implemented first as a native After Effects rig/effect-stack builder using effects such as Directional Blur, Displacement Map, Turbulent Displace, Levels/Curves/Threshold, Mosaic, Posterize, Transform, Tint, and channel operations. Do not attempt true pixel buffer sorting in JSX. The design should leave room for a future compiled C++ AE SDK effect.

The most important practical requirement is that the tool can apply the pixel-sort-inspired effect to adjustment layers. If the selected layer is an adjustment layer, apply the rig to it. If normal layers are selected and Target Mode is Adjustment Layer, create a new comp-sized adjustment layer above them and apply the rig there.

The second most important requirement is animation. The user should be able to animate sort length, threshold, displacement, randomness, scan movement, and chromatic split either through controller expressions or auto-generated keyframes.

Generate updated code for the SorterUI module and a backend SorterEngine module that fits this architecture. Keep code modular and commented.
```

---

# 21. Key design reminder

Do not build a one-click static preset only.

Build a tool that creates:

```text
A controllable, animated, adjustment-layer-compatible pixel sort rig.
```

That is the real upgrade.

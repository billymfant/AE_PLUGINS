# Animated Distortions Tool — VS Code / Claude Builder Spec

## Context

You are extending an existing After Effects distortion panel. The current uploaded file contains the **front-end UI module only**:

- It defines `window.DistortionsUI`.
- It stores parameters in `_state`.
- It has distortion types: `lens`, `warp`, `swirl`, `wave`, `bulge`, `pinch`.
- It has sliders for intensity, radius, feather, opacity, center X/Y, focal length, mesh resolution, swirl angle, amplitude, frequency, and wave speed.
- It calls the back-end through:

```js
Bridge.call('distortions.apply', getParams())
```

The missing/required upgrade is: **distortions need to be animatable and applicable to adjustment layers.**

The goal is to modify the UI and the `distortions.apply` back-end handler so the user can choose whether distortion is static or animated, and whether it is applied directly to selected layers, to duplicates, or to a new/selected adjustment layer.

---

# 1. Current Tool Analysis

## What already works

The existing UI is clean and modular:

```js
window.DistortionsUI = (function() {
  var _state = {
    distType: 'lens',
    intensity: 50,
    centerX: 0.5,
    centerY: 0.5,
    radius: 200,
    feather: 0,
    focalLength: 50,
    meshResX: 5,
    meshResY: 5,
    swirlAngle: 90,
    amplitude: 20,
    frequency: 5,
    waveSpeed: 1,
    blendOpacity: 100
  };
})();
```

The UI already separates distortion types into sections:

```text
Lens
Warp
Swirl
Wave
Bulge
Pinch
```

The current architecture is good because `_state` can be expanded without rewriting the full panel.

## Current limitation

The front-end has only static distortion settings. Even though `waveSpeed` exists, there is no global animation system for:

```text
Intensity over time
Center movement
Swirl rotation
Radius pulsing
Wave phase animation
Bulge/pinch movement
Lens distortion breathing
Random jitter / organic drift
Looping animation
Keyframed animation
Expression-driven animation
```

Also, there is no clear UI state for:

```text
Apply to selected layers
Create adjustment layer
Use selected adjustment layer
Duplicate layer and distort duplicate
Precomp before applying
```

That is the main missing feature.

---

# 2. Product Goal

Build an upgraded tool named internally:

```text
Animated Distortions Builder
```

It should let the user create static or animated distortion effects using native After Effects effects and expressions.

The tool should support three major workflows:

```text
1. Direct layer distortion
2. Distorted duplicate layer with optional feathered mask
3. Adjustment layer distortion affecting everything below
```

The most important new feature:

```text
Every distortion can be animated automatically with expressions or generated keyframes.
```

---

# 3. Required UX Upgrade

Add a new section in the UI called:

```text
Animation
```

Controls:

```text
Animation Mode:
- Static
- Loop
- Ping Pong
- Drift
- Pulse
- Manual Keyframes

Animate:
- Intensity
- Center
- Radius
- Angle
- Wave Phase

Duration / Loop Length
Speed
Amount
Phase Offset
Random Seed
Ease Amount
Use Expressions
Bake Keyframes
```

Add another section called:

```text
Apply Target
```

Controls:

```text
Target Mode:
- Selected Layers
- Duplicate Selected Layers
- New Adjustment Layer
- Selected Adjustment Layer
- Precomp + Adjustment Layer

Adjustment Layer Name
Affect Full Comp
Use Masked Region
Blend Opacity
```

---

# 4. Updated State Object

Modify `_state` in `DistortionsUI` to include animation and target settings.

Add this:

```js
var _state = {
  distType:  'lens',
  intensity:  50,
  centerX:    0.5,
  centerY:    0.5,
  radius:     200,
  feather:    0,
  focalLength: 50,
  meshResX: 5,
  meshResY: 5,
  swirlAngle: 90,
  amplitude: 20,
  frequency: 5,
  waveSpeed: 1,
  blendOpacity: 100,

  // NEW: application target
  targetMode: 'selectedLayers', 
  // selectedLayers | duplicateLayers | newAdjustment | selectedAdjustment | precompAdjustment

  adjustmentName: 'DISTORTION_ADJUSTMENT',
  affectFullComp: true,

  // NEW: animation system
  animateEnabled: false,
  animationMode: 'loop',
  // static | loop | pingpong | drift | pulse | manualKeyframes

  animateIntensity: true,
  animateCenter: false,
  animateRadius: false,
  animateAngle: false,
  animateWavePhase: true,

  animDuration: 2.0,
  animSpeed: 1.0,
  animAmount: 25,
  animPhase: 0,
  randomSeed: 1,
  easeAmount: 50,

  animationOutput: 'expressions'
  // expressions | keyframes
};
```

---

# 5. UI Controls To Add

The current code uses custom `Slider` and `ButtonGroup` classes. Reuse those.

## Add Target Mode ButtonGroup

Place this before the Apply button:

```js
container.appendChild(Utils.el('div', { class: 'section-label' }, 'Apply Target'));

_targetGroup = new ButtonGroup({
  tooltip: 'Choose where the distortion will be applied',
  options: [
    { value: 'selectedLayers', label: 'Selected' },
    { value: 'duplicateLayers', label: 'Duplicate' },
    { value: 'newAdjustment', label: 'New Adj' },
    { value: 'selectedAdjustment', label: 'Sel Adj' },
    { value: 'precompAdjustment', label: 'Precomp Adj' }
  ],
  value: _state.targetMode,
  onChange: function(v) { _state.targetMode = v; }
});

container.appendChild(_targetGroup.el);
```

## Add Animation Enable ButtonGroup

```js
container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));

_animEnabledGroup = new ButtonGroup({
  tooltip: 'Enable automatic animation for the distortion',
  options: [
    { value: false, label: 'Static' },
    { value: true, label: 'Animated' }
  ],
  value: _state.animateEnabled,
  onChange: function(v) { _state.animateEnabled = v; }
});

container.appendChild(_animEnabledGroup.el);
```

## Add Animation Mode ButtonGroup

```js
_animModeGroup = new ButtonGroup({
  tooltip: 'Choose the type of motion used to animate the distortion',
  options: [
    { value: 'loop', label: 'Loop' },
    { value: 'pingpong', label: 'Ping Pong' },
    { value: 'drift', label: 'Drift' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'manualKeyframes', label: 'Keys' }
  ],
  value: _state.animationMode,
  onChange: function(v) { _state.animationMode = v; }
});

container.appendChild(_animModeGroup.el);
```

## Add Animation Sliders

```js
_sliders.animDuration = new Slider({
  label: 'Loop Duration',
  min: 0.25,
  max: 20,
  value: 2,
  step: 0.05,
  decimals: 2,
  defaultValue: 2,
  tooltip: 'Length of one animation cycle in seconds',
  onChange: function(v) { _state.animDuration = v; }
});

_sliders.animSpeed = new Slider({
  label: 'Speed',
  min: 0,
  max: 10,
  value: 1,
  step: 0.1,
  decimals: 1,
  defaultValue: 1,
  tooltip: 'Global animation speed multiplier',
  onChange: function(v) { _state.animSpeed = v; }
});

_sliders.animAmount = new Slider({
  label: 'Anim Amount',
  min: 0,
  max: 200,
  value: 25,
  step: 1,
  defaultValue: 25,
  tooltip: 'Amount of animated variation around the base distortion value',
  onChange: function(v) { _state.animAmount = v; }
});

_sliders.randomSeed = new Slider({
  label: 'Random Seed',
  min: 1,
  max: 9999,
  value: 1,
  step: 1,
  defaultValue: 1,
  tooltip: 'Seed for drift/random animation modes',
  onChange: function(v) { _state.randomSeed = v; }
});

container.appendChild(_sliders.animDuration.el);
container.appendChild(_sliders.animSpeed.el);
container.appendChild(_sliders.animAmount.el);
container.appendChild(_sliders.randomSeed.el);
```

## Add Animation Output Mode

```js
_animOutputGroup = new ButtonGroup({
  tooltip: 'Use live expressions or bake animation to keyframes',
  options: [
    { value: 'expressions', label: 'Expressions' },
    { value: 'keyframes', label: 'Keyframes' }
  ],
  value: _state.animationOutput,
  onChange: function(v) { _state.animationOutput = v; }
});

container.appendChild(_animOutputGroup.el);
```

---

# 6. Important After Effects Architecture

## Adjustment layer support

The back-end handler `distortions.apply` must detect the current comp.

Pseudo-code:

```js
var comp = app.project.activeItem;

if (!(comp instanceof CompItem)) {
  return { error: 'Open a composition first.' };
}
```

Then choose target layers:

```js
function getTargetLayers(comp, params) {
  if (params.targetMode === 'selectedLayers') {
    return comp.selectedLayers;
  }

  if (params.targetMode === 'duplicateLayers') {
    return duplicateSelectedLayers(comp);
  }

  if (params.targetMode === 'newAdjustment') {
    return [createAdjustmentLayer(comp, params.adjustmentName)];
  }

  if (params.targetMode === 'selectedAdjustment') {
    return getSelectedAdjustmentLayers(comp);
  }

  if (params.targetMode === 'precompAdjustment') {
    return [precompSelectionAndAddAdjustment(comp, params)];
  }
}
```

Create adjustment layer:

```js
function createAdjustmentLayer(comp, name) {
  var solid = comp.layers.addSolid([1, 1, 1], name || 'DISTORTION_ADJUSTMENT', comp.width, comp.height, comp.pixelAspect, comp.duration);
  solid.adjustmentLayer = true;
  solid.moveToBeginning();
  solid.inPoint = comp.time;
  solid.outPoint = comp.duration;
  return solid;
}
```

Selected adjustment validation:

```js
function getSelectedAdjustmentLayers(comp) {
  var result = [];

  for (var i = 0; i < comp.selectedLayers.length; i++) {
    var layer = comp.selectedLayers[i];
    if (layer.adjustmentLayer === true) {
      result.push(layer);
    }
  }

  if (!result.length) {
    throw new Error('Select at least one adjustment layer, or choose New Adjustment Layer.');
  }

  return result;
}
```

## Why adjustment layers matter

Applying distortion directly to a layer only affects that layer.

Applying distortion to an adjustment layer affects all visible layers below it. This is essential for:

```text
Global heatwave
Screen ripple
Glitch wave
Poster bend
Glass/liquid distortion
Transition distortion
Camera shake-style distortion
```

This should be treated as a primary workflow, not an afterthought.

---

# 7. Effect Mapping Strategy

Use native AE effects first.

Suggested mapping:

```text
Lens      → Optics Compensation or CC Lens
Bulge     → Bulge
Pinch     → Bulge with negative height/intensity if possible
Swirl     → Twirl
Wave      → Wave Warp or Turbulent Displace
Warp      → Mesh Warp / Bezier Warp / Turbulent Displace fallback
```

Suggested effect names:

```js
var EFFECTS = {
  lens:  ['ADBE Optics Compensation', 'CC Lens'],
  swirl: ['ADBE Twirl'],
  wave:  ['ADBE Wave Warp', 'ADBE Turbulent Displace'],
  bulge: ['ADBE Bulge'],
  pinch: ['ADBE Bulge'],
  warp:  ['ADBE Turbulent Displace']
};
```

Implement safe effect application:

```js
function addFirstAvailableEffect(layer, matchNames) {
  for (var i = 0; i < matchNames.length; i++) {
    try {
      var fx = layer.property('ADBE Effect Parade').addProperty(matchNames[i]);
      if (fx) return fx;
    } catch (e) {}
  }

  throw new Error('Could not apply distortion effect. Missing native effect.');
}
```

---

# 8. Animation System

There are two output modes:

```text
1. Expressions: live, editable, infinite, loopable
2. Keyframes: baked, stable, render-safe, easier to hand off
```

## Expression Mode

For each effect property, add an expression based on the selected animation mode.

Example base loop expression:

```js
function makeLoopExpression(baseValue, amount, duration, speed, phase) {
  return [
    'base = ' + baseValue + ';',
    'amount = ' + amount + ';',
    'duration = ' + duration + ';',
    'speed = ' + speed + ';',
    'phase = ' + phase + ';',
    't = ((time - inPoint) * speed / duration + phase) * Math.PI * 2;',
    'base + Math.sin(t) * amount;'
  ].join('\n');
}
```

Ping-pong:

```js
function makePingPongExpression(baseValue, amount, duration, speed) {
  return [
    'base = ' + baseValue + ';',
    'amount = ' + amount + ';',
    'duration = ' + duration + ';',
    'speed = ' + speed + ';',
    't = ((time - inPoint) * speed) % duration;',
    'p = t / duration;',
    'v = Math.sin(p * Math.PI);',
    'base + v * amount;'
  ].join('\n');
}
```

Organic drift:

```js
function makeDriftExpression(baseValue, amount, speed, seed) {
  return [
    'base = ' + baseValue + ';',
    'amount = ' + amount + ';',
    'speed = ' + speed + ';',
    'seedRandom(' + seed + ', true);',
    'n = noise(time * speed);',
    'base + n * amount;'
  ].join('\n');
}
```

Pulse:

```js
function makePulseExpression(baseValue, amount, duration, speed) {
  return [
    'base = ' + baseValue + ';',
    'amount = ' + amount + ';',
    'duration = ' + duration + ';',
    'speed = ' + speed + ';',
    't = ((time - inPoint) * speed / duration) * Math.PI * 2;',
    'pulse = Math.pow((Math.sin(t) + 1) / 2, 3);',
    'base + pulse * amount;'
  ].join('\n');
}
```

## Keyframe Mode

Bake 3–5 keyframes over the animation duration.

Loop example:

```js
function setLoopKeyframes(prop, base, amount, start, duration) {
  prop.setValueAtTime(start, base);
  prop.setValueAtTime(start + duration * 0.25, base + amount);
  prop.setValueAtTime(start + duration * 0.5, base);
  prop.setValueAtTime(start + duration * 0.75, base - amount);
  prop.setValueAtTime(start + duration, base);
}
```

Ping-pong:

```js
function setPingPongKeyframes(prop, base, amount, start, duration) {
  prop.setValueAtTime(start, base);
  prop.setValueAtTime(start + duration * 0.5, base + amount);
  prop.setValueAtTime(start + duration, base);
}
```

Use `KeyframeEase` if supported:

```js
var ease = new KeyframeEase(0, 66);
prop.setTemporalEaseAtKey(1, [ease], [ease]);
```

---

# 9. Distortion-Specific Animation Recommendations

## Lens

Animate:

```text
Field of View / Focal Length / Optics Amount
Center
```

Good presets:

```text
Lens Breathing
Camera Pull
Warp In
Zoom Warp
```

Expression idea:

```js
base + Math.sin(time * 2 * Math.PI / duration) * amount
```

## Swirl

Animate:

```text
Angle
Center
Radius
```

Good presets:

```text
Slow Portal
Liquid Twist
Spiral Transition
```

## Wave

Animate:

```text
Phase
Height
Width/Frequency
Direction
```

Important: **Wave Warp already has a Phase property in many AE setups. Animate Phase directly when available.**

Fallback expression for phase-like movement:

```js
time * speed * 180
```

## Bulge / Pinch

Animate:

```text
Bulge Height
Radius
Center
```

Good presets:

```text
Bubble Pulse
Impact Ripple
Breathing Glass
```

## Warp

Animate:

```text
Turbulent Displace Evolution
Amount
Size
Offset Turbulence
```

Recommended for animated distortion because it is very controllable.

---

# 10. Applying Effects To Adjustment Layers

When target mode is `newAdjustment`, do this:

```js
app.beginUndoGroup('Apply Animated Distortion Adjustment');

var adj = createAdjustmentLayer(comp, params.adjustmentName);
applyDistortionToLayer(adj, params);

app.endUndoGroup();
```

Critical details:

```text
- Adjustment layer should be comp-sized.
- It should start at the current time or comp start depending on preference.
- It should sit above the layers it needs to affect.
- It should be named clearly.
- It can have masks if feather/radius masking is enabled.
```

Recommended behavior:

```text
New Adjustment Layer:
- Creates a comp-size solid.
- Sets adjustmentLayer = true.
- Moves it above selected layers if selection exists.
- If no selection, moves it to the top.
- Applies the selected distortion effect.
- Applies animation expressions/keyframes if enabled.
```

Layer ordering helper:

```js
function placeAdjustmentAboveSelection(adj, comp) {
  if (comp.selectedLayers.length > 0) {
    var topIndex = comp.selectedLayers[0].index;
    for (var i = 1; i < comp.selectedLayers.length; i++) {
      if (comp.selectedLayers[i].index < topIndex) {
        topIndex = comp.selectedLayers[i].index;
      }
    }

    adj.moveBefore(comp.layer(topIndex));
  } else {
    adj.moveToBeginning();
  }
}
```

---

# 11. Masked Adjustment Layer Option

Your current UI has `feather`, described as:

```text
when > 0, distortion is applied to a duplicate layer with a feathered mask
```

Extend that same idea to adjustment layers.

If `targetMode` is `newAdjustment` and `feather > 0`, add an elliptical mask around `centerX/centerY` with radius.

Pseudo-code:

```js
function addCircularMask(layer, params, comp) {
  var cx = params.centerX * comp.width;
  var cy = params.centerY * comp.height;
  var r = params.radius;

  var mask = layer.Masks.addProperty('Mask');
  var shape = new Shape();

  var k = 0.5522847498;
  shape.vertices = [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy]
  ];

  shape.inTangents = [
    [-r * k, 0],
    [0, -r * k],
    [r * k, 0],
    [0, r * k]
  ];

  shape.outTangents = [
    [r * k, 0],
    [0, r * k],
    [-r * k, 0],
    [0, -r * k]
  ];

  shape.closed = true;

  mask.property('ADBE Mask Shape').setValue(shape);
  mask.property('ADBE Mask Feather').setValue([params.feather, params.feather]);
}
```

This gives localized distortion on an adjustment layer.

---

# 12. Controller Layer Option

For a better tool, create a controller null with sliders and connect effect properties to it.

This makes the effect easier to animate manually.

Create controller:

```js
function createController(comp, params) {
  var ctrl = comp.layers.addNull();
  ctrl.name = 'DISTORTION_CONTROLS';
  ctrl.threeDLayer = false;
  ctrl.guideLayer = true;

  addSlider(ctrl, 'Intensity', params.intensity);
  addSlider(ctrl, 'Radius', params.radius);
  addSlider(ctrl, 'Anim Amount', params.animAmount);
  addSlider(ctrl, 'Anim Speed', params.animSpeed);
  addSlider(ctrl, 'Loop Duration', params.animDuration);
  addPoint(ctrl, 'Center', [params.centerX * comp.width, params.centerY * comp.height]);

  return ctrl;
}
```

Add slider helper:

```js
function addSlider(layer, name, value) {
  var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Slider Control');
  fx.name = name;
  fx.property('ADBE Slider Control-0001').setValue(value);
  return fx;
}
```

Add point helper:

```js
function addPoint(layer, name, value) {
  var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Point Control');
  fx.name = name;
  fx.property('ADBE Point Control-0001').setValue(value);
  return fx;
}
```

Then expressions on effect properties can read:

```js
ctrl = thisComp.layer('DISTORTION_CONTROLS');
base = ctrl.effect('Intensity')('Slider');
amount = ctrl.effect('Anim Amount')('Slider');
speed = ctrl.effect('Anim Speed')('Slider');
dur = ctrl.effect('Loop Duration')('Slider');
t = ((time - inPoint) * speed / dur) * Math.PI * 2;
base + Math.sin(t) * amount;
```

This is the strongest architecture because the user can animate controller sliders manually too.

---

# 13. Backend Apply Function Skeleton

The back-end Bridge handler should look like this conceptually:

```js
Bridge.register('distortions.apply', function(params) {
  app.beginUndoGroup('Apply Distortion');

  try {
    var comp = app.project.activeItem;

    if (!(comp instanceof CompItem)) {
      throw new Error('Open a composition first.');
    }

    var layers = resolveTargetLayers(comp, params);

    if (!layers || layers.length === 0) {
      throw new Error('Select a layer, or choose New Adjustment Layer.');
    }

    for (var i = 0; i < layers.length; i++) {
      applyDistortionToLayer(layers[i], comp, params);
    }

    app.endUndoGroup();

    return {
      success: true,
      count: layers.length
    };
  } catch (e) {
    app.endUndoGroup();
    return {
      error: e.message
    };
  }
});
```

Effect application:

```js
function applyDistortionToLayer(layer, comp, params) {
  layer.opacity.setValue(params.blendOpacity);

  if (params.feather > 0 && layer.adjustmentLayer) {
    addCircularMask(layer, params, comp);
  }

  var fx = addDistortionEffect(layer, params);
  setStaticEffectValues(fx, layer, comp, params);

  if (params.animateEnabled) {
    if (params.animationOutput === 'expressions') {
      addAnimationExpressions(fx, layer, comp, params);
    } else {
      addAnimationKeyframes(fx, layer, comp, params);
    }
  }
}
```

---

# 14. Example Effect Property Mapping

Because effect property names differ across AE versions/languages, prefer match names when possible.

Use helper functions:

```js
function propByNameOrIndex(effect, names, fallbackIndex) {
  for (var i = 0; i < names.length; i++) {
    var p = effect.property(names[i]);
    if (p) return p;
  }
  return effect.property(fallbackIndex);
}
```

Example:

```js
function setSwirlValues(fx, comp, params) {
  var angle = propByNameOrIndex(fx, ['Angle', 'ADBE Twirl-0001'], 1);
  var center = propByNameOrIndex(fx, ['Center', 'ADBE Twirl-0002'], 2);
  var radius = propByNameOrIndex(fx, ['Radius', 'ADBE Twirl-0003'], 3);

  if (angle) angle.setValue(params.swirlAngle * params.intensity / 100);
  if (center) center.setValue([params.centerX * comp.width, params.centerY * comp.height]);
  if (radius) radius.setValue(params.radius);

  return { angle: angle, center: center, radius: radius };
}
```

Then animate:

```js
if (params.animateAngle && props.angle) {
  props.angle.expression = makeLoopExpression(
    props.angle.value,
    params.animAmount,
    params.animDuration,
    params.animSpeed,
    params.animPhase
  );
}
```

---

# 15. Suggested Animation Presets

Add presets later. MVP can have manual controls, but the full tool should include:

```text
Subtle Heatwave
Liquid Glass
Slow Portal
Ripple Pulse
Glitch Drift
Lens Breathing
Underwater
Poster Warp
Transition Twist
Energy Bulge
```

Preset examples:

```js
var ANIMATION_PRESETS = {
  subtleHeatwave: {
    distType: 'wave',
    targetMode: 'newAdjustment',
    animateEnabled: true,
    animationMode: 'loop',
    amplitude: 8,
    frequency: 3,
    waveSpeed: 0.6,
    animAmount: 15,
    animDuration: 3,
    blendOpacity: 70
  },

  slowPortal: {
    distType: 'swirl',
    targetMode: 'newAdjustment',
    animateEnabled: true,
    animationMode: 'loop',
    swirlAngle: 80,
    radius: 350,
    animAmount: 45,
    animDuration: 4,
    blendOpacity: 100
  },

  lensBreathing: {
    distType: 'lens',
    targetMode: 'newAdjustment',
    animateEnabled: true,
    animationMode: 'pulse',
    intensity: 20,
    animAmount: 10,
    animDuration: 2.5,
    blendOpacity: 100
  }
};
```

---

# 16. Concrete Fix For “I Cannot Animate Distortions”

The likely current issue is that your tool sets static effect values only.

Fix by adding one of these approaches:

## Simple Fix

Set expressions directly on effect properties after applying the effect.

Example for any numeric property:

```js
prop.expression =
  'base = ' + prop.value + ';\n' +
  'amount = ' + params.animAmount + ';\n' +
  'speed = ' + params.animSpeed + ';\n' +
  'dur = ' + params.animDuration + ';\n' +
  't = ((time - inPoint) * speed / dur) * Math.PI * 2;\n' +
  'base + Math.sin(t) * amount;';
```

## Better Fix

Create controller sliders and make the effect property expression read from those sliders.

## Best Fix

Give the user both choices:

```text
Live Expressions
Bake Keyframes
```

---

# 17. Concrete Fix For “I Need Adjustment Layers”

Add target mode to UI and back-end.

Minimum required backend logic:

```js
if (params.targetMode === 'newAdjustment') {
  var adj = comp.layers.addSolid(
    [1, 1, 1],
    params.adjustmentName || 'DISTORTION_ADJUSTMENT',
    comp.width,
    comp.height,
    comp.pixelAspect,
    comp.duration
  );

  adj.adjustmentLayer = true;
  adj.moveToBeginning();

  applyDistortionToLayer(adj, comp, params);
}
```

This is the essential missing feature.

---

# 18. Recommended File/Folder Structure

For VS Code:

```text
distortions-tool/
  src/
    ui/
      DistortionsUI.js
      sliders.js
      buttonGroup.js
    ae/
      distortions.apply.jsx
      distortionEffects.jsx
      animationExpressions.jsx
      adjustmentLayers.jsx
      masks.jsx
      presets.jsx
    bridge/
      Bridge.js
  docs/
    animated-distortions-tool-spec.md
  README.md
```

---

# 19. Claude Build Prompt

Copy this prompt into Claude:

```text
I have an existing After Effects distortion tool front-end called DistortionsUI. It stores a _state object, builds UI sliders/buttons, and calls Bridge.call('distortions.apply', getParams()). The existing code supports static distortion types: lens, warp, swirl, wave, bulge, and pinch.

I want you to upgrade the tool so distortions can be animated and so they can be applied to adjustment layers.

Tasks:
1. Modify DistortionsUI.js to add target mode controls:
   - Selected Layers
   - Duplicate Selected Layers
   - New Adjustment Layer
   - Selected Adjustment Layer
   - Precomp + Adjustment Layer

2. Modify DistortionsUI.js to add animation controls:
   - Static / Animated
   - Animation mode: loop, pingpong, drift, pulse, manual keyframes
   - Loop duration
   - Speed
   - Animation amount
   - Random seed
   - Output mode: expressions or keyframes

3. Extend the _state object with all target and animation properties.

4. Update applyPreset() so it also updates the new animation and target controls safely.

5. Build or modify the backend Bridge handler 'distortions.apply':
   - Validate active comp
   - Resolve target layers based on targetMode
   - Create a comp-sized adjustment layer when targetMode is newAdjustment
   - Use selected adjustment layers when targetMode is selectedAdjustment
   - Duplicate selected layers when targetMode is duplicateLayers
   - Apply the selected distortion effect to the resolved layers
   - Support feathered circular masks on adjustment layers
   - Apply static values
   - If animateEnabled is true, add expressions or bake keyframes

6. Use native AE effects first:
   - Lens: Optics Compensation or CC Lens
   - Swirl: Twirl
   - Wave: Wave Warp or Turbulent Displace
   - Bulge: Bulge
   - Pinch: Bulge with inverted amount if possible
   - Warp: Turbulent Displace fallback

7. Create helper files:
   - adjustmentLayers.jsx
   - animationExpressions.jsx
   - distortionEffects.jsx
   - masks.jsx
   - presets.jsx

8. Keep the workflow non-destructive. The adjustment layer workflow is very important.

9. Add comments throughout the code explaining the architecture.

10. Do not remove existing UI functionality. Extend it cleanly.
```

---

# 20. MVP Acceptance Criteria

The upgraded tool is successful if:

```text
- User can select a layer and apply a static distortion.
- User can select a layer and apply an animated distortion.
- User can create a new adjustment layer with the distortion applied.
- User can animate at least one property per distortion type.
- User can choose expressions or baked keyframes.
- Feather/radius can create a localized masked distortion on an adjustment layer.
- Existing presets still work.
- No code breaks when older presets do not contain the new state fields.
```

---

# 21. Priority Implementation Order

Build in this order:

```text
1. Add targetMode to state and UI.
2. Implement newAdjustment backend.
3. Add animateEnabled, animDuration, animSpeed, animAmount to state and UI.
4. Add expression animation to one property per distortion type.
5. Add selectedAdjustment support.
6. Add duplicateLayers support.
7. Add masked adjustment layer support.
8. Add keyframe baking.
9. Add animation presets.
10. Add controller layer option.
```

---

# 22. Final Recommendation

Do not overbuild first.

The first working upgrade should simply do this:

```text
Create Adjustment Layer
Apply Wave Warp / Twirl / Bulge / Optics Compensation
Add expression to Phase / Angle / Height / Amount
Expose Duration, Speed, Amount
```

Once that works, expand into a polished animated distortion system.

The core product direction should be:

```text
A non-destructive animated distortion builder for After Effects that can work directly on layers or globally through adjustment layers.
```

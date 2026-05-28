# AE Plugin Suite — Quality & Completeness Pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every dead/ignored parameter across all 5 plugins, add animation easing, build a tooltip system, and add reset-to-default on all sliders — elevating the suite to Boris FX quality.

**Architecture:** Three phases: (1) JSX effect quality — fix ignored params in ExtendScript backend; (2) JS panel UX — tooltip system + slider reset buttons; (3) Integration — wire tooltips/defaults into all 5 plugin UIs and clean up factory presets.

**Tech Stack:** ExtendScript ES3 (`jsx/`), CEP HTML/JS (`js/`, `css/`), After Effects CC 2019+ (AEFT 16.0+), no build step.

---

## Audit Summary (what this plan fixes)

| Plugin | Bug | Severity |
|---|---|---|
| Glow | `falloff` param ignored — always `1 - pass * 0.3` | Critical |
| Glow | `quality` param never applied to AE layers | Medium |
| Sorter | `randomness` unpacked but never used | Medium |
| Sorter | Color Key feature — full UI, zero JSX backend | Critical |
| Grids | "Stroke Draw" animation listed in UI, not in JSX | Medium |
| Distortions | `feather` param unused — no mask applied | Critical |
| Distortions | `centerX`/`centerY` read by JSX, no UI controls | Critical |
| All plugins | No tooltips, no reset-to-default on sliders | UX |
| Factory presets | Include dead params (falloff, feather, randomness) | Medium |

---

## File Map

**Modified JSX (runs in After Effects):**
- `jsx/glow.jsx` — add `_glowPassScale()` falloff function, apply `LayerQuality.DRAFT` for fast mode
- `jsx/sorter.jsx` — rewrite using Directional Blur + luma matte + Color Key + Turbulent Displace
- `jsx/distortions.jsx` — add `_applyFeatherMask()`, duplicate layer when feather > 0
- `jsx/grids.jsx` — add Trim Paths stroke animation
- `jsx/slides.jsx` — add `_applyEase()` helper, add padding params

**Modified JS (runs in CEP panel):**
- `js/components/Slider.js` — add `defaultValue` config, reset button
- `js/components/Tooltip.js` — **NEW** — floating tooltip on `[data-tooltip]` elements
- `js/components/Dropdown.js` — accept `tooltip` config, set `data-tooltip`
- `js/components/ButtonGroup.js` — accept `tooltip` config, set `data-tooltip`
- `js/components/Toggle.js` — accept `tooltip` config, set `data-tooltip`
- `js/components/ColorPicker.js` — accept `tooltip` config, set `data-tooltip`
- `js/plugins/slides/ui.js` — add tooltip + defaultValue to all controls
- `js/plugins/grids/ui.js` — add tooltip + defaultValue to all controls
- `js/plugins/glow/ui.js` — add tooltip + defaultValue to all controls
- `js/plugins/sorter/ui.js` — add tooltip + defaultValue to all controls
- `js/plugins/distortions/ui.js` — add centerX/centerY sliders, tooltip + defaultValue
- `js/app.js` — call `Tooltip.init()` on load
- `js/factory-presets.js` — remove dead params from glow/sorter/distortions presets

**Modified CSS:**
- `css/components.css` — tooltip float styles, slider reset button styles

**Modified HTML:**
- `index.html` — add `<script src="js/components/Tooltip.js">` before plugin UIs

---

## Task 1 — Fix Glow falloff + quality

**Files:**
- Modify: `jsx/glow.jsx`

- [ ] **Step 1: Replace glow.jsx with the fixed version**

```javascript
var Glow = (function() {

  function apply(params) {
    return withUndo('Deep Glow', function() {
      var comp       = requireComp();
      var selected   = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply Deep Glow.' };
      }

      var intensity  = (params.intensity  || 150) / 100;
      var radius     = params.radius      || 60;
      var threshold  = params.threshold   || 80;
      var glowColor  = hexToRgb(params.glowColor  || '#ffffff');
      var blendMode  = blendModeFromString(params.blendMode || 'screen');
      var numLayers  = params.layers      || 2;
      var quality    = params.quality     || 'quality';
      var satBoost   = params.saturation  || 0;
      var hueShift   = params.hueShift    || 0;
      var colorize   = params.colorize    || false;
      var falloff    = params.falloff     || 'soft';

      var count = 0;

      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];

        for (var pass = 0; pass < numLayers; pass++) {
          var passScale  = _glowPassScale(pass, numLayers, falloff);
          var passRadius = radius * (1 + pass * 0.8);

          var dup = src.duplicate();
          dup.name = src.name + '_Glow_' + (pass + 1);
          dup.moveAfter(src);

          if (quality === 'fast') {
            dup.quality = LayerQuality.DRAFT;
          }

          var glowFx = dup.property('ADBE Effect Parade').addProperty('ADBE Glow');
          if (glowFx) {
            glowFx.property('ADBE Glow Threshold').setValue(threshold / 255);
            glowFx.property('ADBE Glow Radius').setValue(passRadius);
            glowFx.property('ADBE Glow Intensity').setValue(intensity * passScale);
            if (colorize) {
              glowFx.property('ADBE Glow Operation').setValue(3);
              glowFx.property('ADBE Glow Color A').setValue(glowColor);
            }
          }

          if (satBoost !== 0 || hueShift !== 0) {
            var hueFx = dup.property('ADBE Effect Parade').addProperty('ADBE HUE SATURATION');
            if (hueFx) {
              if (hueShift !== 0) hueFx.property('ADBE HUE SATURATION-0001').setValue(hueShift);
              if (satBoost !== 0) hueFx.property('ADBE HUE SATURATION-0002').setValue(satBoost);
            }
          }

          dup.blendingMode = blendMode;
          dup.property('ADBE Opacity').setValue(100 * passScale);
        }
        count++;
      }

      return { success: true, count: count };
    });
  }

  // Intensity multiplier per pass index based on falloff curve
  // pass=0 always returns 1.0 (full intensity first pass)
  function _glowPassScale(pass, numLayers, falloff) {
    if (falloff === 'linear') {
      return Math.max(0.05, 1 - (pass / Math.max(1, numLayers - 1)) * 0.9);
    }
    if (falloff === 'exponential') {
      return Math.pow(0.45, pass);
    }
    // 'soft' default — inverse square root decay
    return 1 / Math.sqrt(pass + 1);
  }

  return { apply: apply };
})();
```

- [ ] **Step 2: Verify in After Effects**
  - Select a layer with bright areas
  - Open Glow tab, set Layers=3, Falloff=Exponential → Apply Glow
  - Each `_Glow_N` layer should have decreasing opacity: ~100%, ~45%, ~20%
  - Switch to Falloff=Linear → opacity steps should be more even
  - Switch Quality=Fast → glow layers should show as Draft quality in timeline

---

## Task 2 — Rewrite Pixel Sorter with displacement map approach

**Files:**
- Modify: `jsx/sorter.jsx`

The current implementation uses Channel Blur which looks nothing like pixel sorting.
The new approach: Directional Blur on a duplicate (sort layer) + luminance-threshold matte (luma track matte) + Turbulent Displace on matte for randomness + Color Key on matte for color-keyed masking.

Layer stack produced per iteration:
```
[matteLayer]  ← luminance threshold (hidden by track matte usage)
[sortLayer]   ← directional blur, uses matteLayer as LUMA track matte
[src]         ← original, untouched
```

- [ ] **Step 1: Replace sorter.jsx with the new implementation**

```javascript
var Sorter = (function() {

  function apply(params) {
    return withUndo('Pixel Sorter', function() {
      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply Pixel Sort.' };
      }

      var mode       = params.sortMode    || 'brightness';
      var direction  = params.direction   || 'horizontal';
      var length     = params.sortLength  || 200;
      var threshold  = params.threshold   || 60;
      var randomness = params.randomness  || 0;
      var iterations = params.iterations  || 1;
      var useColorKey = params.useColorKey || false;
      var keyColor   = hexToRgb(params.keyColor  || '#ff0000');
      var keyHueTol  = params.keyHueTol   || 30;

      var count = 0;

      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];

        for (var iter = 0; iter < iterations; iter++) {
          // Create sort layer first (duplicated below src in z-order after moveBefore)
          var sortLayer = src.duplicate();
          sortLayer.name = src.name + '_Sort_' + (iter + 1);

          // Create matte layer (will be placed above sortLayer)
          var matteLayer = src.duplicate();
          matteLayer.name = src.name + '_Matte_' + (iter + 1);

          // Stack: matteLayer directly above sortLayer, above src
          sortLayer.moveBefore(src);
          matteLayer.moveBefore(sortLayer);

          // Apply directional blur to sort layer
          var sortFx = sortLayer.property('ADBE Effect Parade');
          try {
            var dirBlur = sortFx.addProperty('ADBE Directional Blur');
            if (dirBlur) {
              dirBlur.property('ADBE Directional Blur-0001').setValue(_sortAngle(direction));
              dirBlur.property('ADBE Directional Blur-0002').setValue(length);
            }
          } catch(e) {}

          // Build matte: extract sort channel, threshold, optional color key
          var matteFx = matteLayer.property('ADBE Effect Parade');
          _applyModeExtract(matteFx, mode);

          if (useColorKey) {
            try {
              var ckFx = matteFx.addProperty('ADBE Color Key');
              if (ckFx) {
                ckFx.property('ADBE Color Key-0001').setValue(keyColor);
                ckFx.property('ADBE Color Key-0002').setValue(Math.round(keyHueTol * 1.4));
              }
            } catch(e) {}
          } else {
            // Luminance threshold: crush darks to black, bright areas stay white
            try {
              var lvFx = matteFx.addProperty('ADBE Levels2');
              if (lvFx) {
                var blackPt = Math.round((threshold / 100) * 255);
                lvFx.property('ADBE Levels2-0002').setValue([blackPt, 255]);
              }
            } catch(e) {}
          }

          // Randomness via turbulent displacement on matte
          if (randomness > 0) {
            try {
              var tdFx = matteFx.addProperty('ADBE Turbulent Displace');
              if (tdFx) {
                tdFx.property('ADBE Turbulent Displace-0002').setValue(randomness * 2.5);
                tdFx.property('ADBE Turbulent Displace-0003').setValue(40 + randomness * 0.6);
              }
            } catch(e) {}
          }

          // Wire track matte: sortLayer uses matteLayer (directly above) as luma matte
          sortLayer.trackMatteType = TrackMatteType.LUMA;
        }
        count++;
      }

      return { success: true, count: count };
    });
  }

  function _sortAngle(direction) {
    if (direction === 'vertical')  return 0;
    if (direction === 'diagonal')  return 45;
    return 90; // horizontal (default) and radial fallback
  }

  // Desaturate the matte layer so luminance drives the threshold
  function _applyModeExtract(effects, mode) {
    try {
      if (mode === 'brightness' || mode === 'saturation') {
        var hueFx = effects.addProperty('ADBE HUE SATURATION');
        if (hueFx) hueFx.property('ADBE HUE SATURATION-0002').setValue(-100);
      }
      // 'hue' and 'red': use raw luminance from Levels alone
    } catch(e) {}
  }

  return { apply: apply };
})();
```

- [ ] **Step 2: Verify in After Effects**
  - Select a footage layer, switch to Sorter tab
  - Set Direction=Horizontal, Sort Length=300, Threshold=50, Apply
  - Should produce a **sort layer** (directional blur) + **matte layer** (desaturated + threshold) stacked above original
  - Enable useColorKey, set Key Color to a color present in the footage → matte should key to that color
  - Set Randomness=60 → matte layer should show Turbulent Displace rippling the matte edges
  - The sort layer should only blur where the matte is white (luma matte visible when solo'd)

---

## Task 3 — Fix Distortions feather + add centerX/centerY UI

**Files:**
- Modify: `jsx/distortions.jsx`
- Modify: `js/plugins/distortions/ui.js`

- [ ] **Step 1: Replace distortions.jsx with the feather-aware version**

```javascript
var Distortions = (function() {

  var EFFECT_MAP = {
    'lens':  'ADBE Optics Compensation',
    'warp':  'ADBE Mesh Warp',
    'swirl': 'ADBE Twirl',
    'wave':  'ADBE Wave Warp',
    'bulge': 'ADBE Bulge',
    'pinch': 'ADBE Bulge'
  };

  function apply(params) {
    return withUndo('Distortions Suite', function() {
      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply a distortion.' };
      }

      var type    = params.distType     || 'lens';
      var feather = params.feather      || 0;
      var opacity = params.blendOpacity || 100;
      var effectId = EFFECT_MAP[type];
      if (!effectId) return { error: 'Unknown distortion type: ' + type };

      var count = 0;

      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];
        try {
          var target;

          if (feather > 0) {
            // Non-destructive: apply to duplicate so feather mask blends with original
            target = src.duplicate();
            target.name = src.name + '_' + type;
            target.moveBefore(src);
          } else {
            target = src;
          }

          var fx = target.property('ADBE Effect Parade').addProperty(effectId);
          if (!fx) { count++; continue; }

          _configureEffect(fx, type, params, comp);

          if (feather > 0) {
            _applyFeatherMask(target, feather, comp.width, comp.height);
          }

          if (opacity !== 100) target.property('ADBE Opacity').setValue(opacity);

          count++;
        } catch(e) {
          // Effect not installed — skip gracefully
        }
      }

      return { success: true, count: count };
    });
  }

  function _configureEffect(fx, type, params, comp) {
    var intensity = params.intensity  || 50;
    var radius    = params.radius     || 200;
    var cx        = (params.centerX   !== undefined ? params.centerX : 0.5) * comp.width;
    var cy        = (params.centerY   !== undefined ? params.centerY : 0.5) * comp.height;

    if (type === 'lens') {
      try { fx.property('ADBE Optics Compensation-0001').setValue(intensity); } catch(e) {}
      try { fx.property('ADBE Optics Compensation-0002').setValue(1); }        catch(e) {}
    }
    else if (type === 'warp') {
      try { fx.property('ADBE Mesh Warp-0001').setValue(params.meshResX || 5); } catch(e) {}
      try { fx.property('ADBE Mesh Warp-0002').setValue(params.meshResY || 5); } catch(e) {}
    }
    else if (type === 'swirl') {
      try { fx.property('ADBE Twirl-0001').setValue(params.swirlAngle || 90); } catch(e) {}
      try { fx.property('ADBE Twirl-0002').setValue([cx, cy]); }               catch(e) {}
      try { fx.property('ADBE Twirl-0003').setValue(radius); }                 catch(e) {}
    }
    else if (type === 'wave') {
      try { fx.property('ADBE Wave Warp-0001').setValue(1); }                             catch(e) {}
      try { fx.property('ADBE Wave Warp-0002').setValue(params.amplitude || 20); }        catch(e) {}
      try { fx.property('ADBE Wave Warp-0003').setValue(params.frequency || 5); }         catch(e) {}
      try { fx.property('ADBE Wave Warp-0004').setValue(0); }                             catch(e) {}
      try { fx.property('ADBE Wave Warp-0005').setValue(params.waveSpeed || 1); }         catch(e) {}
    }
    else if (type === 'bulge') {
      try { fx.property('ADBE Bulge-0001').setValue([cx, cy]); }               catch(e) {}
      try { fx.property('ADBE Bulge-0002').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0003').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0004').setValue(intensity / 100); }        catch(e) {}
    }
    else if (type === 'pinch') {
      try { fx.property('ADBE Bulge-0001').setValue([cx, cy]); }               catch(e) {}
      try { fx.property('ADBE Bulge-0002').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0003').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0004').setValue(-(intensity / 100)); }     catch(e) {}
    }
  }

  // Rectangular mask with feather applied to a layer
  function _applyFeatherMask(layer, feather, compW, compH) {
    try {
      var mask  = layer.mask.addProperty('ADBE Mask Atom');
      var shape = new Shape();
      var pad   = feather * 0.5;
      shape.vertices    = [[pad, pad], [compW - pad, pad], [compW - pad, compH - pad], [pad, compH - pad]];
      shape.inTangents  = [[0,0],[0,0],[0,0],[0,0]];
      shape.outTangents = [[0,0],[0,0],[0,0],[0,0]];
      shape.closed = true;
      mask.property('ADBE Mask Shape').setValue(shape);
      mask.property('ADBE Mask Feather').setValue([feather, feather]);
      mask.property('ADBE Mask Mode').setValue(MaskMode.ADD);
    } catch(e) {}
  }

  return { apply: apply };
})();
```

- [ ] **Step 2: Add centerX/centerY sliders to distortions/ui.js**

In `js/plugins/distortions/ui.js`, find the "Common" section (after the type selector) and add center point controls. Replace the "Common" section block:

Find this in `js/plugins/distortions/ui.js`:
```javascript
    // Common
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Common'));
    _sliders.intensity = new Slider({ label: 'Intensity %', min: -200, max: 200, value: 50, step: 1,
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 10, max: 2000, value: 200, step: 1,
      onChange: function(v) { _state.radius = v; } });
    _sliders.feather = new Slider({ label: 'Feather px', min: 0, max: 200, value: 20, step: 1,
      onChange: function(v) { _state.feather = v; } });
    _sliders.blendOpacity = new Slider({ label: 'Opacity %', min: 0, max: 100, value: 100, step: 1,
      onChange: function(v) { _state.blendOpacity = v; } });
    container.appendChild(_sliders.intensity.el);
    container.appendChild(_sliders.radius.el);
    container.appendChild(_sliders.feather.el);
    container.appendChild(_sliders.blendOpacity.el);
```

Replace with:
```javascript
    // Common
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Common'));
    _sliders.intensity = new Slider({ label: 'Intensity %', min: -200, max: 200, value: 50, step: 1,
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 10, max: 2000, value: 200, step: 1,
      onChange: function(v) { _state.radius = v; } });
    _sliders.feather = new Slider({ label: 'Feather px', min: 0, max: 200, value: 0, step: 1,
      onChange: function(v) { _state.feather = v; } });
    _sliders.blendOpacity = new Slider({ label: 'Opacity %', min: 0, max: 100, value: 100, step: 1,
      onChange: function(v) { _state.blendOpacity = v; } });
    container.appendChild(_sliders.intensity.el);
    container.appendChild(_sliders.radius.el);
    container.appendChild(_sliders.feather.el);
    container.appendChild(_sliders.blendOpacity.el);

    // Center point
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Center Point'));
    var centerRow = Utils.el('div', { class: 'row-2' });
    _sliders.centerX = new Slider({ label: 'Center X', min: 0, max: 1, value: 0.5, step: 0.01, decimals: 2,
      onChange: function(v) { _state.centerX = v; } });
    _sliders.centerY = new Slider({ label: 'Center Y', min: 0, max: 1, value: 0.5, step: 0.01, decimals: 2,
      onChange: function(v) { _state.centerY = v; } });
    centerRow.appendChild(_sliders.centerX.el);
    centerRow.appendChild(_sliders.centerY.el);
    container.appendChild(centerRow);
```

Also update `_state` at the top of the file to include centerX/centerY:
```javascript
  var _state = {
    distType:  'lens',
    intensity:  50,
    centerX:    0.5,
    centerY:    0.5,
    radius:     200,
    feather:    0,
    focalLength: 50,
    meshResX: 5, meshResY: 5,
    swirlAngle: 90,
    amplitude: 20, frequency: 5, waveSpeed: 1,
    blendOpacity: 100
  };
```

And update `applyPreset` to include the new sliders:
```javascript
  function applyPreset(p) {
    Object.assign(_state, p);
    _typeGroup.setValue(p.distType);
    _sliders.intensity.setValue(p.intensity);
    _sliders.radius.setValue(p.radius);
    _sliders.feather.setValue(p.feather !== undefined ? p.feather : 0);
    _sliders.blendOpacity.setValue(p.blendOpacity);
    _sliders.centerX.setValue(p.centerX !== undefined ? p.centerX : 0.5);
    _sliders.centerY.setValue(p.centerY !== undefined ? p.centerY : 0.5);
    _showSection(p.distType);
  }
```

Also add `_sliders` to the var declarations at top of file:
```javascript
  var _sliders = {};
  var _typeGroup, _lensSection, _warpSection, _swirlSection, _waveSection, _status;
```
(centerX and centerY are now in `_sliders` — no separate var needed)

- [ ] **Step 3: Verify in After Effects**
  - Select a layer, Distortions tab, type=Swirl, Feather=60 → Apply Distortion
  - Should produce a `_swirl` duplicate layer above the original with an elliptical feathered mask
  - Drag Center X/Y → swirl center should move in the composition
  - Feather=0 → applies to original layer directly (no duplicate)

---

## Task 4 — Fix Grids stroke animation + add easing to all grid animations

**Files:**
- Modify: `jsx/grids.jsx`

- [ ] **Step 1: Add stroke animation and easing helper to grids.jsx**

After the `generate` function's animation block, replace:
```javascript
      // Entrance animation on container
      if (anim === 'fade') {
        var op = container.property('ADBE Opacity');
        op.setValueAtTime(0, 0);
        op.setValueAtTime(30 / comp.frameRate, 100);
      } else if (anim === 'scale') {
        var sc = container.property('ADBE Scale');
        sc.setValueAtTime(0, [0, 0]);
        sc.setValueAtTime(20 / comp.frameRate, [100, 100]);
      }
```

With:
```javascript
      if (anim === 'fade') {
        var op = container.property('ADBE Opacity');
        op.setValueAtTime(0, 0);
        op.setValueAtTime(30 / comp.frameRate, 100);
        _applyEase(op, 2);
      } else if (anim === 'scale') {
        var sc = container.property('ADBE Scale');
        sc.setValueAtTime(0, [0, 0]);
        sc.setValueAtTime(20 / comp.frameRate, [100, 100]);
        _applyEase(sc, 2);
      } else if (anim === 'stroke') {
        try {
          var trim    = content.addProperty('ADBE Vector Filter - Trim');
          var endProp = trim.property('ADBE Vector Trim End');
          endProp.setValueAtTime(0, 0);
          endProp.setValueAtTime(30 / comp.frameRate, 100);
          _applyEase(endProp, 2);
        } catch(e) {}
      }
```

Add the `_applyEase` helper function inside the Grids IIFE, before `return { generate: generate }`:
```javascript
  function _applyEase(prop, numKeyframes) {
    try {
      var ease = new KeyframeEase(0, 33.33);
      for (var ki = 1; ki <= numKeyframes; ki++) {
        try { prop.setTemporalEaseAtKey(ki, [ease], [ease]); }
        catch(e) {
          try { prop.setTemporalEaseAtKey(ki, [ease, ease], [ease, ease]); } catch(e2) {}
        }
      }
    } catch(e) {}
  }
```

- [ ] **Step 2: Verify in After Effects**
  - Create a grid, animType=Stroke Draw → container should have Trim Paths animating 0→100% over 30 frames
  - Create a grid, animType=Scale → scale keyframes should show Easy Ease handles in graph editor
  - Create a grid, animType=Fade → opacity keyframes should show Easy Ease handles

---

## Task 5 — Add animation easing to Slides

**Files:**
- Modify: `jsx/slides.jsx`

- [ ] **Step 1: Add `_applyEase` helper and apply to all animation types**

Add this function inside the `Slides` IIFE, before `return { generate: generate }`:
```javascript
  function _applyEase(prop, numKeyframes) {
    try {
      var ease = new KeyframeEase(0, 33.33);
      for (var ki = 1; ki <= numKeyframes; ki++) {
        try { prop.setTemporalEaseAtKey(ki, [ease], [ease]); }
        catch(e) {
          try { prop.setTemporalEaseAtKey(ki, [ease, ease], [ease, ease]); } catch(e2) {}
        }
      }
    } catch(e) {}
  }
```

Then in the animation block inside `generate`, after each `setValueAtTime` pair, add `_applyEase(prop, 2)`:

```javascript
            if (anim === 'fade') {
              var op = shape.property('ADBE Opacity');
              op.setValueAtTime(kf0, 0);
              op.setValueAtTime(kf1, 100);
              _applyEase(op, 2);
            } else if (anim === 'scale') {
              var scProp = shape.property('ADBE Scale');
              scProp.setValueAtTime(kf0, [0, 0]);
              scProp.setValueAtTime(kf1, [100, 100]);
              _applyEase(scProp, 2);
            } else if (anim === 'slideUp') {
              var posProp = shape.property('ADBE Position');
              posProp.setValueAtTime(kf0, [x, y + 60]);
              posProp.setValueAtTime(kf1, [x, y]);
              _applyEase(posProp, 2);
            } else if (anim === 'slideDown') {
              var posProp2 = shape.property('ADBE Position');
              posProp2.setValueAtTime(kf0, [x, y - 60]);
              posProp2.setValueAtTime(kf1, [x, y]);
              _applyEase(posProp2, 2);
            }
```

- [ ] **Step 2: Verify in After Effects**
  - Generate slides with animType=Fade → each slide's opacity keyframes should show Easy Ease in graph editor
  - Graph editor should show the characteristic S-curve, not straight diagonal lines

---

## Task 6 — Create Tooltip component

**Files:**
- Create: `js/components/Tooltip.js`
- Modify: `css/components.css`
- Modify: `index.html`

- [ ] **Step 1: Create `js/components/Tooltip.js`**

```javascript
'use strict';

window.Tooltip = (function() {
  var _el = null;

  function init() {
    _el = document.createElement('div');
    _el.className = 'tooltip-float';
    _el.style.display = 'none';
    document.body.appendChild(_el);

    document.addEventListener('mousemove', function(e) {
      if (_el.style.display !== 'none') {
        var x = Math.min(e.clientX + 14, window.innerWidth - 220);
        _el.style.left = x + 'px';
        _el.style.top  = Math.max(4, e.clientY - 38) + 'px';
      }
    });

    document.addEventListener('mouseover', function(e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-tooltip]') : null;
      if (el) {
        _el.textContent = el.getAttribute('data-tooltip');
        _el.style.display = 'block';
      }
    });

    document.addEventListener('mouseout', function(e) {
      var to = e.relatedTarget;
      var stillInside = to && to.closest && to.closest('[data-tooltip]');
      if (!stillInside) _el.style.display = 'none';
    });
  }

  return { init: init };
})();
```

- [ ] **Step 2: Add tooltip styles to `css/components.css`** (append at end of file)

```css
/* ── Tooltip ─────────────────────────────────────────────── */
.tooltip-float {
  position: fixed;
  z-index: 9999;
  background: #1c1c1c;
  border: 1px solid #3a3a3a;
  color: #aaaaaa;
  font-size: 10px;
  line-height: 1.45;
  padding: 5px 9px;
  border-radius: 4px;
  max-width: 200px;
  pointer-events: none;
  white-space: normal;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}

/* ── Slider reset button ─────────────────────────────────── */
.slider-reset {
  font-size: 11px;
  color: var(--text-dim);
  padding: 0 3px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
  background: none;
  border: none;
  font-family: inherit;
}
.component-slider:hover .slider-reset { opacity: 0.8; }
.slider-reset:hover { opacity: 1 !important; color: var(--accent); }
```

- [ ] **Step 3: Add Tooltip.js to `index.html`** before plugin UIs

Find:
```html
<!-- Plugin UIs -->
<script src="js/plugins/slides/ui.js"></script>
```

Add before it:
```html
<!-- Tooltip system -->
<script src="js/components/Tooltip.js"></script>

```

- [ ] **Step 4: Verify in browser**

Open `index.html` in a browser. No JS errors in console.
Manually add `data-tooltip="test tooltip"` to any element in DevTools → hovering over it should show the floating tooltip div.

---

## Task 7 — Add reset-to-default to Slider + tooltip support to all components

**Files:**
- Modify: `js/components/Slider.js`
- Modify: `js/components/Dropdown.js`
- Modify: `js/components/ButtonGroup.js`
- Modify: `js/components/Toggle.js`
- Modify: `js/components/ColorPicker.js`

- [ ] **Step 1: Update `js/components/Slider.js`**

Replace the entire file:
```javascript
'use strict';

function Slider(config) {
  this.label        = config.label        || '';
  this.min          = config.min          !== undefined ? config.min   : 0;
  this.max          = config.max          !== undefined ? config.max   : 100;
  this.value        = config.value        !== undefined ? config.value : this.min;
  this.step         = config.step         || 1;
  this.decimals     = config.decimals     !== undefined ? config.decimals : 0;
  this.unit         = config.unit         || '';
  this.defaultValue = config.defaultValue !== undefined ? config.defaultValue : undefined;
  this.tooltip      = config.tooltip      || '';
  this.onChange     = config.onChange     || function() {};
  this.el = this._build();
}

Slider.prototype._build = function() {
  var self  = this;
  var wrap  = Utils.el('div', { class: 'component-slider' });
  var hdr   = Utils.el('div', { class: 'slider-header' });
  var label = Utils.el('span', { class: 'slider-label' }, this.label);

  var input = document.createElement('input');
  input.type      = 'number';
  input.className = 'slider-input';
  input.min       = this.min;
  input.max       = this.max;
  input.step      = this.step;
  input.value     = this.value;

  var track = document.createElement('input');
  track.type      = 'range';
  track.className = 'slider-track';
  track.min       = this.min;
  track.max       = this.max;
  track.step      = this.step;
  track.value     = this.value;

  hdr.appendChild(label);
  hdr.appendChild(input);

  if (this.defaultValue !== undefined) {
    var resetBtn = document.createElement('button');
    resetBtn.className   = 'slider-reset';
    resetBtn.title       = 'Reset to ' + this.defaultValue;
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', function(e) {
      e.preventDefault();
      self.setValue(self.defaultValue);
      self.onChange(self.defaultValue);
    });
    hdr.appendChild(resetBtn);
  }

  wrap.appendChild(hdr);
  wrap.appendChild(track);

  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);

  var debounced = Utils.debounce(function(v) { self.onChange(v); }, 120);

  track.addEventListener('input', function() {
    var v = parseFloat(track.value);
    input.value = Utils.round(v, self.decimals);
    self.value  = v;
    debounced(v);
  });

  input.addEventListener('change', function() {
    var v = Utils.clamp(parseFloat(input.value) || 0, self.min, self.max);
    v = Utils.round(v, self.decimals);
    input.value = v;
    track.value = v;
    self.value  = v;
    self.onChange(v);
  });

  this._track = track;
  this._input = input;
  return wrap;
};

Slider.prototype.setValue = function(val) {
  var v = Utils.clamp(val, this.min, this.max);
  this.value        = v;
  this._track.value = v;
  this._input.value = Utils.round(v, this.decimals);
};

Slider.prototype.setEnabled = function(enabled) {
  this._track.disabled = !enabled;
  this._input.disabled = !enabled;
  this.el.style.opacity = enabled ? '' : '0.4';
};
```

- [ ] **Step 2: Add `tooltip` support to `js/components/Dropdown.js`**

In `Dropdown.prototype._build`, after `wrap.appendChild(sel)` and before `return wrap`:
```javascript
  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
```

Also add `this.tooltip = config.tooltip || '';` to the `Dropdown` constructor.

- [ ] **Step 3: Add `tooltip` support to `js/components/ButtonGroup.js`**

In `ButtonGroup.prototype._build`, after `wrap.appendChild(row)` and before `return wrap`:
```javascript
  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
```

Add `this.tooltip = config.tooltip || '';` to the `ButtonGroup` constructor.

- [ ] **Step 4: Add `tooltip` support to `js/components/Toggle.js`**

Read the current Toggle.js and add `this.tooltip = config.tooltip || '';` to constructor, and
`if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);` in `_build`.

- [ ] **Step 5: Add `tooltip` support to `js/components/ColorPicker.js`**

Add `this.tooltip = config.tooltip || '';` to constructor, and
`if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);` in `_build` before `return wrap`.

- [ ] **Step 6: Initialize Tooltip in `js/app.js`**

Find the `init()` function and add `Tooltip.init();` as the first call:
```javascript
  function init() {
    Tooltip.init();
    _initTabStrip();
    _initPlugins();
    _checkAEVersion();
  }
```

- [ ] **Step 7: Verify in browser**
  - Open `index.html` in browser (no AE needed for this step)
  - No JS errors in console
  - The `Tooltip.init()` call should create a hidden `.tooltip-float` div in the DOM

---

## Task 8 — Wire tooltips + defaults into all 5 plugin UIs

**Files:**
- Modify: `js/plugins/slides/ui.js`
- Modify: `js/plugins/grids/ui.js`
- Modify: `js/plugins/glow/ui.js`
- Modify: `js/plugins/sorter/ui.js`
- Modify: `js/plugins/distortions/ui.js`

For each plugin, add `tooltip: '...'` and `defaultValue: N` to every `new Slider(...)`, `new Dropdown(...)`, `new ButtonGroup(...)`, `new Toggle(...)`, and `new ColorPicker(...)` call.

- [ ] **Step 1: Update `js/plugins/slides/ui.js`**

Replace every Slider/Dropdown/Toggle instantiation with tooltip and defaultValue added:

```javascript
    _sliders.rows = new Slider({ label: 'Rows', min: 1, max: 20, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Number of rows in the slide grid',
      onChange: function(v) { _state.rows = v; } });
    _sliders.cols = new Slider({ label: 'Cols', min: 1, max: 20, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Number of columns in the slide grid',
      onChange: function(v) { _state.cols = v; } });

    _sliders.slideW = new Slider({ label: 'Width px', min: 20, max: 1920, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Width of each slide in pixels',
      onChange: function(v) { _state.slideW = v; } });
    _sliders.slideH = new Slider({ label: 'Height px', min: 20, max: 1080, value: 150, step: 1, defaultValue: 150,
      tooltip: 'Height of each slide in pixels',
      onChange: function(v) { _state.slideH = v; } });

    _sliders.gapH = new Slider({ label: 'Gap H', min: 0, max: 200, value: 10, step: 1, defaultValue: 10,
      tooltip: 'Horizontal gap between slides',
      onChange: function(v) { _state.gapH = v; } });
    _sliders.gapV = new Slider({ label: 'Gap V', min: 0, max: 200, value: 10, step: 1, defaultValue: 10,
      tooltip: 'Vertical gap between slides',
      onChange: function(v) { _state.gapV = v; } });

    _sliders.randomize = new Slider({ label: 'Position Jitter %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random position offset applied to each slide',
      onChange: function(v) { _state.randomize = v; } });
    _sliders.rotationRandom = new Slider({ label: 'Rotation °', min: 0, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random rotation angle per slide in degrees',
      onChange: function(v) { _state.rotationRandom = v; } });
    _sliders.scaleRandom = new Slider({ label: 'Scale Jitter %', min: 0, max: 50, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random scale variation per slide',
      onChange: function(v) { _state.scaleRandom = v; } });

    _animDD = new Dropdown({
      label: 'Entrance Type',
      tooltip: 'Entrance animation applied to each slide',
      options: [
        { value: 'none',      label: 'None' },
        { value: 'fade',      label: 'Fade In' },
        { value: 'scale',     label: 'Scale In' },
        { value: 'slideUp',   label: 'Slide Up' },
        { value: 'slideDown', label: 'Slide Down' }
      ],
      value: 'none',
      onChange: function(v) { _state.animType = v; }
    });
    _sliders.animStagger = new Slider({ label: 'Stagger (frames)', min: 0, max: 60, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Delay in frames between each slide\'s entrance animation',
      onChange: function(v) { _state.animStagger = v; } });

    _textToggle = new Toggle({ label: 'Auto-create text layers', value: false,
      tooltip: 'Creates a text layer centered on each slide',
      onChange: function(v) { _state.useText = v; } });
```

- [ ] **Step 2: Update `js/plugins/grids/ui.js`**

Add tooltip + defaultValue to all controls:
```javascript
    _typeGroup = new ButtonGroup({
      tooltip: 'Grid pattern type to generate',
      options: [
        { value: 'rect',   label: 'Rect' },
        { value: 'hex',    label: 'Hex' },
        { value: 'tri',    label: 'Tri' },
        { value: 'radial', label: 'Radial' },
        { value: 'circ',   label: 'Circle' }
      ],
      value: 'rect',
      onChange: function(v) { _state.gridType = v; }
    });

    _sliders.width = new Slider({ label: 'Width px', min: 50, max: 4000, value: 500, step: 1, defaultValue: 500,
      tooltip: 'Total width of the grid area',
      onChange: function(v) { _state.width = v; } });
    _sliders.height = new Slider({ label: 'Height px', min: 50, max: 4000, value: 500, step: 1, defaultValue: 500,
      tooltip: 'Total height of the grid area',
      onChange: function(v) { _state.height = v; } });
    _sliders.cellSize = new Slider({ label: 'Cell Size px', min: 4, max: 400, value: 40, step: 1, defaultValue: 40,
      tooltip: 'Size of each individual grid cell',
      onChange: function(v) { _state.cellSize = v; } });
    _sliders.rotation = new Slider({ label: 'Rotation °', min: 0, max: 360, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Rotation of the entire grid layer',
      onChange: function(v) { _state.rotation = v; } });
    _sliders.lineWidth = new Slider({ label: 'Line Width px', min: 0.5, max: 20, value: 1, step: 0.5, decimals: 1, defaultValue: 1,
      tooltip: 'Stroke width of grid lines',
      onChange: function(v) { _state.lineWidth = v; } });
    _lineColor = new ColorPicker({ label: 'Line Color', value: '#4d9fff',
      tooltip: 'Color of grid lines',
      onChange: function(v) { _state.lineColor = v; } });
    _fillColor = new ColorPicker({ label: 'Fill Color', value: '#000000',
      tooltip: 'Background fill color for each cell',
      onChange: function(v) { _state.fillColor = v; } });
    _fillOpacity = new Slider({ label: 'Fill Opacity %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Opacity of the cell fill (0 = transparent)',
      onChange: function(v) { _state.fillOpacity = v; } });
    _animDD = new Dropdown({
      label: 'Entrance',
      tooltip: 'Entrance animation for the grid',
      options: [
        { value: 'none',   label: 'None' },
        { value: 'fade',   label: 'Fade In' },
        { value: 'scale',  label: 'Scale In' },
        { value: 'stroke', label: 'Stroke Draw' }
      ],
      value: 'none',
      onChange: function(v) { _state.animType = v; }
    });
    _sliders.animStagger = new Slider({ label: 'Stagger (frames)', min: 0, max: 30, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Delay in frames for stagger animation',
      onChange: function(v) { _state.animStagger = v; } });
```

- [ ] **Step 3: Update `js/plugins/glow/ui.js`**

```javascript
    _sliders.intensity = new Slider({ label: 'Intensity %', min: 0, max: 500, value: 150, step: 1, defaultValue: 150,
      tooltip: 'Overall glow brightness multiplier across all passes',
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 0, max: 500, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Blur radius of the glow spread — larger = softer, wider glow',
      onChange: function(v) { _state.radius = v; } });
    _sliders.layers = new Slider({ label: 'Glow Layers', min: 1, max: 5, value: 2, step: 1, defaultValue: 2,
      tooltip: 'Number of stacked glow passes — more layers = richer, more complex glow',
      onChange: function(v) { _state.layers = v; } });
    _falloffGroup = new ButtonGroup({
      tooltip: 'How intensity decreases across successive glow passes',
      options: [
        { value: 'linear',      label: 'Linear' },
        { value: 'soft',        label: 'Soft' },
        { value: 'exponential', label: 'Exp' }
      ],
      value: 'soft',
      onChange: function(v) { _state.falloff = v; }
    });
    _sliders.threshold = new Slider({ label: 'Threshold (0–255)', min: 0, max: 255, value: 80, step: 1, defaultValue: 80,
      tooltip: 'Minimum pixel brightness to receive glow — raise to restrict glow to bright areas only',
      onChange: function(v) { _state.threshold = v; } });
    _glowColor = new ColorPicker({ label: 'Glow Color', value: '#ffffff',
      tooltip: 'Tint color applied when Colorize is enabled',
      onChange: function(v) { _state.glowColor = v; } });
    _colorizeToggle = new Toggle({ label: 'Colorize glow', value: false,
      tooltip: 'Apply the Glow Color tint to the glow layers',
      onChange: function(v) { _state.colorize = v; } });
    _sliders.saturation = new Slider({ label: 'Saturation Boost', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Boost (+) or reduce (−) color saturation of each glow pass',
      onChange: function(v) { _state.saturation = v; } });
    _sliders.hueShift = new Slider({ label: 'Hue Shift °', min: -180, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Rotate the hue of glow layers — creates color-shifted bloom',
      onChange: function(v) { _state.hueShift = v; } });
    _blendDD = new Dropdown({
      label: 'Blend Mode',
      tooltip: 'Blending mode used for glow layers over the source',
      options: [
        { value: 'screen',  label: 'Screen' },
        { value: 'add',     label: 'Add' },
        { value: 'overlay', label: 'Overlay' },
        { value: 'lighten', label: 'Lighten' }
      ],
      value: 'screen',
      onChange: function(v) { _state.blendMode = v; }
    });
    _qualityGroup = new ButtonGroup({
      tooltip: 'Fast uses Draft layer quality for quicker preview — Quality uses Best',
      options: [
        { value: 'fast',    label: 'Fast' },
        { value: 'quality', label: 'Quality' }
      ],
      value: 'quality',
      onChange: function(v) { _state.quality = v; }
    });
```

- [ ] **Step 4: Update `js/plugins/sorter/ui.js`**

```javascript
    _modeGroup = new ButtonGroup({
      tooltip: 'Which pixel channel drives the sort order',
      options: [
        { value: 'brightness', label: 'Bright' },
        { value: 'hue',        label: 'Hue' },
        { value: 'saturation', label: 'Sat' },
        { value: 'red',        label: 'Red' }
      ],
      value: 'brightness',
      onChange: function(v) { _state.sortMode = v; }
    });
    _dirGroup = new ButtonGroup({
      tooltip: 'Direction of the sort smear effect',
      options: [
        { value: 'horizontal', label: 'H' },
        { value: 'vertical',   label: 'V' },
        { value: 'diagonal',   label: 'Diag' },
        { value: 'radial',     label: 'Radial' }
      ],
      value: 'horizontal',
      onChange: function(v) { _state.direction = v; }
    });
    _sliders.sortLength = new Slider({ label: 'Sort Length px', min: 1, max: 2000, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Length of the directional blur smear — larger = longer pixel streaks',
      onChange: function(v) { _state.sortLength = v; } });
    _sliders.threshold = new Slider({ label: 'Threshold (0–100)', min: 0, max: 100, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Brightness cutoff — only pixels brighter than this threshold are sorted',
      onChange: function(v) { _state.threshold = v; } });
    _sliders.randomness = new Slider({ label: 'Randomness %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Adds turbulent variation to the sort threshold mask — higher = more chaotic edges',
      onChange: function(v) { _state.randomness = v; } });
    _sliders.iterations = new Slider({ label: 'Iterations', min: 1, max: 10, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Number of sort passes applied — each pass adds another matte+blur layer set',
      onChange: function(v) { _state.iterations = v; } });
    _keyToggle = new Toggle({ label: 'Enable Color Key', value: false,
      tooltip: 'Limit sorting to pixels matching the key color hue range',
      onChange: function(v) { _state.useColorKey = v; _setKeyEnabled(v); } });
    _keyColor = new ColorPicker({ label: 'Key Color', value: '#ff0000',
      tooltip: 'Hue to target for color-keyed sort masking',
      onChange: function(v) { _state.keyColor = v; } });
    _keyHueTol = new Slider({ label: 'Hue Tolerance °', min: 1, max: 180, value: 30, step: 1, defaultValue: 30,
      tooltip: 'Hue angle tolerance around the key color — wider = more pixels included',
      onChange: function(v) { _state.keyHueTol = v; } });
```

- [ ] **Step 5: Update `js/plugins/distortions/ui.js`**

Add tooltip + defaultValue to all existing controls (intensity, radius, feather, blendOpacity, centerX, centerY, and all type-specific sliders):

```javascript
    _typeGroup = new ButtonGroup({
      tooltip: 'Type of distortion effect to apply',
      options: [
        { value: 'lens',  label: 'Lens' },
        { value: 'warp',  label: 'Warp' },
        { value: 'swirl', label: 'Swirl' },
        { value: 'wave',  label: 'Wave' },
        { value: 'bulge', label: 'Bulge' },
        { value: 'pinch', label: 'Pinch' }
      ],
      value: 'lens',
      onChange: function(v) { _state.distType = v; _showSection(v); }
    });
    _sliders.intensity = new Slider({ label: 'Intensity %', min: -200, max: 200, value: 50, step: 1, defaultValue: 50,
      tooltip: 'Strength of the distortion effect — negative values invert the distortion',
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 10, max: 2000, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Radius of the affected area for swirl and bulge effects',
      onChange: function(v) { _state.radius = v; } });
    _sliders.feather = new Slider({ label: 'Feather px', min: 0, max: 200, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Soft edge blend — when > 0, distortion is applied to a duplicate layer with a feathered mask',
      onChange: function(v) { _state.feather = v; } });
    _sliders.blendOpacity = new Slider({ label: 'Opacity %', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Opacity of the distorted layer (or duplicate when feather > 0)',
      onChange: function(v) { _state.blendOpacity = v; } });
    _sliders.centerX = new Slider({ label: 'Center X', min: 0, max: 1, value: 0.5, step: 0.01, decimals: 2, defaultValue: 0.5,
      tooltip: 'Horizontal center of the distortion effect (0 = left, 1 = right)',
      onChange: function(v) { _state.centerX = v; } });
    _sliders.centerY = new Slider({ label: 'Center Y', min: 0, max: 1, value: 0.5, step: 0.01, decimals: 2, defaultValue: 0.5,
      tooltip: 'Vertical center of the distortion effect (0 = top, 1 = bottom)',
      onChange: function(v) { _state.centerY = v; } });
    // ... lens, warp, swirl, wave sections with tooltips:
    _sliders.focalLength = new Slider({ label: 'Focal Length mm', min: 10, max: 300, value: 50, step: 1, defaultValue: 50,
      tooltip: 'Focal length for lens distortion — lower = wider angle, more distortion',
      onChange: function(v) { _state.focalLength = v; } });
    _sliders.meshResX = new Slider({ label: 'Mesh Cols', min: 2, max: 20, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Horizontal mesh resolution for warp — higher = more control points',
      onChange: function(v) { _state.meshResX = v; } });
    _sliders.meshResY = new Slider({ label: 'Mesh Rows', min: 2, max: 20, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Vertical mesh resolution for warp',
      onChange: function(v) { _state.meshResY = v; } });
    _sliders.swirlAngle = new Slider({ label: 'Angle °', min: -720, max: 720, value: 90, step: 1, defaultValue: 90,
      tooltip: 'Total rotation angle for the swirl effect — negative reverses direction',
      onChange: function(v) { _state.swirlAngle = v; } });
    _sliders.amplitude = new Slider({ label: 'Amplitude px', min: 0, max: 200, value: 20, step: 1, defaultValue: 20,
      tooltip: 'Wave height in pixels',
      onChange: function(v) { _state.amplitude = v; } });
    _sliders.frequency = new Slider({ label: 'Frequency', min: 0.1, max: 20, value: 5, step: 0.1, decimals: 1, defaultValue: 5,
      tooltip: 'Number of wave cycles across the layer',
      onChange: function(v) { _state.frequency = v; } });
    _sliders.waveSpeed = new Slider({ label: 'Speed', min: 0, max: 10, value: 1, step: 0.1, decimals: 1, defaultValue: 1,
      tooltip: 'Wave animation speed multiplier',
      onChange: function(v) { _state.waveSpeed = v; } });
```

- [ ] **Step 6: Verify in browser**
  - Open `index.html` in browser
  - Hover over any slider → tooltip should appear after a moment
  - Click the ↺ reset button on any slider → value returns to default
  - No JS errors in console

---

## Task 9 — Fix factory presets (remove dead params, add new ones)

**Files:**
- Modify: `js/factory-presets.js`

The factory presets currently include dead params in glow (falloff will now work), sorter (randomness + colorKey now work), and distortions (feather + centerX/centerY now work). After Tasks 1–3, these params are functional. Update the presets to use realistic/intentional values.

- [ ] **Step 1: Replace `js/factory-presets.js` with updated presets that use all fixed params**

```javascript
'use strict';

window.FactoryPresets = {

  slides: {
    '3×3 Grid': {
      rows: 3, cols: 3, slideW: 200, slideH: 150,
      gapH: 12, gapV: 12, randomize: 0,
      rotationRandom: 0, scaleRandom: 0,
      animType: 'none', animStagger: 5, useText: false
    },
    'Card Deck': {
      rows: 1, cols: 5, slideW: 180, slideH: 260,
      gapH: 16, gapV: 10, randomize: 0,
      rotationRandom: 0, scaleRandom: 0,
      animType: 'slideUp', animStagger: 8, useText: false
    },
    'Scattered': {
      rows: 4, cols: 4, slideW: 140, slideH: 110,
      gapH: 24, gapV: 24, randomize: 65,
      rotationRandom: 14, scaleRandom: 18,
      animType: 'fade', animStagger: 3, useText: false
    },
    'Mosaic': {
      rows: 6, cols: 6, slideW: 72, slideH: 72,
      gapH: 4, gapV: 4, randomize: 0,
      rotationRandom: 0, scaleRandom: 0,
      animType: 'scale', animStagger: 2, useText: false
    },
    'Stagger Reveal': {
      rows: 2, cols: 4, slideW: 220, slideH: 160,
      gapH: 14, gapV: 14, randomize: 8,
      rotationRandom: 3, scaleRandom: 6,
      animType: 'fade', animStagger: 7, useText: true
    }
  },

  grids: {
    'Blueprint': {
      gridType: 'rect', width: 500, height: 500,
      cellSize: 40, lineWidth: 1,
      lineColor: '#4d9fff', fillColor: '#000a1a',
      fillOpacity: 25, rotation: 0,
      animType: 'none', animStagger: 3
    },
    'Graph Paper': {
      gridType: 'rect', width: 500, height: 500,
      cellSize: 20, lineWidth: 0.5,
      lineColor: '#cccccc', fillColor: '#ffffff',
      fillOpacity: 0, rotation: 0,
      animType: 'none', animStagger: 3
    },
    'Hex Mesh': {
      gridType: 'hex', width: 500, height: 500,
      cellSize: 35, lineWidth: 1.5,
      lineColor: '#6ff7c7', fillColor: '#0a2a1f',
      fillOpacity: 30, rotation: 0,
      animType: 'stroke', animStagger: 3
    },
    'Radar': {
      gridType: 'radial', width: 500, height: 500,
      cellSize: 40, lineWidth: 1,
      lineColor: '#f76f7c', fillColor: '#000000',
      fillOpacity: 0, rotation: 0,
      animType: 'fade', animStagger: 3
    },
    'Golden Triangles': {
      gridType: 'tri', width: 500, height: 500,
      cellSize: 55, lineWidth: 1,
      lineColor: '#f7c76f', fillColor: '#1a1400',
      fillOpacity: 20, rotation: 30,
      animType: 'none', animStagger: 3
    }
  },

  glow: {
    'Soft Bloom': {
      intensity: 120, radius: 80, falloff: 'soft',
      threshold: 60, glowColor: '#ffffff',
      colorize: false, saturation: 0, hueShift: 0,
      blendMode: 'screen', layers: 2, quality: 'quality'
    },
    'Neon': {
      intensity: 300, radius: 28, falloff: 'exponential',
      threshold: 100, glowColor: '#ff6bff',
      colorize: true, saturation: 30, hueShift: 0,
      blendMode: 'add', layers: 3, quality: 'quality'
    },
    'Aura': {
      intensity: 180, radius: 120, falloff: 'soft',
      threshold: 40, glowColor: '#7c6ff7',
      colorize: true, saturation: 20, hueShift: 10,
      blendMode: 'screen', layers: 3, quality: 'quality'
    },
    'Flare': {
      intensity: 420, radius: 18, falloff: 'exponential',
      threshold: 150, glowColor: '#fffbe0',
      colorize: false, saturation: 0, hueShift: 0,
      blendMode: 'add', layers: 2, quality: 'fast'
    },
    'Dreamy': {
      intensity: 75, radius: 200, falloff: 'soft',
      threshold: 20, glowColor: '#ffd7b5',
      colorize: true, saturation: -10, hueShift: 0,
      blendMode: 'screen', layers: 2, quality: 'quality'
    }
  },

  sorter: {
    'Glitch H': {
      sortMode: 'brightness', direction: 'horizontal',
      sortLength: 300, threshold: 50, randomness: 10,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 1
    },
    'Data Mosh': {
      sortMode: 'brightness', direction: 'diagonal',
      sortLength: 500, threshold: 30, randomness: 40,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 2
    },
    'Ice Crystal': {
      sortMode: 'saturation', direction: 'vertical',
      sortLength: 200, threshold: 70, randomness: 5,
      useColorKey: false, keyColor: '#0000ff', keyHueTol: 30, iterations: 1
    },
    'Signal Loss': {
      sortMode: 'hue', direction: 'horizontal',
      sortLength: 150, threshold: 40, randomness: 60,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 3
    },
    'Chromatic': {
      sortMode: 'red', direction: 'horizontal',
      sortLength: 400, threshold: 45, randomness: 20,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 1
    }
  },

  distortions: {
    'Fisheye': {
      distType: 'lens', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Barrel': {
      distType: 'lens', intensity: 35,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Vortex': {
      distType: 'swirl', intensity: 50,
      centerX: 0.5, centerY: 0.5, radius: 220, feather: 60,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 270, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Ocean': {
      distType: 'wave', intensity: 50,
      centerX: 0.5, centerY: 0.5, radius: 200, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 35, frequency: 3, waveSpeed: 0.5,
      blendOpacity: 100
    },
    'Magnify': {
      distType: 'bulge', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 200, feather: 80,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    }
  }

};
```

- [ ] **Step 2: Verify presets load correctly**
  - Open panel in browser
  - Each plugin's preset dropdown should show 5 factory presets in "Built-in" optgroup
  - Selecting "Neon" in Glow should set Falloff=Exponential, Layers=3
  - Selecting "Vortex" in Distortions should set Feather=60, Center=0.5/0.5
  - Selecting "Data Mosh" in Sorter should set Randomness=40

---

## Self-Review Checklist

**Spec coverage:**
- [x] Glow falloff — Task 1
- [x] Glow quality — Task 1
- [x] Sorter randomness — Task 2
- [x] Sorter color key — Task 2
- [x] Grids stroke animation — Task 4
- [x] Distortions feather — Task 3
- [x] Distortions centerX/centerY — Task 3
- [x] Animation easing (slides) — Task 5
- [x] Animation easing (grids) — Task 4
- [x] Tooltip system — Task 6
- [x] Reset-to-default sliders — Task 7
- [x] Tooltip wired into all 5 UIs — Task 8
- [x] Factory presets updated — Task 9

**No placeholders:** All steps contain actual code.

**Type consistency:**
- `_glowPassScale(pass, numLayers, falloff)` defined and called in Task 1 only ✓
- `_applyEase(prop, numKeyframes)` defined in Task 4 (grids) and Task 5 (slides) — each file gets its own copy ✓
- `_applyFeatherMask(layer, feather, compW, compH)` defined and called in Task 3 only ✓
- `TrackMatteType.LUMA` — standard ExtendScript global ✓
- `MaskMode.ADD` — standard ExtendScript global ✓
- `LayerQuality.DRAFT` / `LayerQuality.BEST` — standard ExtendScript globals ✓

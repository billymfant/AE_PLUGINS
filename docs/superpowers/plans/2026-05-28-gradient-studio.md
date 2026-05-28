# Gradient Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an advanced gradient generator plugin supporting linear, radial, conical, mesh (multi-point color blobs), and noise gradient types — inspired by ProGradient's multi-stop and mesh capabilities.

**Architecture:** For linear/radial: creates a solid layer with AE's Gradient Ramp effect. For conical: creates a shape layer with a conic-style simulation via multiple radial segments. For mesh: places blurred colored solids at control points. For noise: creates a solid with Fractal Noise + optional Tint. All outputs land as named layers at the top of the comp.

**Tech Stack:** ExtendScript (AE layer/effects API), vanilla JS.

**Prerequisites:** `2026-05-28-suite-expansion-master.md` Task 1 complete.

---

## File Map

| Action | File |
|--------|------|
| Create | `jsx/gradient.jsx` |
| Create | `js/plugins/gradient/ui.js` |
| Modify | `js/factory-presets.js` — add `gradient` block |

---

## Task 1: JSX Module — `jsx/gradient.jsx`

- [ ] Create `jsx/gradient.jsx`:

```javascript
// Gradient Studio — creates gradient layers using AE built-in effects.
var GradientStudio = (function () {

  function apply(params) {
    var comp = requireComp();
    return withUndo('Gradient Studio', function () {
      return _create(comp, params);
    });
  }

  function _create(comp, params) {
    var w = comp.width, h = comp.height;
    var type = params.gradientType || 'linear';

    if (type === 'linear' || type === 'radial') {
      return _rampGradient(comp, w, h, params);
    } else if (type === 'conical') {
      return _conicalGradient(comp, w, h, params);
    } else if (type === 'mesh') {
      return _meshGradient(comp, w, h, params);
    } else if (type === 'noise') {
      return _noiseGradient(comp, w, h, params);
    }
    return { error: 'Unknown gradient type: ' + type };
  }

  // ── Linear / Radial ─────────────────────────────────────────
  function _rampGradient(comp, w, h, params) {
    var solid = comp.layers.addSolid(
      [0, 0, 0, 1],
      'Gradient — ' + params.gradientType,
      w, h, comp.pixelAspect
    );
    solid.moveToBeginning();

    var ramp = solid.property('ADBE Effect Parade').addProperty('ADBE Ramp');
    ramp.property('ADBE Ramp Start').setValue([
      w * (params.startX / 100),
      h * (params.startY / 100)
    ]);
    ramp.property('ADBE Ramp End').setValue([
      w * (params.endX / 100),
      h * (params.endY / 100)
    ]);
    ramp.property('ADBE Ramp Start Color').setValue(_hex(params.colorStart));
    ramp.property('ADBE Ramp End Color').setValue(_hex(params.colorEnd));
    ramp.property('ADBE Ramp Shape').setValue(
      params.gradientType === 'radial' ? 2 : 1
    );
    ramp.property('ADBE Ramp Scatter').setValue(params.scatter || 0);

    if (params.blendMode && params.blendMode !== 'normal') {
      solid.blendingMode = _blendMode(params.blendMode);
    }

    return { type: params.gradientType, layer: solid.name };
  }

  // ── Conical ──────────────────────────────────────────────────
  // Simulates a conic gradient by rendering N pie-segment shape layers
  // blended together, each covering a different angular slice.
  function _conicalGradient(comp, w, h, params) {
    var cx = w * (params.centerX / 100);
    var cy = h * (params.centerY / 100);
    var segments = params.segments || 12;
    var r = Math.sqrt(w * w + h * h); // diagonal covers full frame

    var container = comp.layers.addNull();
    container.name = 'Gradient — Conical';
    container.moveToBeginning();

    for (var i = 0; i < segments; i++) {
      var t0 = i / segments;
      var t1 = (i + 1) / segments;
      var startAngle = t0 * 360;
      var endAngle   = t1 * 360;
      var color = _lerpColor(params.colorStart, params.colorEnd, t0);

      var shapeLayer = comp.layers.addShape();
      shapeLayer.name = 'Seg ' + (i + 1);
      shapeLayer.parent = container;

      var contents = shapeLayer.property('ADBE Root Vectors Group');
      var grp = contents.addProperty('ADBE Vector Group');
      var grpC = grp.property('ADBE Vectors Group');
      var shapeProp = grpC.addProperty('ADBE Vector Shape - Group');
      var fill = grpC.addProperty('ADBE Vector Graphic - Fill');
      fill.property('ADBE Vector Fill Color').setValue(color);

      // Build pie wedge as a closed polyline
      var shape = new Shape();
      shape.closed = true;
      var verts = [[cx, cy]];
      var steps = 6;
      for (var s = 0; s <= steps; s++) {
        var ang = (startAngle + (endAngle - startAngle) * (s / steps)) * Math.PI / 180;
        verts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
      }
      shape.vertices = verts;
      shape.inTangents  = _zeroTangents(verts.length);
      shape.outTangents = _zeroTangents(verts.length);
      shapeProp.property('ADBE Vector Shape').setValue(shape);
    }

    if (params.blendMode && params.blendMode !== 'normal') {
      container.blendingMode = _blendMode(params.blendMode);
    }
    return { type: 'conical', segments: segments };
  }

  // ── Mesh ─────────────────────────────────────────────────────
  // Each stop = blurred colored solid placed at (x%, y%) position.
  // Stacked with ADD blend mode to create smooth color mixing.
  function _meshGradient(comp, w, h, params) {
    var stops = params.meshStops || [
      { x: 20, y: 20, color: params.colorStart || '#ff0080' },
      { x: 80, y: 20, color: '#0080ff' },
      { x: 50, y: 80, color: params.colorEnd || '#00ff80' }
    ];
    var blurRadius = params.meshBlur || Math.round(Math.min(w, h) * 0.35);

    var container = comp.layers.addNull();
    container.name = 'Gradient — Mesh';
    container.moveToBeginning();

    // Black background
    var bg = comp.layers.addSolid([0, 0, 0, 1], 'Mesh BG', w, h, comp.pixelAspect);
    bg.parent = container;
    bg.moveToBeginning();

    for (var i = 0; i < stops.length; i++) {
      var stop = stops[i];
      var rgb = _hex(stop.color);
      var sz = Math.round(Math.min(w, h) * 0.6);

      var solid = comp.layers.addSolid(
        [rgb[0], rgb[1], rgb[2], 1],
        'Stop ' + (i + 1),
        sz, sz, comp.pixelAspect
      );
      solid.position.setValue([w * (stop.x / 100), h * (stop.y / 100)]);
      solid.blendingMode = BlendingMode.ADD;
      solid.parent = container;

      var blur = solid.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2');
      blur.property('ADBE Gaussian Blur 2-0001').setValue(blurRadius);
      blur.property('ADBE Gaussian Blur 2-0003').setValue(true); // Repeat Edge Pixels
    }

    return { type: 'mesh', stops: stops.length };
  }

  // ── Noise ────────────────────────────────────────────────────
  function _noiseGradient(comp, w, h, params) {
    var solid = comp.layers.addSolid(
      [0, 0, 0, 1], 'Gradient — Noise', w, h, comp.pixelAspect
    );
    solid.moveToBeginning();
    var fx = solid.property('ADBE Effect Parade');

    var fractal = fx.addProperty('ADBE Fractal Noise');
    fractal.property('ADBE Fractal Noise-0001').setValue(
      params.noiseType === 'turbulent' ? 4 : 1  // 1=Basic, 4=Turbulent Smooth
    );
    fractal.property('ADBE Fractal Noise-0004').setValue(params.noiseScale || 250);
    fractal.property('ADBE Fractal Noise-0007').setValue(params.noiseComplexity || 3);
    fractal.property('ADBE Fractal Noise-0013').setValue(
      [comp.width / 2, comp.height / 2] // offset to center
    );

    if (params.colorize) {
      var tint = fx.addProperty('ADBE Tint');
      tint.property('ADBE Tint-0002').setValue(_hex(params.colorStart || '#000000'));
      tint.property('ADBE Tint-0003').setValue(_hex(params.colorEnd || '#ffffff'));
      tint.property('ADBE Tint-0004').setValue(100);
    }

    if (params.blendMode && params.blendMode !== 'normal') {
      solid.blendingMode = _blendMode(params.blendMode);
    }

    return { type: 'noise', layer: solid.name };
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _hex(hex) {
    if (!hex || hex.length < 7) return [0, 0, 0, 1];
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      1
    ];
  }

  function _lerpColor(hexA, hexB, t) {
    var a = _hex(hexA), b = _hex(hexB);
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, 1];
  }

  function _zeroTangents(n) {
    var t = [];
    for (var i = 0; i < n; i++) t.push([0, 0]);
    return t;
  }

  function _blendMode(name) {
    var modes = {
      'normal':   BlendingMode.NORMAL,
      'add':      BlendingMode.ADD,
      'screen':   BlendingMode.SCREEN,
      'multiply': BlendingMode.MULTIPLY,
      'overlay':  BlendingMode.OVERLAY,
      'soft':     BlendingMode.SOFT_LIGHT
    };
    return modes[name] || BlendingMode.NORMAL;
  }

  return { apply: apply };
}());
```

---

## Task 2: UI Module — `js/plugins/gradient/ui.js`

- [ ] Create `js/plugins/gradient/ui.js`:

```javascript
'use strict';

window.GradientUI = (function () {
  var _state = {
    gradientType: 'linear',
    colorStart:   '#0a0a2e',
    colorEnd:     '#ff6b6b',
    startX:       10, startY: 50,
    endX:         90, endY:   50,
    scatter:      0,
    centerX:      50, centerY: 50,
    segments:     16,
    meshBlur:     200,
    meshStops:    [
      { x: 20, y: 20, color: '#7c3aed' },
      { x: 80, y: 20, color: '#2563eb' },
      { x: 50, y: 80, color: '#06b6d4' }
    ],
    noiseType:       'basic',
    noiseScale:      250,
    noiseComplexity: 3,
    colorize:        true,
    blendMode:       'normal'
  };

  function getParams()    { return Utils.deepClone(_state); }
  function applyPreset(p) {
    Object.assign(_state, p);
    _typeGroup.setValue(p.gradientType);
    _colorStart.setValue(p.colorStart);
    _colorEnd.setValue(p.colorEnd);
    _sliders.startX.setValue(p.startX); _sliders.startY.setValue(p.startY);
    _sliders.endX.setValue(p.endX);     _sliders.endY.setValue(p.endY);
    _sliders.scatter.setValue(p.scatter);
    _sliders.centerX.setValue(p.centerX); _sliders.centerY.setValue(p.centerY);
    _sliders.segments.setValue(p.segments);
    _sliders.meshBlur.setValue(p.meshBlur);
    _noiseDD.setValue(p.noiseType);
    _sliders.noiseScale.setValue(p.noiseScale);
    _sliders.noiseComplexity.setValue(p.noiseComplexity);
    _colorizeToggle.setValue(p.colorize);
    _blendDD.setValue(p.blendMode);
    _updateSections(p.gradientType);
  }

  var _sliders = {};
  var _typeGroup, _colorStart, _colorEnd;
  var _linearSection, _conicalSection, _meshSection, _noiseSection;
  var _noiseDD, _colorizeToggle, _blendDD, _status;

  function init(container) {
    // ── Type ──────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Type'));
    _typeGroup = new ButtonGroup({
      options: [
        { value: 'linear',  label: 'Linear' },
        { value: 'radial',  label: 'Radial' },
        { value: 'conical', label: 'Conic' },
        { value: 'mesh',    label: 'Mesh' },
        { value: 'noise',   label: 'Noise' }
      ],
      value: 'linear',
      tooltip: 'Type of gradient to generate',
      onChange: function (v) { _state.gradientType = v; _updateSections(v); }
    });
    container.appendChild(_typeGroup.el);

    // ── Colors (shared across linear/radial/conical/noise) ─
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Colors'));
    var colorRow = Utils.el('div', { class: 'row-2' });
    _colorStart = new ColorPicker({ label: 'Start / From', value: '#0a0a2e', onChange: function(v){_state.colorStart=v;} });
    _colorEnd   = new ColorPicker({ label: 'End / To',     value: '#ff6b6b', onChange: function(v){_state.colorEnd=v;} });
    colorRow.appendChild(_colorStart.el);
    colorRow.appendChild(_colorEnd.el);
    container.appendChild(colorRow);

    // ── Linear / Radial section ───────────────────────────
    _linearSection = Utils.el('div', {});
    _linearSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Position'));
    var startRow = Utils.el('div', { class: 'row-2' });
    _sliders.startX = new Slider({ label: 'Start X %', min: 0, max: 100, value: 10, step: 1, defaultValue: 10, onChange: function(v){_state.startX=v;} });
    _sliders.startY = new Slider({ label: 'Start Y %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.startY=v;} });
    startRow.appendChild(_sliders.startX.el);
    startRow.appendChild(_sliders.startY.el);
    var endRow = Utils.el('div', { class: 'row-2' });
    _sliders.endX = new Slider({ label: 'End X %', min: 0, max: 100, value: 90, step: 1, defaultValue: 90, onChange: function(v){_state.endX=v;} });
    _sliders.endY = new Slider({ label: 'End Y %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.endY=v;} });
    endRow.appendChild(_sliders.endX.el);
    endRow.appendChild(_sliders.endY.el);
    _sliders.scatter = new Slider({ label: 'Scatter', min: 0, max: 100, value: 0, step: 1, defaultValue: 0, tooltip: 'Adds noise dithering to reduce color banding', onChange: function(v){_state.scatter=v;} });
    _linearSection.appendChild(startRow);
    _linearSection.appendChild(endRow);
    _linearSection.appendChild(_sliders.scatter.el);
    container.appendChild(_linearSection);

    // ── Conical section ───────────────────────────────────
    _conicalSection = Utils.el('div', {});
    _conicalSection.style.display = 'none';
    _conicalSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Center'));
    var cRow = Utils.el('div', { class: 'row-2' });
    _sliders.centerX = new Slider({ label: 'Center X %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.centerX=v;} });
    _sliders.centerY = new Slider({ label: 'Center Y %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.centerY=v;} });
    cRow.appendChild(_sliders.centerX.el);
    cRow.appendChild(_sliders.centerY.el);
    _sliders.segments = new Slider({ label: 'Segments', min: 4, max: 36, value: 16, step: 1, defaultValue: 16, tooltip: 'More segments = smoother conic gradient', onChange: function(v){_state.segments=v;} });
    _conicalSection.appendChild(cRow);
    _conicalSection.appendChild(_sliders.segments.el);
    container.appendChild(_conicalSection);

    // ── Mesh section ──────────────────────────────────────
    _meshSection = Utils.el('div', {});
    _meshSection.style.display = 'none';
    _meshSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Mesh'));
    _sliders.meshBlur = new Slider({ label: 'Blur Radius px', min: 50, max: 600, value: 200, step: 10, defaultValue: 200, tooltip: 'Controls how far each color point bleeds — higher = softer mesh', onChange: function(v){_state.meshBlur=v;} });
    _meshSection.appendChild(_sliders.meshBlur.el);
    _meshSection.appendChild(Utils.el('div', { class: 'help-text' }, 'Mesh uses the 3 default stops below. Edit meshStops in preset JSON for custom points.'));
    container.appendChild(_meshSection);

    // ── Noise section ─────────────────────────────────────
    _noiseSection = Utils.el('div', {});
    _noiseSection.style.display = 'none';
    _noiseSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Noise'));
    _noiseDD = new Dropdown({
      label: 'Noise Type', options: [{ value: 'basic', label: 'Basic' }, { value: 'turbulent', label: 'Turbulent' }],
      value: 'basic', onChange: function(v){_state.noiseType=v;}
    });
    _sliders.noiseScale = new Slider({ label: 'Scale', min: 50, max: 1000, value: 250, step: 10, defaultValue: 250, onChange: function(v){_state.noiseScale=v;} });
    _sliders.noiseComplexity = new Slider({ label: 'Complexity', min: 1, max: 8, value: 3, step: 1, defaultValue: 3, onChange: function(v){_state.noiseComplexity=v;} });
    _colorizeToggle = new Toggle({ label: 'Colorize', value: true, tooltip: 'Apply Start/End colors as a tint over the noise', onChange: function(v){_state.colorize=v;} });
    _noiseSection.appendChild(_noiseDD.el);
    _noiseSection.appendChild(_sliders.noiseScale.el);
    _noiseSection.appendChild(_sliders.noiseComplexity.el);
    _noiseSection.appendChild(_colorizeToggle.el);
    container.appendChild(_noiseSection);

    // ── Output ────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Output'));
    _blendDD = new Dropdown({
      label: 'Blend Mode',
      options: [
        { value: 'normal',   label: 'Normal' },
        { value: 'add',      label: 'Add' },
        { value: 'screen',   label: 'Screen' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'overlay',  label: 'Overlay' },
        { value: 'soft',     label: 'Soft Light' }
      ],
      value: 'normal',
      onChange: function(v){_state.blendMode=v;}
    });
    container.appendChild(_blendDD.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Gradient');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _updateSections(type) {
    _linearSection.style.display  = (type === 'linear' || type === 'radial') ? '' : 'none';
    _conicalSection.style.display = type === 'conical' ? '' : 'none';
    _meshSection.style.display    = type === 'mesh'    ? '' : 'none';
    _noiseSection.style.display   = type === 'noise'   ? '' : 'none';
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Generating…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('gradient.apply', getParams()).then(function (r) {
      btn.disabled = false; btn.textContent = 'Generate Gradient';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else         { _status.className = 'status-bar success'; _status.textContent = r.type + ' gradient created.'; }
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Generate Gradient';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());
```

---

## Task 3: Factory Presets — add `gradient` block to `js/factory-presets.js`

- [ ] Add this block to `js/factory-presets.js`:

```javascript
  gradient: {
    'Midnight Radial': { gradientType: 'radial', colorStart: '#0a0a2e', colorEnd: '#ff6b6b', startX: 50, startY: 50, endX: 90, endY: 90, scatter: 15, centerX: 50, centerY: 50, segments: 16, meshBlur: 200, meshStops: [{x:20,y:20,color:'#7c3aed'},{x:80,y:20,color:'#2563eb'},{x:50,y:80,color:'#06b6d4'}], noiseType: 'basic', noiseScale: 250, noiseComplexity: 3, colorize: true, blendMode: 'normal' },
    'Horizon Linear': { gradientType: 'linear', colorStart: '#ff512f', colorEnd: '#dd2476', startX: 0, startY: 50, endX: 100, endY: 50, scatter: 10, centerX: 50, centerY: 50, segments: 16, meshBlur: 200, meshStops: [{x:20,y:20,color:'#ff512f'},{x:80,y:20,color:'#dd2476'},{x:50,y:80,color:'#f09819'}], noiseType: 'basic', noiseScale: 250, noiseComplexity: 3, colorize: true, blendMode: 'normal' },
    'Aurora Mesh': { gradientType: 'mesh', colorStart: '#00c6ff', colorEnd: '#0072ff', startX: 10, startY: 50, endX: 90, endY: 50, scatter: 0, centerX: 50, centerY: 50, segments: 16, meshBlur: 280, meshStops: [{x:15,y:25,color:'#7c3aed'},{x:85,y:25,color:'#0ea5e9'},{x:50,y:75,color:'#10b981'}], noiseType: 'basic', noiseScale: 250, noiseComplexity: 3, colorize: true, blendMode: 'normal' },
    'Lava Conic': { gradientType: 'conical', colorStart: '#ff4500', colorEnd: '#ff8c00', startX: 10, startY: 50, endX: 90, endY: 50, scatter: 0, centerX: 50, centerY: 50, segments: 24, meshBlur: 200, meshStops: [{x:50,y:20,color:'#ff4500'},{x:80,y:80,color:'#ff8c00'},{x:20,y:80,color:'#ffd700'}], noiseType: 'basic', noiseScale: 250, noiseComplexity: 3, colorize: true, blendMode: 'normal' },
    'Smoke Noise': { gradientType: 'noise', colorStart: '#1a1a2e', colorEnd: '#e0e0e0', startX: 10, startY: 50, endX: 90, endY: 50, scatter: 0, centerX: 50, centerY: 50, segments: 16, meshBlur: 200, meshStops: [{x:50,y:50,color:'#888888'}], noiseType: 'turbulent', noiseScale: 350, noiseComplexity: 5, colorize: true, blendMode: 'screen' }
  },
```

---

## Task 4: Verify

- [ ] Open `preview.html`. Click **Grad** tab. Verify all 5 type sections appear.
- [ ] Switch type to **Mesh** — confirm linear section hides and mesh section shows.
- [ ] Switch to **Noise** — confirm noise section shows, colorize toggle visible.
- [ ] Click **Generate Gradient** — confirm success message.
- [ ] Commit:

```bash
git add jsx/gradient.jsx js/plugins/gradient/ui.js js/factory-presets.js
git commit -m "feat: add Gradient Studio — linear, radial, conical, mesh, noise types"
```

---

## Next

→ Continue with `2026-05-28-pattern-pro.md`

# Pattern Pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a procedural pattern generator using L-Systems (Lindenmayer systems) and spirograph math, outputting AE shape layers — inspired by Tracery's parametric line art approach.

**Architecture:** An L-System engine expands a grammar string iteratively (e.g. "Koch Snowflake" expands `F` → `F+F--F+F` for N iterations), then a turtle-graphics interpreter walks the string to produce (x,y) polyline segments. These segments become AE Shape Layer paths. Spirograph mode uses epitrochoid math directly. Both respect a size parameter to scale output to fill the comp. Optional Trim Paths animation draws the pattern on over a set duration.

**Tech Stack:** ExtendScript, vanilla JS, existing UI components.

**Prerequisites:** `2026-05-28-suite-expansion-master.md` Task 1 complete.

---

## File Map

| Action | File |
|--------|------|
| Create | `jsx/patterns.jsx` |
| Create | `js/plugins/patterns/ui.js` |
| Modify | `js/factory-presets.js` — add `patterns` block |

---

## Task 1: JSX Module — `jsx/patterns.jsx`

- [ ] Create `jsx/patterns.jsx`:

```javascript
// Pattern Pro — L-Systems + spirograph generator outputting AE shape layers.
var Patterns = (function () {

  // ── Public entry point ───────────────────────────────────────
  function generate(params) {
    var comp = requireComp();
    return withUndo('Pattern Pro', function () {
      if (params.patternType === 'lsystem') {
        return _lsystemGenerate(comp, params);
      } else if (params.patternType === 'spirograph') {
        return _spirographGenerate(comp, params);
      }
      return { error: 'Unknown patternType: ' + params.patternType };
    });
  }

  // ── L-System ─────────────────────────────────────────────────

  // Built-in presets: axiom, rules, default angle
  var PRESETS = {
    'Koch Snowflake':      { axiom: 'F--F--F',  rules: { F: 'F+F--F+F' },            angle: 60  },
    'Dragon Curve':        { axiom: 'FX',        rules: { X: 'X+YF+', Y: '-FX-Y' },  angle: 90  },
    'Sierpinski Triangle': { axiom: 'F-G-G',     rules: { F: 'F-G+F+G-F', G: 'GG' }, angle: 120 },
    'Plant':               { axiom: 'X',         rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25 },
    'Hilbert Curve':       { axiom: 'A',         rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' }, angle: 90 },
    'Levy C Curve':        { axiom: 'F',         rules: { F: '+F--F+' },               angle: 45 },
    'Gosper Curve':        { axiom: 'XF',        rules: { X: 'X+YF++YF-FX--FXFX-YF+', Y: '-FX+YFYF++YF+FX--FX-Y' }, angle: 60 }
  };

  function _lsystemExpand(axiom, rules, iterations) {
    var str = axiom;
    for (var iter = 0; iter < Math.min(iterations, 8); iter++) {
      var next = '';
      for (var j = 0; j < str.length && str.length < 200000; j++) {
        var c = str[j];
        next += (rules[c] !== undefined) ? rules[c] : c;
      }
      str = next;
    }
    return str;
  }

  // Turtle walk: returns array of polyline segments [[x,y], ...]
  function _turtleWalk(lstring, angle, stepLen) {
    var x = 0, y = 0, dir = -90;
    var stack = [];
    var segments = [];
    var cur = [[x, y]];
    var limit = Math.min(lstring.length, 80000);

    for (var i = 0; i < limit; i++) {
      var c = lstring[i];
      if (c === 'F' || c === 'G') {
        var rad = dir * Math.PI / 180;
        x += stepLen * Math.cos(rad);
        y += stepLen * Math.sin(rad);
        cur.push([x, y]);
      } else if (c === 'f') {
        var rad2 = dir * Math.PI / 180;
        x += stepLen * Math.cos(rad2);
        y += stepLen * Math.sin(rad2);
        if (cur.length > 1) segments.push(cur);
        cur = [[x, y]];
      } else if (c === '+') {
        dir += angle;
      } else if (c === '-') {
        dir -= angle;
      } else if (c === '[') {
        stack.push({ x: x, y: y, dir: dir, cur: cur });
        cur = [[x, y]];
      } else if (c === ']') {
        if (cur.length > 1) segments.push(cur);
        var state = stack.pop();
        x = state.x; y = state.y; dir = state.dir;
        cur = state.cur;
      }
    }
    if (cur.length > 1) segments.push(cur);
    return segments;
  }

  function _lsystemGenerate(comp, params) {
    var preset = PRESETS[params.preset] || PRESETS['Koch Snowflake'];
    var rules   = params.customRules  || preset.rules;
    var axiom   = params.customAxiom  || preset.axiom;
    var angle   = (params.angle !== undefined) ? params.angle : preset.angle;

    var lstring  = _lsystemExpand(axiom, rules, params.iterations || 4);
    var stepLen  = 10; // initial step, will be scaled
    var segments = _turtleWalk(lstring, angle, stepLen);

    if (segments.length === 0) return { error: 'No segments generated. Check axiom/rules.' };

    var layer = _segmentsToShapeLayer(comp, segments, params, 'L-System — ' + (params.preset || 'Custom'));
    _addTrimPaths(layer, params);
    return { segments: segments.length, chars: lstring.length, layer: layer.name };
  }

  // ── Spirograph ────────────────────────────────────────────────
  function _spirographGenerate(comp, params) {
    var R = params.outerRadius  || 100;
    var r = params.innerRadius  || 40;
    var d = params.penRadius    || 60;
    var steps = Math.max(params.steps || 720, 180);
    var revs  = _lcm(Math.abs(Math.round(R)), Math.abs(Math.round(r))) / Math.abs(Math.round(r));

    var points = [];
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * 2 * Math.PI * revs;
      // Epitrochoid
      var x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
      var y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
      points.push([x, y]);
    }

    var layer = _pointsToShapeLayer(comp, points, params, 'Spirograph');
    _addTrimPaths(layer, params);
    return { points: points.length, layer: layer.name };
  }

  // ── Shape Layer builders ──────────────────────────────────────

  function _segmentsToShapeLayer(comp, segments, params, name) {
    // Find bounding box
    var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (var i=0; i<segments.length; i++) {
      for (var j=0; j<segments[i].length; j++) {
        var p=segments[i][j];
        if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
        if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
      }
    }
    var bw = maxX-minX || 1, bh = maxY-minY || 1;
    var cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    var targetSize = params.size || Math.min(comp.width, comp.height) * 0.85;
    var scale = targetSize / Math.max(bw, bh);

    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = name;
    shapeLayer.moveToBeginning();
    var contents = shapeLayer.property('ADBE Root Vectors Group');

    var maxSegs = Math.min(segments.length, 500); // cap for performance
    for (var s=0; s<maxSegs; s++) {
      var seg = segments[s];
      if (seg.length < 2) continue;

      var grp = contents.addProperty('ADBE Vector Group');
      var grpC = grp.property('ADBE Vectors Group');
      var shapeProp = grpC.addProperty('ADBE Vector Shape - Group');

      var shape = new Shape();
      shape.closed = false;
      var verts=[],inT=[],outT=[];
      for (var p=0; p<seg.length; p++) {
        verts.push([(seg[p][0]-cx)*scale, (seg[p][1]-cy)*scale]);
        inT.push([0,0]); outT.push([0,0]);
      }
      shape.vertices=verts; shape.inTangents=inT; shape.outTangents=outT;
      shapeProp.property('ADBE Vector Shape').setValue(shape);

      var stroke = grpC.addProperty('ADBE Vector Graphic - Stroke');
      stroke.property('ADBE Vector Stroke Color').setValue(_hex(params.color || '#4d9fff'));
      stroke.property('ADBE Vector Stroke Width').setValue(params.strokeWidth || 1.5);
      stroke.property('ADBE Vector Stroke Line Cap').setValue(2);
    }
    return shapeLayer;
  }

  function _pointsToShapeLayer(comp, points, params, name) {
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(var i=0;i<points.length;i++){
      if(points[i][0]<minX)minX=points[i][0]; if(points[i][0]>maxX)maxX=points[i][0];
      if(points[i][1]<minY)minY=points[i][1]; if(points[i][1]>maxY)maxY=points[i][1];
    }
    var bw=maxX-minX||1,bh=maxY-minY||1;
    var cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    var targetSize = params.size || Math.min(comp.width,comp.height)*0.85;
    var scale = targetSize/Math.max(bw,bh);

    var shapeLayer=comp.layers.addShape();
    shapeLayer.name=name;
    shapeLayer.moveToBeginning();
    var contents=shapeLayer.property('ADBE Root Vectors Group');
    var grp=contents.addProperty('ADBE Vector Group');
    var grpC=grp.property('ADBE Vectors Group');
    var shapeProp=grpC.addProperty('ADBE Vector Shape - Group');
    var shape=new Shape();
    shape.closed=true;
    var verts=[],inT=[],outT=[];
    for(var j=0;j<points.length;j++){
      verts.push([(points[j][0]-cx)*scale,(points[j][1]-cy)*scale]);
      inT.push([0,0]); outT.push([0,0]);
    }
    shape.vertices=verts;shape.inTangents=inT;shape.outTangents=outT;
    shapeProp.property('ADBE Vector Shape').setValue(shape);
    var stroke=grpC.addProperty('ADBE Vector Graphic - Stroke');
    stroke.property('ADBE Vector Stroke Color').setValue(_hex(params.color||'#4d9fff'));
    stroke.property('ADBE Vector Stroke Width').setValue(params.strokeWidth||1.5);
    stroke.property('ADBE Vector Stroke Line Cap').setValue(2);
    return shapeLayer;
  }

  function _addTrimPaths(layer, params) {
    if (!params.animType || params.animType === 'none') return;
    var comp = layer.containingComp;
    var contents = layer.property('ADBE Root Vectors Group');
    var trim = contents.addProperty('ADBE Vector Filter - Trim');
    var dur = params.animDuration || 2;
    trim.property('ADBE Vector Trim End').setValueAtTime(comp.workAreaStart, 0);
    trim.property('ADBE Vector Trim End').setValueAtTime(comp.workAreaStart + dur, 100);
    var endProp = trim.property('ADBE Vector Trim End');
    endProp.setTemporalEaseAtKey(1, [new KeyframeEase(0,66)], [new KeyframeEase(0,66)]);
    endProp.setTemporalEaseAtKey(2, [new KeyframeEase(0,66)], [new KeyframeEase(0,66)]);
  }

  // ── Math helpers ──────────────────────────────────────────────
  function _gcd(a,b){ return b===0?a:_gcd(b,a%b); }
  function _lcm(a,b){ return (a*b)/_gcd(a,b); }
  function _hex(hex){
    if(!hex||hex.length<7)return[0.3,0.6,1,1];
    return[parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255,1];
  }

  return { generate: generate };
}());
```

---

## Task 2: UI Module — `js/plugins/patterns/ui.js`

- [ ] Create `js/plugins/patterns/ui.js`:

```javascript
'use strict';

window.PatternsUI = (function () {
  var _state = {
    patternType:  'lsystem',
    preset:       'Koch Snowflake',
    iterations:   4,
    angle:        60,
    customAxiom:  '',
    size:         0,        // 0 = auto (85% of comp min dimension)
    strokeWidth:  1.5,
    color:        '#a3e635',
    animType:     'draw',
    animDuration: 2,
    // spirograph
    outerRadius:  100,
    innerRadius:  40,
    penRadius:    60,
    steps:        720
  };

  function getParams()    { return Utils.deepClone(_state); }
  function applyPreset(p) {
    Object.assign(_state, p);
    _typeGroup.setValue(p.patternType);
    _presetDD.setValue(p.preset);
    _sliders.iterations.setValue(p.iterations);
    _sliders.angle.setValue(p.angle);
    _sliders.size.setValue(p.size);
    _sliders.strokeWidth.setValue(p.strokeWidth);
    _color.setValue(p.color);
    _animGroup.setValue(p.animType);
    _sliders.animDuration.setValue(p.animDuration);
    _sliders.outerRadius.setValue(p.outerRadius);
    _sliders.innerRadius.setValue(p.innerRadius);
    _sliders.penRadius.setValue(p.penRadius);
    _sliders.steps.setValue(p.steps);
    _updateSections(p.patternType);
  }

  var _sliders = {};
  var _typeGroup, _presetDD, _animGroup, _color;
  var _lsystemSection, _spiroSection, _status;

  function init(container) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Pattern Type'));
    _typeGroup = new ButtonGroup({
      options: [{ value: 'lsystem', label: 'L-System' }, { value: 'spirograph', label: 'Spirograph' }],
      value: 'lsystem',
      onChange: function (v) { _state.patternType = v; _updateSections(v); }
    });
    container.appendChild(_typeGroup.el);

    // ── L-System section ──────────────────────────────────
    _lsystemSection = Utils.el('div', {});
    _lsystemSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Preset'));
    _presetDD = new Dropdown({
      label: 'Pattern',
      tooltip: 'Choose a built-in L-System grammar',
      options: [
        { value: 'Koch Snowflake',      label: 'Koch Snowflake' },
        { value: 'Dragon Curve',        label: 'Dragon Curve' },
        { value: 'Sierpinski Triangle', label: 'Sierpinski Triangle' },
        { value: 'Plant',               label: 'Plant' },
        { value: 'Hilbert Curve',       label: 'Hilbert Curve' },
        { value: 'Levy C Curve',        label: 'Lévy C Curve' },
        { value: 'Gosper Curve',        label: 'Gosper Curve' }
      ],
      value: 'Koch Snowflake',
      onChange: function (v) { _state.preset = v; }
    });
    _sliders.iterations = new Slider({
      label: 'Iterations', min: 1, max: 7, value: 4, step: 1, defaultValue: 4,
      tooltip: 'More iterations = more detail but exponentially more segments. Above 5 can be slow.',
      onChange: function (v) { _state.iterations = v; }
    });
    _sliders.angle = new Slider({
      label: 'Angle °', min: 1, max: 180, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Turn angle for + and − turtle commands',
      onChange: function (v) { _state.angle = v; }
    });
    _lsystemSection.appendChild(_presetDD.el);
    _lsystemSection.appendChild(_sliders.iterations.el);
    _lsystemSection.appendChild(_sliders.angle.el);
    container.appendChild(_lsystemSection);

    // ── Spirograph section ────────────────────────────────
    _spiroSection = Utils.el('div', {});
    _spiroSection.style.display = 'none';
    _spiroSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Spirograph'));
    var spiroRow1 = Utils.el('div', { class: 'row-2' });
    _sliders.outerRadius = new Slider({ label: 'Outer R', min: 10, max: 300, value: 100, step: 1, defaultValue: 100, tooltip: 'Radius of the fixed outer circle', onChange: function(v){_state.outerRadius=v;} });
    _sliders.innerRadius = new Slider({ label: 'Inner R', min: 1,  max: 300, value: 40,  step: 1, defaultValue: 40,  tooltip: 'Radius of the rolling inner circle', onChange: function(v){_state.innerRadius=v;} });
    spiroRow1.appendChild(_sliders.outerRadius.el);
    spiroRow1.appendChild(_sliders.innerRadius.el);
    _sliders.penRadius = new Slider({ label: 'Pen Dist', min: 1, max: 400, value: 60, step: 1, defaultValue: 60, tooltip: 'Distance of the drawing point from inner circle center', onChange: function(v){_state.penRadius=v;} });
    _sliders.steps = new Slider({ label: 'Steps', min: 60, max: 2000, value: 720, step: 10, defaultValue: 720, tooltip: 'More steps = smoother curve', onChange: function(v){_state.steps=v;} });
    _spiroSection.appendChild(spiroRow1);
    _spiroSection.appendChild(_sliders.penRadius.el);
    _spiroSection.appendChild(_sliders.steps.el);
    container.appendChild(_spiroSection);

    // ── Appearance ────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Appearance'));
    var sizeStrokeRow = Utils.el('div', { class: 'row-2' });
    _sliders.size = new Slider({ label: 'Size px (0=auto)', min: 0, max: 2000, value: 0, step: 10, defaultValue: 0, tooltip: '0 = auto-fit to 85% of comp. Otherwise sets max dimension in pixels.', onChange: function(v){_state.size=v;} });
    _sliders.strokeWidth = new Slider({ label: 'Stroke px', min: 0.5, max: 20, value: 1.5, step: 0.5, decimals: 1, defaultValue: 1.5, onChange: function(v){_state.strokeWidth=v;} });
    sizeStrokeRow.appendChild(_sliders.size.el);
    sizeStrokeRow.appendChild(_sliders.strokeWidth.el);
    container.appendChild(sizeStrokeRow);
    _color = new ColorPicker({ label: 'Stroke Color', value: '#a3e635', onChange: function(v){_state.color=v;} });
    container.appendChild(_color.el);

    // ── Animation ─────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
    _animGroup = new ButtonGroup({
      options: [{ value: 'none', label: 'None' }, { value: 'draw', label: 'Draw On' }],
      value: 'draw',
      tooltip: 'Draw On uses Trim Paths to animate the pattern being drawn',
      onChange: function (v) { _state.animType = v; }
    });
    _sliders.animDuration = new Slider({ label: 'Duration (s)', min: 0.5, max: 10, value: 2, step: 0.5, decimals: 1, defaultValue: 2, onChange: function(v){_state.animDuration=v;} });
    container.appendChild(_animGroup.el);
    container.appendChild(_sliders.animDuration.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Pattern');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _updateSections(type) {
    _lsystemSection.style.display = type === 'lsystem'    ? '' : 'none';
    _spiroSection.style.display   = type === 'spirograph' ? '' : 'none';
  }

  function _apply(btn) {
    btn.disabled=true; btn.textContent='Generating…';
    _status.className='status-bar'; _status.textContent='';
    Bridge.call('patterns.generate', getParams()).then(function(r){
      btn.disabled=false; btn.textContent='Generate Pattern';
      if(r.error){_status.className='status-bar error';_status.textContent=r.error;}
      else{_status.className='status-bar success';_status.textContent='Pattern created — '+r.layer;}
    }).catch(function(e){
      btn.disabled=false; btn.textContent='Generate Pattern';
      _status.className='status-bar error';_status.textContent=e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());
```

---

## Task 3: Factory Presets — add `patterns` block to `js/factory-presets.js`

- [ ] Add this block:

```javascript
  patterns: {
    'Koch Snowflake':      { patternType:'lsystem', preset:'Koch Snowflake',      iterations:4, angle:60,  customAxiom:'', size:0, strokeWidth:1.5, color:'#a3e635', animType:'draw', animDuration:3, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Dragon Curve':        { patternType:'lsystem', preset:'Dragon Curve',        iterations:10,angle:90,  customAxiom:'', size:0, strokeWidth:1,   color:'#f87171', animType:'draw', animDuration:4, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Sierpinski':          { patternType:'lsystem', preset:'Sierpinski Triangle', iterations:5, angle:120, customAxiom:'', size:0, strokeWidth:1.2, color:'#38bdf8', animType:'draw', animDuration:3, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Forest Plant':        { patternType:'lsystem', preset:'Plant',               iterations:5, angle:25,  customAxiom:'', size:0, strokeWidth:1,   color:'#4ade80', animType:'draw', animDuration:5, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Classic Spirograph':  { patternType:'spirograph', preset:'Koch Snowflake',   iterations:4, angle:60,  customAxiom:'', size:0, strokeWidth:1.5, color:'#e879f9', animType:'draw', animDuration:3, outerRadius:100, innerRadius:37, penRadius:90, steps:1080 },
    'Star Spirograph':     { patternType:'spirograph', preset:'Koch Snowflake',   iterations:4, angle:60,  customAxiom:'', size:0, strokeWidth:1,   color:'#fbbf24', animType:'draw', animDuration:2, outerRadius:100, innerRadius:25, penRadius:70, steps:900 }
  },
```

---

## Task 4: Verify

- [ ] Open `preview.html`. Click **Patt** tab. Confirm L-System and Spirograph sections.
- [ ] Switch to Spirograph — confirm L-System section hides, Spirograph shows.
- [ ] Click **Generate Pattern** — confirm success with layer name.
- [ ] Commit:

```bash
git add jsx/patterns.jsx js/plugins/patterns/ui.js js/factory-presets.js
git commit -m "feat: add Pattern Pro — L-Systems (7 presets) + spirograph generator"
```

---

## Next

→ Continue with `2026-05-28-physics-rig.md`

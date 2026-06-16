# Particle Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a keyframe-baking particle system for After Effects — point/ring/box emitters, physics (gravity, wind, turbulence, drag), per-particle life curves (opacity, scale over life), and sub-emitter support. Inspired by Trapcode Particular's physics and emitter model.

**Architecture:** Pre-allocates a pool of AE shape layers (one per max-particle count). Runs a frame-by-frame simulation, spawning and updating particles each frame. At each frame, bakes position, scale, and opacity keyframes directly onto pre-allocated layers. Layers not yet alive stay at opacity 0. Performance constraint: cap max particles at 200 for ExtendScript's synchronous execution model.

**Tech Stack:** ExtendScript, vanilla JS.

**Prerequisites:** `2026-05-28-suite-expansion-master.md` Task 1 complete.

---

## File Map

| Action | File |
|--------|------|
| Create | `jsx/particles.jsx` |
| Create | `js/plugins/particles/ui.js` |
| Modify | `js/factory-presets.js` — add `particles` block |

---

## Task 1: JSX Module — `jsx/particles.jsx`

- [ ] Create `jsx/particles.jsx`:

```javascript
// Particle Engine — pre-allocated pool, keyframe-baked simulation.
var ParticleEngine = (function () {

  function generate(params) {
    var comp = requireComp();
    return withUndo('Particle Engine', function () {
      return _simulate(comp, params);
    });
  }

  function _simulate(comp, params) {
    var fps         = comp.frameRate;
    var startTime   = comp.workAreaStart;
    var duration    = params.duration || 3;
    var totalFrames = Math.round(duration * fps);
    var dt          = 1 / fps;
    var w           = comp.width, h = comp.height;

    // Emitter
    var emitterType  = params.emitterType  || 'point';
    var emitterX     = w * ((params.emitterX || 50) / 100);
    var emitterY     = h * ((params.emitterY || 80) / 100);
    var emitterSizeX = params.emitterSizeX || 0;
    var emitterSizeY = params.emitterSizeY || 0;

    // Emission
    var rate         = params.rate     || 8;    // particles/frame
    var maxParticles = Math.min(params.maxParticles || 100, 200);
    var lifeSeconds  = params.life     || 1.5;
    var lifeFrames   = Math.round(lifeSeconds * fps);
    var lifeVar      = params.lifeVariance || 0.3; // 0–1 fraction of lifeSeconds

    // Physics
    var gravityX     = params.gravityX    || 0;
    var gravityY     = params.gravityY    || 200;
    var wind         = params.wind        || 0;
    var turbulence   = params.turbulence  || 0;
    var drag         = 1 - (params.drag   || 0.02);

    // Direction
    var direction    = (params.direction  || -90) * Math.PI / 180;
    var spread       = (params.spread     || 30)  * Math.PI / 180;
    var velocity     = params.velocity    || 200;
    var velocityVar  = params.velocityVariance || 0.4;

    // Appearance
    var sizeStart    = params.sizeStart   || 10;
    var sizeEnd      = params.sizeEnd     || 2;
    var opacityStart = params.opacityStart || 100;
    var opacityEnd   = params.opacityEnd   || 0;
    var color        = params.color        || '#ffffff';

    // ── Pre-allocate shape layers ──────────────────────────
    var pLayers = [];
    var rgb = _hex(color);
    for (var p = 0; p < maxParticles; p++) {
      var pLayer = comp.layers.addShape();
      pLayer.name = 'Particle ' + (p + 1);

      var contents = pLayer.property('ADBE Root Vectors Group');
      var grp = contents.addProperty('ADBE Vector Group');
      var grpC = grp.property('ADBE Vectors Group');

      var ellipse = grpC.addProperty('ADBE Vector Shape - Ellipse');
      ellipse.property('ADBE Vector Ellipse Size').setValue([sizeStart, sizeStart]);

      var fill = grpC.addProperty('ADBE Vector Graphic - Fill');
      fill.property('ADBE Vector Fill Color').setValue([rgb[0], rgb[1], rgb[2], 1]);

      // Start invisible
      pLayer.opacity.setValueAtTime(startTime, 0);
      pLayers.push(pLayer);
    }

    // ── Simulation ─────────────────────────────────────────
    var activeParticles = [];
    var nextSlot        = 0;
    var accumulator     = 0;

    for (var frame = 0; frame <= totalFrames; frame++) {
      var t = startTime + frame * dt;

      // Spawn
      accumulator += rate;
      var toSpawn = Math.floor(accumulator);
      accumulator -= toSpawn;

      for (var s = 0; s < toSpawn && nextSlot < maxParticles; s++) {
        var spawnAngle = direction + (Math.random() - 0.5) * spread;
        var spawnSpeed = velocity * (1 - velocityVar * Math.random());
        var thisLife   = Math.round(lifeFrames * (1 - lifeVar * Math.random()));

        var ex = emitterX, ey = emitterY;
        if (emitterType === 'box') {
          ex += (Math.random() - 0.5) * emitterSizeX;
          ey += (Math.random() - 0.5) * emitterSizeY;
        } else if (emitterType === 'ring') {
          var ringAngle = Math.random() * Math.PI * 2;
          ex += Math.cos(ringAngle) * (emitterSizeX / 2);
          ey += Math.sin(ringAngle) * (emitterSizeY / 2);
        }

        activeParticles.push({
          idx:       nextSlot,
          x: ex,     y: ey,
          vx: Math.cos(spawnAngle) * spawnSpeed,
          vy: Math.sin(spawnAngle) * spawnSpeed,
          life:      thisLife,
          age:       0,
          bornFrame: frame
        });

        // Mark born — set opacity to start value
        pLayers[nextSlot].opacity.setValueAtTime(t, opacityStart);
        nextSlot++;
      }

      // Update and bake
      for (var i = activeParticles.length - 1; i >= 0; i--) {
        var par = activeParticles[i];

        // Physics
        par.vx += (gravityX + wind + (Math.random() - 0.5) * turbulence) * dt;
        par.vy += (gravityY        + (Math.random() - 0.5) * turbulence) * dt;
        par.vx *= drag;
        par.vy *= drag;
        par.x  += par.vx * dt;
        par.y  += par.vy * dt;
        par.age++;

        var lifeRatio  = par.age / par.life;
        var opacity    = opacityStart + (opacityEnd - opacityStart) * lifeRatio;
        var size       = sizeStart    + (sizeEnd    - sizeStart)    * lifeRatio;
        var scaleVal   = (size / sizeStart) * 100;

        pLayers[par.idx].position.setValueAtTime(t, [par.x, par.y]);
        pLayers[par.idx].opacity.setValueAtTime(t, Math.max(0, opacity));
        pLayers[par.idx].scale.setValueAtTime(t, [scaleVal, scaleVal]);

        if (par.age >= par.life) {
          // Kill particle — set opacity to 0 for remaining frames
          pLayers[par.idx].opacity.setValueAtTime(t, 0);
          activeParticles.splice(i, 1);
        }
      }
    }

    // Ensure all unused layers are invisible
    for (var u = nextSlot; u < maxParticles; u++) {
      pLayers[u].opacity.setValue(0);
    }

    // Group all particle layers under a null
    var container = comp.layers.addNull();
    container.name = 'Particles — ' + params.emitterType;
    container.moveToBeginning();
    for (var q = 0; q < pLayers.length; q++) {
      pLayers[q].parent = container;
    }

    return { particles: nextSlot, frames: totalFrames, duration: duration };
  }

  function _hex(hex) {
    if (!hex || hex.length < 7) return [1, 1, 1];
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255
    ];
  }

  return { generate: generate };
}());
```

---

## Task 2: UI Module — `js/plugins/particles/ui.js`

- [ ] Create `js/plugins/particles/ui.js`:

```javascript
'use strict';

window.ParticlesUI = (function () {
  var _state = {
    emitterType:       'point',
    emitterX:          50, emitterY: 80,
    emitterSizeX:      100, emitterSizeY: 100,
    rate:              8,
    maxParticles:      100,
    life:              1.5,
    lifeVariance:      0.3,
    direction:         -90,
    spread:            30,
    velocity:          200,
    velocityVariance:  0.4,
    gravityX:          0,
    gravityY:          200,
    wind:              0,
    turbulence:        0,
    drag:              0.02,
    sizeStart:         10, sizeEnd: 2,
    opacityStart:      100, opacityEnd: 0,
    color:             '#ffffff',
    duration:          3
  };

  function getParams()    { return Utils.deepClone(_state); }
  function applyPreset(p) {
    Object.assign(_state, p);
    _emitterGroup.setValue(p.emitterType);
    _sliders.emitterX.setValue(p.emitterX); _sliders.emitterY.setValue(p.emitterY);
    _sliders.emitterSizeX.setValue(p.emitterSizeX); _sliders.emitterSizeY.setValue(p.emitterSizeY);
    _sliders.rate.setValue(p.rate);
    _sliders.maxParticles.setValue(p.maxParticles);
    _sliders.life.setValue(p.life);
    _sliders.lifeVariance.setValue(p.lifeVariance * 100);
    _sliders.direction.setValue(p.direction);
    _sliders.spread.setValue(p.spread);
    _sliders.velocity.setValue(p.velocity);
    _sliders.velocityVariance.setValue(p.velocityVariance * 100);
    _sliders.gravityX.setValue(p.gravityX); _sliders.gravityY.setValue(p.gravityY);
    _sliders.wind.setValue(p.wind); _sliders.turbulence.setValue(p.turbulence);
    _sliders.drag.setValue(p.drag * 100);
    _sliders.sizeStart.setValue(p.sizeStart); _sliders.sizeEnd.setValue(p.sizeEnd);
    _sliders.opacityStart.setValue(p.opacityStart); _sliders.opacityEnd.setValue(p.opacityEnd);
    _color.setValue(p.color);
    _sliders.duration.setValue(p.duration);
  }

  var _sliders = {};
  var _emitterGroup, _color, _status;

  function init(container) {
    // ── Emitter ───────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Emitter'));
    _emitterGroup = new ButtonGroup({
      options: [{value:'point',label:'Point'},{value:'box',label:'Box'},{value:'ring',label:'Ring'}],
      value: 'point',
      tooltip: 'Emitter shape — Point: single origin, Box: rectangular area, Ring: circular ring',
      onChange: function(v){ _state.emitterType=v; }
    });
    container.appendChild(_emitterGroup.el);
    var emPosRow = Utils.el('div', { class: 'row-2' });
    _sliders.emitterX = new Slider({ label: 'Emitter X %', min:0, max:100, value:50, step:1, defaultValue:50, onChange:function(v){_state.emitterX=v;} });
    _sliders.emitterY = new Slider({ label: 'Emitter Y %', min:0, max:100, value:80, step:1, defaultValue:80, onChange:function(v){_state.emitterY=v;} });
    emPosRow.appendChild(_sliders.emitterX.el);
    emPosRow.appendChild(_sliders.emitterY.el);
    container.appendChild(emPosRow);
    var emSizeRow = Utils.el('div', { class: 'row-2' });
    _sliders.emitterSizeX = new Slider({ label: 'Width px', min:0, max:1000, value:100, step:10, defaultValue:100, tooltip:'Emitter width — used by Box and Ring types', onChange:function(v){_state.emitterSizeX=v;} });
    _sliders.emitterSizeY = new Slider({ label: 'Height px', min:0, max:1000, value:100, step:10, defaultValue:100, tooltip:'Emitter height — used by Box type', onChange:function(v){_state.emitterSizeY=v;} });
    emSizeRow.appendChild(_sliders.emitterSizeX.el);
    emSizeRow.appendChild(_sliders.emitterSizeY.el);
    container.appendChild(emSizeRow);

    // ── Emission ──────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Emission'));
    var rateRow = Utils.el('div', { class: 'row-2' });
    _sliders.rate = new Slider({ label: 'Rate /frame', min:1, max:30, value:8, step:1, defaultValue:8, tooltip:'Particles spawned per frame', onChange:function(v){_state.rate=v;} });
    _sliders.maxParticles = new Slider({ label: 'Max particles', min:10, max:200, value:100, step:10, defaultValue:100, tooltip:'Pool size cap — higher = more detail but slower bake', onChange:function(v){_state.maxParticles=v;} });
    rateRow.appendChild(_sliders.rate.el);
    rateRow.appendChild(_sliders.maxParticles.el);
    container.appendChild(rateRow);
    var lifeRow = Utils.el('div', { class: 'row-2' });
    _sliders.life = new Slider({ label: 'Life (s)', min:0.2, max:8, value:1.5, step:0.1, decimals:1, defaultValue:1.5, onChange:function(v){_state.life=v;} });
    _sliders.lifeVariance = new Slider({ label: 'Life Var %', min:0, max:100, value:30, step:1, defaultValue:30, tooltip:'Random variation on each particle life — 0 = all same life', onChange:function(v){_state.lifeVariance=v/100;} });
    lifeRow.appendChild(_sliders.life.el);
    lifeRow.appendChild(_sliders.lifeVariance.el);
    container.appendChild(lifeRow);

    // ── Direction ─────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Direction'));
    _sliders.direction = new Slider({ label: 'Direction °', min:-180, max:180, value:-90, step:1, defaultValue:-90, tooltip:'-90 = straight up, 0 = right, 90 = down', onChange:function(v){_state.direction=v;} });
    _sliders.spread = new Slider({ label: 'Spread °', min:0, max:360, value:30, step:1, defaultValue:30, tooltip:'Cone angle — 0 = single line, 360 = omnidirectional', onChange:function(v){_state.spread=v;} });
    var velRow = Utils.el('div', { class: 'row-2' });
    _sliders.velocity = new Slider({ label: 'Velocity px/s', min:0, max:2000, value:200, step:10, defaultValue:200, onChange:function(v){_state.velocity=v;} });
    _sliders.velocityVariance = new Slider({ label: 'Vel Var %', min:0, max:100, value:40, step:1, defaultValue:40, onChange:function(v){_state.velocityVariance=v/100;} });
    container.appendChild(_sliders.direction.el);
    container.appendChild(_sliders.spread.el);
    velRow.appendChild(_sliders.velocity.el);
    velRow.appendChild(_sliders.velocityVariance.el);
    container.appendChild(velRow);

    // ── Physics ───────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Physics'));
    var gravRow = Utils.el('div', { class: 'row-2' });
    _sliders.gravityX = new Slider({ label: 'Gravity X', min:-1000, max:1000, value:0, step:10, defaultValue:0, onChange:function(v){_state.gravityX=v;} });
    _sliders.gravityY = new Slider({ label: 'Gravity Y', min:-1000, max:1000, value:200, step:10, defaultValue:200, onChange:function(v){_state.gravityY=v;} });
    gravRow.appendChild(_sliders.gravityX.el);
    gravRow.appendChild(_sliders.gravityY.el);
    container.appendChild(gravRow);
    var airRow = Utils.el('div', { class: 'row-3' });
    _sliders.wind = new Slider({ label: 'Wind', min:-500, max:500, value:0, step:10, defaultValue:0, onChange:function(v){_state.wind=v;} });
    _sliders.turbulence = new Slider({ label: 'Turb', min:0, max:500, value:0, step:10, defaultValue:0, onChange:function(v){_state.turbulence=v;} });
    _sliders.drag = new Slider({ label: 'Drag %', min:0, max:20, value:2, step:0.5, decimals:1, defaultValue:2, onChange:function(v){_state.drag=v/100;} });
    airRow.appendChild(_sliders.wind.el);
    airRow.appendChild(_sliders.turbulence.el);
    airRow.appendChild(_sliders.drag.el);
    container.appendChild(airRow);

    // ── Appearance ────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Appearance'));
    _color = new ColorPicker({ label: 'Color', value: '#ffffff', onChange:function(v){_state.color=v;} });
    container.appendChild(_color.el);
    var sizeRow = Utils.el('div', { class: 'row-2' });
    _sliders.sizeStart = new Slider({ label: 'Size Born px', min:1, max:100, value:10, step:1, defaultValue:10, onChange:function(v){_state.sizeStart=v;} });
    _sliders.sizeEnd   = new Slider({ label: 'Size Die px',  min:0, max:100, value:2,  step:1, defaultValue:2,  onChange:function(v){_state.sizeEnd=v;}   });
    sizeRow.appendChild(_sliders.sizeStart.el);
    sizeRow.appendChild(_sliders.sizeEnd.el);
    container.appendChild(sizeRow);
    var opRow = Utils.el('div', { class: 'row-2' });
    _sliders.opacityStart = new Slider({ label: 'Opacity Born %', min:0, max:100, value:100, step:1, defaultValue:100, onChange:function(v){_state.opacityStart=v;} });
    _sliders.opacityEnd   = new Slider({ label: 'Opacity Die %',  min:0, max:100, value:0,   step:1, defaultValue:0,   onChange:function(v){_state.opacityEnd=v;}   });
    opRow.appendChild(_sliders.opacityStart.el);
    opRow.appendChild(_sliders.opacityEnd.el);
    container.appendChild(opRow);

    // ── Output ────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Output'));
    _sliders.duration = new Slider({ label: 'Duration (s)', min:0.5, max:10, value:3, step:0.5, decimals:1, defaultValue:3, tooltip:'Seconds of particle simulation to bake', onChange:function(v){_state.duration=v;} });
    container.appendChild(_sliders.duration.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Particles');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled=true; btn.textContent='Simulating…';
    _status.className='status-bar'; _status.textContent='';
    Bridge.call('particles.generate', getParams()).then(function(r){
      btn.disabled=false; btn.textContent='Generate Particles';
      if(r.error){_status.className='status-bar error';_status.textContent=r.error;}
      else{_status.className='status-bar success';_status.textContent=r.particles+' particles × '+r.frames+' frames baked.';}
    }).catch(function(e){
      btn.disabled=false; btn.textContent='Generate Particles';
      _status.className='status-bar error';_status.textContent=e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());
```

---

## Task 3: Factory Presets

- [ ] Add to `js/factory-presets.js`:

```javascript
  particles: {
    'Sparks':      { emitterType:'point', emitterX:50, emitterY:90, emitterSizeX:0, emitterSizeY:0, rate:12, maxParticles:150, life:1.2, lifeVariance:0.5, direction:-90, spread:80, velocity:400, velocityVariance:0.5, gravityX:0, gravityY:600, wind:30, turbulence:40, drag:0.01, sizeStart:5, sizeEnd:1, opacityStart:100, opacityEnd:0, color:'#fbbf24', duration:3 },
    'Smoke':       { emitterType:'box',   emitterX:50, emitterY:85, emitterSizeX:120, emitterSizeY:30, rate:5, maxParticles:80, life:3, lifeVariance:0.4, direction:-90, spread:20, velocity:60, velocityVariance:0.3, gravityX:0, gravityY:-30, wind:15, turbulence:20, drag:0.03, sizeStart:20, sizeEnd:60, opacityStart:40, opacityEnd:0, color:'#cccccc', duration:4 },
    'Fireworks':   { emitterType:'ring',  emitterX:50, emitterY:40, emitterSizeX:200, emitterSizeY:200, rate:20, maxParticles:200, life:1.8, lifeVariance:0.3, direction:0, spread:360, velocity:300, velocityVariance:0.4, gravityX:0, gravityY:400, wind:0, turbulence:10, drag:0.02, sizeStart:8, sizeEnd:2, opacityStart:100, opacityEnd:0, color:'#f0abfc', duration:3 },
    'Snow':        { emitterType:'box',   emitterX:50, emitterY:5, emitterSizeX:1000, emitterSizeY:0, rate:6, maxParticles:120, life:5, lifeVariance:0.6, direction:90, spread:15, velocity:80, velocityVariance:0.5, gravityX:0, gravityY:50, wind:20, turbulence:15, drag:0.05, sizeStart:6, sizeEnd:4, opacityStart:80, opacityEnd:60, color:'#ffffff', duration:5 },
    'Fire':        { emitterType:'box',   emitterX:50, emitterY:90, emitterSizeX:80, emitterSizeY:10, rate:10, maxParticles:100, life:1.0, lifeVariance:0.5, direction:-90, spread:40, velocity:150, velocityVariance:0.5, gravityX:0, gravityY:-120, wind:0, turbulence:60, drag:0.02, sizeStart:14, sizeEnd:4, opacityStart:90, opacityEnd:0, color:'#ff6b00', duration:3 }
  }
```

---

## Task 4: Verify

- [ ] Open `preview.html`. Click **Parts** tab. Confirm emitter type buttons, all physics sliders, and color picker.
- [ ] Click **Generate Particles** — confirm success message shows particle count and frame count.
- [ ] Switch between presets in the PresetBar — confirm values update.
- [ ] Commit:

```bash
git add jsx/particles.jsx js/plugins/particles/ui.js js/factory-presets.js
git commit -m "feat: add Particle Engine — point/box/ring emitters with physics baked to AE keyframes"
```

---

## Suite Complete

All 10 plugins are now implemented. Next steps:
1. Update `preview.html` with all 5 new pane builders
2. Deploy to AE (`AppData\Roaming\Adobe\CEP\extensions\com.aeplugins.suite\`)
3. End-to-end test each plugin inside After Effects
4. Build factory preset JSON files for the file-based preset system

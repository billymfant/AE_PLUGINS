# Physics Rig — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simulate 2D rigid-body physics on selected AE layers — gravity, bounce, friction, wall collisions, and body-body collisions — then bake the result as position keyframes directly on those layers. Inspired by Newton (2D-only mode).

**Architecture:** Reads current position of each selected layer at work-area start. Runs a Verlet-integration simulation loop for every frame in the work area. At each frame, writes position (and optionally rotation) keyframes to each layer. No new layers are created — existing layers are animated in place. Springs between pairs of layers are expressed as AE expressions after baking.

**Tech Stack:** ExtendScript, vanilla JS.

**Prerequisites:** `2026-05-28-suite-expansion-master.md` Task 1 complete.

---

## File Map

| Action | File |
|--------|------|
| Create | `jsx/physics.jsx` |
| Create | `js/plugins/physics/ui.js` |
| Modify | `js/factory-presets.js` — add `physics` block |

---

## Task 1: JSX Module — `jsx/physics.jsx`

- [ ] Create `jsx/physics.jsx`:

```javascript
// Physics Rig — Verlet simulation baked to AE position keyframes.
var PhysicsRig = (function () {

  function simulate(params) {
    var comp = requireComp();
    return withUndo('Physics Rig', function () {
      return _run(comp, params);
    });
  }

  function _run(comp, params) {
    // Collect selected layers
    var layers = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layers[i].selected) layers.push(comp.layers[i]);
    }
    if (layers.length === 0) {
      return { error: 'Select the layers to simulate, then click Simulate.' };
    }

    var fps         = comp.frameRate;
    var startTime   = comp.workAreaStart;
    var duration    = params.duration || (comp.workAreaDuration || 3);
    var totalFrames = Math.round(duration * fps);
    var dt          = 1 / fps;
    var w           = comp.width;
    var h           = comp.height;

    // Physics parameters
    var gx          = params.gravityX    || 0;
    var gy          = params.gravityY    || 980;  // px/s²
    var bounce      = params.bounce      || 0.55;
    var friction    = 1 - (params.friction  || 0.01);
    var groundFric  = 1 - (params.groundFriction || 0.15);
    var groundY     = (params.groundY !== undefined) ? params.groundY : h * 0.92;
    var wallBounce  = params.wallBounce  || false;

    // Build body list from current layer state
    var bodies = [];
    for (var l = 0; l < layers.length; l++) {
      var layer = layers[l];
      var pos   = layer.position.valueAtTime(startTime, false);
      var lw    = (layer.sourceRectAtTime ? layer.sourceRectAtTime(startTime, false).width  : 100) * (layer.scale.value[0] / 100);
      var lh    = (layer.sourceRectAtTime ? layer.sourceRectAtTime(startTime, false).height : 100) * (layer.scale.value[1] / 100);
      bodies.push({
        layer:  layer,
        x:      pos[0],
        y:      pos[1],
        vx:     params.initialVelX || 0,
        vy:     params.initialVelY || 0,
        mass:   params.mass        || 1,
        rx:     lw / 2,  // half-width for AABB collision
        ry:     lh / 2,
        angle:  0,
        omega:  0         // angular velocity
      });
    }

    // Simulation loop
    for (var frame = 0; frame <= totalFrames; frame++) {
      var t = startTime + frame * dt;

      // ── Broad-pass: apply forces ────────────────────────
      for (var b = 0; b < bodies.length; b++) {
        var body = bodies[b];

        body.vx += gx * dt;
        body.vy += gy * dt;

        // Air drag
        body.vx *= friction;
        body.vy *= friction;

        // Integrate position
        body.x += body.vx * dt;
        body.y += body.vy * dt;

        // Integrate rotation (angular drag)
        body.omega *= 0.98;
        body.angle  += body.omega * dt;

        // ── Ground collision ────────────────────────────
        if (body.y + body.ry >= groundY) {
          body.y  = groundY - body.ry;
          body.vy = -Math.abs(body.vy) * bounce;
          body.vx *= groundFric;
          body.omega += body.vx * 0.005; // rolling torque
          if (Math.abs(body.vy) < 5) body.vy = 0; // rest threshold
        }

        // ── Wall collisions ─────────────────────────────
        if (wallBounce) {
          if (body.x - body.rx < 0) {
            body.x  = body.rx;
            body.vx = Math.abs(body.vx) * bounce;
            body.omega -= body.vy * 0.003;
          }
          if (body.x + body.rx > w) {
            body.x  = w - body.rx;
            body.vx = -Math.abs(body.vx) * bounce;
            body.omega += body.vy * 0.003;
          }
          if (body.y - body.ry < 0) {
            body.y  = body.ry;
            body.vy = Math.abs(body.vy) * bounce;
          }
        }
      }

      // ── Narrow-pass: body-body AABB collisions ──────────
      for (var a = 0; a < bodies.length - 1; a++) {
        for (var c = a + 1; c < bodies.length; c++) {
          var ba = bodies[a], bc = bodies[c];
          var dx = bc.x - ba.x, dy = bc.y - ba.y;
          var overlapX = (ba.rx + bc.rx) - Math.abs(dx);
          var overlapY = (ba.ry + bc.ry) - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            // Push apart on smallest overlap axis
            if (overlapX < overlapY) {
              var sepX = overlapX * 0.5 * (dx > 0 ? 1 : -1);
              ba.x -= sepX; bc.x += sepX;
              var rv = ba.vx - bc.vx;
              ba.vx -= rv * bounce * 0.5;
              bc.vx += rv * bounce * 0.5;
            } else {
              var sepY = overlapY * 0.5 * (dy > 0 ? 1 : -1);
              ba.y -= sepY; bc.y += sepY;
              var rvy = ba.vy - bc.vy;
              ba.vy -= rvy * bounce * 0.5;
              bc.vy += rvy * bounce * 0.5;
            }
          }
        }
      }

      // ── Bake keyframes at this time ─────────────────────
      for (var k = 0; k < bodies.length; k++) {
        var bd = bodies[k];
        bd.layer.position.setValueAtTime(t, [bd.x, bd.y]);
        if (params.simulateRotation) {
          bd.layer.rotation.setValueAtTime(t, bd.angle * 180 / Math.PI);
        }
      }
    }

    return { layers: bodies.length, frames: totalFrames, duration: duration };
  }

  return { simulate: simulate };
}());
```

---

## Task 2: UI Module — `js/plugins/physics/ui.js`

- [ ] Create `js/plugins/physics/ui.js`:

```javascript
'use strict';

window.PhysicsUI = (function () {
  var _state = {
    duration:          3,
    gravityX:          0,
    gravityY:          980,
    bounce:            0.55,
    friction:          0.01,
    groundFriction:    0.15,
    groundY:           -1,      // -1 = auto (92% of comp height)
    mass:              1,
    initialVelX:       0,
    initialVelY:       -200,
    wallBounce:        true,
    simulateRotation:  true
  };

  function getParams() {
    return Utils.deepClone(_state);
  }

  function applyPreset(p) {
    Object.assign(_state, p);
    _sliders.duration.setValue(p.duration);
    _sliders.gravityX.setValue(p.gravityX);
    _sliders.gravityY.setValue(p.gravityY);
    _sliders.bounce.setValue(p.bounce * 100);
    _sliders.friction.setValue(p.friction * 100);
    _sliders.groundFriction.setValue(p.groundFriction * 100);
    _sliders.mass.setValue(p.mass);
    _sliders.initialVelX.setValue(p.initialVelX);
    _sliders.initialVelY.setValue(p.initialVelY);
    _wallBounceToggle.setValue(p.wallBounce);
    _rotationToggle.setValue(p.simulateRotation);
  }

  var _sliders = {};
  var _wallBounceToggle, _rotationToggle, _status;

  function init(container) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Gravity'));
    var gravRow = Utils.el('div', { class: 'row-2' });
    _sliders.gravityX = new Slider({ label: 'X px/s²', min: -2000, max: 2000, value: 0, step: 10, defaultValue: 0, tooltip: 'Horizontal gravity component — positive = right', onChange: function(v){_state.gravityX=v;} });
    _sliders.gravityY = new Slider({ label: 'Y px/s²', min: -2000, max: 2000, value: 980, step: 10, defaultValue: 980, tooltip: 'Vertical gravity — 980 = Earth-like. Negative = upward.', onChange: function(v){_state.gravityY=v;} });
    gravRow.appendChild(_sliders.gravityX.el);
    gravRow.appendChild(_sliders.gravityY.el);
    container.appendChild(gravRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Material'));
    _sliders.bounce = new Slider({ label: 'Bounce %', min: 0, max: 100, value: 55, step: 1, defaultValue: 55, tooltip: 'Coefficient of restitution — 0 = no bounce, 100 = perfect bounce', onChange: function(v){_state.bounce=v/100;} });
    _sliders.friction = new Slider({ label: 'Air Friction %', min: 0, max: 20, value: 1, step: 0.5, decimals: 1, defaultValue: 1, tooltip: 'Velocity damping per frame from air resistance', onChange: function(v){_state.friction=v/100;} });
    _sliders.groundFriction = new Slider({ label: 'Ground Friction %', min: 0, max: 80, value: 15, step: 1, defaultValue: 15, tooltip: 'Extra horizontal damping applied on ground contact', onChange: function(v){_state.groundFriction=v/100;} });
    _sliders.mass = new Slider({ label: 'Mass', min: 0.1, max: 10, value: 1, step: 0.1, decimals: 1, defaultValue: 1, tooltip: 'Relative mass — affects collision response force', onChange: function(v){_state.mass=v;} });
    container.appendChild(_sliders.bounce.el);
    container.appendChild(_sliders.friction.el);
    container.appendChild(_sliders.groundFriction.el);
    container.appendChild(_sliders.mass.el);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Initial Velocity'));
    var velRow = Utils.el('div', { class: 'row-2' });
    _sliders.initialVelX = new Slider({ label: 'Vel X px/s', min: -2000, max: 2000, value: 0, step: 10, defaultValue: 0, onChange: function(v){_state.initialVelX=v;} });
    _sliders.initialVelY = new Slider({ label: 'Vel Y px/s', min: -2000, max: 2000, value: -200, step: 10, defaultValue: -200, tooltip: 'Negative = upward launch velocity', onChange: function(v){_state.initialVelY=v;} });
    velRow.appendChild(_sliders.initialVelX.el);
    velRow.appendChild(_sliders.initialVelY.el);
    container.appendChild(velRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Simulation'));
    _sliders.duration = new Slider({ label: 'Duration (s)', min: 0.5, max: 10, value: 3, step: 0.5, decimals: 1, defaultValue: 3, tooltip: 'Seconds of physics to bake as keyframes', onChange: function(v){_state.duration=v;} });
    _wallBounceToggle = new Toggle({ label: 'Bounce off walls', value: true, tooltip: 'Layers bounce off left/right/top edges of the composition', onChange: function(v){_state.wallBounce=v;} });
    _rotationToggle = new Toggle({ label: 'Simulate rotation', value: true, tooltip: 'Bakes rotation keyframes based on angular momentum from collisions', onChange: function(v){_state.simulateRotation=v;} });
    container.appendChild(_sliders.duration.el);
    container.appendChild(_wallBounceToggle.el);
    container.appendChild(_rotationToggle.el);

    container.appendChild(Utils.el('div', { class: 'help-text' }, 'Select the layers you want to simulate, then click Simulate.'));

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Simulate Physics');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled=true; btn.textContent='Simulating…';
    _status.className='status-bar'; _status.textContent='';
    Bridge.call('physics.simulate', getParams()).then(function(r){
      btn.disabled=false; btn.textContent='Simulate Physics';
      if(r.error){_status.className='status-bar error';_status.textContent=r.error;}
      else{_status.className='status-bar success';_status.textContent='Baked '+r.frames+' frames on '+r.layers+' layer(s).';}
    }).catch(function(e){
      btn.disabled=false; btn.textContent='Simulate Physics';
      _status.className='status-bar error';_status.textContent=e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());
```

---

## Task 3: Factory Presets — add `physics` block to `js/factory-presets.js`

- [ ] Add:

```javascript
  physics: {
    'Gravity Drop':   { duration:3, gravityX:0,   gravityY:980,  bounce:0.55, friction:0.01, groundFriction:0.15, groundY:-1, mass:1, initialVelX:0,   initialVelY:0,    wallBounce:true,  simulateRotation:true  },
    'Bouncy Ball':    { duration:5, gravityX:0,   gravityY:800,  bounce:0.82, friction:0.005,groundFriction:0.05, groundY:-1, mass:1, initialVelX:120, initialVelY:-400, wallBounce:true,  simulateRotation:false },
    'Zero Gravity':   { duration:4, gravityX:0,   gravityY:0,    bounce:1.0,  friction:0,    groundFriction:0,    groundY:-1, mass:1, initialVelX:200, initialVelY:-150, wallBounce:true,  simulateRotation:true  },
    'Heavy Landing':  { duration:2, gravityX:0,   gravityY:1800, bounce:0.2,  friction:0.02, groundFriction:0.4,  groundY:-1, mass:3, initialVelX:0,   initialVelY:0,    wallBounce:false, simulateRotation:false },
    'Side Wind':      { duration:4, gravityX:400, gravityY:600,  bounce:0.45, friction:0.01, groundFriction:0.2,  groundY:-1, mass:1, initialVelX:0,   initialVelY:-100, wallBounce:true,  simulateRotation:true  }
  },
```

---

## Task 4: Verify

- [ ] Open `preview.html`. Click **Phys** tab. Confirm all sliders and toggles render.
- [ ] Click **Simulate Physics** — confirm error message "Select the layers…" appears.
- [ ] Commit:

```bash
git add jsx/physics.jsx js/plugins/physics/ui.js js/factory-presets.js
git commit -m "feat: add Physics Rig — Verlet simulation with ground/wall/body collisions baked to keyframes"
```

---

## Next

→ Continue with `2026-05-28-particle-engine.md`

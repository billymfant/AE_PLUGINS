# Color Lab — Panel Polish (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Color Lab panel UI — one large color wheel with `Lift|Gamma|Gain` tabs and a bold DaVinci-style hue ring, plus a crisp (HiDPI) curve editor with a tonal/colour gradient backdrop.

**Architecture:** Pure CEP panel work in `js/plugins/colorlab/ui.js` + `css/components.css`. The `_state` schema, `jsx/colorlab.jsx`, the presets, and the native `ColorLab.aex` are all UNCHANGED — only the panel's rendering and wheel layout change. A shared `_fitCanvas()` helper sizes every canvas to its on-screen pixels × `devicePixelRatio`, fixing the pixelation that appears when the panel is enlarged.

**Tech Stack:** Vanilla browser JS (IIFE globals, no framework), HTML5 Canvas 2D, CSS custom properties. Verification: `node --check` for syntax + `preview.html` opened in a desktop browser (the panel runs without AE).

**Spec:** `docs/superpowers/specs/2026-06-10-colorlab-panel-polish-design.md`

**Why no unit tests:** This is canvas/DOM rendering; the repo has no JS test runner (verification is `node --check` + visual `preview.html`). Each task therefore verifies with explicit, concrete visual acceptance criteria, not asserts.

---

## File map

- **Modify** `js/plugins/colorlab/ui.js` — add `_fitCanvas`; rewrite `_makeCurveEditor` (HiDPI + gradient backdrop); replace the 3× `_makeWheelCell` usage with a single `_makeWheelPanel` (tabs + channel proxies); rework `_wheelBackground` (bold hue ring + HiDPI).
- **Modify** `css/components.css` — add `.cl-wheel-seg*` (segmented tabs) + `.cl-wheel-single` layout; minor curve-frame polish. The old `.cl-wheels-row` grid rule becomes unused (leave it; harmless).

**Preserved entry points (must keep working):**
- `applyPreset(p)` calls `_wheels.lift.redraw(x,y)`, `_wheels.gamma.redraw(...)`, `_wheels.gain.redraw(...)`, and `.setLuma(v)` (ui.js ~lines 58-60).
- `resetAll()` → `applyPreset(_defaults)` (added earlier).
- Global `document` mousemove/mouseup handlers drive `_activeDrag.move/up` (ui.js ~lines 284-290).

So `_wheels` MUST remain an object exposing `lift`/`gamma`/`gain`, each with `redraw(x,y)` and `setLuma(v)`.

---

## Task 1: Shared HiDPI helper + crisp curve canvas

Fixes the reported pixelation: the curve canvas is a fixed 256×168 bitmap stretched by CSS `width:100%`. We size the backing store to the displayed pixels × DPR and redraw on resize.

**Files:**
- Modify: `js/plugins/colorlab/ui.js` (add `_fitCanvas`; rewrite `_makeCurveEditor`)

- [ ] **Step 1: Add the `_fitCanvas` helper.** Insert immediately after the `getParams` function (after ui.js line ~31, before the `_scheduleLive` block):

```javascript
  // Size a canvas backing store to its on-screen size × devicePixelRatio so it
  // renders crisp at any panel scale, and reset the 2D transform so all drawing
  // stays in CSS-pixel units. Returns the logical {w,h} to draw within.
  function _fitCanvas(canvas, cssW, cssH) {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(cssW)), h = Math.max(1, Math.round(cssH));
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h, dpr: dpr };
  }
```

- [ ] **Step 2: Rewrite `_makeCurveEditor`** (ui.js ~lines 327-438) so size is measured, not fixed, and it redraws on resize. Replace the WHOLE function with this (gradient backdrop comes in Task 2 — this step only makes it crisp + responsive, keeping today's visuals):

```javascript
  function _makeCurveEditor() {
    var pad = 9, active = 'm';
    var W = 256, H = 168;                 // logical px; recomputed in _resize()
    var wrap = Utils.el('div', { class: 'cl-curve' });

    var tabs = Utils.el('div', { class: 'cl-curve-tabs' });
    var tabBtns = {};
    _CURVE_CH.forEach(function (ch) {
      var b = Utils.el('button', { class: 'cl-curve-tab', title: ch.label + ' channel' }, ch.label);
      b.style.setProperty('--ch', ch.color);
      b.addEventListener('click', function () { active = ch.key; _syncTabs(); _draw(); });
      tabBtns[ch.key] = b; tabs.appendChild(b);
    });
    var resetBtn = Utils.el('button', { class: 'cl-curve-reset', title: 'Reset this channel' }, '×');
    resetBtn.addEventListener('click', function () {
      _state.curves[active] = [{ x: 0, y: 0 }, { x: 1, y: 1 }]; _draw(); _scheduleLive();
    });
    tabs.appendChild(resetBtn);
    wrap.appendChild(tabs);

    var canvas = document.createElement('canvas');
    canvas.className = 'cl-curve-canvas';
    wrap.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var hint = Utils.el('div', { class: 'cl-curve-hint' }, 'click to add · drag to shape · double-click a point to remove');
    wrap.appendChild(hint);

    function _syncTabs() { _CURVE_CH.forEach(function (ch) { tabBtns[ch.key].classList.toggle('active', ch.key === active); }); }
    function gx(x) { return pad + x * (W - 2*pad); }
    function gy(y) { return (H - pad) - y * (H - 2*pad); }
    function ux(px) { return (px - pad) / (W - 2*pad); }
    function uy(py) { return ((H - pad) - py) / (H - 2*pad); }
    function _clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    function _drawCurve(key, color, alpha, withPts) {
      var pts = _state.curves[key], m = _curvePrepare(pts), px, first = true;
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = withPts ? 1.6 : 1;
      ctx.beginPath();
      for (px = pad; px <= W - pad; px++) {
        var y = _clamp01(_curveEval(pts, m, ux(px))), py = gy(y);
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (withPts) {
        for (var i = 0; i < pts.length; i++) {
          ctx.beginPath(); ctx.arc(gx(pts[i].x), gy(pts[i].y), 4, 0, Math.PI*2);
          ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0d0d0d'; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    function _draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(pad, pad, W - 2*pad, H - 2*pad);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      for (var i = 1; i < 4; i++) {
        var vx = gx(i/4), hy = gy(i/4);
        ctx.beginPath(); ctx.moveTo(vx, pad); ctx.lineTo(vx, H - pad); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad, hy); ctx.lineTo(W - pad, hy); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(gx(0), gy(0)); ctx.lineTo(gx(1), gy(1)); ctx.stroke(); ctx.setLineDash([]);
      _CURVE_CH.forEach(function (ch) { if (ch.key !== active) _drawCurve(ch.key, ch.color, 0.22, false); });
      var ach = _CURVE_CH.filter(function (c) { return c.key === active; })[0];
      _drawCurve(active, ach.color, 1, true);
    }

    function _resize() {
      var cssW = canvas.clientWidth || 256;
      var cssH = Math.round(cssW * 0.66);          // keep ~3:2 editor
      var dim = _fitCanvas(canvas, cssW, cssH);
      W = dim.w; H = dim.h;
      _draw();
    }

    function _pos(e) {
      var rect = canvas.getBoundingClientRect();
      return { px: (e.clientX - rect.left), py: (e.clientY - rect.top) };  // CSS px == draw units
    }
    function _hit(px, py) {
      var pts = _state.curves[active];
      for (var i = 0; i < pts.length; i++) {
        var dx = px - gx(pts[i].x), dy = py - gy(pts[i].y);
        if (dx*dx + dy*dy <= 64) return i;
      }
      return -1;
    }
    var _dragIdx = -1;
    function _onMove(e) {
      if (_dragIdx < 0) return;
      var p = _pos(e), pts = _state.curves[active], n = pts.length, y = _clamp01(uy(p.py));
      if (_dragIdx === 0)        { pts[0].x = 0; pts[0].y = y; }
      else if (_dragIdx === n-1) { pts[n-1].x = 1; pts[n-1].y = y; }
      else {
        var lo = pts[_dragIdx-1].x + 0.002, hi = pts[_dragIdx+1].x - 0.002;
        var x = _clamp01(ux(p.px)); x = x < lo ? lo : (x > hi ? hi : x);
        pts[_dragIdx].x = x; pts[_dragIdx].y = y;
      }
      _draw(); _scheduleLive();
    }
    canvas.addEventListener('mousedown', function (e) {
      var p = _pos(e), pts = _state.curves[active], hit = _hit(p.px, p.py);
      if (hit < 0) {
        var x = _clamp01(ux(p.px)), y = _clamp01(uy(p.py)), i = 0;
        while (i < pts.length && pts[i].x < x) i++;
        if (i === 0) i = 1; if (i >= pts.length) i = pts.length - 1;
        pts.splice(i, 0, { x: x, y: y }); hit = i;
      }
      _dragIdx = hit;
      _activeDrag = { move: _onMove, up: function () { _dragIdx = -1; } };
      _onMove(e); e.preventDefault();
    });
    canvas.addEventListener('dblclick', function (e) {
      var p = _pos(e), pts = _state.curves[active], hit = _hit(p.px, p.py);
      if (hit > 0 && hit < pts.length - 1) { pts.splice(hit, 1); _draw(); _scheduleLive(); }
    });

    _syncTabs();
    if (window.ResizeObserver) { new ResizeObserver(_resize).observe(canvas); }
    // first paint (deferred so clientWidth is measured after layout)
    requestAnimationFrame(_resize);
    return { el: wrap, redraw: function () { _resize(); } };
  }
```

- [ ] **Step 3: Verify syntax.** Run: `node --check js/plugins/colorlab/ui.js`  → Expected: exits 0, no output.

- [ ] **Step 4: Verify crispness visually.** Open `preview.html` in a desktop browser, go to the Color Lab tab, scroll to Curves. Drag the browser window wider/larger.
  - Expected: the curve grid lines and the diagonal stay **sharp** (1px hairlines, no blur/stair-stepping) as the panel grows. Adding/dragging/double-click-removing points still works. (Before this change they blur when enlarged.)

- [ ] **Step 5: Commit.**

```bash
git add js/plugins/colorlab/ui.js
git commit -m "fix(colorlab): crisp HiDPI curve editor (responsive backing store)"
```

---

## Task 2: Curve editor — gradient backdrop + polish

Adds the tonal/colour "graph behind the curve": a black→white ramp under the X axis and up the Y axis, tinted to the channel colour on R/G/B.

**Files:**
- Modify: `js/plugins/colorlab/ui.js` (`_makeCurveEditor` — `_CURVE_CH` colours reused; add a ramp helper + draw strips in `_draw`)

- [ ] **Step 1: Inside `_makeCurveEditor`, add a backdrop drawer** just above `function _draw()`:

```javascript
    // tonal ramp endpoints per channel: black -> white (luma) or black -> channel hue
    function _rampHi() {
      var c = { m: '#ffffff', r: '#ff5a5a', g: '#5ad07a', b: '#5a9cff' };
      return c[active] || '#ffffff';
    }
    function _drawBackdrop() {
      var strip = 6, hi = _rampHi();
      // X strip along the bottom inside the plot
      var gxL = gx(0), gxR = gx(1), yB = H - pad;
      var gX = ctx.createLinearGradient(gxL, 0, gxR, 0);
      gX.addColorStop(0, '#000'); gX.addColorStop(1, hi);
      ctx.fillStyle = gX; ctx.fillRect(gxL, yB - strip, gxR - gxL, strip);
      // Y strip up the left inside the plot
      var gyB = gy(0), gyT = gy(1), xL = pad;
      var gY = ctx.createLinearGradient(0, gyB, 0, gyT);
      gY.addColorStop(0, '#000'); gY.addColorStop(1, hi);
      ctx.fillStyle = gY; ctx.fillRect(xL, gyT, strip, gyB - gyT);
    }
```

- [ ] **Step 2: Call it in `_draw`.** In `_draw()`, replace the plot-background line:

```javascript
      ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(pad, pad, W - 2*pad, H - 2*pad);
```

with:

```javascript
      ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(pad, pad, W - 2*pad, H - 2*pad);
      _drawBackdrop();
```

- [ ] **Step 3: Slightly larger point handles.** In `_drawCurve`, change the point radius from `4` to `5`:

```javascript
          ctx.beginPath(); ctx.arc(gx(pts[i].x), gy(pts[i].y), 5, 0, Math.PI*2);
```

- [ ] **Step 4: Verify syntax.** Run: `node --check js/plugins/colorlab/ui.js` → Expected: exits 0.

- [ ] **Step 5: Verify visually** in `preview.html` (Color Lab → Curves):
  - Expected: a black→white strip sits along the bottom and up the left of the plot. Switching to the **R** tab tints both strips black→red; **G** → black→green; **B** → black→blue; **M** → black→white. Points are a touch larger/easier to grab. Still crisp when enlarged.

- [ ] **Step 6: Commit.**

```bash
git add js/plugins/colorlab/ui.js
git commit -m "feat(colorlab): curve editor gradient backdrop (tonal/colour axes)"
```

---

## Task 3: Color wheels — single wheel + segmented tabs

Replace the three cramped wheels with one larger wheel switched by `Lift | Gamma | Gain` tabs. Keeps the `_wheels.{lift,gamma,gain}.redraw/setLuma` API so `applyPreset`/`resetAll` keep working.

**Files:**
- Modify: `js/plugins/colorlab/ui.js` (replace `_makeWheelCell` with `_makeWheelPanel`; update `init()` wheels section)
- Modify: `css/components.css` (add `.cl-wheel-seg*` + `.cl-wheel-single`)

- [ ] **Step 1: Replace `_makeWheelCell`** (ui.js ~lines 195-282) with `_makeWheelPanel`. This builds ONE canvas + segmented control + luma slider + readout + reset, and returns `{ el, channels }` where `channels.lift/gamma/gain` each expose `redraw(x,y)`/`setLuma(v)`:

```javascript
  var _WHEELS = [
    { key: 'lift',  label: 'Lift',  x: 'liftX',  y: 'liftY',  luma: 'liftLuma'  },
    { key: 'gamma', label: 'Gamma', x: 'gammaX', y: 'gammaY', luma: 'gammaLuma' },
    { key: 'gain',  label: 'Gain',  x: 'gainX',  y: 'gainY',  luma: 'gainLuma'  }
  ];

  function _makeWheelPanel() {
    var active = _WHEELS[0];                 // 'lift' shown first
    var WHEEL_CSS = 150;                      // on-screen wheel diameter (px)
    var cell = Utils.el('div', { class: 'cl-wheel-single' });

    // segmented Lift | Gamma | Gain
    var seg = Utils.el('div', { class: 'cl-wheel-seg' });
    var segBtns = {};
    _WHEELS.forEach(function (w) {
      var b = Utils.el('button', { class: 'cl-wheel-seg-btn', title: w.label + ' wheel' }, w.label);
      b.addEventListener('click', function () { _setActive(w.key); });
      segBtns[w.key] = b; seg.appendChild(b);
    });
    cell.appendChild(seg);

    var canvasWrap = Utils.el('div', { class: 'cl-wheel-canvas-wrap' });
    var canvas = document.createElement('canvas');
    canvas.className = 'cl-wheel-canvas';
    var resetBtn = Utils.el('button', { class: 'cl-wheel-reset', title: 'Reset wheel' }, '×');
    canvasWrap.appendChild(canvas); canvasWrap.appendChild(resetBtn);
    cell.appendChild(canvasWrap);

    var lumaWrap = Utils.el('div', { class: 'cl-luma-wrap' });
    var lumaInput = document.createElement('input');
    lumaInput.type = 'range'; lumaInput.min = -100; lumaInput.max = 100; lumaInput.step = 1;
    lumaInput.className = 'cl-luma-mini'; lumaInput.title = 'Luminance offset';
    var lumaVal = Utils.el('div', { class: 'cl-luma-val' }, '');
    lumaWrap.appendChild(lumaInput); lumaWrap.appendChild(lumaVal);
    cell.appendChild(lumaWrap);

    var valueEl = Utils.el('div', { class: 'cl-wheel-value' }, '—');
    cell.appendChild(valueEl);

    function _updateHueVal(x, y) {
      var txt = _wheelValueText(x, y);
      valueEl.textContent = txt; valueEl.classList.toggle('active', txt !== '—');
    }
    function _updateLumaVal(v) {
      lumaVal.textContent = v !== 0 ? (v > 0 ? '+' + v : '' + v) : '';
      lumaVal.classList.toggle('nonzero', v !== 0);
      _setLumaBg(lumaInput, v);
    }

    var _rafId = 0;
    function _repaint() {
      if (_rafId) return;
      _rafId = requestAnimationFrame(function () {
        _rafId = 0;
        _paintWheel(canvas, _state[active.x] || 0, _state[active.y] || 0);
        _updateHueVal(_state[active.x] || 0, _state[active.y] || 0);
      });
    }
    function _resize() {
      _fitCanvas(canvas, WHEEL_CSS, WHEEL_CSS);
      _paintWheel(canvas, _state[active.x] || 0, _state[active.y] || 0);
    }

    // relative-drag (grab & nudge), Shift = fine, on the ACTIVE wheel
    var _drag = null;
    function _onMove(e) {
      if (!_drag) return;
      var rect = canvas.getBoundingClientRect();
      var g = _wheelGeom(WHEEL_CSS);
      var pxToNorm = 1 / ((rect.width / WHEEL_CSS) * g.innerR);
      var fine = e.shiftKey ? 0.28 : 1;
      var nx = _drag.vx + (e.clientX - _drag.px) * pxToNorm * fine;
      var ny = _drag.vy - (e.clientY - _drag.py) * pxToNorm * fine;
      var d = Math.sqrt(nx * nx + ny * ny);
      if (d > 1) { nx /= d; ny /= d; }
      _state[active.x] = nx; _state[active.y] = ny;
      _repaint(); _scheduleLive();
    }
    canvas.addEventListener('mousedown', function (e) {
      _drag = { px: e.clientX, py: e.clientY, vx: _state[active.x] || 0, vy: _state[active.y] || 0 };
      _activeDrag = { move: _onMove, up: function () { _drag = null; } };
      canvas.classList.add('dragging'); e.preventDefault();
    });
    canvas.addEventListener('dblclick', function () {
      _state[active.x] = 0; _state[active.y] = 0; _repaint(); _scheduleLive();
    });
    lumaInput.addEventListener('input', function () {
      var v = parseInt(lumaInput.value, 10);
      _state[active.luma] = v; _updateLumaVal(v); _scheduleLive();
    });
    resetBtn.addEventListener('click', function () {
      _state[active.x] = 0; _state[active.y] = 0; _repaint(); _scheduleLive();
    });

    function _setActive(key) {
      active = _WHEELS.filter(function (w) { return w.key === key; })[0];
      _WHEELS.forEach(function (w) { segBtns[w.key].classList.toggle('on', w.key === active.key); });
      lumaInput.value = _state[active.luma] || 0;
      _updateLumaVal(_state[active.luma] || 0);
      _repaint();
    }

    if (window.ResizeObserver) { new ResizeObserver(_resize).observe(canvas); }
    requestAnimationFrame(function () { _resize(); _setActive(active.key); });

    // per-channel proxy so applyPreset()/resetAll() keep working unchanged
    function _proxy(w) {
      return {
        redraw: function (x, y) {
          _state[w.x] = x; _state[w.y] = y;
          if (active.key === w.key) { _paintWheel(canvas, x || 0, y || 0); _updateHueVal(x || 0, y || 0); }
        },
        setLuma: function (v) {
          _state[w.luma] = v;
          if (active.key === w.key) { lumaInput.value = v; _updateLumaVal(v); }
        }
      };
    }
    return { el: cell, channels: { lift: _proxy(_WHEELS[0]), gamma: _proxy(_WHEELS[1]), gain: _proxy(_WHEELS[2]) } };
  }
```

- [ ] **Step 2: Update `init()` wheels section** (ui.js ~lines 442-453). Replace:

```javascript
    var wheelsRow = Utils.el('div', { class: 'cl-wheels-row' });
    _wheels.lift  = _makeWheelCell('Lift',  'liftX',  'liftY',  'liftLuma');
    _wheels.gamma = _makeWheelCell('Gamma', 'gammaX', 'gammaY', 'gammaLuma');
    _wheels.gain  = _makeWheelCell('Gain',  'gainX',  'gainY',  'gainLuma');
    wheelsRow.appendChild(_wheels.lift.el);
    wheelsRow.appendChild(_wheels.gamma.el);
    wheelsRow.appendChild(_wheels.gain.el);
    var wheelsHero = Utils.el('div', { class: 'cl-wheels-hero' });
    wheelsHero.appendChild(wheelsRow);
    container.appendChild(wheelsHero);
```

with:

```javascript
    var _wheelPanel = _makeWheelPanel();
    _wheels = _wheelPanel.channels;          // {lift,gamma,gain} proxies for applyPreset/resetAll
    var wheelsHero = Utils.el('div', { class: 'cl-wheels-hero' });
    wheelsHero.appendChild(_wheelPanel.el);
    container.appendChild(wheelsHero);
```

- [ ] **Step 3: Add CSS** for the segmented control + single-wheel layout. Append to `css/components.css` (after the `.cl-wheel-value` block, ~line 489):

```css
/* ── Single-wheel layout + segmented Lift|Gamma|Gain ──────── */
.cl-wheel-single {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
}
.cl-wheel-seg {
  display: flex;
  width: 100%;
  max-width: 200px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  overflow: hidden;
}
.cl-wheel-seg-btn {
  flex: 1;
  padding: 5px 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  background: var(--surface-2);
  border: none;
  cursor: pointer;
  transition: color var(--t-base), background var(--t-base);
}
.cl-wheel-seg-btn + .cl-wheel-seg-btn { border-left: 1px solid var(--border-light); }
.cl-wheel-seg-btn:hover { color: var(--text); }
.cl-wheel-seg-btn.on {
  color: #fff;
  background: var(--tab-color, var(--accent));
}
```

- [ ] **Step 4: Verify syntax.** Run: `node --check js/plugins/colorlab/ui.js` → Expected: exits 0.

- [ ] **Step 5: Verify visually** in `preview.html` (Color Lab → Color Wheels):
  - Expected: ONE large wheel with `Lift | Gamma | Gain` tabs above it (Lift active/magenta). Clicking a tab switches the wheel; dragging moves the handle (relative grab), Shift = fine, double-click recenters, `×` resets, luma slider + readout track the active wheel. Apply a preset (e.g. "Teal & Orange") — the wheel reflects the preset's active-channel position and Reset clears it. (Confirms the proxy wiring.)

- [ ] **Step 6: Commit.**

```bash
git add js/plugins/colorlab/ui.js css/components.css
git commit -m "feat(colorlab): single color wheel with Lift|Gamma|Gain segmented tabs"
```

---

## Task 4: Color wheel — bold DaVinci hue ring + HiDPI

Replace the faint rim with a bold full-saturation conic hue ring, and render the wheel crisp at DPR. The wheel background is cached; key the cache by `size@dpr`.

**Files:**
- Modify: `js/plugins/colorlab/ui.js` (`_wheelBackground`, `_paintWheel`)

- [ ] **Step 1: Rework `_wheelBackground`** (ui.js ~lines 99-150). Replace the WHOLE function with this — it draws the machined body via per-pixel imageData (as before) but then paints a **bold hue ring** as filled angular segments on top, and is DPR-aware:

```javascript
  var _wheelBgCache = {};
  function _wheelBackground(size) {
    var dpr = window.devicePixelRatio || 1;
    var ckey = size + '@' + dpr;
    if (_wheelBgCache[ckey]) return _wheelBgCache[ckey];
    var off = document.createElement('canvas');
    off.width = Math.round(size * dpr); off.height = Math.round(size * dpr);
    var ctx = off.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = _wheelGeom(size), cx = g.cx, cy = g.cy, outerR = g.outerR, bodyEdge = g.bodyEdge;

    // dark machined body (per-pixel radial shade) — drawn at logical resolution
    var img = ctx.createImageData(Math.round(size*dpr), Math.round(size*dpr)), data = img.data;
    var S = Math.round(size*dpr);
    for (var py = 0; py < S; py++) {
      for (var px = 0; px < S; px++) {
        var bx = px/dpr - cx, by = cy - py/dpr;
        var dist = Math.sqrt(bx * bx + by * by);
        var idx = (py * S + px) * 4;
        if (dist > bodyEdge) { data[idx + 3] = 0; continue; }
        var t = bodyEdge > 0 ? dist / bodyEdge : 0;
        var base = Math.round(36 * (1 - t) + 9 * t);
        if (by > 0) base += Math.round((by / outerR) * 9 * (1 - t));
        data[idx] = base; data[idx+1] = base; data[idx+2] = base + 1; data[idx+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // BOLD hue ring: full-saturation angular segments in the rim band
    var ringOuter = outerR, ringInner = bodyEdge + 1, segs = 180;
    for (var s = 0; s < segs; s++) {
      var a0 = (s / segs) * 2 * Math.PI, a1 = ((s + 1) / segs) * 2 * Math.PI;
      var hue = s / segs;                       // 0=red sweeping CCW
      var rgb = _hslToRgb(hue, 0.95, 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, ringOuter, -a0, -a1, true);
      ctx.arc(cx, cy, ringInner, -a1, -a0, false);
      ctx.closePath();
      ctx.fillStyle = 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')';
      ctx.fill();
    }
    // thin dark separators inside/outside the ring for definition
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, ringInner, 0, Math.PI*2); ctx.stroke();

    // faint crosshair + center pip on the body
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - g.innerR * 0.92, cy); ctx.lineTo(cx + g.innerR * 0.92, cy);
    ctx.moveTo(cx, cy - g.innerR * 0.92); ctx.lineTo(cx, cy + g.innerR * 0.92);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();

    _wheelBgCache[ckey] = off;
    return off;
  }
```

- [ ] **Step 2: Update `_paintWheel`** (ui.js ~lines 153-171) to draw the cached background at logical size (the offscreen is DPR-scaled, so draw into the logical box). Replace the `ctx.drawImage(...)` line:

```javascript
    ctx.drawImage(_wheelBackground(canvas.width), 0, 0);
```

with:

```javascript
    var _size = parseInt(canvas.style.width, 10) || (canvas.width / (window.devicePixelRatio || 1));
    ctx.drawImage(_wheelBackground(_size), 0, 0, _size, _size);
```

  (The rest of `_paintWheel` — guide line + magenta handle — already draws in logical units, which matches the DPR-scaled context from `_fitCanvas`.)

- [ ] **Step 3: Verify syntax.** Run: `node --check js/plugins/colorlab/ui.js` → Expected: exits 0.

- [ ] **Step 4: Verify visually** in `preview.html` (Color Lab → Color Wheels), enlarge the window:
  - Expected: a **bold, full-colour hue ring** (red→yellow→green→cyan→blue→magenta) wraps the dark trackball — clearly legible, not a faint rim. The magenta handle + guide line point toward the matching colour as you drag. The wheel and ring stay **sharp** when the panel is enlarged. Tabs/drag/reset all still work.

- [ ] **Step 5: Commit.**

```bash
git add js/plugins/colorlab/ui.js
git commit -m "feat(colorlab): bold DaVinci-style hue ring + HiDPI wheel render"
```

---

## Task 5: Full verification pass + AE eyeball

**Files:** none (verification only)

- [ ] **Step 1: Syntax gate.** Run: `node --check js/plugins/colorlab/ui.js` → Expected: exits 0.

- [ ] **Step 2: Full panel walkthrough in `preview.html`** (Color Lab tab). Confirm ALL acceptance criteria together:
  - Wheels: single wheel; `Lift|Gamma|Gain` tabs switch it; bold hue ring; relative drag + Shift-fine + dbl-click reset + `×` reset; luma slider/readout per active wheel.
  - Curves: crisp at any window size; gradient backdrop tints per M/R/G/B tab; add/drag/remove points; per-channel reset.
  - Cross-cutting: enlarge the window — wheel AND curve both stay sharp (no blur/pixelation).
  - Presets + Reset: apply a preset, then the global **Reset** button clears wheels + curves + sliders.

- [ ] **Step 3: AE eyeball (manual).** The CEP panel is a junction to the repo, so reload the panel in AE (`Window → Extensions → AE Plugin Suite`, close/reopen) — no copy needed. Grade a layer and confirm: wheels switch + ring legible, curves crisp when the panel is widened, grading still applies. (No `.aex` change in this phase.)

- [ ] **Step 4: Final commit (only if Step 2/3 surfaced fixes).**

```bash
git add -A
git commit -m "fix(colorlab): panel polish verification fixes"
```

---

## Self-review (plan vs spec)

- **Spec §Goals** — single wheel + tabs + hue ring (Tasks 3, 4); crisp curve editor + gradient backdrop (Tasks 1, 2); shared HiDPI fix (`_fitCanvas`, Task 1; wheel DPR Task 4). ✓
- **Spec §1 HiDPI helper** — `_fitCanvas` (Task 1 Step 1), used by curve (Task 1) and wheel (Task 4). ✓
- **Spec §2 wheels** — segmented control, bigger wheel, bold ring, preserved drag/luma/reset, `_wheels` proxy for `applyPreset`/`resetAll` (Task 3 proxy + Task 4 ring). ✓
- **Spec §3 curves** — responsive crisp canvas, gradient backdrop, channel tint, larger handles, preserved monotone-cubic/add-drag-remove/tabs (Tasks 1, 2). ✓
- **Spec non-goals** — histogram deferred; presets/log untouched; `_state`/jsx/.aex unchanged. ✓
- **Name consistency** — `_fitCanvas`, `_makeWheelPanel`, `_WHEELS`, `_wheels` (proxies), `_wheelBackground` cache key `size@dpr`, `_makeCurveEditor` all referenced consistently. ✓
- **Placeholders** — none; every code step shows full code. ✓

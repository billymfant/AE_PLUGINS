'use strict';

// Color Lab panel — drives the native ColorLab.aex (match-name DKVB ColorLab)
// via colorlab.apply. Follows docs/design/DESIGN_LANGUAGE.md: hero color wheels,
// compact Primary + Output sections (collapsible), smart apply, 160ms live apply.
// MVP param set mirrors the .aex exactly (primaries + 3-way wheels + output);
// curves / HSL secondary / scopes arrive when the .aex wires them.
window.ColorLabUI = (function () {

  var _defaults = {
    exposure: 0, contrast: 0, contrastPivot: 0.18,
    temperature: 0, tint: 0, saturation: 0,
    liftX: 0, liftY: 0, liftLuma: 0,
    gammaX: 0, gammaY: 0, gammaLuma: 0,
    gainX: 0, gainY: 0, gainLuma: 0,
    // display-space grade by default (gentle, predictable) + no tonemap so a
    // neutral panel = untouched image. Matches the native .aex defaults.
    linearLight: false, tonemap: 1, highlightComp: 50,
    applyToSelection: false,
    // tone curves — each channel is a list of {x,y} control points in 0..1,
    // identity = the two diagonal endpoints. Sampled to a 16-node LUT on apply.
    curves: _identityCurves()
  };
  function _identityCurves() {
    function id() { return [{ x: 0, y: 0 }, { x: 1, y: 1 }]; }
    return { m: id(), r: id(), g: id(), b: id() };
  }

  var _state = Utils.deepClone(_defaults);

  var _sliders = {}, _wheels = {}, _curveEditor, _linearToggle, _tonemapDD, _applyMode, _status;

  function getParams() { return Utils.deepClone(_state); }

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

  // ── Live preview (debounced 160ms per DESIGN_LANGUAGE) ─────────
  var _liveTimer = null, _liveDot = null;
  function _scheduleLive() {
    clearTimeout(_liveTimer);
    if (_liveDot) _liveDot.style.opacity = '0.5';
    _liveTimer = setTimeout(function () {
      Bridge.call('colorlab.apply', getParams()).then(function () {
        if (_liveDot) _liveDot.style.opacity = '0.4';
      }).catch(function () {
        if (_liveDot) _liveDot.style.opacity = '0';
      });
    }, 160);
  }

  function applyPreset(p) {
    Object.assign(_state, p);
    if (_sliders.exposure)      _sliders.exposure.setValue(p.exposure || 0);
    if (_sliders.contrast)      _sliders.contrast.setValue(p.contrast || 0);
    if (_sliders.contrastPivot) _sliders.contrastPivot.setValue(p.contrastPivot != null ? p.contrastPivot : 0.18);
    if (_sliders.temperature)   _sliders.temperature.setValue(p.temperature || 0);
    if (_sliders.tint)          _sliders.tint.setValue(p.tint || 0);
    if (_sliders.saturation)    _sliders.saturation.setValue(p.saturation || 0);
    if (_sliders.highlightComp) _sliders.highlightComp.setValue(p.highlightComp != null ? p.highlightComp : 50);
    if (_linearToggle)          _linearToggle.setValue(p.linearLight !== false);
    if (_tonemapDD)             _tonemapDD.setValue(p.tonemap || 2);
    if (_wheels.lift)  { _wheels.lift.redraw(p.liftX || 0, p.liftY || 0);   _wheels.lift.setLuma(p.liftLuma || 0); }
    if (_wheels.gamma) { _wheels.gamma.redraw(p.gammaX || 0, p.gammaY || 0); _wheels.gamma.setLuma(p.gammaLuma || 0); }
    if (_wheels.gain)  { _wheels.gain.redraw(p.gainX || 0, p.gainY || 0);   _wheels.gain.setLuma(p.gainLuma || 0); }
    // Presets define a full look: load their curves, or reset to identity.
    _state.curves = p.curves ? Utils.deepClone(p.curves) : _identityCurves();
    if (_curveEditor) _curveEditor.redraw();
  }

  // Reset every control to neutral and push the cleared grade to AE live, so the
  // user doesn't have to drag each slider back by hand. Keeps the current apply
  // target (Adj Layer vs Selected) so reset doesn't change where the grade lands.
  function resetAll() {
    var keepSel = _state.applyToSelection;
    applyPreset(Utils.deepClone(_defaults));
    _state.applyToSelection = keepSel;
    _scheduleLive();
  }

  // ── Color helpers (HSL -> RGB for the wheel render) ────────────
  function _hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  function _hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = _hue2rgb(p, q, h + 1/3); g = _hue2rgb(p, q, h); b = _hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  // ── Trackball geometry (shared by render + hit-testing) ────────
  function _wheelGeom(size) {
    var cx = size / 2, cy = size / 2;
    var outerR = cx - 0.5;
    var ringW  = Math.round(outerR * 0.18), gap = 2;
    var innerR = outerR - ringW - gap;
    var rimVis = Math.max(3, Math.round(outerR * 0.12));
    var bodyEdge = outerR - rimVis;
    return { cx: cx, cy: cy, outerR: outerR, innerR: innerR, bodyEdge: bodyEdge, rimVis: rimVis };
  }

  // ── Static trackball, rendered ONCE to an offscreen canvas and shared
  //    by all three wheels. Dragging then only repaints the handle on top,
  //    so motion stays smooth (no per-event per-pixel rebuild). ─────────
  var _wheelBgCache = {};
  function _wheelBackground(size) {
    if (_wheelBgCache[size]) return _wheelBgCache[size];
    var off = document.createElement('canvas');
    off.width = size; off.height = size;
    var ctx = off.getContext('2d');
    var g = _wheelGeom(size), cx = g.cx, cy = g.cy, outerR = g.outerR, bodyEdge = g.bodyEdge, rimVis = g.rimVis;

    var img = ctx.createImageData(size, size), data = img.data;
    for (var py = 0; py < size; py++) {
      for (var px = 0; px < size; px++) {
        var bx = px - cx, by = cy - py;
        var dist = Math.sqrt(bx * bx + by * by);
        var idx = (py * size + px) * 4;
        if (dist > outerR) { data[idx + 3] = 0; continue; }
        if (dist >= bodyEdge) {
          // faint hue rim — dim hue blended over near-black, soft edge falloff
          var ang = Math.atan2(by, bx); if (ang < 0) ang += 2 * Math.PI;
          var rgb = _hslToRgb(ang / (2 * Math.PI), 0.85, 0.5);
          var tt = (dist - bodyEdge) / rimVis;
          var mix = 0.55 * (1 - 0.55 * Math.abs(2 * tt - 1));
          data[idx]   = Math.round(10 * (1 - mix) + rgb.r * mix);
          data[idx+1] = Math.round(10 * (1 - mix) + rgb.g * mix);
          data[idx+2] = Math.round(12 * (1 - mix) + rgb.b * mix);
          data[idx+3] = 255;
        } else {
          // dark machined body: radial shade, top edge a touch lighter (bezel)
          var t = bodyEdge > 0 ? dist / bodyEdge : 0;
          var base = Math.round(36 * (1 - t) + 9 * t);
          if (by > 0) base += Math.round((by / outerR) * 9 * (1 - t));
          data[idx] = base; data[idx+1] = base; data[idx+2] = base + 1; data[idx+3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // bezel ring at the body edge
    ctx.beginPath(); ctx.arc(cx, cy, bodyEdge, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
    // faint crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - g.innerR * 0.92, cy); ctx.lineTo(cx + g.innerR * 0.92, cy);
    ctx.moveTo(cx, cy - g.innerR * 0.92); ctx.lineTo(cx, cy + g.innerR * 0.92);
    ctx.stroke();
    // center pip
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();

    _wheelBgCache[size] = off;
    return off;
  }

  // Composite: cached background + the live handle (cheap, runs every frame).
  function _paintWheel(canvas, dotX, dotY) {
    var ctx = canvas.getContext('2d');
    var g = _wheelGeom(canvas.width);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(_wheelBackground(canvas.width), 0, 0);

    var dotDist = Math.sqrt(dotX * dotX + dotY * dotY);
    var hx = g.cx + dotX * g.innerR, hy = g.cy - dotY * g.innerR;
    if (dotDist > 0.02) {
      // guide line center → handle (reads the balance direction at a glance)
      ctx.strokeStyle = 'rgba(224,85,154,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(hx, hy); ctx.stroke();
      // glowing magenta handle
      ctx.shadowColor = 'rgba(224,85,154,0.85)'; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#e0559a'; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
  }

  function _setLumaBg(input, val) {
    var pct = (val + 100) / 200 * 100, center = 50;
    var lo = Math.min(pct, center), hi = Math.max(pct, center);
    var accent = '#e0559a';
    input.style.background = [
      'linear-gradient(to right',
      'var(--surface-4) 0%', 'var(--surface-4) ' + lo + '%',
      accent + ' ' + lo + '%', accent + ' ' + hi + '%',
      'var(--surface-4) ' + hi + '%', 'var(--surface-4) 100%'
    ].join(', ') + ')';
  }

  var _HUE_DIRS = ['Red', 'Ylw', 'Grn', 'Cyn', 'Blu', 'Mag'];
  function _wheelValueText(x, y) {
    var d = Math.sqrt(x * x + y * y);
    if (d < 0.025) return '—';
    var deg = Math.atan2(y, x) * 180 / Math.PI; if (deg < 0) deg += 360;
    return _HUE_DIRS[Math.round(deg / 60) % 6] + ' ' + Math.round(d * 100) + '%';
  }

  var _activeDrag = null;

  function _makeWheelCell(label, xKey, yKey, lumaKey) {
    var cell = Utils.el('div', { class: 'cl-wheel-cell' });
    cell.appendChild(Utils.el('div', { class: 'cl-wheel-title' }, label));

    var canvasWrap = Utils.el('div', { class: 'cl-wheel-canvas-wrap' });
    var canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 96; canvas.className = 'cl-wheel-canvas';
    var resetBtn = Utils.el('button', { class: 'cl-wheel-reset', title: 'Reset ' + label }, '×');
    canvasWrap.appendChild(canvas); canvasWrap.appendChild(resetBtn);
    cell.appendChild(canvasWrap);

    var lumaWrap = Utils.el('div', { class: 'cl-luma-wrap' });
    var lumaInput = document.createElement('input');
    lumaInput.type = 'range'; lumaInput.min = -100; lumaInput.max = 100; lumaInput.step = 1;
    lumaInput.value = _state[lumaKey] || 0; lumaInput.className = 'cl-luma-mini';
    lumaInput.title = label + ' luminance offset';
    var lumaVal = Utils.el('div', { class: 'cl-luma-val' }, '');
    _setLumaBg(lumaInput, _state[lumaKey] || 0);
    lumaWrap.appendChild(lumaInput); lumaWrap.appendChild(lumaVal);
    cell.appendChild(lumaWrap);

    var valueEl = Utils.el('div', { class: 'cl-wheel-value' }, '—');
    cell.appendChild(valueEl);

    function _updateHueVal(x, y) {
      var txt = _wheelValueText(x, y);
      valueEl.textContent = txt;
      valueEl.classList.toggle('active', txt !== '—');
    }
    function _updateLumaVal(v) {
      lumaVal.textContent = v !== 0 ? (v > 0 ? '+' + v : '' + v) : '';
      lumaVal.classList.toggle('nonzero', v !== 0);
      _setLumaBg(lumaInput, v);
    }

    // Relative trackball drag: grab anywhere and nudge — the handle moves by
    // the pointer delta (not by jumping to the cursor). Smooth + precise.
    // Hold Shift for fine control. Repaints are coalesced via rAF.
    var _drag = null, _rafId = 0;
    function _repaint() {
      if (_rafId) return;
      _rafId = requestAnimationFrame(function () {
        _rafId = 0;
        _paintWheel(canvas, _state[xKey] || 0, _state[yKey] || 0);
        _updateHueVal(_state[xKey] || 0, _state[yKey] || 0);
      });
    }
    function _onMove(e) {
      if (!_drag) return;
      var rect = canvas.getBoundingClientRect();
      var g = _wheelGeom(canvas.width);
      // pointer pixels → normalized units, accounting for any CSS scaling
      var pxToNorm = 1 / ((rect.width / canvas.width) * g.innerR);
      var fine = e.shiftKey ? 0.28 : 1;
      var nx = _drag.vx + (e.clientX - _drag.px) * pxToNorm * fine;
      var ny = _drag.vy - (e.clientY - _drag.py) * pxToNorm * fine;
      var d = Math.sqrt(nx * nx + ny * ny);
      if (d > 1) { nx /= d; ny /= d; }
      _state[xKey] = nx; _state[yKey] = ny;
      _repaint(); _scheduleLive();
    }
    canvas.addEventListener('mousedown', function (e) {
      _drag = { px: e.clientX, py: e.clientY, vx: _state[xKey] || 0, vy: _state[yKey] || 0 };
      _activeDrag = { move: _onMove, up: function () { _drag = null; } };
      canvas.classList.add('dragging');
      e.preventDefault();
    });
    canvas.addEventListener('dblclick', function () {
      _state[xKey] = 0; _state[yKey] = 0; _repaint(); _scheduleLive();
    });
    lumaInput.addEventListener('input', function () {
      var v = parseInt(lumaInput.value, 10);
      _state[lumaKey] = v; _updateLumaVal(v); _scheduleLive();
    });
    resetBtn.addEventListener('click', function () {
      _state[xKey] = 0; _state[yKey] = 0; _repaint(); _scheduleLive();
    });

    _paintWheel(canvas, _state[xKey] || 0, _state[yKey] || 0);
    _updateHueVal(_state[xKey] || 0, _state[yKey] || 0);
    _updateLumaVal(_state[lumaKey] || 0);

    return {
      el: cell,
      redraw: function (x, y) { _state[xKey] = x; _state[yKey] = y; _paintWheel(canvas, x || 0, y || 0); _updateHueVal(x || 0, y || 0); },
      setLuma: function (v) { _state[lumaKey] = v; lumaInput.value = v; _updateLumaVal(v); }
    };
  }

  document.addEventListener('mousemove', function (e) { if (_activeDrag && _activeDrag.move) _activeDrag.move(e); });
  document.addEventListener('mouseup', function () {
    if (_activeDrag && _activeDrag.up) _activeDrag.up();
    _activeDrag = null;
    var d = document.querySelector('.cl-wheel-canvas.dragging');
    if (d) d.classList.remove('dragging');
  });

  function _section(c, text) { c.appendChild(Utils.el('div', { class: 'section-label' }, text)); }

  // ── Tone-curve editor ──────────────────────────────────────────
  // Monotone-cubic (Fritsch–Carlson) — a faithful port of the native engine's
  // prepareCurve/evalCurve (color_params.h) so the panel preview matches render.
  var _CURVE_CH = [
    { key: 'm', label: 'M', color: '#e8e8e8' },
    { key: 'r', label: 'R', color: '#ff5a5a' },
    { key: 'g', label: 'G', color: '#5ad07a' },
    { key: 'b', label: 'B', color: '#5a9cff' }
  ];
  function _curvePrepare(pts) {
    var n = pts.length, d = [], m = new Array(n), i;
    if (n < 2) return m;
    for (i = 0; i < n - 1; i++) { var h = pts[i+1].x - pts[i].x; d[i] = h > 1e-6 ? (pts[i+1].y - pts[i].y) / h : 0; }
    m[0] = d[0]; m[n-1] = d[n-2];
    for (i = 1; i < n - 1; i++) m[i] = (d[i-1]*d[i] <= 0) ? 0 : 0.5*(d[i-1]+d[i]);
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i+1] = 0; continue; }
      var a = m[i]/d[i], b = m[i+1]/d[i], s = a*a + b*b;
      if (s > 9) { var t = 3/Math.sqrt(s); m[i] = t*a*d[i]; m[i+1] = t*b*d[i]; }
    }
    return m;
  }
  function _curveEval(pts, m, x) {
    var n = pts.length;
    if (n < 2) return x;
    if (x <= pts[0].x)   return pts[0].y   + (x - pts[0].x)   * m[0];
    if (x >= pts[n-1].x) return pts[n-1].y + (x - pts[n-1].x) * m[n-1];
    var i = 0; while (i < n-1 && x > pts[i+1].x) i++;
    var h = pts[i+1].x - pts[i].x, t = (x - pts[i].x)/h, t2 = t*t, t3 = t2*t;
    var h00 = 2*t3-3*t2+1, h10 = t3-2*t2+t, h01 = -2*t3+3*t2, h11 = t3-t2;
    return h00*pts[i].y + h10*h*m[i] + h01*pts[i+1].y + h11*h*m[i+1];
  }

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

  // ── Init ───────────────────────────────────────────────────────
  function init(container) {
    // Hero: Color Wheels
    _section(container, 'Color Wheels');
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

    // Primary
    _section(container, 'Primary');
    _sliders.exposure = new Slider({
      label: 'Exposure', min: -5, max: 5, value: 0, step: 0.1, decimals: 1, defaultValue: 0,
      tooltip: 'Photometric exposure in stops (linear). 1 stop doubles brightness.',
      onChange: function (v) { _state.exposure = v; _scheduleLive(); }
    });
    _sliders.contrast = new Slider({
      label: 'Contrast', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Contrast around the mid-grey pivot.',
      onChange: function (v) { _state.contrast = v; _scheduleLive(); }
    });
    _sliders.temperature = new Slider({
      label: 'Temperature', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Negative = cooler/blue, positive = warmer/orange.',
      onChange: function (v) { _state.temperature = v; _scheduleLive(); }
    });
    _sliders.tint = new Slider({
      label: 'Tint', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Negative = green, positive = magenta.',
      onChange: function (v) { _state.tint = v; _scheduleLive(); }
    });
    _sliders.saturation = new Slider({
      label: 'Saturation', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Luma-preserving saturation. -100 = grayscale.',
      onChange: function (v) { _state.saturation = v; _scheduleLive(); }
    });
    container.appendChild(_sliders.exposure.el);
    container.appendChild(_sliders.contrast.el);
    container.appendChild(_sliders.temperature.el);
    container.appendChild(_sliders.tint.el);
    container.appendChild(_sliders.saturation.el);

    // Curves (Master + per-channel R/G/B)
    _section(container, 'Curves');
    _curveEditor = _makeCurveEditor();
    container.appendChild(_curveEditor.el);

    // Output
    _section(container, 'Output');
    _linearToggle = new Toggle({
      label: 'Linear Light', value: false,
      tooltip: 'Grade in display space (gentle, predictable — default). Turn ON for physically-linear exposure/contrast work.',
      onChange: function (v) { _state.linearLight = v; _scheduleLive(); }
    });
    _tonemapDD = new Dropdown({
      label: 'Tonemap',
      tooltip: 'Roll off highlights so boosts do not hard-clip to white. None = no roll-off (default).',
      options: [ { value: 1, label: 'None' }, { value: 2, label: 'Soft-clip' }, { value: 3, label: 'Filmic' } ],
      value: 1,
      onChange: function (v) { _state.tonemap = v; _scheduleLive(); }
    });
    _sliders.highlightComp = new Slider({
      label: 'Highlight Cmp', min: 0, max: 100, value: 50, step: 1, defaultValue: 50,
      tooltip: 'How hard the tonemap compresses the brightest values.',
      onChange: function (v) { _state.highlightComp = v; _scheduleLive(); }
    });
    _sliders.contrastPivot = new Slider({
      label: 'Pivot', min: 0, max: 1, value: 0.18, step: 0.01, decimals: 2, defaultValue: 0.18,
      tooltip: 'Contrast pivot point (0.18 ≈ mid-grey).',
      onChange: function (v) { _state.contrastPivot = v; _scheduleLive(); }
    });
    container.appendChild(_linearToggle.el);
    container.appendChild(_tonemapDD.el);
    container.appendChild(_sliders.highlightComp.el);
    container.appendChild(_sliders.contrastPivot.el);

    // Apply row: target mode + live dot + button
    _applyMode = new ButtonGroup({
      tooltip: 'Grade the whole scene via a "Color Lab" adjustment layer, or apply to the selected layer(s).',
      options: [ { value: 'adj', label: 'Adj Layer' }, { value: 'sel', label: 'Selected' } ],
      value: 'adj',
      onChange: function (v) { _state.applyToSelection = (v === 'sel'); _scheduleLive(); }
    });
    container.appendChild(_applyMode.el);

    var applyRow = Utils.el('div', { style: 'display:flex;align-items:center;gap:7px;margin-top:8px;' });
    _liveDot = Utils.el('div', {
      title: 'Live preview — changes send to AE automatically',
      style: 'width:7px;height:7px;border-radius:50%;background:var(--success);opacity:0.4;flex-shrink:0;transition:opacity 0.2s;'
    });
    var liveLabel = Utils.el('span', { style: 'font-size:9px;color:var(--text-dim);letter-spacing:0.05em;' }, 'Live');
    var resetBtn = Utils.el('button', { class: 'action-btn secondary', title: 'Reset all controls to neutral', style: 'margin-top:0;flex:0 0 auto;width:auto;padding:9px 12px;' }, 'Reset');
    resetBtn.addEventListener('click', function () { resetAll(); });
    var applyBtn = Utils.el('button', { class: 'action-btn', style: 'margin-top:0;flex:1;' }, 'Apply Color');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    applyRow.appendChild(_liveDot); applyRow.appendChild(liveLabel); applyRow.appendChild(resetBtn); applyRow.appendChild(applyBtn);
    container.appendChild(applyRow);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);

    // Make sections collapsible (progressive disclosure); collapse Output by default.
    if (window.Sections && Sections.makeCollapsible) {
      Sections.makeCollapsible(container);
      var labels = container.querySelectorAll('.section-label');
      if (labels.length) labels[labels.length - 1].click(); // start "Output" collapsed
    }
  }

  function _apply(btn) {
    btn.disabled = true; btn.classList.add('loading'); btn.textContent = 'Grading…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('colorlab.apply', getParams()).then(function (r) {
      btn.disabled = false; btn.classList.remove('loading'); btn.textContent = 'Apply Color';
      if (r && r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else { _status.className = 'status-bar success'; _status.textContent = 'Graded "' + (r && r.layer) + '" (' + (r && r.count) + ' layer' + ((r && r.count) === 1 ? '' : 's') + ')'; }
    }).catch(function (e) {
      btn.disabled = false; btn.classList.remove('loading'); btn.textContent = 'Apply Color';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());

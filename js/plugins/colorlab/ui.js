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
    linearLight: true, tonemap: 2, highlightComp: 50,
    applyToSelection: false
  };
  var _state = Utils.deepClone(_defaults);

  var _sliders = {}, _wheels = {}, _linearToggle, _tonemapDD, _applyMode, _status;

  function getParams() { return Utils.deepClone(_state); }

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

  // ── DaVinci-style wheel: outer hue ring + inner saturation disc ─
  function _drawWheel(canvas, dotX, dotY) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var outerR = cx - 0.5;
    var ringW  = Math.round(outerR * 0.18);
    var gap    = 2;
    var innerR = outerR - ringW - gap;

    // Premium dark machined trackball: dark radial body + faint rim hue-ring
    // (not a bright rainbow), crisp crosshair, glowing magenta handle.
    var rimVis = Math.max(3, Math.round(outerR * 0.12));
    var bodyEdge = outerR - rimVis;
    var img = ctx.createImageData(W, H), data = img.data;
    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var bx = px - cx, by = cy - py;
        var dist = Math.sqrt(bx * bx + by * by);
        var idx = (py * W + px) * 4;
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

    // bezel ring (subtle dark + highlight) at the body edge
    ctx.beginPath(); ctx.arc(cx, cy, bodyEdge, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();

    // faint crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - innerR * 0.92, cy); ctx.lineTo(cx + innerR * 0.92, cy);
    ctx.moveTo(cx, cy - innerR * 0.92); ctx.lineTo(cx, cy + innerR * 0.92);
    ctx.stroke();

    // center pip
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();

    // glowing magenta handle
    var dotDist = Math.sqrt(dotX * dotX + dotY * dotY);
    var hx = cx + dotX * innerR, hy = cy - dotY * innerR;
    if (dotDist > 0.025) {
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
    function updateFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      var cxr = rect.width / 2, cyr = rect.height / 2;
      var outerRPx = Math.min(cxr, cyr) - 0.5;
      var ringWPx = Math.round(outerRPx * 0.18), gapPx = 2;
      var innerRPx = outerRPx - ringWPx - gapPx;
      var rawX = (e.clientX - rect.left - cxr) / innerRPx;
      var rawY = (cyr - (e.clientY - rect.top)) / innerRPx;
      var d = Math.sqrt(rawX * rawX + rawY * rawY);
      if (d > 1) { rawX /= d; rawY /= d; }
      _state[xKey] = rawX; _state[yKey] = rawY;
      _drawWheel(canvas, rawX, rawY); _updateHueVal(rawX, rawY); _scheduleLive();
    }
    canvas.addEventListener('mousedown', function (e) {
      _activeDrag = { update: updateFromEvent }; updateFromEvent(e); e.preventDefault();
    });
    lumaInput.addEventListener('input', function () {
      var v = parseInt(lumaInput.value, 10);
      _state[lumaKey] = v; _updateLumaVal(v); _scheduleLive();
    });
    resetBtn.addEventListener('click', function () {
      _state[xKey] = 0; _state[yKey] = 0; _drawWheel(canvas, 0, 0); _updateHueVal(0, 0); _scheduleLive();
    });

    _drawWheel(canvas, _state[xKey] || 0, _state[yKey] || 0);
    _updateHueVal(_state[xKey] || 0, _state[yKey] || 0);
    _updateLumaVal(_state[lumaKey] || 0);

    return {
      el: cell,
      redraw: function (x, y) { _state[xKey] = x; _state[yKey] = y; _drawWheel(canvas, x || 0, y || 0); _updateHueVal(x || 0, y || 0); },
      setLuma: function (v) { _state[lumaKey] = v; lumaInput.value = v; _updateLumaVal(v); }
    };
  }

  document.addEventListener('mousemove', function (e) { if (_activeDrag) _activeDrag.update(e); });
  document.addEventListener('mouseup', function () { _activeDrag = null; });

  function _section(c, text) { c.appendChild(Utils.el('div', { class: 'section-label' }, text)); }

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
      tooltip: 'Contrast around the pivot, in linear light.',
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

    // Output
    _section(container, 'Output');
    _linearToggle = new Toggle({
      label: 'Linear Light', value: true,
      tooltip: 'Grade in linear light (physically correct exposure/contrast). Recommended.',
      onChange: function (v) { _state.linearLight = v; _scheduleLive(); }
    });
    _tonemapDD = new Dropdown({
      label: 'Tonemap',
      tooltip: 'Roll off highlights so boosts do not hard-clip to white.',
      options: [ { value: 1, label: 'None' }, { value: 2, label: 'Soft-clip' }, { value: 3, label: 'Filmic' } ],
      value: 2,
      onChange: function (v) { _state.tonemap = v; _scheduleLive(); }
    });
    _sliders.highlightComp = new Slider({
      label: 'Highlight Cmp', min: 0, max: 100, value: 50, step: 1, defaultValue: 50,
      tooltip: 'How hard the tonemap compresses the brightest values.',
      onChange: function (v) { _state.highlightComp = v; _scheduleLive(); }
    });
    _sliders.contrastPivot = new Slider({
      label: 'Pivot', min: 0, max: 1, value: 0.18, step: 0.01, decimals: 2, defaultValue: 0.18,
      tooltip: 'Contrast pivot point in linear (0.18 = scene mid-grey).',
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
    var applyBtn = Utils.el('button', { class: 'action-btn', style: 'margin-top:0;flex:1;' }, 'Apply Color');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    applyRow.appendChild(_liveDot); applyRow.appendChild(liveLabel); applyRow.appendChild(applyBtn);
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

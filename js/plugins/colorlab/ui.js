'use strict';

window.ColorLabUI = (function () {

  // ── Default State ──────────────────────────────────────────
  var _defaults = {
    look: 'none', lookIntensity: 100,
    exposure: 0, temperature: 0, colorTint: 0,
    liftX: 0, liftY: 0, liftLuma: 0,
    gammaX: 0, gammaY: 0, gammaLuma: 0,
    gainX: 0, gainY: 0, gainLuma: 0,
    hue: 0, saturation: 0, lightness: 0, brightness: 0, contrast: 0,
    hslEnable: false, hslChannel: 'reds', hslHueAdj: 0, hslSatAdj: 0, hslLumAdj: 0,
    skinProtect: false, skinProtectAmt: 50,
    tintAmount: 0, tintBlack: '#000000', tintWhite: '#ffffff',
    grainAmount: 0, grainColor: false,
    vignetteAmount: 0, vignetteMidpoint: 50
  };
  var _state = Utils.deepClone(_defaults);

  var _lookDD, _sliders = {}, _toggles = {}, _colors = {};
  var _wheels = {};
  var _hslDD, _status;

  // ── Live Preview ───────────────────────────────────────────
  var _liveEnabled = true;
  var _liveTimer   = null;
  var _liveDot     = null;

  function _scheduleLive() {
    if (!_liveEnabled) return;
    clearTimeout(_liveTimer);
    if (_liveDot) _liveDot.style.opacity = '0.5';
    _liveTimer = setTimeout(function () {
      if (_liveDot) _liveDot.style.opacity = '1';
      Bridge.call('colorlab.apply', getParams()).then(function () {
        if (_liveDot) _liveDot.style.opacity = '0.4';
      }).catch(function () {
        if (_liveDot) _liveDot.style.opacity = '0';
      });
    }, 450);
  }

  function getParams()  { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    _lookDD.setValue(p.look);
    _sliders.lookIntensity.setValue(p.lookIntensity || 100);
    _sliders.exposure.setValue(p.exposure || 0);
    _sliders.temperature.setValue(p.temperature || 0);
    _sliders.colorTint.setValue(p.colorTint || 0);
    _sliders.hue.setValue(p.hue || 0);
    _sliders.saturation.setValue(p.saturation || 0);
    _sliders.lightness.setValue(p.lightness || 0);
    _sliders.brightness.setValue(p.brightness || 0);
    _sliders.contrast.setValue(p.contrast || 0);
    _toggles.hslEnable.setValue(p.hslEnable || false);
    _hslDD.setValue(p.hslChannel || 'reds');
    _sliders.hslHueAdj.setValue(p.hslHueAdj || 0);
    _sliders.hslSatAdj.setValue(p.hslSatAdj || 0);
    _sliders.hslLumAdj.setValue(p.hslLumAdj || 0);
    _toggles.skinProtect.setValue(p.skinProtect || false);
    _sliders.skinProtectAmt.setValue(p.skinProtectAmt || 50);
    _sliders.tintAmount.setValue(p.tintAmount || 0);
    _colors.tintBlack.setValue(p.tintBlack || '#000000');
    _colors.tintWhite.setValue(p.tintWhite || '#ffffff');
    _sliders.grainAmount.setValue(p.grainAmount || 0);
    _toggles.grainColor.setValue(p.grainColor || false);
    _sliders.vignetteAmount.setValue(p.vignetteAmount || 0);
    _sliders.vignetteMidpoint.setValue(p.vignetteMidpoint || 50);
    _wheels.lift.redraw(p.liftX || 0, p.liftY || 0);
    _wheels.lift.setLuma(p.liftLuma || 0);
    _wheels.gamma.redraw(p.gammaX || 0, p.gammaY || 0);
    _wheels.gamma.setLuma(p.gammaLuma || 0);
    _wheels.gain.redraw(p.gainX || 0, p.gainY || 0);
    _wheels.gain.setLuma(p.gainLuma || 0);
  }

  // ── Color Helpers ──────────────────────────────────────────
  function _hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  function _hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = _hue2rgb(p, q, h + 1/3);
      g = _hue2rgb(p, q, h);
      b = _hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  // ── DaVinci-Style Wheel: outer hue ring + inner disc ───────
  function _drawWheel(canvas, dotX, dotY) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var outerR = cx - 0.5;
    var ringW  = Math.round(outerR * 0.18);   // ring is 18% of radius
    var gap    = 2;
    var innerR = outerR - ringW - gap;

    var img  = ctx.createImageData(W, H);
    var data = img.data;

    for (var py = 0; py < H; py++) {
      for (var px = 0; px < W; px++) {
        var bx   = px - cx, by = cy - py;     // Y-up coordinates
        var dist = Math.sqrt(bx * bx + by * by);
        var idx  = (py * W + px) * 4;

        if (dist > outerR) { data[idx + 3] = 0; continue; }

        var angle = Math.atan2(by, bx);
        if (angle < 0) angle += 2 * Math.PI;
        var hue = angle / (2 * Math.PI);

        if (dist >= outerR - ringW) {
          // ── Outer hue ring ──
          var rgb = _hslToRgb(hue, 1.0, 0.5);
          // Parabolic brightness: bright in ring middle, slightly dimmer at edges
          var t = (dist - (outerR - ringW)) / ringW;
          var bright = 1 - 0.25 * Math.pow(2 * t - 1, 2);
          data[idx]     = Math.min(255, Math.round(rgb.r * bright));
          data[idx + 1] = Math.min(255, Math.round(rgb.g * bright));
          data[idx + 2] = Math.min(255, Math.round(rgb.b * bright));
          data[idx + 3] = 255;

        } else if (dist > innerR) {
          // ── Dark gap ──
          data[idx]     = 14;
          data[idx + 1] = 14;
          data[idx + 2] = 14;
          data[idx + 3] = 255;

        } else {
          // ── Inner saturation/hue disc ──
          var sat  = dist / innerR;
          var rgb2 = _hslToRgb(hue, sat, 0.5);
          // Blend white toward center (white-point at center)
          var w = Math.pow(1 - sat, 1.4) * 0.75;
          var r2 = rgb2.r + (255 - rgb2.r) * w;
          var g2 = rgb2.g + (255 - rgb2.g) * w;
          var b2 = rgb2.b + (255 - rgb2.b) * w;
          // Subtle edge darkening
          var edge = sat > 0.88 ? Math.max(0.7, 1 - (sat - 0.88) * 2.8) : 1;
          data[idx]     = Math.min(255, Math.round(r2 * edge));
          data[idx + 1] = Math.min(255, Math.round(g2 * edge));
          data[idx + 2] = Math.min(255, Math.round(b2 * edge));
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    var dotDist = Math.sqrt(dotX * dotX + dotY * dotY);

    // ── Ring hue indicator (shows direction on outer ring) ──
    if (dotDist > 0.025) {
      var ringMidR = outerR - ringW / 2;
      var dotAngle = Math.atan2(dotY, dotX);
      var indX = cx + Math.cos(dotAngle) * ringMidR;
      var indY = cy - Math.sin(dotAngle) * ringMidR;
      ctx.beginPath();
      ctx.arc(indX, indY, ringW * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Inner disc dot (selector) ──
    var innerDotX = cx + dotX * innerR;
    var innerDotY = cy - dotY * innerR;
    var isCenter  = dotDist < 0.025;
    var dotR      = isCenter ? 2.5 : 4.5;

    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = isCenter ? 2 : 5;
    ctx.beginPath();
    ctx.arc(innerDotX, innerDotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = isCenter ? 'rgba(180,180,180,0.7)' : '#ffffff';
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }

  // ── Luma slider background (centre-origin fill) ────────────
  function _setLumaBg(input, val) {
    var pct    = (val + 100) / 200 * 100;
    var center = 50;
    var lo     = Math.min(pct, center);
    var hi     = Math.max(pct, center);
    // Use a CSS color that works without custom property in gradient
    var accentFallback = '#4d9fff';
    input.style.background = [
      'linear-gradient(to right',
      'var(--surface-4) 0%',
      'var(--surface-4) ' + lo + '%',
      accentFallback + ' ' + lo + '%',
      accentFallback + ' ' + hi + '%',
      'var(--surface-4) ' + hi + '%',
      'var(--surface-4) 100%'
    ].join(', ') + ')';
  }

  // ── Hue direction text ─────────────────────────────────────
  var _HUE_DIRS = ['Red', 'Ylw', 'Grn', 'Cyn', 'Blu', 'Mag'];

  function _wheelValueText(x, y) {
    var d = Math.sqrt(x * x + y * y);
    if (d < 0.025) return '—';
    var deg = Math.atan2(y, x) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    var dirIdx = Math.round(deg / 60) % 6;
    return _HUE_DIRS[dirIdx] + ' ' + Math.round(d * 100) + '%';
  }

  // ── Shared drag state ──────────────────────────────────────
  var _activeDrag = null;

  // ── Wheel cell factory ─────────────────────────────────────
  function _makeWheelCell(label, xKey, yKey, lumaKey) {
    var cell = Utils.el('div', { class: 'cl-wheel-cell' });

    // Title
    cell.appendChild(Utils.el('div', { class: 'cl-wheel-title' }, label));

    // Canvas wrap
    var canvasWrap = Utils.el('div', { class: 'cl-wheel-canvas-wrap' });
    var canvas = document.createElement('canvas');
    canvas.width  = 88;
    canvas.height = 88;
    canvas.className = 'cl-wheel-canvas';
    var resetBtn = Utils.el('button', { class: 'cl-wheel-reset', title: 'Reset ' + label }, '×');
    canvasWrap.appendChild(canvas);
    canvasWrap.appendChild(resetBtn);
    cell.appendChild(canvasWrap);

    // Luma mini-slider
    var lumaWrap = Utils.el('div', { class: 'cl-luma-wrap' });
    var lumaInput = document.createElement('input');
    lumaInput.type  = 'range';
    lumaInput.min   = -100;
    lumaInput.max   = 100;
    lumaInput.step  = 1;
    lumaInput.value = _state[lumaKey] || 0;
    lumaInput.className = 'cl-luma-mini';
    lumaInput.title = label + ' luminance offset';
    var lumaVal = Utils.el('div', { class: 'cl-luma-val' }, '');
    _setLumaBg(lumaInput, _state[lumaKey] || 0);
    lumaWrap.appendChild(lumaInput);
    lumaWrap.appendChild(lumaVal);
    cell.appendChild(lumaWrap);

    // Hue value readout
    var valueEl = Utils.el('div', { class: 'cl-wheel-value' }, '—');
    cell.appendChild(valueEl);

    // ── Value updaters ──────────────────────────────────────
    function _updateHueVal(x, y) {
      var txt = _wheelValueText(x, y);
      valueEl.textContent = txt;
      valueEl.classList.toggle('active', txt !== '—');
    }

    function _updateLumaVal(v) {
      var display = v !== 0 ? (v > 0 ? '+' + v : '' + v) : '';
      lumaVal.textContent = display;
      lumaVal.classList.toggle('nonzero', v !== 0);
      _setLumaBg(lumaInput, v);
    }

    // ── Canvas drag ─────────────────────────────────────────
    function updateFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      var cxr  = rect.width / 2, cyr = rect.height / 2;
      var rPx  = Math.min(cxr, cyr) - 0.5;
      // Map into inner disc coordinates
      var outerRPx = rPx;
      var ringWPx  = Math.round(outerRPx * 0.18);
      var gapPx    = 2;
      var innerRPx = outerRPx - ringWPx - gapPx;
      var rawX = (e.clientX - rect.left - cxr) / innerRPx;
      var rawY = (cyr - (e.clientY - rect.top)) / innerRPx;
      var d    = Math.sqrt(rawX * rawX + rawY * rawY);
      if (d > 1) { rawX /= d; rawY /= d; }
      _state[xKey] = rawX;
      _state[yKey] = rawY;
      _drawWheel(canvas, rawX, rawY);
      _updateHueVal(rawX, rawY);
      _scheduleLive();
    }

    canvas.addEventListener('mousedown', function (e) {
      _activeDrag = { update: updateFromEvent };
      updateFromEvent(e);
      e.preventDefault();
    });

    // ── Luma input ──────────────────────────────────────────
    lumaInput.addEventListener('input', function () {
      var v = parseInt(lumaInput.value, 10);
      _state[lumaKey] = v;
      _updateLumaVal(v);
      _scheduleLive();
    });

    // ── Reset (colour wheel only, preserves luma) ───────────
    resetBtn.addEventListener('click', function () {
      _state[xKey] = 0;
      _state[yKey] = 0;
      _drawWheel(canvas, 0, 0);
      _updateHueVal(0, 0);
    });

    // Initial draw
    _drawWheel(canvas, _state[xKey] || 0, _state[yKey] || 0);
    _updateHueVal(_state[xKey] || 0, _state[yKey] || 0);
    _updateLumaVal(_state[lumaKey] || 0);

    return {
      el: cell,
      redraw: function (x, y) {
        _state[xKey] = x; _state[yKey] = y;
        _drawWheel(canvas, x || 0, y || 0);
        _updateHueVal(x || 0, y || 0);
      },
      setLuma: function (v) {
        _state[lumaKey] = v;
        lumaInput.value = v;
        _updateLumaVal(v);
      }
    };
  }

  // Shared mouse handlers
  document.addEventListener('mousemove', function (e) {
    if (_activeDrag) _activeDrag.update(e);
  });
  document.addEventListener('mouseup', function () { _activeDrag = null; });

  // ── Section + row helpers ──────────────────────────────────
  function _section(c, text) {
    c.appendChild(Utils.el('div', { class: 'section-label' }, text));
  }

  function _row2(a, b) {
    var r = Utils.el('div', { class: 'row-2' });
    r.appendChild(a); r.appendChild(b);
    return r;
  }

  // ── Init ───────────────────────────────────────────────────
  function init(container) {

    // ── Film Look ──────────────────────────────────────────
    _section(container, 'Film Look');
    _lookDD = new Dropdown({
      label: 'Look Preset',
      tooltip: 'Cinema-inspired base grade applied before manual adjustments',
      options: [
        { value: 'none',                  label: 'None' },
        { value: 'bleach_bypass',         label: 'Bleach Bypass' },
        { value: 'cinematic_teal_orange', label: 'Teal & Orange' },
        { value: 'vintage',               label: 'Vintage' },
        { value: 'cool_blue',             label: 'Cool Blue' },
        { value: 'warm_golden',           label: 'Warm Golden' },
        { value: 'horror',                label: 'Horror' },
        { value: 'golden_hour',           label: 'Golden Hour' },
        { value: 'moonlight',             label: 'Moonlight' },
        { value: 'neon_noir',             label: 'Neon Noir' },
        { value: 'faded_film',            label: 'Faded Film' },
        { value: 'cross_process',         label: 'Cross Process' },
        { value: 'cyberpunk',             label: 'Cyberpunk' },
        { value: 'documentary',           label: 'Documentary' },
        { value: 'studio_portrait',       label: 'Studio Portrait' },
        { value: 'infrared',              label: 'Infrared' }
      ],
      value: 'none',
      onChange: function (v) { _state.look = v; _scheduleLive(); }
    });
    _sliders.lookIntensity = new Slider({
      label: 'Intensity %', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: '0 = off, 100 = full look strength',
      onChange: function (v) { _state.lookIntensity = v; _scheduleLive(); }
    });
    container.appendChild(_lookDD.el);
    container.appendChild(_sliders.lookIntensity.el);

    // ── Exposure & Temperature ─────────────────────────────
    _section(container, 'Exposure & Temperature');
    _sliders.exposure = new Slider({
      label: 'Exposure (stops)', min: -3, max: 3, value: 0, step: 0.1, decimals: 1, defaultValue: 0,
      tooltip: 'Photometric exposure — 1 stop doubles perceived brightness',
      onChange: function (v) { _state.exposure = v; _scheduleLive(); }
    });
    _sliders.temperature = new Slider({
      label: 'Temperature', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Negative = cool/blue, positive = warm/orange',
      onChange: function (v) { _state.temperature = v; _scheduleLive(); }
    });
    _sliders.colorTint = new Slider({
      label: 'Tint', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Negative = green shift, positive = magenta shift',
      onChange: function (v) { _state.colorTint = v; _scheduleLive(); }
    });
    container.appendChild(_sliders.exposure.el);
    container.appendChild(_row2(_sliders.temperature.el, _sliders.colorTint.el));

    // ── Color Wheels ───────────────────────────────────────
    _section(container, 'Color Wheels');
    var wheelsRow = Utils.el('div', { class: 'cl-wheels-row' });
    _wheels.lift  = _makeWheelCell('Lift',  'liftX',  'liftY',  'liftLuma');
    _wheels.gamma = _makeWheelCell('Gamma', 'gammaX', 'gammaY', 'gammaLuma');
    _wheels.gain  = _makeWheelCell('Gain',  'gainX',  'gainY',  'gainLuma');
    wheelsRow.appendChild(_wheels.lift.el);
    wheelsRow.appendChild(_wheels.gamma.el);
    wheelsRow.appendChild(_wheels.gain.el);
    container.appendChild(wheelsRow);

    // ── Global Adjustments ─────────────────────────────────
    _section(container, 'Global');
    _sliders.hue = new Slider({
      label: 'Hue °', min: -180, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Master hue rotation across all colors',
      onChange: function (v) { _state.hue = v; _scheduleLive(); }
    });
    _sliders.saturation = new Slider({
      label: 'Saturation', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Master saturation boost (+) or reduce (−)',
      onChange: function (v) { _state.saturation = v; _scheduleLive(); }
    });
    _sliders.lightness = new Slider({
      label: 'Lightness', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Master luminance offset',
      onChange: function (v) { _state.lightness = v; _scheduleLive(); }
    });
    _sliders.brightness = new Slider({
      label: 'Brightness', min: -150, max: 150, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.brightness = v; _scheduleLive(); }
    });
    _sliders.contrast = new Slider({
      label: 'Contrast', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.contrast = v; _scheduleLive(); }
    });
    container.appendChild(_sliders.hue.el);
    container.appendChild(_sliders.saturation.el);
    container.appendChild(_sliders.lightness.el);
    container.appendChild(_row2(_sliders.brightness.el, _sliders.contrast.el));

    // ── HSL Selective Color ────────────────────────────────
    _section(container, 'HSL Selective');
    _toggles.hslEnable = new Toggle({
      label: 'Enable selective color correction',
      value: false,
      tooltip: 'Target a specific hue range for isolated correction',
      onChange: function (v) { _state.hslEnable = v; _scheduleLive(); }
    });
    _hslDD = new Dropdown({
      label: 'Target Color',
      options: [
        { value: 'reds',     label: 'Reds (skin, lips, fire)' },
        { value: 'yellows',  label: 'Yellows (sun, skin, foliage)' },
        { value: 'greens',   label: 'Greens (foliage, nature)' },
        { value: 'cyans',    label: 'Cyans (water, sky)' },
        { value: 'blues',    label: 'Blues (sky, shadows)' },
        { value: 'magentas', label: 'Magentas (flowers, neon)' }
      ],
      value: 'reds',
      onChange: function (v) { _state.hslChannel = v; _scheduleLive(); }
    });
    _sliders.hslHueAdj = new Slider({
      label: 'Hue Adjust °', min: -60, max: 60, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.hslHueAdj = v; _scheduleLive(); }
    });
    _sliders.hslSatAdj = new Slider({
      label: 'Saturation', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.hslSatAdj = v; _scheduleLive(); }
    });
    _sliders.hslLumAdj = new Slider({
      label: 'Lightness', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.hslLumAdj = v; _scheduleLive(); }
    });
    container.appendChild(_toggles.hslEnable.el);
    container.appendChild(_hslDD.el);
    container.appendChild(_sliders.hslHueAdj.el);
    container.appendChild(_row2(_sliders.hslSatAdj.el, _sliders.hslLumAdj.el));

    // ── Skin Tone Protection ───────────────────────────────
    _section(container, 'Skin Protection');
    _toggles.skinProtect = new Toggle({
      label: 'Protect skin tones',
      value: false,
      tooltip: 'Preserves warmth and saturation of skin tones during grading',
      onChange: function (v) { _state.skinProtect = v; _scheduleLive(); }
    });
    _sliders.skinProtectAmt = new Slider({
      label: 'Strength %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50,
      onChange: function (v) { _state.skinProtectAmt = v; _scheduleLive(); }
    });
    container.appendChild(_toggles.skinProtect.el);
    container.appendChild(_sliders.skinProtectAmt.el);

    // ── Two-Color Tint ─────────────────────────────────────
    _section(container, 'Tint');
    _sliders.tintAmount = new Slider({
      label: 'Amount %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Blend a two-color tint — 0 = off, 100 = fully tinted',
      onChange: function (v) { _state.tintAmount = v; _scheduleLive(); }
    });
    _colors.tintBlack = new ColorPicker({ label: 'Map Black', value: '#000000',
      onChange: function (v) { _state.tintBlack = v; _scheduleLive(); } });
    _colors.tintWhite = new ColorPicker({ label: 'Map White', value: '#ffffff',
      onChange: function (v) { _state.tintWhite = v; _scheduleLive(); } });
    container.appendChild(_sliders.tintAmount.el);
    container.appendChild(_row2(_colors.tintBlack.el, _colors.tintWhite.el));

    // ── Film Grain ─────────────────────────────────────────
    _section(container, 'Grain');
    _sliders.grainAmount = new Slider({
      label: 'Amount %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Analog film grain simulation — 0 = off',
      onChange: function (v) { _state.grainAmount = v; _scheduleLive(); }
    });
    _toggles.grainColor = new Toggle({
      label: 'Chromatic grain (RGB per channel)',
      value: false,
      onChange: function (v) { _state.grainColor = v; _scheduleLive(); }
    });
    container.appendChild(_sliders.grainAmount.el);
    container.appendChild(_toggles.grainColor.el);

    // ── Vignette ───────────────────────────────────────────
    _section(container, 'Vignette');
    _sliders.vignetteAmount = new Slider({
      label: 'Strength', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Dark edge vignette — 0 = off, 100 = heavy',
      onChange: function (v) { _state.vignetteAmount = v; _scheduleLive(); }
    });
    _sliders.vignetteMidpoint = new Slider({
      label: 'Midpoint %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50,
      tooltip: 'How far the vignette extends inward',
      onChange: function (v) { _state.vignetteMidpoint = v; _scheduleLive(); }
    });
    container.appendChild(_row2(_sliders.vignetteAmount.el, _sliders.vignetteMidpoint.el));

    // ── Apply row ──────────────────────────────────────────
    var applyRow = Utils.el('div', { style: 'display:flex;align-items:center;gap:7px;margin-top:10px;' });
    _liveDot = Utils.el('div', {
      title: 'Live preview — changes send to AE automatically',
      style: 'width:7px;height:7px;border-radius:50%;background:var(--success);opacity:0.4;flex-shrink:0;transition:opacity 0.2s;'
    });
    var liveLabel = Utils.el('span', { style: 'font-size:9px;color:var(--text-dim);letter-spacing:0.05em;' }, 'Live');
    var applyBtn  = Utils.el('button', { class: 'action-btn', style: 'margin-top:0;flex:1;padding:8px 10px;' }, 'Apply Grade');
    applyRow.appendChild(_liveDot);
    applyRow.appendChild(liveLabel);
    applyRow.appendChild(applyBtn);
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyRow);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'Grading…';
    _status.className  = 'status-bar';
    _status.textContent = '';
    Bridge.call('colorlab.apply', getParams()).then(function (r) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'Apply Grade';
      if (r.error) {
        _status.className   = 'status-bar error';
        _status.textContent = r.error;
      } else {
        _status.className   = 'status-bar success';
        _status.textContent = r.effects + ' effects on "' + r.layer + '"';
      }
    }).catch(function (e) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'Apply Grade';
      _status.className   = 'status-bar error';
      _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());

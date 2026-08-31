'use strict';

window.GlowUI = (function() {
  var _state = {
    // --- existing fields (keep for backward-compat) ---
    intensity:          150,
    radius:             60,
    falloff:            'soft',
    threshold:          80,
    glowColor:          '#ffffff',
    colorize:           false,
    saturation:         0,
    hueShift:           0,
    blendMode:          'screen',
    layers:             2,
    quality:            'quality',
    // --- new v0.1 MVP fields ---
    tintAmount:         0,
    sourceGain:         100,
    thresholdSoftness:  20,
    glowOnly:           false,
    useController:      true,
    glowDimensions:     'both',
    // --- native-engine fields (DeepGlowGPU.aex) ---
    rangeMode:          1,      // 1 Luminance, 2 Saturation, 3 Hue
    rangeHigh:          255,    // 0..255 upper edge (255 = open top)
    rangeHighSoft:      0,      // 0..100 upper feather
    invertRange:        false,
    linearLight:        true,
    tonemap:            2,      // 1 None, 2 Soft-clip, 3 Filmic
    highlightComp:      0       // 0..100
  };

  function getParams() { return Utils.deepClone(_state); }

  // Mirror of glow::selValue (glow_params.h): qualifier value 0..1 for a pixel
  // under the current Range Mode, in DISPLAY space (matches the engine's now-
  // perceptual threshold). Keep bit-aligned with the C++ helper.
  function selValueJS(r, g, b, mode) {
    if (mode === 2) {                                  // saturation (HSV)
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mx <= 1e-6 ? 0 : (mx - mn) / mx;
    }
    if (mode === 3) {                                  // hue 0..1
      var hmx = Math.max(r, g, b), hmn = Math.min(r, g, b), d = hmx - hmn;
      if (d <= 1e-6) return 0;
      var h;
      if      (hmx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (hmx === g) h = (b - r) / d + 2;
      else                h = (r - g) / d + 4;
      return h / 6;
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;       // luminance (Rec.709)
  }

  // 256-bin distribution of the qualifier over a canvas ImageData, normalized
  // to 0..1 (peak bin = 1). Skips fully-transparent pixels. Drawn behind the
  // selection band on the same 0..255 axis.
  function computeHistogram(imageData, mode) {
    var bins = new Array(256), i;
    for (i = 0; i < 256; i++) bins[i] = 0;
    var px = imageData.data, n = px.length, mx = 0;
    for (var p = 0; p < n; p += 4) {
      if (px[p + 3] === 0) continue;
      var v = selValueJS(px[p] / 255, px[p + 1] / 255, px[p + 2] / 255, mode);
      var b = v < 0 ? 0 : (v > 1 ? 255 : Math.round(v * 255));
      bins[b]++; if (bins[b] > mx) mx = bins[b];
    }
    if (mx > 0) for (var k = 0; k < 256; k++) bins[k] /= mx;
    return bins;
  }

  var _sliders = {};
  var _falloffGroup, _blendDD, _qualityGroup, _glowColor, _colorizeToggle, _status;
  var _glowOnlyToggle, _useControllerToggle, _stretchGroup;
  var _glowSel, _rangeModeGroup, _invertToggle, _tonemapDD, _linearToggle;

  // Debounced live-apply: pushes params to the native effect (which is reused on
  // the layer) so dragging the widget/sliders updates the glow in-host.
  var _liveTimer = null;
  function _applyLive() {
    if (_liveTimer) clearTimeout(_liveTimer);
    _liveTimer = setTimeout(function() {
      Bridge.call('glow.apply', getParams()).then(function(r) {
        if (_status) {
          if (r && r.error) { _status.className = 'status-bar error';   _status.textContent = r.error; }
          else              { _status.className = 'status-bar success'; _status.textContent = 'Glow updated.'; }
        }
      }).catch(function(e) { if (_status) { _status.className = 'status-bar error'; _status.textContent = e.message; } });
    }, 160);
  }

  // ── Interactive Glow Selection widget ───────────────────────
  // The grabbed frame's histogram, lit where the glow acts and dimmed where it
  // doesn't. Two thin markers set the range (Threshold and Range High); the
  // feathered edges are driven by the Softness slider and drawn straight into
  // the bars, so the falloff is visible rather than implied. Dragging between
  // the markers slides the whole range. Intensity has its own slider.
  function makeGlowSelection(state, onCommit, syncSliders) {
    var cv = Utils.el('canvas', { class: 'glow-select' });
    cv.style.width = '100%'; cv.style.height = '150px'; cv.style.display = 'block';
    cv.style.borderRadius = '8px'; cv.style.cursor = 'crosshair';
    var ctx = cv.getContext('2d');
    var W = 300, H = 150, PAD = 2, railTop = 14, railBot = H - 26;
    var dragging = null, eyedrop = false, frameHist = null; // real 256-bin histogram or null

    // Size the backing store to the canvas's real on-screen size × devicePixelRatio
    // so the widget stays pixel-crisp at any panel width and on any display density.
    function fit() {
      var r = cv.getBoundingClientRect();
      // A hidden tab (.tab-pane { display:none }) measures 0. Fitting to a
      // fallback width here would bake a too-small bitmap that CSS then stretches
      // when the tab is shown — that was the pixelation. Skip; the ResizeObserver
      // fires again the moment the pane becomes visible and reports a real width.
      if (!r.width || !r.height) return;
      var dpr = window.devicePixelRatio || 1;
      var bw  = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
      // Assigning width/height clears the canvas, so only touch it on real change.
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width; H = r.height; railBot = H - 26;
      draw();
    }
    function xOf(v){ return PAD + (v / 255) * (W - 2 * PAD); }
    function vOf(x){ return Math.max(0, Math.min(255, ((x - PAD) / (W - 2 * PAD)) * 255)); }

    function stripStyle() {
      var g = ctx.createLinearGradient(0, 0, W, 0), i;
      if (state.rangeMode === 3) { for (i = 0; i <= 12; i++) g.addColorStop(i / 12, 'hsl(' + (i / 12 * 360) + ',80%,55%)'); }
      else if (state.rangeMode === 2) { g.addColorStop(0, 'hsl(200,0%,55%)'); g.addColorStop(1, 'hsl(200,90%,55%)'); }
      else { g.addColorStop(0, '#050608'); g.addColorStop(1, '#f4f7ff'); }
      return g;
    }
    function handles() {
      return {
        lowFoot:  Math.max(0,   state.threshold - state.thresholdSoftness),
        lowKnee:  state.threshold,
        highKnee: state.rangeHigh,
        highFoot: Math.min(255, state.rangeHigh + state.rangeHighSoft)
      };
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    // How strongly a tone participates in the glow: 0 outside the range, 1 in
    // the core, feathered across the soft edges. This is the SAME shape the
    // engine applies, so lighting the histogram by it shows the real result
    // instead of a diagram of it.
    function weightOf(v) {
      var hd = handles(), w;
      if (v <= hd.lowFoot || v >= hd.highFoot)      w = 0;
      else if (v < hd.lowKnee)   w = (hd.lowKnee === hd.lowFoot)   ? 1 : (v - hd.lowFoot) / (hd.lowKnee - hd.lowFoot);
      else if (v > hd.highKnee)  w = (hd.highFoot === hd.highKnee) ? 1 : (hd.highFoot - v) / (hd.highFoot - hd.highKnee);
      else w = 1;
      return state.invertRange ? 1 - w : w;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var accent = state.invertRange ? '#7b8cff' : '#46d3e6';
      var hd = handles();

      // The histogram IS the widget: a real 256-bin distribution of the grabbed
      // frame, lit where the glow will act and dimmed where it won't. Falls back
      // to a faint curve so the widget still reads before any Grab Frame.
      var bars = 128, bw = (W - 2 * PAD) / bars;
      for (var i = 0; i < bars; i++) {
        var v = i / (bars - 1) * 255;
        var h = frameHist ? frameHist[Math.round(v)]
                          : Math.exp(-Math.pow((v / 255 - 0.42) / 0.16, 2)) * 0.7 +
                            Math.exp(-Math.pow((v / 255 - 0.80) / 0.08, 2)) * 0.45;
        var bx = PAD + i * bw, by = railBot - (railBot - railTop) * Math.min(1, h) * 0.94;
        var bwid = Math.max(1, bw - 0.6);
        ctx.fillStyle = '#39404d'; ctx.fillRect(bx, by, bwid, railBot - by);
        var wgt = weightOf(v);
        if (wgt > 0) {
          ctx.globalAlpha = wgt; ctx.fillStyle = accent;
          ctx.fillRect(bx, by, bwid, railBot - by); ctx.globalAlpha = 1;
        }
      }

      // A soft wash across the selected span whose edges fade exactly like the
      // falloff — softness you can see rather than read off a slope.
      var xLF = xOf(hd.lowFoot), xHF = xOf(hd.highFoot);
      var span = Math.max(1e-6, hd.highFoot - hd.lowFoot);
      var wash = ctx.createLinearGradient(xLF, 0, xHF, 0);
      var tint = state.invertRange ? '123,140,255' : '70,211,230';
      wash.addColorStop(0, 'rgba(' + tint + ',0)');
      wash.addColorStop(Math.max(0, Math.min(1, (hd.lowKnee  - hd.lowFoot) / span)), 'rgba(' + tint + ',.13)');
      wash.addColorStop(Math.max(0, Math.min(1, (hd.highKnee - hd.lowFoot) / span)), 'rgba(' + tint + ',.13)');
      wash.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.fillStyle = wash; ctx.fillRect(xLF, railTop, xHF - xLF, railBot - railTop);

      // Tone reference: a thin strip under the histogram showing which axis the
      // numbers live on (dark->bright, grey->saturated, or the hue wheel).
      ctx.fillStyle = stripStyle(); ctx.fillRect(PAD, railBot + 6, W - 2 * PAD, 4);

      // Two markers: a 1px line plus a small cap to grab. The hit area stays
      // HANDLE_HIT wide (see pick()) — it just isn't drawn that wide, so the
      // widget stays legible however narrow the panel gets.
      function marker(x, label) {
        ctx.fillStyle = accent;
        ctx.fillRect(x - 0.5, railTop, 1, railBot - railTop);
        rr(x - 4, railTop - 7, 8, 7, 2); ctx.fill();
        ctx.fillStyle = 'rgba(214,218,227,.75)';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(label, Math.max(12, Math.min(W - 12, x)), railBot + 22);
      }
      marker(xOf(hd.lowKnee),  Math.round(hd.lowKnee));
      marker(xOf(hd.highKnee), Math.round(hd.highKnee));
    }

    var HANDLE_HIT = 14;   // px; generous grab zone around each thin marker
    function pick(mx) {
      var hd = handles(), cand = [['lowKnee', xOf(hd.lowKnee)], ['highKnee', xOf(hd.highKnee)]];
      var best = null, bd = HANDLE_HIT;
      for (var i = 0; i < cand.length; i++) { var d = Math.abs(mx - cand[i][1]); if (d < bd) { bd = d; best = cand[i][0]; } }
      return best;
    }
    function applyHandle(name, v) {
      if (name === 'lowKnee') state.threshold = Math.min(v, state.rangeHigh);
      else if (name === 'highKnee') state.rangeHigh = Math.max(v, state.threshold);
    }
    function evX(e){ var r = cv.getBoundingClientRect(); return (e.clientX - r.left) * (W / (r.width  || W)); }

    cv.addEventListener('mousedown', function(e) {
      var x = evX(e);
      if (eyedrop) { var v = vOf(x); state.threshold = Math.max(0, v - 22); state.rangeHigh = Math.min(255, v + 22);
        state.thresholdSoftness = 14; state.rangeHighSoft = 14; eyedrop = false; cv.style.cursor = 'crosshair';
        draw(); syncSliders(); onCommit(); return; }
      var h = pick(x);
      dragging = h || { band: true, start: vOf(x), lo: state.threshold, hi: state.rangeHigh };
      onMove(e);
    });
    function onMove(e) {
      var v = vOf(evX(e));
      if (typeof dragging === 'object' && dragging.band) {
        var d = v - dragging.start, w = dragging.hi - dragging.lo;
        var lo = dragging.lo + d, hi = dragging.hi + d;
        if (lo < 0) { lo = 0; hi = w; } if (hi > 255) { hi = 255; lo = 255 - w; }
        state.threshold = lo; state.rangeHigh = hi;
        // Intensity is NOT set here any more — it has its own slider, and a
        // hidden vertical drag on the band was a second control for one value.
      } else if (dragging) { applyHandle(dragging, v); }
      draw(); syncSliders();
    }
    window.addEventListener('mousemove', function(e) { if (dragging) onMove(e); });
    window.addEventListener('mouseup', function() { if (dragging) { dragging = null; onCommit(); } });

    // Refit whenever the canvas's box actually changes — this covers the panel
    // being dragged wider/narrower AND the 0 -> real-width transition when the
    // Glow tab is switched on for the first time (same approach as the Color Lab
    // wheel, js/plugins/colorlab/ui.js).
    if (window.ResizeObserver) { new ResizeObserver(function () { fit(); }).observe(cv); }

    // Density changes (panel dragged to a monitor with different scaling) don't
    // change the CSS box, so ResizeObserver won't fire — watch dppx instead and
    // re-arm, since each query only matches the density it was created for.
    (function watchDpr() {
      if (!window.matchMedia) return;
      var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      var onChange = function () { fit(); watchDpr(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
      else if (mq.addListener) mq.addListener(onChange);
    }());

    return {
      el: cv, draw: draw, fit: fit,
      setMode: function(m){ state.rangeMode = m; draw(); },
      setHistogram: function(arr){ frameHist = arr; draw(); },
      setEyedrop: function(on){ eyedrop = on; cv.style.cursor = on ? 'copy' : 'crosshair'; }
    };
  }

  function applyPreset(p) {
    // Merge only the keys that exist in the preset object so older presets
    // that don't include the new v0.1 fields still work without errors.
    Object.assign(_state, p);

    // Existing sliders / controls
    _sliders.intensity.setValue(p.intensity);
    _sliders.radius.setValue(p.radius);
    _sliders.threshold.setValue(p.threshold);
    _sliders.saturation.setValue(p.saturation);
    _sliders.hueShift.setValue(p.hueShift);
    _sliders.layers.setValue(p.layers);
    _falloffGroup.setValue(p.falloff);
    _blendDD.setValue(p.blendMode);
    _qualityGroup.setValue(p.quality);
    _glowColor.setValue(p.glowColor);
    _colorizeToggle.setValue(p.colorize);

    // New v0.1 fields — guarded so older presets (missing these keys) are safe
    if (p.tintAmount        !== undefined) { _sliders.tintAmount.setValue(p.tintAmount); }
    if (p.sourceGain        !== undefined) { _sliders.sourceGain.setValue(p.sourceGain); }
    if (p.thresholdSoftness !== undefined && _sliders.softness) { _sliders.softness.setValue(p.thresholdSoftness); }
    if (p.glowOnly          !== undefined) { _glowOnlyToggle.setValue(p.glowOnly); }
    if (p.useController     !== undefined) { _useControllerToggle.setValue(p.useController); }
    if (p.glowDimensions    !== undefined) { _stretchGroup.setValue(p.glowDimensions); }

    // Native-engine fields (guarded for older presets)
    if (p.rangeMode     !== undefined && _rangeModeGroup)        { _rangeModeGroup.setValue(p.rangeMode); }
    if (p.rangeHigh     !== undefined && _sliders.rangeHigh)     { _sliders.rangeHigh.setValue(p.rangeHigh); }
    if (p.invertRange   !== undefined && _invertToggle)         { _invertToggle.setValue(p.invertRange); }
    if (p.linearLight   !== undefined && _linearToggle)        { _linearToggle.setValue(p.linearLight); }
    if (p.tonemap       !== undefined && _tonemapDD)           { _tonemapDD.setValue(p.tonemap); }
    if (p.highlightComp !== undefined && _sliders.highlightComp){ _sliders.highlightComp.setValue(p.highlightComp); }
    if (_glowSel) { _glowSel.setMode(_state.rangeMode); _glowSel.draw(); }
  }

  function init(container) {
    // ── Glow Selection (interactive range qualifier) ─────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Glow Selection'));
    function syncSliders() {
      if (_sliders.threshold)         _sliders.threshold.setValue(Math.round(_state.threshold));
      if (_sliders.softness)          _sliders.softness.setValue(Math.round(_state.thresholdSoftness));
      if (_sliders.intensity)         _sliders.intensity.setValue(Math.round(_state.intensity));
      if (_sliders.rangeHigh)         _sliders.rangeHigh.setValue(Math.round(_state.rangeHigh));
    }
    _glowSel = makeGlowSelection(_state, _applyLive, syncSliders);
    container.appendChild(_glowSel.el);

    // ── Frame preview (real eyedropper) ──────────────────────────────────────
    // A grabbed comp frame. Clicking it samples the real pixel and centers the
    // band; grabbing also rebuilds the histogram behind the band.
    var _thumbCv = Utils.el('canvas', { class: 'glow-thumb' });
    _thumbCv.style.width = '100%'; _thumbCv.style.height = '90px';
    _thumbCv.style.display = 'block'; _thumbCv.style.borderRadius = '8px';
    _thumbCv.style.cursor = 'crosshair'; _thumbCv.style.marginTop = '6px';
    var _thumbCtx = _thumbCv.getContext('2d');
    var _thumbLoaded = false;
    var _thumbImg = null;          // kept so the thumb can be REDRAWN on resize
    container.appendChild(_thumbCv);

    // Redraw the grabbed frame at the canvas's current on-screen size × DPR.
    // Keeping the source Image around means a panel resize re-renders it sharp
    // instead of stretching the bitmap that was baked at grab time.
    function paintThumb() {
      if (!_thumbImg) return;
      var r = _thumbCv.getBoundingClientRect();
      if (!r.width || !r.height) return;      // hidden tab — refit when shown
      var dpr = window.devicePixelRatio || 1;
      var bw = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
      if (_thumbCv.width !== bw || _thumbCv.height !== bh) { _thumbCv.width = bw; _thumbCv.height = bh; }
      _thumbCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      _thumbCtx.clearRect(0, 0, r.width, r.height);
      _thumbCtx.drawImage(_thumbImg, 0, 0, r.width, r.height);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(function () { paintThumb(); refreshHistogram(); }).observe(_thumbCv);
    }

    function refreshHistogram() {
      if (!_thumbLoaded) return;
      var data = _thumbCtx.getImageData(0, 0, _thumbCv.width, _thumbCv.height);
      _glowSel.setHistogram(computeHistogram(data, _state.rangeMode));
    }

    var grabBtn = Utils.el('button', { class: 'mini-btn' }, 'Grab Frame ⤓');
    grabBtn.addEventListener('click', function () {
      var old = grabBtn.textContent; grabBtn.disabled = true; grabBtn.textContent = 'grabbing frame…';
      Bridge.call('glow.grabFrame', {}).then(function (r) {
        grabBtn.disabled = false; grabBtn.textContent = old;
        if (!r || r.error) {
          if (_status) { _status.className = 'status-bar error'; _status.textContent = (r && r.error) || 'Grab failed.'; }
          return;
        }
        var img = new Image();
        img.onload = function () {
          _thumbImg = img; _thumbLoaded = true;
          paintThumb();
          refreshHistogram();
          if (_status) { _status.className = 'status-bar success'; _status.textContent = 'Frame grabbed — click it to pick.'; }
        };
        img.onerror = function () {
          if (_status) { _status.className = 'status-bar error'; _status.textContent = 'Could not load grabbed frame.'; }
        };
        img.src = 'file:///' + String(r.path).replace(/\\/g, '/');
      }).catch(function (e) {
        grabBtn.disabled = false; grabBtn.textContent = old;
        if (_status) { _status.className = 'status-bar error'; _status.textContent = e.message; }
      });
    });
    container.appendChild(grabBtn);

    // Click the frame: sample the pixel, compute its qualifier for the current
    // Range Mode, and center the band on it with soft feet (mirrors centerBand).
    _thumbCv.addEventListener('click', function (e) {
      if (!_thumbLoaded) return;
      var r = _thumbCv.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var px = Math.round((e.clientX - r.left) * dpr);
      var py = Math.round((e.clientY - r.top) * dpr);
      px = Math.max(0, Math.min(_thumbCv.width - 1, px));
      py = Math.max(0, Math.min(_thumbCv.height - 1, py));
      var d = _thumbCtx.getImageData(px, py, 1, 1).data;
      var v = selValueJS(d[0] / 255, d[1] / 255, d[2] / 255, _state.rangeMode) * 255;
      _state.threshold = Math.max(0, v - 22);
      _state.rangeHigh = Math.min(255, v + 22);
      _state.thresholdSoftness = 14; _state.rangeHighSoft = 14;
      _glowSel.draw(); syncSliders(); _applyLive();
    });

    _rangeModeGroup = new ButtonGroup({
      tooltip: 'Which channel the glow selection qualifies on — Luminance, Saturation, or Hue',
      options: [ { value: 1, label: 'Luma' }, { value: 2, label: 'Sat' }, { value: 3, label: 'Hue' } ],
      value: 1,
      onChange: function(v) { _state.rangeMode = v; _glowSel.setMode(v); refreshHistogram(); _applyLive(); }
    });
    _invertToggle = new Toggle({ label: 'Invert Range', value: false,
      tooltip: 'Glow everything OUTSIDE the selected band instead of inside it',
      onChange: function(v) { _state.invertRange = v; _glowSel.draw(); _applyLive(); } });
    var eyeBtn = Utils.el('button', { class: 'mini-btn' }, 'Pick ⌖');
    eyeBtn.addEventListener('click', function() {
      var on = eyeBtn.className.indexOf('on') < 0;
      eyeBtn.className = 'mini-btn' + (on ? ' on' : '');
      _glowSel.setEyedrop(on);
    });
    container.appendChild(_rangeModeGroup.el);
    container.appendChild(_invertToggle.el);
    container.appendChild(eyeBtn);
    // The three numbers behind the widget, kept together and named short enough
    // to fit .slider-label's 58px column (that fixed width is shared with Color
    // Lab and Distort, so we shorten the names rather than reflow every tool).
    _sliders.threshold = new Slider({ label: 'Starts at', min: 0, max: 255, value: 80, step: 1, defaultValue: 80,
      tooltip: 'Tones brighter than this start to glow — the left marker on the histogram',
      onChange: function(v) { _state.threshold = v; _glowSel.draw(); } });
    _sliders.rangeHigh = new Slider({ label: 'Stops at', min: 0, max: 255, value: 255, step: 1, defaultValue: 255,
      tooltip: 'Tones brighter than this stop glowing (255 = the brightest pixels still glow) — the right marker',
      onChange: function(v) { _state.rangeHigh = v; _glowSel.draw(); } });
    // One Softness drives BOTH feathered edges. The engine still takes two
    // independent values; presets that carry different ones load and render
    // fine, the slider just shows the low edge.
    _sliders.softness = new Slider({ label: 'Softness', min: 0, max: 100, value: 20, step: 1, defaultValue: 20,
      tooltip: 'How gradually the glow fades in and out at the edges of the range',
      onChange: function(v) { _state.thresholdSoftness = v; _state.rangeHighSoft = v; _glowSel.draw(); } });
    container.appendChild(_sliders.threshold.el);
    container.appendChild(_sliders.rangeHigh.el);
    container.appendChild(_sliders.softness.el);

    // ── Glow ─────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Glow'));
    _sliders.intensity = new Slider({ label: 'Intensity', min: 0, max: 500, value: 150, step: 1, defaultValue: 150,
      tooltip: 'Overall glow brightness multiplier across all passes',
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 0, max: 500, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Blur radius of the glow spread — larger = softer, wider glow',
      onChange: function(v) { _state.radius = v; } });
    _sliders.layers = new Slider({ label: 'Layers', min: 1, max: 5, value: 2, step: 1, defaultValue: 2,
      tooltip: 'Number of stacked glow passes — more layers = richer, more complex glow',
      onChange: function(v) { _state.layers = v; } });
    _stretchGroup = new ButtonGroup({
      tooltip: 'Stretch the glow into an anamorphic streak — Both (round bloom), Horizontal, or Vertical',
      options: [
        { value: 'both',       label: 'Both' },
        { value: 'horizontal', label: 'Horiz' },
        { value: 'vertical',   label: 'Vert' }
      ],
      value: 'both',
      onChange: function(v) { _state.glowDimensions = v; }
    });
    container.appendChild(_sliders.intensity.el);
    container.appendChild(_sliders.radius.el);
    container.appendChild(_sliders.layers.el);
    container.appendChild(Utils.el('div', { class: 'sub-label' }, 'Stretch'));
    container.appendChild(_stretchGroup.el);

    // ── Source ────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Source'));
    _sliders.sourceGain = new Slider({ label: 'Src Gain', min: 0, max: 300, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Multiply the glow source brightness before it is blurred — boosts dim sources',
      onChange: function(v) { _state.sourceGain = v; } });
    container.appendChild(_sliders.sourceGain.el);

    // ── Falloff ───────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Falloff'));
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
    container.appendChild(_falloffGroup.el);

    // ── Color ─────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Color'));
    _glowColor = new ColorPicker({ label: 'Glow Color', value: '#ffffff',
      tooltip: 'Tint color applied when Colorize or Tint Amount is enabled',
      onChange: function(v) { _state.glowColor = v; } });
    _colorizeToggle = new Toggle({ label: 'Colorize glow', value: false,
      tooltip: 'Apply the Glow Color tint to the glow layers',
      onChange: function(v) { _state.colorize = v; } });
    _sliders.tintAmount = new Slider({ label: 'Tint Amount %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Mix the glow toward the Glow Color — 0 = source color, 100 = full tint',
      onChange: function(v) { _state.tintAmount = v; } });
    _sliders.saturation = new Slider({ label: 'Saturation Boost', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Boost (+) or reduce (−) color saturation of each glow pass',
      onChange: function(v) { _state.saturation = v; } });
    _sliders.hueShift = new Slider({ label: 'Hue Shift °', min: -180, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Rotate the hue of glow layers — creates color-shifted bloom',
      onChange: function(v) { _state.hueShift = v; } });
    container.appendChild(_glowColor.el);
    container.appendChild(_colorizeToggle.el);
    container.appendChild(_sliders.tintAmount.el);
    container.appendChild(_sliders.saturation.el);
    container.appendChild(_sliders.hueShift.el);

    // ── Cinematic (native engine) ────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Cinematic'));
    _linearToggle = new Toggle({ label: 'Linear Light', value: true,
      tooltip: 'Blur in linear light for a physically-correct, never-clipping bloom',
      onChange: function(v) { _state.linearLight = v; } });
    _tonemapDD = new Dropdown({ label: 'Tonemap',
      tooltip: 'Roll highlights off so intense glow never blows out to flat white',
      options: [ { value: 1, label: 'None' }, { value: 2, label: 'Soft-clip' }, { value: 3, label: 'Filmic' } ],
      value: 2,
      onChange: function(v) { _state.tonemap = v; } });
    _sliders.highlightComp = new Slider({ label: 'Highlight Cmp', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'How hard the tonemap compresses the brightest glow',
      onChange: function(v) { _state.highlightComp = v; } });
    container.appendChild(_linearToggle.el);
    container.appendChild(_tonemapDD.el);
    container.appendChild(_sliders.highlightComp.el);

    // ── Output ────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Output'));
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
    _glowOnlyToggle = new Toggle({ label: 'Glow Only', value: false,
      tooltip: 'Hide the source layer so only the glow passes are visible',
      onChange: function(v) { _state.glowOnly = v; } });
    _useControllerToggle = new Toggle({ label: 'Create Live Controller', value: true,
      tooltip: 'Create a GLOW_CONTROLLER null with expression-linked controls for live editing',
      onChange: function(v) { _state.useController = v; } });
    container.appendChild(_blendDD.el);
    container.appendChild(_qualityGroup.el);
    container.appendChild(_glowOnlyToggle.el);
    container.appendChild(_useControllerToggle.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Glow');
    applyBtn.addEventListener('click', function() { _apply(applyBtn); });
    container.appendChild(applyBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);

    // Live update: any native <input>/<select> change (sliders, dropdowns,
    // color) redraws the band and debounce-applies to the reused effect.
    container.addEventListener('input',  function() { if (_glowSel) _glowSel.draw(); _applyLive(); });
    container.addEventListener('change', function() { if (_glowSel) _glowSel.draw(); _applyLive(); });

    // Size the canvas once the panel has laid out, and on resize.
    setTimeout(function() { if (_glowSel) _glowSel.fit(); }, 40);
    window.addEventListener('resize', function() { if (_glowSel) _glowSel.fit(); });
  }

  function _apply(btn) {
    btn.disabled    = true;
    btn.textContent = 'Applying…';
    Bridge.call('glow.apply', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Apply Glow';
      if (result.error) { _status.className = 'status-bar error'; _status.textContent = result.error; }
      else              { _status.className = 'status-bar success'; _status.textContent = 'Glow applied to ' + result.count + ' layer(s).'; }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Apply Glow';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

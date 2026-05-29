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
    useController:      true
  };

  function getParams() { return Utils.deepClone(_state); }

  var _sliders = {};
  var _falloffGroup, _blendDD, _qualityGroup, _glowColor, _colorizeToggle, _status;
  var _glowOnlyToggle, _useControllerToggle;

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
    if (p.thresholdSoftness !== undefined) { _sliders.thresholdSoftness.setValue(p.thresholdSoftness); }
    if (p.glowOnly          !== undefined) { _glowOnlyToggle.setValue(p.glowOnly); }
    if (p.useController     !== undefined) { _useControllerToggle.setValue(p.useController); }
  }

  function init(container) {
    // ── Glow ─────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Glow'));
    _sliders.intensity = new Slider({ label: 'Intensity %', min: 0, max: 500, value: 150, step: 1, defaultValue: 150,
      tooltip: 'Overall glow brightness multiplier across all passes',
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 0, max: 500, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Blur radius of the glow spread — larger = softer, wider glow',
      onChange: function(v) { _state.radius = v; } });
    _sliders.layers = new Slider({ label: 'Glow Layers', min: 1, max: 5, value: 2, step: 1, defaultValue: 2,
      tooltip: 'Number of stacked glow passes — more layers = richer, more complex glow',
      onChange: function(v) { _state.layers = v; } });
    container.appendChild(_sliders.intensity.el);
    container.appendChild(_sliders.radius.el);
    container.appendChild(_sliders.layers.el);

    // ── Source ────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Source'));
    _sliders.sourceGain = new Slider({ label: 'Source Gain %', min: 0, max: 300, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Multiply the glow source brightness before it is blurred — boosts dim sources',
      onChange: function(v) { _state.sourceGain = v; } });
    _sliders.thresholdSoftness = new Slider({ label: 'Threshold Softness', min: 0, max: 100, value: 20, step: 1, defaultValue: 20,
      tooltip: 'Softens the glow threshold edge — higher values widen the glow source',
      onChange: function(v) { _state.thresholdSoftness = v; } });
    container.appendChild(_sliders.sourceGain.el);
    container.appendChild(_sliders.thresholdSoftness.el);

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
    _sliders.threshold = new Slider({ label: 'Threshold (0–255)', min: 0, max: 255, value: 80, step: 1, defaultValue: 80,
      tooltip: 'Minimum pixel brightness to receive glow — raise to restrict glow to bright areas only',
      onChange: function(v) { _state.threshold = v; } });
    container.appendChild(_falloffGroup.el);
    container.appendChild(_sliders.threshold.el);

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

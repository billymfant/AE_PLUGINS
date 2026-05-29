'use strict';

window.SorterUI = (function() {
  var _state = {
    // target / workflow
    targetMode:       'selectedLayers', // selectedLayers | duplicateLayer | adjustmentLayer | precompRig
    applyMode:        'quick',          // quick | rig

    // sorting
    sortMode:         'brightness',
    direction:        'horizontal',
    angle:            0,
    sortLength:       200,
    thresholdLow:     60,
    thresholdHigh:    100,
    thresholdSoftness:10,
    randomness:       0,
    iterations:       1,

    // color key
    useColorKey:      false,
    keyColor:         '#ff0000',
    keyHueTol:        30,

    // animation
    animate:          false,
    animStyle:        'drift', // drift | pulse | thresholdSweep | lengthWave | randomFlicker | scanlineMove
    animSpeed:        1,
    animAmount:       50,
    loopDuration:     2
  };

  function getParams() { return Utils.deepClone(_state); }

  var _sliders = {};
  var _targetGroup, _applyModeGroup, _modeGroup, _dirGroup;
  var _keyToggle, _keyColor, _keyHueTol;
  var _animToggle, _animStyleDD;
  var _status;

  function applyPreset(p) {
    // Merge into state — guard each field so missing keys don't clobber defaults
    Object.assign(_state, p);

    // --- Backward-compat: old single `threshold` → thresholdLow ---
    if (p.thresholdLow === undefined && p.threshold !== undefined) {
      _state.thresholdLow = p.threshold;
    }

    // Existing sliders
    if (p.sortLength  !== undefined) _sliders.sortLength.setValue(p.sortLength);
    if (p.randomness  !== undefined) _sliders.randomness.setValue(p.randomness);
    if (p.iterations  !== undefined) _sliders.iterations.setValue(p.iterations);

    // New threshold sliders (with old-preset fallback)
    var tLow = (p.thresholdLow !== undefined) ? p.thresholdLow : (p.threshold !== undefined ? p.threshold : _state.thresholdLow);
    _sliders.thresholdLow.setValue(tLow);
    if (p.thresholdHigh    !== undefined) _sliders.thresholdHigh.setValue(p.thresholdHigh);
    if (p.thresholdSoftness !== undefined) _sliders.thresholdSoftness.setValue(p.thresholdSoftness);

    // Angle slider
    if (p.angle !== undefined) _sliders.angle.setValue(p.angle);

    // Button groups — only update if value exists in preset
    if (p.targetMode  !== undefined) _targetGroup.setValue(p.targetMode);
    if (p.applyMode   !== undefined) _applyModeGroup.setValue(p.applyMode);
    if (p.sortMode    !== undefined) _modeGroup.setValue(p.sortMode);
    if (p.direction   !== undefined) _dirGroup.setValue(p.direction);

    // Color key
    if (p.useColorKey !== undefined) { _keyToggle.setValue(p.useColorKey); _setKeyEnabled(p.useColorKey); }
    if (p.keyColor    !== undefined) _keyColor.setValue(p.keyColor);
    if (p.keyHueTol   !== undefined) _keyHueTol.setValue(p.keyHueTol);

    // Animation
    if (p.animate     !== undefined) _animToggle.setValue(p.animate);
    if (p.animStyle   !== undefined) _animStyleDD.setValue(p.animStyle);
    if (p.animSpeed   !== undefined) _sliders.animSpeed.setValue(p.animSpeed);
    if (p.animAmount  !== undefined) _sliders.animAmount.setValue(p.animAmount);
    if (p.loopDuration !== undefined) _sliders.loopDuration.setValue(p.loopDuration);
  }

  function init(container) {

    // ── Target ────────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Target'));
    _targetGroup = new ButtonGroup({
      tooltip: 'Where to apply the pixel sort effect',
      options: [
        { value: 'selectedLayers',  label: 'Selected' },
        { value: 'duplicateLayer',  label: 'Duplicate' },
        { value: 'adjustmentLayer', label: 'Adjustment' },
        { value: 'precompRig',      label: 'Precomp Rig' }
      ],
      value: 'selectedLayers',
      onChange: function(v) { _state.targetMode = v; }
    });
    container.appendChild(_targetGroup.el);

    _applyModeGroup = new ButtonGroup({
      tooltip: 'Quick = baked values; Rig = controller null with expressions',
      options: [
        { value: 'quick', label: 'Quick' },
        { value: 'rig',   label: 'Rig' }
      ],
      value: 'quick',
      onChange: function(v) { _state.applyMode = v; }
    });
    container.appendChild(_applyModeGroup.el);

    // ── Sort Mode ─────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Sort Mode'));
    _modeGroup = new ButtonGroup({
      tooltip: 'Which pixel channel drives the sort order',
      options: [
        { value: 'brightness', label: 'Bright' },
        { value: 'hue',        label: 'Hue' },
        { value: 'saturation', label: 'Sat' },
        { value: 'red',        label: 'Red' },
        { value: 'green',      label: 'Green' },
        { value: 'blue',       label: 'Blue' },
        { value: 'alpha',      label: 'Alpha' },
        { value: 'edges',      label: 'Edge' }
      ],
      value: 'brightness',
      onChange: function(v) { _state.sortMode = v; }
    });
    container.appendChild(_modeGroup.el);

    // ── Direction ─────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Direction'));
    _dirGroup = new ButtonGroup({
      tooltip: 'Direction of the sort smear effect',
      options: [
        { value: 'horizontal', label: 'H' },
        { value: 'vertical',   label: 'V' },
        { value: 'diagonal',   label: 'Diag' },
        { value: 'radial',     label: 'Radial' },
        { value: 'angle',      label: 'Angle' }
      ],
      value: 'horizontal',
      onChange: function(v) { _state.direction = v; }
    });
    container.appendChild(_dirGroup.el);

    _sliders.angle = new Slider({
      label: 'Angle °', min: 0, max: 360, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Custom blur angle — active when Direction is set to Angle',
      onChange: function(v) { _state.angle = v; }
    });
    container.appendChild(_sliders.angle.el);

    // ── Sort Controls ─────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Sort'));
    _sliders.sortLength = new Slider({
      label: 'Sort Length px', min: 1, max: 2000, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Length of the directional blur smear — larger = longer pixel streaks',
      onChange: function(v) { _state.sortLength = v; }
    });
    _sliders.thresholdLow = new Slider({
      label: 'Threshold Low (0–100)', min: 0, max: 100, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Lower brightness cutoff — pixels above this are included in the sort',
      onChange: function(v) { _state.thresholdLow = v; }
    });
    _sliders.thresholdHigh = new Slider({
      label: 'Threshold High (0–100)', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Upper brightness cutoff — pixels below this are included in the sort',
      onChange: function(v) { _state.thresholdHigh = v; }
    });
    _sliders.thresholdSoftness = new Slider({
      label: 'Softness', min: 0, max: 100, value: 10, step: 1, defaultValue: 10,
      tooltip: 'Softness of the threshold mask edges',
      onChange: function(v) { _state.thresholdSoftness = v; }
    });
    _sliders.randomness = new Slider({
      label: 'Randomness %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Adds turbulent variation to the sort threshold mask — higher = more chaotic edges',
      onChange: function(v) { _state.randomness = v; }
    });
    _sliders.iterations = new Slider({
      label: 'Iterations', min: 1, max: 10, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Number of sort passes applied — each pass adds another matte+blur layer set',
      onChange: function(v) { _state.iterations = v; }
    });
    container.appendChild(_sliders.sortLength.el);
    container.appendChild(_sliders.thresholdLow.el);
    container.appendChild(_sliders.thresholdHigh.el);
    container.appendChild(_sliders.thresholdSoftness.el);
    container.appendChild(_sliders.randomness.el);
    container.appendChild(_sliders.iterations.el);

    // ── Color Key ─────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Color Key (mask sort area)'));
    _keyToggle = new Toggle({
      label: 'Enable Color Key', value: false,
      tooltip: 'Limit sorting to pixels matching the key color hue range',
      onChange: function(v) { _state.useColorKey = v; _setKeyEnabled(v); }
    });
    _keyColor = new ColorPicker({
      label: 'Key Color', value: '#ff0000',
      tooltip: 'Hue to target for color-keyed sort masking',
      onChange: function(v) { _state.keyColor = v; }
    });
    _keyHueTol = new Slider({
      label: 'Hue Tolerance °', min: 1, max: 180, value: 30, step: 1, defaultValue: 30,
      tooltip: 'Hue angle tolerance around the key color — wider = more pixels included',
      onChange: function(v) { _state.keyHueTol = v; }
    });
    container.appendChild(_keyToggle.el);
    container.appendChild(_keyColor.el);
    container.appendChild(_keyHueTol.el);
    _setKeyEnabled(false);

    // ── Animation ─────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
    _animToggle = new Toggle({
      label: 'Animate Pixel Sort', value: false,
      tooltip: 'Add expression-driven animation to the sort length and threshold',
      onChange: function(v) { _state.animate = v; }
    });
    _animStyleDD = new Dropdown({
      label: 'Animation Style',
      options: [
        { value: 'drift',           label: 'Drift' },
        { value: 'pulse',           label: 'Pulse' },
        { value: 'thresholdSweep',  label: 'Threshold Sweep' },
        { value: 'lengthWave',      label: 'Length Wave' },
        { value: 'randomFlicker',   label: 'Random Flicker' },
        { value: 'scanlineMove',    label: 'Scanline Move' }
      ],
      value: 'drift',
      onChange: function(v) { _state.animStyle = v; }
    });
    _sliders.animSpeed = new Slider({
      label: 'Speed', min: 0, max: 10, value: 1, step: 0.1, defaultValue: 1,
      tooltip: 'Animation cycle speed multiplier',
      onChange: function(v) { _state.animSpeed = v; }
    });
    _sliders.animAmount = new Slider({
      label: 'Anim Amount', min: 0, max: 500, value: 50, step: 1, defaultValue: 50,
      tooltip: 'Peak amplitude of the animated parameter',
      onChange: function(v) { _state.animAmount = v; }
    });
    _sliders.loopDuration = new Slider({
      label: 'Loop Sec', min: 0.25, max: 20, value: 2, step: 0.25, defaultValue: 2,
      tooltip: 'Duration in seconds for one animation loop',
      onChange: function(v) { _state.loopDuration = v; }
    });
    container.appendChild(_animToggle.el);
    container.appendChild(_animStyleDD.el);
    container.appendChild(_sliders.animSpeed.el);
    container.appendChild(_sliders.animAmount.el);
    container.appendChild(_sliders.loopDuration.el);

    // ── Apply ─────────────────────────────────────────────────────────────────
    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Pixel Sort');
    applyBtn.addEventListener('click', function() { _apply(applyBtn); });
    container.appendChild(applyBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);
  }

  function _setKeyEnabled(en) {
    _keyColor.el.style.opacity = en ? '' : '0.4';
    _keyHueTol.setEnabled(en);
  }

  function _apply(btn) {
    btn.disabled    = true;
    btn.textContent = 'Applying…';
    Bridge.call('sorter.apply', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Apply Pixel Sort';
      if (result.error) { _status.className = 'status-bar error';   _status.textContent = result.error; }
      else              { _status.className = 'status-bar success'; _status.textContent = 'Pixel sort applied.'; }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Apply Pixel Sort';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

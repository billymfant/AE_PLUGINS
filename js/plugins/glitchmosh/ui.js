'use strict';

window.GlitchMoshUI = (function () {

  var _defaults = {
    masterIntensity:  100,
    masterSeed:       42,
    // Stage toggles
    bleedEnabled:     true,
    smearEnabled:     true,
    blockEnabled:     true,
    rgbEnabled:       true,
    stutterEnabled:   true,
    noiseEnabled:     true,
    // Stage 1: Frame Bleed
    bleedAmount:      70,
    bleedDecay:       80,
    bleedFrames:      3,
    bleedLumaThresh:  50,
    // Stage 2: Pixel Smear
    smearLength:      120,
    smearDirection:   0,
    smearLumaThresh:  40,
    smearStretch:     50,
    // Stage 3: Block Corruption
    blockSize:        32,
    blockOffset:      40,
    blockChaos:       50,
    blockDropRate:    6,
    blockColorShift:  20,
    // Stage 4: RGB Split
    rgbHSplit:        8,
    rgbVSplit:        2,
    rgbChromaBleed:   40,
    // Stage 5: Temporal Stutter
    stutterRate:      8,
    holdDuration:     2,
    stutterSeed:      7,
    // Stage 6: Compression Noise
    noiseAmount:      20,
    grainSize:        2,
    ringIntensity:    15,
    // Stage 7: Mask
    maskMode:         0,
    maskFeather:      20
  };

  var _state = Utils.deepClone(_defaults);
  var _sliders = {};
  var _toggles = {};
  var _status;

  function getParams() { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    Object.keys(_sliders).forEach(function (k) {
      if (p[k] !== undefined) _sliders[k].setValue(p[k]);
    });
    Object.keys(_toggles).forEach(function (k) {
      if (p[k] !== undefined) _toggles[k].setValue(p[k]);
    });
  }

  function _section(container, label) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, label));
  }

  function _slider(container, key, label, min, max, step, tooltip) {
    _sliders[key] = new Slider({
      label: label, min: min, max: max, step: step || 1,
      value: _state[key],
      tooltip: tooltip || '',
      onChange: function (v) { _state[key] = v; }
    });
    container.appendChild(_sliders[key].el);
  }

  function _toggle(container, key, label) {
    _toggles[key] = new Toggle({
      label: label, value: _state[key],
      onChange: function (v) { _state[key] = v; }
    });
    container.appendChild(_toggles[key].el);
  }

  function init(container) {
    // ── Master ──────────────────────────────────────────────────
    _section(container, 'Master');
    _slider(container, 'masterIntensity', 'Intensity %', 0, 100, 1, 'Scales all 7 stages');
    _slider(container, 'masterSeed',      'Random Seed',  0, 999, 1, 'Change the overall randomness');

    // ── Stage 1: Frame Bleed ────────────────────────────────────
    _toggle(container, 'bleedEnabled', 'Frame Bleed');
    _slider(container, 'bleedAmount',     'Amount %',     0, 100, 1);
    _slider(container, 'bleedDecay',      'Decay %',      0, 100, 1);
    _slider(container, 'bleedFrames',     'Frame Offset', 1, 10,  1);
    _slider(container, 'bleedLumaThresh', 'Luma Thresh',  0, 100, 1);

    // ── Stage 2: Pixel Smear ────────────────────────────────────
    _toggle(container, 'smearEnabled', 'Pixel Smear');
    _slider(container, 'smearLength',     'Smear Length', 0, 300, 1);
    _sliders.smearDirection = new ButtonGroup({
      tooltip: 'Smear direction',
      options: [
        { value: 0, label: 'H' },
        { value: 1, label: 'V' },
        { value: 2, label: 'Both' }
      ],
      value: _state.smearDirection,
      onChange: function (v) { _state.smearDirection = v; }
    });
    container.appendChild(_sliders.smearDirection.el);
    _slider(container, 'smearStretch', 'Stretch', 0, 100, 1);

    // ── Stage 3: Block Corruption ───────────────────────────────
    _toggle(container, 'blockEnabled', 'Block Corruption');
    _slider(container, 'blockSize',      'Block Size',   4,  128, 1);
    _slider(container, 'blockOffset',    'Offset',       0,  100, 1);
    _slider(container, 'blockChaos',     'Chaos',        0,  100, 1);
    _slider(container, 'blockDropRate',  'Drop Rate fps', 1, 30,  1);
    _slider(container, 'blockColorShift','Color Shift',  0,  100, 1);

    // ── Stage 4: RGB Split ──────────────────────────────────────
    _toggle(container, 'rgbEnabled', 'RGB + Chroma Bleed');
    _slider(container, 'rgbHSplit',      'H Split px',   0, 40,  1);
    _slider(container, 'rgbVSplit',      'V Split px',   0, 40,  1);
    _slider(container, 'rgbChromaBleed', 'Chroma Bleed', 0, 100, 1);

    // ── Stage 5: Temporal Stutter ───────────────────────────────
    _toggle(container, 'stutterEnabled', 'Temporal Stutter');
    _slider(container, 'stutterRate',   'Stutter fps',   1, 30,  1);
    _slider(container, 'holdDuration',  'Hold Frames',   1, 10,  1);
    _slider(container, 'stutterSeed',   'Stutter Seed',  0, 99,  1);

    // ── Stage 6: Compression Noise ──────────────────────────────
    _toggle(container, 'noiseEnabled', 'Compression Noise');
    _slider(container, 'noiseAmount',   'Noise %',    0, 100, 1);
    _slider(container, 'grainSize',     'Grain Size', 1, 10,  1);
    _slider(container, 'ringIntensity', 'Ring %',     0, 100, 1);

    // ── Stage 7: Glitch Mask ────────────────────────────────────
    _section(container, 'Glitch Mask');
    _sliders.maskMode = new ButtonGroup({
      tooltip: 'Which pixels get the glitch',
      options: [
        { value: 0, label: 'Full' },
        { value: 1, label: 'Bright' },
        { value: 2, label: 'Dark' },
        { value: 3, label: 'Edges' }
      ],
      value: _state.maskMode,
      onChange: function (v) { _state.maskMode = v; }
    });
    container.appendChild(_sliders.maskMode.el);
    _slider(container, 'maskFeather', 'Feather', 0, 100, 1);

    // ── Apply Button ────────────────────────────────────────────
    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply GlitchMosh');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Applying…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('glitchmosh.apply', getParams()).then(function (r) {
      btn.disabled = false; btn.textContent = 'Apply GlitchMosh';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else { _status.className = 'status-bar success'; _status.textContent = 'GlitchMosh rig built!'; }
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Apply GlitchMosh';
      _status.className = 'status-bar error'; _status.textContent = e.message || String(e);
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };

}());

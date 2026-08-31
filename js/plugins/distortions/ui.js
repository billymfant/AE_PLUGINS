'use strict';

window.DistortionsUI = (function() {
  var _state = {
    // Engine: 'builtin' (AE built-in stack) | 'flow' (native DistortFlow.aex)
    engine:    'builtin',

    distType:  'lens',
    intensity:  50,
    centerX:    0.5,
    centerY:    0.5,
    radius:     200,
    feather:    0,
    focalLength: 50,
    meshResX: 5, meshResY: 5,
    swirlAngle: 90,
    amplitude: 20, frequency: 5, waveSpeed: 1,
    blendOpacity: 100,
    // Animation + targeting fields
    targetMode:       'selectedLayers',
    adjustmentName:   'DISTORTION_ADJUSTMENT',
    animateEnabled:   false,
    animationMode:    'loop',
    animDuration:     2.0,
    animSpeed:        1.0,
    animAmount:       25,
    randomSeed:       1,
    animationOutput:  'expressions',

    // ── Native Distort Flow (DistortFlow.aex) params — defaults mirror the
    //    .aex (DistortFlow.cpp ParamsSetup); Amount defaults to 40 so a fresh
    //    apply visibly does something (the engine's own default is 0 = identity).
    dfMapType:    3,    // 1 Gradient 2 Radial 3 Wave 4 Noise
    dfAngle:      0,
    dfSpacing:    4,
    dfWaveFreq:   4,
    dfWavePhase:  0,
    dfNoiseScale: 3,
    dfNoiseDetail:3,
    dfNoiseSeed:  1,
    dfContrast:   0,
    dfDispMode:   1,    // 1 Fixed 2 Along Gradient 3 Push-Pull
    dfAmount:     40,
    dfFlowDir:    1,    // 1 Forward 2 Reverse 3 Center-Out 4 Edges-In
    dfFlowSpeed:  0,
    dfLoop:       1,    // 1 Loop 2 Ping-Pong 3 Once
    dfEasing:     1,    // 1 Linear..6 Exp
    dfJitter:     0,
    dfJitterSeed: 1,
    dfPhase:      0,
    dfEdge:       4,    // 1 Clamp 2 Wrap 3 Mirror 4 Transparent (default: no edge-replication smear)
    dfOpacity:    100,
    dfMosaic:     0,
    dfSlatRows:   0,
    dfSlatCols:   0,
    dfSlatStagger:0,
    dfTargetMode: 'selectedLayers',

    // ── Simple controls (panel-only; the .aex never sees these) ──────────────
    //    Style bakes the fiddly params to a known-good look; Scale is a 0..100
    //    proxy for whichever size knob matters for that look.
    dfStyle:      'wave',
    dfScale:      78
  };

  // Style → baked params, so picking a Style and hitting Apply looks right with
  // no further fiddling. Amounts are in PIXELS and were tuned for ~1080p footage
  // (verified headlessly via distort-native/cli on the clean test card at 1/3
  // scale). Every style pins Edges to Transparent — the post-smear-fix default.
  var STYLE_PRESETS = {
    wave: {   // Liquid Wave — smooth in-place ripple; object stays whole
      dfMapType: 3, dfDispMode: 1, dfAmount: 60, dfFlowSpeed: 0.5, dfEasing: 5,
      dfFlowDir: 1, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 3, dfWavePhase: 0,
      dfContrast: 0, dfJitter: 0, dfEdge: 4, dfMosaic: 0,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0
    },
    noise: {  // Noise Warp — organic wobble along the field gradient
      dfMapType: 4, dfDispMode: 2, dfAmount: 45, dfFlowSpeed: 0.4, dfEasing: 1,
      dfFlowDir: 1, dfAngle: 0, dfSpacing: 4, dfNoiseScale: 3, dfNoiseDetail: 3,
      dfNoiseSeed: 7, dfContrast: 0, dfJitter: 0, dfJitterSeed: 1, dfEdge: 4,
      dfMosaic: 0, dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0
    },
    mosaic: { // Mosaic — block SHUFFLE. Needs a high-frequency, high-contrast map:
              // on a smooth map neighbouring blocks displace alike and it reads as
              // mere pixelation rather than a shuffle.
      dfMapType: 4, dfDispMode: 1, dfAmount: 90, dfFlowSpeed: 0.5, dfEasing: 1,
      dfFlowDir: 1, dfAngle: 0, dfSpacing: 4, dfNoiseScale: 10, dfNoiseDetail: 2,
      dfNoiseSeed: 1, dfContrast: 70, dfJitter: 0, dfEdge: 4, dfMosaic: 36,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0
    },
    slats: {  // Woven Slats — rigid bands sliding over/under
      dfMapType: 3, dfDispMode: 1, dfAmount: 60, dfFlowSpeed: 0.3, dfEasing: 1,
      dfFlowDir: 1, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfContrast: 0, dfJitter: 0, dfEdge: 4, dfMosaic: 0,
      dfSlatRows: 16, dfSlatCols: 16, dfSlatStagger: 60
    }
  };

  // Which size knob "Scale" drives per style, and over what range. `invert`
  // means the underlying param is a FREQUENCY (higher = smaller features), so a
  // bigger Scale must lower it. `also` mirrors the value onto a second field.
  var SCALE_MAP = {
    wave:   { field: 'dfWaveFreq',   lo: 0.5, hi: 12,  invert: true,  round: 2 },
    noise:  { field: 'dfNoiseScale', lo: 0.5, hi: 12,  invert: true,  round: 2 },
    mosaic: { field: 'dfMosaic',     lo: 4,   hi: 64,  invert: false, round: 0 },
    slats:  { field: 'dfSlatRows',   lo: 4,   hi: 48,  invert: true,  round: 0, also: 'dfSlatCols' }
  };

  function _scaleToField(m, scale) {
    var t = Utils.clamp(scale, 0, 100) / 100;
    if (m.invert) t = 1 - t;
    return Utils.round(m.lo + t * (m.hi - m.lo), m.round);
  }

  function _fieldToScale(m, v) {
    var t = Utils.clamp((v - m.lo) / (m.hi - m.lo), 0, 1);
    if (m.invert) t = 1 - t;
    return Math.round(t * 100);
  }

  function getParams() { return Utils.deepClone(_state); }

  // Debounced LIVE update — pushes current params onto an EXISTING Distort Flow
  // effect so dragging sliders/dropdowns updates the layer in real time (like
  // Color Lab). liveOnly=true => the jsx only updates, never creates an effect.
  var _liveFlow = Utils.debounce(function () {
    if (_state.engine !== 'flow') return;
    var p = Utils.deepClone(_state); p.liveOnly = true;
    Bridge.call('distortflow.apply', p).catch(function () {});
  }, 150);

  var _sliders = {};
  var _typeGroup, _lensSection, _warpSection, _swirlSection, _waveSection, _status;
  var _targetGroup, _animEnabledGroup, _animModeGroup, _animOutputGroup;
  // Engine + native Distort Flow widgets
  var _engineGroup, _builtinWrap, _flowWrap, _flowStatus;
  var _df = {};   // native widgets keyed by state field

  function applyPreset(p) {
    Object.assign(_state, p);
    if (p.engine !== undefined) _engineGroup.setValue(p.engine);
    if (p.distType !== undefined)     { _typeGroup.setValue(p.distType); _showSection(p.distType); }
    if (p.intensity !== undefined)    { _sliders.intensity.setValue(p.intensity); }
    if (p.radius !== undefined)       { _sliders.radius.setValue(p.radius); }
    if (p.feather !== undefined)      { _sliders.feather.setValue(p.feather); }
    if (p.blendOpacity !== undefined) { _sliders.blendOpacity.setValue(p.blendOpacity); }
    if (p.centerX !== undefined)      { _sliders.centerX.setValue(p.centerX); }
    if (p.centerY !== undefined)      { _sliders.centerY.setValue(p.centerY); }
    // New fields — guarded so older presets without them don't throw
    if (p.targetMode !== undefined)      { _targetGroup.setValue(p.targetMode); }
    if (p.animateEnabled !== undefined)  { _animEnabledGroup.setValue(p.animateEnabled); }
    if (p.animationMode !== undefined)   { _animModeGroup.setValue(p.animationMode); }
    if (p.animationOutput !== undefined) { _animOutputGroup.setValue(p.animationOutput); }
    if (p.animDuration !== undefined)    { _sliders.animDuration.setValue(p.animDuration); }
    if (p.animSpeed !== undefined)       { _sliders.animSpeed.setValue(p.animSpeed); }
    if (p.animAmount !== undefined)      { _sliders.animAmount.setValue(p.animAmount); }
    if (p.randomSeed !== undefined)      { _sliders.randomSeed.setValue(p.randomSeed); }
    // Native Distort Flow widgets — each guarded for back-compat presets
    for (var k in _df) {
      if (_df.hasOwnProperty(k) && p[k] !== undefined && _df[k]) { _df[k].setValue(p[k]); }
    }
    if (p.engine !== undefined) _showEngine(p.engine);
    _syncSimpleFromState();   // keep Style/Scale honest about what the preset set
    _liveFlow();   // push the loaded preset onto an existing effect, if any
  }

  function init(container) {
    // ── Engine selector (built-in stack vs native DistortFlow.aex) ─────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Engine'));
    _engineGroup = new ButtonGroup({
      tooltip: 'Built-in stacks AE distort effects; Distort Flow drives the native DistortFlow.aex map-warp engine',
      options: [
        { value: 'builtin', label: 'Built-in' },
        { value: 'flow',    label: 'Distort Flow' }
      ],
      value: _state.engine,
      onChange: function(v) { _state.engine = v; _showEngine(v); }
    });
    container.appendChild(_engineGroup.el);

    _builtinWrap = Utils.el('div', {});
    _flowWrap    = Utils.el('div', {});
    container.appendChild(_builtinWrap);
    container.appendChild(_flowWrap);

    _buildBuiltin(_builtinWrap);
    _buildFlow(_flowWrap);

    _showEngine(_state.engine);
  }

  // ── Built-in distortions (AE effect stack) — unchanged behaviour ─────────────
  function _buildBuiltin(container) {
    // Type selector
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Distortion Type'));
    _typeGroup = new ButtonGroup({
      tooltip: 'Type of distortion effect to apply',
      options: [
        { value: 'lens',   label: 'Lens' },
        { value: 'warp',   label: 'Warp' },
        { value: 'swirl',  label: 'Swirl' },
        { value: 'wave',   label: 'Wave' },
        { value: 'bulge',  label: 'Bulge' },
        { value: 'pinch',  label: 'Pinch' }
      ],
      value: 'lens',
      onChange: function(v) { _state.distType = v; _showSection(v); }
    });
    container.appendChild(_typeGroup.el);

    // Common
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Common'));
    _sliders.intensity = new Slider({ label: 'Intensity %', min: -200, max: 200, value: 50, step: 1, defaultValue: 50,
      tooltip: 'Strength of the distortion effect — negative values invert the distortion',
      onChange: function(v) { _state.intensity = v; } });
    _sliders.radius = new Slider({ label: 'Radius px', min: 10, max: 2000, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Radius of the affected area for swirl and bulge effects',
      onChange: function(v) { _state.radius = v; } });
    _sliders.feather = new Slider({ label: 'Feather px', min: 0, max: 200, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Soft edge blend — when > 0, distortion is applied to the target layer with a feathered circular mask',
      onChange: function(v) { _state.feather = v; } });
    _sliders.blendOpacity = new Slider({ label: 'Opacity %', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Opacity of the distorted layer (or duplicate when feather > 0)',
      onChange: function(v) { _state.blendOpacity = v; } });
    container.appendChild(_sliders.intensity.el);
    container.appendChild(_sliders.radius.el);
    container.appendChild(_sliders.feather.el);
    container.appendChild(_sliders.blendOpacity.el);

    // Center point
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Center Point'));
    var centerRow = Utils.el('div', { class: 'row-2' });
    _sliders.centerX = new Slider({ label: 'Center X', min: 0, max: 1, value: 0.5, step: 0.01, decimals: 2, defaultValue: 0.5,
      tooltip: 'Horizontal center of the distortion effect (0 = left, 1 = right)',
      onChange: function(v) { _state.centerX = v; } });
    _sliders.centerY = new Slider({ label: 'Center Y', min: 0, max: 1, value: 0.5, step: 0.01, decimals: 2, defaultValue: 0.5,
      tooltip: 'Vertical center of the distortion effect (0 = top, 1 = bottom)',
      onChange: function(v) { _state.centerY = v; } });
    centerRow.appendChild(_sliders.centerX.el);
    centerRow.appendChild(_sliders.centerY.el);
    container.appendChild(centerRow);

    // Lens-specific
    _lensSection = Utils.el('div', {});
    _lensSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Lens'));
    _sliders.focalLength = new Slider({ label: 'Focal Length mm', min: 10, max: 300, value: 50, step: 1, defaultValue: 50,
      tooltip: 'Focal length for lens distortion — lower = wider angle, more distortion',
      onChange: function(v) { _state.focalLength = v; } });
    _lensSection.appendChild(_sliders.focalLength.el);
    container.appendChild(_lensSection);

    // Warp-specific
    _warpSection = Utils.el('div', {});
    _warpSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Mesh Warp'));
    _sliders.meshResX = new Slider({ label: 'Mesh Cols', min: 2, max: 20, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Horizontal mesh resolution for warp — higher = more control points',
      onChange: function(v) { _state.meshResX = v; } });
    _sliders.meshResY = new Slider({ label: 'Mesh Rows', min: 2, max: 20, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Vertical mesh resolution for warp',
      onChange: function(v) { _state.meshResY = v; } });
    _warpSection.appendChild(_sliders.meshResX.el);
    _warpSection.appendChild(_sliders.meshResY.el);
    container.appendChild(_warpSection);

    // Swirl-specific
    _swirlSection = Utils.el('div', {});
    _swirlSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Swirl'));
    _sliders.swirlAngle = new Slider({ label: 'Angle °', min: -720, max: 720, value: 90, step: 1, defaultValue: 90,
      tooltip: 'Total rotation angle for the swirl effect — negative reverses direction',
      onChange: function(v) { _state.swirlAngle = v; } });
    _swirlSection.appendChild(_sliders.swirlAngle.el);
    container.appendChild(_swirlSection);

    // Wave-specific
    _waveSection = Utils.el('div', {});
    _waveSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Wave'));
    _sliders.amplitude = new Slider({ label: 'Amplitude px', min: 0, max: 200, value: 20, step: 1, defaultValue: 20,
      tooltip: 'Wave height in pixels',
      onChange: function(v) { _state.amplitude = v; } });
    _sliders.frequency = new Slider({ label: 'Frequency', min: 0.1, max: 20, value: 5, step: 0.1, decimals: 1, defaultValue: 5,
      tooltip: 'Number of wave cycles across the layer',
      onChange: function(v) { _state.frequency = v; } });
    _sliders.waveSpeed = new Slider({ label: 'Speed', min: 0, max: 10, value: 1, step: 0.1, decimals: 1, defaultValue: 1,
      tooltip: 'Wave animation speed multiplier',
      onChange: function(v) { _state.waveSpeed = v; } });
    _waveSection.appendChild(_sliders.amplitude.el);
    _waveSection.appendChild(_sliders.frequency.el);
    _waveSection.appendChild(_sliders.waveSpeed.el);
    container.appendChild(_waveSection);

    _showSection('lens');

    // ── Apply Target ──────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Apply Target'));
    _targetGroup = new ButtonGroup({
      tooltip: 'Where to apply the distortion effect',
      options: [
        { value: 'selectedLayers',    label: 'Selected' },
        { value: 'duplicateLayers',   label: 'Duplicate' },
        { value: 'newAdjustment',     label: 'New Adj' },
        { value: 'selectedAdjustment',label: 'Sel Adj' },
        { value: 'precompAdjustment', label: 'Precomp Adj' }
      ],
      value: 'selectedLayers',
      onChange: function(v) { _state.targetMode = v; }
    });
    container.appendChild(_targetGroup.el);

    // ── Animation ─────────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));

    _animEnabledGroup = new ButtonGroup({
      tooltip: 'Enable or disable animated distortion',
      options: [
        { value: false, label: 'Static' },
        { value: true,  label: 'Animated' }
      ],
      value: false,
      onChange: function(v) { _state.animateEnabled = v; }
    });
    container.appendChild(_animEnabledGroup.el);

    _animModeGroup = new ButtonGroup({
      tooltip: 'Animation pattern for the distortion over time',
      options: [
        { value: 'loop',           label: 'Loop' },
        { value: 'pingpong',       label: 'Ping Pong' },
        { value: 'drift',          label: 'Drift' },
        { value: 'pulse',          label: 'Pulse' },
        { value: 'manualKeyframes',label: 'Keys' }
      ],
      value: 'loop',
      onChange: function(v) { _state.animationMode = v; }
    });
    container.appendChild(_animModeGroup.el);

    _animOutputGroup = new ButtonGroup({
      tooltip: 'How to bake the animation into AE — expressions or keyframes',
      options: [
        { value: 'expressions', label: 'Expressions' },
        { value: 'keyframes',   label: 'Keyframes' }
      ],
      value: 'expressions',
      onChange: function(v) { _state.animationOutput = v; }
    });
    container.appendChild(_animOutputGroup.el);

    _sliders.animDuration = new Slider({ label: 'Loop Duration', min: 0.25, max: 20, value: 2.0, step: 0.05, decimals: 2, defaultValue: 2.0,
      tooltip: 'Duration in seconds for one animation cycle',
      onChange: function(v) { _state.animDuration = v; } });
    _sliders.animSpeed = new Slider({ label: 'Speed', min: 0, max: 10, value: 1.0, step: 0.1, decimals: 1, defaultValue: 1.0,
      tooltip: 'Overall speed multiplier for the animation',
      onChange: function(v) { _state.animSpeed = v; } });
    _sliders.animAmount = new Slider({ label: 'Anim Amount', min: 0, max: 200, value: 25, step: 1, defaultValue: 25,
      tooltip: 'Amplitude of the animated parameter oscillation',
      onChange: function(v) { _state.animAmount = v; } });
    _sliders.randomSeed = new Slider({ label: 'Random Seed', min: 1, max: 9999, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Seed value used for drift (noise-based) animation',
      onChange: function(v) { _state.randomSeed = v; } });
    container.appendChild(_sliders.animDuration.el);
    container.appendChild(_sliders.animSpeed.el);
    container.appendChild(_sliders.animAmount.el);
    container.appendChild(_sliders.randomSeed.el);

    // ── Apply button + status ─────────────────────────────────────────────────
    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Distortion');
    applyBtn.addEventListener('click', function() { _apply(applyBtn); });
    container.appendChild(applyBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);
  }

  // ── Native Distort Flow (DistortFlow.aex) — map-driven warp engine ───────────
  function _buildFlow(outer) {
    // ── Look — the four knobs that matter. Style bakes the rest. ─────────────
    outer.appendChild(Utils.el('div', { class: 'section-label' }, 'Look'));
    _df.dfStyle = new Dropdown({ label: 'Style',
      tooltip: 'Picks a look and sets the underlying map/displace/edge params to known-good values. Fine-tune under Advanced.',
      options: [
        { value: 'wave',   label: 'Liquid Wave' }, { value: 'noise',  label: 'Noise Warp' },
        { value: 'mosaic', label: 'Mosaic' },      { value: 'slats',  label: 'Woven Slats' }
      ],
      value: _state.dfStyle,
      onChange: function(v) { _setStyle(v); } });
    outer.appendChild(_df.dfStyle.el);

    _df.dfAmount = _mk('dfAmount', { label: 'Strength', min: 0, max: 400, value: _state.dfAmount, step: 1, defaultValue: 60,
      tooltip: 'How far pixels are pushed, in pixels (0 = no warp)' });
    _df.dfScale = new Slider({ label: 'Scale', min: 0, max: 100, value: _state.dfScale, step: 1, defaultValue: 78,
      tooltip: 'Size of the distortion features for the current Style (bigger = coarser)',
      onChange: function(v) { _setScale(v); } });
    _df.dfFlowSpeed = _mk('dfFlowSpeed', { label: 'Speed', min: -4, max: 4, value: _state.dfFlowSpeed, step: 0.01, decimals: 2, defaultValue: 0.5,
      tooltip: 'Animation speed in cycles/second (0 = static)' });
    outer.appendChild(_df.dfAmount.el);
    outer.appendChild(_df.dfScale.el);
    outer.appendChild(_df.dfFlowSpeed.el);

    // ── Advanced — the full engine, collapsed by default ─────────────────────
    outer.appendChild(Utils.el('div', { class: 'section-label' }, 'Advanced'));
    var container = Utils.el('div', {});
    outer.appendChild(container);

    // Map
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Map'));
    _df.dfMapType = new Dropdown({ label: 'Map Type',
      tooltip: 'Field that drives the displacement. Wave = smooth in-place; Noise = organic.',
      options: [
        { value: 1, label: 'Gradient' }, { value: 2, label: 'Radial' },
        { value: 3, label: 'Wave' },     { value: 4, label: 'Noise' }
      ],
      value: _state.dfMapType,
      onChange: function(v) { _state.dfMapType = parseInt(v, 10); _liveFlow(); } });
    container.appendChild(_df.dfMapType.el);

    _df.dfAngle = _mk('dfAngle', { label: 'Angle °', min: -180, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Orientation of the map field' });
    _df.dfSpacing = _mk('dfSpacing', { label: 'Spacing', min: 0, max: 32, value: 4, step: 0.01, decimals: 2, defaultValue: 4,
      tooltip: 'Field cell spacing (0 = uniform field)' });
    _df.dfWaveFreq = _mk('dfWaveFreq', { label: 'Wave Frequency', min: 0, max: 20, value: 4, step: 0.01, decimals: 2, defaultValue: 4,
      tooltip: 'Wave map cycles' });
    _df.dfWavePhase = _mk('dfWavePhase', { label: 'Wave Phase °', min: -360, max: 360, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Wave map phase offset' });
    _df.dfNoiseScale = _mk('dfNoiseScale', { label: 'Noise Scale', min: 0.5, max: 16, value: 3, step: 0.01, decimals: 2, defaultValue: 3,
      tooltip: 'Noise map feature size' });
    _df.dfNoiseDetail = _mk('dfNoiseDetail', { label: 'Noise Detail', min: 1, max: 6, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Noise fBm octaves' });
    _df.dfNoiseSeed = _mk('dfNoiseSeed', { label: 'Noise Seed', min: 1, max: 999, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Noise random seed' });
    _df.dfContrast = _mk('dfContrast', { label: 'Map Contrast %', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Contrast of the map field' });
    container.appendChild(_df.dfAngle.el);
    container.appendChild(_df.dfSpacing.el);
    container.appendChild(_df.dfWaveFreq.el);
    container.appendChild(_df.dfWavePhase.el);
    container.appendChild(_df.dfNoiseScale.el);
    container.appendChild(_df.dfNoiseDetail.el);
    container.appendChild(_df.dfNoiseSeed.el);
    container.appendChild(_df.dfContrast.el);

    // Displace
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Displace'));
    _df.dfDispMode = new Dropdown({ label: 'Displace Mode',
      tooltip: 'How the map drives pixel displacement',
      options: [
        { value: 1, label: 'Fixed' }, { value: 2, label: 'Along Gradient' }, { value: 3, label: 'Push-Pull' }
      ],
      value: _state.dfDispMode,
      onChange: function(v) { _state.dfDispMode = parseInt(v, 10); _liveFlow(); } });
    container.appendChild(_df.dfDispMode.el);   // Amount lives up in Look as "Strength"

    // Flow (animation)
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Flow'));
    _df.dfFlowDir = new Dropdown({ label: 'Flow Direction',
      tooltip: 'How the map animates over time',
      options: [
        { value: 1, label: 'Forward' }, { value: 2, label: 'Reverse' },
        { value: 3, label: 'Center-Out' }, { value: 4, label: 'Edges-In' }
      ],
      value: _state.dfFlowDir,
      onChange: function(v) { _state.dfFlowDir = parseInt(v, 10); _liveFlow(); } });
    container.appendChild(_df.dfFlowDir.el);    // Flow Speed lives up in Look as "Speed"
    _df.dfLoop = new Dropdown({ label: 'Loop',
      tooltip: 'Time looping behaviour',
      options: [ { value: 1, label: 'Loop' }, { value: 2, label: 'Ping-Pong' }, { value: 3, label: 'Once' } ],
      value: _state.dfLoop,
      onChange: function(v) { _state.dfLoop = parseInt(v, 10); _liveFlow(); } });
    container.appendChild(_df.dfLoop.el);
    _df.dfEasing = new Dropdown({ label: 'Easing',
      tooltip: 'Time easing curve',
      options: [
        { value: 1, label: 'Linear' }, { value: 2, label: 'Ease In' }, { value: 3, label: 'Ease Out' },
        { value: 4, label: 'Ease In-Out' }, { value: 5, label: 'Sine' }, { value: 6, label: 'Exp' }
      ],
      value: _state.dfEasing,
      onChange: function(v) { _state.dfEasing = parseInt(v, 10); _liveFlow(); } });
    container.appendChild(_df.dfEasing.el);
    _df.dfJitter = _mk('dfJitter', { label: 'Jitter %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random temporal jitter' });
    _df.dfJitterSeed = _mk('dfJitterSeed', { label: 'Jitter Seed', min: 1, max: 999, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Jitter random seed' });
    _df.dfPhase = _mk('dfPhase', { label: 'Phase', min: 0, max: 1, value: 0, step: 0.001, decimals: 3, defaultValue: 0,
      tooltip: 'Manual phase offset (0..1)' });
    container.appendChild(_df.dfJitter.el);
    container.appendChild(_df.dfJitterSeed.el);
    container.appendChild(_df.dfPhase.el);

    // Output
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Output'));
    _df.dfEdge = new Dropdown({ label: 'Edges',
      tooltip: 'Edge handling. Transparent (default) lets displaced content reveal transparency; Mirror/Clamp/Wrap fill the canvas by replicating edge pixels.',
      options: [
        { value: 1, label: 'Clamp' }, { value: 2, label: 'Wrap' }, { value: 3, label: 'Mirror' }, { value: 4, label: 'Transparent' }
      ],
      value: _state.dfEdge,
      onChange: function(v) { _state.dfEdge = parseInt(v, 10); _liveFlow(); } });
    container.appendChild(_df.dfEdge.el);
    _df.dfOpacity = _mk('dfOpacity', { label: 'Opacity %', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Blend of the warped result over the original' });
    _df.dfMosaic = _mk('dfMosaic', { label: 'Mosaic Block px', min: 0, max: 200, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Block-snap the displacement into chunky tiles (0 = smooth)' });
    container.appendChild(_df.dfOpacity.el);
    container.appendChild(_df.dfMosaic.el);

    // Slats (auto-weave)
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Slats (Weave)'));
    _df.dfSlatRows = _mk('dfSlatRows', { label: 'Rows', min: 0, max: 64, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Horizontal slat bands that slide along X (0 = off). Any Rows/Columns > 0 switches to weave mode.' });
    _df.dfSlatCols = _mk('dfSlatCols', { label: 'Columns', min: 0, max: 64, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Vertical slat bands that slide along Y (0 = off).' });
    _df.dfSlatStagger = _mk('dfSlatStagger', { label: 'Stagger %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Alternate bands shift in opposite directions (over/under weave).' });
    container.appendChild(_df.dfSlatRows.el);
    container.appendChild(_df.dfSlatCols.el);
    container.appendChild(_df.dfSlatStagger.el);

    // Apply Target — outside Advanced so collapsing never hides the Apply button
    outer.appendChild(Utils.el('div', { class: 'section-label' }, 'Apply Target'));
    _df.dfTargetMode = new Dropdown({ label: 'Target',
      tooltip: 'Where to apply Distort Flow',
      options: [
        { value: 'selectedLayers',     label: 'Selected Layers' },
        { value: 'newAdjustment',      label: 'New Adjustment Layer' },
        { value: 'selectedAdjustment', label: 'Selected Adjustment' }
      ],
      value: _state.dfTargetMode,
      onChange: function(v) { _state.dfTargetMode = v; } });
    outer.appendChild(_df.dfTargetMode.el);

    // Apply button + status
    var flowBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Distort Flow');
    flowBtn.addEventListener('click', function() { _applyFlow(flowBtn); });
    outer.appendChild(flowBtn);

    _flowStatus = Utils.el('div', { class: 'status-bar' }, '');
    outer.appendChild(_flowStatus);

    // Bake in the default Style, then collapse Advanced. makeCollapsible is
    // idempotent (data-collapsible guard), so app.js's later pass is a no-op here.
    _setStyle(_state.dfStyle, true);
    if (window.Sections && Sections.makeCollapsible) {
      Sections.makeCollapsible(outer);
      var labels = outer.querySelectorAll('.section-label');
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].textContent.indexOf('Advanced') !== -1) { labels[i].click(); break; }
      }
    }
  }

  // Apply a Style: bake its params, resync every native widget, re-derive Scale.
  // `silent` skips the live push (used at build time, before anything exists).
  function _setStyle(style, silent) {
    var preset = STYLE_PRESETS[style];
    if (!preset) return;
    _state.dfStyle = style;
    Object.assign(_state, preset);
    // Scale is meaningless across styles (different underlying field) — re-derive
    // it from the style's own baked value so the slider reads the truth.
    var m = SCALE_MAP[style];
    _state.dfScale = _fieldToScale(m, _state[m.field]);
    _syncFlowWidgets();
    if (!silent) _liveFlow();
  }

  // Scale: drive whichever size knob the current Style maps to.
  function _setScale(scale) {
    var m = SCALE_MAP[_state.dfStyle];
    if (!m) return;
    _state.dfScale = scale;
    var v = _scaleToField(m, scale);
    _state[m.field] = v;
    if (_df[m.field]) _df[m.field].setValue(v);
    if (m.also) {
      _state[m.also] = v;
      if (_df[m.also]) _df[m.also].setValue(v);
    }
    _liveFlow();
  }

  // Push _state onto every native widget (Look + Advanced) without firing live.
  function _syncFlowWidgets() {
    for (var k in _df) {
      if (_df.hasOwnProperty(k) && _df[k] && _state[k] !== undefined) _df[k].setValue(_state[k]);
    }
  }

  // Derive Style + Scale from raw native fields — used after a preset load so
  // the simple controls agree with whatever the preset actually set.
  function _syncSimpleFromState() {
    var style = 'wave';
    if (_state.dfSlatRows > 0 || _state.dfSlatCols > 0) style = 'slats';
    else if (_state.dfMosaic >= 1)                      style = 'mosaic';
    else if (_state.dfMapType === 4)                    style = 'noise';
    _state.dfStyle = style;
    var m = SCALE_MAP[style];
    _state.dfScale = _fieldToScale(m, _state[m.field]);
    if (_df.dfStyle) _df.dfStyle.setValue(style);
    if (_df.dfScale) _df.dfScale.setValue(_state.dfScale);
  }

  // Make a native-param Slider that writes _state[field]; returns the Slider.
  function _mk(field, opts) {
    opts.onChange = function(v) { _state[field] = v; _liveFlow(); };
    return new Slider(opts);
  }

  function _showEngine(engine) {
    _builtinWrap.style.display = (engine === 'flow') ? 'none' : '';
    _flowWrap.style.display    = (engine === 'flow') ? '' : 'none';
  }

  function _showSection(type) {
    _lensSection.style.display  = (type === 'lens')  ? '' : 'none';
    _warpSection.style.display  = (type === 'warp')  ? '' : 'none';
    _swirlSection.style.display = (type === 'swirl') ? '' : 'none';
    _waveSection.style.display  = (type === 'wave')  ? '' : 'none';
  }

  function _apply(btn) {
    btn.disabled    = true;
    btn.textContent = 'Applying…';
    Bridge.call('distortions.apply', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Apply Distortion';
      if (result.error) { _status.className = 'status-bar error'; _status.textContent = result.error; }
      else              { _status.className = 'status-bar success'; _status.textContent = 'Distortion applied.'; }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Apply Distortion';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  function _applyFlow(btn) {
    btn.disabled    = true;
    btn.textContent = 'Applying…';
    Bridge.call('distortflow.apply', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Apply Distort Flow';
      if (result.error) { _flowStatus.className = 'status-bar error'; _flowStatus.textContent = result.error; }
      else {
        _flowStatus.className = 'status-bar success';
        _flowStatus.textContent = 'Distort Flow applied' + (result.layer ? ' to ' + result.layer + '.' : '.');
      }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Apply Distort Flow';
      _flowStatus.className = 'status-bar error'; _flowStatus.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

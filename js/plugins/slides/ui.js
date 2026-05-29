'use strict';

window.SlidesUI = (function() {
  var _state = {
    // ── existing fields ──────────────────────────────────────────────
    rows: 3, cols: 3,
    slideW: 200, slideH: 150,
    gapH: 10, gapV: 10,
    randomize: 0,
    rotationRandom: 0,
    scaleRandom: 0,
    animType: 'none',
    animStagger: 5,
    useText: false,
    // ── v2 new fields ─────────────────────────────────────────────────
    sourceMode: 'empty',
    useFrames: true,
    bgColor: '#222222',
    cardOpacity: 100,
    strokeEnabled: false,
    strokeWidth: 2,
    strokeColor: '#ffffff',
    roundness: 0,
    animDuration: 18,
    animDirection: 'byIndex',
    animOffset: 100,
    animScaleFrom: 80,
    animOpacityFrom: 0,
    animRotateFrom: 0,
    useOvershoot: false,
    overshootAmount: 8,
    randomSeed: 1,
    useController: false,
    controllerName: 'SLIDES_CONTROL',
    groupName: 'SLIDES_GROUP'
  };

  function getParams() { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    // ── existing setters ──────────────────────────────────────────────
    if (p.rows !== undefined)            _sliders.rows.setValue(p.rows);
    if (p.cols !== undefined)            _sliders.cols.setValue(p.cols);
    if (p.slideW !== undefined)          _sliders.slideW.setValue(p.slideW);
    if (p.slideH !== undefined)          _sliders.slideH.setValue(p.slideH);
    if (p.gapH !== undefined)            _sliders.gapH.setValue(p.gapH);
    if (p.gapV !== undefined)            _sliders.gapV.setValue(p.gapV);
    if (p.randomize !== undefined)       _sliders.randomize.setValue(p.randomize);
    if (p.rotationRandom !== undefined)  _sliders.rotationRandom.setValue(p.rotationRandom);
    if (p.scaleRandom !== undefined)     _sliders.scaleRandom.setValue(p.scaleRandom);
    if (p.animStagger !== undefined)     _sliders.animStagger.setValue(p.animStagger);
    if (p.animType !== undefined)        _animDD.setValue(p.animType);
    if (p.useText !== undefined)         _textToggle.setValue(p.useText);
    // ── v2 guarded setters ────────────────────────────────────────────
    if (p.sourceMode !== undefined)      _sourceDD.setValue(p.sourceMode);
    if (p.useFrames !== undefined)       _useFramesToggle.setValue(p.useFrames);
    if (p.bgColor !== undefined)         _bgColorPicker.setValue(p.bgColor);
    if (p.cardOpacity !== undefined)     _sliders.cardOpacity.setValue(p.cardOpacity);
    if (p.strokeEnabled !== undefined)   _strokeToggle.setValue(p.strokeEnabled);
    if (p.strokeWidth !== undefined)     _sliders.strokeWidth.setValue(p.strokeWidth);
    if (p.strokeColor !== undefined)     _strokeColorPicker.setValue(p.strokeColor);
    if (p.roundness !== undefined)       _sliders.roundness.setValue(p.roundness);
    if (p.animDuration !== undefined)    _sliders.animDuration.setValue(p.animDuration);
    if (p.animDirection !== undefined)   _animDirDD.setValue(p.animDirection);
    if (p.animOffset !== undefined)      _sliders.animOffset.setValue(p.animOffset);
    if (p.animScaleFrom !== undefined)   _sliders.animScaleFrom.setValue(p.animScaleFrom);
    if (p.animOpacityFrom !== undefined) _sliders.animOpacityFrom.setValue(p.animOpacityFrom);
    if (p.animRotateFrom !== undefined)  _sliders.animRotateFrom.setValue(p.animRotateFrom);
    if (p.useOvershoot !== undefined)    _overshootToggle.setValue(p.useOvershoot);
    if (p.overshootAmount !== undefined) _sliders.overshootAmount.setValue(p.overshootAmount);
    if (p.randomSeed !== undefined)      _sliders.randomSeed.setValue(p.randomSeed);
    if (p.useController !== undefined)   _controllerToggle.setValue(p.useController);
  }

  var _sliders = {};
  var _animDD, _animDirDD, _textToggle, _status;
  var _sourceDD;
  var _useFramesToggle, _bgColorPicker, _strokeToggle, _strokeColorPicker;
  var _overshootToggle, _controllerToggle;

  function init(container) {

    // ── SOURCE ────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Source'));
    _sourceDD = new Dropdown({
      label: 'Source',
      tooltip: 'What to use as slide content',
      options: [
        { value: 'empty',          label: 'Empty Slides' },
        { value: 'selectedLayers', label: 'Selected Layers' }
      ],
      value: 'empty',
      onChange: function(v) { _state.sourceMode = v; }
    });
    container.appendChild(_sourceDD.el);

    // ── GRID ──────────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Grid'));
    var gridRow = Utils.el('div', { class: 'row-2' });
    _sliders.rows = new Slider({ label: 'Rows', min: 1, max: 20, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Number of rows in the slide grid',
      onChange: function(v) { _state.rows = v; } });
    _sliders.cols = new Slider({ label: 'Cols', min: 1, max: 20, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Number of columns in the slide grid',
      onChange: function(v) { _state.cols = v; } });
    gridRow.appendChild(_sliders.rows.el);
    gridRow.appendChild(_sliders.cols.el);
    container.appendChild(gridRow);

    // ── SLIDE SIZE ────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Slide Size'));
    var sizeRow = Utils.el('div', { class: 'row-2' });
    _sliders.slideW = new Slider({ label: 'Width px', min: 20, max: 1920, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Width of each slide in pixels',
      onChange: function(v) { _state.slideW = v; } });
    _sliders.slideH = new Slider({ label: 'Height px', min: 20, max: 1080, value: 150, step: 1, defaultValue: 150,
      tooltip: 'Height of each slide in pixels',
      onChange: function(v) { _state.slideH = v; } });
    sizeRow.appendChild(_sliders.slideW.el);
    sizeRow.appendChild(_sliders.slideH.el);
    container.appendChild(sizeRow);

    // ── SPACING ───────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Spacing'));
    var gapRow = Utils.el('div', { class: 'row-2' });
    _sliders.gapH = new Slider({ label: 'Gap H', min: 0, max: 200, value: 10, step: 1, defaultValue: 10,
      tooltip: 'Horizontal gap between slides',
      onChange: function(v) { _state.gapH = v; } });
    _sliders.gapV = new Slider({ label: 'Gap V', min: 0, max: 200, value: 10, step: 1, defaultValue: 10,
      tooltip: 'Vertical gap between slides',
      onChange: function(v) { _state.gapV = v; } });
    gapRow.appendChild(_sliders.gapH.el);
    gapRow.appendChild(_sliders.gapV.el);
    container.appendChild(gapRow);

    // ── RANDOMIZATION ─────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Randomization'));
    _sliders.randomize = new Slider({ label: 'Position Jitter %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random position offset applied to each slide',
      onChange: function(v) { _state.randomize = v; } });
    _sliders.rotationRandom = new Slider({ label: 'Rotation °', min: 0, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random rotation angle per slide in degrees',
      onChange: function(v) { _state.rotationRandom = v; } });
    _sliders.scaleRandom = new Slider({ label: 'Scale Jitter %', min: 0, max: 50, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Random scale variation per slide',
      onChange: function(v) { _state.scaleRandom = v; } });
    _sliders.randomSeed = new Slider({ label: 'Random Seed', min: 1, max: 9999, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Seed for repeatable random results',
      onChange: function(v) { _state.randomSeed = v; } });
    container.appendChild(_sliders.randomize.el);
    container.appendChild(_sliders.rotationRandom.el);
    container.appendChild(_sliders.scaleRandom.el);
    container.appendChild(_sliders.randomSeed.el);

    // ── CARD STYLE ────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Card Style'));
    _useFramesToggle = new Toggle({ label: 'Use Background', value: true,
      tooltip: 'Fill slide cards with a solid background color',
      onChange: function(v) { _state.useFrames = v; } });
    _bgColorPicker = new ColorPicker({ label: 'Background', value: '#222222',
      tooltip: 'Background color for slide cards',
      onChange: function(v) { _state.bgColor = v; } });
    _sliders.cardOpacity = new Slider({ label: 'Card Opacity %', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Opacity of slide card layers',
      onChange: function(v) { _state.cardOpacity = v; } });
    _strokeToggle = new Toggle({ label: 'Use Stroke', value: false,
      tooltip: 'Add an outline stroke to slide cards',
      onChange: function(v) { _state.strokeEnabled = v; } });
    _sliders.strokeWidth = new Slider({ label: 'Stroke Width', min: 0, max: 50, value: 2, step: 1, defaultValue: 2,
      tooltip: 'Width of the card outline stroke in pixels',
      onChange: function(v) { _state.strokeWidth = v; } });
    _strokeColorPicker = new ColorPicker({ label: 'Stroke Color', value: '#ffffff',
      tooltip: 'Color of the card outline stroke',
      onChange: function(v) { _state.strokeColor = v; } });
    _sliders.roundness = new Slider({ label: 'Roundness', min: 0, max: 200, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Corner roundness of slide cards',
      onChange: function(v) { _state.roundness = v; } });
    container.appendChild(_useFramesToggle.el);
    container.appendChild(_bgColorPicker.el);
    container.appendChild(_sliders.cardOpacity.el);
    container.appendChild(_strokeToggle.el);
    container.appendChild(_sliders.strokeWidth.el);
    container.appendChild(_strokeColorPicker.el);
    container.appendChild(_sliders.roundness.el);

    // ── ANIMATION ─────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
    _animDD = new Dropdown({
      label: 'Entrance Type',
      tooltip: 'Entrance animation applied to each slide',
      options: [
        { value: 'none',      label: 'None' },
        { value: 'fade',      label: 'Fade In' },
        { value: 'scale',     label: 'Scale In' },
        { value: 'slideUp',   label: 'Slide Up' },
        { value: 'slideDown', label: 'Slide Down' },
        { value: 'slideLeft', label: 'Slide Left' },
        { value: 'slideRight',label: 'Slide Right' },
        { value: 'pop',       label: 'Pop In' },
        { value: 'flip',      label: 'Flip In' },
        { value: 'rotate',    label: 'Rotate In' },
        { value: 'blur',      label: 'Blur In' },
        { value: 'random',    label: 'Random Entrance' }
      ],
      value: 'none',
      onChange: function(v) { _state.animType = v; }
    });
    _animDirDD = new Dropdown({
      label: 'Stagger Mode',
      tooltip: 'Order in which slides animate in',
      options: [
        { value: 'byIndex',    label: 'By Index' },
        { value: 'byRow',      label: 'By Row' },
        { value: 'byColumn',   label: 'By Column' },
        { value: 'fromCenter', label: 'From Center' },
        { value: 'random',     label: 'Random' }
      ],
      value: 'byIndex',
      onChange: function(v) { _state.animDirection = v; }
    });
    _sliders.animDuration = new Slider({ label: 'Duration (frames)', min: 1, max: 120, value: 18, step: 1, defaultValue: 18,
      tooltip: 'Duration of each slide entrance in frames',
      onChange: function(v) { _state.animDuration = v; } });
    _sliders.animStagger = new Slider({ label: 'Stagger (frames)', min: 0, max: 60, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Delay in frames between each slide\'s entrance animation',
      onChange: function(v) { _state.animStagger = v; } });
    _sliders.animOffset = new Slider({ label: 'Slide Offset px', min: 0, max: 500, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Distance in pixels slides travel during slide-based entrances',
      onChange: function(v) { _state.animOffset = v; } });
    _sliders.animScaleFrom = new Slider({ label: 'Scale From %', min: 0, max: 200, value: 80, step: 1, defaultValue: 80,
      tooltip: 'Starting scale for scale/pop entrance types',
      onChange: function(v) { _state.animScaleFrom = v; } });
    _sliders.animOpacityFrom = new Slider({ label: 'Opacity From %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Starting opacity for fade entrance type',
      onChange: function(v) { _state.animOpacityFrom = v; } });
    _sliders.animRotateFrom = new Slider({ label: 'Rotate From °', min: -180, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Starting rotation angle for rotate/flip entrance types',
      onChange: function(v) { _state.animRotateFrom = v; } });
    _overshootToggle = new Toggle({ label: 'Overshoot', value: false,
      tooltip: 'Add an overshoot bounce at the end of scale/position entrances',
      onChange: function(v) { _state.useOvershoot = v; } });
    _sliders.overshootAmount = new Slider({ label: 'Overshoot %', min: 0, max: 50, value: 8, step: 1, defaultValue: 8,
      tooltip: 'How much the element overshoots before settling',
      onChange: function(v) { _state.overshootAmount = v; } });
    container.appendChild(_animDD.el);
    container.appendChild(_animDirDD.el);
    container.appendChild(_sliders.animDuration.el);
    container.appendChild(_sliders.animStagger.el);
    container.appendChild(_sliders.animOffset.el);
    container.appendChild(_sliders.animScaleFrom.el);
    container.appendChild(_sliders.animOpacityFrom.el);
    container.appendChild(_sliders.animRotateFrom.el);
    container.appendChild(_overshootToggle.el);
    container.appendChild(_sliders.overshootAmount.el);

    // ── OPTIONS ───────────────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Options'));
    _textToggle = new Toggle({ label: 'Auto-create text layers', value: false,
      tooltip: 'Creates a text layer centered on each slide',
      onChange: function(v) { _state.useText = v; } });
    container.appendChild(_textToggle.el);

    // ── LIVE CONTROLLER ───────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Live Controller'));
    _controllerToggle = new Toggle({ label: 'Create Live Controller', value: false,
      tooltip: 'Creates a SLIDES_CONTROL null with expression-driven layout sliders',
      onChange: function(v) { _state.useController = v; } });
    container.appendChild(_controllerToggle.el);

    // ── GENERATE BUTTON ───────────────────────────────────────────────
    var genBtn = Utils.el('button', { class: 'action-btn', id: 'slides-gen-btn' }, 'Generate Slides');
    genBtn.addEventListener('click', function() { _generate(genBtn); });
    container.appendChild(genBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);
  }

  function _generate(btn) {
    btn.disabled  = true;
    btn.textContent = 'Generating…';
    _status.className = 'status-bar';
    _status.textContent = '';

    Bridge.call('slides.generate', getParams()).then(function(result) {
      btn.disabled = false;
      btn.textContent = 'Generate Slides';
      if (result.error) {
        _status.className = 'status-bar error';
        _status.textContent = result.error;
      } else {
        _status.className = 'status-bar success';
        _status.textContent = 'Generated ' + result.count + ' slides.';
      }
    }).catch(function(e) {
      btn.disabled = false;
      btn.textContent = 'Generate Slides';
      _status.className = 'status-bar error';
      _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

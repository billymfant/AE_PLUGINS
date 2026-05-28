'use strict';

window.PatternsUI = (function () {
  var _state = {
    patternType:  'lsystem',
    preset:       'Koch Snowflake',
    iterations:   4,
    angle:        60,
    customAxiom:  '',
    size:         0,
    strokeWidth:  1.5,
    color:        '#a3e635',
    animType:     'draw',
    animDuration: 2,
    outerRadius:  100,
    innerRadius:  40,
    penRadius:    60,
    steps:        720
  };

  function getParams()    { return Utils.deepClone(_state); }
  function applyPreset(p) {
    Object.assign(_state, p);
    _typeGroup.setValue(p.patternType);
    _presetDD.setValue(p.preset);
    _sliders.iterations.setValue(p.iterations);
    _sliders.angle.setValue(p.angle);
    _sliders.size.setValue(p.size);
    _sliders.strokeWidth.setValue(p.strokeWidth);
    _color.setValue(p.color);
    _animGroup.setValue(p.animType);
    _sliders.animDuration.setValue(p.animDuration);
    _sliders.outerRadius.setValue(p.outerRadius);
    _sliders.innerRadius.setValue(p.innerRadius);
    _sliders.penRadius.setValue(p.penRadius);
    _sliders.steps.setValue(p.steps);
    _updateSections(p.patternType);
  }

  var _sliders = {};
  var _typeGroup, _presetDD, _animGroup, _color;
  var _lsystemSection, _spiroSection, _status;

  function init(container) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Pattern Type'));
    _typeGroup = new ButtonGroup({
      options: [{ value: 'lsystem', label: 'L-System' }, { value: 'spirograph', label: 'Spirograph' }],
      value: 'lsystem',
      onChange: function (v) { _state.patternType = v; _updateSections(v); }
    });
    container.appendChild(_typeGroup.el);

    // ── L-System ──────────────────────────────────────────────
    _lsystemSection = Utils.el('div', {});
    _lsystemSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Grammar'));
    _presetDD = new Dropdown({
      label: 'Pattern',
      tooltip: 'Choose a built-in L-System grammar',
      options: [
        { value: 'Koch Snowflake',      label: 'Koch Snowflake' },
        { value: 'Dragon Curve',        label: 'Dragon Curve' },
        { value: 'Sierpinski Triangle', label: 'Sierpinski Triangle' },
        { value: 'Plant',               label: 'Plant' },
        { value: 'Hilbert Curve',       label: 'Hilbert Curve' },
        { value: 'Levy C Curve',        label: 'Lévy C Curve' },
        { value: 'Gosper Curve',        label: 'Gosper Curve' }
      ],
      value: 'Koch Snowflake',
      onChange: function (v) { _state.preset = v; }
    });
    _sliders.iterations = new Slider({
      label: 'Iterations', min: 1, max: 7, value: 4, step: 1, defaultValue: 4,
      tooltip: 'More iterations = finer detail. Above 5 is slow — use with care.',
      onChange: function (v) { _state.iterations = v; }
    });
    _sliders.angle = new Slider({
      label: 'Angle °', min: 1, max: 180, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Turn angle for + and − turtle commands',
      onChange: function (v) { _state.angle = v; }
    });
    _lsystemSection.appendChild(_presetDD.el);
    _lsystemSection.appendChild(_sliders.iterations.el);
    _lsystemSection.appendChild(_sliders.angle.el);
    container.appendChild(_lsystemSection);

    // ── Spirograph ────────────────────────────────────────────
    _spiroSection = Utils.el('div', {});
    _spiroSection.style.display = 'none';
    _spiroSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Spirograph'));
    var spiroRow1 = Utils.el('div', { class: 'row-2' });
    _sliders.outerRadius = new Slider({ label: 'Outer R', min: 10, max: 300, value: 100, step: 1, defaultValue: 100, tooltip: 'Radius of the fixed outer circle', onChange: function(v){_state.outerRadius=v;} });
    _sliders.innerRadius = new Slider({ label: 'Inner R', min: 1,  max: 300, value: 40,  step: 1, defaultValue: 40,  tooltip: 'Radius of the rolling inner circle', onChange: function(v){_state.innerRadius=v;} });
    spiroRow1.appendChild(_sliders.outerRadius.el);
    spiroRow1.appendChild(_sliders.innerRadius.el);
    _sliders.penRadius = new Slider({ label: 'Pen Dist', min: 1, max: 400, value: 60, step: 1, defaultValue: 60, tooltip: 'Drawing point distance from inner circle center', onChange: function(v){_state.penRadius=v;} });
    _sliders.steps = new Slider({ label: 'Steps', min: 60, max: 2000, value: 720, step: 10, defaultValue: 720, tooltip: 'More steps = smoother curve. 720 covers one full revolution.', onChange: function(v){_state.steps=v;} });
    _spiroSection.appendChild(spiroRow1);
    _spiroSection.appendChild(_sliders.penRadius.el);
    _spiroSection.appendChild(_sliders.steps.el);
    container.appendChild(_spiroSection);

    // ── Appearance ────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Appearance'));
    var sizeStrokeRow = Utils.el('div', { class: 'row-2' });
    _sliders.size = new Slider({ label: 'Size px (0=auto)', min: 0, max: 2000, value: 0, step: 10, defaultValue: 0, tooltip: '0 = auto-fit to 85% of comp. Otherwise sets max dimension.', onChange: function(v){_state.size=v;} });
    _sliders.strokeWidth = new Slider({ label: 'Stroke px', min: 0.5, max: 20, value: 1.5, step: 0.5, decimals: 1, defaultValue: 1.5, onChange: function(v){_state.strokeWidth=v;} });
    sizeStrokeRow.appendChild(_sliders.size.el);
    sizeStrokeRow.appendChild(_sliders.strokeWidth.el);
    container.appendChild(sizeStrokeRow);
    _color = new ColorPicker({ label: 'Stroke Color', value: '#a3e635', onChange: function(v){_state.color=v;} });
    container.appendChild(_color.el);

    // ── Animation ─────────────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
    _animGroup = new ButtonGroup({
      options: [{ value: 'none', label: 'None' }, { value: 'draw', label: 'Draw On' }],
      value: 'draw',
      tooltip: 'Draw On uses Trim Paths to animate the pattern being drawn over time',
      onChange: function (v) { _state.animType = v; }
    });
    _sliders.animDuration = new Slider({ label: 'Duration (s)', min: 0.5, max: 10, value: 2, step: 0.5, decimals: 1, defaultValue: 2, onChange: function(v){_state.animDuration=v;} });
    container.appendChild(_animGroup.el);
    container.appendChild(_sliders.animDuration.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Pattern');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _updateSections(type) {
    _lsystemSection.style.display = type === 'lsystem'    ? '' : 'none';
    _spiroSection.style.display   = type === 'spirograph' ? '' : 'none';
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Generating…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('patterns.generate', getParams()).then(function(r){
      btn.disabled = false; btn.textContent = 'Generate Pattern';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else { _status.className = 'status-bar success'; _status.textContent = 'Pattern created — ' + r.layer; }
    }).catch(function(e){
      btn.disabled = false; btn.textContent = 'Generate Pattern';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());

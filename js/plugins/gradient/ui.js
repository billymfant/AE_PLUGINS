'use strict';

window.GradientUI = (function () {
  var _state = {
    gradientType:    'linear',
    colorStart:      '#0a0a2e',
    colorEnd:        '#ff6b6b',
    startX:          10, startY: 50,
    endX:            90, endY:   50,
    scatter:         0,
    centerX:         50, centerY: 50,
    segments:        16,
    meshBlur:        200,
    meshStops: [
      { x: 20, y: 20, color: '#7c3aed' },
      { x: 80, y: 20, color: '#2563eb' },
      { x: 50, y: 80, color: '#06b6d4' }
    ],
    noiseType:       'basic',
    noiseScale:      250,
    noiseComplexity: 3,
    colorize:        true,
    blendMode:       'normal'
  };

  function getParams()    { return Utils.deepClone(_state); }
  function applyPreset(p) {
    Object.assign(_state, p);
    _typeGroup.setValue(p.gradientType);
    _colorStart.setValue(p.colorStart);
    _colorEnd.setValue(p.colorEnd);
    _sliders.startX.setValue(p.startX);    _sliders.startY.setValue(p.startY);
    _sliders.endX.setValue(p.endX);        _sliders.endY.setValue(p.endY);
    _sliders.scatter.setValue(p.scatter);
    _sliders.centerX.setValue(p.centerX);  _sliders.centerY.setValue(p.centerY);
    _sliders.segments.setValue(p.segments);
    _sliders.meshBlur.setValue(p.meshBlur);
    _noiseDD.setValue(p.noiseType);
    _sliders.noiseScale.setValue(p.noiseScale);
    _sliders.noiseComplexity.setValue(p.noiseComplexity);
    _colorizeToggle.setValue(p.colorize);
    _blendDD.setValue(p.blendMode);
    _updateSections(p.gradientType);
  }

  var _sliders = {};
  var _typeGroup, _colorStart, _colorEnd;
  var _linearSection, _conicalSection, _meshSection, _noiseSection;
  var _noiseDD, _colorizeToggle, _blendDD, _status;

  function init(container) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Type'));
    _typeGroup = new ButtonGroup({
      options: [
        { value: 'linear',  label: 'Linear' },
        { value: 'radial',  label: 'Radial' },
        { value: 'conical', label: 'Conic' },
        { value: 'mesh',    label: 'Mesh' },
        { value: 'noise',   label: 'Noise' }
      ],
      value: 'linear',
      tooltip: 'Type of gradient to generate',
      onChange: function (v) { _state.gradientType = v; _updateSections(v); }
    });
    container.appendChild(_typeGroup.el);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Colors'));
    var colorRow = Utils.el('div', { class: 'row-2' });
    _colorStart = new ColorPicker({ label: 'Start / From', value: '#0a0a2e', onChange: function(v){_state.colorStart=v;} });
    _colorEnd   = new ColorPicker({ label: 'End / To',     value: '#ff6b6b', onChange: function(v){_state.colorEnd=v;} });
    colorRow.appendChild(_colorStart.el);
    colorRow.appendChild(_colorEnd.el);
    container.appendChild(colorRow);

    // ── Linear/Radial ─────────────────────────────────────────
    _linearSection = Utils.el('div', {});
    _linearSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Position'));
    var startRow = Utils.el('div', { class: 'row-2' });
    _sliders.startX = new Slider({ label: 'Start X %', min: 0, max: 100, value: 10, step: 1, defaultValue: 10, onChange: function(v){_state.startX=v;} });
    _sliders.startY = new Slider({ label: 'Start Y %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.startY=v;} });
    startRow.appendChild(_sliders.startX.el);
    startRow.appendChild(_sliders.startY.el);
    var endRow = Utils.el('div', { class: 'row-2' });
    _sliders.endX = new Slider({ label: 'End X %', min: 0, max: 100, value: 90, step: 1, defaultValue: 90, onChange: function(v){_state.endX=v;} });
    _sliders.endY = new Slider({ label: 'End Y %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.endY=v;} });
    endRow.appendChild(_sliders.endX.el);
    endRow.appendChild(_sliders.endY.el);
    _sliders.scatter = new Slider({ label: 'Scatter', min: 0, max: 100, value: 0, step: 1, defaultValue: 0, tooltip: 'Noise dithering to reduce color banding', onChange: function(v){_state.scatter=v;} });
    _linearSection.appendChild(startRow);
    _linearSection.appendChild(endRow);
    _linearSection.appendChild(_sliders.scatter.el);
    container.appendChild(_linearSection);

    // ── Conical ───────────────────────────────────────────────
    _conicalSection = Utils.el('div', {});
    _conicalSection.style.display = 'none';
    _conicalSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Center'));
    var cRow = Utils.el('div', { class: 'row-2' });
    _sliders.centerX = new Slider({ label: 'Center X %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.centerX=v;} });
    _sliders.centerY = new Slider({ label: 'Center Y %', min: 0, max: 100, value: 50, step: 1, defaultValue: 50, onChange: function(v){_state.centerY=v;} });
    cRow.appendChild(_sliders.centerX.el);
    cRow.appendChild(_sliders.centerY.el);
    _sliders.segments = new Slider({ label: 'Segments', min: 4, max: 36, value: 16, step: 1, defaultValue: 16, tooltip: 'More segments = smoother conic gradient', onChange: function(v){_state.segments=v;} });
    _conicalSection.appendChild(cRow);
    _conicalSection.appendChild(_sliders.segments.el);
    container.appendChild(_conicalSection);

    // ── Mesh ──────────────────────────────────────────────────
    _meshSection = Utils.el('div', {});
    _meshSection.style.display = 'none';
    _meshSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Mesh'));
    _sliders.meshBlur = new Slider({ label: 'Blur Radius px', min: 50, max: 600, value: 200, step: 10, defaultValue: 200, tooltip: 'Controls how far each color point bleeds', onChange: function(v){_state.meshBlur=v;} });
    _meshSection.appendChild(_sliders.meshBlur.el);
    _meshSection.appendChild(Utils.el('div', { class: 'help-text' }, 'Edit meshStops in saved presets for custom control points.'));
    container.appendChild(_meshSection);

    // ── Noise ─────────────────────────────────────────────────
    _noiseSection = Utils.el('div', {});
    _noiseSection.style.display = 'none';
    _noiseSection.appendChild(Utils.el('div', { class: 'section-label' }, 'Noise'));
    _noiseDD = new Dropdown({
      label: 'Noise Type',
      options: [{ value: 'basic', label: 'Basic' }, { value: 'turbulent', label: 'Turbulent' }],
      value: 'basic',
      onChange: function(v){_state.noiseType=v;}
    });
    _sliders.noiseScale      = new Slider({ label: 'Scale',      min: 50, max: 1000, value: 250, step: 10, defaultValue: 250, onChange: function(v){_state.noiseScale=v;} });
    _sliders.noiseComplexity = new Slider({ label: 'Complexity', min: 1,  max: 8,    value: 3,   step: 1,  defaultValue: 3,   onChange: function(v){_state.noiseComplexity=v;} });
    _colorizeToggle = new Toggle({ label: 'Colorize', value: true, tooltip: 'Apply Start/End colors as a tint over the noise', onChange: function(v){_state.colorize=v;} });
    _noiseSection.appendChild(_noiseDD.el);
    _noiseSection.appendChild(_sliders.noiseScale.el);
    _noiseSection.appendChild(_sliders.noiseComplexity.el);
    _noiseSection.appendChild(_colorizeToggle.el);
    container.appendChild(_noiseSection);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Output'));
    _blendDD = new Dropdown({
      label: 'Blend Mode',
      options: [
        { value: 'normal',   label: 'Normal' },
        { value: 'add',      label: 'Add' },
        { value: 'screen',   label: 'Screen' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'overlay',  label: 'Overlay' },
        { value: 'soft',     label: 'Soft Light' }
      ],
      value: 'normal',
      onChange: function(v){_state.blendMode=v;}
    });
    container.appendChild(_blendDD.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Gradient');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _updateSections(type) {
    _linearSection.style.display  = (type === 'linear' || type === 'radial') ? '' : 'none';
    _conicalSection.style.display = type === 'conical' ? '' : 'none';
    _meshSection.style.display    = type === 'mesh'    ? '' : 'none';
    _noiseSection.style.display   = type === 'noise'   ? '' : 'none';
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Generating…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('gradient.apply', getParams()).then(function (r) {
      btn.disabled = false; btn.textContent = 'Generate Gradient';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else         { _status.className = 'status-bar success'; _status.textContent = r.type + ' gradient created.'; }
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Generate Gradient';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());

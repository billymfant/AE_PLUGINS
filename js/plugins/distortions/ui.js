'use strict';

window.DistortionsUI = (function() {
  var _state = {
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
    blendOpacity: 100
  };

  function getParams() { return Utils.deepClone(_state); }

  var _sliders = {};
  var _typeGroup, _lensSection, _warpSection, _swirlSection, _waveSection, _status;

  function applyPreset(p) {
    Object.assign(_state, p);
    _typeGroup.setValue(p.distType);
    _sliders.intensity.setValue(p.intensity);
    _sliders.radius.setValue(p.radius);
    _sliders.feather.setValue(p.feather !== undefined ? p.feather : 0);
    _sliders.blendOpacity.setValue(p.blendOpacity);
    _sliders.centerX.setValue(p.centerX !== undefined ? p.centerX : 0.5);
    _sliders.centerY.setValue(p.centerY !== undefined ? p.centerY : 0.5);
    _showSection(p.distType);
  }

  function init(container) {
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
      tooltip: 'Soft edge blend — when > 0, distortion is applied to a duplicate layer with a feathered mask',
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

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Distortion');
    applyBtn.addEventListener('click', function() { _apply(applyBtn); });
    container.appendChild(applyBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);
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

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

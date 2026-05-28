'use strict';

window.ColorLabUI = (function () {
  var _state = {
    look:                'none',
    lookIntensity:       100,
    hue:                 0,
    saturation:          0,
    lightness:           0,
    brightness:          0,
    contrast:            0,
    shadowsHue:          0,
    shadowsLightness:    0,
    shadowsSaturation:   0,
    midtonesHue:         0,
    midtonesLightness:   0,
    midtonesSaturation:  0,
    highlightsHue:       0,
    highlightsLightness: 0,
    highlightsSaturation:0,
    tintAmount:          0,
    tintBlack:           '#000000',
    tintWhite:           '#ffffff',
    grainAmount:         0,
    grainColor:          false,
    vignetteAmount:      0
  };

  function getParams() { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    _lookDD.setValue(p.look);
    _sliders.lookIntensity.setValue(p.lookIntensity);
    _sliders.hue.setValue(p.hue);
    _sliders.saturation.setValue(p.saturation);
    _sliders.lightness.setValue(p.lightness);
    _sliders.brightness.setValue(p.brightness);
    _sliders.contrast.setValue(p.contrast);
    _sliders.shadowsHue.setValue(p.shadowsHue);
    _sliders.shadowsLightness.setValue(p.shadowsLightness);
    _sliders.shadowsSaturation.setValue(p.shadowsSaturation);
    _sliders.midtonesHue.setValue(p.midtonesHue);
    _sliders.midtonesLightness.setValue(p.midtonesLightness);
    _sliders.midtonesSaturation.setValue(p.midtonesSaturation);
    _sliders.highlightsHue.setValue(p.highlightsHue);
    _sliders.highlightsLightness.setValue(p.highlightsLightness);
    _sliders.highlightsSaturation.setValue(p.highlightsSaturation);
    _sliders.tintAmount.setValue(p.tintAmount);
    _tintBlack.setValue(p.tintBlack);
    _tintWhite.setValue(p.tintWhite);
    _sliders.grainAmount.setValue(p.grainAmount);
    _grainColorToggle.setValue(p.grainColor);
    _sliders.vignetteAmount.setValue(p.vignetteAmount);
  }

  var _sliders = {};
  var _lookDD, _tintBlack, _tintWhite, _grainColorToggle, _status;

  function init(container) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Film Look'));
    _lookDD = new Dropdown({
      label: 'Look Preset',
      tooltip: 'Film-inspired color grade applied as a base look',
      options: [
        { value: 'none',                 label: 'None' },
        { value: 'bleach_bypass',        label: 'Bleach Bypass' },
        { value: 'cinematic_teal_orange',label: 'Teal & Orange' },
        { value: 'vintage',              label: 'Vintage' },
        { value: 'cool_blue',            label: 'Cool Blue' },
        { value: 'warm_golden',          label: 'Warm Golden' },
        { value: 'horror',               label: 'Horror' }
      ],
      value: 'none',
      onChange: function (v) { _state.look = v; }
    });
    _sliders.lookIntensity = new Slider({
      label: 'Look Intensity %', min: 0, max: 100, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Blend strength of the chosen look — 0 = off, 100 = full',
      onChange: function (v) { _state.lookIntensity = v; }
    });
    container.appendChild(_lookDD.el);
    container.appendChild(_sliders.lookIntensity.el);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Global'));
    _sliders.hue = new Slider({
      label: 'Hue °', min: -180, max: 180, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Master hue rotation in degrees',
      onChange: function (v) { _state.hue = v; }
    });
    _sliders.saturation = new Slider({
      label: 'Saturation', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Boost (+) or reduce (−) overall color saturation',
      onChange: function (v) { _state.saturation = v; }
    });
    _sliders.lightness = new Slider({
      label: 'Lightness', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Master lightness offset',
      onChange: function (v) { _state.lightness = v; }
    });
    var globalRow = Utils.el('div', { class: 'row-2' });
    _sliders.brightness = new Slider({
      label: 'Brightness', min: -150, max: 150, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.brightness = v; }
    });
    _sliders.contrast = new Slider({
      label: 'Contrast', min: -100, max: 100, value: 0, step: 1, defaultValue: 0,
      onChange: function (v) { _state.contrast = v; }
    });
    globalRow.appendChild(_sliders.brightness.el);
    globalRow.appendChild(_sliders.contrast.el);
    container.appendChild(_sliders.hue.el);
    container.appendChild(_sliders.saturation.el);
    container.appendChild(_sliders.lightness.el);
    container.appendChild(globalRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Shadows'));
    var shadowRow = Utils.el('div', { class: 'row-3' });
    _sliders.shadowsHue        = new Slider({ label: 'Hue',  min: -180, max: 180, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.shadowsHue=v;} });
    _sliders.shadowsLightness  = new Slider({ label: 'Lift', min: -100, max: 100, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.shadowsLightness=v;} });
    _sliders.shadowsSaturation = new Slider({ label: 'Sat',  min: -100, max: 100, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.shadowsSaturation=v;} });
    shadowRow.appendChild(_sliders.shadowsHue.el);
    shadowRow.appendChild(_sliders.shadowsLightness.el);
    shadowRow.appendChild(_sliders.shadowsSaturation.el);
    container.appendChild(shadowRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Midtones'));
    var midRow = Utils.el('div', { class: 'row-3' });
    _sliders.midtonesHue        = new Slider({ label: 'Hue',   min: -180, max: 180, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.midtonesHue=v;} });
    _sliders.midtonesLightness  = new Slider({ label: 'Gamma', min: -100, max: 100, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.midtonesLightness=v;} });
    _sliders.midtonesSaturation = new Slider({ label: 'Sat',   min: -100, max: 100, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.midtonesSaturation=v;} });
    midRow.appendChild(_sliders.midtonesHue.el);
    midRow.appendChild(_sliders.midtonesLightness.el);
    midRow.appendChild(_sliders.midtonesSaturation.el);
    container.appendChild(midRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Highlights'));
    var hiRow = Utils.el('div', { class: 'row-3' });
    _sliders.highlightsHue        = new Slider({ label: 'Hue',  min: -180, max: 180, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.highlightsHue=v;} });
    _sliders.highlightsLightness  = new Slider({ label: 'Gain', min: -100, max: 100, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.highlightsLightness=v;} });
    _sliders.highlightsSaturation = new Slider({ label: 'Sat',  min: -100, max: 100, value: 0, step: 1, defaultValue: 0, onChange: function(v){_state.highlightsSaturation=v;} });
    hiRow.appendChild(_sliders.highlightsHue.el);
    hiRow.appendChild(_sliders.highlightsLightness.el);
    hiRow.appendChild(_sliders.highlightsSaturation.el);
    container.appendChild(hiRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Tint'));
    _sliders.tintAmount = new Slider({
      label: 'Amount %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Blend a two-color tint over the image — 0 = off',
      onChange: function (v) { _state.tintAmount = v; }
    });
    var tintRow = Utils.el('div', { class: 'row-2' });
    _tintBlack = new ColorPicker({ label: 'Map Black', value: '#000000', onChange: function(v){_state.tintBlack=v;} });
    _tintWhite = new ColorPicker({ label: 'Map White', value: '#ffffff', onChange: function(v){_state.tintWhite=v;} });
    tintRow.appendChild(_tintBlack.el);
    tintRow.appendChild(_tintWhite.el);
    container.appendChild(_sliders.tintAmount.el);
    container.appendChild(tintRow);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Film Grain'));
    _sliders.grainAmount = new Slider({
      label: 'Amount %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Simulate analog film grain over the grade',
      onChange: function (v) { _state.grainAmount = v; }
    });
    _grainColorToggle = new Toggle({
      label: 'Color grain', value: false,
      tooltip: 'Adds chromatic color noise instead of luminance-only grain',
      onChange: function (v) { _state.grainColor = v; }
    });
    container.appendChild(_sliders.grainAmount.el);
    container.appendChild(_grainColorToggle.el);

    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Vignette'));
    _sliders.vignetteAmount = new Slider({
      label: 'Strength', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Dark edge vignette — 0 = off, 100 = heavy',
      onChange: function (v) { _state.vignetteAmount = v; }
    });
    container.appendChild(_sliders.vignetteAmount.el);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Color Grade');
    _status = Utils.el('div', { class: 'status-bar' }, '');
    applyBtn.addEventListener('click', function () { _apply(applyBtn); });
    container.appendChild(applyBtn);
    container.appendChild(_status);
  }

  function _apply(btn) {
    btn.disabled = true; btn.textContent = 'Grading…';
    _status.className = 'status-bar'; _status.textContent = '';
    Bridge.call('colorlab.apply', getParams()).then(function (r) {
      btn.disabled = false; btn.textContent = 'Apply Color Grade';
      if (r.error) { _status.className = 'status-bar error'; _status.textContent = r.error; }
      else { _status.className = 'status-bar success'; _status.textContent = 'Grade applied — ' + r.effects + ' effects stacked.'; }
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Apply Color Grade';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
}());

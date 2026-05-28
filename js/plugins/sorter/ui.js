'use strict';

window.SorterUI = (function() {
  var _state = {
    sortMode:   'brightness',
    direction:  'horizontal',
    sortLength: 200,
    threshold:  60,
    randomness: 0,
    useColorKey: false,
    keyColor:    '#ff0000',
    keyHueTol:   30,
    iterations:  1
  };

  function getParams() { return Utils.deepClone(_state); }

  var _sliders = {};
  var _modeGroup, _dirGroup, _keyToggle, _keyColor, _keyHueTol, _status;

  function applyPreset(p) {
    Object.assign(_state, p);
    _sliders.sortLength.setValue(p.sortLength);
    _sliders.threshold.setValue(p.threshold);
    _sliders.randomness.setValue(p.randomness);
    _sliders.iterations.setValue(p.iterations);
    _modeGroup.setValue(p.sortMode);
    _dirGroup.setValue(p.direction);
    _keyToggle.setValue(p.useColorKey);
    _keyColor.setValue(p.keyColor);
    _keyHueTol.setValue(p.keyHueTol);
  }

  function init(container) {
    // Sort mode
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Sort Mode'));
    _modeGroup = new ButtonGroup({
      tooltip: 'Which pixel channel drives the sort order',
      options: [
        { value: 'brightness', label: 'Bright' },
        { value: 'hue',        label: 'Hue' },
        { value: 'saturation', label: 'Sat' },
        { value: 'red',        label: 'Red' }
      ],
      value: 'brightness',
      onChange: function(v) { _state.sortMode = v; }
    });
    container.appendChild(_modeGroup.el);

    // Direction
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Direction'));
    _dirGroup = new ButtonGroup({
      tooltip: 'Direction of the sort smear effect',
      options: [
        { value: 'horizontal', label: 'H' },
        { value: 'vertical',   label: 'V' },
        { value: 'diagonal',   label: 'Diag' },
        { value: 'radial',     label: 'Radial' }
      ],
      value: 'horizontal',
      onChange: function(v) { _state.direction = v; }
    });
    container.appendChild(_dirGroup.el);

    // Sort controls
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Sort'));
    _sliders.sortLength = new Slider({ label: 'Sort Length px', min: 1, max: 2000, value: 200, step: 1, defaultValue: 200,
      tooltip: 'Length of the directional blur smear — larger = longer pixel streaks',
      onChange: function(v) { _state.sortLength = v; } });
    _sliders.threshold = new Slider({ label: 'Threshold (0–100)', min: 0, max: 100, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Brightness cutoff — only pixels brighter than this threshold are sorted',
      onChange: function(v) { _state.threshold = v; } });
    _sliders.randomness = new Slider({ label: 'Randomness %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Adds turbulent variation to the sort threshold mask — higher = more chaotic edges',
      onChange: function(v) { _state.randomness = v; } });
    _sliders.iterations = new Slider({ label: 'Iterations', min: 1, max: 10, value: 1, step: 1, defaultValue: 1,
      tooltip: 'Number of sort passes applied — each pass adds another matte+blur layer set',
      onChange: function(v) { _state.iterations = v; } });
    container.appendChild(_sliders.sortLength.el);
    container.appendChild(_sliders.threshold.el);
    container.appendChild(_sliders.randomness.el);
    container.appendChild(_sliders.iterations.el);

    // Color key
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Color Key (mask sort area)'));
    _keyToggle = new Toggle({ label: 'Enable Color Key', value: false,
      tooltip: 'Limit sorting to pixels matching the key color hue range',
      onChange: function(v) { _state.useColorKey = v; _setKeyEnabled(v); } });
    _keyColor = new ColorPicker({ label: 'Key Color', value: '#ff0000',
      tooltip: 'Hue to target for color-keyed sort masking',
      onChange: function(v) { _state.keyColor = v; } });
    _keyHueTol = new Slider({ label: 'Hue Tolerance °', min: 1, max: 180, value: 30, step: 1, defaultValue: 30,
      tooltip: 'Hue angle tolerance around the key color — wider = more pixels included',
      onChange: function(v) { _state.keyHueTol = v; } });
    container.appendChild(_keyToggle.el);
    container.appendChild(_keyColor.el);
    container.appendChild(_keyHueTol.el);
    _setKeyEnabled(false);

    var applyBtn = Utils.el('button', { class: 'action-btn' }, 'Apply Pixel Sort');
    applyBtn.addEventListener('click', function() { _apply(applyBtn); });
    container.appendChild(applyBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);
  }

  function _setKeyEnabled(en) {
    _keyColor.el.style.opacity  = en ? '' : '0.4';
    _keyHueTol.setEnabled(en);
  }

  function _apply(btn) {
    btn.disabled    = true;
    btn.textContent = 'Applying…';
    Bridge.call('sorter.apply', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Apply Pixel Sort';
      if (result.error) { _status.className = 'status-bar error'; _status.textContent = result.error; }
      else              { _status.className = 'status-bar success'; _status.textContent = 'Pixel sort applied.'; }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Apply Pixel Sort';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

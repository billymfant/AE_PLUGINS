'use strict';

window.SlidesUI = (function() {
  var _state = {
    rows: 3, cols: 3,
    slideW: 200, slideH: 150,
    gapH: 10, gapV: 10,
    randomize: 0,
    rotationRandom: 0,
    scaleRandom: 0,
    animType: 'none',
    animStagger: 5,
    useText: false
  };

  function getParams() { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    _sliders.rows.setValue(p.rows);
    _sliders.cols.setValue(p.cols);
    _sliders.slideW.setValue(p.slideW);
    _sliders.slideH.setValue(p.slideH);
    _sliders.gapH.setValue(p.gapH);
    _sliders.gapV.setValue(p.gapV);
    _sliders.randomize.setValue(p.randomize);
    _sliders.rotationRandom.setValue(p.rotationRandom);
    _sliders.scaleRandom.setValue(p.scaleRandom);
    _sliders.animStagger.setValue(p.animStagger);
    _animDD.setValue(p.animType);
    _textToggle.setValue(p.useText);
  }

  var _sliders = {};
  var _animDD, _textToggle, _status;

  function init(container) {
    // Grid section
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

    // Slide size
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

    // Spacing
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

    // Randomization
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
    container.appendChild(_sliders.randomize.el);
    container.appendChild(_sliders.rotationRandom.el);
    container.appendChild(_sliders.scaleRandom.el);

    // Animation
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
    _animDD = new Dropdown({
      label: 'Entrance Type',
      tooltip: 'Entrance animation applied to each slide',
      options: [
        { value: 'none',      label: 'None' },
        { value: 'fade',      label: 'Fade In' },
        { value: 'scale',     label: 'Scale In' },
        { value: 'slideUp',   label: 'Slide Up' },
        { value: 'slideDown', label: 'Slide Down' }
      ],
      value: 'none',
      onChange: function(v) { _state.animType = v; }
    });
    _sliders.animStagger = new Slider({ label: 'Stagger (frames)', min: 0, max: 60, value: 5, step: 1, defaultValue: 5,
      tooltip: 'Delay in frames between each slide\'s entrance animation',
      onChange: function(v) { _state.animStagger = v; } });
    container.appendChild(_animDD.el);
    container.appendChild(_sliders.animStagger.el);

    // Options
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Options'));
    _textToggle = new Toggle({ label: 'Auto-create text layers', value: false,
      tooltip: 'Creates a text layer centered on each slide',
      onChange: function(v) { _state.useText = v; } });
    container.appendChild(_textToggle.el);

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

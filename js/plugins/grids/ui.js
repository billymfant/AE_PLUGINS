'use strict';

window.GridsUI = (function() {
  var _state = {
    gridType: 'rect',
    width: 500, height: 500,
    cellSize: 40,
    lineWidth: 1,
    lineColor: '#4d9fff',
    fillColor: '#000000',
    fillOpacity: 0,
    rotation: 0,
    animType: 'none',
    animStagger: 3
  };

  function getParams() { return Utils.deepClone(_state); }

  var _sliders = {};
  var _typeGroup, _lineColor, _fillColor, _fillOpacity, _animDD, _status;

  function applyPreset(p) {
    Object.assign(_state, p);
    _sliders.width.setValue(p.width);
    _sliders.height.setValue(p.height);
    _sliders.cellSize.setValue(p.cellSize);
    _sliders.lineWidth.setValue(p.lineWidth);
    _sliders.rotation.setValue(p.rotation);
    _sliders.animStagger.setValue(p.animStagger);
    _typeGroup.setValue(p.gridType);
    _lineColor.setValue(p.lineColor);
    _fillColor.setValue(p.fillColor);
    _fillOpacity.setValue(p.fillOpacity);
    _animDD.setValue(p.animType);
  }

  function init(container) {
    // Type
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Grid Type'));
    _typeGroup = new ButtonGroup({
      tooltip: 'Grid pattern type to generate',
      options: [
        { value: 'rect',   label: 'Rect' },
        { value: 'hex',    label: 'Hex' },
        { value: 'tri',    label: 'Tri' },
        { value: 'radial', label: 'Radial' },
        { value: 'circ',   label: 'Circle' }
      ],
      value: 'rect',
      onChange: function(v) { _state.gridType = v; }
    });
    container.appendChild(_typeGroup.el);

    // Dimensions
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Dimensions'));
    var dimRow = Utils.el('div', { class: 'row-2' });
    _sliders.width = new Slider({ label: 'Width px', min: 50, max: 4000, value: 500, step: 1, defaultValue: 500,
      tooltip: 'Total width of the grid area',
      onChange: function(v) { _state.width = v; } });
    _sliders.height = new Slider({ label: 'Height px', min: 50, max: 4000, value: 500, step: 1, defaultValue: 500,
      tooltip: 'Total height of the grid area',
      onChange: function(v) { _state.height = v; } });
    dimRow.appendChild(_sliders.width.el);
    dimRow.appendChild(_sliders.height.el);
    container.appendChild(dimRow);

    _sliders.cellSize = new Slider({ label: 'Cell Size px', min: 4, max: 400, value: 40, step: 1, defaultValue: 40,
      tooltip: 'Size of each individual grid cell',
      onChange: function(v) { _state.cellSize = v; } });
    _sliders.rotation = new Slider({ label: 'Rotation °', min: 0, max: 360, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Rotation of the entire grid layer',
      onChange: function(v) { _state.rotation = v; } });
    container.appendChild(_sliders.cellSize.el);
    container.appendChild(_sliders.rotation.el);

    // Style
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Style'));
    _sliders.lineWidth = new Slider({ label: 'Line Width px', min: 0.5, max: 20, value: 1, step: 0.5, decimals: 1, defaultValue: 1,
      tooltip: 'Stroke width of grid lines',
      onChange: function(v) { _state.lineWidth = v; } });
    container.appendChild(_sliders.lineWidth.el);

    _lineColor = new ColorPicker({ label: 'Line Color', value: '#4d9fff',
      tooltip: 'Color of grid lines',
      onChange: function(v) { _state.lineColor = v; } });
    _fillColor = new ColorPicker({ label: 'Fill Color', value: '#000000',
      tooltip: 'Background fill color for each cell',
      onChange: function(v) { _state.fillColor = v; } });
    _fillOpacity = new Slider({ label: 'Fill Opacity %', min: 0, max: 100, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Opacity of the cell fill (0 = transparent)',
      onChange: function(v) { _state.fillOpacity = v; } });
    container.appendChild(_lineColor.el);
    container.appendChild(_fillColor.el);
    container.appendChild(_fillOpacity.el);

    // Animation
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Animation'));
    _animDD = new Dropdown({
      label: 'Entrance',
      tooltip: 'Entrance animation for the grid',
      options: [
        { value: 'none',   label: 'None' },
        { value: 'fade',   label: 'Fade In' },
        { value: 'scale',  label: 'Scale In' },
        { value: 'stroke', label: 'Stroke Draw' }
      ],
      value: 'none',
      onChange: function(v) { _state.animType = v; }
    });
    _sliders.animStagger = new Slider({ label: 'Stagger (frames)', min: 0, max: 30, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Delay in frames for stagger animation',
      onChange: function(v) { _state.animStagger = v; } });
    container.appendChild(_animDD.el);
    container.appendChild(_sliders.animStagger.el);

    var genBtn = Utils.el('button', { class: 'action-btn' }, 'Generate Grid');
    genBtn.addEventListener('click', function() { _generate(genBtn); });
    container.appendChild(genBtn);

    _status = Utils.el('div', { class: 'status-bar' }, '');
    container.appendChild(_status);
  }

  function _generate(btn) {
    btn.disabled    = true;
    btn.textContent = 'Generating…';
    Bridge.call('grids.generate', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Generate Grid';
      if (result.error) { _status.className = 'status-bar error'; _status.textContent = result.error; }
      else              { _status.className = 'status-bar success'; _status.textContent = 'Grid created: ' + result.cells + ' cells.'; }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Generate Grid';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

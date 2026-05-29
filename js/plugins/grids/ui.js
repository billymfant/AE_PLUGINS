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
    animStagger: 3,
    // Layout Rig fields
    columns: 3,
    gapX: 24, gapY: 24,
    marginX: 60, marginY: 60,
    gridWidth: 0, gridHeight: 0,
    fitMode: 5,
    itemScale: 100,
    offsetX: 0, offsetY: 0,
    altRowOffset: 0, altColOffset: 0,
    progShiftX: 0, progShiftY: 0
  };

  function getParams() { return Utils.deepClone(_state); }

  var _sliders = {};
  var _typeGroup, _lineColor, _fillColor, _fillOpacity, _animDD, _status;
  var _fitModeDD;

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
    // Layout Rig fields — guarded
    if (p.columns     !== undefined) _sliders.columns.setValue(p.columns);
    if (p.gapX        !== undefined) _sliders.gapX.setValue(p.gapX);
    if (p.gapY        !== undefined) _sliders.gapY.setValue(p.gapY);
    if (p.marginX     !== undefined) _sliders.marginX.setValue(p.marginX);
    if (p.marginY     !== undefined) _sliders.marginY.setValue(p.marginY);
    if (p.gridWidth   !== undefined) _sliders.gridWidth.setValue(p.gridWidth);
    if (p.gridHeight  !== undefined) _sliders.gridHeight.setValue(p.gridHeight);
    if (p.fitMode     !== undefined) _fitModeDD.setValue(p.fitMode);
    if (p.itemScale   !== undefined) _sliders.itemScale.setValue(p.itemScale);
    if (p.offsetX     !== undefined) _sliders.offsetX.setValue(p.offsetX);
    if (p.offsetY     !== undefined) _sliders.offsetY.setValue(p.offsetY);
    if (p.altRowOffset  !== undefined) _sliders.altRowOffset.setValue(p.altRowOffset);
    if (p.altColOffset  !== undefined) _sliders.altColOffset.setValue(p.altColOffset);
    if (p.progShiftX  !== undefined) _sliders.progShiftX.setValue(p.progShiftX);
    if (p.progShiftY  !== undefined) _sliders.progShiftY.setValue(p.progShiftY);
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

    // ── Layout Rig Section ────────────────────────────────────
    container.appendChild(Utils.el('div', { class: 'section-label' }, 'Layout Rig (selected layers)'));

    _sliders.columns = new Slider({
      label: 'Columns', min: 1, max: 20, value: 3, step: 1, defaultValue: 3,
      tooltip: 'Number of columns in the layout grid',
      onChange: function(v) { _state.columns = v; }
    });
    container.appendChild(_sliders.columns.el);

    var gapRow = Utils.el('div', { class: 'row-2' });
    _sliders.gapX = new Slider({
      label: 'Gap X px', min: 0, max: 300, value: 24, step: 1, defaultValue: 24,
      tooltip: 'Horizontal gap between cells',
      onChange: function(v) { _state.gapX = v; }
    });
    _sliders.gapY = new Slider({
      label: 'Gap Y px', min: 0, max: 300, value: 24, step: 1, defaultValue: 24,
      tooltip: 'Vertical gap between cells',
      onChange: function(v) { _state.gapY = v; }
    });
    gapRow.appendChild(_sliders.gapX.el);
    gapRow.appendChild(_sliders.gapY.el);
    container.appendChild(gapRow);

    var marginRow = Utils.el('div', { class: 'row-2' });
    _sliders.marginX = new Slider({
      label: 'Margin X px', min: 0, max: 500, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Horizontal margin inside the grid area',
      onChange: function(v) { _state.marginX = v; }
    });
    _sliders.marginY = new Slider({
      label: 'Margin Y px', min: 0, max: 500, value: 60, step: 1, defaultValue: 60,
      tooltip: 'Vertical margin inside the grid area',
      onChange: function(v) { _state.marginY = v; }
    });
    marginRow.appendChild(_sliders.marginX.el);
    marginRow.appendChild(_sliders.marginY.el);
    container.appendChild(marginRow);

    var gridSizeRow = Utils.el('div', { class: 'row-2' });
    _sliders.gridWidth = new Slider({
      label: 'Grid Width px', min: 0, max: 4000, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Grid area width in pixels (0 = comp size)',
      onChange: function(v) { _state.gridWidth = v; }
    });
    _sliders.gridHeight = new Slider({
      label: 'Grid Height px', min: 0, max: 4000, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Grid area height in pixels (0 = comp size)',
      onChange: function(v) { _state.gridHeight = v; }
    });
    gridSizeRow.appendChild(_sliders.gridWidth.el);
    gridSizeRow.appendChild(_sliders.gridHeight.el);
    container.appendChild(gridSizeRow);

    _fitModeDD = new Dropdown({
      label: 'Fit Mode',
      tooltip: 'How layer scale is fitted to the cell',
      options: [
        { value: 1, label: 'None' },
        { value: 2, label: 'Fill' },
        { value: 3, label: 'Fit W' },
        { value: 4, label: 'Fit H' },
        { value: 5, label: 'Fit Best' },
        { value: 6, label: 'Stretch' }
      ],
      value: 5,
      onChange: function(v) { _state.fitMode = v; }
    });
    container.appendChild(_fitModeDD.el);

    _sliders.itemScale = new Slider({
      label: 'Item Scale %', min: 1, max: 300, value: 100, step: 1, defaultValue: 100,
      tooltip: 'Scale multiplier applied on top of fit mode',
      onChange: function(v) { _state.itemScale = v; }
    });
    container.appendChild(_sliders.itemScale.el);

    var offsetRow = Utils.el('div', { class: 'row-2' });
    _sliders.offsetX = new Slider({
      label: 'Offset X px', min: -2000, max: 2000, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Global horizontal offset for all items',
      onChange: function(v) { _state.offsetX = v; }
    });
    _sliders.offsetY = new Slider({
      label: 'Offset Y px', min: -2000, max: 2000, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Global vertical offset for all items',
      onChange: function(v) { _state.offsetY = v; }
    });
    offsetRow.appendChild(_sliders.offsetX.el);
    offsetRow.appendChild(_sliders.offsetY.el);
    container.appendChild(offsetRow);

    var altRow = Utils.el('div', { class: 'row-2' });
    _sliders.altRowOffset = new Slider({
      label: 'Alt Row Offset px', min: -500, max: 500, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Horizontal nudge applied to odd-numbered rows',
      onChange: function(v) { _state.altRowOffset = v; }
    });
    _sliders.altColOffset = new Slider({
      label: 'Alt Col Offset px', min: -500, max: 500, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Vertical nudge applied to odd-numbered columns',
      onChange: function(v) { _state.altColOffset = v; }
    });
    altRow.appendChild(_sliders.altRowOffset.el);
    altRow.appendChild(_sliders.altColOffset.el);
    container.appendChild(altRow);

    var progRow = Utils.el('div', { class: 'row-2' });
    _sliders.progShiftX = new Slider({
      label: 'Prog Shift X px', min: -200, max: 200, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Progressive horizontal shift per row',
      onChange: function(v) { _state.progShiftX = v; }
    });
    _sliders.progShiftY = new Slider({
      label: 'Prog Shift Y px', min: -200, max: 200, value: 0, step: 1, defaultValue: 0,
      tooltip: 'Progressive vertical shift per column',
      onChange: function(v) { _state.progShiftY = v; }
    });
    progRow.appendChild(_sliders.progShiftX.el);
    progRow.appendChild(_sliders.progShiftY.el);
    container.appendChild(progRow);

    var rigBtn = Utils.el('button', { class: 'action-btn' }, 'Create Layout Rig');
    rigBtn.addEventListener('click', function() { _createRig(rigBtn); });
    container.appendChild(rigBtn);
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

  function _createRig(btn) {
    btn.disabled    = true;
    btn.textContent = 'Building Rig…';
    Bridge.call('grids.createRig', getParams()).then(function(result) {
      btn.disabled    = false;
      btn.textContent = 'Create Layout Rig';
      if (result.error) { _status.className = 'status-bar error'; _status.textContent = result.error; }
      else              { _status.className = 'status-bar success'; _status.textContent = 'Layout rig: ' + result.count + ' layers.'; }
    }).catch(function(e) {
      btn.disabled    = false;
      btn.textContent = 'Create Layout Rig';
      _status.className = 'status-bar error'; _status.textContent = e.message;
    });
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };
})();

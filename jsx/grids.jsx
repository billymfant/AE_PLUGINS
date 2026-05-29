var Grids = (function() {

  function generate(params) {
    return withUndo('Grids Pro', function() {
      var comp     = requireComp();
      var type     = params.gridType  || 'rect';
      var w        = params.width     || 500;
      var h        = params.height    || 500;
      var cell     = params.cellSize  || 40;
      var lw       = params.lineWidth || 1;
      var lColor   = hexToRgb(params.lineColor  || '#4d9fff');
      var fColor   = hexToRgb(params.fillColor  || '#000000');
      var fOpacity = params.fillOpacity || 0;   // 0-100
      var rotation = params.rotation  || 0;
      var anim     = params.animType  || 'none';
      var stagger  = params.animStagger || 3;

      var cx = comp.width  / 2;
      var cy = comp.height / 2;
      var cells = 0;

      var container = comp.layers.addShape();
      container.name = 'Grid_' + type;
      if (rotation !== 0) container.property('ADBE Rotate Z').setValue(rotation);
      container.property('ADBE Position').setValue([cx, cy]);

      var content = container.property('ADBE Root Vectors Group');

      if      (type === 'rect')   cells = _buildRect(content,   w, h, cell, lw, lColor, fColor, fOpacity);
      else if (type === 'hex')    cells = _buildHex(content,    w, h, cell, lw, lColor, fColor, fOpacity);
      else if (type === 'tri')    cells = _buildTri(content,    w, h, cell, lw, lColor, fColor, fOpacity);
      else if (type === 'radial') cells = _buildRadial(content, w, h, cell, lw, lColor);
      else if (type === 'circ')   cells = _buildCirc(content,   w, h, cell, lw, lColor, fColor, fOpacity);

      if (anim === 'fade') {
        var op = container.property('ADBE Opacity');
        op.setValueAtTime(0, 0);
        op.setValueAtTime(30 / comp.frameRate, 100);
        _applyEase(op, 2);
      } else if (anim === 'scale') {
        var sc = container.property('ADBE Scale');
        sc.setValueAtTime(0, [0, 0]);
        sc.setValueAtTime(20 / comp.frameRate, [100, 100]);
        _applyEase(sc, 2);
      } else if (anim === 'stroke') {
        try {
          var trim    = content.addProperty('ADBE Vector Filter - Trim');
          var endProp = trim.property('ADBE Vector Trim End');
          endProp.setValueAtTime(0, 0);
          endProp.setValueAtTime(30 / comp.frameRate, 100);
          _applyEase(endProp, 2);
        } catch(e) {}
      }

      return { success: true, cells: cells };
    });
  }

  // ── Helpers ────────────────────────────────────────────────

  function _addLine(content, x1, y1, x2, y2, lw, color) {
    var grp   = content.addProperty('ADBE Vector Group');
    var path  = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Group');
    var shape = new Shape();
    shape.vertices    = [[x1, y1], [x2, y2]];
    shape.inTangents  = [[0,0],[0,0]];
    shape.outTangents = [[0,0],[0,0]];
    shape.closed = false;
    path.property('ADBE Vector Shape').setValue(shape);
    var stroke = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Stroke');
    stroke.property('ADBE Vector Stroke Color').setValue(color);
    stroke.property('ADBE Vector Stroke Width').setValue(lw);
    return grp;
  }

  // Adds a Vector Graphic Fill to an existing group
  function _addFill(vectorsGroup, color, opacity) {
    var fill = vectorsGroup.addProperty('ADBE Vector Graphic - Fill');
    fill.property('ADBE Vector Fill Color').setValue([color[0], color[1], color[2], 1]);
    fill.property('ADBE Vector Fill Opacity').setValue(opacity);
  }

  // ── Grid types ─────────────────────────────────────────────

  function _buildRect(content, w, h, cell, lw, lColor, fColor, fOpacity) {
    // Background fill rect
    if (fOpacity > 0) {
      var bgGrp  = content.addProperty('ADBE Vector Group');
      var bgRect = bgGrp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
      bgRect.property('ADBE Vector Rect Size').setValue([w, h]);
      _addFill(bgGrp.property('ADBE Vectors Group'), fColor, fOpacity);
    }

    var hw = w / 2, hh = h / 2;
    var cols = Math.ceil(w / cell) + 1;
    var rows = Math.ceil(h / cell) + 1;
    var count = 0;

    for (var c = 0; c < cols; c++) {
      _addLine(content, -hw + c * cell, -hh, -hw + c * cell, hh, lw, lColor);
      count++;
    }
    for (var r = 0; r < rows; r++) {
      _addLine(content, -hw, -hh + r * cell, hw, -hh + r * cell, lw, lColor);
      count++;
    }
    return count;
  }

  function _buildHex(content, w, h, cell, lw, lColor, fColor, fOpacity) {
    var R    = cell;
    var hw   = w / 2, hh = h / 2;
    var hexW = Math.sqrt(3) * R;
    var hexH = 2 * R;
    var cols = Math.ceil(w / hexW) + 2;
    var rows = Math.ceil(h / (hexH * 0.75)) + 2;
    var count = 0;

    for (var row = -1; row < rows; row++) {
      for (var col = -1; col < cols; col++) {
        var cx = (col * hexW) + (row % 2 === 0 ? 0 : hexW / 2) - hw;
        var cy = row * hexH * 0.75 - hh;
        _addHexCell(content, cx, cy, R, lw, lColor, fColor, fOpacity);
        count++;
      }
    }
    return count;
  }

  function _addHexCell(content, cx, cy, R, lw, color, fColor, fOpacity) {
    var grp  = content.addProperty('ADBE Vector Group');
    var path = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Group');
    var shape = new Shape();
    var verts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 30);
      verts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    shape.vertices    = verts;
    shape.inTangents  = [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
    shape.outTangents = [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]];
    shape.closed = true;
    path.property('ADBE Vector Shape').setValue(shape);

    if (fOpacity > 0) {
      _addFill(grp.property('ADBE Vectors Group'), fColor, fOpacity);
    }

    var stroke = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Stroke');
    stroke.property('ADBE Vector Stroke Color').setValue(color);
    stroke.property('ADBE Vector Stroke Width').setValue(lw);
  }

  function _buildTri(content, w, h, cell, lw, lColor, fColor, fOpacity) {
    var hw   = w / 2, hh = h / 2;
    var cols = Math.ceil(w / cell) + 2;
    var rows = Math.ceil(h / cell) + 2;
    var count = 0;

    for (var r = -1; r < rows; r++) {
      for (var c = -1; c < cols; c++) {
        var x = c * cell - hw;
        var y = r * cell - hh;
        _addLine(content, x,        y,        x + cell, y + cell, lw, lColor);
        _addLine(content, x + cell, y,        x,        y + cell, lw, lColor);
        _addLine(content, x,        y,        x + cell, y,        lw, lColor);
        _addLine(content, x,        y,        x,        y + cell, lw, lColor);
        count += 4;
      }
    }
    return count;
  }

  function _buildRadial(content, w, h, cell, lw, lColor) {
    var maxR   = Math.max(w, h) / 2;
    var rings  = Math.ceil(maxR / cell);
    var spokes = Math.round(Math.max(6, maxR / cell * 2));
    var count  = 0;

    for (var ring = 1; ring <= rings; ring++) {
      var r = ring * cell;
      var grp     = content.addProperty('ADBE Vector Group');
      var ellipse = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Ellipse');
      ellipse.property('ADBE Vector Ellipse Size').setValue([r * 2, r * 2]);
      var stroke  = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Stroke');
      stroke.property('ADBE Vector Stroke Color').setValue(lColor);
      stroke.property('ADBE Vector Stroke Width').setValue(lw);
      count++;
    }
    for (var s = 0; s < spokes; s++) {
      var a = (Math.PI * 2 / spokes) * s;
      _addLine(content, 0, 0, maxR * Math.cos(a), maxR * Math.sin(a), lw, lColor);
      count++;
    }
    return count;
  }

  function _buildCirc(content, w, h, cell, lw, lColor, fColor, fOpacity) {
    var cols = Math.ceil(w / cell) + 2;
    var rows = Math.ceil(h / cell) + 2;
    var hw   = w / 2, hh = h / 2;
    var count = 0;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cx  = c * cell - hw;
        var cy  = r * cell - hh;
        var grp = content.addProperty('ADBE Vector Group');
        var ellipse = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Ellipse');
        ellipse.property('ADBE Vector Ellipse Size').setValue([cell * 0.8, cell * 0.8]);
        ellipse.property('ADBE Vector Ellipse Position').setValue([cx, cy]);

        if (fOpacity > 0) {
          _addFill(grp.property('ADBE Vectors Group'), fColor, fOpacity);
        }

        var stroke = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Stroke');
        stroke.property('ADBE Vector Stroke Color').setValue(lColor);
        stroke.property('ADBE Vector Stroke Width').setValue(lw);
        count++;
      }
    }
    return count;
  }

  function _applyEase(prop, numKeyframes) {
    try {
      var ease = new KeyframeEase(0, 33.33);
      for (var ki = 1; ki <= numKeyframes; ki++) {
        try { prop.setTemporalEaseAtKey(ki, [ease], [ease]); }
        catch(e) {
          try { prop.setTemporalEaseAtKey(ki, [ease, ease], [ease, ease]); } catch(e2) {}
        }
      }
    } catch(e) {}
  }

  // ── Layout Rig ─────────────────────────────────────────────

  function _addSlider(layer, sliderName, defaultValue) {
    var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Slider Control');
    fx.name = sliderName;
    fx.property('ADBE Slider Control-0001').setValue(defaultValue);
    return fx;
  }

  function createRig(params) {
    return withUndo('Grids Layout Rig', function() {
      var comp = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to build a layout rig.' };
      }

      var defaultGridW = (params.gridWidth > 0) ? params.gridWidth : comp.width;
      var defaultGridH = (params.gridHeight > 0) ? params.gridHeight : comp.height;
      var defaultColumns = params.columns || 3;
      var defaultGapX = (params.gapX !== undefined) ? params.gapX : 24;
      var defaultGapY = (params.gapY !== undefined) ? params.gapY : 24;
      var defaultMarginX = (params.marginX !== undefined) ? params.marginX : 60;
      var defaultMarginY = (params.marginY !== undefined) ? params.marginY : 60;
      var defaultFitMode = params.fitMode || 5;
      var defaultItemScale = (params.itemScale !== undefined) ? params.itemScale : 100;
      var defaultOffsetX = (params.offsetX !== undefined) ? params.offsetX : 0;
      var defaultOffsetY = (params.offsetY !== undefined) ? params.offsetY : 0;
      var defaultAltRow = (params.altRowOffset !== undefined) ? params.altRowOffset : 0;
      var defaultAltCol = (params.altColOffset !== undefined) ? params.altColOffset : 0;
      var defaultProgX = (params.progShiftX !== undefined) ? params.progShiftX : 0;
      var defaultProgY = (params.progShiftY !== undefined) ? params.progShiftY : 0;

      var ctrl = comp.layers.addNull();
      ctrl.name = 'GRID_CONTROL';
      ctrl.moveToBeginning();

      _addSlider(ctrl, 'Columns',                defaultColumns);
      _addSlider(ctrl, 'Gap X',                  defaultGapX);
      _addSlider(ctrl, 'Gap Y',                  defaultGapY);
      _addSlider(ctrl, 'Margin X',               defaultMarginX);
      _addSlider(ctrl, 'Margin Y',               defaultMarginY);
      _addSlider(ctrl, 'Grid Width',             defaultGridW);
      _addSlider(ctrl, 'Grid Height',            defaultGridH);
      _addSlider(ctrl, 'Item Count',             selected.length);
      _addSlider(ctrl, 'Fit Mode',               defaultFitMode);
      _addSlider(ctrl, 'Item Scale',             defaultItemScale);
      _addSlider(ctrl, 'Offset X',               defaultOffsetX);
      _addSlider(ctrl, 'Offset Y',               defaultOffsetY);
      _addSlider(ctrl, 'Alternate Row Offset',   defaultAltRow);
      _addSlider(ctrl, 'Alternate Column Offset',defaultAltCol);
      _addSlider(ctrl, 'Progressive Shift X',    defaultProgX);
      _addSlider(ctrl, 'Progressive Shift Y',    defaultProgY);

      for (var i = 0; i < selected.length; i++) {
        var layer = selected[i];
        var idx = i;

        var posExpr = '' +
          'var ctrl = thisComp.layer("GRID_CONTROL");\n' +
          'var itemIndex = ' + idx + ';\n' +
          'var cols = Math.max(1, Math.round(ctrl.effect("Columns")("Slider")));\n' +
          'var gapX = ctrl.effect("Gap X")("Slider");\n' +
          'var gapY = ctrl.effect("Gap Y")("Slider");\n' +
          'var marginX = ctrl.effect("Margin X")("Slider");\n' +
          'var marginY = ctrl.effect("Margin Y")("Slider");\n' +
          'var gridW = ctrl.effect("Grid Width")("Slider");\n' +
          'var gridH = ctrl.effect("Grid Height")("Slider");\n' +
          'var offX = ctrl.effect("Offset X")("Slider");\n' +
          'var offY = ctrl.effect("Offset Y")("Slider");\n' +
          'var altRow = ctrl.effect("Alternate Row Offset")("Slider");\n' +
          'var altCol = ctrl.effect("Alternate Column Offset")("Slider");\n' +
          'var progX = ctrl.effect("Progressive Shift X")("Slider");\n' +
          'var progY = ctrl.effect("Progressive Shift Y")("Slider");\n' +
          'var itemCount = Math.max(1, Math.round(ctrl.effect("Item Count")("Slider")));\n' +
          'var rows = Math.max(1, Math.ceil(itemCount / cols));\n' +
          'var cellW = (gridW - marginX*2 - gapX*(cols-1)) / cols;\n' +
          'var cellH = (gridH - marginY*2 - gapY*(rows-1)) / rows;\n' +
          'var col = itemIndex % cols;\n' +
          'var row = Math.floor(itemIndex / cols);\n' +
          'var startX = (thisComp.width - gridW)/2 + marginX + cellW/2;\n' +
          'var startY = (thisComp.height - gridH)/2 + marginY + cellH/2;\n' +
          'var x = startX + col*(cellW+gapX) + offX;\n' +
          'var y = startY + row*(cellH+gapY) + offY;\n' +
          'x += (row % 2 == 1) ? altRow : 0;\n' +
          'y += (col % 2 == 1) ? altCol : 0;\n' +
          'x += row*progX; y += col*progY;\n' +
          '[x, y];';

        var scaleExpr = '' +
          'var ctrl = thisComp.layer("GRID_CONTROL");\n' +
          'var itemIndex = ' + idx + ';\n' +
          'var fitMode = Math.round(ctrl.effect("Fit Mode")("Slider"));\n' +
          'var itemScale = ctrl.effect("Item Scale")("Slider")/100;\n' +
          'var cols = Math.max(1, Math.round(ctrl.effect("Columns")("Slider")));\n' +
          'var gapX = ctrl.effect("Gap X")("Slider");\n' +
          'var gapY = ctrl.effect("Gap Y")("Slider");\n' +
          'var marginX = ctrl.effect("Margin X")("Slider");\n' +
          'var marginY = ctrl.effect("Margin Y")("Slider");\n' +
          'var gridW = ctrl.effect("Grid Width")("Slider");\n' +
          'var gridH = ctrl.effect("Grid Height")("Slider");\n' +
          'var itemCount = Math.max(1, Math.round(ctrl.effect("Item Count")("Slider")));\n' +
          'var rows = Math.max(1, Math.ceil(itemCount / cols));\n' +
          'var cellW = (gridW - marginX*2 - gapX*(cols-1)) / cols;\n' +
          'var cellH = (gridH - marginY*2 - gapY*(rows-1)) / rows;\n' +
          'function getLayerSize(){ try { var r = thisLayer.sourceRectAtTime(time,false); return [Math.max(1,r.width), Math.max(1,r.height)]; } catch(e){ return [Math.max(1,thisLayer.width), Math.max(1,thisLayer.height)]; } }\n' +
          'var s = getLayerSize(); var sw=s[0], sh=s[1];\n' +
          'var fitW = cellW/sw*100; var fitH = cellH/sh*100;\n' +
          'var result;\n' +
          'if (fitMode==1) { result = value; }\n' +
          'else if (fitMode==2) { var f2=Math.max(fitW,fitH)*itemScale; result=[f2,f2]; }\n' +
          'else if (fitMode==3) { var f3=fitW*itemScale; result=[f3,f3]; }\n' +
          'else if (fitMode==4) { var f4=fitH*itemScale; result=[f4,f4]; }\n' +
          'else if (fitMode==5) { var f5=Math.min(fitW,fitH)*itemScale; result=[f5,f5]; }\n' +
          'else if (fitMode==6) { result=[fitW*itemScale, fitH*itemScale]; }\n' +
          'else { result = value; }\n' +
          'result;';

        var posProp = layer.property('ADBE Position');
        if (posProp.numKeys === 0 && posProp.expression === '') {
          posProp.expression = posExpr;
        }

        var scaProp = layer.property('ADBE Scale');
        if (scaProp.numKeys === 0 && scaProp.expression === '') {
          scaProp.expression = scaleExpr;
        }
      }

      return { success: true, count: selected.length };
    });
  }

  return { generate: generate, createRig: createRig };
})();

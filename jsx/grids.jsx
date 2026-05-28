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

  return { generate: generate };
})();

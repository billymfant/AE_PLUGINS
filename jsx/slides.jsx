var Slides = (function() {

  function generate(params) {
    return withUndo('Slides Generator', function() {
      var comp  = requireComp();
      var rows  = params.rows  || 3;
      var cols  = params.cols  || 3;
      var sW    = params.slideW || 200;
      var sH    = params.slideH || 150;
      var gH    = params.gapH  || 10;
      var gV    = params.gapV  || 10;
      var rand  = (params.randomize    || 0) / 100;
      var rotR  = params.rotationRandom || 0;
      var sclR  = (params.scaleRandom  || 0);
      var anim  = params.animType      || 'none';
      var stagger = params.animStagger || 5;
      var useText = params.useText     || false;

      var totalW = cols * sW + (cols - 1) * gH;
      var totalH = rows * sH + (rows - 1) * gV;
      var startX = (comp.width  - totalW) / 2 + sW / 2;
      var startY = (comp.height - totalH) / 2 + sH / 2;
      var total  = rows * cols;

      // Null container
      var container = comp.layers.addNull();
      container.name = 'Slides_' + rows + 'x' + cols;

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var idx    = r * cols + c;
          var shape  = comp.layers.addShape();
          shape.name = 'Slide_' + (r + 1) + '_' + (c + 1);

          // Rectangle
          var grp  = shape.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
          var rect = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
          rect.property('ADBE Vector Rect Size').setValue([sW, sH]);

          // Fill
          var fill = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Fill');
          fill.property('ADBE Vector Fill Color').setValue(hsvToRgb(idx / total, 0.65, 0.75));

          // Position
          var x = startX + c * (sW + gH);
          var y = startY + r * (sH + gV);
          if (rand > 0) {
            x += (Math.random() - 0.5) * gH * 2 * rand;
            y += (Math.random() - 0.5) * gV * 2 * rand;
          }
          shape.property('ADBE Position').setValue([x, y]);

          if (rotR > 0) {
            shape.property('ADBE Rotate Z').setValue((Math.random() - 0.5) * rotR * 2);
          }
          if (sclR > 0) {
            var sc = 100 + (Math.random() - 0.5) * sclR * 2;
            shape.property('ADBE Scale').setValue([sc, sc]);
          }

          // Entrance animation
          if (anim !== 'none') {
            var inPoint  = idx * (stagger / comp.frameRate);
            shape.inPoint = inPoint;
            var kf0 = inPoint;
            var kf1 = inPoint + 15 / comp.frameRate;

            if (anim === 'fade') {
              var op = shape.property('ADBE Opacity');
              op.setValueAtTime(kf0, 0);
              op.setValueAtTime(kf1, 100);
              _applyEase(op, 2);
            } else if (anim === 'scale') {
              var scProp = shape.property('ADBE Scale');
              scProp.setValueAtTime(kf0, [0, 0]);
              scProp.setValueAtTime(kf1, [100, 100]);
              _applyEase(scProp, 2);
            } else if (anim === 'slideUp') {
              var posProp = shape.property('ADBE Position');
              posProp.setValueAtTime(kf0, [x, y + 60]);
              posProp.setValueAtTime(kf1, [x, y]);
              _applyEase(posProp, 2);
            } else if (anim === 'slideDown') {
              var posProp2 = shape.property('ADBE Position');
              posProp2.setValueAtTime(kf0, [x, y - 60]);
              posProp2.setValueAtTime(kf1, [x, y]);
              _applyEase(posProp2, 2);
            }
          }

          // Optional text
          if (useText) {
            var txt = comp.layers.addText('Slide ' + (idx + 1));
            txt.name = 'Text_' + (r + 1) + '_' + (c + 1);
            txt.property('ADBE Position').setValue([x, y]);
            txt.parent = shape;
          }

          shape.parent = container;
        }
      }

      return { success: true, count: total };
    });
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

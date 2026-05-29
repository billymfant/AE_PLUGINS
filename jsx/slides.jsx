var Slides = (function() {

  // ── Seeded PRNG (linear congruential generator, ES3 safe) ─────────────────
  // Numerical Recipes LCG constants; avoids Math.imul (absent in ExtendScript).
  function _makePrng(seed) {
    var s = (seed >>> 0) || 1;
    return function() {
      // (a*s + c) mod 2^32 via floating-point modulo to stay ES3-safe
      s = (1664525 * s + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  function _seededShuffle(arr, seed) {
    var a = arr.slice();
    var rng = _makePrng(seed);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ── Ease helper ───────────────────────────────────────────────────────────
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

  // ── Hex colour to AE [r,g,b] (0-1) ───────────────────────────────────────
  // Uses global hexToRgb; fall back to manual parse if needed
  function _hexToRgb(hex) {
    if (typeof hexToRgb === 'function') { return hexToRgb(hex); }
    var c = hex.replace('#', '');
    return [
      parseInt(c.substr(0, 2), 16) / 255,
      parseInt(c.substr(2, 2), 16) / 255,
      parseInt(c.substr(4, 2), 16) / 255
    ];
  }

  // ── Add a named Slider Control effect to a layer ──────────────────────────
  function _addSliderControl(layer, label, value) {
    try {
      var fx = layer.property('ADBE Effect Parade').addProperty('ADBE Slider Control');
      fx.name = label;
      fx.property('ADBE Slider Control-0001').setValue(value);
      return fx;
    } catch(e) { return null; }
  }

  // ── ENTRANCE ANIMATION per slide ──────────────────────────────────────────
  // resolvedType: concrete type (not 'random', not 'none')
  // usePos: false when position keyframes are blocked (controller mode)
  function _applyEntrance(shape, resolvedType, x, y, startTime, endTime,
                          animScaleFrom, animOpacityFrom, animRotateFrom,
                          animOffset, useOvershoot, overshootAmount, usePos) {

    var midTime = startTime + (endTime - startTime) * 0.6;

    if (resolvedType === 'fade') {
      var op = shape.property('ADBE Opacity');
      op.setValueAtTime(startTime, animOpacityFrom);
      op.setValueAtTime(endTime, 100);
      _applyEase(op, 2);

    } else if (resolvedType === 'scale') {
      var scProp = shape.property('ADBE Scale');
      scProp.setValueAtTime(startTime, [animScaleFrom, animScaleFrom]);
      if (useOvershoot) {
        var osScale = 100 + overshootAmount;
        scProp.setValueAtTime(midTime, [osScale, osScale]);
        scProp.setValueAtTime(endTime, [100, 100]);
        _applyEase(scProp, 3);
      } else {
        scProp.setValueAtTime(endTime, [100, 100]);
        _applyEase(scProp, 2);
      }

    } else if (resolvedType === 'slideUp') {
      if (!usePos) {
        // degrade to fade when position keyframes are blocked
        var opU = shape.property('ADBE Opacity');
        opU.setValueAtTime(startTime, animOpacityFrom);
        opU.setValueAtTime(endTime, 100);
        _applyEase(opU, 2);
      } else {
        var pUp = shape.property('ADBE Position');
        pUp.setValueAtTime(startTime, [x, y + animOffset]);
        if (useOvershoot) {
          pUp.setValueAtTime(midTime, [x, y - overshootAmount]);
          pUp.setValueAtTime(endTime, [x, y]);
          _applyEase(pUp, 3);
        } else {
          pUp.setValueAtTime(endTime, [x, y]);
          _applyEase(pUp, 2);
        }
      }

    } else if (resolvedType === 'slideDown') {
      if (!usePos) {
        var opD = shape.property('ADBE Opacity');
        opD.setValueAtTime(startTime, animOpacityFrom);
        opD.setValueAtTime(endTime, 100);
        _applyEase(opD, 2);
      } else {
        var pDn = shape.property('ADBE Position');
        pDn.setValueAtTime(startTime, [x, y - animOffset]);
        if (useOvershoot) {
          pDn.setValueAtTime(midTime, [x, y + overshootAmount]);
          pDn.setValueAtTime(endTime, [x, y]);
          _applyEase(pDn, 3);
        } else {
          pDn.setValueAtTime(endTime, [x, y]);
          _applyEase(pDn, 2);
        }
      }

    } else if (resolvedType === 'slideLeft') {
      if (!usePos) {
        var opL = shape.property('ADBE Opacity');
        opL.setValueAtTime(startTime, animOpacityFrom);
        opL.setValueAtTime(endTime, 100);
        _applyEase(opL, 2);
      } else {
        var pLt = shape.property('ADBE Position');
        pLt.setValueAtTime(startTime, [x + animOffset, y]);
        if (useOvershoot) {
          pLt.setValueAtTime(midTime, [x - overshootAmount, y]);
          pLt.setValueAtTime(endTime, [x, y]);
          _applyEase(pLt, 3);
        } else {
          pLt.setValueAtTime(endTime, [x, y]);
          _applyEase(pLt, 2);
        }
      }

    } else if (resolvedType === 'slideRight') {
      if (!usePos) {
        var opR = shape.property('ADBE Opacity');
        opR.setValueAtTime(startTime, animOpacityFrom);
        opR.setValueAtTime(endTime, 100);
        _applyEase(opR, 2);
      } else {
        var pRt = shape.property('ADBE Position');
        pRt.setValueAtTime(startTime, [x - animOffset, y]);
        if (useOvershoot) {
          pRt.setValueAtTime(midTime, [x + overshootAmount, y]);
          pRt.setValueAtTime(endTime, [x, y]);
          _applyEase(pRt, 3);
        } else {
          pRt.setValueAtTime(endTime, [x, y]);
          _applyEase(pRt, 2);
        }
      }

    } else if (resolvedType === 'pop') {
      var scPop = shape.property('ADBE Scale');
      var popOver = 100 + overshootAmount;
      scPop.setValueAtTime(startTime, [animScaleFrom, animScaleFrom]);
      scPop.setValueAtTime(midTime, [popOver, popOver]);
      scPop.setValueAtTime(endTime, [100, 100]);
      _applyEase(scPop, 3);
      var opPop = shape.property('ADBE Opacity');
      opPop.setValueAtTime(startTime, animOpacityFrom);
      opPop.setValueAtTime(endTime, 100);
      _applyEase(opPop, 2);

    } else if (resolvedType === 'flip') {
      // Animate scaleX from 0 → 100 to simulate a horizontal flip
      var scFlip = shape.property('ADBE Scale');
      scFlip.setValueAtTime(startTime, [0, 100]);
      scFlip.setValueAtTime(endTime, [100, 100]);
      _applyEase(scFlip, 2);

    } else if (resolvedType === 'rotate') {
      var rotProp = shape.property('ADBE Rotate Z');
      rotProp.setValueAtTime(startTime, animRotateFrom);
      rotProp.setValueAtTime(endTime, 0);
      _applyEase(rotProp, 2);
      var opRot = shape.property('ADBE Opacity');
      opRot.setValueAtTime(startTime, animOpacityFrom);
      opRot.setValueAtTime(endTime, 100);
      _applyEase(opRot, 2);

    } else if (resolvedType === 'blur') {
      // Add Fast Box Blur effect and animate from high→0
      try {
        var blurFx = shape.property('ADBE Effect Parade').addProperty('ADBE Fast Box Blur');
        var blurProp = blurFx.property('ADBE Fast Box Blur-0001'); // Blur Radius
        blurProp.setValueAtTime(startTime, 40);
        blurProp.setValueAtTime(endTime, 0);
        _applyEase(blurProp, 2);
      } catch(blurErr) {
        // Fast Box Blur not available – fall back to fade
        var opBlur = shape.property('ADBE Opacity');
        opBlur.setValueAtTime(startTime, animOpacityFrom);
        opBlur.setValueAtTime(endTime, 100);
        _applyEase(opBlur, 2);
      }
    }
  }

  // ── MAIN GENERATE ─────────────────────────────────────────────────────────
  function generate(params) {
    return withUndo('Slides Generator', function() {
      var comp  = requireComp();

      // ── param extraction ──────────────────────────────────────────
      var rows        = params.rows        || 3;
      var cols        = params.cols        || 3;
      var sW          = params.slideW      || 200;
      var sH          = params.slideH      || 150;
      var gH          = params.gapH        || 10;   // horizontal gap
      var gV          = params.gapV        || 10;   // vertical gap
      var rand        = (params.randomize  || 0) / 100;
      var rotR        = params.rotationRandom || 0;
      var sclR        = params.scaleRandom || 0;
      var anim        = params.animType    || 'none';
      var stagger     = params.animStagger || 5;
      var useText     = params.useText     || false;

      // v2 params
      var sourceMode      = params.sourceMode      || 'empty';
      var useFrames       = (params.useFrames !== undefined) ? params.useFrames : true;
      var bgColor         = params.bgColor         || '#222222';
      var cardOpacity     = (params.cardOpacity !== undefined) ? params.cardOpacity : 100;
      var strokeEnabled   = params.strokeEnabled   || false;
      var strokeWidth     = (params.strokeWidth !== undefined) ? params.strokeWidth : 2;
      var strokeColor     = params.strokeColor     || '#ffffff';
      var roundness       = params.roundness       || 0;
      var animDuration    = params.animDuration    || 18;
      var animDirection   = params.animDirection   || 'byIndex';
      var animOffset      = (params.animOffset !== undefined) ? params.animOffset : 100;
      var animScaleFrom   = (params.animScaleFrom !== undefined) ? params.animScaleFrom : 80;
      var animOpacityFrom = (params.animOpacityFrom !== undefined) ? params.animOpacityFrom : 0;
      var animRotateFrom  = (params.animRotateFrom !== undefined) ? params.animRotateFrom : 0;
      var useOvershoot    = params.useOvershoot    || false;
      var overshootAmount = (params.overshootAmount !== undefined) ? params.overshootAmount : 8;
      var randomSeed      = params.randomSeed      || 1;
      var useController   = params.useController   || false;
      var controllerName  = params.controllerName  || 'SLIDES_CONTROL';
      var groupName       = params.groupName       || 'SLIDES_GROUP';

      // ── source: selectedLayers ────────────────────────────────────
      var selectedLayers = null;
      var total;

      if (sourceMode === 'selectedLayers') {
        var sel = [];
        for (var si = 1; si <= comp.numLayers; si++) {
          if (comp.layer(si).selected) { sel.push(comp.layer(si)); }
        }
        if (sel.length === 0) {
          return { error: 'Select layers, or use Empty Slides source.' };
        }
        selectedLayers = sel;
        total = sel.length;
      } else {
        total = rows * cols;
      }

      // ── grid geometry ─────────────────────────────────────────────
      var totalW = cols * sW + (cols - 1) * gH;
      var totalH = rows * sH + (rows - 1) * gV;
      var startX = (comp.width  - totalW) / 2 + sW / 2;
      var startY = (comp.height - totalH) / 2 + sH / 2;

      // ── stagger order: build orderIndex array ─────────────────────
      var orderIndices = [];
      var i;
      if (animDirection === 'byIndex') {
        for (i = 0; i < total; i++) { orderIndices.push(i); }
      } else if (animDirection === 'byRow') {
        for (i = 0; i < total; i++) {
          orderIndices.push(Math.floor(i / cols));
        }
      } else if (animDirection === 'byColumn') {
        for (i = 0; i < total; i++) {
          orderIndices.push(i % cols);
        }
      } else if (animDirection === 'fromCenter') {
        var centerR = (rows - 1) / 2;
        var centerC = (cols - 1) / 2;
        for (i = 0; i < total; i++) {
          var r = Math.floor(i / cols);
          var c = i % cols;
          var dist = Math.round(Math.sqrt(
            (r - centerR) * (r - centerR) + (c - centerC) * (c - centerC)
          ));
          orderIndices.push(dist);
        }
      } else if (animDirection === 'random') {
        var idxArr = [];
        for (i = 0; i < total; i++) { idxArr.push(i); }
        var shuffled = _seededShuffle(idxArr, randomSeed);
        // shuffled[i] is the order position for slide i
        var orderLookup = [];
        for (i = 0; i < shuffled.length; i++) { orderLookup[shuffled[i]] = i; }
        for (i = 0; i < total; i++) { orderIndices.push(orderLookup[i] !== undefined ? orderLookup[i] : i); }
      } else {
        for (i = 0; i < total; i++) { orderIndices.push(i); }
      }

      // ── seeded PRNG for per-slide randomness ──────────────────────
      var rng = _makePrng(randomSeed);

      // ── entrance type list for 'random' mode ─────────────────────
      var _entranceTypes = ['fade','scale','slideUp','slideDown','slideLeft','slideRight','pop','flip','rotate','blur'];

      // ── Live controller null ──────────────────────────────────────
      var controllerLayer = null;
      var groupLayer = null;
      if (useController) {
        controllerLayer = comp.layers.addNull();
        controllerLayer.name = controllerName;
        _addSliderControl(controllerLayer, 'Rows',           rows);
        _addSliderControl(controllerLayer, 'Columns',        cols);
        _addSliderControl(controllerLayer, 'Slide Width',    sW);
        _addSliderControl(controllerLayer, 'Slide Height',   sH);
        _addSliderControl(controllerLayer, 'Gap X',          gH);
        _addSliderControl(controllerLayer, 'Gap Y',          gV);
        _addSliderControl(controllerLayer, 'Jitter',         rand * 100);
        _addSliderControl(controllerLayer, 'Rotation Random',rotR);
        _addSliderControl(controllerLayer, 'Scale Random',   sclR);
        _addSliderControl(controllerLayer, 'Seed',           randomSeed);

        groupLayer = comp.layers.addNull();
        groupLayer.name = groupName;
      }

      // ── main null container (fallback when no controller) ─────────
      var container = null;
      if (!useController) {
        container = comp.layers.addNull();
        container.name = 'Slides_' + rows + 'x' + cols;
      }

      // ── position expression template (baked idx) ──────────────────
      // Used when useController is true.
      // The expression runs inside AE so AE expression syntax is fine.
      function _buildPosExpr(bakeIdx, bakeRows, bakeCols, bakeStartX, bakeStartY, bakeGH, bakeGV, bakeSW, bakeSH, bakeRand) {
        return [
          'var ctrl = thisComp.layer("' + controllerName + '");',
          'var cols = Math.max(1, Math.round(ctrl.effect("Columns")("Slider")));',
          'var w    = ctrl.effect("Slide Width")("Slider");',
          'var h    = ctrl.effect("Slide Height")("Slider");',
          'var gapX = ctrl.effect("Gap X")("Slider");',
          'var gapY = ctrl.effect("Gap Y")("Slider");',
          'var seed = ctrl.effect("Seed")("Slider");',
          'var jitter = ctrl.effect("Jitter")("Slider") / 100;',
          'var idx = ' + bakeIdx + ';',
          'var r   = Math.floor(idx / cols);',
          'var c   = idx % cols;',
          'var totalW = cols * w + (cols - 1) * gapX;',
          'var totalH = thisComp.numLayers * 0 + ' + (bakeRows) + ' * h + (' + (bakeRows) + ' - 1) * gapY;',
          'var sX = (thisComp.width  - totalW) / 2 + w / 2;',
          'var sY = (thisComp.height - (thisComp.numLayers * 0 + ' + (bakeRows) + ' * h + (' + (bakeRows) + ' - 1) * gapY)) / 2 + h / 2;',
          'var x  = sX + c * (w + gapX);',
          'var y  = sY + r * (h + gapY);',
          'seedRandom(idx + seed, true);',
          'x += random(-jitter * gapX * 2, jitter * gapX * 2);',
          'y += random(-jitter * gapY * 2, jitter * gapY * 2);',
          '[x, y]'
        ].join('\n');
      }

      // ── iterate slides ────────────────────────────────────────────
      for (i = 0; i < total; i++) {
        var r2 = Math.floor(i / cols);
        var c2 = i % cols;
        var orderIdx = orderIndices[i];

        // grid position
        var x = startX + c2 * (sW + gH);
        var y = startY + r2 * (sH + gV);

        // position jitter (static path only — not baked when controller is used)
        var jX = 0, jY = 0;
        if (!useController && rand > 0) {
          jX = (rng() - 0.5) * gH * 2 * rand;
          jY = (rng() - 0.5) * gV * 2 * rand;
          x += jX;
          y += jY;
        }

        // animation timing
        var delayFrames = stagger * orderIdx;
        var startTime   = delayFrames / comp.frameRate;
        var endTime     = startTime + animDuration / comp.frameRate;

        // resolve concrete entrance type
        var resolvedAnim = anim;
        if (anim === 'random') {
          var ri = Math.floor(rng() * _entranceTypes.length);
          resolvedAnim = _entranceTypes[ri];
        }
        // degrade position-based anims to fade when controller is on
        var usePos = !useController;
        if (useController) {
          if (resolvedAnim === 'slideUp' || resolvedAnim === 'slideDown' ||
              resolvedAnim === 'slideLeft' || resolvedAnim === 'slideRight') {
            resolvedAnim = 'fade';
          }
        }

        var layer;

        if (sourceMode === 'selectedLayers') {
          // ── Selected-layers mode ───────────────────────────────────
          layer = selectedLayers[i];

          // Fit layer into cell (contain)
          var srcW = layer.width  || sW;
          var srcH = layer.height || sH;
          var fitScale = Math.min(sW / srcW, sH / srcH) * 100;
          layer.property('ADBE Scale').setValue([fitScale, fitScale]);
          layer.property('ADBE Position').setValue([x, y]);

          if (rotR > 0) {
            layer.property('ADBE Rotate Z').setValue((rng() - 0.5) * rotR * 2);
          }
          if (sclR > 0) {
            var sc2 = fitScale + (rng() - 0.5) * sclR * 2;
            layer.property('ADBE Scale').setValue([sc2, sc2]);
          }
          layer.property('ADBE Opacity').setValue(cardOpacity);

          if (anim !== 'none') {
            layer.inPoint = startTime;
            _applyEntrance(layer, resolvedAnim, x, y, startTime, endTime,
              animScaleFrom, animOpacityFrom, animRotateFrom,
              animOffset, useOvershoot, overshootAmount, usePos);
          }

          if (useController && groupLayer) {
            layer.parent = groupLayer;
          } else if (container) {
            layer.parent = container;
          }

        } else {
          // ── Empty-slides mode ──────────────────────────────────────
          var shape = comp.layers.addShape();
          shape.name = 'Slide_' + (r2 + 1) + '_' + (c2 + 1);

          var grp  = shape.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');
          var rect = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Shape - Rect');
          rect.property('ADBE Vector Rect Size').setValue([sW, sH]);
          if (roundness > 0) {
            rect.property('ADBE Vector Rect Roundness').setValue(roundness);
          }

          // Fill
          var fill = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Fill');
          if (useFrames) {
            fill.property('ADBE Vector Fill Color').setValue(_hexToRgb(bgColor));
          } else {
            fill.property('ADBE Vector Fill Color').setValue(hsvToRgb(i / total, 0.65, 0.75));
          }

          // Optional stroke
          if (strokeEnabled) {
            var stroke = grp.property('ADBE Vectors Group').addProperty('ADBE Vector Graphic - Stroke');
            stroke.property('ADBE Vector Stroke Color').setValue(_hexToRgb(strokeColor));
            stroke.property('ADBE Vector Stroke Width').setValue(strokeWidth);
          }

          // Opacity
          shape.property('ADBE Opacity').setValue(cardOpacity);

          // Position — static or expression-driven
          if (useController) {
            try {
              var posExpr = _buildPosExpr(i, rows, cols, startX, startY, gH, gV, sW, sH, rand);
              shape.property('ADBE Position').expression = posExpr;
            } catch(exprErr) {
              shape.property('ADBE Position').setValue([x, y]);
            }
          } else {
            shape.property('ADBE Position').setValue([x, y]);
          }

          if (rotR > 0) {
            shape.property('ADBE Rotate Z').setValue((rng() - 0.5) * rotR * 2);
          }
          if (sclR > 0) {
            var sc3 = 100 + (rng() - 0.5) * sclR * 2;
            shape.property('ADBE Scale').setValue([sc3, sc3]);
          }

          // Entrance animation
          if (anim !== 'none') {
            shape.inPoint = startTime;
            _applyEntrance(shape, resolvedAnim, x, y, startTime, endTime,
              animScaleFrom, animOpacityFrom, animRotateFrom,
              animOffset, useOvershoot, overshootAmount, usePos);
          }

          // Optional text child
          if (useText) {
            var txt = comp.layers.addText('Slide ' + (i + 1));
            txt.name = 'Text_' + (r2 + 1) + '_' + (c2 + 1);
            txt.property('ADBE Position').setValue([x, y]);
            txt.parent = shape;
          }

          // Parent to group or container
          if (useController && groupLayer) {
            shape.parent = groupLayer;
          } else if (container) {
            shape.parent = container;
          }

          layer = shape;
        }
      }

      return { success: true, count: total };
    });
  }

  return { generate: generate };
})();

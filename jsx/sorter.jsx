var Sorter = (function() {

  // ──────────────────────────────────────────────────────────────────────────
  // Public entry point
  // ──────────────────────────────────────────────────────────────────────────
  function apply(params) {
    return withUndo('Pixel Sorter', function() {
      var comp = requireComp();

      var mode         = params.sortMode       || 'brightness';
      var direction    = params.direction      || 'horizontal';
      var length       = params.sortLength     || 200;
      var threshLow    = (params.thresholdLow  !== undefined) ? params.thresholdLow  : (params.threshold !== undefined ? params.threshold : 60);
      var threshHigh   = (params.thresholdHigh !== undefined) ? params.thresholdHigh : 100;
      var randomness   = params.randomness     || 0;
      var iterations   = params.iterations     || 1;
      var useColorKey  = params.useColorKey    || false;
      var keyColor     = hexToRgb(params.keyColor || '#ff0000');
      var keyHueTol    = params.keyHueTol      || 30;
      var targetMode   = params.targetMode     || 'selectedLayers';
      var applyMode    = params.applyMode      || 'quick';
      var animate      = params.animate        || false;
      var animStyle    = params.animStyle      || 'drift';
      var animSpeed    = (params.animSpeed     !== undefined) ? params.animSpeed  : 1;
      var animAmount   = (params.animAmount    !== undefined) ? params.animAmount : 50;

      // Resolve targets
      var targetsResult = _resolveTargets(comp, params);
      if (targetsResult.error) { return { error: targetsResult.error }; }
      var targets = targetsResult.layers;

      // Controller null (rig mode only)
      var controller = null;
      if (applyMode === 'rig') {
        controller = _createController(comp, params);
      }

      var count = 0;

      for (var li = 0; li < targets.length; li++) {
        var tgt = targets[li];

        if (targetMode === 'adjustmentLayer') {
          // tgt IS the adjustment layer — apply in-place effect stack
          _applyInPlaceStack(tgt, params, controller, threshLow, threshHigh, randomness, direction, length, mode, animate, animStyle, animSpeed, animAmount);
          count++;
        } else if (targetMode === 'precompRig') {
          // tgt is the precomp layer — the adj was already created above it; apply to adj
          _applyInPlaceStack(tgt, params, controller, threshLow, threshHigh, randomness, direction, length, mode, animate, animStyle, animSpeed, animAmount);
          count++;
        } else {
          // selectedLayers / duplicateLayer: matte-pair approach, per-iteration
          for (var iter = 0; iter < iterations; iter++) {
            _applyMattePair(comp, tgt, iter, params, controller, threshLow, threshHigh, randomness, direction, length, mode, useColorKey, keyColor, keyHueTol, animate, animStyle, animSpeed, animAmount);
          }
          count++;
        }
      }

      return { success: true, count: count };
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Target resolution
  // ──────────────────────────────────────────────────────────────────────────
  function _resolveTargets(comp, params) {
    var targetMode = params.targetMode || 'selectedLayers';
    var selected   = comp.selectedLayers;

    if (!selected || selected.length === 0) {
      return { error: 'Select one or more layers to apply Pixel Sort.' };
    }

    if (targetMode === 'selectedLayers') {
      var arr = [];
      for (var i = 0; i < selected.length; i++) { arr.push(selected[i]); }
      return { layers: arr };
    }

    if (targetMode === 'duplicateLayer') {
      var dups = [];
      for (var di = 0; di < selected.length; di++) {
        var src  = selected[di];
        var dup  = src.duplicate();
        dup.name = src.name + '_Sort';
        dup.moveBefore(src);
        dups.push(dup);
      }
      return { layers: dups };
    }

    if (targetMode === 'adjustmentLayer') {
      // Find the top-most selected layer to position the adjustment layer above it
      var topRef = null;
      for (var ai = 0; ai < selected.length; ai++) {
        if (topRef === null || selected[ai].index < topRef.index) {
          topRef = selected[ai];
        }
      }
      var adj = comp.layers.addSolid(
        [1, 1, 1],
        'PIXEL_SORT_ADJ',
        comp.width,
        comp.height,
        comp.pixelAspect,
        comp.duration
      );
      adj.adjustmentLayer = true;
      adj.startTime = 0;
      if (topRef !== null) {
        adj.moveBefore(topRef);
      } else {
        adj.moveToBeginning();
      }
      return { layers: [adj] };
    }

    if (targetMode === 'precompRig') {
      // Collect selected layer indices (stable, before precomp changes them)
      var selIndices = [];
      for (var pi = 0; pi < selected.length; pi++) {
        selIndices.push(selected[pi].index);
      }
      // Precompose — returns the new precomp layer index
      var precompName   = 'PIXEL_SORT_PRECOMP';
      var precompIndex  = comp.layers.precompose(selIndices, precompName, true);
      // Find the precomp layer by name (do NOT trust the returned index directly)
      var precompLayer  = null;
      for (var pli = 1; pli <= comp.numLayers; pli++) {
        if (comp.layer(pli).name === precompName) { precompLayer = comp.layer(pli); break; }
      }
      if (!precompLayer) { return { error: 'Precomp creation failed.' }; }

      // Create adjustment layer above the precomp
      var padj = comp.layers.addSolid(
        [1, 1, 1],
        'PIXEL_SORT_ADJ',
        comp.width,
        comp.height,
        comp.pixelAspect,
        comp.duration
      );
      padj.adjustmentLayer = true;
      padj.startTime = 0;
      padj.moveBefore(precompLayer);
      return { layers: [padj] };
    }

    return { error: 'Unknown targetMode: ' + targetMode };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Matte-pair approach (selectedLayers / duplicateLayer)
  // ──────────────────────────────────────────────────────────────────────────
  function _applyMattePair(comp, src, iter, params, controller, threshLow, threshHigh, randomness, direction, length, mode, useColorKey, keyColor, keyHueTol, animate, animStyle, animSpeed, animAmount) {
    var sortLayer  = src.duplicate();
    sortLayer.name = src.name + '_Sort_' + (iter + 1);

    var matteLayer  = src.duplicate();
    matteLayer.name = src.name + '_Matte_' + (iter + 1);

    // Stack: matteLayer directly above sortLayer, both above src
    sortLayer.moveBefore(src);
    matteLayer.moveBefore(sortLayer);

    // Directional Blur on sort layer
    var sortFx  = sortLayer.property('ADBE Effect Parade');
    var blurAngle = _sortAngle(direction, params.angle);
    var dirBlur   = null;
    try {
      dirBlur = sortFx.addProperty('ADBE Directional Blur');
      if (dirBlur) {
        dirBlur.property('ADBE Directional Blur-0001').setValue(blurAngle);
        dirBlur.property('ADBE Directional Blur-0002').setValue(length);
      }
    } catch(e) {}

    // Build matte: extract sort channel + threshold
    var matteFx = matteLayer.property('ADBE Effect Parade');
    _applyModeExtract(matteFx, mode);

    if (useColorKey) {
      try {
        var ckFx = matteFx.addProperty('ADBE Color Key');
        if (ckFx) {
          ckFx.property('ADBE Color Key-0001').setValue(keyColor);
          ckFx.property('ADBE Color Key-0002').setValue(Math.round(keyHueTol * 1.4));
        }
      } catch(e) {}
    } else {
      try {
        var lvFx = matteFx.addProperty('ADBE Levels2');
        if (lvFx) {
          var blackPt = Math.round((threshLow  / 100) * 255);
          var whitePt = Math.round((threshHigh / 100) * 255);
          lvFx.property('ADBE Levels2-0002').setValue([blackPt, whitePt]);
        }
      } catch(e) {}
    }

    if (randomness > 0) {
      try {
        var tdFx = matteFx.addProperty('ADBE Turbulent Displace');
        if (tdFx) {
          tdFx.property('ADBE Turbulent Displace-0002').setValue(randomness * 2.5);
          tdFx.property('ADBE Turbulent Displace-0003').setValue(40 + randomness * 0.6);
        }
      } catch(e) {}
    }

    // Wire track matte
    sortLayer.trackMatteType = TrackMatteType.LUMA;

    // Animation expressions on the sort layer's directional blur
    if (animate && dirBlur) {
      _applyAnimExpression(dirBlur, sortLayer, controller, params, length, animStyle, animSpeed, animAmount);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // In-place effect stack (adjustmentLayer / precompRig)
  // ──────────────────────────────────────────────────────────────────────────
  function _applyInPlaceStack(layer, params, controller, threshLow, threshHigh, randomness, direction, length, mode, animate, animStyle, animSpeed, animAmount) {
    var fx        = layer.property('ADBE Effect Parade');
    var blurAngle = _sortAngle(direction, params.angle);

    // 1. Mode extract (channel isolation / edge detect)
    _applyModeExtract(fx, mode);

    // 2. Levels threshold (low → high)
    var dirBlur = null;
    try {
      var lvFx = fx.addProperty('ADBE Levels2');
      if (lvFx) {
        var blackPt = Math.round((threshLow  / 100) * 255);
        var whitePt = Math.round((threshHigh / 100) * 255);
        lvFx.property('ADBE Levels2-0002').setValue([blackPt, whitePt]);
      }
    } catch(e) {}

    // 3. Directional blur (the sort smear)
    try {
      dirBlur = fx.addProperty('ADBE Directional Blur');
      if (dirBlur) {
        dirBlur.property('ADBE Directional Blur-0001').setValue(blurAngle);
        dirBlur.property('ADBE Directional Blur-0002').setValue(length);
      }
    } catch(e) {}

    // 4. Optional turbulent displace for randomness
    if (randomness > 0) {
      try {
        var tdFx = fx.addProperty('ADBE Turbulent Displace');
        if (tdFx) {
          tdFx.property('ADBE Turbulent Displace-0002').setValue(randomness * 2.5);
          tdFx.property('ADBE Turbulent Displace-0003').setValue(40 + randomness * 0.6);
        }
      } catch(e) {}
    }

    // 5. Animation expressions
    if (animate && dirBlur) {
      _applyAnimExpression(dirBlur, layer, controller, params, length, animStyle, animSpeed, animAmount);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Controller null (rig mode)
  // ──────────────────────────────────────────────────────────────────────────
  function _createController(comp, params) {
    var ctrl = comp.layers.addNull(comp.duration);
    ctrl.name = 'PIXEL_SORT_CONTROL';
    ctrl.moveToBeginning();

    var fx = ctrl.property('ADBE Effect Parade');

    function addSlider(name, val) {
      try {
        var sc = fx.addProperty('ADBE Slider Control');
        if (sc) { sc.name = name; sc.property('ADBE Slider Control-0001').setValue(val); }
      } catch(e) {}
    }
    function addCheckbox(name, val) {
      try {
        var cb = fx.addProperty('ADBE Checkbox Control');
        if (cb) { cb.name = name; cb.property('ADBE Checkbox Control-0001').setValue(val ? 1 : 0); }
      } catch(e) {}
    }

    var threshLow  = (params.thresholdLow  !== undefined) ? params.thresholdLow  : (params.threshold !== undefined ? params.threshold : 60);
    var threshHigh = (params.thresholdHigh !== undefined) ? params.thresholdHigh : 100;

    addSlider('Sort Length',    params.sortLength   || 200);
    addSlider('Threshold Low',  threshLow);
    addSlider('Threshold High', threshHigh);
    addSlider('Randomness',     params.randomness   || 0);
    addSlider('Angle',          params.angle        || 0);
    addSlider('Anim Speed',     (params.animSpeed   !== undefined) ? params.animSpeed   : 1);
    addSlider('Anim Amount',    (params.animAmount  !== undefined) ? params.animAmount  : 50);
    addSlider('Loop Duration',  (params.loopDuration!== undefined) ? params.loopDuration: 2);
    addSlider('Smear Opacity',  100);
    addCheckbox('Animate',      params.animate || false);

    return ctrl;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Animation expressions
  // ──────────────────────────────────────────────────────────────────────────
  function _applyAnimExpression(dirBlur, layer, controller, params, baseLength, animStyle, animSpeed, animAmount) {
    // Blur length property (ADBE Directional Blur-0002)
    var blurLengthProp = null;
    try { blurLengthProp = dirBlur.property('ADBE Directional Blur-0002'); } catch(e) {}

    if (!blurLengthProp) { return; }

    var isRig = (controller !== null);
    var expr  = '';

    if (isRig) {
      // All rig expressions read from the PIXEL_SORT_CONTROL null
      var rigBase = 'var ctrl = thisComp.layer("PIXEL_SORT_CONTROL");\n' +
                    'var base   = ctrl.effect("Sort Length")("Slider");\n' +
                    'var speed  = ctrl.effect("Anim Speed")("Slider");\n' +
                    'var amount = ctrl.effect("Anim Amount")("Slider");\n' +
                    'var doAnim = ctrl.effect("Animate")("Checkbox");\n';

      if (animStyle === 'lengthWave' || animStyle === 'scanlineMove') {
        expr = rigBase +
               'doAnim ? base + Math.sin(time * speed * Math.PI * 2) * amount : base;';
      } else if (animStyle === 'drift') {
        expr = rigBase +
               'doAnim ? (seedRandom(42, true), base + noise(time * speed) * amount) : base;';
      } else if (animStyle === 'pulse') {
        expr = rigBase +
               'doAnim ? base + Math.pow((Math.sin(time * speed * Math.PI * 2) + 1) / 2, 3) * amount : base;';
      } else if (animStyle === 'randomFlicker') {
        expr = rigBase +
               'doAnim ? (seedRandom(Math.floor(time * speed * 12), true), base + random(-amount, amount)) : base;';
      } else if (animStyle === 'thresholdSweep') {
        // thresholdSweep applies to blur length as a stand-in for the threshold effect
        expr = rigBase +
               'doAnim ? base + Math.sin(time * speed * Math.PI * 2) * amount : base;';
      } else {
        expr = rigBase + 'base;';
      }
    } else {
      // Quick mode — bake literal values into expression
      var base   = baseLength;
      var speed  = animSpeed;
      var amount = animAmount;

      if (animStyle === 'lengthWave' || animStyle === 'scanlineMove') {
        expr = 'var base = ' + base + ';\n' +
               'var speed = ' + speed + ';\n' +
               'var amount = ' + amount + ';\n' +
               'base + Math.sin(time * speed * Math.PI * 2) * amount;';
      } else if (animStyle === 'drift') {
        expr = 'var base = ' + base + ';\n' +
               'var speed = ' + speed + ';\n' +
               'var amount = ' + amount + ';\n' +
               'seedRandom(42, true);\n' +
               'base + noise(time * speed) * amount;';
      } else if (animStyle === 'pulse') {
        expr = 'var base = ' + base + ';\n' +
               'var speed = ' + speed + ';\n' +
               'var amount = ' + amount + ';\n' +
               'base + Math.pow((Math.sin(time * speed * Math.PI * 2) + 1) / 2, 3) * amount;';
      } else if (animStyle === 'randomFlicker') {
        expr = 'var base = ' + base + ';\n' +
               'var speed = ' + speed + ';\n' +
               'var amount = ' + amount + ';\n' +
               'seedRandom(Math.floor(time * speed * 12), true);\n' +
               'base + random(-amount, amount);';
      } else if (animStyle === 'thresholdSweep') {
        expr = 'var base = ' + base + ';\n' +
               'var speed = ' + speed + ';\n' +
               'var amount = ' + amount + ';\n' +
               'base + Math.sin(time * speed * Math.PI * 2) * amount;';
      } else {
        expr = '' + base + ';';
      }
    }

    try { blurLengthProp.expression = expr; } catch(e) {}
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  function _sortAngle(direction, customAngle) {
    if (direction === 'vertical')  { return 0; }
    if (direction === 'diagonal')  { return 45; }
    if (direction === 'angle')     { return (customAngle !== undefined) ? customAngle : 0; }
    return 90; // horizontal (default) and radial fallback
  }

  // Channel extraction / matte preparation per sort mode
  function _applyModeExtract(effects, mode) {
    try {
      if (mode === 'brightness' || mode === 'saturation') {
        var hueFx = effects.addProperty('ADBE HUE SATURATION');
        if (hueFx) { hueFx.property('ADBE HUE SATURATION-0002').setValue(-100); }
      } else if (mode === 'green') {
        // Shift Channels: set R/G/B output all to Green so luminance drives green
        var scFx = effects.addProperty('ADBE Shift Channels');
        if (scFx) {
          // Take Green: R→Green, G→Green, B→Green (channel index 2 = Green in AE Shift Channels)
          scFx.property('ADBE Shift Channels-0001').setValue(2); // R from Green
          scFx.property('ADBE Shift Channels-0002').setValue(2); // G from Green
          scFx.property('ADBE Shift Channels-0003').setValue(2); // B from Green
        }
      } else if (mode === 'blue') {
        var scFxB = effects.addProperty('ADBE Shift Channels');
        if (scFxB) {
          scFxB.property('ADBE Shift Channels-0001').setValue(3); // R from Blue
          scFxB.property('ADBE Shift Channels-0002').setValue(3); // G from Blue
          scFxB.property('ADBE Shift Channels-0003').setValue(3); // B from Blue
        }
      } else if (mode === 'alpha') {
        // Route alpha channel into RGB so luma matte reads alpha brightness
        var scFxA = effects.addProperty('ADBE Shift Channels');
        if (scFxA) {
          scFxA.property('ADBE Shift Channels-0001').setValue(4); // R from Alpha
          scFxA.property('ADBE Shift Channels-0002').setValue(4); // G from Alpha
          scFxA.property('ADBE Shift Channels-0003').setValue(4); // B from Alpha
        }
      } else if (mode === 'edges') {
        // Find Edges then threshold via Levels
        var feFx = effects.addProperty('ADBE Find Edges');
        if (feFx) { feFx.property('ADBE Find Edges-0001').setValue(0); } // Invert = false
        // Levels will be added by caller (thresholdLow/High already applied after this call)
      }
      // 'hue' and 'red': rely on raw luminance from Levels alone (existing behavior)
    } catch(e) {}
  }

  return { apply: apply };
})();

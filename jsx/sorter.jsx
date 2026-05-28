var Sorter = (function() {

  function apply(params) {
    return withUndo('Pixel Sorter', function() {
      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply Pixel Sort.' };
      }

      var mode       = params.sortMode    || 'brightness';
      var direction  = params.direction   || 'horizontal';
      var length     = params.sortLength  || 200;
      var threshold  = params.threshold   || 60;
      var randomness = params.randomness  || 0;
      var iterations = params.iterations  || 1;
      var useColorKey = params.useColorKey || false;
      var keyColor   = hexToRgb(params.keyColor  || '#ff0000');
      var keyHueTol  = params.keyHueTol   || 30;

      var count = 0;

      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];

        for (var iter = 0; iter < iterations; iter++) {
          // Create sort layer first (duplicated below src in z-order after moveBefore)
          var sortLayer = src.duplicate();
          sortLayer.name = src.name + '_Sort_' + (iter + 1);

          // Create matte layer (will be placed above sortLayer)
          var matteLayer = src.duplicate();
          matteLayer.name = src.name + '_Matte_' + (iter + 1);

          // Stack: matteLayer directly above sortLayer, above src
          sortLayer.moveBefore(src);
          matteLayer.moveBefore(sortLayer);

          // Apply directional blur to sort layer
          var sortFx = sortLayer.property('ADBE Effect Parade');
          try {
            var dirBlur = sortFx.addProperty('ADBE Directional Blur');
            if (dirBlur) {
              dirBlur.property('ADBE Directional Blur-0001').setValue(_sortAngle(direction));
              dirBlur.property('ADBE Directional Blur-0002').setValue(length);
            }
          } catch(e) {}

          // Build matte: extract sort channel, threshold, optional color key
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
            // Luminance threshold: crush darks to black, bright areas stay white
            try {
              var lvFx = matteFx.addProperty('ADBE Levels2');
              if (lvFx) {
                var blackPt = Math.round((threshold / 100) * 255);
                lvFx.property('ADBE Levels2-0002').setValue([blackPt, 255]);
              }
            } catch(e) {}
          }

          // Randomness via turbulent displacement on matte
          if (randomness > 0) {
            try {
              var tdFx = matteFx.addProperty('ADBE Turbulent Displace');
              if (tdFx) {
                tdFx.property('ADBE Turbulent Displace-0002').setValue(randomness * 2.5);
                tdFx.property('ADBE Turbulent Displace-0003').setValue(40 + randomness * 0.6);
              }
            } catch(e) {}
          }

          // Wire track matte: sortLayer uses matteLayer (directly above) as luma matte
          sortLayer.trackMatteType = TrackMatteType.LUMA;
        }
        count++;
      }

      return { success: true, count: count };
    });
  }

  function _sortAngle(direction) {
    if (direction === 'vertical')  return 0;
    if (direction === 'diagonal')  return 45;
    return 90; // horizontal (default) and radial fallback
  }

  // Desaturate the matte layer so luminance drives the threshold
  function _applyModeExtract(effects, mode) {
    try {
      if (mode === 'brightness' || mode === 'saturation') {
        var hueFx = effects.addProperty('ADBE HUE SATURATION');
        if (hueFx) hueFx.property('ADBE HUE SATURATION-0002').setValue(-100);
      }
      // 'hue' and 'red': use raw luminance from Levels alone
    } catch(e) {}
  }

  return { apply: apply };
})();

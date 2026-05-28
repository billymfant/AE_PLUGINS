var Glow = (function() {

  function apply(params) {
    return withUndo('Deep Glow', function() {
      var comp       = requireComp();
      var selected   = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply Deep Glow.' };
      }

      var intensity  = (params.intensity  || 150) / 100;
      var radius     = params.radius      || 60;
      var threshold  = params.threshold   || 80;
      var glowColor  = hexToRgb(params.glowColor  || '#ffffff');
      var blendMode  = blendModeFromString(params.blendMode || 'screen');
      var numLayers  = params.layers      || 2;
      var quality    = params.quality     || 'quality';
      var satBoost   = params.saturation  || 0;
      var hueShift   = params.hueShift    || 0;
      var colorize   = params.colorize    || false;
      var falloff    = params.falloff     || 'soft';

      var count = 0;

      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];

        for (var pass = 0; pass < numLayers; pass++) {
          var passScale  = _glowPassScale(pass, numLayers, falloff);
          var passRadius = radius * (1 + pass * 0.8);

          var dup = src.duplicate();
          dup.name = src.name + '_Glow_' + (pass + 1);
          dup.moveAfter(src);

          if (quality === 'fast') {
            dup.quality = LayerQuality.DRAFT;
          }

          var glowFx = dup.property('ADBE Effect Parade').addProperty('ADBE Glow');
          if (glowFx) {
            glowFx.property('ADBE Glow Threshold').setValue(threshold / 255);
            glowFx.property('ADBE Glow Radius').setValue(passRadius);
            glowFx.property('ADBE Glow Intensity').setValue(intensity * passScale);
            if (colorize) {
              glowFx.property('ADBE Glow Operation').setValue(3);
              glowFx.property('ADBE Glow Color A').setValue(glowColor);
            }
          }

          if (satBoost !== 0 || hueShift !== 0) {
            var hueFx = dup.property('ADBE Effect Parade').addProperty('ADBE HUE SATURATION');
            if (hueFx) {
              if (hueShift !== 0) hueFx.property('ADBE HUE SATURATION-0001').setValue(hueShift);
              if (satBoost !== 0) hueFx.property('ADBE HUE SATURATION-0002').setValue(satBoost);
            }
          }

          dup.blendingMode = blendMode;
          dup.property('ADBE Opacity').setValue(100 * passScale);
        }
        count++;
      }

      return { success: true, count: count };
    });
  }

  // Intensity multiplier per pass index based on falloff curve
  // pass=0 always returns 1.0 (full intensity first pass)
  function _glowPassScale(pass, numLayers, falloff) {
    if (falloff === 'linear') {
      return Math.max(0.05, 1 - (pass / Math.max(1, numLayers - 1)) * 0.9);
    }
    if (falloff === 'exponential') {
      return Math.pow(0.45, pass);
    }
    // 'soft' default — inverse square root decay
    return 1 / Math.sqrt(pass + 1);
  }

  return { apply: apply };
})();

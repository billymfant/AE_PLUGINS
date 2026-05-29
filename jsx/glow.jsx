var Glow = (function() {

  function apply(params) {
    return withUndo('Deep Glow', function() {
      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply Deep Glow.' };
      }

      // ── Resolve params (keep defaults identical to v0 for backward compat) ──
      var intensity         = (params.intensity         || 150) / 100;
      var radius            = params.radius             || 60;
      var threshold         = params.threshold          || 80;
      var glowColorHex      = params.glowColor          || '#ffffff';
      var glowColor         = hexToRgb(glowColorHex);
      var blendMode         = blendModeFromString(params.blendMode || 'screen');
      var numLayers         = params.layers             || 2;
      var quality           = params.quality            || 'quality';
      var satBoost          = params.saturation         || 0;
      var hueShift          = params.hueShift           || 0;
      var colorize          = params.colorize           || false;
      var falloff           = params.falloff            || 'soft';

      // New v0.1 params — safe defaults when not provided (older presets)
      var tintAmount        = (params.tintAmount        !== undefined) ? params.tintAmount        : 0;
      var sourceGain        = (params.sourceGain        !== undefined) ? params.sourceGain        : 100;
      var thresholdSoftness = (params.thresholdSoftness !== undefined) ? params.thresholdSoftness : 20;
      var glowOnly          = (params.glowOnly          !== undefined) ? params.glowOnly          : false;
      var useController     = (params.useController     !== undefined) ? params.useController     : true;

      var count = 0;

      // ── Controller creation (one per operation, shared by all selected layers) ──
      var controllerLayer = null;
      if (useController) {
        controllerLayer = comp.layers.addNull();
        controllerLayer.name = 'GLOW_CONTROLLER';
        controllerLayer.moveToBeginning();

        var fx = controllerLayer.property('ADBE Effect Parade');

        // Slider: Glow Intensity
        var fxIntensity = fx.addProperty('ADBE Slider Control');
        fxIntensity.name = 'Glow Intensity';
        fxIntensity.property('ADBE Slider Control-0001').setValue(params.intensity || 150);

        // Slider: Glow Radius
        var fxRadius = fx.addProperty('ADBE Slider Control');
        fxRadius.name = 'Glow Radius';
        fxRadius.property('ADBE Slider Control-0001').setValue(radius);

        // Slider: Threshold
        var fxThreshold = fx.addProperty('ADBE Slider Control');
        fxThreshold.name = 'Threshold';
        fxThreshold.property('ADBE Slider Control-0001').setValue(threshold);

        // Slider: Threshold Softness
        var fxThresholdSoftness = fx.addProperty('ADBE Slider Control');
        fxThresholdSoftness.name = 'Threshold Softness';
        fxThresholdSoftness.property('ADBE Slider Control-0001').setValue(thresholdSoftness);

        // Slider: Source Gain
        var fxSourceGain = fx.addProperty('ADBE Slider Control');
        fxSourceGain.name = 'Source Gain';
        fxSourceGain.property('ADBE Slider Control-0001').setValue(sourceGain);

        // Slider: Tint Amount
        var fxTintAmount = fx.addProperty('ADBE Slider Control');
        fxTintAmount.name = 'Tint Amount';
        fxTintAmount.property('ADBE Slider Control-0001').setValue(tintAmount);

        // Color Control: Tint Color
        var fxTintColor = fx.addProperty('ADBE Color Control');
        fxTintColor.name = 'Tint Color';
        fxTintColor.property('ADBE Color Control-0001').setValue(glowColor);

        // Checkbox Control: Glow Only
        var fxGlowOnly = fx.addProperty('ADBE Checkbox Control');
        fxGlowOnly.name = 'Glow Only';
        fxGlowOnly.property('ADBE Checkbox Control-0001').setValue(glowOnly ? 1 : 0);
      }

      // ── Per-source-layer pass creation ────────────────────────────────────
      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];

        // Apply Glow Only to the source layer
        if (useController) {
          // Expression-driven: controller checkbox toggles source visibility
          src.property('ADBE Opacity').expression =
            'thisComp.layer("GLOW_CONTROLLER").effect("Glow Only")("Checkbox")==1 ? 0 : 100';
        } else {
          // Baked: static opacity when not using controller
          if (glowOnly) {
            src.property('ADBE Opacity').setValue(0);
          }
        }

        for (var pass = 0; pass < numLayers; pass++) {
          var passScale        = _glowPassScale(pass, numLayers, falloff);
          var passRadiusFactor = (1 + pass * 0.8);    // factor baked into expressions
          var passRadius       = radius * passRadiusFactor;

          var dup = src.duplicate();
          dup.name = src.name + '_Glow_' + (pass + 1);
          dup.moveAfter(src);

          if (quality === 'fast') {
            dup.quality = LayerQuality.DRAFT;
          }

          var glowFx = dup.property('ADBE Effect Parade').addProperty('ADBE Glow');
          if (glowFx) {
            if (useController) {
              // ── Expression-driven pass values ──────────────────────────────

              // Radius: controller base * per-pass factor (factor literal is baked in)
              glowFx.property('ADBE Glow Radius').expression =
                'var c=thisComp.layer("GLOW_CONTROLLER"); c.effect("Glow Radius")("Slider") * ' + passRadiusFactor + ';';

              // Intensity: controller intensity * sourceGain * per-pass scale literal
              glowFx.property('ADBE Glow Intensity').expression =
                'var c=thisComp.layer("GLOW_CONTROLLER"); ' +
                '(c.effect("Glow Intensity")("Slider")/100) * (c.effect("Source Gain")("Slider")/100) * ' + passScale + ';';

              // Threshold: soften by Threshold Softness (lowers effective threshold)
              glowFx.property('ADBE Glow Threshold').expression =
                'var c=thisComp.layer("GLOW_CONTROLLER"); ' +
                'var t=c.effect("Threshold")("Slider"); ' +
                'var s=c.effect("Threshold Softness")("Slider"); ' +
                'Math.max(0,(t - s))/255;';

              // Tint / colorize: use controller when tintAmount > 0 or colorize is on
              if (tintAmount > 0 || colorize) {
                glowFx.property('ADBE Glow Operation').setValue(3);
                glowFx.property('ADBE Glow Color A').expression =
                  'thisComp.layer("GLOW_CONTROLLER").effect("Tint Color")("Color");';
              }

            } else {
              // ── Baked (non-controller) path — identical to original v0 ──
              glowFx.property('ADBE Glow Threshold').setValue(threshold / 255);
              glowFx.property('ADBE Glow Radius').setValue(passRadius);
              glowFx.property('ADBE Glow Intensity').setValue(intensity * passScale);
              if (colorize) {
                glowFx.property('ADBE Glow Operation').setValue(3);
                glowFx.property('ADBE Glow Color A').setValue(glowColor);
              }
            }
          }

          // Hue/Sat — same for both paths (baked on the dup layer)
          if (satBoost !== 0 || hueShift !== 0) {
            var hueFx = dup.property('ADBE Effect Parade').addProperty('ADBE HUE SATURATION');
            if (hueFx) {
              if (hueShift !== 0) { hueFx.property('ADBE HUE SATURATION-0001').setValue(hueShift); }
              if (satBoost !== 0) { hueFx.property('ADBE HUE SATURATION-0002').setValue(satBoost); }
            }
          }

          dup.blendingMode = blendMode;

          if (useController) {
            // Opacity expression: tracks controller-driven pass scale literal
            dup.property('ADBE Opacity').expression =
              'var c=thisComp.layer("GLOW_CONTROLLER"); ' +
              '100 * ' + passScale + ';';
          } else {
            dup.property('ADBE Opacity').setValue(100 * passScale);
          }
        }
        count++;
      }

      return { success: true, count: count };
    });
  }

  // Intensity multiplier per pass index based on falloff curve.
  // pass=0 always returns 1.0 (full intensity first pass).
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

// Color Lab — applies a stack of AE built-in color effects to an adjustment layer.
var ColorLab = (function () {

  function apply(params) {
    var comp = requireComp();
    return withUndo('Color Lab', function () {
      return _applyGrade(comp, params);
    });
  }

  function _applyGrade(comp, params) {
    var adj = comp.layers.addSolid(
      [0, 0, 0, 1],
      'Color Lab',
      comp.width,
      comp.height,
      comp.pixelAspect
    );
    adj.adjustmentLayer = true;
    adj.moveToBeginning();

    var fx = adj.property('ADBE Effect Parade');

    // ── 1. Look preset ───────────────────────────────────────
    if (params.look && params.look !== 'none') {
      _applyLook(fx, params.look, params.lookIntensity || 100);
    }

    // ── 2. Hue / Saturation ──────────────────────────────────
    if (params.hue !== 0 || params.saturation !== 0 || params.lightness !== 0) {
      var hs = fx.addProperty('ADBE HUE SATURATION');
      hs.property('ADBE HUE SATURATION-0001').setValue(1);
      hs.property('ADBE HUE SATURATION-0002').setValue(params.hue || 0);
      hs.property('ADBE HUE SATURATION-0003').setValue(params.saturation || 0);
      hs.property('ADBE HUE SATURATION-0004').setValue(params.lightness || 0);
    }

    // ── 3. Brightness / Contrast ─────────────────────────────
    if (params.brightness !== 0 || params.contrast !== 0) {
      var bc = fx.addProperty('ADBE Brightness & Contrast 2');
      bc.property('ADBE Brightness & Contrast 2-0001').setValue(params.brightness || 0);
      bc.property('ADBE Brightness & Contrast 2-0002').setValue(params.contrast || 0);
    }

    // ── 4. Color Balance — tone ranges ───────────────────────
    if (params.shadowsHue !== 0 || params.midtonesHue !== 0 || params.highlightsHue !== 0 ||
        params.shadowsLightness !== 0 || params.midtonesLightness !== 0 || params.highlightsLightness !== 0 ||
        params.shadowsSaturation !== 0 || params.midtonesSaturation !== 0 || params.highlightsSaturation !== 0) {
      var cb = fx.addProperty('ADBE Color Balance (HLS)');
      cb.property('ADBE Color Balance (HLS)-0001').setValue(params.shadowsHue || 0);
      cb.property('ADBE Color Balance (HLS)-0002').setValue(params.shadowsLightness || 0);
      cb.property('ADBE Color Balance (HLS)-0003').setValue(params.shadowsSaturation || 0);
      cb.property('ADBE Color Balance (HLS)-0004').setValue(params.midtonesHue || 0);
      cb.property('ADBE Color Balance (HLS)-0005').setValue(params.midtonesLightness || 0);
      cb.property('ADBE Color Balance (HLS)-0006').setValue(params.midtonesSaturation || 0);
      cb.property('ADBE Color Balance (HLS)-0007').setValue(params.highlightsHue || 0);
      cb.property('ADBE Color Balance (HLS)-0008').setValue(params.highlightsLightness || 0);
      cb.property('ADBE Color Balance (HLS)-0009').setValue(params.highlightsSaturation || 0);
    }

    // ── 5. Tint ───────────────────────────────────────────────
    if (params.tintAmount > 0) {
      var tint = fx.addProperty('ADBE Tint');
      tint.property('ADBE Tint-0002').setValue(_hex(params.tintBlack || '#000000'));
      tint.property('ADBE Tint-0003').setValue(_hex(params.tintWhite || '#ffffff'));
      tint.property('ADBE Tint-0004').setValue(params.tintAmount);
    }

    // ── 6. Film Grain ─────────────────────────────────────────
    if (params.grainAmount > 0) {
      var noise = fx.addProperty('ADBE Noise');
      noise.property('ADBE Noise-0001').setValue(params.grainAmount / 100);
      noise.property('ADBE Noise-0002').setValue(params.grainColor || false);
    }

    // ── 7. Vignette via Lens Correction ──────────────────────
    if (params.vignetteAmount > 0) {
      var lc = fx.addProperty('ADBE Lens Correction');
      lc.property('ADBE Lens Correction-0002').setValue(-params.vignetteAmount);
    }

    return { layer: adj.name, effects: fx.numProperties };
  }

  function _applyLook(fx, look, intensity) {
    var pct = intensity / 100;

    if (look === 'bleach_bypass') {
      var hs = fx.addProperty('ADBE HUE SATURATION');
      hs.property('ADBE HUE SATURATION-0003').setValue(-40 * pct);
      var bc = fx.addProperty('ADBE Brightness & Contrast 2');
      bc.property('ADBE Brightness & Contrast 2-0002').setValue(30 * pct);

    } else if (look === 'cinematic_teal_orange') {
      var cb = fx.addProperty('ADBE Color Balance (HLS)');
      cb.property('ADBE Color Balance (HLS)-0001').setValue(-40 * pct);
      cb.property('ADBE Color Balance (HLS)-0003').setValue(20 * pct);
      cb.property('ADBE Color Balance (HLS)-0007').setValue(20 * pct);
      cb.property('ADBE Color Balance (HLS)-0009').setValue(15 * pct);

    } else if (look === 'vintage') {
      var bc2 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc2.property('ADBE Brightness & Contrast 2-0001').setValue(8 * pct);
      var hs2 = fx.addProperty('ADBE HUE SATURATION');
      hs2.property('ADBE HUE SATURATION-0003').setValue(-25 * pct);
      var tint = fx.addProperty('ADBE Tint');
      tint.property('ADBE Tint-0002').setValue(_hex('#1a0a00'));
      tint.property('ADBE Tint-0003').setValue(_hex('#fff4e0'));
      tint.property('ADBE Tint-0004').setValue(30 * pct);

    } else if (look === 'cool_blue') {
      var cb2 = fx.addProperty('ADBE Color Balance (HLS)');
      cb2.property('ADBE Color Balance (HLS)-0004').setValue(-30 * pct);
      cb2.property('ADBE Color Balance (HLS)-0006').setValue(10 * pct);

    } else if (look === 'warm_golden') {
      var cb3 = fx.addProperty('ADBE Color Balance (HLS)');
      cb3.property('ADBE Color Balance (HLS)-0004').setValue(25 * pct);
      cb3.property('ADBE Color Balance (HLS)-0006').setValue(15 * pct);
      var hs3 = fx.addProperty('ADBE HUE SATURATION');
      hs3.property('ADBE HUE SATURATION-0003').setValue(15 * pct);

    } else if (look === 'horror') {
      var hs4 = fx.addProperty('ADBE HUE SATURATION');
      hs4.property('ADBE HUE SATURATION-0003').setValue(-60 * pct);
      var bc3 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc3.property('ADBE Brightness & Contrast 2-0002').setValue(40 * pct);
      bc3.property('ADBE Brightness & Contrast 2-0001').setValue(-15 * pct);
    }
  }

  function _hex(hex) {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      1
    ];
  }

  return { apply: apply };
}());

// Color Lab Pro — Colorista IV-inspired color grading via AE built-in effects
var ColorLab = (function () {

  function apply(params) {
    var comp = requireComp();
    return withUndo('Color Lab', function () {
      return _applyGrade(comp, params);
    });
  }

  function _applyGrade(comp, params) {
    // Find existing Color Lab layer to reuse (enables live preview)
    var adj = null;
    for (var i = 1; i <= comp.layers.length; i++) {
      if (comp.layers[i].name === 'Color Lab') {
        adj = comp.layers[i];
        break;
      }
    }
    if (!adj) {
      adj = comp.layers.addSolid([0,0,0], 'Color Lab', comp.width, comp.height, comp.pixelAspect);
      adj.adjustmentLayer = true;
    }
    // Clear all existing effects so we can reapply cleanly
    var fxStrip = adj.property('ADBE Effect Parade');
    while (fxStrip.numProperties > 0) {
      fxStrip.property(1).remove();
    }
    adj.moveToBeginning();
    var fx = adj.property('ADBE Effect Parade');
    var n = 0;

    // ── 1. Film Look preset ──────────────────────────────────
    if (params.look && params.look !== 'none') {
      _applyLook(fx, params.look, params.lookIntensity || 100);
      n++;
    }

    // ── 2. Exposure ──────────────────────────────────────────
    var exp0 = params.exposure || 0;
    if (exp0 !== 0) {
      try {
        var expFx = fx.addProperty('ADBE Exposure');
        expFx.property('ADBE Exposure-0001').setValue(exp0);
        n++;
      } catch (e) {}
    }

    // ── 3. Temperature & Tint → Color Balance 2 (global) ────
    var temp = params.temperature || 0;
    var tint2 = params.colorTint || 0;
    if (temp !== 0 || tint2 !== 0) {
      var rT = temp * 0.5 + tint2 * 0.3;
      var gT = temp * 0.08 - tint2 * 0.5;
      var bT = -temp * 0.5 + tint2 * 0.3;
      try {
        var cb2T = fx.addProperty('ADBE Color Balance 2');
        cb2T.property('ADBE Color Balance 2-0001').setValue(rT);
        cb2T.property('ADBE Color Balance 2-0002').setValue(gT);
        cb2T.property('ADBE Color Balance 2-0003').setValue(bT);
        cb2T.property('ADBE Color Balance 2-0004').setValue(rT * 0.85);
        cb2T.property('ADBE Color Balance 2-0005').setValue(gT * 0.85);
        cb2T.property('ADBE Color Balance 2-0006').setValue(bT * 0.85);
        cb2T.property('ADBE Color Balance 2-0007').setValue(rT * 0.65);
        cb2T.property('ADBE Color Balance 2-0008').setValue(gT * 0.65);
        cb2T.property('ADBE Color Balance 2-0009').setValue(bT * 0.65);
        cb2T.property('ADBE Color Balance 2-0010').setValue(true);
        n++;
      } catch (e) {}
    }

    // ── 4. Color Wheels → Color Balance 2 (per tone range) ──
    // Wheel XY in [-1,1] maps to RGB push: R=x*S, G=(-0.5x+0.866y)*S, B=(-0.5x-0.866y)*S
    var lx = params.liftX || 0,  ly = params.liftY || 0;
    var mx = params.gammaX || 0, my = params.gammaY || 0;
    var hx = params.gainX || 0,  hy = params.gainY || 0;
    if (lx || ly || mx || my || hx || hy) {
      var S = 50;
      var lift = { r: lx*S, g: (-0.5*lx+0.866*ly)*S, b: (-0.5*lx-0.866*ly)*S };
      var mid  = { r: mx*S, g: (-0.5*mx+0.866*my)*S, b: (-0.5*mx-0.866*my)*S };
      var high = { r: hx*S, g: (-0.5*hx+0.866*hy)*S, b: (-0.5*hx-0.866*hy)*S };
      try {
        var cb2W = fx.addProperty('ADBE Color Balance 2');
        cb2W.property('ADBE Color Balance 2-0001').setValue(lift.r);
        cb2W.property('ADBE Color Balance 2-0002').setValue(lift.g);
        cb2W.property('ADBE Color Balance 2-0003').setValue(lift.b);
        cb2W.property('ADBE Color Balance 2-0004').setValue(mid.r);
        cb2W.property('ADBE Color Balance 2-0005').setValue(mid.g);
        cb2W.property('ADBE Color Balance 2-0006').setValue(mid.b);
        cb2W.property('ADBE Color Balance 2-0007').setValue(high.r);
        cb2W.property('ADBE Color Balance 2-0008').setValue(high.g);
        cb2W.property('ADBE Color Balance 2-0009').setValue(high.b);
        cb2W.property('ADBE Color Balance 2-0010').setValue(true);
        n++;
      } catch (e) {}
    }

    // ── 5. Wheel luma → Color Balance (HLS) lightness ────────
    var ll = params.liftLuma || 0;
    var ml = params.gammaLuma || 0;
    var hl = params.gainLuma || 0;
    if (ll || ml || hl) {
      try {
        var hlsW = fx.addProperty('ADBE Color Balance (HLS)');
        hlsW.property('ADBE Color Balance (HLS)-0002').setValue(ll);
        hlsW.property('ADBE Color Balance (HLS)-0005').setValue(ml);
        hlsW.property('ADBE Color Balance (HLS)-0008').setValue(hl);
        n++;
      } catch (e) {}
    }

    // ── 6. Global Hue / Saturation / Lightness ───────────────
    var hue0 = params.hue || 0, sat0 = params.saturation || 0, lit0 = params.lightness || 0;
    if (hue0 || sat0 || lit0) {
      var hs = fx.addProperty('ADBE HUE SATURATION');
      hs.property('ADBE HUE SATURATION-0001').setValue(0);
      hs.property('ADBE HUE SATURATION-0002').setValue(hue0);
      hs.property('ADBE HUE SATURATION-0003').setValue(sat0);
      hs.property('ADBE HUE SATURATION-0004').setValue(lit0);
      n++;
    }

    // ── 7. Brightness & Contrast ─────────────────────────────
    var br0 = params.brightness || 0, co0 = params.contrast || 0;
    if (br0 || co0) {
      var bc = fx.addProperty('ADBE Brightness & Contrast 2');
      bc.property('ADBE Brightness & Contrast 2-0001').setValue(br0);
      bc.property('ADBE Brightness & Contrast 2-0002').setValue(co0);
      n++;
    }

    // ── 8. HSL Selective Color (channel-targeted HueSat) ─────
    var channelMap = { reds:1, yellows:2, greens:3, cyans:4, blues:5, magentas:6 };
    if (params.hslEnable && params.hslChannel) {
      var chIdx = channelMap[params.hslChannel] || 1;
      var hslH = params.hslHueAdj || 0;
      var hslS = params.hslSatAdj || 0;
      var hslL = params.hslLumAdj || 0;
      if (hslH || hslS || hslL) {
        var hslFx = fx.addProperty('ADBE HUE SATURATION');
        hslFx.property('ADBE HUE SATURATION-0001').setValue(chIdx);
        hslFx.property('ADBE HUE SATURATION-0002').setValue(hslH);
        hslFx.property('ADBE HUE SATURATION-0003').setValue(hslS);
        hslFx.property('ADBE HUE SATURATION-0004').setValue(hslL);
        n++;
      }
    }

    // ── 9. Skin Tone Protection ───────────────────────────────
    if (params.skinProtect) {
      var pct = (params.skinProtectAmt || 50) / 100;
      try {
        var skinR = fx.addProperty('ADBE HUE SATURATION');
        skinR.property('ADBE HUE SATURATION-0001').setValue(1); // Reds
        skinR.property('ADBE HUE SATURATION-0003').setValue(12 * pct);
        skinR.property('ADBE HUE SATURATION-0004').setValue(5 * pct);
        var skinY = fx.addProperty('ADBE HUE SATURATION');
        skinY.property('ADBE HUE SATURATION-0001').setValue(2); // Yellows
        skinY.property('ADBE HUE SATURATION-0003').setValue(8 * pct);
        skinY.property('ADBE HUE SATURATION-0004').setValue(3 * pct);
        n += 2;
      } catch (e) {}
    }

    // ── 10. Tint ──────────────────────────────────────────────
    if ((params.tintAmount || 0) > 0) {
      var tFx = fx.addProperty('ADBE Tint');
      tFx.property('ADBE Tint-0002').setValue(_hex(params.tintBlack || '#000000'));
      tFx.property('ADBE Tint-0003').setValue(_hex(params.tintWhite || '#ffffff'));
      tFx.property('ADBE Tint-0004').setValue(params.tintAmount);
      n++;
    }

    // ── 11. Film Grain ────────────────────────────────────────
    if ((params.grainAmount || 0) > 0) {
      var gFx = fx.addProperty('ADBE Noise');
      gFx.property('ADBE Noise-0001').setValue((params.grainAmount || 0) / 100);
      gFx.property('ADBE Noise-0002').setValue(params.grainColor || false);
      n++;
    }

    // ── 12. Vignette via Lens Correction ──────────────────────
    if ((params.vignetteAmount || 0) > 0) {
      try {
        var vFx = fx.addProperty('ADBE Lens Correction');
        vFx.property('ADBE Lens Correction-0002').setValue(-(params.vignetteAmount || 0));
        vFx.property('ADBE Lens Correction-0003').setValue(params.vignetteMidpoint || 50);
        n++;
      } catch (e) {}
    }

    return { layer: adj.name, effects: n };
  }

  function _applyLook(fx, look, intensity) {
    var p = intensity / 100;

    if (look === 'bleach_bypass') {
      var hs = fx.addProperty('ADBE HUE SATURATION');
      hs.property('ADBE HUE SATURATION-0001').setValue(0);
      hs.property('ADBE HUE SATURATION-0003').setValue(-40 * p);
      var bc = fx.addProperty('ADBE Brightness & Contrast 2');
      bc.property('ADBE Brightness & Contrast 2-0002').setValue(30 * p);

    } else if (look === 'cinematic_teal_orange') {
      try {
        var cb = fx.addProperty('ADBE Color Balance 2');
        cb.property('ADBE Color Balance 2-0001').setValue(-30 * p);
        cb.property('ADBE Color Balance 2-0003').setValue(30 * p);
        cb.property('ADBE Color Balance 2-0007').setValue(40 * p);
        cb.property('ADBE Color Balance 2-0008').setValue(10 * p);
        cb.property('ADBE Color Balance 2-0009').setValue(-30 * p);
        cb.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}

    } else if (look === 'vintage') {
      var bc2 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc2.property('ADBE Brightness & Contrast 2-0001').setValue(8 * p);
      var hs2 = fx.addProperty('ADBE HUE SATURATION');
      hs2.property('ADBE HUE SATURATION-0001').setValue(0);
      hs2.property('ADBE HUE SATURATION-0003').setValue(-25 * p);
      var tnt = fx.addProperty('ADBE Tint');
      tnt.property('ADBE Tint-0002').setValue(_hex('#1a0a00'));
      tnt.property('ADBE Tint-0003').setValue(_hex('#fff4e0'));
      tnt.property('ADBE Tint-0004').setValue(30 * p);

    } else if (look === 'cool_blue') {
      try {
        var cbc = fx.addProperty('ADBE Color Balance 2');
        cbc.property('ADBE Color Balance 2-0004').setValue(-20 * p);
        cbc.property('ADBE Color Balance 2-0006').setValue(30 * p);
      } catch (e) {}
      var hs3 = fx.addProperty('ADBE HUE SATURATION');
      hs3.property('ADBE HUE SATURATION-0001').setValue(0);
      hs3.property('ADBE HUE SATURATION-0003').setValue(10 * p);

    } else if (look === 'warm_golden') {
      try {
        var cbw = fx.addProperty('ADBE Color Balance 2');
        cbw.property('ADBE Color Balance 2-0004').setValue(25 * p);
        cbw.property('ADBE Color Balance 2-0005').setValue(10 * p);
        cbw.property('ADBE Color Balance 2-0006').setValue(-20 * p);
        cbw.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}
      var hs4 = fx.addProperty('ADBE HUE SATURATION');
      hs4.property('ADBE HUE SATURATION-0001').setValue(0);
      hs4.property('ADBE HUE SATURATION-0003').setValue(15 * p);

    } else if (look === 'horror') {
      var hs5 = fx.addProperty('ADBE HUE SATURATION');
      hs5.property('ADBE HUE SATURATION-0001').setValue(0);
      hs5.property('ADBE HUE SATURATION-0003').setValue(-60 * p);
      var bc3 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc3.property('ADBE Brightness & Contrast 2-0002').setValue(40 * p);
      bc3.property('ADBE Brightness & Contrast 2-0001').setValue(-15 * p);

    } else if (look === 'golden_hour') {
      try {
        var expGH = fx.addProperty('ADBE Exposure');
        expGH.property('ADBE Exposure-0001').setValue(0.3 * p);
      } catch (e) {}
      try {
        var cb4 = fx.addProperty('ADBE Color Balance 2');
        cb4.property('ADBE Color Balance 2-0004').setValue(30 * p);
        cb4.property('ADBE Color Balance 2-0005').setValue(12 * p);
        cb4.property('ADBE Color Balance 2-0006').setValue(-25 * p);
        cb4.property('ADBE Color Balance 2-0007').setValue(40 * p);
        cb4.property('ADBE Color Balance 2-0008').setValue(18 * p);
        cb4.property('ADBE Color Balance 2-0009').setValue(-35 * p);
        cb4.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}
      var hs6 = fx.addProperty('ADBE HUE SATURATION');
      hs6.property('ADBE HUE SATURATION-0001').setValue(0);
      hs6.property('ADBE HUE SATURATION-0003').setValue(20 * p);

    } else if (look === 'moonlight') {
      try {
        var expML = fx.addProperty('ADBE Exposure');
        expML.property('ADBE Exposure-0001').setValue(-0.5 * p);
      } catch (e) {}
      try {
        var cb5 = fx.addProperty('ADBE Color Balance 2');
        cb5.property('ADBE Color Balance 2-0001').setValue(-20 * p);
        cb5.property('ADBE Color Balance 2-0003').setValue(40 * p);
        cb5.property('ADBE Color Balance 2-0004').setValue(-15 * p);
        cb5.property('ADBE Color Balance 2-0006').setValue(30 * p);
        cb5.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}
      var hs7 = fx.addProperty('ADBE HUE SATURATION');
      hs7.property('ADBE HUE SATURATION-0001').setValue(0);
      hs7.property('ADBE HUE SATURATION-0003').setValue(-20 * p);

    } else if (look === 'neon_noir') {
      var bc4 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc4.property('ADBE Brightness & Contrast 2-0001').setValue(-20 * p);
      bc4.property('ADBE Brightness & Contrast 2-0002').setValue(50 * p);
      var hs8 = fx.addProperty('ADBE HUE SATURATION');
      hs8.property('ADBE HUE SATURATION-0001').setValue(0);
      hs8.property('ADBE HUE SATURATION-0003').setValue(40 * p);

    } else if (look === 'faded_film') {
      var bc5 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc5.property('ADBE Brightness & Contrast 2-0001').setValue(10 * p);
      bc5.property('ADBE Brightness & Contrast 2-0002').setValue(-15 * p);
      var hs9 = fx.addProperty('ADBE HUE SATURATION');
      hs9.property('ADBE HUE SATURATION-0001').setValue(0);
      hs9.property('ADBE HUE SATURATION-0003').setValue(-35 * p);
      var tnt2 = fx.addProperty('ADBE Tint');
      tnt2.property('ADBE Tint-0002').setValue(_hex('#1a1508'));
      tnt2.property('ADBE Tint-0003').setValue(_hex('#f5f0e8'));
      tnt2.property('ADBE Tint-0004').setValue(20 * p);

    } else if (look === 'cross_process') {
      try {
        var cb7 = fx.addProperty('ADBE Color Balance 2');
        cb7.property('ADBE Color Balance 2-0001').setValue(-20 * p);
        cb7.property('ADBE Color Balance 2-0003').setValue(30 * p);
        cb7.property('ADBE Color Balance 2-0007').setValue(30 * p);
        cb7.property('ADBE Color Balance 2-0009').setValue(-20 * p);
        cb7.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}
      var bc6 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc6.property('ADBE Brightness & Contrast 2-0002').setValue(25 * p);
      var hs10 = fx.addProperty('ADBE HUE SATURATION');
      hs10.property('ADBE HUE SATURATION-0001').setValue(0);
      hs10.property('ADBE HUE SATURATION-0003').setValue(30 * p);

    } else if (look === 'cyberpunk') {
      try {
        var cb8 = fx.addProperty('ADBE Color Balance 2');
        cb8.property('ADBE Color Balance 2-0001').setValue(20 * p);
        cb8.property('ADBE Color Balance 2-0003').setValue(10 * p);
        cb8.property('ADBE Color Balance 2-0007').setValue(-20 * p);
        cb8.property('ADBE Color Balance 2-0009').setValue(40 * p);
        cb8.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}
      var hs11 = fx.addProperty('ADBE HUE SATURATION');
      hs11.property('ADBE HUE SATURATION-0001').setValue(0);
      hs11.property('ADBE HUE SATURATION-0003').setValue(35 * p);
      var bc7 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc7.property('ADBE Brightness & Contrast 2-0002').setValue(30 * p);
      bc7.property('ADBE Brightness & Contrast 2-0001').setValue(-10 * p);

    } else if (look === 'documentary') {
      var hs12 = fx.addProperty('ADBE HUE SATURATION');
      hs12.property('ADBE HUE SATURATION-0001').setValue(0);
      hs12.property('ADBE HUE SATURATION-0003').setValue(-20 * p);
      var bc8 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc8.property('ADBE Brightness & Contrast 2-0002').setValue(15 * p);
      bc8.property('ADBE Brightness & Contrast 2-0001').setValue(-5 * p);

    } else if (look === 'studio_portrait') {
      try {
        var cb9 = fx.addProperty('ADBE Color Balance 2');
        cb9.property('ADBE Color Balance 2-0004').setValue(15 * p);
        cb9.property('ADBE Color Balance 2-0005').setValue(8 * p);
        cb9.property('ADBE Color Balance 2-0006').setValue(-5 * p);
        cb9.property('ADBE Color Balance 2-0010').setValue(true);
      } catch (e) {}
      var bc9 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc9.property('ADBE Brightness & Contrast 2-0001').setValue(5 * p);
      bc9.property('ADBE Brightness & Contrast 2-0002').setValue(-5 * p);

    } else if (look === 'infrared') {
      var hs13 = fx.addProperty('ADBE HUE SATURATION');
      hs13.property('ADBE HUE SATURATION-0001').setValue(0);
      hs13.property('ADBE HUE SATURATION-0002').setValue(150 * p);
      hs13.property('ADBE HUE SATURATION-0003').setValue(-30 * p);
      var bc10 = fx.addProperty('ADBE Brightness & Contrast 2');
      bc10.property('ADBE Brightness & Contrast 2-0002').setValue(20 * p);
    }
  }

  function _hex(hex) {
    return [
      parseInt(hex.slice(1,3), 16) / 255,
      parseInt(hex.slice(3,5), 16) / 255,
      parseInt(hex.slice(5,7), 16) / 255,
      1
    ];
  }

  return { apply: apply };
}());

// Color Lab — drives the NATIVE compiled effect (ColorLab.aex) from the CEP panel.
// Replaces the old version that stacked AE built-in effects (Exposure, Color
// Balance, Hue/Sat, ...). Now we apply ONE effect by match name and push the
// panel params onto its controls — same model as jsx/glow.jsx.
var ColorLab = (function () {

  var MATCH = 'DKVB ColorLab';   // == AE_Effect_Match_Name in ColorLabPiPL.r

  function num(v, d) { return (typeof v === 'number' && !isNaN(v)) ? v : d; }

  // Color-wheel XY (-1..1) -> per-channel push in the effect's -50..50 units.
  // Matches the classic 3-way mapping: R=x, G=-0.5x+0.866y, B=-0.5x-0.866y.
  function wheelRGB(x, y) {
    var S = 50;
    function clamp(v) { return v < -50 ? -50 : (v > 50 ? 50 : v); }
    return [ clamp(x * S),
             clamp((-0.5 * x + 0.866 * y) * S),
             clamp((-0.5 * x - 0.866 * y) * S) ];
  }

  // ── Tone curves: sample a control-point list {x,y}[] to a fixed 16-node LUT
  //    (x = i/15). Monotone-cubic eval mirrors the panel + the native engine
  //    (color_params.h), so panel preview == render. ─────────────────────────
  var CURVE_N = 16;
  function _crvPrepare(pts) {
    var n = pts.length, d = [], m = [], i;
    if (n < 2) return m;
    for (i = 0; i < n - 1; i++) { var h = pts[i+1].x - pts[i].x; d[i] = h > 1e-6 ? (pts[i+1].y - pts[i].y) / h : 0; }
    m[0] = d[0]; m[n-1] = d[n-2];
    for (i = 1; i < n - 1; i++) m[i] = (d[i-1]*d[i] <= 0) ? 0 : 0.5*(d[i-1]+d[i]);
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i+1] = 0; continue; }
      var a = m[i]/d[i], b = m[i+1]/d[i], s = a*a + b*b;
      if (s > 9) { var t = 3/Math.sqrt(s); m[i] = t*a*d[i]; m[i+1] = t*b*d[i]; }
    }
    return m;
  }
  function _crvEval(pts, m, x) {
    var n = pts.length;
    if (n < 2) return x;
    if (x <= pts[0].x) return pts[0].y + (x - pts[0].x) * m[0];
    if (x >= pts[n-1].x) return pts[n-1].y + (x - pts[n-1].x) * m[n-1];
    var i = 0; while (i < n-1 && x > pts[i+1].x) i++;
    var h = pts[i+1].x - pts[i].x, t = (x - pts[i].x)/h, t2 = t*t, t3 = t2*t;
    var h00 = 2*t3-3*t2+1, h10 = t3-2*t2+t, h01 = -2*t3+3*t2, h11 = t3-t2;
    return h00*pts[i].y + h10*h*m[i] + h01*pts[i+1].y + h11*h*m[i+1];
  }
  // Push a channel's 16 LUT nodes onto the native params "Curve <ch> 00..15".
  // Silent if the params are missing (older .aex) — graceful no-op.
  function _pushCurve(fx, ch, pts) {
    var m = (pts && pts.length >= 2) ? _crvPrepare(pts) : null;
    for (var i = 0; i < CURVE_N; i++) {
      var x = i / (CURVE_N - 1);
      var y = m ? _crvEval(pts, m, x) : x;
      if (y < 0) y = 0; else if (y > 1) y = 1;
      var nn = (i < 10 ? '0' : '') + i;
      _set(fx, 'Curve ' + ch + ' ' + nn, y);
    }
  }

  // Reuse an existing ColorLab on the layer (re-apply = live update), else add.
  function _fx(layer) {
    var parade = layer.property('ADBE Effect Parade');
    for (var i = 1; i <= parade.numProperties; i++) {
      var p = parade.property(i);
      if (p && p.matchName === MATCH) return p;
    }
    if (!parade.canAddProperty(MATCH)) {
      throw new Error('Color Lab plugin not found. Install ColorLab.aex into the AE Plug-ins folder and relaunch AE.');
    }
    return parade.addProperty(MATCH);
  }

  // Set a native param by its UI display name; silent if missing so an older
  // .aex still applies what it can.
  function _set(fx, name, val) {
    try { var pr = fx.property(name); if (pr) pr.setValue(val); } catch (e) {}
  }

  // Resolve the target layer(s): a shared "Color Lab" adjustment layer (default,
  // grades the whole scene) or the selected layers.
  function _targets(comp, applyToSelection) {
    if (applyToSelection) {
      var sel = comp.selectedLayers;
      if (!sel || sel.length === 0) {
        throw new Error('Select one or more layers, or switch to Adjustment Layer mode.');
      }
      return sel;
    }
    var adj = null;
    for (var i = 1; i <= comp.layers.length; i++) {
      if (comp.layers[i].name === 'Color Lab') { adj = comp.layers[i]; break; }
    }
    if (!adj) {
      adj = comp.layers.addSolid([0, 0, 0], 'Color Lab', comp.width, comp.height, comp.pixelAspect);
      adj.adjustmentLayer = true;
      adj.moveToBeginning();
    }
    return [adj];
  }

  function apply(params) {
    return withUndo('Color Lab', function () {
      var comp = requireComp();
      var layers = _targets(comp, !!params.applyToSelection);

      var lift  = wheelRGB(num(params.liftX, 0),  num(params.liftY, 0));
      var gamma = wheelRGB(num(params.gammaX, 0), num(params.gammaY, 0));
      var gain  = wheelRGB(num(params.gainX, 0),  num(params.gainY, 0));
      // wheel luma sliders are -100..100; the effect's Luma params are -50..50.
      var liftL  = num(params.liftLuma, 0)  * 0.5;
      var gammaL = num(params.gammaLuma, 0) * 0.5;
      var gainL  = num(params.gainLuma, 0)  * 0.5;

      var count = 0;
      for (var li = 0; li < layers.length; li++) {
        var fx = _fx(layers[li]);

        _set(fx, 'Exposure (stops)',      num(params.exposure, 0));
        _set(fx, 'Contrast',              num(params.contrast, 0));
        _set(fx, 'Contrast Pivot',        num(params.contrastPivot, 0.18));
        _set(fx, 'Temperature',           num(params.temperature, 0));
        _set(fx, 'Tint',                  num(params.tint, 0));
        _set(fx, 'Saturation',            num(params.saturation, 0));

        _set(fx, 'Lift R',  lift[0]);  _set(fx, 'Lift G',  lift[1]);  _set(fx, 'Lift B',  lift[2]);  _set(fx, 'Lift Luma',  liftL);
        _set(fx, 'Gamma R', gamma[0]); _set(fx, 'Gamma G', gamma[1]); _set(fx, 'Gamma B', gamma[2]); _set(fx, 'Gamma Luma', gammaL);
        _set(fx, 'Gain R',  gain[0]);  _set(fx, 'Gain G',  gain[1]);  _set(fx, 'Gain B',  gain[2]);  _set(fx, 'Gain Luma',  gainL);

        _set(fx, 'Linear Light',          (params.linearLight === undefined ? true : params.linearLight) ? 1 : 0);
        _set(fx, 'Tonemap',               num(params.tonemap, 2));            // 1 None 2 Soft 3 Filmic
        _set(fx, 'Highlight Compression', num(params.highlightComp, 50));

        // tone curves (Master + per-channel R/G/B) — always pushed so a reset
        // to identity propagates; silent on an older .aex without these params.
        var crv = params.curves || {};
        _pushCurve(fx, 'M', crv.m);
        _pushCurve(fx, 'R', crv.r);
        _pushCurve(fx, 'G', crv.g);
        _pushCurve(fx, 'B', crv.b);

        count++;
      }

      return { success: true, count: count, layer: layers[0].name };
    });
  }

  return { apply: apply };
}());

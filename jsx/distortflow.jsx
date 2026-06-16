// Distort Flow — drives the NATIVE compiled effect (DistortFlow.aex) from the
// CEP panel. Applies ONE effect by match name (DKVB DistortFlow) and pushes the
// panel params onto its controls — same model as jsx/colorlab.jsx + jsx/glow.jsx.
// The warp MATH lives in distort-native/core/; this just sets params.
var DistortFlow = (function () {

  var MATCH = 'DKVB DistortFlow';   // == match name in DistortFlow.cpp registration

  function num(v, d) { return (typeof v === 'number' && !isNaN(v)) ? v : d; }
  // Popups arrive as numbers or numeric strings; AE wants a 1-based index.
  function popup(v, d) { var n = parseInt(v, 10); return (!isNaN(n) && n >= 1) ? n : d; }

  // Reuse an existing Distort Flow on the layer (re-apply = update), else add.
  function _fx(layer) {
    var parade = layer.property('ADBE Effect Parade');
    for (var i = 1; i <= parade.numProperties; i++) {
      var p = parade.property(i);
      if (p && p.matchName === MATCH) return p;
    }
    if (!parade.canAddProperty(MATCH)) {
      throw new Error('Distort Flow plugin not found. Install DistortFlow.aex into the AE Plug-ins folder and relaunch AE.');
    }
    return parade.addProperty(MATCH);
  }

  // Set a native param by its UI display name; silent if missing so an older
  // .aex still applies what it can.
  function _set(fx, name, val) {
    try { var pr = fx.property(name); if (pr) pr.setValue(val); } catch (e) {}
  }

  // Resolve the target layer(s): selected layers (default), a shared "Distort
  // Flow" adjustment layer, or the selected adjustment layers.
  function _targets(comp, mode) {
    var sel = comp.selectedLayers;

    if (mode === 'newAdjustment') {
      var adj = null;
      for (var i = 1; i <= comp.layers.length; i++) {
        if (comp.layers[i].name === 'Distort Flow') { adj = comp.layers[i]; break; }
      }
      if (!adj) {
        adj = comp.layers.addSolid([0, 0, 0], 'Distort Flow', comp.width, comp.height, comp.pixelAspect, comp.duration);
        adj.adjustmentLayer = true;
        adj.moveToBeginning();
      }
      return [adj];
    }

    if (mode === 'selectedAdjustment') {
      var adjs = [];
      if (sel) for (var s = 0; s < sel.length; s++) if (sel[s].adjustmentLayer === true) adjs.push(sel[s]);
      if (adjs.length === 0) throw new Error('Select at least one adjustment layer, or choose New Adjustment Layer.');
      return adjs;
    }

    // selectedLayers (default)
    if (!sel || sel.length === 0) throw new Error('Select one or more layers to apply Distort Flow.');
    return sel;
  }

  function apply(params) {
    return withUndo('Distort Flow', function () {
      var comp = requireComp();
      var layers = _targets(comp, params.dfTargetMode || 'selectedLayers');

      var count = 0, firstName = null;
      for (var li = 0; li < layers.length; li++) {
        var fx = _fx(layers[li]);
        if (!fx) continue;
        if (!firstName) firstName = layers[li].name;

        // map
        _set(fx, 'Map Type',           popup(params.dfMapType, 3));   // 1 Gradient 2 Radial 3 Wave 4 Noise
        _set(fx, 'Angle',              num(params.dfAngle, 0));
        _set(fx, 'Spacing',            num(params.dfSpacing, 4));
        _set(fx, 'Wave Frequency',     num(params.dfWaveFreq, 4));
        _set(fx, 'Wave Phase',         num(params.dfWavePhase, 0));
        _set(fx, 'Noise Scale',        num(params.dfNoiseScale, 3));
        _set(fx, 'Noise Detail',       num(params.dfNoiseDetail, 3));
        _set(fx, 'Noise Seed',         num(params.dfNoiseSeed, 1));
        _set(fx, 'Map Contrast',       num(params.dfContrast, 0));
        // displace
        _set(fx, 'Displace Mode',      popup(params.dfDispMode, 1));  // 1 Fixed 2 Along Gradient 3 Push-Pull
        _set(fx, 'Amount (px)',        num(params.dfAmount, 40));
        // flow
        _set(fx, 'Flow Direction',     popup(params.dfFlowDir, 1));   // 1 Forward 2 Reverse 3 Center-Out 4 Edges-In
        _set(fx, 'Flow Speed (cyc/s)', num(params.dfFlowSpeed, 0));
        _set(fx, 'Loop',               popup(params.dfLoop, 1));      // 1 Loop 2 Ping-Pong 3 Once
        _set(fx, 'Easing',             popup(params.dfEasing, 1));    // 1 Linear..6 Exp
        _set(fx, 'Jitter',             num(params.dfJitter, 0));
        _set(fx, 'Jitter Seed',        num(params.dfJitterSeed, 1));
        _set(fx, 'Phase',              num(params.dfPhase, 0));
        // output
        _set(fx, 'Edges',              popup(params.dfEdge, 3));      // 1 Clamp 2 Wrap 3 Mirror 4 Transparent
        _set(fx, 'Opacity',            num(params.dfOpacity, 100));
        _set(fx, 'Mosaic Block (px)',  num(params.dfMosaic, 0));
        // slats
        _set(fx, 'Rows',          num(params.dfSlatRows, 0));
        _set(fx, 'Columns',       num(params.dfSlatCols, 0));
        _set(fx, 'Slat Stagger',  num(params.dfSlatStagger, 0));

        count++;
      }

      return { success: true, count: count, layer: firstName };
    });
  }

  return { apply: apply };
}());

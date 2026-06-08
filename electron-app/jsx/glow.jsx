// Deep Glow — drives the NATIVE DeepGlowGPU.aex effect via ExtendScript.
// Unlike Color Lab (which wires up AE's built-in effects), this applies our
// own compiled GPU effect by match name and pushes the panel's params onto it.
var DeepGlow = (function () {

  var MATCH = 'DKVB DeepGlowGPU';   // == AE_Effect_Match_Name in DeepGlowGPUPiPL.r

  function apply(params) {
    var comp = requireComp();
    app.beginUndoGroup('Deep Glow');
    try {
      return _apply(comp, params);
    } finally {
      app.endUndoGroup();
    }
  }

  function requireComp() {
    var comp = app.project ? app.project.activeItem : null;
    if (!comp || !(comp instanceof CompItem)) {
      throw new Error('Open a composition first.');
    }
    return comp;
  }

  // Prefer the selected layer; otherwise the topmost enabled layer.
  function _targetLayer(comp) {
    if (comp.selectedLayers && comp.selectedLayers.length) {
      return comp.selectedLayers[0];
    }
    for (var i = 1; i <= comp.layers.length; i++) {
      if (comp.layers[i].enabled) return comp.layers[i];
    }
    if (comp.layers.length) return comp.layers[1];
    throw new Error('Add a layer to the comp first.');
  }

  // Reuse an existing Deep Glow on the layer (so dragging = live update),
  // else add a fresh one. Errors clearly if the .aex isn't installed.
  function _fx(layer) {
    var parade = layer.property('ADBE Effect Parade');
    for (var i = 1; i <= parade.numProperties; i++) {
      var p = parade.property(i);
      if (p && p.matchName === MATCH) return p;
    }
    if (!parade.canAddProperty(MATCH)) {
      throw new Error('Deep Glow plugin not found. Install DeepGlowGPU.aex and relaunch AE.');
    }
    return parade.addProperty(MATCH);
  }

  // Set a param by its UI display name (robust against index shifts). Silent
  // if a name is missing so an older .aex still applies what it can.
  function _set(fx, name, val) {
    try {
      var pr = fx.property(name);
      if (pr) pr.setValue(val);
    } catch (e) {}
  }

  function _num(v, d) { return (typeof v === 'number' && !isNaN(v)) ? v : d; }

  function _apply(comp, params) {
    var layer = _targetLayer(comp);
    var fx    = _fx(layer);

    _set(fx, 'Intensity %',          _num(params.intensity, 150));
    _set(fx, 'Radius (px)',          _num(params.radius, 60));
    _set(fx, 'Threshold',            _num(params.threshold, 80));        // 0..255
    _set(fx, 'Threshold Softness',   _num(params.thresholdSoft, 20));    // 0..100

    // Glow Selection band
    _set(fx, 'Range Mode',           _num(params.rangeMode, 1));         // 1 Lum 2 Sat 3 Hue
    _set(fx, 'Range High',           _num(params.rangeHigh, 255));       // 0..255
    _set(fx, 'Range High Softness',  _num(params.rangeHighSoft, 0));     // 0..100
    _set(fx, 'Invert Range',         params.invertRange ? 1 : 0);

    _set(fx, 'Source Gain %',        _num(params.sourceGain, 100));

    if (params.glowColor && params.glowColor.length >= 3) {
      _set(fx, 'Glow Color', [params.glowColor[0], params.glowColor[1], params.glowColor[2], 1]);
    }
    _set(fx, 'Colorize',             params.colorize ? 1 : 0);
    _set(fx, 'Saturation',           _num(params.saturation, 0));        // -100..100
    _set(fx, 'Hue Shift',            _num(params.hueShift, 0));          // -180..180

    _set(fx, 'Passes',               _num(params.passes, 2));
    _set(fx, 'Falloff',              _num(params.falloff, 2));           // 1 Lin 2 Soft 3 Exp
    _set(fx, 'Blend',                _num(params.blend, 2));             // 1 Add 2 Screen
    _set(fx, 'Glow Dimensions',      _num(params.dimensions, 1));        // 1 Both 2 H 3 V
    _set(fx, 'Glow Only',            params.glowOnly ? 1 : 0);

    _set(fx, 'Linear Light',         params.linearLight ? 1 : 0);
    _set(fx, 'Tonemap',              _num(params.tonemap, 2));           // 1 None 2 Soft 3 Filmic
    _set(fx, 'Highlight Compression',_num(params.highlightComp, 0));     // 0..100

    return { layer: layer.name, effect: 'Deep Glow' };
  }

  return { apply: apply };
}());

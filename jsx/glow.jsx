// Deep Glow — drives the NATIVE compiled GPU effect (DeepGlowGPU.aex) from the
// CEP panel. Earlier versions duplicated layers and stacked AE's built-in
// 'ADBE Glo2' with expressions/a controller null; that stopgap is replaced now
// that the real C++/CUDA effect exists. We just apply the effect by match name
// and push the panel params onto its controls.
var Glow = (function() {

  var MATCH = 'DKVB DeepGlowGPU';   // == AE_Effect_Match_Name in DeepGlowGPUPiPL.r

  // ── panel-string -> native popup index helpers ──────────────
  function falloffIdx(s){ return s === 'linear' ? 1 : s === 'exponential' ? 3 : 2; }      // default Soft
  function blendIdx(s){ return s === 'add' ? 1 : 2; }                                      // native: Add|Screen (default Screen)
  function dimIdx(s){ return s === 'horizontal' ? 2 : s === 'vertical' ? 3 : 1; }          // Both|Horiz|Vert
  function num(v, d){ return (typeof v === 'number' && !isNaN(v)) ? v : d; }

  // Reuse an existing Deep Glow on the layer (so re-apply = live update), else add.
  function _fx(layer) {
    var parade = layer.property('ADBE Effect Parade');
    for (var i = 1; i <= parade.numProperties; i++) {
      var p = parade.property(i);
      if (p && p.matchName === MATCH) return p;
    }
    if (!parade.canAddProperty(MATCH)) {
      throw new Error('Deep Glow plugin not found. Install DeepGlowGPU.aex into the AE Plug-ins folder and relaunch AE.');
    }
    return parade.addProperty(MATCH);
  }

  // Set a native param by its UI display name; silent if a name is missing so an
  // older .aex still applies what it can.
  function _set(fx, name, val) {
    try { var pr = fx.property(name); if (pr) pr.setValue(val); } catch (e) {}
  }

  function apply(params) {
    return withUndo('Deep Glow', function() {
      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply Deep Glow.' };
      }

      // glow color -> [r,g,b,a] 0..1
      var col = hexToRgb(params.glowColor || '#ffffff');
      if (col.length < 4) col = [col[0], col[1], col[2], 1];

      var count = 0;
      for (var li = 0; li < selected.length; li++) {
        var fx = _fx(selected[li]);

        _set(fx, 'Intensity %',           num(params.intensity, 150));
        _set(fx, 'Radius (px)',           num(params.radius, 60));
        _set(fx, 'Threshold',             num(params.threshold, 80));
        _set(fx, 'Threshold Softness',    num(params.thresholdSoftness, 20));

        // Glow Selection band
        _set(fx, 'Range Mode',            num(params.rangeMode, 1));            // 1 Lum 2 Sat 3 Hue
        _set(fx, 'Range High',            num(params.rangeHigh, 255));
        _set(fx, 'Range High Softness',   num(params.rangeHighSoft, 0));
        _set(fx, 'Invert Range',          params.invertRange ? 1 : 0);

        _set(fx, 'Source Gain %',         num(params.sourceGain, 100));
        _set(fx, 'Glow Color',            col);
        _set(fx, 'Colorize',              params.colorize ? 1 : 0);
        _set(fx, 'Saturation',            num(params.saturation, 0));
        _set(fx, 'Hue Shift',             num(params.hueShift, 0));

        _set(fx, 'Passes',                num(params.layers, 2));
        _set(fx, 'Falloff',               falloffIdx(params.falloff || 'soft'));
        _set(fx, 'Blend',                 blendIdx(params.blendMode || 'screen'));
        _set(fx, 'Glow Dimensions',       dimIdx(params.glowDimensions || 'both'));
        _set(fx, 'Glow Only',             params.glowOnly ? 1 : 0);

        _set(fx, 'Linear Light',          (params.linearLight === undefined ? true : params.linearLight) ? 1 : 0);
        _set(fx, 'Tonemap',               num(params.tonemap, 2));              // 1 None 2 Soft 3 Filmic
        _set(fx, 'Highlight Compression', num(params.highlightComp, 0));

        count++;
      }

      return { success: true, count: count };
    });
  }

  // Best-effort render-queue grab of the current frame to `file` (a File).
  // Fallback only — saveFrameToPng is the primary path on AE 2025+. PNG-sequence
  // output appends a frame number, so we locate + rename the produced file.
  function _rqGrab(comp, file) {
    var rqItem = app.project.renderQueue.items.add(comp);
    try {
      rqItem.timeSpanStart    = comp.time;
      rqItem.timeSpanDuration = comp.frameDuration;
      var om = rqItem.outputModule(1);
      try { om.applyTemplate('PNG Sequence'); } catch (e) {}
      om.file = file;
      rqItem.render = true;
      app.project.renderQueue.render();
      if (!file.exists) {
        var base = file.name.replace(/\.png$/i, '');
        var produced = file.parent.getFiles(function (f) {
          return f.name.indexOf(base) === 0 && /\.png$/i.test(f.name);
        });
        if (produced && produced.length) { produced[0].rename(file.name); }
      }
      return file.exists;
    } finally {
      try { rqItem.remove(); } catch (e2) {}
    }
  }

  // Render the active comp's current frame to a temp PNG. Returns { path, width,
  // height } for the panel to load (thumbnail + real histogram + click-to-pick).
  function grabFrame() {
    try {
      var comp = requireComp();
      var tmp = new File(Folder.temp.fsName + '/ae_glow_frame_' +
                         (new Date().getTime()) + '.png');
      var ok = false;
      if (typeof comp.saveFrameToPng === 'function') {
        comp.saveFrameToPng(comp.time, tmp);
        ok = tmp.exists;
      }
      if (!ok) { ok = _rqGrab(comp, tmp); }
      if (!ok) { return { error: 'Could not grab the current frame.' }; }
      return { path: tmp.fsName, width: comp.width, height: comp.height };
    } catch (e) {
      return { error: e.toString() };
    }
  }

  return { apply: apply, grabFrame: grabFrame };
})();

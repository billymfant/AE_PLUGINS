var Distortions = (function() {

  var EFFECT_MAP = {
    'lens':  'ADBE Optics Compensation',
    'warp':  'ADBE Mesh Warp',
    'swirl': 'ADBE Twirl',
    'wave':  'ADBE Wave Warp',
    'bulge': 'ADBE Bulge',
    'pinch': 'ADBE Bulge'
  };

  // ── Target resolution ───────────────────────────────────────────────────────

  function _resolveTargets(comp, params) {
    var mode = params.targetMode || 'selectedLayers';
    var selected = comp.selectedLayers;
    var type = params.distType || 'lens';

    if (mode === 'selectedLayers') {
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply a distortion.' };
      }
      return selected;
    }

    if (mode === 'duplicateLayers') {
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to duplicate.' };
      }
      var dupes = [];
      for (var di = 0; di < selected.length; di++) {
        var src = selected[di];
        var dup = src.duplicate();
        dup.name = src.name + '_' + type;
        dup.moveBefore(src);
        dupes.push(dup);
      }
      return dupes;
    }

    if (mode === 'newAdjustment') {
      var adjName = params.adjustmentName || 'DISTORTION_ADJUSTMENT';
      var adj = comp.layers.addSolid([1, 1, 1], adjName, comp.width, comp.height, comp.pixelAspect, comp.duration);
      adj.adjustmentLayer = true;
      if (selected && selected.length > 0) {
        // Find the top-most selected layer (lowest index)
        var topIdx = selected[0].index;
        for (var ti = 1; ti < selected.length; ti++) {
          if (selected[ti].index < topIdx) { topIdx = selected[ti].index; }
        }
        adj.moveBefore(comp.layer(topIdx));
      } else {
        adj.moveToBeginning();
      }
      return [adj];
    }

    if (mode === 'selectedAdjustment') {
      var adjLayers = [];
      if (selected) {
        for (var si = 0; si < selected.length; si++) {
          if (selected[si].adjustmentLayer === true) {
            adjLayers.push(selected[si]);
          }
        }
      }
      if (adjLayers.length === 0) {
        return { error: 'Select at least one adjustment layer, or choose New Adjustment Layer.' };
      }
      return adjLayers;
    }

    if (mode === 'precompAdjustment') {
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to precompose.' };
      }
      var indices = [];
      var topPrecompIdx = selected[0].index;
      for (var pi = 0; pi < selected.length; pi++) {
        indices.push(selected[pi].index);
        if (selected[pi].index < topPrecompIdx) { topPrecompIdx = selected[pi].index; }
      }
      var precompName = (params.adjustmentName || 'DISTORTION_ADJUSTMENT') + '_Distort';
      comp.layers.precompose(indices, precompName, true);
      // After precompose the new precomp layer sits at topPrecompIdx
      var precompLayer = comp.layer(topPrecompIdx);
      var pcAdj = comp.layers.addSolid([1, 1, 1], params.adjustmentName || 'DISTORTION_ADJUSTMENT', comp.width, comp.height, comp.pixelAspect, comp.duration);
      pcAdj.adjustmentLayer = true;
      pcAdj.moveBefore(precompLayer);
      return [pcAdj];
    }

    // Fallback: treat as selectedLayers
    if (!selected || selected.length === 0) {
      return { error: 'Select one or more layers to apply a distortion.' };
    }
    return selected;
  }

  // ── Main apply ──────────────────────────────────────────────────────────────

  function apply(params) {
    return withUndo('Distortions Suite', function() {
      var comp = requireComp();
      var type = params.distType || 'lens';
      var effectId = EFFECT_MAP[type];
      if (!effectId) return { error: 'Unknown distortion type: ' + type };

      var feather = params.feather || 0;
      var opacity = params.blendOpacity || 100;

      var targets = _resolveTargets(comp, params);
      // _resolveTargets may return an error object
      if (targets && targets.error) { return targets; }
      if (!targets || targets.length === 0) {
        return { error: 'No target layers resolved.' };
      }

      var count = 0;

      for (var li = 0; li < targets.length; li++) {
        var target = targets[li];
        try {
          var fx = target.property('ADBE Effect Parade').addProperty(effectId);
          if (!fx) { count++; continue; }

          _configureEffect(fx, type, params, comp);

          if (feather > 0) {
            _applyCircularMask(target, params, comp);
          }

          if (opacity !== 100) { target.property('ADBE Opacity').setValue(opacity); }

          if (params.animateEnabled) {
            _animatePrimary(fx, type, params, comp);
          }

          count++;
        } catch(e) {
          // Effect not installed or property missing — skip gracefully
        }
      }

      return { success: true, count: count };
    });
  }

  // ── Configure static effect properties (unchanged) ──────────────────────────

  function _configureEffect(fx, type, params, comp) {
    var intensity = params.intensity  || 50;
    var radius    = params.radius     || 200;
    var cx        = (params.centerX   !== undefined ? params.centerX : 0.5) * comp.width;
    var cy        = (params.centerY   !== undefined ? params.centerY : 0.5) * comp.height;

    if (type === 'lens') {
      try { fx.property('ADBE Optics Compensation-0001').setValue(intensity); } catch(e) {}
      try { fx.property('ADBE Optics Compensation-0002').setValue(1); }        catch(e) {}
    }
    else if (type === 'warp') {
      try { fx.property('ADBE Mesh Warp-0001').setValue(params.meshResX || 5); } catch(e) {}
      try { fx.property('ADBE Mesh Warp-0002').setValue(params.meshResY || 5); } catch(e) {}
    }
    else if (type === 'swirl') {
      try { fx.property('ADBE Twirl-0001').setValue(params.swirlAngle || 90); } catch(e) {}
      try { fx.property('ADBE Twirl-0002').setValue([cx, cy]); }               catch(e) {}
      try { fx.property('ADBE Twirl-0003').setValue(radius); }                 catch(e) {}
    }
    else if (type === 'wave') {
      try { fx.property('ADBE Wave Warp-0001').setValue(1); }                             catch(e) {}
      try { fx.property('ADBE Wave Warp-0002').setValue(params.amplitude || 20); }        catch(e) {}
      try { fx.property('ADBE Wave Warp-0003').setValue(params.frequency || 5); }         catch(e) {}
      try { fx.property('ADBE Wave Warp-0004').setValue(0); }                             catch(e) {}
      try { fx.property('ADBE Wave Warp-0005').setValue(params.waveSpeed || 1); }         catch(e) {}
    }
    else if (type === 'bulge') {
      try { fx.property('ADBE Bulge-0001').setValue([cx, cy]); }               catch(e) {}
      try { fx.property('ADBE Bulge-0002').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0003').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0004').setValue(intensity / 100); }        catch(e) {}
    }
    else if (type === 'pinch') {
      try { fx.property('ADBE Bulge-0001').setValue([cx, cy]); }               catch(e) {}
      try { fx.property('ADBE Bulge-0002').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0003').setValue(radius); }                 catch(e) {}
      try { fx.property('ADBE Bulge-0004').setValue(-(intensity / 100)); }     catch(e) {}
    }
  }

  // ── Circular feather mask (replaces the old rectangular mask) ───────────────

  function _applyCircularMask(layer, params, comp) {
    try {
      var cx      = (params.centerX !== undefined ? params.centerX : 0.5) * comp.width;
      var cy      = (params.centerY !== undefined ? params.centerY : 0.5) * comp.height;
      var r       = params.radius   || 200;
      var feather = params.feather  || 0;
      // Bezier approximation constant for a circle via 4 cubic segments
      var k = r * 0.5522847498;

      var mask  = layer.mask.addProperty('ADBE Mask Atom');
      var shape = new Shape();
      // 4 cardinal vertices: top, right, bottom, left
      shape.vertices = [
        [cx,     cy - r],
        [cx + r, cy    ],
        [cx,     cy + r],
        [cx - r, cy    ]
      ];
      shape.inTangents = [
        [-k, 0],
        [0, -k],
        [k,  0],
        [0,  k]
      ];
      shape.outTangents = [
        [k,  0],
        [0,  k],
        [-k, 0],
        [0, -k]
      ];
      shape.closed = true;
      mask.property('ADBE Mask Shape').setValue(shape);
      mask.property('ADBE Mask Feather').setValue([feather, feather]);
      mask.property('ADBE Mask Mode').setValue(MaskMode.ADD);
    } catch(e) {}
  }

  // ── Animation ───────────────────────────────────────────────────────────────

  function _animatePrimary(fx, type, params, comp) {
    // warp (Mesh Warp) has no suitable scalar primary — skip gracefully
    if (type === 'warp') { return; }

    var propId, base;
    if (type === 'lens') {
      propId = 'ADBE Optics Compensation-0001';
      base   = params.intensity || 50;
    } else if (type === 'swirl') {
      propId = 'ADBE Twirl-0001';
      base   = params.swirlAngle || 90;
    } else if (type === 'wave') {
      propId = 'ADBE Wave Warp-0002';
      base   = params.amplitude || 20;
    } else if (type === 'bulge') {
      propId = 'ADBE Bulge-0004';
      base   = (params.intensity || 50) / 100;
    } else if (type === 'pinch') {
      propId = 'ADBE Bulge-0004';
      base   = -((params.intensity || 50) / 100);
    } else {
      return;
    }

    try {
      var prop     = fx.property(propId);
      var mode     = params.animationMode   || 'loop';
      var duration = params.animDuration    || 2.0;
      var speed    = params.animSpeed       || 1.0;
      var amount   = params.animAmount      || 25;
      var seed     = params.randomSeed      || 1;
      var output   = params.animationOutput || 'expressions';

      if (output === 'expressions') {
        var expr = '';
        expr += 'base = ' + base + ';\n';
        expr += 'amount = ' + amount + ';\n';
        expr += 'duration = ' + duration + ';\n';
        expr += 'speed = ' + speed + ';\n';
        expr += 'seed = ' + seed + ';\n';

        if (mode === 'loop') {
          expr += 't = ((time - inPoint) * speed / duration) * Math.PI * 2;\n';
          expr += 'base + Math.sin(t) * amount;';
        } else if (mode === 'pingpong') {
          expr += 't = ((time - inPoint) * speed) % duration;\n';
          expr += 'p = t / duration;\n';
          expr += 'base + Math.sin(p * Math.PI) * amount;';
        } else if (mode === 'drift') {
          expr += 'seedRandom(seed, true);\n';
          expr += 'base + noise(time * speed) * amount;';
        } else if (mode === 'pulse') {
          expr += 't = ((time - inPoint) * speed / duration) * Math.PI * 2;\n';
          expr += 'base + Math.pow((Math.sin(t) + 1) / 2, 3) * amount;';
        }

        prop.expression = expr;

      } else {
        // Keyframes — bake 5 over animDuration using loop pattern
        var t0 = comp.time;
        prop.setValueAtTime(t0,                    base);
        prop.setValueAtTime(t0 + duration * 0.25,  base + amount);
        prop.setValueAtTime(t0 + duration * 0.5,   base);
        prop.setValueAtTime(t0 + duration * 0.75,  base - amount);
        prop.setValueAtTime(t0 + duration,         base);
      }
    } catch(e) {}
  }

  return { apply: apply };
})();

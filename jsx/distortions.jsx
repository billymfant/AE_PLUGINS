var Distortions = (function() {

  var EFFECT_MAP = {
    'lens':  'ADBE Optics Compensation',
    'warp':  'ADBE Mesh Warp',
    'swirl': 'ADBE Twirl',
    'wave':  'ADBE Wave Warp',
    'bulge': 'ADBE Bulge',
    'pinch': 'ADBE Bulge'
  };

  function apply(params) {
    return withUndo('Distortions Suite', function() {
      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select one or more layers to apply a distortion.' };
      }

      var type    = params.distType     || 'lens';
      var feather = params.feather      || 0;
      var opacity = params.blendOpacity || 100;
      var effectId = EFFECT_MAP[type];
      if (!effectId) return { error: 'Unknown distortion type: ' + type };

      var count = 0;

      for (var li = 0; li < selected.length; li++) {
        var src = selected[li];
        try {
          var target;

          if (feather > 0) {
            // Non-destructive: apply to duplicate so feather mask blends with original
            target = src.duplicate();
            target.name = src.name + '_' + type;
            target.moveBefore(src);
          } else {
            target = src;
          }

          var fx = target.property('ADBE Effect Parade').addProperty(effectId);
          if (!fx) { count++; continue; }

          _configureEffect(fx, type, params, comp);

          if (feather > 0) {
            _applyFeatherMask(target, feather, comp.width, comp.height);
          }

          if (opacity !== 100) target.property('ADBE Opacity').setValue(opacity);

          count++;
        } catch(e) {
          // Effect not installed — skip gracefully
        }
      }

      return { success: true, count: count };
    });
  }

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

  // Rectangular mask with feather applied to a layer
  function _applyFeatherMask(layer, feather, compW, compH) {
    try {
      var mask  = layer.mask.addProperty('ADBE Mask Atom');
      var shape = new Shape();
      var pad   = feather * 0.5;
      shape.vertices    = [[pad, pad], [compW - pad, pad], [compW - pad, compH - pad], [pad, compH - pad]];
      shape.inTangents  = [[0,0],[0,0],[0,0],[0,0]];
      shape.outTangents = [[0,0],[0,0],[0,0],[0,0]];
      shape.closed = true;
      mask.property('ADBE Mask Shape').setValue(shape);
      mask.property('ADBE Mask Feather').setValue([feather, feather]);
      mask.property('ADBE Mask Mode').setValue(MaskMode.ADD);
    } catch(e) {}
  }

  return { apply: apply };
})();

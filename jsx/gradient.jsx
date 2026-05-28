// Gradient Studio — creates gradient layers using AE built-in effects.
var GradientStudio = (function () {

  function apply(params) {
    var comp = requireComp();
    return withUndo('Gradient Studio', function () {
      return _create(comp, params);
    });
  }

  function _create(comp, params) {
    var w = comp.width, h = comp.height;
    var type = params.gradientType || 'linear';

    if (type === 'linear' || type === 'radial') return _rampGradient(comp, w, h, params);
    if (type === 'conical') return _conicalGradient(comp, w, h, params);
    if (type === 'mesh')    return _meshGradient(comp, w, h, params);
    if (type === 'noise')   return _noiseGradient(comp, w, h, params);
    return { error: 'Unknown gradient type: ' + type };
  }

  // ── Linear / Radial ─────────────────────────────────────────
  function _rampGradient(comp, w, h, params) {
    var solid = comp.layers.addSolid(
      [0, 0, 0], 'Gradient — ' + params.gradientType, w, h, comp.pixelAspect
    );
    solid.moveToBeginning();

    var ramp = solid.property('ADBE Effect Parade').addProperty('ADBE Ramp');
    ramp.property('ADBE Ramp Start').setValue([w * (params.startX / 100), h * (params.startY / 100)]);
    ramp.property('ADBE Ramp End').setValue([w * (params.endX / 100), h * (params.endY / 100)]);
    ramp.property('ADBE Ramp Start Color').setValue(_hex(params.colorStart));
    ramp.property('ADBE Ramp End Color').setValue(_hex(params.colorEnd));
    ramp.property('ADBE Ramp Shape').setValue(params.gradientType === 'radial' ? 2 : 1);
    ramp.property('ADBE Ramp Scatter').setValue(params.scatter || 0);

    if (params.blendMode && params.blendMode !== 'normal') {
      solid.blendingMode = _blendMode(params.blendMode);
    }
    return { type: params.gradientType, layer: solid.name };
  }

  // ── Conical ──────────────────────────────────────────────────
  // Simulated by N pie-segment shape layers, each a different hue slice.
  function _conicalGradient(comp, w, h, params) {
    var cx       = w * (params.centerX / 100);
    var cy       = h * (params.centerY / 100);
    var segments = params.segments || 16;
    var r        = Math.sqrt(w * w + h * h);

    var container = comp.layers.addNull();
    container.name = 'Gradient — Conical';
    container.moveToBeginning();

    for (var i = 0; i < segments; i++) {
      var t          = i / segments;
      var startAngle = t * 360;
      var endAngle   = ((i + 1) / segments) * 360;
      var color      = _lerpColor(params.colorStart, params.colorEnd, t);

      var shapeLayer = comp.layers.addShape();
      shapeLayer.name   = 'Seg ' + (i + 1);
      shapeLayer.parent = container;

      var contents  = shapeLayer.property('ADBE Root Vectors Group');
      var grp       = contents.addProperty('ADBE Vector Group');
      var grpC      = grp.property('ADBE Vectors Group');
      var shapeProp = grpC.addProperty('ADBE Vector Shape - Group');
      var fill      = grpC.addProperty('ADBE Vector Graphic - Fill');
      fill.property('ADBE Vector Fill Color').setValue(color);

      // Pie wedge as closed polyline
      var shape  = new Shape();
      shape.closed = true;
      var verts = [[cx, cy]];
      var steps = 6;
      for (var s = 0; s <= steps; s++) {
        var ang = (startAngle + (endAngle - startAngle) * (s / steps)) * Math.PI / 180;
        verts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
      }
      shape.vertices    = verts;
      shape.inTangents  = _zeroTangents(verts.length);
      shape.outTangents = _zeroTangents(verts.length);
      shapeProp.property('ADBE Vector Shape').setValue(shape);
    }

    if (params.blendMode && params.blendMode !== 'normal') {
      container.blendingMode = _blendMode(params.blendMode);
    }
    return { type: 'conical', segments: segments };
  }

  // ── Mesh ─────────────────────────────────────────────────────
  // Blurred colored solids at control points, blended with ADD mode.
  function _meshGradient(comp, w, h, params) {
    var stops = params.meshStops || [
      { x: 20, y: 20, color: params.colorStart || '#ff0080' },
      { x: 80, y: 20, color: '#0080ff' },
      { x: 50, y: 80, color: params.colorEnd   || '#00ff80' }
    ];
    var blurRadius = params.meshBlur || Math.round(Math.min(w, h) * 0.35);

    var container = comp.layers.addNull();
    container.name = 'Gradient — Mesh';
    container.moveToBeginning();

    var bg = comp.layers.addSolid([0, 0, 0], 'Mesh BG', w, h, comp.pixelAspect);
    bg.parent = container;

    for (var i = 0; i < stops.length; i++) {
      var stop = stops[i];
      var rgb  = _hex(stop.color);
      var sz   = Math.round(Math.min(w, h) * 0.6);

      var solid = comp.layers.addSolid([rgb[0], rgb[1], rgb[2]], 'Stop ' + (i + 1), sz, sz, comp.pixelAspect);
      solid.position.setValue([w * (stop.x / 100), h * (stop.y / 100)]);
      solid.blendingMode = BlendingMode.ADD;
      solid.parent = container;

      var blur = solid.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2');
      blur.property('ADBE Gaussian Blur 2-0001').setValue(blurRadius);
      blur.property('ADBE Gaussian Blur 2-0003').setValue(true);
    }
    return { type: 'mesh', stops: stops.length };
  }

  // ── Noise ────────────────────────────────────────────────────
  function _noiseGradient(comp, w, h, params) {
    var solid = comp.layers.addSolid([0, 0, 0], 'Gradient — Noise', w, h, comp.pixelAspect);
    solid.moveToBeginning();
    var fx = solid.property('ADBE Effect Parade');

    var fractal = fx.addProperty('ADBE Fractal Noise');
    fractal.property('ADBE Fractal Noise-0001').setValue(params.noiseType === 'turbulent' ? 4 : 1);
    fractal.property('ADBE Fractal Noise-0004').setValue(params.noiseScale || 250);
    fractal.property('ADBE Fractal Noise-0007').setValue(params.noiseComplexity || 3);
    fractal.property('ADBE Fractal Noise-0013').setValue([w / 2, h / 2]);

    if (params.colorize) {
      var tint = fx.addProperty('ADBE Tint');
      tint.property('ADBE Tint-0002').setValue(_hex(params.colorStart || '#000000'));
      tint.property('ADBE Tint-0003').setValue(_hex(params.colorEnd   || '#ffffff'));
      tint.property('ADBE Tint-0004').setValue(100);
    }

    if (params.blendMode && params.blendMode !== 'normal') {
      solid.blendingMode = _blendMode(params.blendMode);
    }
    return { type: 'noise', layer: solid.name };
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _hex(hex) {
    if (!hex || hex.length < 7) return [0, 0, 0, 1];
    return [parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255, 1];
  }

  function _lerpColor(hexA, hexB, t) {
    var a = _hex(hexA), b = _hex(hexB);
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, 1];
  }

  function _zeroTangents(n) {
    var t = [];
    for (var i = 0; i < n; i++) t.push([0, 0]);
    return t;
  }

  function _blendMode(name) {
    var m = { add: BlendingMode.ADD, screen: BlendingMode.SCREEN, multiply: BlendingMode.MULTIPLY, overlay: BlendingMode.OVERLAY, soft: BlendingMode.SOFT_LIGHT };
    return m[name] || BlendingMode.NORMAL;
  }

  return { apply: apply };
}());

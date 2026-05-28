// Pattern Pro — L-Systems + spirograph generator outputting AE shape layers.
var Patterns = (function () {

  function generate(params) {
    var comp = requireComp();
    return withUndo('Pattern Pro', function () {
      if (params.patternType === 'lsystem')    return _lsystemGenerate(comp, params);
      if (params.patternType === 'spirograph') return _spirographGenerate(comp, params);
      return { error: 'Unknown patternType: ' + params.patternType };
    });
  }

  // ── L-System ──────────────────────────────────────────────────

  var PRESETS = {
    'Koch Snowflake':      { axiom: 'F--F--F',  rules: { F: 'F+F--F+F' },                          angle: 60  },
    'Dragon Curve':        { axiom: 'FX',        rules: { X: 'X+YF+', Y: '-FX-Y' },                angle: 90  },
    'Sierpinski Triangle': { axiom: 'F-G-G',     rules: { F: 'F-G+F+G-F', G: 'GG' },               angle: 120 },
    'Plant':               { axiom: 'X',         rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },       angle: 25  },
    'Hilbert Curve':       { axiom: 'A',         rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' },     angle: 90  },
    'Levy C Curve':        { axiom: 'F',         rules: { F: '+F--F+' },                            angle: 45  },
    'Gosper Curve':        { axiom: 'XF',        rules: { X: 'X+YF++YF-FX--FXFX-YF+', Y: '-FX+YFYF++YF+FX--FX-Y' }, angle: 60 }
  };

  function _lsystemExpand(axiom, rules, iterations) {
    var str = axiom;
    for (var iter = 0; iter < Math.min(iterations, 8); iter++) {
      var next = '';
      for (var j = 0; j < str.length && str.length < 200000; j++) {
        var c = str[j];
        next += (rules[c] !== undefined) ? rules[c] : c;
      }
      str = next;
    }
    return str;
  }

  function _turtleWalk(lstring, angle, stepLen) {
    var x = 0, y = 0, dir = -90;
    var stack = [];
    var segments = [];
    var cur = [[x, y]];
    var limit = Math.min(lstring.length, 80000);

    for (var i = 0; i < limit; i++) {
      var c = lstring[i];
      if (c === 'F' || c === 'G') {
        var rad = dir * Math.PI / 180;
        x += stepLen * Math.cos(rad);
        y += stepLen * Math.sin(rad);
        cur.push([x, y]);
      } else if (c === 'f') {
        var rad2 = dir * Math.PI / 180;
        x += stepLen * Math.cos(rad2);
        y += stepLen * Math.sin(rad2);
        if (cur.length > 1) segments.push(cur);
        cur = [[x, y]];
      } else if (c === '+') {
        dir += angle;
      } else if (c === '-') {
        dir -= angle;
      } else if (c === '[') {
        stack.push({ x: x, y: y, dir: dir, cur: cur });
        cur = [[x, y]];
      } else if (c === ']') {
        if (cur.length > 1) segments.push(cur);
        var state = stack.pop();
        x = state.x; y = state.y; dir = state.dir; cur = state.cur;
      }
    }
    if (cur.length > 1) segments.push(cur);
    return segments;
  }

  function _lsystemGenerate(comp, params) {
    var preset  = PRESETS[params.preset] || PRESETS['Koch Snowflake'];
    var rules   = params.customRules || preset.rules;
    var axiom   = params.customAxiom || preset.axiom;
    var angle   = (params.angle !== undefined) ? params.angle : preset.angle;
    var lstring = _lsystemExpand(axiom, rules, params.iterations || 4);
    var segs    = _turtleWalk(lstring, angle, 10);

    if (segs.length === 0) return { error: 'No segments generated. Check axiom/rules.' };
    var layer = _segmentsToShapeLayer(comp, segs, params, 'L-System — ' + (params.preset || 'Custom'));
    _addTrimPaths(layer, params);
    return { segments: segs.length, chars: lstring.length, layer: layer.name };
  }

  // ── Spirograph ────────────────────────────────────────────────
  function _spirographGenerate(comp, params) {
    var R     = params.outerRadius || 100;
    var r     = params.innerRadius || 40;
    var d     = params.penRadius   || 60;
    var steps = Math.max(params.steps || 720, 180);
    var revs  = _lcm(Math.abs(Math.round(R)), Math.abs(Math.round(r))) / Math.abs(Math.round(r));

    var points = [];
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * 2 * Math.PI * revs;
      points.push([
        (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t),
        (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t)
      ]);
    }
    var layer = _pointsToShapeLayer(comp, points, params, 'Spirograph');
    _addTrimPaths(layer, params);
    return { points: points.length, layer: layer.name };
  }

  // ── Shape layer builders ──────────────────────────────────────

  function _segmentsToShapeLayer(comp, segments, params, name) {
    var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (var i=0; i<segments.length; i++) {
      for (var j=0; j<segments[i].length; j++) {
        var p=segments[i][j];
        if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
        if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
      }
    }
    var bw=maxX-minX||1, bh=maxY-minY||1;
    var cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    var targetSize = params.size || Math.min(comp.width,comp.height)*0.85;
    var scale = targetSize/Math.max(bw,bh);

    var sl = comp.layers.addShape();
    sl.name = name; sl.moveToBeginning();
    var contents = sl.property('ADBE Root Vectors Group');
    var maxSegs = Math.min(segments.length, 500);

    for (var s=0; s<maxSegs; s++) {
      var seg = segments[s];
      if (seg.length < 2) continue;
      var grp = contents.addProperty('ADBE Vector Group');
      var grpC = grp.property('ADBE Vectors Group');
      var shapeProp = grpC.addProperty('ADBE Vector Shape - Group');

      var shape = new Shape();
      shape.closed = false;
      var verts=[],inT=[],outT=[];
      for (var p=0; p<seg.length; p++) {
        verts.push([(seg[p][0]-cx)*scale,(seg[p][1]-cy)*scale]);
        inT.push([0,0]); outT.push([0,0]);
      }
      shape.vertices=verts; shape.inTangents=inT; shape.outTangents=outT;
      shapeProp.property('ADBE Vector Shape').setValue(shape);

      var stroke = grpC.addProperty('ADBE Vector Graphic - Stroke');
      stroke.property('ADBE Vector Stroke Color').setValue(_hex(params.color||'#4d9fff'));
      stroke.property('ADBE Vector Stroke Width').setValue(params.strokeWidth||1.5);
      stroke.property('ADBE Vector Stroke Line Cap').setValue(2);
    }
    return sl;
  }

  function _pointsToShapeLayer(comp, points, params, name) {
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(var i=0;i<points.length;i++){
      if(points[i][0]<minX)minX=points[i][0]; if(points[i][0]>maxX)maxX=points[i][0];
      if(points[i][1]<minY)minY=points[i][1]; if(points[i][1]>maxY)maxY=points[i][1];
    }
    var bw=maxX-minX||1,bh=maxY-minY||1,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    var targetSize=params.size||Math.min(comp.width,comp.height)*0.85;
    var scale=targetSize/Math.max(bw,bh);

    var sl=comp.layers.addShape(); sl.name=name; sl.moveToBeginning();
    var contents=sl.property('ADBE Root Vectors Group');
    var grp=contents.addProperty('ADBE Vector Group');
    var grpC=grp.property('ADBE Vectors Group');
    var shapeProp=grpC.addProperty('ADBE Vector Shape - Group');

    var shape=new Shape(); shape.closed=true;
    var verts=[],inT=[],outT=[];
    for(var j=0;j<points.length;j++){
      verts.push([(points[j][0]-cx)*scale,(points[j][1]-cy)*scale]);
      inT.push([0,0]); outT.push([0,0]);
    }
    shape.vertices=verts; shape.inTangents=inT; shape.outTangents=outT;
    shapeProp.property('ADBE Vector Shape').setValue(shape);

    var stroke=grpC.addProperty('ADBE Vector Graphic - Stroke');
    stroke.property('ADBE Vector Stroke Color').setValue(_hex(params.color||'#4d9fff'));
    stroke.property('ADBE Vector Stroke Width').setValue(params.strokeWidth||1.5);
    stroke.property('ADBE Vector Stroke Line Cap').setValue(2);
    return sl;
  }

  function _addTrimPaths(layer, params) {
    if (!params.animType || params.animType === 'none') return;
    var comp = layer.containingComp;
    var trim = layer.property('ADBE Root Vectors Group').addProperty('ADBE Vector Filter - Trim');
    var dur  = params.animDuration || 2;
    trim.property('ADBE Vector Trim End').setValueAtTime(comp.workAreaStart, 0);
    trim.property('ADBE Vector Trim End').setValueAtTime(comp.workAreaStart + dur, 100);
    var ep = trim.property('ADBE Vector Trim End');
    ep.setTemporalEaseAtKey(1, [new KeyframeEase(0, 66)], [new KeyframeEase(0, 66)]);
    ep.setTemporalEaseAtKey(2, [new KeyframeEase(0, 66)], [new KeyframeEase(0, 66)]);
  }

  function _gcd(a,b){ return b===0?a:_gcd(b,a%b); }
  function _lcm(a,b){ return (a*b)/_gcd(a,b); }
  function _hex(hex){
    if(!hex||hex.length<7)return[0.3,0.6,1,1];
    return[parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255,1];
  }

  return { generate: generate };
}());

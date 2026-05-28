// Physics Rig — Verlet simulation with body types, magnetism, constraints, contact export.
// Body type convention: prefix layer name with [static], [kinematic], or [dormant].
// Per-body overrides: set layer comment to "density:1.5,friction:0.3,bounce:0.8"
var PhysicsRig = (function () {

  function simulate(params) {
    var comp = requireComp();
    return withUndo('Physics Rig', function () {
      return _run(comp, params);
    });
  }

  function _run(comp, params) {
    var layers = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      if (comp.layers[i].selected) layers.push(comp.layers[i]);
    }
    if (layers.length === 0) {
      return { error: 'Select the layers to simulate, then click Simulate.' };
    }

    var fps         = comp.frameRate;
    var startTime   = comp.workAreaStart;
    var duration    = params.duration || (comp.workAreaDuration || 3);
    var totalFrames = Math.round(duration * fps);
    var dt          = 1 / fps;
    var w           = comp.width;
    var h           = comp.height;

    // Global physics params
    var gx         = params.gravityX    || 0;
    var gy         = params.gravityY    || 980;
    var bounce     = params.bounce      || 0.55;
    var friction   = 1 - (params.friction       || 0.01);
    var groundFric = 1 - (params.groundFriction || 0.15);
    var groundY    = (params.groundY !== undefined && params.groundY >= 0) ? params.groundY : h * 0.92;
    var wallBounce = params.wallBounce  || false;
    var magnetism  = params.magnetism   || false;
    var magType    = params.magnetismType || 'attract'; // attract | repulse
    var magStr     = params.magnetismStrength || 200;
    var magRange   = params.magnetismRange    || 400;
    var gravScale  = params.gravityScale      || 1;
    var exportContacts = params.exportContacts || false;

    // Build body list
    var bodies = [];
    for (var l = 0; l < layers.length; l++) {
      var layer   = layers[l];
      var pos     = layer.position.valueAtTime(startTime, false);
      var lw      = (layer.sourceRectAtTime ? layer.sourceRectAtTime(startTime, false).width  : 100) * (layer.scale.value[0] / 100);
      var lh      = (layer.sourceRectAtTime ? layer.sourceRectAtTime(startTime, false).height : 100) * (layer.scale.value[1] / 100);

      // Parse body type from layer name prefix
      var layerName = layer.name;
      var bodyType  = 'dynamic';
      if (layerName.indexOf('[static]') === 0)    bodyType = 'static';
      else if (layerName.indexOf('[kinematic]') === 0) bodyType = 'kinematic';
      else if (layerName.indexOf('[dormant]') === 0)   bodyType = 'dormant';

      // Parse per-body overrides from layer comment
      var bodyBounce   = bounce;
      var bodyFriction = 1 - (params.friction || 0.01);
      var bodyDensity  = params.mass || 1;
      var bodyGravScale = gravScale;
      try {
        var comment = layer.comment || '';
        if (comment) {
          var pairs = comment.split(',');
          for (var q = 0; q < pairs.length; q++) {
            var kv = pairs[q].split(':');
            if (kv.length === 2) {
              var key = kv[0].replace(/\s/g,'');
              var val = parseFloat(kv[1]);
              if (key === 'density')    bodyDensity  = val;
              else if (key === 'friction') bodyFriction = 1 - val;
              else if (key === 'bounce')   bodyBounce   = val;
              else if (key === 'gravscale') bodyGravScale = val;
            }
          }
        }
      } catch(e) {}

      bodies.push({
        layer:      layer,
        x:          pos[0],
        y:          pos[1],
        vx:         params.initialVelX || 0,
        vy:         params.initialVelY || 0,
        mass:       bodyDensity,
        rx:         lw / 2,
        ry:         lh / 2,
        angle:      0,
        omega:      0,
        bodyType:   bodyType,
        bounce:     bodyBounce,
        friction:   bodyFriction,
        gravScale:  bodyGravScale,
        awake:      bodyType !== 'dormant', // dormant starts asleep
        contacts:   []
      });
    }

    // Parse constraint pairs from params
    var constraints = params.constraints || [];

    // Simulation loop
    for (var frame = 0; frame <= totalFrames; frame++) {
      var t = startTime + frame * dt;

      // ── Forces ────────────────────────────────────────────
      for (var b = 0; b < bodies.length; b++) {
        var body = bodies[b];
        if (body.bodyType === 'static') continue;
        if (!body.awake) continue;

        var bGx = gx * body.gravScale;
        var bGy = gy * body.gravScale;

        body.vx += bGx * dt;
        body.vy += bGy * dt;

        body.vx *= body.friction;
        body.vy *= body.friction;

        body.x += body.vx * dt;
        body.y += body.vy * dt;

        body.omega *= 0.98;
        body.angle += body.omega * dt;

        // ── Ground collision ────────────────────────────────
        if (body.y + body.ry >= groundY) {
          body.y   = groundY - body.ry;
          body.vy  = -Math.abs(body.vy) * body.bounce;
          body.vx *= groundFric;
          body.omega += body.vx * 0.005;
          if (Math.abs(body.vy) < 5) body.vy = 0;
          if (exportContacts) body.contacts.push(t);
        }

        // ── Wall collisions ─────────────────────────────────
        if (wallBounce) {
          if (body.x - body.rx < 0) {
            body.x  = body.rx;
            body.vx = Math.abs(body.vx) * body.bounce;
            body.omega -= body.vy * 0.003;
            if (exportContacts) body.contacts.push(t);
          }
          if (body.x + body.rx > w) {
            body.x  = w - body.rx;
            body.vx = -Math.abs(body.vx) * body.bounce;
            body.omega += body.vy * 0.003;
            if (exportContacts) body.contacts.push(t);
          }
          if (body.y - body.ry < 0) {
            body.y  = body.ry;
            body.vy = Math.abs(body.vy) * body.bounce;
            if (exportContacts) body.contacts.push(t);
          }
        }
      }

      // ── Body-body AABB collisions ─────────────────────────
      for (var a = 0; a < bodies.length - 1; a++) {
        for (var c = a + 1; c < bodies.length; c++) {
          var ba = bodies[a], bc = bodies[c];
          if (!ba.awake && !bc.awake) continue;
          if (ba.bodyType === 'static' && bc.bodyType === 'static') continue;

          // Wake dormant bodies on collision
          if (ba.bodyType === 'dormant') ba.awake = true;
          if (bc.bodyType === 'dormant') bc.awake = true;

          var dx = bc.x - ba.x, dy = bc.y - ba.y;
          var overlapX = (ba.rx + bc.rx) - Math.abs(dx);
          var overlapY = (ba.ry + bc.ry) - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            var totalMass = ba.mass + bc.mass;
            var ratioA = bc.mass / totalMass;
            var ratioB = ba.mass / totalMass;
            var avgBounce = (ba.bounce + bc.bounce) * 0.5;

            if (overlapX < overlapY) {
              var sepX = overlapX * (dx > 0 ? 1 : -1);
              if (ba.bodyType !== 'static') ba.x -= sepX * ratioA;
              if (bc.bodyType !== 'static') bc.x += sepX * ratioB;
              var rv = ba.vx - bc.vx;
              if (ba.bodyType !== 'static') ba.vx -= rv * avgBounce * ratioA;
              if (bc.bodyType !== 'static') bc.vx += rv * avgBounce * ratioB;
            } else {
              var sepY = overlapY * (dy > 0 ? 1 : -1);
              if (ba.bodyType !== 'static') ba.y -= sepY * ratioA;
              if (bc.bodyType !== 'static') bc.y += sepY * ratioB;
              var rvy = ba.vy - bc.vy;
              if (ba.bodyType !== 'static') ba.vy -= rvy * avgBounce * ratioA;
              if (bc.bodyType !== 'static') bc.vy += rvy * avgBounce * ratioB;
            }
            if (exportContacts) {
              ba.contacts.push(t);
              bc.contacts.push(t);
            }
          }
        }
      }

      // ── Magnetism ─────────────────────────────────────────
      if (magnetism && bodies.length > 1) {
        for (var ma = 0; ma < bodies.length - 1; ma++) {
          for (var mb = ma + 1; mb < bodies.length; mb++) {
            var bodyA = bodies[ma], bodyB = bodies[mb];
            if (!bodyA.awake || !bodyB.awake) continue;
            var mdx = bodyB.x - bodyA.x, mdy = bodyB.y - bodyA.y;
            var dist = Math.sqrt(mdx*mdx + mdy*mdy) || 1;
            if (dist > magRange) continue;

            var force = (magStr / (dist * dist)) * dt;
            var fx = (mdx / dist) * force;
            var fy = (mdy / dist) * force;

            if (magType === 'attract') {
              if (bodyA.bodyType !== 'static') { bodyA.vx += fx * (bodyB.mass / (bodyA.mass + bodyB.mass)); bodyA.vy += fy * (bodyB.mass / (bodyA.mass + bodyB.mass)); }
              if (bodyB.bodyType !== 'static') { bodyB.vx -= fx * (bodyA.mass / (bodyA.mass + bodyB.mass)); bodyB.vy -= fy * (bodyA.mass / (bodyA.mass + bodyB.mass)); }
            } else {
              if (bodyA.bodyType !== 'static') { bodyA.vx -= fx * (bodyB.mass / (bodyA.mass + bodyB.mass)); bodyA.vy -= fy * (bodyB.mass / (bodyA.mass + bodyB.mass)); }
              if (bodyB.bodyType !== 'static') { bodyB.vx += fx * (bodyA.mass / (bodyA.mass + bodyB.mass)); bodyB.vy += fy * (bodyA.mass / (bodyA.mass + bodyB.mass)); }
            }
          }
        }
      }

      // ── Constraints (Distance / Spring) ──────────────────
      for (var ci = 0; ci < constraints.length; ci++) {
        var con = constraints[ci];
        var bA  = _findBody(bodies, con.layerA);
        var bB  = _findBody(bodies, con.layerB);
        if (!bA || !bB) continue;

        var cdx  = bB.x - bA.x, cdy = bB.y - bA.y;
        var cdist = Math.sqrt(cdx*cdx + cdy*cdy) || 0.001;
        var restLen = (con.length > 0) ? con.length : cdist;

        if (con.type === 'distance') {
          // Rigid: push/pull to exact rest length
          var correction = (cdist - restLen) / cdist * 0.5;
          var corrX = cdx * correction, corrY = cdy * correction;
          if (bA.bodyType !== 'static') { bA.x += corrX; bA.y += corrY; }
          if (bB.bodyType !== 'static') { bB.x -= corrX; bB.y -= corrY; }

        } else if (con.type === 'spring') {
          // Spring: Hooke's law
          var k      = con.springiness || 0.5;
          var dampen = con.damping     || 0.05;
          var stretch = cdist - restLen;
          var sfx = (cdx / cdist) * stretch * k * dt;
          var sfy = (cdy / cdist) * stretch * k * dt;
          if (bA.bodyType !== 'static') { bA.vx += sfx - bA.vx * dampen; bA.vy += sfy - bA.vy * dampen; }
          if (bB.bodyType !== 'static') { bB.vx -= sfx - bB.vx * dampen; bB.vy -= sfy - bB.vy * dampen; }
        }
      }

      // ── Bake keyframes ────────────────────────────────────
      for (var k = 0; k < bodies.length; k++) {
        var bd = bodies[k];
        if (bd.bodyType === 'static') continue;
        bd.layer.position.setValueAtTime(t, [bd.x, bd.y]);
        if (params.simulateRotation) {
          bd.layer.rotation.setValueAtTime(t, bd.angle * 180 / Math.PI);
        }
      }
    }

    // ── Export contact markers ────────────────────────────
    if (exportContacts) {
      for (var ec = 0; ec < bodies.length; ec++) {
        var bd2 = bodies[ec];
        if (bd2.contacts.length === 0) continue;
        try {
          var markers = bd2.layer.marker;
          for (var m = 0; m < bd2.contacts.length; m++) {
            var mk = new MarkerValue('contact');
            markers.setValueAtTime(bd2.contacts[m], mk);
          }
        } catch(e) {}
      }
    }

    return { layers: bodies.length, frames: totalFrames, duration: duration };
  }

  function _findBody(bodies, name) {
    for (var i = 0; i < bodies.length; i++) {
      if (bodies[i].layer.name === name) return bodies[i];
    }
    return null;
  }

  return { simulate: simulate };
}());

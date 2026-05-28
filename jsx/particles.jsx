// Particle Engine — pre-allocated pool, keyframe-baked simulation.
var ParticleEngine = (function () {

  function generate(params) {
    var comp = requireComp();
    return withUndo('Particle Engine', function () {
      return _simulate(comp, params);
    });
  }

  function _simulate(comp, params) {
    var fps         = comp.frameRate;
    var startTime   = comp.workAreaStart;
    var duration    = params.duration    || 3;
    var totalFrames = Math.round(duration * fps);
    var dt          = 1 / fps;
    var w = comp.width, h = comp.height;

    // Emitter
    var emitterType  = params.emitterType  || 'point';
    var emitterX     = w * ((params.emitterX || 50) / 100);
    var emitterY     = h * ((params.emitterY || 80) / 100);
    var emitterSizeX = params.emitterSizeX || 0;
    var emitterSizeY = params.emitterSizeY || 0;

    // Emission
    var rate         = params.rate          || 8;
    var maxParticles = Math.min(params.maxParticles || 100, 200);
    var lifeSeconds  = params.life          || 1.5;
    var lifeFrames   = Math.round(lifeSeconds * fps);
    var lifeVar      = params.lifeVariance  || 0.3;

    // Direction & velocity
    var direction    = (params.direction    || -90) * Math.PI / 180;
    var spread       = (params.spread       || 30)  * Math.PI / 180;
    var velocity     = params.velocity      || 200;
    var velocityVar  = params.velocityVariance || 0.4;

    // Physics
    var gravityX     = params.gravityX      || 0;
    var gravityY     = params.gravityY      || 200;
    var wind         = params.wind          || 0;
    var turbulence   = params.turbulence    || 0;
    var drag         = 1 - (params.drag     || 0.02);

    // Appearance
    var sizeStart    = params.sizeStart     || 10;
    var sizeEnd      = params.sizeEnd       || 2;
    var opacityStart = params.opacityStart  || 100;
    var opacityEnd   = params.opacityEnd    || 0;
    var rgb          = _hex(params.color    || '#ffffff');

    // ── Pre-allocate shape layer pool ──────────────────────
    var pLayers = [];
    for (var p = 0; p < maxParticles; p++) {
      var pLayer   = comp.layers.addShape();
      pLayer.name  = 'Particle ' + (p + 1);

      var contents = pLayer.property('ADBE Root Vectors Group');
      var grp      = contents.addProperty('ADBE Vector Group');
      var grpC     = grp.property('ADBE Vectors Group');

      var ellipse  = grpC.addProperty('ADBE Vector Shape - Ellipse');
      ellipse.property('ADBE Vector Ellipse Size').setValue([sizeStart, sizeStart]);

      var fill     = grpC.addProperty('ADBE Vector Graphic - Fill');
      fill.property('ADBE Vector Fill Color').setValue([rgb[0], rgb[1], rgb[2], 1]);

      pLayer.opacity.setValueAtTime(startTime, 0);
      pLayers.push(pLayer);
    }

    // ── Simulation loop ───────────────────────────────────
    var activeParticles = [];
    var nextSlot        = 0;
    var accumulator     = 0;

    for (var frame = 0; frame <= totalFrames; frame++) {
      var t = startTime + frame * dt;

      // Spawn
      accumulator += rate;
      var toSpawn  = Math.floor(accumulator);
      accumulator -= toSpawn;

      for (var s = 0; s < toSpawn && nextSlot < maxParticles; s++) {
        var spawnAngle = direction + (Math.random() - 0.5) * spread;
        var spawnSpeed = velocity  * (1 - velocityVar * Math.random());
        var thisLife   = Math.round(lifeFrames * (1 - lifeVar * Math.random()));

        var ex = emitterX, ey = emitterY;
        if (emitterType === 'box') {
          ex += (Math.random() - 0.5) * emitterSizeX;
          ey += (Math.random() - 0.5) * emitterSizeY;
        } else if (emitterType === 'ring') {
          var ringAng = Math.random() * Math.PI * 2;
          ex += Math.cos(ringAng) * (emitterSizeX / 2);
          ey += Math.sin(ringAng) * (emitterSizeY / 2);
        }

        activeParticles.push({
          idx:  nextSlot,
          x: ex, y: ey,
          vx: Math.cos(spawnAngle) * spawnSpeed,
          vy: Math.sin(spawnAngle) * spawnSpeed,
          life: thisLife,
          age:  0
        });

        pLayers[nextSlot].opacity.setValueAtTime(t, opacityStart);
        nextSlot++;
      }

      // Update all active particles
      for (var i = activeParticles.length - 1; i >= 0; i--) {
        var par = activeParticles[i];

        par.vx += (gravityX + wind + (Math.random() - 0.5) * turbulence) * dt;
        par.vy += (gravityY        + (Math.random() - 0.5) * turbulence) * dt;
        par.vx *= drag;
        par.vy *= drag;
        par.x  += par.vx * dt;
        par.y  += par.vy * dt;
        par.age++;

        var lifeRatio = par.age / par.life;
        var opacity   = opacityStart + (opacityEnd   - opacityStart) * lifeRatio;
        var size      = sizeStart    + (sizeEnd      - sizeStart)    * lifeRatio;
        var scaleVal  = (size / sizeStart) * 100;

        pLayers[par.idx].position.setValueAtTime(t, [par.x, par.y]);
        pLayers[par.idx].opacity.setValueAtTime(t, Math.max(0, opacity));
        pLayers[par.idx].scale.setValueAtTime(t, [scaleVal, scaleVal]);

        if (par.age >= par.life) {
          pLayers[par.idx].opacity.setValueAtTime(t, 0);
          activeParticles.splice(i, 1);
        }
      }
    }

    // Ensure unused pool layers stay invisible
    for (var u = nextSlot; u < maxParticles; u++) {
      pLayers[u].opacity.setValue(0);
    }

    // Group all under a null
    var container = comp.layers.addNull();
    container.name = 'Particles — ' + emitterType;
    container.moveToBeginning();
    for (var q = 0; q < pLayers.length; q++) {
      pLayers[q].parent = container;
    }

    return { particles: nextSlot, frames: totalFrames, duration: duration };
  }

  function _hex(hex) {
    if (!hex || hex.length < 7) return [1, 1, 1];
    return [parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255];
  }

  return { generate: generate };
}());

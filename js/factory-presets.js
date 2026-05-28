'use strict';

window.FactoryPresets = {

  slides: {
    '3×3 Grid': {
      rows: 3, cols: 3, slideW: 200, slideH: 150,
      gapH: 12, gapV: 12, randomize: 0,
      rotationRandom: 0, scaleRandom: 0,
      animType: 'none', animStagger: 5, useText: false
    },
    'Card Deck': {
      rows: 1, cols: 5, slideW: 180, slideH: 260,
      gapH: 16, gapV: 10, randomize: 0,
      rotationRandom: 0, scaleRandom: 0,
      animType: 'slideUp', animStagger: 8, useText: false
    },
    'Scattered': {
      rows: 4, cols: 4, slideW: 140, slideH: 110,
      gapH: 24, gapV: 24, randomize: 65,
      rotationRandom: 14, scaleRandom: 18,
      animType: 'fade', animStagger: 3, useText: false
    },
    'Mosaic': {
      rows: 6, cols: 6, slideW: 72, slideH: 72,
      gapH: 4, gapV: 4, randomize: 0,
      rotationRandom: 0, scaleRandom: 0,
      animType: 'scale', animStagger: 2, useText: false
    },
    'Stagger Reveal': {
      rows: 2, cols: 4, slideW: 220, slideH: 160,
      gapH: 14, gapV: 14, randomize: 8,
      rotationRandom: 3, scaleRandom: 6,
      animType: 'fade', animStagger: 7, useText: true
    }
  },

  grids: {
    'Blueprint': {
      gridType: 'rect', width: 500, height: 500,
      cellSize: 40, lineWidth: 1,
      lineColor: '#4d9fff', fillColor: '#000a1a',
      fillOpacity: 25, rotation: 0,
      animType: 'none', animStagger: 3
    },
    'Graph Paper': {
      gridType: 'rect', width: 500, height: 500,
      cellSize: 20, lineWidth: 0.5,
      lineColor: '#cccccc', fillColor: '#ffffff',
      fillOpacity: 0, rotation: 0,
      animType: 'none', animStagger: 3
    },
    'Hex Mesh': {
      gridType: 'hex', width: 500, height: 500,
      cellSize: 35, lineWidth: 1.5,
      lineColor: '#6ff7c7', fillColor: '#0a2a1f',
      fillOpacity: 30, rotation: 0,
      animType: 'stroke', animStagger: 3
    },
    'Radar': {
      gridType: 'radial', width: 500, height: 500,
      cellSize: 40, lineWidth: 1,
      lineColor: '#f76f7c', fillColor: '#000000',
      fillOpacity: 0, rotation: 0,
      animType: 'fade', animStagger: 3
    },
    'Golden Triangles': {
      gridType: 'tri', width: 500, height: 500,
      cellSize: 55, lineWidth: 1,
      lineColor: '#f7c76f', fillColor: '#1a1400',
      fillOpacity: 20, rotation: 30,
      animType: 'none', animStagger: 3
    }
  },

  glow: {
    'Soft Bloom': {
      intensity: 120, radius: 80, falloff: 'soft',
      threshold: 60, glowColor: '#ffffff',
      colorize: false, saturation: 0, hueShift: 0,
      blendMode: 'screen', layers: 2, quality: 'quality'
    },
    'Neon': {
      intensity: 300, radius: 28, falloff: 'exponential',
      threshold: 100, glowColor: '#ff6bff',
      colorize: true, saturation: 30, hueShift: 0,
      blendMode: 'add', layers: 3, quality: 'quality'
    },
    'Aura': {
      intensity: 180, radius: 120, falloff: 'soft',
      threshold: 40, glowColor: '#7c6ff7',
      colorize: true, saturation: 20, hueShift: 10,
      blendMode: 'screen', layers: 3, quality: 'quality'
    },
    'Flare': {
      intensity: 420, radius: 18, falloff: 'exponential',
      threshold: 150, glowColor: '#fffbe0',
      colorize: false, saturation: 0, hueShift: 0,
      blendMode: 'add', layers: 2, quality: 'fast'
    },
    'Dreamy': {
      intensity: 75, radius: 200, falloff: 'soft',
      threshold: 20, glowColor: '#ffd7b5',
      colorize: true, saturation: -10, hueShift: 0,
      blendMode: 'screen', layers: 2, quality: 'quality'
    }
  },

  sorter: {
    'Glitch H': {
      sortMode: 'brightness', direction: 'horizontal',
      sortLength: 300, threshold: 50, randomness: 10,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 1
    },
    'Data Mosh': {
      sortMode: 'brightness', direction: 'diagonal',
      sortLength: 500, threshold: 30, randomness: 40,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 2
    },
    'Ice Crystal': {
      sortMode: 'saturation', direction: 'vertical',
      sortLength: 200, threshold: 70, randomness: 5,
      useColorKey: false, keyColor: '#0000ff', keyHueTol: 30, iterations: 1
    },
    'Signal Loss': {
      sortMode: 'hue', direction: 'horizontal',
      sortLength: 150, threshold: 40, randomness: 60,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 3
    },
    'Chromatic': {
      sortMode: 'red', direction: 'horizontal',
      sortLength: 400, threshold: 45, randomness: 20,
      useColorKey: false, keyColor: '#ff0000', keyHueTol: 30, iterations: 1
    }
  },

  distortions: {
    'Fisheye': {
      distType: 'lens', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Barrel': {
      distType: 'lens', intensity: 35,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Vortex': {
      distType: 'swirl', intensity: 50,
      centerX: 0.5, centerY: 0.5, radius: 220, feather: 60,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 270, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Ocean': {
      distType: 'wave', intensity: 50,
      centerX: 0.5, centerY: 0.5, radius: 200, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 35, frequency: 3, waveSpeed: 0.5,
      blendOpacity: 100
    },
    'Magnify': {
      distType: 'bulge', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 200, feather: 80,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    }
  },

  colorlab: {
    'Bleach Bypass': {
      look: 'bleach_bypass', lookIntensity: 80,
      hue: 0, saturation: -15, lightness: 0, brightness: 0, contrast: 25,
      shadowsHue: 0, shadowsLightness: 0, shadowsSaturation: 0,
      midtonesHue: 0, midtonesLightness: 0, midtonesSaturation: 0,
      highlightsHue: 0, highlightsLightness: 0, highlightsSaturation: 0,
      tintAmount: 0, tintBlack: '#000000', tintWhite: '#ffffff',
      grainAmount: 8, grainColor: false, vignetteAmount: 20
    },
    'Teal & Orange': {
      look: 'cinematic_teal_orange', lookIntensity: 90,
      hue: 0, saturation: 10, lightness: 0, brightness: 0, contrast: 15,
      shadowsHue: -30, shadowsLightness: -5, shadowsSaturation: 20,
      midtonesHue: 0, midtonesLightness: 0, midtonesSaturation: 5,
      highlightsHue: 25, highlightsLightness: 0, highlightsSaturation: 15,
      tintAmount: 0, tintBlack: '#000000', tintWhite: '#ffffff',
      grainAmount: 5, grainColor: false, vignetteAmount: 25
    },
    'Vintage Film': {
      look: 'vintage', lookIntensity: 100,
      hue: 5, saturation: -20, lightness: 5, brightness: 10, contrast: -10,
      shadowsHue: 15, shadowsLightness: 10, shadowsSaturation: -10,
      midtonesHue: 8, midtonesLightness: 5, midtonesSaturation: -5,
      highlightsHue: 0, highlightsLightness: 0, highlightsSaturation: 0,
      tintAmount: 25, tintBlack: '#1a0800', tintWhite: '#fff8e8',
      grainAmount: 18, grainColor: true, vignetteAmount: 35
    },
    'Cool Cinema': {
      look: 'cool_blue', lookIntensity: 75,
      hue: -5, saturation: -5, lightness: 0, brightness: -5, contrast: 20,
      shadowsHue: -15, shadowsLightness: -8, shadowsSaturation: 10,
      midtonesHue: -10, midtonesLightness: 0, midtonesSaturation: 5,
      highlightsHue: 0, highlightsLightness: 5, highlightsSaturation: 0,
      tintAmount: 0, tintBlack: '#000000', tintWhite: '#e8f0ff',
      grainAmount: 4, grainColor: false, vignetteAmount: 30
    },
    'Golden Hour': {
      look: 'warm_golden', lookIntensity: 85,
      hue: 8, saturation: 20, lightness: 5, brightness: 8, contrast: 10,
      shadowsHue: 20, shadowsLightness: 0, shadowsSaturation: 15,
      midtonesHue: 15, midtonesLightness: 5, midtonesSaturation: 10,
      highlightsHue: 5, highlightsLightness: 8, highlightsSaturation: 5,
      tintAmount: 0, tintBlack: '#000000', tintWhite: '#fff8e0',
      grainAmount: 3, grainColor: false, vignetteAmount: 15
    },
    'Clean Grade': {
      look: 'none', lookIntensity: 100,
      hue: 0, saturation: 5, lightness: 0, brightness: 5, contrast: 10,
      shadowsHue: 0, shadowsLightness: 0, shadowsSaturation: 0,
      midtonesHue: 0, midtonesLightness: 0, midtonesSaturation: 0,
      highlightsHue: 0, highlightsLightness: 0, highlightsSaturation: 0,
      tintAmount: 0, tintBlack: '#000000', tintWhite: '#ffffff',
      grainAmount: 0, grainColor: false, vignetteAmount: 0
    }
  },

  gradient: {
    'Midnight Radial': { gradientType:'radial', colorStart:'#0a0a2e', colorEnd:'#ff6b6b', startX:50, startY:50, endX:90, endY:90, scatter:15, centerX:50, centerY:50, segments:16, meshBlur:200, meshStops:[{x:20,y:20,color:'#7c3aed'},{x:80,y:20,color:'#2563eb'},{x:50,y:80,color:'#06b6d4'}], noiseType:'basic', noiseScale:250, noiseComplexity:3, colorize:true, blendMode:'normal' },
    'Horizon Linear': { gradientType:'linear', colorStart:'#ff512f', colorEnd:'#dd2476', startX:0, startY:50, endX:100, endY:50, scatter:10, centerX:50, centerY:50, segments:16, meshBlur:200, meshStops:[{x:20,y:20,color:'#ff512f'},{x:80,y:20,color:'#dd2476'},{x:50,y:80,color:'#f09819'}], noiseType:'basic', noiseScale:250, noiseComplexity:3, colorize:true, blendMode:'normal' },
    'Aurora Mesh': { gradientType:'mesh', colorStart:'#00c6ff', colorEnd:'#0072ff', startX:10, startY:50, endX:90, endY:50, scatter:0, centerX:50, centerY:50, segments:16, meshBlur:280, meshStops:[{x:15,y:25,color:'#7c3aed'},{x:85,y:25,color:'#0ea5e9'},{x:50,y:75,color:'#10b981'}], noiseType:'basic', noiseScale:250, noiseComplexity:3, colorize:true, blendMode:'normal' },
    'Lava Conic': { gradientType:'conical', colorStart:'#ff4500', colorEnd:'#ff8c00', startX:10, startY:50, endX:90, endY:50, scatter:0, centerX:50, centerY:50, segments:24, meshBlur:200, meshStops:[{x:50,y:20,color:'#ff4500'},{x:80,y:80,color:'#ff8c00'},{x:20,y:80,color:'#ffd700'}], noiseType:'basic', noiseScale:250, noiseComplexity:3, colorize:true, blendMode:'normal' },
    'Smoke Noise': { gradientType:'noise', colorStart:'#1a1a2e', colorEnd:'#e0e0e0', startX:10, startY:50, endX:90, endY:50, scatter:0, centerX:50, centerY:50, segments:16, meshBlur:200, meshStops:[{x:50,y:50,color:'#888888'}], noiseType:'turbulent', noiseScale:350, noiseComplexity:5, colorize:true, blendMode:'screen' }
  },

  patterns: {
    'Koch Snowflake':     { patternType:'lsystem', preset:'Koch Snowflake',      iterations:4,  angle:60,  customAxiom:'', size:0, strokeWidth:1.5, color:'#a3e635', animType:'draw', animDuration:3, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Dragon Curve':       { patternType:'lsystem', preset:'Dragon Curve',        iterations:10, angle:90,  customAxiom:'', size:0, strokeWidth:1,   color:'#f87171', animType:'draw', animDuration:4, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Sierpinski':         { patternType:'lsystem', preset:'Sierpinski Triangle', iterations:5,  angle:120, customAxiom:'', size:0, strokeWidth:1.2, color:'#38bdf8', animType:'draw', animDuration:3, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Forest Plant':       { patternType:'lsystem', preset:'Plant',               iterations:5,  angle:25,  customAxiom:'', size:0, strokeWidth:1,   color:'#4ade80', animType:'draw', animDuration:5, outerRadius:100, innerRadius:40, penRadius:60, steps:720 },
    'Classic Spirograph': { patternType:'spirograph', preset:'Koch Snowflake',   iterations:4,  angle:60,  customAxiom:'', size:0, strokeWidth:1.5, color:'#e879f9', animType:'draw', animDuration:3, outerRadius:100, innerRadius:37, penRadius:90, steps:1080 },
    'Star Spirograph':    { patternType:'spirograph', preset:'Koch Snowflake',   iterations:4,  angle:60,  customAxiom:'', size:0, strokeWidth:1,   color:'#fbbf24', animType:'draw', animDuration:2, outerRadius:100, innerRadius:25, penRadius:70, steps:900 }
  },

  physics: {
    'Gravity Drop':   { duration:3, gravityX:0,   gravityY:980,  gravityScale:1, bounce:0.55, friction:0.01, groundFriction:0.15, groundY:-1, mass:1, initialVelX:0,   initialVelY:0,    wallBounce:true,  simulateRotation:true,  magnetism:false, magnetismType:'attract', magnetismStrength:200, magnetismRange:400, exportContacts:false, constraints:[] },
    'Bouncy Ball':    { duration:5, gravityX:0,   gravityY:800,  gravityScale:1, bounce:0.82, friction:0.005,groundFriction:0.05, groundY:-1, mass:1, initialVelX:120, initialVelY:-400, wallBounce:true,  simulateRotation:false, magnetism:false, magnetismType:'attract', magnetismStrength:200, magnetismRange:400, exportContacts:false, constraints:[] },
    'Zero Gravity':   { duration:4, gravityX:0,   gravityY:0,    gravityScale:1, bounce:1.0,  friction:0,    groundFriction:0,    groundY:-1, mass:1, initialVelX:200, initialVelY:-150, wallBounce:true,  simulateRotation:true,  magnetism:false, magnetismType:'attract', magnetismStrength:200, magnetismRange:400, exportContacts:false, constraints:[] },
    'Heavy Landing':  { duration:2, gravityX:0,   gravityY:1800, gravityScale:1, bounce:0.2,  friction:0.02, groundFriction:0.4,  groundY:-1, mass:3, initialVelX:0,   initialVelY:0,    wallBounce:false, simulateRotation:false, magnetism:false, magnetismType:'attract', magnetismStrength:200, magnetismRange:400, exportContacts:false, constraints:[] },
    'Magnetic Swirl': { duration:4, gravityX:0,   gravityY:0,    gravityScale:0, bounce:0.8,  friction:0.005,groundFriction:0,    groundY:-1, mass:1, initialVelX:150, initialVelY:-100, wallBounce:true,  simulateRotation:true,  magnetism:true,  magnetismType:'attract', magnetismStrength:500, magnetismRange:600, exportContacts:false, constraints:[] }
  },

  particles: {
    'Sparks':    { emitterType:'point', emitterX:50, emitterY:90, emitterSizeX:0,    emitterSizeY:0,  rate:12, maxParticles:150, life:1.2, lifeVariance:0.5, direction:-90, spread:80,  velocity:400, velocityVariance:0.5, gravityX:0, gravityY:600,  wind:30, turbulence:40, drag:0.01, sizeStart:5,  sizeEnd:1,  opacityStart:100, opacityEnd:0,  color:'#fbbf24', duration:3 },
    'Smoke':     { emitterType:'box',   emitterX:50, emitterY:85, emitterSizeX:120,  emitterSizeY:30, rate:5,  maxParticles:80,  life:3,   lifeVariance:0.4, direction:-90, spread:20,  velocity:60,  velocityVariance:0.3, gravityX:0, gravityY:-30,  wind:15, turbulence:20, drag:0.03, sizeStart:20, sizeEnd:60, opacityStart:40,  opacityEnd:0,  color:'#cccccc', duration:4 },
    'Fireworks': { emitterType:'ring',  emitterX:50, emitterY:40, emitterSizeX:200,  emitterSizeY:200,rate:20, maxParticles:200, life:1.8, lifeVariance:0.3, direction:0,   spread:360, velocity:300, velocityVariance:0.4, gravityX:0, gravityY:400,  wind:0,  turbulence:10, drag:0.02, sizeStart:8,  sizeEnd:2,  opacityStart:100, opacityEnd:0,  color:'#f0abfc', duration:3 },
    'Snow':      { emitterType:'box',   emitterX:50, emitterY:5,  emitterSizeX:1000, emitterSizeY:0,  rate:6,  maxParticles:120, life:5,   lifeVariance:0.6, direction:90,  spread:15,  velocity:80,  velocityVariance:0.5, gravityX:0, gravityY:50,   wind:20, turbulence:15, drag:0.05, sizeStart:6,  sizeEnd:4,  opacityStart:80,  opacityEnd:60, color:'#ffffff', duration:5 },
    'Fire':      { emitterType:'box',   emitterX:50, emitterY:90, emitterSizeX:80,   emitterSizeY:10, rate:10, maxParticles:100, life:1.0, lifeVariance:0.5, direction:-90, spread:40,  velocity:150, velocityVariance:0.5, gravityX:0, gravityY:-120, wind:0,  turbulence:60, drag:0.02, sizeStart:14, sizeEnd:4,  opacityStart:90,  opacityEnd:0,  color:'#ff6b00', duration:3 }
  }

};

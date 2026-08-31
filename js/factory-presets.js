'use strict';

window.FactoryPresets = {

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

  distortions: {
    'Fisheye': {
      engine: 'builtin',
      distType: 'lens', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Barrel': {
      engine: 'builtin',
      distType: 'lens', intensity: 35,
      centerX: 0.5, centerY: 0.5, radius: 300, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Vortex': {
      engine: 'builtin',
      distType: 'swirl', intensity: 50,
      centerX: 0.5, centerY: 0.5, radius: 220, feather: 60,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 270, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Ocean': {
      engine: 'builtin',
      distType: 'wave', intensity: 50,
      centerX: 0.5, centerY: 0.5, radius: 200, feather: 0,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 35, frequency: 3, waveSpeed: 0.5,
      blendOpacity: 100
    },
    'Magnify': {
      engine: 'builtin',
      distType: 'bulge', intensity: 80,
      centerX: 0.5, centerY: 0.5, radius: 200, feather: 80,
      focalLength: 50, meshResX: 5, meshResY: 5,
      swirlAngle: 90, amplitude: 20, frequency: 5, waveSpeed: 1,
      blendOpacity: 100
    },
    'Woven Slats': {
      engine: 'flow', dfMapType: 3, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 60, dfFlowDir: 1, dfFlowSpeed: 0.3, dfLoop: 1, dfEasing: 1,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 4, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 16, dfSlatCols: 16, dfSlatStagger: 60, dfTargetMode: 'selectedLayers'
    },
    'Venetian Blinds': {
      engine: 'flow', dfMapType: 3, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 6, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 40, dfFlowDir: 1, dfFlowSpeed: 0.2, dfLoop: 1, dfEasing: 1,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 4, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 24, dfSlatCols: 0, dfSlatStagger: 100, dfTargetMode: 'selectedLayers'
    },
    'Ripple Grid': {
      engine: 'flow', dfMapType: 2, dfAngle: 0, dfSpacing: 6, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 50, dfFlowDir: 3, dfFlowSpeed: 0.4, dfLoop: 1, dfEasing: 5,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 4, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 20, dfSlatCols: 20, dfSlatStagger: 40, dfTargetMode: 'selectedLayers'
    },
    'Liquid Wave': {
      engine: 'flow', dfMapType: 3, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 50, dfFlowDir: 1, dfFlowSpeed: 0.5, dfLoop: 1, dfEasing: 5,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 4, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0, dfTargetMode: 'selectedLayers'
    },
    'Noise Drift': {
      engine: 'flow', dfMapType: 4, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 4, dfNoiseDetail: 4, dfNoiseSeed: 7, dfContrast: 10,
      dfDispMode: 2, dfAmount: 60, dfFlowDir: 1, dfFlowSpeed: 0.4, dfLoop: 1, dfEasing: 1,
      dfJitter: 10, dfJitterSeed: 3, dfPhase: 0, dfEdge: 4, dfOpacity: 100, dfMosaic: 0,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0, dfTargetMode: 'selectedLayers'
    },
    'Mosaic Shuffle': {
      engine: 'flow', dfMapType: 4, dfAngle: 0, dfSpacing: 4, dfWaveFreq: 4, dfWavePhase: 0,
      dfNoiseScale: 3, dfNoiseDetail: 3, dfNoiseSeed: 1, dfContrast: 0,
      dfDispMode: 1, dfAmount: 40, dfFlowDir: 1, dfFlowSpeed: 0.5, dfLoop: 1, dfEasing: 1,
      dfJitter: 0, dfJitterSeed: 1, dfPhase: 0, dfEdge: 4, dfOpacity: 100, dfMosaic: 24,
      dfSlatRows: 0, dfSlatCols: 0, dfSlatStagger: 0, dfTargetMode: 'selectedLayers'
    }
  },

  // Curated grades for the DISPLAY-SPACE engine (linearLight:false, tonemap None).
  // Color Lab is a FAST in-AE tool — these are tasteful one-click STARTING POINTS,
  // not film-stock emulations (serious grades go to DaVinci). Values are deliberately
  // gentle (~Lumetri scale) so nothing looks overcooked. Balanced set: 6 fix-first
  // correction presets + 6 stylized looks.
  //
  // 3-way wheel coords are (x,y) on the hue circle: +X warm/orange, -X teal/cyan,
  // -Y blue, +Y yellow-green; magnitude = strength. Every preset carries the FULL
  // field set explicitly (applyPreset has fallbacks that flip Linear ON / Tonemap to
  // Soft-clip when a field is omitted). Curves use keys m/r/g/b, points {x,y} in 0..1,
  // identity = [{x:0,y:0},{x:1,y:1}]; only presets that earn a curve carry one.
  colorlab: {
    // ── Fix-first: correct fast ──
    'Neutral Punch':  { exposure: 0,     contrast: 12, contrastPivot: 0.18, temperature: 0,   tint: 0,  saturation: 6,   liftX: 0,     liftY: 0,     liftLuma: 0,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,    gainY: 0,    gainLuma: 2, linearLight: false, tonemap: 1, highlightComp: 50 },
    'Warm Up':        { exposure: 0.05,  contrast: 6,  contrastPivot: 0.18, temperature: 18,  tint: -2, saturation: 4,   liftX: 0,     liftY: 0,     liftLuma: 0,  gammaX: 0.10, gammaY: 0.06, gammaLuma: 0, gainX: 0.12, gainY: 0.08, gainLuma: 0, linearLight: false, tonemap: 1, highlightComp: 50 },
    'Cool Down':      { exposure: 0,     contrast: 6,  contrastPivot: 0.18, temperature: -18, tint: 0,  saturation: 2,   liftX: -0.10, liftY: -0.10, liftLuma: 0,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,    gainY: 0,    gainLuma: 0, linearLight: false, tonemap: 1, highlightComp: 50 },
    'Flat → Pop':     { exposure: 0.05,  contrast: 14, contrastPivot: 0.18, temperature: 2,   tint: 0,  saturation: 12,  liftX: 0,     liftY: 0,     liftLuma: -2, gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,    gainY: 0,    gainLuma: 3, linearLight: false, tonemap: 1, highlightComp: 50, curves: { m: [{x:0,y:0},{x:0.25,y:0.20},{x:0.75,y:0.82},{x:1,y:1}], r: [{x:0,y:0},{x:1,y:1}], g: [{x:0,y:0},{x:1,y:1}], b: [{x:0,y:0},{x:1,y:1}] } },
    'Soft Contrast':  { exposure: 0,     contrast: 0,  contrastPivot: 0.18, temperature: 0,   tint: 0,  saturation: 3,   liftX: 0,     liftY: 0,     liftLuma: 0,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,    gainY: 0,    gainLuma: 0, linearLight: false, tonemap: 1, highlightComp: 50, curves: { m: [{x:0,y:0},{x:0.30,y:0.27},{x:0.70,y:0.74},{x:1,y:1}], r: [{x:0,y:0},{x:1,y:1}], g: [{x:0,y:0},{x:1,y:1}], b: [{x:0,y:0},{x:1,y:1}] } },
    'Bright & Clean': { exposure: 0.25,  contrast: 8,  contrastPivot: 0.18, temperature: 0,   tint: 0,  saturation: 6,   liftX: 0,     liftY: 0,     liftLuma: 0,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,    gainY: 0,    gainLuma: 3, linearLight: false, tonemap: 2, highlightComp: 50 },

    // ── Stylized looks: instant vibe ──
    'Teal & Orange':  { exposure: 0,     contrast: 14, contrastPivot: 0.18, temperature: 0,   tint: 0,  saturation: 10,  liftX: -0.40, liftY: -0.08, liftLuma: -2, gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0.42, gainY: 0.24, gainLuma: 3, linearLight: false, tonemap: 1, highlightComp: 50 },
    'Cinematic Warm': { exposure: 0,     contrast: 10, contrastPivot: 0.18, temperature: 12,  tint: -2, saturation: 6,   liftX: -0.16, liftY: -0.10, liftLuma: 0,  gammaX: 0.06, gammaY: 0.04, gammaLuma: 0, gainX: 0.28, gainY: 0.18, gainLuma: 3, linearLight: false, tonemap: 1, highlightComp: 50, curves: { m: [{x:0,y:0},{x:0.28,y:0.24},{x:0.72,y:0.78},{x:1,y:1}], r: [{x:0,y:0},{x:1,y:1}], g: [{x:0,y:0},{x:1,y:1}], b: [{x:0,y:0},{x:1,y:1}] } },
    'Moody Blue':     { exposure: -0.10, contrast: 14, contrastPivot: 0.18, temperature: -22, tint: 0,  saturation: -8,  liftX: -0.30, liftY: -0.34, liftLuma: -4, gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,    gainY: 0.10, gainLuma: 0, linearLight: false, tonemap: 1, highlightComp: 50 },
    'Vintage Fade':   { exposure: 0,     contrast: -8, contrastPivot: 0.18, temperature: 10,  tint: 2,  saturation: -22, liftX: 0.14,  liftY: 0.06,  liftLuma: 0,  gammaX: 0,    gammaY: 0,    gammaLuma: 3, gainX: 0,    gainY: 0,    gainLuma: 0, linearLight: false, tonemap: 1, highlightComp: 50, curves: { m: [{x:0,y:0.07},{x:0.55,y:0.52},{x:1,y:0.93}], r: [{x:0,y:0},{x:1,y:1}], g: [{x:0,y:0},{x:1,y:1}], b: [{x:0,y:0},{x:1,y:1}] } },
    'Bleach':         { exposure: 0,     contrast: 20, contrastPivot: 0.18, temperature: 0,   tint: 0,  saturation: -22, liftX: 0,     liftY: 0,     liftLuma: 0,  gammaX: 0,    gammaY: 0,    gammaLuma: 2, gainX: 0,    gainY: 0,    gainLuma: 0, linearLight: false, tonemap: 1, highlightComp: 50 },
    'Golden Hour':    { exposure: 0.20,  contrast: 8,  contrastPivot: 0.18, temperature: 30,  tint: 2,  saturation: 14,  liftX: 0,     liftY: 0,     liftLuma: 0,  gammaX: 0.14, gammaY: 0.10, gammaLuma: 0, gainX: 0.40, gainY: 0.30, gainLuma: 5, linearLight: false, tonemap: 1, highlightComp: 50 }
  }

};

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

  // Curated grades — ordered neutral → warm → cool → film → stylized.
  // 3-way wheel coords are (x,y) on the hue circle (0°=R, 60°=Y, 120°=G,
  // 180°=Cy, 240°=B, 300°=Mg); magnitude = strength. Filmic tonemap on the
  // cinematic looks rolls highlights gracefully. (Curve data omitted until the
  // native curve params ship — these stay identity-on-curves.)
  colorlab: {
    'Clean Grade':    { exposure: 0,    contrast: 8,   contrastPivot: 0.18, temperature: 0,   tint: 0,   saturation: 4,   liftX: 0,     liftY: 0,     liftLuma: 0,   gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,     gainY: 0,    gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Crisp Pop':      { exposure: 0.1,  contrast: 22,  contrastPivot: 0.18, temperature: 0,   tint: 0,   saturation: 16,  liftX: 0,     liftY: 0,     liftLuma: -2,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,     gainY: 0,    gainLuma: 3, linearLight: true, tonemap: 2, highlightComp: 40 },

    'Teal & Orange':  { exposure: 0,    contrast: 18,  contrastPivot: 0.18, temperature: 0,   tint: 0,   saturation: 12,  liftX: -0.82, liftY: -0.14, liftLuma: -4,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0.85,  gainY: 0.46, gainLuma: 5, linearLight: true, tonemap: 3, highlightComp: 55 },
    'Cinematic Warm': { exposure: 0,    contrast: 16,  contrastPivot: 0.18, temperature: 16,  tint: -2,  saturation: 6,   liftX: -0.28, liftY: -0.18, liftLuma: -3,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0.50,  gainY: 0.34, gainLuma: 5, linearLight: true, tonemap: 3, highlightComp: 60 },
    'Golden Hour':    { exposure: 0.3,  contrast: 12,  contrastPivot: 0.18, temperature: 40,  tint: 2,   saturation: 18,  liftX: 0.12,  liftY: -0.04, liftLuma: 0,   gammaX: 0.20, gammaY: 0.12, gammaLuma: 0, gainX: 0.77,  gainY: 0.60, gainLuma: 8, linearLight: true, tonemap: 2, highlightComp: 55 },
    'Sun-Kissed':     { exposure: 0.1,  contrast: 6,   contrastPivot: 0.18, temperature: 15,  tint: -6,  saturation: 6,   liftX: 0,     liftY: 0,     liftLuma: 0,   gammaX: 0.12, gammaY: 0.06, gammaLuma: 2, gainX: 0,     gainY: 0,    gainLuma: 4, linearLight: true, tonemap: 2, highlightComp: 55 },

    'Cold Thriller':  { exposure: 0,    contrast: 22,  contrastPivot: 0.18, temperature: -35, tint: 0,   saturation: -8,  liftX: -0.50, liftY: -0.60, liftLuma: -6,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0,     gainY: 0.18, gainLuma: 3, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Moonlight':      { exposure: -0.5, contrast: 8,   contrastPivot: 0.18, temperature: -55, tint: -8,  saturation: -22, liftX: -0.77, liftY: -0.50, liftLuma: -8,  gammaX: -0.15,gammaY: 0,    gammaLuma: 0, gainX: 0,     gainY: 0,    gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Cyberpunk':      { exposure: -0.2, contrast: 35,  contrastPivot: 0.18, temperature: -15, tint: 20,  saturation: 38,  liftX: 0.20,  liftY: -0.70, liftLuma: -10, gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: -0.62, gainY: 0.18, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 45 },

    'Bleach Bypass':  { exposure: 0,    contrast: 30,  contrastPivot: 0.18, temperature: 0,   tint: 0,   saturation: -20, liftX: 0,     liftY: 0,     liftLuma: 0,   gammaX: 0,    gammaY: 0,    gammaLuma: 3, gainX: 0,     gainY: 0,    gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 45 },
    'Vintage Fade':   { exposure: 0,    contrast: -16, contrastPivot: 0.18, temperature: 12,  tint: 2,   saturation: -26, liftX: 0.22,  liftY: 0.08,  liftLuma: 16,  gammaX: 0.05, gammaY: 0,    gammaLuma: 5, gainX: 0,     gainY: 0,    gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 60 },
    'Kodak Warm':     { exposure: 0.05, contrast: 14,  contrastPivot: 0.18, temperature: 22,  tint: -4,  saturation: 14,  liftX: -0.12, liftY: -0.10, liftLuma: -2,  gammaX: 0.08, gammaY: 0.05, gammaLuma: 0, gainX: 0.60,  gainY: 0.40, gainLuma: 4, linearLight: true, tonemap: 3, highlightComp: 55 },
    'Faded Matte':    { exposure: 0,    contrast: -10, contrastPivot: 0.18, temperature: 6,   tint: 0,   saturation: -12, liftX: 0,     liftY: 0,     liftLuma: 14,  gammaX: 0,    gammaY: 0,    gammaLuma: 4, gainX: 0,     gainY: 0,    gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 70 },

    'Neon Noir':      { exposure: -0.2, contrast: 45,  contrastPivot: 0.18, temperature: 0,   tint: 4,   saturation: 36,  liftX: -0.15, liftY: -0.68, liftLuma: -12, gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: -0.55, gainY: 0.12, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 45 },
    'Cross Process':  { exposure: 0,    contrast: 26,  contrastPivot: 0.18, temperature: 0,   tint: 0,   saturation: 28,  liftX: -0.30, liftY: -0.55, liftLuma: -5,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: 0.60,  gainY: 0.34, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Emerald Forest': { exposure: 0,    contrast: 16,  contrastPivot: 0.18, temperature: -6,  tint: 0,   saturation: 14,  liftX: -0.60, liftY: 0.12,  liftLuma: -3,  gammaX: 0,    gammaY: 0,    gammaLuma: 0, gainX: -0.45, gainY: 0.78, gainLuma: 4, linearLight: true, tonemap: 2, highlightComp: 55 }
  }

};

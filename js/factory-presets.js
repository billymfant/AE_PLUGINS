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

  colorlab: {
    'Teal & Orange': { exposure: 0, contrast: 15, contrastPivot: 0.18, temperature: 0, tint: 0, saturation: 10, liftX: -0.8, liftY: 0, liftLuma: -5, gammaX: 0, gammaY: 0, gammaLuma: 0, gainX: 0.87, gainY: 0.5, gainLuma: 5, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Bleach Bypass': { exposure: 0, contrast: 25, contrastPivot: 0.18, temperature: 0, tint: 0, saturation: -15, liftX: 0, liftY: 0, liftLuma: 0, gammaX: 0, gammaY: 0, gammaLuma: 3, gainX: 0, gainY: 0, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Vintage Film': { exposure: 0, contrast: -10, contrastPivot: 0.18, temperature: 25, tint: 0, saturation: -20, liftX: 0.15, liftY: -0.1, liftLuma: 12, gammaX: 0.05, gammaY: 0, gammaLuma: 5, gainX: 0, gainY: 0, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Cool Cinema': { exposure: 0, contrast: 20, contrastPivot: 0.18, temperature: -30, tint: 0, saturation: -5, liftX: -0.5, liftY: 0.3, liftLuma: -8, gammaX: -0.1, gammaY: 0.1, gammaLuma: 0, gainX: 0, gainY: 0.2, gainLuma: 5, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Golden Hour': { exposure: 0.3, contrast: 12, contrastPivot: 0.18, temperature: 45, tint: 0, saturation: 20, liftX: 0.15, liftY: -0.05, liftLuma: 0, gammaX: 0.2, gammaY: 0.1, gammaLuma: 0, gainX: 0.5, gainY: 0.866, gainLuma: 8, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Moonlight': { exposure: -0.4, contrast: 8, contrastPivot: 0.18, temperature: -55, tint: -10, saturation: -20, liftX: -0.866, liftY: -0.5, liftLuma: -8, gammaX: -0.2, gammaY: 0, gammaLuma: 0, gainX: 0, gainY: 0, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Neon Noir': { exposure: -0.3, contrast: 50, contrastPivot: 0.18, temperature: 0, tint: 0, saturation: 40, liftX: 0, liftY: 0, liftLuma: -12, gammaX: 0, gammaY: 0, gammaLuma: 0, gainX: 0, gainY: 0, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Faded Film': { exposure: 0, contrast: -20, contrastPivot: 0.18, temperature: 15, tint: 0, saturation: -35, liftX: 0, liftY: 0, liftLuma: 18, gammaX: 0, gammaY: 0, gammaLuma: 5, gainX: 0, gainY: 0, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Cyberpunk': { exposure: -0.2, contrast: 35, contrastPivot: 0.18, temperature: -15, tint: 20, saturation: 40, liftX: 0, liftY: -0.8, liftLuma: -10, gammaX: 0, gammaY: 0, gammaLuma: 0, gainX: -0.6, gainY: 0.2, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Studio Portrait': { exposure: 0.1, contrast: 5, contrastPivot: 0.18, temperature: 15, tint: -5, saturation: 5, liftX: 0, liftY: 0, liftLuma: 0, gammaX: 0.1, gammaY: 0, gammaLuma: 2, gainX: 0, gainY: 0, gainLuma: 5, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Cross Process': { exposure: 0, contrast: 30, contrastPivot: 0.18, temperature: 0, tint: 0, saturation: 30, liftX: -0.3, liftY: -0.6, liftLuma: -5, gammaX: 0, gammaY: 0, gammaLuma: 0, gainX: 0.87, gainY: 0.3, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 },
    'Clean Grade': { exposure: 0, contrast: 10, contrastPivot: 0.18, temperature: 0, tint: 0, saturation: 5, liftX: 0, liftY: 0, liftLuma: 0, gammaX: 0, gammaY: 0, gammaLuma: 0, gainX: 0, gainY: 0, gainLuma: 0, linearLight: true, tonemap: 2, highlightComp: 50 }
  }

};

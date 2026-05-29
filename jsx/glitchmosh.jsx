// jsx/glitchmosh.jsx
var GlitchMosh = (function () {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _addSlider(fxGroup, name, value) {
    var s = fxGroup.addProperty('ADBE Slider Control');
    s.name = name;
    s.property('ADBE Slider Control-0001').setValue(value);
    return s;
  }

  function _addCheckbox(fxGroup, name, value) {
    var c = fxGroup.addProperty('ADBE Checkbox Control');
    c.name = name;
    c.property('ADBE Checkbox Control-0001').setValue(value ? 1 : 0);
    return c;
  }

  // Returns expression string that reads a named slider on adjLayer
  function _sliderExpr(sliderName, defaultVal) {
    return 'var ctrl = thisComp.layer("GlitchMosh Controls");\n' +
           'try { ctrl.effect("' + sliderName + '")("Slider") } catch(e) { ' + defaultVal + ' }';
  }

  // ── Main apply ───────────────────────────────────────────────────────────

  function apply(params) {
    return withUndo('GlitchMosh', function () {

      var comp     = requireComp();
      var selected = comp.selectedLayers;
      if (!selected || selected.length === 0) {
        return { error: 'Select a video layer to apply GlitchMosh.' };
      }

      var srcLayer = selected[0];

      // 1. Precomp the selected layer
      var precomp = comp.layers.precompose(
        [srcLayer.index],
        srcLayer.name + '_GlitchMosh',
        true
      );

      // 2. Add adjustment layer at top of precomp
      var adj = precomp.layers.addNull(precomp.duration);
      adj.name            = 'GlitchMosh Controls';
      adj.adjustmentLayer = true;
      adj.inPoint         = precomp.workAreaStart;
      adj.outPoint        = precomp.workAreaStart + precomp.workAreaDuration;
      adj.moveToBeginning();

      var fx = adj.property('ADBE Effect Parade');

      // 3. Master slider
      _addSlider(fx, 'Master Intensity', params.masterIntensity || 100);
      _addSlider(fx, 'Master Seed',      params.masterSeed      || 42);

      // 4. Build each stage
      if (params.bleedEnabled  !== false) _buildFrameBleed(fx, precomp, adj, params);
      if (params.smearEnabled  !== false) _buildPixelSmear(fx, params);
      if (params.blockEnabled  !== false) _buildBlockCorruption(fx, params);
      if (params.rgbEnabled    !== false) _buildRGBSplit(fx, precomp, adj, params);
      if (params.stutterEnabled !== false) _buildTemporalStutter(fx, params);
      if (params.noiseEnabled  !== false) _buildCompressionNoise(fx, params);
      _buildGlitchMask(fx, params);

      return { success: true, precompName: precomp.name };
    });
  }

  function _buildFrameBleed(fx, precomp, adj, params) {
    var bleedAmt   = params.bleedAmount   !== undefined ? params.bleedAmount   : 70;
    var decayRate  = params.bleedDecay    !== undefined ? params.bleedDecay    : 0.8;
    var frameOff   = params.bleedFrames   !== undefined ? params.bleedFrames   : 3;
    var lumaThresh = params.bleedLumaThresh !== undefined ? params.bleedLumaThresh : 50;

    // Echo effect
    var echo = fx.addProperty('ADBE Echo');
    echo.name = 'GM_FrameBleed_Echo';
    // Echo Time (secs) — negative = look backward in time
    echo.property(2).setValue(-(1 / precomp.frameRate) * frameOff);
    // Number of Echoes
    echo.property(3).setValue(Math.round(frameOff));
    // Starting Intensity
    echo.property(4).setValue(bleedAmt / 100);
    // Decay
    echo.property(5).setValue(decayRate);
    // Echo Operator: Add=1, Screen=8, Blend=6 — use Blend for subtlety
    echo.property(6).setValue(6);

    // Drive Starting Intensity from Master * bleedAmt slider
    _addSlider(fx, 'Bleed Amount',     bleedAmt);
    _addSlider(fx, 'Bleed Decay',      Math.round(decayRate * 100));
    _addSlider(fx, 'Bleed Frames',     frameOff);
    _addSlider(fx, 'Bleed Luma Thresh', lumaThresh);

    echo.property(4).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var b = thisComp.layer("GlitchMosh Controls").effect("Bleed Amount")("Slider") / 100;\n' +
      'm * b';

    echo.property(5).expression =
      'thisComp.layer("GlitchMosh Controls").effect("Bleed Decay")("Slider") / 100';
  }

  function _buildPixelSmear(fx, params) {
    var smearLen   = params.smearLength    !== undefined ? params.smearLength    : 120;
    var smearDir   = params.smearDirection !== undefined ? params.smearDirection : 0; // 0=H,1=V,2=Both
    var lumaThresh = params.smearLumaThresh !== undefined ? params.smearLumaThresh : 40;
    var stretch    = params.smearStretch   !== undefined ? params.smearStretch   : 50;

    // Channel Blur — directional blur for the smear base
    var cblur = fx.addProperty('ADBE Channel Blur');
    cblur.name = 'GM_Smear_ChanBlur';
    // Blur Dimensions: 1=Horizontal, 2=Vertical, 3=Both
    var blurDim = smearDir === 1 ? 2 : (smearDir === 2 ? 3 : 1);
    cblur.property(6).setValue(blurDim); // Blur Dimensions

    _addSlider(fx, 'Smear Length',    smearLen);
    _addSlider(fx, 'Smear Direction', smearDir);
    _addSlider(fx, 'Smear Luma Thresh', lumaThresh);
    _addSlider(fx, 'Smear Stretch',   stretch);

    var smearExpr =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var s = thisComp.layer("GlitchMosh Controls").effect("Smear Length")("Slider");\n' +
      'm * s';

    // R channel blurriness
    cblur.property(1).expression = smearExpr;
    // G channel blurriness
    cblur.property(2).expression = smearExpr;
    // B channel blurriness
    cblur.property(3).expression = smearExpr;

    // Displacement Map — luma-driven to make bright pixels smear more
    var disp = fx.addProperty('ADBE Displacement Map');
    disp.name = 'GM_Smear_Displace';
    // Use For Horizontal: Luminance=4
    disp.property(2).setValue(4);
    // Use For Vertical: None=1
    disp.property(4).setValue(1);
    // Edge Behavior: Wrap=1
    disp.property(7).setValue(1);

    disp.property(3).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var s = thisComp.layer("GlitchMosh Controls").effect("Smear Stretch")("Slider");\n' +
      'm * s * 2';
  }

  function _buildBlockCorruption(fx, params) {
    var blockSize  = params.blockSize   !== undefined ? params.blockSize   : 32;
    var offsetAmt  = params.blockOffset !== undefined ? params.blockOffset : 40;
    var chaos      = params.blockChaos  !== undefined ? params.blockChaos  : 50;
    var dropRate   = params.blockDropRate !== undefined ? params.blockDropRate : 6;
    var colorShift = params.blockColorShift !== undefined ? params.blockColorShift : 20;

    // Turbulent Displace — block-level displacement
    var td = fx.addProperty('ADBE Turbulent Displace');
    td.name = 'GM_Block_TurbDisplace';
    // Displacement type: Block=7
    td.property(1).setValue(7);
    // Size
    td.property(3).setValue(blockSize);
    // Complexity — keep low for blocky look
    td.property(5).setValue(1);

    _addSlider(fx, 'Block Size',       blockSize);
    _addSlider(fx, 'Block Offset',     offsetAmt);
    _addSlider(fx, 'Block Chaos',      chaos);
    _addSlider(fx, 'Block Drop Rate',  dropRate);
    _addSlider(fx, 'Block Color Shift', colorShift);

    td.property(3).expression =
      'thisComp.layer("GlitchMosh Controls").effect("Block Size")("Slider")';

    td.property(2).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var o = thisComp.layer("GlitchMosh Controls").effect("Block Offset")("Slider");\n' +
      'var c = thisComp.layer("GlitchMosh Controls").effect("Block Chaos")("Slider") / 100;\n' +
      'm * o * (0.5 + c * 0.5 * Math.sin(time * 7.3 + 1.1))';

    // Evolution driven by chaos + time for organic movement
    td.property(6).expression =
      'var c = thisComp.layer("GlitchMosh Controls").effect("Block Chaos")("Slider") / 100;\n' +
      'var seed = thisComp.layer("GlitchMosh Controls").effect("Master Seed")("Slider");\n' +
      'degrees(time * c * 3 + seed)';

    // Posterize Time — frame drop simulation
    var pt = fx.addProperty('ADBE Posterize Time');
    pt.name = 'GM_Block_PosterizeTime';
    pt.property(1).expression =
      'var base = thisComp.frameRate;\n' +
      'var drop = thisComp.layer("GlitchMosh Controls").effect("Block Drop Rate")("Slider");\n' +
      'drop < 1 ? base : drop';

    // Fractal Noise — drives colour shift overlay
    var fn = fx.addProperty('ADBE Fractal Noise');
    fn.name = 'GM_Block_FractalNoise';
    // Fractal Type: Basic=1
    fn.property(1).setValue(1);
    // Contrast
    fn.property(4).setValue(200);
    // Blending Mode: Color=9 - but we set opacity from colorShift slider
    fn.property(15).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var cs = thisComp.layer("GlitchMosh Controls").effect("Block Color Shift")("Slider") / 100;\n' +
      'm * cs * 100';
  }

  function _buildRGBSplit(fx, precomp, adj, params) {
    var hSplit      = params.rgbHSplit      !== undefined ? params.rgbHSplit      : 8;
    var vSplit      = params.rgbVSplit      !== undefined ? params.rgbVSplit      : 2;
    var chromaBleed = params.rgbChromaBleed !== undefined ? params.rgbChromaBleed : 40;

    _addSlider(fx, 'RGB H Split',      hSplit);
    _addSlider(fx, 'RGB V Split',      vSplit);
    _addSlider(fx, 'Chroma Bleed Amt', chromaBleed);

    // Find the source video layer in the precomp (original layer is last layer)
    var srcIdx = precomp.layers.length; // original video layer
    var src = precomp.layer(srcIdx);

    // Channel definitions
    // Shift Channels property values: Full Off=1, Red=2, Green=3, Blue=4, Alpha=5, Luma=6
    var channels = [
      { suffix: '_R', r: 2, g: 1, b: 1, hm:  1, vm:  0.5 },
      { suffix: '_G', r: 1, g: 3, b: 1, hm: -0.5, vm: -0.3 },
      { suffix: '_B', r: 1, g: 1, b: 4, hm: -1, vm:  0.2 }
    ];

    for (var i = 0; i < channels.length; i++) {
      var ch = channels[i];
      var dup = src.duplicate();
      dup.name = src.name + ch.suffix;
      dup.blendingMode = BlendingMode.SCREEN;
      dup.moveAfter(adj); // keep below adjustment layer, above original

      var dupFx = dup.property('ADBE Effect Parade');

      // Shift Channels — isolate this channel
      var sc = dupFx.addProperty('ADBE Shift Channels');
      sc.property(1).setValue(ch.r); // Take Red From
      sc.property(2).setValue(ch.g); // Take Green From
      sc.property(3).setValue(ch.b); // Take Blue From

      // Transform — offset position
      var tr = dupFx.addProperty('ADBE Transform');
      var hMult = ch.hm;
      var vMult = ch.vm;
      tr.property('ADBE Transform-0003').expression =  // Position
        '[thisComp.width/2 + thisComp.layer("GlitchMosh Controls").effect("RGB H Split")("Slider") * ' + hMult + ',' +
        ' thisComp.height/2 + thisComp.layer("GlitchMosh Controls").effect("RGB V Split")("Slider") * ' + vMult + ']';
    }

    // Chroma bleed on adjustment layer: Echo per channel accumulation
    var echoChroma = fx.addProperty('ADBE Echo');
    echoChroma.name = 'GM_RGB_ChromaBleed';
    echoChroma.property(2).setValue(-(1 / precomp.frameRate) * 2);
    echoChroma.property(3).setValue(2);
    echoChroma.property(6).setValue(6); // Blend operator

    echoChroma.property(4).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var cb = thisComp.layer("GlitchMosh Controls").effect("Chroma Bleed Amt")("Slider") / 100;\n' +
      'm * cb';
  }

  function _buildTemporalStutter(fx, params) {
    var stutterRate = params.stutterRate !== undefined ? params.stutterRate : 8;
    var holdDur    = params.holdDuration !== undefined ? params.holdDuration : 2;
    var stageSeed  = params.stutterSeed  !== undefined ? params.stutterSeed  : 7;

    _addSlider(fx, 'Stutter Rate',     stutterRate);
    _addSlider(fx, 'Hold Duration',    holdDur);
    _addSlider(fx, 'Stutter Seed',     stageSeed);

    // Posterize Time — locks frame rate to stutterRate when active
    var pt = fx.addProperty('ADBE Posterize Time');
    pt.name = 'GM_Stutter_PosterizeTime';

    pt.property(1).expression =
      'var fps = thisComp.frameRate;\n' +
      'var sr  = thisComp.layer("GlitchMosh Controls").effect("Stutter Rate")("Slider");\n' +
      'var seed = thisComp.layer("GlitchMosh Controls").effect("Master Seed")("Slider");\n' +
      'var sSeed = thisComp.layer("GlitchMosh Controls").effect("Stutter Seed")("Slider");\n' +
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var r = seedRandom(Math.floor(time * sr + seed * 7 + sSeed), true);\n' +
      'r < (m * 0.4) ? sr : fps';

    // CC Wide Time is a Cycore bundled effect — match string is "CC Wide Time"
    try {
      var cwt = fx.addProperty('CC Wide Time');
      cwt.name = 'GM_Stutter_WideTime';
      // Forward Steps
      cwt.property(1).expression =
        'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
        'var h = thisComp.layer("GlitchMosh Controls").effect("Hold Duration")("Slider");\n' +
        'Math.round(m * h)';
      // Backward Steps
      cwt.property(2).expression =
        'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
        'var h = thisComp.layer("GlitchMosh Controls").effect("Hold Duration")("Slider");\n' +
        'Math.round(m * h * 0.5)';
    } catch (e) {
      // CC Wide Time not installed — skip silently
    }
  }

  function _buildCompressionNoise(fx, params) {
    var noiseAmt   = params.noiseAmount  !== undefined ? params.noiseAmount  : 20;
    var grainSize  = params.grainSize    !== undefined ? params.grainSize    : 2;
    var ringIntens = params.ringIntensity !== undefined ? params.ringIntensity : 15;

    _addSlider(fx, 'Noise Amount',    noiseAmt);
    _addSlider(fx, 'Grain Size',      grainSize);
    _addSlider(fx, 'Ring Intensity',  ringIntens);

    // Fractal Noise — digital noise burst overlay
    var fn = fx.addProperty('ADBE Fractal Noise');
    fn.name = 'GM_Noise_Fractal';
    fn.property(1).setValue(1);   // Fractal Type: Basic
    fn.property(2).setValue(3);   // Noise Type: Block — pixelated noise
    fn.property(4).setValue(300); // Contrast — harsh
    fn.property(5).setValue(-150); // Brightness — mostly dark noise
    // Blending Mode: Screen=8
    fn.property(15).setValue(8);
    // Evolution driven by time for animated noise
    fn.property(12).expression =
      'var seed = thisComp.layer("GlitchMosh Controls").effect("Master Seed")("Slider");\n' +
      'degrees(time * 24 + seed * 100)';
    // Opacity
    fn.property(14).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var n = thisComp.layer("GlitchMosh Controls").effect("Noise Amount")("Slider") / 100;\n' +
      'm * n * 100';

    // Add Grain — codec quantisation noise texture
    var grain = fx.addProperty('ADBE Grain');
    grain.name = 'GM_Noise_Grain';
    // Viewing Mode: Final Output=2
    grain.property(1).setValue(2);
    // Intensity
    grain.property(2).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var n = thisComp.layer("GlitchMosh Controls").effect("Noise Amount")("Slider") / 100;\n' +
      'm * n * 0.3';
    // Size (grain size)
    grain.property(6).expression =
      'thisComp.layer("GlitchMosh Controls").effect("Grain Size")("Slider")';

    // Unsharp Mask inverted — fakes compression ringing on edges
    var usm = fx.addProperty('ADBE Unsharp Mask');
    usm.name = 'GM_Noise_EdgeRing';
    usm.property(3).setValue(0); // Threshold: 0 = affects all edges
    usm.property(1).expression =
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var r = thisComp.layer("GlitchMosh Controls").effect("Ring Intensity")("Slider") / 100;\n' +
      '-(m * r * 50)'; // Negative amount = dark ringing = compression halo
    usm.property(2).expression =
      'thisComp.layer("GlitchMosh Controls").effect("Grain Size")("Slider") * 0.5 + 1';
  }

  function _buildGlitchMask(fx, params) {
    var maskMode  = params.maskMode   !== undefined ? params.maskMode   : 0; // 0=Full,1=Bright,2=Dark,3=Edges
    var feather   = params.maskFeather !== undefined ? params.maskFeather : 20;

    _addSlider(fx, 'Mask Mode',    maskMode);
    _addSlider(fx, 'Mask Feather', feather);

    // Levels — used as luma threshold for Bright/Dark mask modes
    var levels = fx.addProperty('ADBE Levels2');
    levels.name = 'GM_Mask_Levels';
    // Channel: Alpha=4 — only affects alpha, acts as luma matte
    levels.property(1).setValue(4);

    // Input black point driven by Mask Mode
    levels.property(3).expression =
      'var mode = thisComp.layer("GlitchMosh Controls").effect("Mask Mode")("Slider");\n' +
      'var f = thisComp.layer("GlitchMosh Controls").effect("Mask Feather")("Slider") / 255;\n' +
      'mode === 1 ? (0.5 - f) : 0'; // Bright mode: cut darks

    levels.property(4).expression =
      'var mode = thisComp.layer("GlitchMosh Controls").effect("Mask Mode")("Slider");\n' +
      'var f = thisComp.layer("GlitchMosh Controls").effect("Mask Feather")("Slider") / 255;\n' +
      'mode === 2 ? (0.5 + f) : 1'; // Dark mode: cut brights
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return { apply: apply };

}()); // end GlitchMosh

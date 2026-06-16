# GlitchMosh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build GlitchMosh — a 6th plugin tab that applies a 7-stage datamosh simulation rig to a selected AE layer, with all parameters as keyframeable AE Effect Controls.

**Architecture:** The plugin follows the exact pattern of existing suite plugins: a JSX backend (`jsx/glitchmosh.jsx`) that builds an AE precomp + adjustment layer rig, a JS UI module (`js/plugins/glitchmosh/ui.js`) that collects params and calls `Bridge.call('glitchmosh.apply', params)`, wired into `jsx/dispatcher.jsx` and registered in `js/app.js` + `index.html`.

**Tech Stack:** ExtendScript ES3 (AE JSX), ScriptUI-style vanilla JS panel, AE native effects (Echo, Time Displacement, Channel Blur, Displacement Map, Turbulent Displace, Fractal Noise, Posterize Time, Shift Channels, Add Grain, Unsharp Mask, Slider Control)

---

## File Map

| File | Action |
|------|--------|
| `jsx/glitchmosh.jsx` | **Create** — ExtendScript rig builder |
| `js/plugins/glitchmosh/ui.js` | **Create** — Panel UI module |
| `jsx/dispatcher.jsx` | **Modify** — add include + route |
| `js/app.js` | **Modify** — register tab |
| `index.html` | **Modify** — add tab button + pane |
| `assets/presets/glitchmosh/heavy-bleed.json` | **Create** |
| `assets/presets/glitchmosh/block-party.json` | **Create** |
| `assets/presets/glitchmosh/subtle-glitch.json` | **Create** |
| `assets/presets/glitchmosh/rgb-drift.json` | **Create** |
| `assets/presets/glitchmosh/full-corrupt.json` | **Create** |

---

## Task 1: JSX Rig Builder — Scaffold + Master Controls

**Files:**
- Create: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Create the file with module shell and param defaults**

```javascript
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
  // Usage: sliderExpr('Master Intensity', 100) → expression string
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
```

- [ ] **Step 2: Commit scaffold**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): scaffold rig builder with master controls"
```

---

## Task 2: Stage 1 — Frame Bleed

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildFrameBleed` function inside the GlitchMosh IIFE (before the closing `return { apply }` line)**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 1 — frame bleed (Echo)"
```

---

## Task 3: Stage 2 — Pixel Smear

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildPixelSmear` function**

```javascript
  function _buildPixelSmear(fx, params) {
    var smearLen   = params.smearLength    !== undefined ? params.smearLength    : 120;
    var smearDir   = params.smearDirection !== undefined ? params.smearDirection : 0; // 0=H,1=V,2=Both
    var lumaThresh = params.smearLumaThresh !== undefined ? params.smearLumaThresh : 40;
    var stretch    = params.smearStretch   !== undefined ? params.smearStretch   : 50;

    // Channel Blur — directional blur for the smear base
    var cblur = fx.addProperty('ADBE Channel Blur');
    cblur.name = 'GM_Smear_ChanBlur';
    // Red, Green, Blue blurriness — drive from smear slider
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
```

- [ ] **Step 2: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 2 — pixel smear (Channel Blur + Displacement Map)"
```

---

## Task 4: Stage 3 — Block Corruption

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildBlockCorruption` function**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 3 — block corruption (Turbulent Displace + Posterize Time)"
```

---

## Task 5: Stage 4 — RGB + Chroma Bleed

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildRGBSplit` function**

> NOTE: True per-channel spatial offset cannot be done on a single adjustment layer. This function creates 3 duplicate video layers in the precomp (one per channel), each with Shift Channels + Transform offset + Screen blend mode. The adjustment layer keeps the chroma bleed Echo only.

```javascript
  function _buildRGBSplit(fx, precomp, adj, params) {
    var hSplit      = params.rgbHSplit      !== undefined ? params.rgbHSplit      : 8;
    var vSplit      = params.rgbVSplit      !== undefined ? params.rgbVSplit      : 2;
    var chromaBleed = params.rgbChromaBleed !== undefined ? params.rgbChromaBleed : 40;

    _addSlider(fx, 'RGB H Split',      hSplit);
    _addSlider(fx, 'RGB V Split',      vSplit);
    _addSlider(fx, 'Chroma Bleed Amt', chromaBleed);

    // Find the source video layer in the precomp (index 1 = bottom-most, adj is at top)
    // After precompose the original layer is index precomp.layers.length (last layer)
    var srcIdx = precomp.layers.length; // original video layer
    var src = precomp.layer(srcIdx);

    // Channel definitions: [name, takeRed, takeGreen, takeBlue, hMult, vMult]
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
```

- [ ] **Step 2: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 4 — RGB split + chroma bleed"
```

---

## Task 6: Stage 5 — Temporal Stutter

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildTemporalStutter` function**

```javascript
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

    // Expression: lerp between comp frame rate and stutter rate
    // driven by a seeded random to create irregular stutter
    pt.property(1).expression =
      'var fps = thisComp.frameRate;\n' +
      'var sr  = thisComp.layer("GlitchMosh Controls").effect("Stutter Rate")("Slider");\n' +
      'var seed = thisComp.layer("GlitchMosh Controls").effect("Master Seed")("Slider");\n' +
      'var sSeed = thisComp.layer("GlitchMosh Controls").effect("Stutter Seed")("Slider");\n' +
      'var m = thisComp.layer("GlitchMosh Controls").effect("Master Intensity")("Slider") / 100;\n' +
      'var r = seedRandom(Math.floor(time * sr + seed * 7 + sSeed), true);\n' +
      'r < (m * 0.4) ? sr : fps';

    // CC Wide Time is a Cycore bundled effect — match string is "CC Wide Time"
    // Adds ghost-frame smear around current frame
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
```

- [ ] **Step 2: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 5 — temporal stutter (Posterize Time + CC Wide Time)"
```

---

## Task 7: Stage 6 — Compression Noise

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildCompressionNoise` function**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 6 — compression noise (Fractal Noise + Add Grain + edge ringing)"
```

---

## Task 8: Stage 7 — Glitch Mask + Close IIFE

**Files:**
- Modify: `jsx/glitchmosh.jsx`

- [ ] **Step 1: Add `_buildGlitchMask` function and close the IIFE**

```javascript
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
```

- [ ] **Step 2: Verify the file is syntactically complete**

Open `jsx/glitchmosh.jsx` and confirm:
- All 7 `_build*` functions are defined inside the IIFE
- `apply` function calls all 7 build functions
- `return { apply: apply };` is the last line before `}());`
- No unclosed braces or missing semicolons

- [ ] **Step 3: Commit**

```bash
git add jsx/glitchmosh.jsx
git commit -m "feat(glitchmosh): stage 7 — glitch mask + close IIFE, jsx backend complete"
```

---

## Task 9: Wire into Dispatcher

**Files:**
- Modify: `jsx/dispatcher.jsx`

- [ ] **Step 1: Add include directive** — insert after the existing `particles.jsx` include line

```javascript
//@include "particles.jsx"
//@include "glitchmosh.jsx"
```

- [ ] **Step 2: Add dispatch route** — insert after the `particles.generate` route

```javascript
        else if (action === 'particles.generate')  result = ParticleEngine.generate(params);
        else if (action === 'glitchmosh.apply')    result = GlitchMosh.apply(params);
```

- [ ] **Step 3: Commit**

```bash
git add jsx/dispatcher.jsx
git commit -m "feat(glitchmosh): wire glitchmosh.apply into dispatcher"
```

---

## Task 10: Panel UI Module

**Files:**
- Create: `js/plugins/glitchmosh/ui.js`

- [ ] **Step 1: Create the full UI module**

```javascript
'use strict';

window.GlitchMoshUI = (function () {

  var _defaults = {
    masterIntensity:  100,
    masterSeed:       42,
    // Stage toggles
    bleedEnabled:     true,
    smearEnabled:     true,
    blockEnabled:     true,
    rgbEnabled:       true,
    stutterEnabled:   true,
    noiseEnabled:     true,
    // Stage 1: Frame Bleed
    bleedAmount:      70,
    bleedDecay:       80,
    bleedFrames:      3,
    bleedLumaThresh:  50,
    // Stage 2: Pixel Smear
    smearLength:      120,
    smearDirection:   0,
    smearLumaThresh:  40,
    smearStretch:     50,
    // Stage 3: Block Corruption
    blockSize:        32,
    blockOffset:      40,
    blockChaos:       50,
    blockDropRate:    6,
    blockColorShift:  20,
    // Stage 4: RGB Split
    rgbHSplit:        8,
    rgbVSplit:        2,
    rgbChromaBleed:   40,
    // Stage 5: Temporal Stutter
    stutterRate:      8,
    holdDuration:     2,
    stutterSeed:      7,
    // Stage 6: Compression Noise
    noiseAmount:      20,
    grainSize:        2,
    ringIntensity:    15,
    // Stage 7: Mask
    maskMode:         0,
    maskFeather:      20
  };

  var _state = Utils.deepClone(_defaults);
  var _sliders = {};
  var _toggles = {};
  var _status;

  function getParams() { return Utils.deepClone(_state); }

  function applyPreset(p) {
    Object.assign(_state, p);
    Object.keys(_sliders).forEach(function (k) {
      if (p[k] !== undefined) _sliders[k].setValue(p[k]);
    });
    Object.keys(_toggles).forEach(function (k) {
      if (p[k] !== undefined) _toggles[k].setValue(p[k]);
    });
  }

  function _section(container, label) {
    container.appendChild(Utils.el('div', { class: 'section-label' }, label));
  }

  function _slider(container, key, label, min, max, step, tooltip) {
    _sliders[key] = new Slider({
      label: label, min: min, max: max, step: step || 1,
      value: _state[key],
      tooltip: tooltip || '',
      onChange: function (v) { _state[key] = v; }
    });
    container.appendChild(_sliders[key].el);
  }

  function _toggle(container, key, label) {
    _toggles[key] = new Toggle({
      label: label, value: _state[key],
      onChange: function (v) { _state[key] = v; }
    });
    container.appendChild(_toggles[key].el);
  }

  function init(container) {
    // ── Master ──────────────────────────────────────────────────
    _section(container, 'Master');
    _slider(container, 'masterIntensity', 'Intensity %', 0, 100, 1, 'Scales all 7 stages');
    _slider(container, 'masterSeed',      'Random Seed',  0, 999, 1, 'Change the overall randomness');

    // ── Stage 1: Frame Bleed ────────────────────────────────────
    _toggle(container, 'bleedEnabled', 'Frame Bleed');
    _slider(container, 'bleedAmount',     'Amount %',     0, 100, 1);
    _slider(container, 'bleedDecay',      'Decay %',      0, 100, 1);
    _slider(container, 'bleedFrames',     'Frame Offset', 1, 10,  1);
    _slider(container, 'bleedLumaThresh', 'Luma Thresh',  0, 100, 1);

    // ── Stage 2: Pixel Smear ────────────────────────────────────
    _toggle(container, 'smearEnabled', 'Pixel Smear');
    _slider(container, 'smearLength',     'Smear Length', 0, 300, 1);
    _sliders.smearDirection = new ButtonGroup({
      tooltip: 'Smear direction',
      options: [
        { value: 0, label: 'H' },
        { value: 1, label: 'V' },
        { value: 2, label: 'Both' }
      ],
      value: _state.smearDirection,
      onChange: function (v) { _state.smearDirection = v; }
    });
    container.appendChild(_sliders.smearDirection.el);
    _slider(container, 'smearStretch', 'Stretch', 0, 100, 1);

    // ── Stage 3: Block Corruption ───────────────────────────────
    _toggle(container, 'blockEnabled', 'Block Corruption');
    _slider(container, 'blockSize',      'Block Size',   4,  128, 1);
    _slider(container, 'blockOffset',    'Offset',       0,  100, 1);
    _slider(container, 'blockChaos',     'Chaos',        0,  100, 1);
    _slider(container, 'blockDropRate',  'Drop Rate fps', 1, 30,  1);
    _slider(container, 'blockColorShift','Color Shift',  0,  100, 1);

    // ── Stage 4: RGB Split ──────────────────────────────────────
    _toggle(container, 'rgbEnabled', 'RGB + Chroma Bleed');
    _slider(container, 'rgbHSplit',      'H Split px',   0, 40,  1);
    _slider(container, 'rgbVSplit',      'V Split px',   0, 40,  1);
    _slider(container, 'rgbChromaBleed', 'Chroma Bleed', 0, 100, 1);

    // ── Stage 5: Temporal Stutter ───────────────────────────────
    _toggle(container, 'stutterEnabled', 'Temporal Stutter');
    _slider(container, 'stutterRate',   'Stutter fps',   1, 30,  1);
    _slider(container, 'holdDuration',  'Hold Frames',   1, 10,  1);
    _slider(container, 'stutterSeed',   'Stutter Seed',  0, 99,  1);

    // ── Stage 6: Compression Noise ──────────────────────────────
    _toggle(container, 'noiseEnabled', 'Compression Noise');
    _slider(container, 'noiseAmount',   'Noise %',    0, 100, 1);
    _slider(container, 'grainSize',     'Grain Size', 1, 10,  1);
    _slider(container, 'ringIntensity', 'Ring %',     0, 100, 1);

    // ── Stage 7: Glitch Mask ────────────────────────────────────
    _section(container, 'Glitch Mask');
    _sliders.maskMode = new ButtonGroup({
      tooltip: 'Which pixels get the glitch',
      options: [
        { value: 0, label: 'Full' },
        { value: 1, label: 'Bright' },
        { value: 2, label: 'Dark' },
        { value: 3, label: 'Edges' }
      ],
      value: _state.maskMode,
      onChange: function (v) { _state.maskMode = v; }
    });
    container.appendChild(_sliders.maskMode.el);
    _slider(container, 'maskFeather', 'Feather', 0, 100, 1);

    // ── Apply Button ────────────────────────────────────────────
    var applyBtn = Utils.el('button', { class: 'apply-btn' }, 'APPLY GLITCHMOSH');
    applyBtn.addEventListener('click', function () {
      _setStatus('Applying…', 'info');
      Bridge.call('glitchmosh.apply', getParams())
        .then(function (r) {
          _setStatus(r.error ? r.error : 'GlitchMosh rig built!', r.error ? 'error' : 'ok');
        })
        .catch(function (e) { _setStatus(String(e), 'error'); });
    });
    container.appendChild(applyBtn);

    _status = Utils.el('div', { class: 'status-msg' });
    container.appendChild(_status);
  }

  function _setStatus(msg, type) {
    if (!_status) return;
    _status.textContent = msg;
    _status.className = 'status-msg ' + (type || '');
  }

  return { init: init, getParams: getParams, applyPreset: applyPreset };

}());
```

- [ ] **Step 2: Commit**

```bash
git add js/plugins/glitchmosh/ui.js
git commit -m "feat(glitchmosh): panel UI module (GlitchMoshUI)"
```

---

## Task 11: Register Tab in app.js + index.html

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: Add GlitchMosh to app.js** — add `'glitchmosh'` to `_tabs` array and entries in all four maps

In `js/app.js`, update these four objects:

```javascript
var _tabs = ['slides', 'grids', 'glow', 'sorter', 'dist',
             'colorlab', 'gradient', 'patterns', 'physics', 'particles', 'glitchmosh'];

var _pluginNames = {
  // ... existing entries ...
  glitchmosh: 'GlitchMosh'
};

var _UIs = {
  // ... existing entries ...
  glitchmosh: window.GlitchMoshUI
};

var _pluginIds = {
  // ... existing entries ...
  glitchmosh: 'glitchmosh'
};
```

- [ ] **Step 2: Add tab button + pane to index.html**

Add the tab button inside `.tab-strip` after the last existing button:

```html
    <button class="tab-btn" data-tab="glitchmosh"
            role="tab" aria-selected="false" title="GlitchMosh">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M1 5 L5 1 L11 1 L15 5 L15 11 L11 15 L5 15 L1 11 Z"/>
        <line x1="4" y1="5" x2="12" y2="5"/>
        <line x1="2" y1="8" x2="7"  y2="8"/>
        <line x1="9" y1="8" x2="14" y2="8"/>
        <line x1="4" y1="11" x2="12" y2="11"/>
      </svg>
      Mosh
    </button>
```

Add the pane div + script tag after the last existing pane and before the closing `</body>` scripts block:

```html
  <div id="pane-glitchmosh" class="tab-pane" role="tabpanel" style="--tab-color:#e879f9;">
    <div id="controls-glitchmosh" class="plugin-controls"></div>
  </div>
```

Add script tag with the other plugin script includes:

```html
  <script src="js/plugins/glitchmosh/ui.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add js/app.js index.html
git commit -m "feat(glitchmosh): register tab in app.js and index.html"
```

---

## Task 12: Built-in Presets

**Files:**
- Create: `assets/presets/glitchmosh/heavy-bleed.json`
- Create: `assets/presets/glitchmosh/block-party.json`
- Create: `assets/presets/glitchmosh/subtle-glitch.json`
- Create: `assets/presets/glitchmosh/rgb-drift.json`
- Create: `assets/presets/glitchmosh/full-corrupt.json`

- [ ] **Step 1: Create all 5 preset files**

`assets/presets/glitchmosh/heavy-bleed.json`:
```json
{
  "name": "Heavy Bleed",
  "masterIntensity": 90, "masterSeed": 42,
  "bleedEnabled": true,  "bleedAmount": 90, "bleedDecay": 85, "bleedFrames": 6, "bleedLumaThresh": 30,
  "smearEnabled": true,  "smearLength": 80, "smearDirection": 0, "smearStretch": 40,
  "blockEnabled": false,
  "rgbEnabled": true,    "rgbHSplit": 4, "rgbVSplit": 1, "rgbChromaBleed": 60,
  "stutterEnabled": true, "stutterRate": 12, "holdDuration": 3, "stutterSeed": 7,
  "noiseEnabled": false,
  "maskMode": 0, "maskFeather": 20
}
```

`assets/presets/glitchmosh/block-party.json`:
```json
{
  "name": "Block Party",
  "masterIntensity": 85, "masterSeed": 13,
  "bleedEnabled": false,
  "smearEnabled": false,
  "blockEnabled": true,  "blockSize": 48, "blockOffset": 80, "blockChaos": 90, "blockDropRate": 8, "blockColorShift": 50,
  "rgbEnabled": true,    "rgbHSplit": 12, "rgbVSplit": 6, "rgbChromaBleed": 30,
  "stutterEnabled": true, "stutterRate": 6, "holdDuration": 4, "stutterSeed": 22,
  "noiseEnabled": true,  "noiseAmount": 30, "grainSize": 3, "ringIntensity": 20,
  "maskMode": 0, "maskFeather": 10
}
```

`assets/presets/glitchmosh/subtle-glitch.json`:
```json
{
  "name": "Subtle Glitch",
  "masterIntensity": 35, "masterSeed": 99,
  "bleedEnabled": true,  "bleedAmount": 30, "bleedDecay": 70, "bleedFrames": 2, "bleedLumaThresh": 60,
  "smearEnabled": true,  "smearLength": 40, "smearDirection": 0, "smearStretch": 20,
  "blockEnabled": false,
  "rgbEnabled": true,    "rgbHSplit": 3, "rgbVSplit": 1, "rgbChromaBleed": 15,
  "stutterEnabled": false,
  "noiseEnabled": true,  "noiseAmount": 10, "grainSize": 1, "ringIntensity": 5,
  "maskMode": 1, "maskFeather": 40
}
```

`assets/presets/glitchmosh/rgb-drift.json`:
```json
{
  "name": "RGB Drift",
  "masterIntensity": 75, "masterSeed": 55,
  "bleedEnabled": true,  "bleedAmount": 50, "bleedDecay": 60, "bleedFrames": 4, "bleedLumaThresh": 50,
  "smearEnabled": false,
  "blockEnabled": false,
  "rgbEnabled": true,    "rgbHSplit": 20, "rgbVSplit": 8, "rgbChromaBleed": 80,
  "stutterEnabled": false,
  "noiseEnabled": false,
  "maskMode": 0, "maskFeather": 20
}
```

`assets/presets/glitchmosh/full-corrupt.json`:
```json
{
  "name": "Full Corrupt",
  "masterIntensity": 100, "masterSeed": 1,
  "bleedEnabled": true,  "bleedAmount": 95, "bleedDecay": 90, "bleedFrames": 8, "bleedLumaThresh": 20,
  "smearEnabled": true,  "smearLength": 200, "smearDirection": 2, "smearStretch": 90,
  "blockEnabled": true,  "blockSize": 24, "blockOffset": 90, "blockChaos": 100, "blockDropRate": 4, "blockColorShift": 70,
  "rgbEnabled": true,    "rgbHSplit": 24, "rgbVSplit": 12, "rgbChromaBleed": 90,
  "stutterEnabled": true, "stutterRate": 4, "holdDuration": 6, "stutterSeed": 3,
  "noiseEnabled": true,  "noiseAmount": 60, "grainSize": 4, "ringIntensity": 40,
  "maskMode": 0, "maskFeather": 5
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/presets/glitchmosh/
git commit -m "feat(glitchmosh): 5 built-in presets"
```

---

## Task 13: End-to-End Verification in After Effects

> This task requires After Effects to be running. Deploy the extension first:
> Copy the project folder to `%AppData%\Roaming\Adobe\CEP\extensions\com.aeplugins.suite\`
> Enable debug mode: registry key `HKEY_CURRENT_USER\Software\Adobe\CSXS.11\PlayerDebugMode = 1`

- [ ] **Step 1: Basic apply test**

1. Open AE, create a new comp with a video layer
2. Duplicate the video layer, trim the duplicate to a 3-second range
3. Select the duplicate layer
4. Open the suite panel → click the Mosh tab
5. Leave all defaults, click **APPLY GLITCHMOSH**
6. Expected: Panel shows "GlitchMosh rig built!", a `_GlitchMosh` precomp appears in the project, the precomp contains the original layer + a "GlitchMosh Controls" adjustment layer

- [ ] **Step 2: Verify Effect Controls**

1. Select the "GlitchMosh Controls" layer inside the precomp
2. Open Effect Controls (Ctrl+5)
3. Expected: You see sliders — Master Intensity, Master Seed, Bleed Amount, Bleed Decay, Bleed Frames, Smear Length, Block Size, RGB H Split, etc.
4. Scrub the timeline — verify the effect is visible on the duplicate layer

- [ ] **Step 3: Verify keyframability**

1. With the "GlitchMosh Controls" layer selected, click the stopwatch on "Master Intensity"
2. Move to a different frame, change value to 0
3. RAM preview — expected: intensity animates between 0 and 100 over the cut

- [ ] **Step 4: Verify presets**

1. In the Mosh tab, click the preset "Full Corrupt"
2. Click APPLY GLITCHMOSH on a new layer
3. Expected: all sliders read high values, the rig looks heavily corrupted

- [ ] **Step 5: Error state test**

1. Deselect all layers (click empty timeline area)
2. Click APPLY GLITCHMOSH
3. Expected: Panel shows "Select a video layer to apply GlitchMosh."

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat(glitchmosh): complete — 7-stage datamosh rig, panel UI, presets, verified in AE"
```

---

## Quick Reference: AE Effect Property Strings Used

| Effect | Match String |
|--------|-------------|
| Echo | `ADBE Echo` |
| Time Displacement | `ADBE TimeDisplacement` |
| Channel Blur | `ADBE Channel Blur` |
| Displacement Map | `ADBE Displacement Map` |
| Turbulent Displace | `ADBE Turbulent Displace` |
| Fractal Noise | `ADBE Fractal Noise` |
| Posterize Time | `ADBE Posterize Time` |
| Shift Channels | `ADBE Shift Channels` |
| Add Grain | `ADBE Grain` |
| Unsharp Mask | `ADBE Unsharp Mask` |
| Levels | `ADBE Levels2` |
| Slider Control | `ADBE Slider Control` |
| Checkbox Control | `ADBE Checkbox Control` |
| CC Wide Time (Cycore) | `CC Wide Time` |

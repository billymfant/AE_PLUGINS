# Deep Glow — "Smooth & Soft" Retune (design spec)

**Date:** 2026-06-22
**Author:** Claude (Opus 4.8) + Billy
**Status:** Approved design, not yet implemented.
**Branch:** create `feat/glow-smooth-retune` off `main` (current work is on `feat/distort-native`; this is a separate effort).
**Component:** Deep Glow — native engine (`glow-native/`) + CEP panel (`js/plugins/glow/`, `jsx/glow.jsx`, `js/factory-presets.js`).

---

## Problem

On real footage (e.g. a bright product/food shot) the glow is **way too aggressive**: it
washes the whole frame to flat white/yellow, the sliders have almost no usable range (the
top 80% of travel does little, the bottom explodes), the **eyedropper doesn't sample
footage at all**, and the **factory presets glow the entire image** and look harsh — not
the smooth, soft, highlight-targeted bloom the user wants.

### Root causes (verified in code)

1. **Bloom accumulation is not energy-normalized.** `glow::bloom()` (`glow-native/core/glow_core.cpp`)
   sums every mip level weighted by `levelWeight` **without dividing by the total weight**
   (Soft falloff over ~6 levels ≈ 3.6× built-in gain). Result: **raising Radius also raises
   brightness** — unpredictable.
2. **Intensity is a raw linear multiplier.** `ReadParams` (`glow-native/ae/DeepGlowGPU.cpp`)
   sets `p.intensity = value/100`; default 150 → 1.5×, slider to 1000% native / 500% panel.
   Stacks on top of the un-normalized glow.
3. **Source Gain** (`value/100`, 0..4) multiplies again on the bright pass.
4. **Threshold is compared in linear light.** `extractBright` runs on the already-linearized
   image but the 0..255 threshold is an sRGB-style number, so it qualifies far more of the
   frame than the number implies → "everything glows."
5. **Screen blend** of bright glow over an already-bright frame races to white.
6. **Picker is fake.** The "Pick ⌖" eyedropper (`js/plugins/glow/ui.js`) only centers the
   band on a clicked position of the *in-panel gradient strip* — it never reads footage. The
   histogram backdrop is synthetic/decorative.
7. **Presets predate the native engine.** `js/factory-presets.js` glow presets use low
   thresholds (20–150) and high intensities (120–420) in the OLD linear math, and omit the
   native fields (`rangeMode`, `thresholdSoftness`, `rangeHigh`, `rangeHighSoft`,
   `linearLight`, `tonemap`, `highlightComp`, `glowDimensions`, `sourceGain`), so they fall
   back to "glow the whole selection" and blow out.

---

## Goals

- Glow is **tameable and smooth**: small slider moves stay controllable across the whole
  usable range; default look is gentle, not blown out.
- **Full power retained** — extreme HDR bloom still reachable at the top of Intensity (this
  is a re-curve, not a hard cap).
- **Radius decoupled from brightness** — Radius/Layers change spread & softness only.
- **Threshold is intuitive** — the number matches what gets selected (perceptual).
- **Real eyedropper** — Pick samples the actual footage pixel; the Glow-Selection backdrop
  shows a **real** luminance histogram of the frame.
- **Presets look good out of the box** — every factory preset targets the **bright spectrum**
  of the image (highlights, not the whole frame) and reads **smooth and soft**.

## Non-goals (explicitly out of scope)

- No hard ceiling / "bounded amount" mode (user chose gentle curve, full power).
- Source Gain stays a linear boost (not the main culprit).
- No control-layout / panel-simplification redesign (the deferred "Style + 3 sliders +
  Advanced" effort stays deferred — see memory `distort-panel-ux-feedback`).
- No new params beyond what's listed; tonemap defaults unchanged (Soft-clip).
- Mac/GPU-port and packaging work unchanged (see `2026-06-08-deepglow-native-cep-handoff.md`).

---

## The parity rule (must hold throughout)

The glow math has **two homes** that must stay bit-identical:
`glow-native/core/glow_core.cpp` (CPU, authoritative) and `glow-native/cuda/glow_cuda.cu`
(GPU mirror). Shared host+device helpers live in `glow-native/core/glow_params.h` (`GLOW_HD`).
**Any pixel-math change below must be made in both homes**, then verified with
`glow_parity.exe` (must stay `<1e-3` across all configs). Host-side scalar changes (e.g. the
Intensity curve in `ReadParams`) feed both paths and are parity-trivial.

---

## Workstream 1 — Engine retune

### 1a. Energy-normalize the bloom accumulation  *(decouples Radius from brightness)*

In `glow::bloom()` step 3 (the level-accumulation loop in `glow_core.cpp`), divide the
accumulated glow by the **sum of the level weights** before tint/intensity:

```
float wsum = 0.f;
for (int l = 0; l < n; ++l) wsum += levelWeight(l, n, p.falloff);
float wnorm = (wsum > 1e-6f) ? 1.f / wsum : 1.f;
// ...accumulate upsampleAdd(mips[l], glow, levelWeight(l,n,p.falloff), p.dimensions)...
// then scale the accumulated glow by wnorm (apply where gr/gg/gb are read in step 4,
// or scale the glow image once after the accumulation loop).
```

- The 9-tap upsample tent and 13-tap downsample already self-normalize; **only the
  across-levels sum is unnormalized**, so this is the single fix.
- After this, the bloom is energy-preserving: peak ≈ qualifying-source brightness,
  independent of how many levels `autoLevels(radius)` produced.
- **Mirror in `cuda/glow_cuda.cu`** wherever the per-level weights are accumulated/composited
  (compute the same `wnorm` host-side or in-kernel; keep the value identical to CPU).
- Consider exposing `wnorm` via a shared helper in `glow_params.h` so both homes compute it
  identically (preferred over duplicating the loop).

### 1b. Perceptual Intensity curve  *(gentle, full power retained)*

In `ReadParams` (`DeepGlowGPU.cpp`), replace `p.intensity = value/100` with a power curve.
Host-side, feeds both CPU+GPU — parity-trivial:

```
const float Pnom = 150.f;   // % that maps to the neutral ~1.0x glow
const float g    = 2.0f;    // curve exponent: <1 region is fine, top still reaches extreme
float P = (float)params[DG_INTENSITY]->u.fs_d.value;   // 0..1000 (native), panel uses 0..500
p.intensity = powf(P / Pnom, g);
```

- At default P=150 → 1.0× (neutral, with normalization this is a tasteful bloom).
- Low/mid travel is fine-grained; P=300→4×, P=500→~11× keep extreme HDR looks available.
- **`Pnom` and `g` are starting points — tune live** on the 4080 against the cookie shot so
  the default and the slider feel right. Document the final values in code comments.
- Keep the AE param definition range as-is (`PF_ADD_FLOAT_SLIDERX("Intensity %", 0,1000,...,150)`)
  so the displayed % is unchanged; only its mapping to the multiplier changes.

### 1c. Perceptual threshold  *(selection matches the number)*

In `extractBright` (`glow_core.cpp`) the qualifier `selValue(...)` currently runs on the
linearized pixels. Make the **selection** evaluate in display/sRGB space while the
**extracted color** stays linear (so the blur remains physically correct):

- Pass both the display-space source and the linear source into the extract step, OR
  re-encode the qualifier input with `lin_to_srgb` before calling `selValue` (luminance mode
  especially). Implementation choice left to the plan, but the **mask must be computed from
  perceptual values** and the **output color must remain linear** (`o = linColor * mask * gain`).
- Cleanest option: in `bloom()`, build the mask from `src` (pre-linearization) and apply it to
  `lin`. Refactor `extractBright(src, lin, p)` accordingly.
- **Mirror in `cuda/glow_cuda.cu`.** Re-run parity — this is the most parity-sensitive change.
- Verify the existing `glow_tests.exe` threshold/high-pass expectations still hold (update the
  fixtures if they asserted the old linear-space behavior, and note why).

---

## Workstream 2 — Real frame sampling (fixes Pick + the histogram)

### 2a. Grab the current frame (JSX)

Add `glow.grabFrame()` in `jsx/glow.jsx` (exposed through the bridge like `glow.apply`):

- Render the active comp's current frame to a temp PNG via
  `CompItem.saveFrameToPng(comp.time, file)` into the OS temp dir.
- **Fallback** if `saveFrameToPng` is unavailable in the host version: a minimal
  render-queue grab (add the frame to the RQ with a PNG output module to the temp file,
  render, remove the RQ item). Keep it to the single current frame.
- Return `{ path }` (and ideally the comp width/height). Downsizing for speed: a thumbnail
  (e.g. longest edge ≤ 512 px) is enough for both the preview and the histogram; downscale
  in the panel after load. ~0.5s grab is acceptable.

### 2b. In-panel preview + real histogram (CEP)

In `js/plugins/glow/ui.js`, in the Glow Selection widget:

- Add a small **frame thumbnail** (clickable) sourced from the grabbed PNG (load via an
  `Image`/offscreen canvas; CEP can read the temp file path).
- Compute a **real luminance histogram** from the thumbnail's pixels and **replace the
  synthetic decorative backdrop** (`draw()` currently draws a hard-coded gaussian) with it.
  The histogram is drawn behind the trapezoidal band on the same 0..255 axis so the band is
  placed against the actual pixel distribution.
- A **"Pick"** / grab button triggers `glow.grabFrame()` (debounced; show a brief "grabbing
  frame…" status). After it returns, refresh both the thumbnail and the histogram.

### 2c. Click-to-pick

- Clicking the **frame thumbnail** reads the pixel RGBA under the cursor, computes the
  qualifier for the **current Range Mode** (reuse the same luminance/saturation/hue formulas
  as `selValue` in `glow_params.h` — port to JS or keep a small JS mirror) and **centers the
  band** on that value with soft feet (mirror the existing `centerBand`: set `threshold` and
  `rangeHigh` around the picked value, `thresholdSoftness`/`rangeHighSoft` to a soft default).
- Sync sliders + commit (live-apply) exactly as the existing widget interactions do.
- The old behavior (clicking the gradient *strip* to center) can be dropped or kept as a
  secondary affordance — picking from the **frame** is the primary, real eyedropper.

---

## Workstream 3 — Preset rebuild (bright-spectrum, smooth & soft)

Rewrite the `glow` block in `js/factory-presets.js`. **Keep the 5 existing names**
(Soft Bloom, Neon, Aura, Flare, Dreamy); give each the **full native field set** so
`applyPreset()` (already guarded in `ui.js`) drives the native engine fully.

Design intent for **every** preset (values are the *new* engine units — tune live):

- **Target the bright spectrum:** higher `threshold` with feathered `thresholdSoftness` so
  glow lands on highlights, not the whole frame. `rangeMode: 1` (Luma), `rangeHigh: 255`
  (open top) unless a preset deliberately bands.
- **Smooth & soft:** `falloff: 'soft'`, generous `radius`, `linearLight: true`,
  `tonemap: 2` (Soft-clip) with a little `highlightComp` so highlights roll off.
- **Gentle intensity** in the new perceptual-curve units (post-retune; what *looks* right,
  not the old numbers).
- Include: `intensity, radius, layers, falloff, threshold, thresholdSoftness, rangeMode,
  rangeHigh, rangeHighSoft, invertRange, sourceGain, glowColor, colorize, tintAmount,
  saturation, hueShift, blendMode, glowDimensions, glowOnly, linearLight, tonemap,
  highlightComp, quality`.

Rough character per name (final numbers tuned in AE on the cookie shot):

| Preset | Character | Notes |
|---|---|---|
| Soft Bloom | gentle white highlight bloom | high threshold, big radius, soft, low intensity |
| Neon | punchy colored bloom on brights | colorize, tighter radius, exp/soft falloff, controlled intensity |
| Aura | wide soft colored halo | very large radius, soft, mid threshold, gentle |
| Flare | bright hot specular accents | high threshold (specular only), screen/add, moderate intensity |
| Dreamy | hazy soft-focus wash | large radius, soft, lowest intensity, slight desaturate, soft-clip |

Acceptance: applying each preset to the cookie footage produces a **soft, highlight-targeted**
glow that does **not** wash the frame.

---

## Workstream 4 — Build · parity · verify

1. Make 1a/1c (and any shared helper) in **both** `core/glow_core.cpp` and `cuda/glow_cuda.cu`;
   1b is host-only in `DeepGlowGPU.cpp`.
2. `cmake --build glow-native/build-cuda` then run:
   - `glow_tests.exe` — all CPU tests green (update threshold fixtures if behavior intentionally
     changed; note why).
   - `glow_parity.exe` — all configs `<1e-3`.
3. Rebuild the `.aex` (VS2022 + CUDA 13.3 + AE 2025 SDK on this PC):
   ```
   msbuild glow-native\ae\DeepGlowGPU.vcxproj /p:Configuration=Release /p:Platform=x64 ^
           "/p:CudaToolkitDir=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.3\"
   ```
   → `glow-native\build-ae\DeepGlowGPU.aex`. Copy into AE's `Plug-ins\` (admin; AE closed).
4. **Restart AE** (a panel reload does NOT reload the `.aex`).
5. Verify in-host on real footage: Intensity feels smooth end-to-end; Radius changes spread
   not brightness; Threshold selects intuitively; Pick samples the frame and centers the band;
   the histogram is real; all 5 presets look soft & highlight-targeted.

---

## Open decisions (resolved)

- Curve, not cap (full power retained). ✔
- Radius decoupled from brightness. ✔
- Perceptual threshold. ✔
- Pick = real footage sampling, delivered via in-panel **frame preview + real histogram**
  (panel can't intercept AE-viewer clicks). ✔
- Rebuild the 5 existing preset names with native fields. ✔
- `saveFrameToPng` with a render-queue fallback; ~0.5s grab acceptable. ✔

## Risks / watch-items

- **Parity drift** on 1a/1c — re-run `glow_parity.exe` after every edit to a math home.
- **`saveFrameToPng` availability** varies by AE version → the render-queue fallback must work.
- **Curve tuning is subjective** — `Pnom`/`g` and preset numbers need a live pass on the 4080;
  budget an iteration loop with the cookie footage.
- Existing `glow_tests.exe` fixtures may assume linear-space threshold; updating them is
  expected, not a failure — document the intent.

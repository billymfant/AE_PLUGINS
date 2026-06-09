# AE Plugin Suite — Final Phase (Ship-Ready) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Master plan — spans multiple subsystems.** Each phase (F0–F7) is independently shippable and can be promoted to its own detailed plan when picked up. Phases F2/F3 reference existing sub-plans rather than duplicating them.

**Goal:** Take the 3-tool suite (Distortions · Color Lab · Deep Glow) from "engines built, panel wired" to a signed, installable product verified inside After Effects.

**Architecture:** CEP panel at repo root (`index.html` + `js/` + `jsx/`) drives two native `.aex` engines (`ColorLab.aex`, `DeepGlowGPU.aex`) by match-name; Distortions stacks AE built-ins. The grading/glow math lives once in `*-native/core/` (CPU) mirrored in `*-native/cuda/` (GPU) with parity tests. Final phase = finish Color Lab's deferred engine features, polish Deep Glow, harden the panel, and package for distribution.

**Tech Stack:** ExtendScript (ES3) + CEP/CSInterface · C++17 AE SDK 25.6 (MSBuild/VS 2022) · CUDA (GPU mirror) · ZXPSignCmd / NSIS (packaging). Build env: see memory `native-build-setup` (SDK at `AfterEffectsSDK_25.6_61_win`, needs `sdk` junction).

---

## Current state (what's done — do NOT re-do)

- **Distortions** — complete: `jsx/distortions.jsx` maps 5 types to AE built-ins (Optics Compensation, Mesh Warp, Twirl, Wave Warp, Bulge); panel `js/plugins/distortions/ui.js`; 5 presets.
- **Color Lab** — `ColorLab.aex` built (CPU SmartRender). Live: primaries, 3-way wheels (relative-drag, smooth), **tone curves (Master+R/G/B, just shipped & compiled)**, output (linear/tonemap/highlight). 16 curated presets. Panel `js/plugins/colorlab/ui.js`, backend `jsx/colorlab.jsx`.
- **Deep Glow** — `DeepGlowGPU.aex` built (CPU+CUDA, parity-proven). Range-select luma/sat/hue + hue-shift, 1:1 render. Panel `js/plugins/glow/ui.js`, backend `jsx/glow.jsx`.
- **Engine extras already coded in `color-native/core/` but NOT wired into the `.aex`:** HSL secondary qualifier (`Params.hsl*`, applied in `gradePixel` 6b), scopes (`color_scopes.*`), GPU kernel (`cuda/color_cuda.cu`, parity proven).
- **Preview/Electron:** `preview.html` (3-tab mock) + `electron-app/suite-preview.js` (desktop window of the mock panel).

---

## Phase F0 — In-AE runtime verification (GATE — do first, needs AE on the 4080)

No new code; confirms the two freshly-built `.aex` files behave. Blocks F1–F5 (you tune what you can see).

- [ ] **F0.1** Copy `color-native\build-ae\ColorLab.aex` and `glow-native\build-ae\DeepGlowGPU.aex` into AE's `Plug-ins` folder; **fully restart AE** (panel reload does NOT reload an `.aex`).
- [ ] **F0.2** Confirm the CEP panel loads (`Window → Extensions → AE Plugin Suite`); if not, verify the junction into AE's CEP `extensions` folder + `PlayerDebugMode` (memory `cep-deployment`).
- [ ] **F0.3** Color Lab: drop footage, add an adjustment-layer grade, drag the **Master curve** → confirm it grades live and matches the panel preview shape. Repeat R/G/B.
- [ ] **F0.4** Deep Glow: confirm the **offset bug** is gone (handoff open-item #1 — 1:1 render, no shift) now that the rebuilt `.aex` is loaded.
- [ ] **F0.5** Record findings (per-tool) in a new `docs/handoffs/YYYY-MM-DD-final-phase-ae-verify.md`. Any defect → file as a task in the relevant phase below.

**Verification:** visual, in AE. Acceptance: curves grade correctly + glow has no offset.

---

## Phase F1 — Color Lab: curve-space color science (engine, testable headless)

**Problem:** Curves currently evaluate in **linear light** (`gradePixel` step 6, between linearize and delinearize), so a curve drawn around x=0.5 acts on a bright linear value, not perceptual mid-grey — it "feels wrong." Industry curve tools operate in display/gamma space.

**Decision needed from user first** (the "better color correction" discussion): evaluate curves in display space (de-linearize → curve → re-linearize) vs. a log space. Default recommendation: **display-space** (gamma 2.2 / sRGB encode) — simplest, matches DaVinci/Lumetri feel.

**Files:**
- Modify: `color-native/core/color_core.h` (`gradePixel`, the curve block)
- Modify: `color-native/tests/color_tests.cpp` (add curve-space test)
- Modify: `color-native/cuda/color_cuda.cu` (mirror — it shares `gradePixel`, so usually no change; verify)
- Verify parity: `color-native/cuda/color_parity.cpp`

- [ ] **F1.1 Write the failing test** in `color_tests.cpp`: a mid-grey-ish curve lift should map sRGB 0.5 input to the curve's y at x=0.5 (within tol), proving display-space eval.
```cpp
// curve that maps x=0.5 -> y=0.75 (identity elsewhere via 3 pts), display-space
Curve c; c.n=3; c.x[0]=0; c.y[0]=0; c.x[1]=0.5f; c.y[1]=0.75f; c.x[2]=1; c.y[2]=1; prepareCurve(c);
Params p; p.linearLight=true; p.curveMaster=c;
float r=0.5f,g=0.5f,b=0.5f; gradePixel(r,g,b,p);
// EXPECT r ≈ srgb(curve(linear_to_srgb(0.5)≈0.735)) re-encoded ≈ raised; assert r > 0.5f + 0.15f
assert(r > 0.65f);
```
- [ ] **F1.2 Run, verify it FAILS** under current linear-space eval.
Run: `color-native\build-cli.bat && color-native\color_tests.exe` → expect the new assert to fail.
- [ ] **F1.3 Implement** in `color_core.h` `gradePixel` step 6: wrap the curve evals — encode to display, apply curves, decode back, only when `P.linearLight`:
```cpp
// 6. curves — evaluate in DISPLAY space so the curve maps perceptual tones
if (P.curveMaster.n>=2 || P.curveR.n>=2 || P.curveG.n>=2 || P.curveB.n>=2) {
    if (P.linearLight){ r=linear_to_srgb(r); g=linear_to_srgb(g); b=linear_to_srgb(b); }
    r=evalCurve(P.curveMaster,r); g=evalCurve(P.curveMaster,g); b=evalCurve(P.curveMaster,b);
    r=evalCurve(P.curveR,r); g=evalCurve(P.curveG,g); b=evalCurve(P.curveB,b);
    if (P.linearLight){ r=srgb_to_linear(r); g=srgb_to_linear(g); b=srgb_to_linear(b); }
}
// curveLuma stays where it is (luma is perceptual already); leave as-is
```
- [ ] **F1.4 Run tests, verify PASS:** `color-native\color_tests.exe` → all pass.
- [ ] **F1.5 Re-prove CPU↔GPU parity:** `color-native\build-cuda.bat && color-native\color_parity.exe` → expect PASS (<1e-3). `gradePixel` is shared host/device so parity should hold automatically.
- [ ] **F1.6 Update the panel curve preview** if needed: `js/plugins/colorlab/ui.js` `_curveEval` already works in 0..1 display space, so the panel preview now MATCHES render — confirm no panel change required; note it in the commit.
- [ ] **F1.7 Rebuild `ColorLab.aex`** (memory `native-build-setup`) and **commit** engine + rebuilt `.aex`.

**Verification:** headless tests + parity pass; then F0-style eyeball in AE.

---

## Phase F2 — Color Lab: HSL secondary qualifier (wire engine → .aex → panel)

Engine already implements it (`gradePixel` 6b + `Params.hsl*`). A detailed sub-plan exists: **`docs/superpowers/plans/2026-06-09-color-tool-P4-hsl.md`** — follow it for the engine/CLI side. This phase adds the AE-shell + panel wiring it doesn't cover.

**Files:**
- Modify: `color-native/ae/ColorLab.h` (enum: add `CLP_HSL_ENABLE`, `CLP_HSL_HUE`, … before `CLP_CURVE_BASE`; bump `CL_NUM_PARAMS` math — keep curve base AFTER hsl)
- Modify: `color-native/ae/ColorLab.cpp` (`ParamsSetup` add ~11 hsl params; `ReadParams` map them)
- Modify: `jsx/colorlab.jsx` (push hsl params by name)
- Modify: `js/plugins/colorlab/ui.js` (new collapsible "HSL Secondary" section: enable toggle, hue-center picker, hue-width, sat/luma ranges, softness, hue/sat/luma adjust)
- Modify: `css/components.css` (qualifier widget styles)

- [ ] **F2.1** Insert HSL params in the enum **between `CLP_HICOMP` and `CLP_CURVE_BASE`** (so curve indices shift but stay contiguous after HSL). Update `ReadParams` + `ParamsSetup` accordingly. ⚠️ This moves `CLP_CURVE_BASE` — re-verify `ReadCurve` base math.
- [ ] **F2.2** Map params in `ReadParams` to `p.hslEnable/hslCenterHue/...` (units per `color_params.h`).
- [ ] **F2.3** Rebuild `.aex`; confirm clean compile.
- [ ] **F2.4** Add the panel section + `_state.hsl*` + `getParams`/`applyPreset`; push from `jsx/colorlab.jsx`.
- [ ] **F2.5** Verify in `preview.html` headlessly (section renders, params flow) then in AE (qualify a hue range, shift it).

**Verification:** CLI test from P4 plan; preview headless; AE eyeball.

---

## Phase F3 — Color Lab: scopes (histogram / waveform / vectorscope)

Engine done (`color-native/core/color_scopes.*`). No sub-plan doc exists yet — promote this to its own plan when picked up. The hard part is getting frame pixels from AE to the panel.

**Files:**
- Modify: `color-native/ae/ColorLab.cpp` (after grade, call `computeScopes()`, write blob to a memory-mapped temp file — spec `2026-06-09-color-tool-native-design.md` §6)
- Modify: `js/plugins/colorlab/ui.js` (+ new `js/plugins/colorlab/scopes.js`) to read the blob and draw canvases
- Modify: `jsx/colorlab.jsx` (handshake: temp-file path)

- [ ] **F3.1** Decide transport (memmap temp file vs. CEP `cep.fs`); document in a new `docs/superpowers/plans/<date>-color-tool-P5-scopes.md`.
- [ ] **F3.2** Emit scope blob from the `.aex`; rebuild.
- [ ] **F3.3** Panel reads + draws histogram/waveform/vectorscope in a collapsible "Scopes" section.
- [ ] **F3.4** Verify in AE (scopes track the grade live).

**Verification:** AE eyeball (no clean headless path — scopes need real frame pixels).

---

## Phase F4 — Color Lab: GPU SmartRender

CUDA kernel + parity already exist. Mirror Deep Glow's GPU path (`glow-native/ae/`).

**Files:**
- Modify: `color-native/ae/ColorLab.cpp` (add `PF_OutFlag2_SUPPORTS_GPU_RENDER_F32`, `GPUDeviceSetup/Setdown`, a `SmartRenderGPU` that dispatches `cuda/color_cuda.cu`)
- Modify: `color-native/ae/ColorLab.vcxproj` (CUDA build items — copy from `glow-native/ae/`)

- [ ] **F4.1** Copy glow's GPU plumbing pattern; adapt entry points.
- [ ] **F4.2** Build with CUDA; **verify CPU path still works** (GPU is additive).
- [ ] **F4.3** In AE on the 4080: confirm GPU acceleration (4K real-time) + output matches CPU.

**Verification:** AE on 4080; A/B GPU vs CPU frame.

---

## Phase F5 — Deep Glow polish (handoff open-items)

**Files:** `glow-native/ae/DeepGlowGPU.cpp`, `js/plugins/glow/ui.js`

- [ ] **F5.1 `Passes` slider** (open-item #2): decide — wire it to the level-weight ramp (`DeepGlowGPU.cpp:254` note) OR hide/relabel in `js/plugins/glow/ui.js`. Recommended: hide for v1 (Radius drives mips).
- [ ] **F5.2 Pick / histogram** (open-item #3): true eyedrop needs AE-side pixel sampling. Either implement footage sampling via ExtendScript, or label the histogram "preview" and the Pick as strip-relative. Recommended: label honestly for v1, real sampling post-ship.
- [ ] **F5.3** 4K/GPU real-time check on the 4080; tune preset defaults.

**Verification:** AE eyeball + perf.

---

## Phase F6 — Cross-cutting ship-readiness (panel + docs)

**Files:** `js/core/bridge.js`, `js/plugins/*/ui.js`, `CLAUDE.md`, `index.html`

- [ ] **F6.1 "Plugin not found" UX.** `jsx/colorlab.jsx`/`glow.jsx` already throw a clear error when the `.aex` is missing; surface it as a friendly panel banner with an "install" hint instead of a raw error in the status bar. File: `js/core/bridge.js` + each `ui.js` `_apply` catch.
- [ ] **F6.2 Update `CLAUDE.md`** — it still describes the OLD 5-plugin suite (Slides/Grids/Pixel Sorter/…). Rewrite the Plugins section to the 3 hero tools (Distortions/Color Lab/Deep Glow) to match `PROJECT_MAP.md`.
- [ ] **F6.3 Preset QA pass** — sanity-check all presets across the 3 tools in AE; retune any that clip or look off; ensure Color Lab presets optionally carry curve data where it improves the look.
- [ ] **F6.4 Per-tool QA matrix** — 8/16/32-bpc, with/without GPU, selected-layer vs adjustment-layer, undo grouping. Record pass/fail in the F0 verify doc.
- [ ] **F6.5** Bump versions: `CSXS/manifest.xml` ExtensionBundleVersion, `ColorLab.h`/`DeepGlowGPU` version macros.

**Verification:** AE matrix walk-through; CLAUDE.md matches reality.

---

## Phase F7 — Distribution & packaging (from the deepglow handoff D1–D6)

Independent of F1–F6; D1 can start anytime, D3+ need a Mac. Effort S/M/L per the handoff.

- [ ] **F7.1 (D1, S, Win)** `package-win.ps1` — bundle panel + both `.aex` + a README into a share-zip with `PlayerDebugMode` setup notes.
- [ ] **F7.2 (D2, M, Win)** Signed **`.zxp`**: create a self-signed cert, `ZXPSignCmd -sign` the extension → `AEPluginSuite.zxp`; ship with an NSIS installer that drops both `.aex` into Plug-ins and installs the ZXP (no PlayerDebugMode for end users).
- [ ] **F7.3 (D3, M, Mac)** Mac CPU-only `.plugin` from the SDK Xcode project (both engines), CPU path only.
- [ ] **F7.4 (D4, L, Mac)** Mac **Metal** GPU path — port the kernels.
- [ ] **F7.5 (D5, M, Mac)** Codesign (Developer ID) + notarize the `.plugin`.
- [ ] **F7.6 (D6, M)** Unified per-OS installer (NSIS/pkg) OR publish via **aescripts** marketplace.

**Recommended order:** D1 → D2 (Windows customer-ready) → D3 → D4/D5 → D6.

**Verification:** clean install on a second machine with NO dev setup → panel + effects work.

---

## Critical path & recommended order

```
F0 (verify) ──► F1 (curve space) ──► F2 (HSL) ──► F3 (scopes) ──► F4 (GPU)   [Color Lab → feature-complete]
        └─────► F5 (glow polish)
        └─────► F6 (ship-readiness)  ◄── gated by F0 findings
F7 (D1→D2) can run in parallel once F0 passes; D3–D6 after Windows is signed.
```
**Minimum ship-ready (Windows):** F0 + F1 + F5 + F6 + F7(D1,D2). HSL/scopes/GPU (F2–F4) and Mac (D3–D6) are post-v1 enhancers.

---

## Self-review (spec coverage)

- Color Lab deferred features (curves ✓ shipped, curve-space F1, HSL F2, scopes F3, GPU F4) — covered.
- Deep Glow open-items #1 (offset, F0.4), #2 (Passes, F5.1), #3 (Pick/histogram, F5.2), #4 (4K tune, F5.3/F6.3) — covered. #5 (electron) — intentionally not productized.
- Distribution D1–D6 — F7. CLAUDE.md staleness — F6.2. Plugin-not-found UX — F6.1. Versioning — F6.5.
- Build env caveat (SDK junction) — noted; see memory `native-build-setup`.
- Open dependency: **F1 needs the user's "better color correction" direction** before locking curve-space choice.

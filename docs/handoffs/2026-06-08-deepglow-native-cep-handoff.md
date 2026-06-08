# Handoff — Deep Glow: native `.aex` + CEP panel (range selection + hue)

**Date:** 2026-06-08
**Author:** Claude (Opus 4.8) + billymfant
**Status:** Working end-to-end in AE via the CEP panel. All pushed to `main`
(`github.com/billymfant/AE_PLUGINS`, commits `4b80638..b4dd643`).

> Supersedes the planning-stage `2026-06-05-native-glow-gpu-handoff.md`. For the deep
> engine history see memory `native-glow-gpu` and `docs/superpowers/plans/2026-06-05-native-glow-gpu.md`.

---

## What works now

**The native Deep Glow plugin is built and driven from inside AE.**
- `glow-native/build-ae/DeepGlowGPU.aex` — compiled C++/CUDA effect, match name
  `DKVB DeepGlowGPU`, category "AE Plugin Suite". Committed to the repo (273→284 KB).
- The **CEP panel** (repo root, junctioned into AE's CEP extensions as
  `com.aeplugins.suite`) drives it: **Window ▸ Extensions ▸ AE Plugin Suite ▸ Deep Glow**.
  `jsx/glow.jsx` applies the effect by match-name and pushes params; `js/plugins/glow/ui.js`
  is the UI. No COM, no Electron — runs in-host via `CSInterface.evalScript`.

**New this session (commit `4b0f1f0`):**
- **Glow Selection band** — `extractBright` (CPU `core/glow_core.cpp` + GPU
  `cuda/glow_cuda.cu`) generalized from a single luma high-pass to a **trapezoidal selection**
  on **luminance / saturation / hue**, with feathered low+high edges and **invert**. Shared
  host/device helpers `selValue` / `rangeMask` live in `core/glow_params.h` (`GLOW_HD` macro).
  Defaults reproduce the old high-pass exactly (backward-compatible).
- **Hue Shift** now actually applies (`hueRotate` in `applyTint`, both paths) — was a dead knob.
- New AE params: Range Mode, Range High, Range High Softness, Invert Range.
- **CPU↔GPU parity still passes** `<1e-6` across 6 configs (`glow_parity.exe`), incl. new
  `RANGE_SAT_HUE` and `RANGE_INVERT`. 14 CPU tests green (`glow_tests.exe`).

**Interactive widget (commit `93720ff`)** in `js/plugins/glow/ui.js`:
- Canvas trapezoid band over a mode gradient strip (Luma=gray ramp, Sat, Hue spectrum).
- **Drag the band: L/R = which range glows, up/down = Intensity** (plateau height). Knees =
  Threshold / Range High; feet = the softnesses. Range Mode segmented, Invert, **Pick**
  eyedropper, Range High sliders, a Cinematic section (Linear Light, Tonemap, Highlight Comp).
- Debounced live-apply (~160ms) — the effect is reused on the layer so dragging updates live.

---

## Open items / known issues

1. **Footage offset bug — FIX SHIPPED, needs AE restart to confirm.** The buffer-expansion
   path (`I_EXPAND_BUFFER`) was shifting the footage in-host, so it was **disabled** — the
   effect now renders **strictly 1:1** (GlobalSetup drops the flag; PiPL hex back to
   `0x2000400`; PreRender reports `result_rect = max_result_rect = output_request`, no outset).
   The installed `.aex` already matches this build (hash verified). **AE must be fully
   RESTARTED** to load a new compiled plugin — a panel reload does NOT reload the `.aex`. The
   "still offsets" report was AE running the pre-fix build from memory. **Action: restart AE,
   reapply, confirm no offset.** Trade-off: glow now clips at the frame edge (fine for
   full-frame footage). "Extend edges" returns later as an explicit toggle once the
   `output_origin` coordinates are verified in-host.

2. **`Passes` slider is read-but-ignored** (deliberate — Radius drives the mip levels).
   Decide: hide/relabel it, or wire it. Cosmetic.

3. **Widget polish (deferred — need test loops):**
   - Histogram backdrop is **decorative/synthetic** — real one needs AE to export frame pixels.
   - **Pick** centers the band on a clicked *strip* value, not yet sampling the actual footage
     pixel (true eyedrop-from-footage needs AE-side sampling).

4. **Preset-default tuning + in-AE 4K/GPU real-time check** — manual, needs the user on the 4080.

5. **`electron-app/`** is a superseded detour (COM bridge → "AE not running" / timeouts).
   Kept in repo as an alt vehicle; not the product. CEP is the path.

---

## How to build / install / run

**Rebuild the `.aex`** (this PC has the toolchain: VS2022 + CUDA 13.3 + AE 2025 SDK):
```
# from a VS Dev Shell (Enter-VsDevShell), at repo root:
msbuild glow-native\ae\DeepGlowGPU.vcxproj /p:Configuration=Release /p:Platform=x64 ^
        "/p:CudaToolkitDir=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.3\"
# -> glow-native\build-ae\DeepGlowGPU.aex
```
**Engine tests + parity** (Ninja build already configured at `glow-native/build-cuda`):
```
cmake --build glow-native/build-cuda   # then run:
glow-native/build-cuda/glow_tests.exe        # 14 CPU tests
glow-native/build-cuda/glow_parity.exe       # 6 CPU/GPU parity configs <1e-6
```
**Install:** copy `DeepGlowGPU.aex` into `…\Adobe After Effects 2024\Support Files\Plug-ins\`
(needs admin; AE must be closed or it's file-locked), then **restart AE**.

**Second PC setup** (after `git pull`):
1. Junction repo into CEP: `mklink /J "%APPDATA%\Adobe\CEP\extensions\com.aeplugins.suite" "<repo path>"`
2. `PlayerDebugMode = 1` (REG_SZ) under `HKCU\Software\Adobe\CSXS.11` (and `.12`).
3. Copy the committed `glow-native/build-ae/DeepGlowGPU.aex` into AE's Plug-ins folder (runs
   on Windows x64; CUDA needs NVIDIA, else CPU fallback). Restart AE.

---

## The math has TWO homes — keep them in parity
`core/glow_core.cpp` (CPU, authoritative) and `cuda/glow_cuda.cu` (GPU mirror). Change a weight
in one → change both → re-run `glow_parity.exe` (must stay `<1e-3`). Shared helpers that both
include live in `core/glow_params.h`.

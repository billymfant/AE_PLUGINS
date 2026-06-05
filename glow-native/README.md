# Deep Glow — Native GPU Plugin (C++ / CUDA / AE SDK)

A real compiled After Effects effect (`.aex`) that computes its own multi-pass glow
on the GPU. **Not** an ExtendScript wrapper around AE's built-in effects — this does
its own image math. See `../docs/handoffs/2026-06-05-native-glow-gpu-handoff.md` for
the why and the project history.

## Status

🟡 **Scaffold.** Architecture + parameter set + CUDA pipeline are in place. It compiles
once the AE SDK and CUDA are on the include path. Sections needing SDK-version
verification are marked `// VERIFY` in `DeepGlowGPU.cpp`.

| Piece | State |
|---|---|
| Parameter set (mirrors `jsx/glow.jsx`) | ✅ done (`DeepGlowGPU.h`) |
| CUDA glow pipeline (threshold → blur → tint → composite) | ✅ written (`DeepGlowGPU.cu`) |
| AE command dispatch + ParamsSetup | ✅ written (`DeepGlowGPU.cpp`) |
| GPU suite plumbing (device ptrs, stream, pre-render rects) | ⛔ `// VERIFY` — needs SDK present |
| CPU fallback render | ⛔ stub — mirror the `.cu` math |
| PiPL resource (`.r`) | ⛔ TODO |
| VS2022 project / build wiring | ⛔ TODO (see below) |

## Prerequisites (this PC)

1. **Visual Studio 2022** + workload **"Desktop development with C++"** (MSVC v143).
   *(being installed via winget: `Microsoft.VisualStudio.2022.Community`)*
2. **CUDA Toolkit** — winget installs **13.3** (current). Supports VS2022 17.x and
   target arch **`sm_89`** (RTX 4080, Ada).
   *(being installed via winget: `Nvidia.CUDA`)*
3. **After Effects SDK** — download from Adobe's developer portal (**requires Adobe
   login — manual step**). Use the **AE 2024** SDK (this PC's build target; a plugin
   built against 2024 also loads in AE 2026). Unzip somewhere stable, e.g.
   `F:\SDKs\AfterEffectsSDK`.

## Build (once prereqs are in place)

Set the SDK root so the headers in `DeepGlowGPU.cpp` resolve:
```
setx AESDK_ROOT  F:\SDKs\AfterEffectsSDK
```

Include paths needed by the compiler:
- `%AESDK_ROOT%\Examples\Headers`
- `%AESDK_ROOT%\Examples\Headers\SP`
- `%AESDK_ROOT%\Examples\Util`
- CUDA: `%CUDA_PATH%\include`   (CUDA_PATH is set by the toolkit installer)

Compile the CUDA kernels (Ada / RTX 4080, CUDA 13.3):
```
nvcc -c DeepGlowGPU.cu -o DeepGlowGPU.obj -arch=sm_89 -O3 ^
     -I "%AESDK_ROOT%\Examples\Headers"
```

Then build `DeepGlowGPU.cpp` with MSVC, link `DeepGlowGPU.obj` + `cudart.lib`, and
emit a `.aex` (it's a renamed `.dll`). The PiPL resource (`DeepGlowGPU.r`, TODO) must
be compiled with the SDK's `PiPLtool` and linked in — AE won't load the plugin without
a valid PiPL.

Install for testing (AE 2024):
```
copy DeepGlowGPU.aex "C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\"
```
It appears under **Effect ▸ AE Plugin Suite ▸ Deep Glow**.

> A proper `.vcxproj`/`.sln` (mirroring the AE SDK `GPU` samples, e.g. ProcAmp) will be
> added next. The AE SDK ships its samples as VS projects — easiest is to copy a GPU
> sample's project and swap in these sources.

## Architecture

```
                 ┌──────────── per glow pass (1..N) ────────────┐
  AE input  ──▶  threshold/extract  ──▶  Gaussian blur H/V  ──▶  composite  ──▶  accum
  (float4)        (soft knee)            (anamorphic-aware)       (Add/Screen,
                                                                  pass-weighted)
                                                                       │
                            accum over source ◀─────────────────────────┘  ──▶  AE output
```

- **Pass weights** (`DG_PassScale`) and **radius growth** (`DG_PassRadiusFactor`) match
  `_glowPassScale()` / `passRadiusFactor` in `jsx/glow.jsx`, so the native look matches
  the ExtendScript look.
- **Anamorphic** = blur only H or only V (`Glow Dimensions` popup).
- **CPU and GPU must produce identical math** — the CPU fallback mirrors the `.cu`
  kernels (Adobe requires a CPU path; the GPU path is what users actually hit).

## Files

| File | Role |
|---|---|
| `DeepGlowGPU.h`   | versions, param enum, `GlowParams` POD (shared w/ CUDA), pass weights |
| `DeepGlowGPU.cu`  | CUDA kernels + `extern "C"` launchers |
| `DeepGlowGPU.cpp` | AE entry point, ParamsSetup, render dispatch (CPU + GPU) |
| `DeepGlowGPU.r`   | PiPL resource (TODO) |

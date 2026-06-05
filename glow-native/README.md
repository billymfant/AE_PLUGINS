# Deep Glow Native — GPU bloom plugin for After Effects (C++ / CUDA / AE SDK)

A real compiled AE effect (`.aex`) that computes its own GPU-accelerated cinematic bloom —
**not** an ExtendScript panel wiring up AE's built-in effects. Commercial-grade, Windows-first.

> **Starting a fresh session? Read these two first, in order:**
> 1. **Spec** — `../docs/superpowers/specs/2026-06-05-native-glow-gpu-design.md`
> 2. **Implementation plan** — `../docs/superpowers/plans/2026-06-05-native-glow-gpu.md`  ← execute this task-by-task
>
> Background: `../docs/handoffs/2026-06-05-native-glow-gpu-handoff.md`

## Folder layout

```
glow-native/
  core/    pure-C++ bloom engine (the math; no AE/CUDA deps) — single source of truth
  cli/     glow_cli PNG-in/PNG-out harness + vendored stb (look iteration, AC tests)
  tests/   glow_tests — property-based acceptance tests (AC1–AC4)
  ae/      the compiled .aex: AE SDK shell + CUDA kernels + PiPL + VS2022 project
  CMakeLists.txt   builds core + cli + tests (the .aex is built by ae/ vcxproj)
  README.md        (this file)
```

The engine math lives **only** in `core/`. The AE CPU path links it; the CUDA kernels in
`ae/` mirror it. Change a weight → change both → re-run the CPU↔GPU parity test (AC4).

## Architecture (mip-pyramid bloom)

```
AE input (32f) ─▶ [linearize?] ─▶ threshold/extract ─▶ mip pyramid (downsample→upsample,
                  per-level falloff weights) ─▶ tint/sat ─▶ tonemap ─▶ composite ─▶ output
```
Radius → mip levels + spread · Falloff → per-level weight ramp · Glow Dimensions → anamorphic ·
Linear Light + Tonemap → the cinematic, never-clips-to-white look. Full rationale in the spec.

## Toolchain (this PC — all installed)

| Tool | Version |
|---|---|
| Visual Studio 2022 + "Desktop development with C++" | MSVC 14.44 |
| CUDA Toolkit | 13.3 (`sm_89`, RTX 4080) |
| After Effects SDK | **2025 (25.6)**, extracted, git-ignored |
| After Effects (runtime test target) | **2024** (PiPL min-version = 2024 → also loads in 2026) |

**SDK root:** `F:\APPS\AE_PLUGIN\AfterEffectsSDK_25.6_61_win\ae25.6_61.64bit.AfterEffectsSDK`
**GPU sample to mirror:** `…\Examples\Effect\SDK_Invert_ProcAmp`

## Build (core + cli + tests — works now)

From a "x64 Native Tools Command Prompt for VS 2022", at the repo root:
```
cmake -S glow-native -B glow-native/build -G "Visual Studio 17 2022" -A x64
cmake --build glow-native/build --config Debug
glow-native/build/Debug/glow_tests.exe        # acceptance tests
glow-native/build/Debug/glow_cli.exe in.png out.png --threshold 25 --radius 60 --intensity 150
```
(The `.aex` build via `ae/DeepGlowGPU.sln` comes online in plan Task 9 / milestone M0.)

## Status

🟡 Scaffold in `ae/` + approved spec & plan. Implementation proceeds via the plan
(M0 loads in AE → M1 CPU look correct → M2 CUDA parity + real-time → M3 cinematic params).
OpenCL (AMD/Intel) and Mac/Metal are post-v1.

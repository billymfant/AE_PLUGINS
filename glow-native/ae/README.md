# ae/ — the compiled After Effects effect (.aex)

The AE SDK plugin shell. Calls `core/` for the CPU (fallback) path and drives the CUDA
kernels for the GPU path. Built with the VS2022 project here (copied from the SDK's
`SDK_Invert_ProcAmp` GPU sample), NOT by the top-level CMake.

- `DeepGlowGPU.h` — AE param enum + `ReadParams → core::Params` bridge
- `DeepGlowGPU.cpp` — `EffectMain` dispatch, `ParamsSetup`, pre-render, CPU + GPU render
- `DeepGlowGPU.cu` — CUDA kernels mirroring `core/`
- `DeepGlowGPU.r` / `DeepGlowGPUPiPL.h` — PiPL resource, **min AE version = 2024**
- `DeepGlowGPU.vcxproj` / `.sln` — VS2022 build

Current contents are the first-sketch scaffold; the plan (Tasks 9–12) turns them into a
loadable, then GPU-accelerated, effect. SDK root:
`F:\APPS\AE_PLUGIN\AfterEffectsSDK_25.6_61_win\ae25.6_61.64bit.AfterEffectsSDK`.

# core/ — pure-C++ bloom engine

The glow math, with **zero** AE/CUDA dependencies. This is the single source of truth
for the look; the AE CPU path links it directly and the CUDA kernels mirror it.

- `glow_params.h` — `Params` POD + enums + `levelWeight()` / `autoLevels()`
- `glow_core.h` — `Image` type + engine API
- `glow_core.cpp` — `extractBright`, `downsampleHalf`, `upsampleAdd`, `bloom()`

Built by `../CMakeLists.txt` as the `glow_core` static library. See the plan
(`docs/superpowers/plans/2026-06-05-native-glow-gpu.md`) Tasks 2–7.

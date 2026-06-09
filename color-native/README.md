# color-native/ — native Color grading engine

Compiled color-correction engine for the AE suite
(spec: `docs/superpowers/specs/2026-06-09-color-tool-native-design.md`,
design language: `docs/design/DESIGN_LANGUAGE.md`).
Mirrors `glow-native/`. **P1 = CPU core + CLI + tests (this build, no AE needed).**

- `core/`  portable C++ pipeline (single source of truth): linearize → exposure →
  white balance → lift/gamma/gain → contrast → saturation → tone-map → delinearize.
- `cli/`   `color_cli` — PNG-in/PNG-out harness (stb).
- `tests/` `color_tests` — acceptance/property tests (AC1–AC3).

## Build & run (Windows; VS Developer env located via vswhere)
```
color-native\build-cli.bat
color-native\build\color_tests.exe          REM all tests pass -> "ALL PASS"
color-native\build\color_cli.exe in.png out.png --exposure 1.0 --sat 1.4
```

## CUDA parity build (P2)
```
color-native\build-cuda.bat
color-native\build\color_parity.exe          REM -> "PARITY PASS (<= 1e-03)"
```

Status: **P1–P5 DONE (engine complete).** CPU core + CLI + tests pass (`ALL PASS`); CUDA mirror
matches CPU within ~9e-7 (`PARITY PASS`, target <1e-3). Engine = primaries + 3-way wheels + tone
curves (`--scurve`) + HSL secondary qualifier (`--hsl ...`) + scopes (histogram/waveform/
vectorscope → serialized blob, `--scopes out.bin`). `gradePixel` is header-inline `CL_HD` — one
source of math for CPU & GPU. **Next: the `.aex` SDK shell (`ae/`) + CEP panel** — the bridge into
After Effects (verified on the AE machine, not this dev env).

## Scopes (P5)
`computeScopes()` in `core/color_scopes.{h,cpp}` builds RGB+luma histograms, a luma waveform, and a
vectorscope from the graded image, serialized via `writeScopeFile`/`readScopeFile` (blob the panel
reads). In AE the effect writes this to a memory-mapped temp file each render (panel-render fallback
documented in the spec). GPU scope reduction is a later perf option.

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

Status: **P1 + P2 DONE.** CPU core + CLI + tests pass (`ALL PASS`); CUDA mirror matches CPU
within ~9e-7 (`PARITY PASS`, target <1e-3). `gradePixel` is header-inline `CL_HD` — one source
of math for CPU & GPU. Next: P3 curves (LUT + editor), then P4 HSL, P5 scopes, then `.aex` + panel.

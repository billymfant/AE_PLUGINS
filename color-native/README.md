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

Status: **P1 DONE** — CPU core + CLI + tests pass (`ALL PASS`); CLI grades real frames correctly.
Next: P2 CUDA mirror + CPU↔GPU parity. Then `.aex` shell, then the panel.

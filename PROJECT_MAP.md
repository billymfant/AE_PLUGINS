# Project Map — where everything lives

> Quick orientation for the AE Plugin Suite repo. **The repo root IS the CEP panel**
> (it's junctioned into AE's CEP `extensions` folder), so the panel's files
> (`index.html`, `js/`, `css/`, `jsx/`, `CSXS/`) MUST stay at the root — moving them
> breaks AE loading and the native build paths. That's why this is a *map*, not a
> reshuffle.

## "Where is…?" quick reference

| You want… | It's here |
|---|---|
| The **Deep Glow panel UI** (the interactive widget) | `js/plugins/glow/ui.js` |
| The **Deep Glow ExtendScript** (applies the native effect) | `jsx/glow.jsx` |
| The **compiled Deep Glow plugin** (what AE loads) | `glow-native/build-ae/DeepGlowGPU.aex` |
| The **Deep Glow engine source** (the math) | `glow-native/core/` (CPU) + `glow-native/cuda/` (GPU) |
| The **Deep Glow AE SDK shell** (builds the `.aex`) | `glow-native/ae/` |
| The **Color Lab panel UI** (3-way wheels + primaries) | `js/plugins/colorlab/ui.js` |
| The **Color Lab ExtendScript** (drives the native effect) | `jsx/colorlab.jsx` |
| The **compiled Color Lab plugin** | `color-native/build-ae/ColorLab.aex` |
| The **Color Lab engine source** (the math) | `color-native/core/` (CPU) + `color-native/cuda/` (GPU) |
| The **shared panel design system** | `docs/design/DESIGN_LANGUAGE.md` |
| **Color Lab spec + phase plans (P1–P5)** | `docs/superpowers/specs/2026-06-09-color-tool-native-design.md` · `docs/superpowers/plans/2026-06-09-color-tool-P*.md` |
| **Deep Glow status + plans + distribution** | `docs/handoffs/2026-06-08-deepglow-native-cep-handoff.md` |
| **Engine tests / CPU-GPU parity** | `glow-native/tests/` · `glow-native/cuda/glow_parity.cpp` · `color-native/tests/` · `color-native/cuda/color_parity.cpp` |
| The (superseded) **Electron app** | `electron-app/` |
| **In-AE test screenshots** | `test/` |
| **Reference images** (incl. your Glow Selection ref) | `docs/reference/` |

## Top-level layout

```
AE_PLUGIN/
├─ index.html              CEP panel entry — the UI After Effects loads
├─ preview.html            standalone UI preview (open in a browser)
├─ CSXS/manifest.xml       CEP extension manifest (host = AEFT; -> index.html + jsx/dispatcher.jsx)
├─ lib/CSInterface.js      Adobe's CEP↔ExtendScript bridge lib
│
├─ js/                     PANEL FRONT-END (runs inside AE's panel)
│  ├─ app.js               panel bootstrap / tool loader
│  ├─ factory-presets.js   built-in presets
│  ├─ core/                bridge.js (calls jsx), events, presets, sections, utils
│  ├─ components/          reusable UI widgets: Slider, ButtonGroup, Dropdown,
│  │                       ColorPicker, Toggle, Tooltip, PresetBar
│  └─ plugins/<tool>/ui.js per-tool UI  ── Deep Glow = plugins/glow/ui.js · Color Lab = plugins/colorlab/ui.js
│
├─ css/                    theme.css · layout.css · components.css (widget styles)
│
├─ jsx/                    EXTENDSCRIPT BACKENDS (run in AE; loaded by dispatcher.jsx)
│  ├─ dispatcher.jsx       routes dispatch("tool.action", json) to each module
│  ├─ glow.jsx             Deep Glow → applies native "DKVB DeepGlowGPU" by match-name
│  ├─ colorlab.jsx         Color Lab → applies native "DKVB ColorLab" by match-name (smart apply)
│  └─ core/                shared helpers (utils.jsx, undo.jsx, …)
│
├─ glow-native/            DEEP GLOW NATIVE C++/CUDA PLUGIN (separate from the panel)
│  ├─ core/                portable CPU engine — glow_core.cpp, glow_params.h  (the math's home)
│  ├─ cuda/                GPU mirror — glow_cuda.cu  + glow_parity.cpp (AC4 parity)
│  ├─ ae/                  AE SDK shell — DeepGlowGPU.cpp/.h/.cu/.r/.vcxproj → builds the .aex
│  ├─ cli/                 glow_cli PNG-in/out harness
│  ├─ tests/               glow_tests.cpp (acceptance tests)
│  ├─ build-ae/            ►► DeepGlowGPU.aex  (the installable compiled plugin)
│  ├─ build/ build-cuda/   cmake build dirs (mostly gitignored)
│  └─ README.md            build steps + status
│
├─ color-native/           COLOR LAB NATIVE C++/CUDA ENGINE (mirrors glow-native/)
│  ├─ core/                CPU pipeline — color_core.cpp/.h, color_params.h, color_scopes.cpp/.h
│  │                       (linearize→exposure→WB→lift/gamma/gain→contrast→curves→HSL→sat→tonemap)
│  ├─ cuda/                GPU mirror — color_cuda.cu + color_parity.cpp (CPU↔GPU <1e-3)
│  ├─ ae/                  AE SDK shell — ColorLab.cpp/.h/.r/.vcxproj → builds ColorLab.aex
│  │                       (CPU path; GPU + curves + HSL + scopes are follow-ups — see ae/README.md)
│  ├─ cli/                 color_cli PNG-in/out harness (--exposure/--sat/--scurve/--hsl/--scopes)
│  ├─ tests/               color_tests.cpp (AC1 identity, curves, HSL, scopes)
│  ├─ build-ae/            ►► ColorLab.aex  (the installable compiled plugin)
│  ├─ build/               build output (gitignored)
│  ├─ build-cli.bat        MSVC build for cli+tests · build-cuda.bat  nvcc parity build
│  └─ README.md            build steps + P1–P5 status
│
├─ electron-app/           superseded standalone controller (COM bridge — not the product)
│
├─ docs/
│  ├─ handoffs/            session handoffs ── newest = 2026-06-08-deepglow-native-cep-handoff.md
│  ├─ design/             DESIGN_LANGUAGE.md — shared panel design system (the whole suite follows it)
│  ├─ superpowers/         specs/ + plans/ (native-glow + native Color Lab P1–P5)
│  └─ reference/           reference images (glow-selection-reference.png, …)
│
├─ test/                   in-AE test screenshots
├─ AE_PLUGIN_SUITE_SPECIFICATION.md   full product spec
├─ CLAUDE.md               project instructions for Claude Code
└─ sdk/                    vendored AE SDK 25.6 (gitignored — extract from the zstd zip;
                           color-native/ae builds against sdk/ae25.6_61…/Examples)
```

## The two halves (they ship + run together)
- **UI** = the CEP panel (`index.html` + `js/` + `css/` + `jsx/`), installed in AE's CEP
  `extensions` folder (here, via a junction to this repo).
- **Engines** = the `.aex` files, installed in AE's `Plug-ins` folder. The panel calls each by
  match-name — **Deep Glow** = `DKVB DeepGlowGPU` (`glow-native/build-ae/DeepGlowGPU.aex`),
  **Color Lab** = `DKVB ColorLab` (`color-native/build-ae/ColorLab.aex`). Panel + the matching
  `.aex` must both be present. (Separate `.aex` per tool is by design — they never collide.)

See the handoff (Deep Glow) and `color-native/README.md` + the Color spec for build/install details.

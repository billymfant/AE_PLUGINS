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
| The **compiled native plugin** (what AE loads) | `glow-native/build-ae/DeepGlowGPU.aex` |
| The **native engine source** (the math) | `glow-native/core/` (CPU) + `glow-native/cuda/` (GPU) |
| The **AE SDK shell** (builds the `.aex`) | `glow-native/ae/` |
| **Current status + plans + distribution** | `docs/handoffs/2026-06-08-deepglow-native-cep-handoff.md` |
| **Engine tests / CPU-GPU parity** | `glow-native/tests/` + `glow-native/cuda/glow_parity.cpp` |
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
│  └─ plugins/<tool>/ui.js per-tool UI  ── Deep Glow = plugins/glow/ui.js
│
├─ css/                    theme.css · layout.css · components.css (widget styles)
│
├─ jsx/                    EXTENDSCRIPT BACKENDS (run in AE; loaded by dispatcher.jsx)
│  ├─ dispatcher.jsx       routes dispatch("tool.action", json) to each module
│  ├─ glow.jsx             Deep Glow → applies native "DKVB DeepGlowGPU" by match-name
│  └─ core/                shared helpers (utils.jsx, undo.jsx, …)
│
├─ glow-native/            THE NATIVE C++/CUDA PLUGIN (separate from the panel)
│  ├─ core/                portable CPU engine — glow_core.cpp, glow_params.h  (the math's home)
│  ├─ cuda/                GPU mirror — glow_cuda.cu  + glow_parity.cpp (AC4 parity)
│  ├─ ae/                  AE SDK shell — DeepGlowGPU.cpp/.h/.cu/.r/.vcxproj → builds the .aex
│  ├─ cli/                 glow_cli PNG-in/out harness
│  ├─ tests/               glow_tests.cpp (acceptance tests)
│  ├─ build-ae/            ►► DeepGlowGPU.aex  (the installable compiled plugin)
│  ├─ build/ build-cuda/   cmake build dirs (mostly gitignored)
│  └─ README.md            build steps + status
│
├─ electron-app/           superseded standalone controller (COM bridge — not the product)
│
├─ docs/
│  ├─ handoffs/            session handoffs ── newest = 2026-06-08-deepglow-native-cep-handoff.md
│  ├─ superpowers/         specs/ + plans/ (native-glow design + 12-task plan)
│  └─ reference/           reference images (glow-selection-reference.png, …)
│
├─ test/                   in-AE test screenshots
├─ AE_PLUGIN_SUITE_SPECIFICATION.md   full product spec
├─ CLAUDE.md               project instructions for Claude Code
└─ AfterEffectsSDK_25.6_61_win/        vendored AE SDK (gitignored, not in the repo)
```

## The two halves (they ship + run together)
- **UI** = the CEP panel (`index.html` + `js/` + `css/` + `jsx/`), installed in AE's CEP
  `extensions` folder (here, via a junction to this repo).
- **Engine** = `DeepGlowGPU.aex`, installed in AE's `Plug-ins` folder.
  The panel calls the engine by match-name `DKVB DeepGlowGPU` — both must be present.

See the handoff for build/install/distribution details.

# Handoff — 2026-06-09 — Color Lab curves + final-phase plan

Wrapping for the day. Continuing tomorrow from the **office computer**. Everything below is
pushed to `main` (`github.com/billymfant/AE_PLUGINS`), HEAD = `5d93e01`.

## What shipped today (all on `main`)
1. **Repo pruned to 3 hero tools** (Distortions · Color Lab · Deep Glow). The 8 legacy tools
   (Slides/Grids/Sorter/Gradient/Patterns/Physics/Particles/GlitchMosh) were deleted from the
   tree — recoverable at tag `archive/pre-scope-reduction-2026-06-04`. `preview.html` rebuilt as
   a faithful 3-tab mirror (mock CEP bridge).
2. **Color Lab — smoother wheels:** relative drag (grab & nudge, no jump-to-cursor), cached
   trackball + rAF, Shift = fine, double-click = reset. `js/plugins/colorlab/ui.js`.
3. **Color Lab — 16 curated presets** (neutral→warm→cool→film→stylized). `js/factory-presets.js`.
4. **Color Lab — TONE CURVES (new):** panel editor (M/R/G/B tabs, click-add / drag / dbl-click-
   remove / per-channel reset, monotone-cubic preview) → jsx samples to 16-node LUT → native
   params. `ColorLab.aex` **rebuilt clean** with the curve params (VS 2022 + AE SDK 25.6).
5. **Final-phase plan** written: `docs/superpowers/plans/2026-06-09-final-phase-ship-ready.md`
   (F0–F7, also linked in `PROJECT_MAP.md`).

## Resume tomorrow (office machine)
1. `git pull` on `main` — gets all the above incl. the rebuilt `color-native/build-ae/ColorLab.aex`.
2. **Build env note (if you rebuild any `.aex`):** the vcxproj wants the AE SDK at
   `<repo>\sdk\ae25.6_61.64bit.AfterEffectsSDK\Examples`. On the home machine the SDK lives at
   `AfterEffectsSDK_25.6_61_win\` and is bridged by a gitignored `sdk` junction. If the office
   machine lacks `sdk\`, recreate the junction (PowerShell):
   `New-Item -ItemType Junction -Path .\sdk -Target .\AfterEffectsSDK_25.6_61_win`
   then `MSBuild color-native\ae\ColorLab.vcxproj /p:Configuration=Release /p:Platform=x64`.
3. **START WITH F0 (the gate):** copy `color-native\build-ae\ColorLab.aex` +
   `glow-native\build-ae\DeepGlowGPU.aex` into AE's `Plug-ins` folder, **fully restart AE**,
   then eyeball: do the **curves grade live** (Color Lab) and is the **Deep Glow offset gone**?

## Two decisions still open (needed before F1)
- **Curve space / "better color correction":** curves currently evaluate in **linear** light,
  which feels wrong. Plan F1 recommends switching to **display-space**. Bring your notes on what
  feels off (skin tones? highlights? saturation?) and we tune the engine + re-run CPU/GPU parity.
- **Execution mode for the plan:** subagent-driven (recommended) vs inline.

## Pointers
- Roadmap: `docs/superpowers/plans/2026-06-09-final-phase-ship-ready.md`
- Repo map: `PROJECT_MAP.md` · native build: `color-native/ae/README.md`
- Live UI preview without AE: open `preview.html`, or `electron-app/suite-preview.js`.

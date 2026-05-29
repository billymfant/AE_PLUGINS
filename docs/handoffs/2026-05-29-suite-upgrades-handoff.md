# Handoff — AE Plugin Suite (tool MVP upgrades)

**Date:** 2026-05-29
**Branch:** all work is on `main` (`origin/main`, GitHub `billymfant/AE_PLUGINS`). Head commit `6c4a99a`.
**Status:** Code complete + pushed. **NOT yet tested inside After Effects.** Validated only via `node --check` (ES3/syntax) + two-stage agent review (spec compliance + code quality). The real first test is loading the panel in AE.

---

## TL;DR for the next session
The suite is a CEP panel (HTML/JS front-end in `index.html` + `js/`) that talks to ExtendScript back-ends (`jsx/`) through a bridge. This session upgraded 5 existing tools to the MVPs defined in the `TOOL GUIDELINES/` spec files (the authoritative "what's wrong / how it must be" source), plus a prior 6th plugin (GlitchMosh) is already on main. Everything follows one theme from the specs: **stop applying static one-shot effects — build editable, controller-driven, animatable rigs.**

If the user reports an AE runtime error after installing, that's the expected next step — get the console error (see "Debugging in AE" below) and fix.

---

## How to deploy/run it at home (CEP install)
A CEP extension is **not** compiled — it's just this folder of files copied into AE's extensions directory. Steps (Windows):

1. **Get the code:** `git clone https://github.com/billymfant/AE_PLUGINS.git` (or `git pull` in an existing clone).
2. **Enable unsigned extensions (one time, registry):**
   ```powershell
   9..12 | ForEach-Object { reg add "HKCU\Software\Adobe\CSXS.$_" /v PlayerDebugMode /t REG_SZ /d 1 /f }
   ```
   (Sets PlayerDebugMode for CEP runtimes 9–12 → covers AE 2019–2025. The extension's manifest requires CSXS 9.0, host AEFT 16.0+.)
3. **Copy the folder into AE's extensions dir:**
   ```powershell
   $dest = "$env:APPDATA\Adobe\CEP\extensions\com.aeplugins.suite"
   robocopy "<path-to-repo>" $dest /MIR /XD ".git" ".superpowers" "docs" "TOOL GUIDELINES" /XF "preview-screenshot.png"
   ```
   Must end up with `...\com.aeplugins.suite\CSXS\manifest.xml` present.
4. **Restart AE**, then **Window → Extensions → AE Plugin Suite**.
5. Re-run step 3 + restart AE whenever the code changes.

**Bundle id:** `com.aeplugins.suite`. **`lib/CSInterface.js` is the real Adobe file** (44 KB) — bridge works.

---

## What's in the suite (12 tabs)
Order in `js/app.js` `_tabs`: slides, grids, glow, sorter, dist, colorlab, gradient, patterns, physics, particles, glitchmosh. (Note: root `CLAUDE.md` still says "5-plugin suite" — outdated.)

### This session's upgrades (5 tools, each: implementer → spec review → quality review → fixes)
1. **Distortions** (`jsx/distortions.jsx`, `js/plugins/distortions/ui.js`) — target modes (selected / duplicate / new-adjustment / selected-adjustment / precomp-adjustment); animation (loop/pingpong/drift/pulse/manualKeyframes, expressions OR baked keyframes) on the primary property per type (warp = static, no scalar primary); feathered circular mask.
2. **Pixel Sorter v2** (`jsx/sorter.jsx`, `js/plugins/sorter/ui.js`, presets in `js/factory-presets.js`) — target modes incl. adjustment-layer (in-place effect stack) & precomp rig; animation system (6 styles); threshold low/high + softness; angle; 8 sort modes (added green/blue/alpha/edges); `PIXEL_SORT_CONTROL` controller in rig mode; 8 presets.
3. **Slides v2** (`jsx/slides.jsx`, `js/plugins/slides/ui.js`) — source modes (empty / selected layers); card styling (bg/stroke/roundness/opacity); expanded entrance animations + 6 stagger modes (incl. fromEdges); live `SLIDES_CONTROL` controller with expression-driven layout.
4. **Deep Glow rig** (`jsx/glow.jsx`, `js/plugins/glow/ui.js`) — live `GLOW_CONTROLLER` null; multi-pass glow with expression-driven Radius/Intensity/Threshold; glow-only; source gain / threshold softness / tint.
5. **Grids — Layout Rig** (`jsx/grids.jsx`, `jsx/dispatcher.jsx`, `js/plugins/grids/ui.js`) — NEW `grids.createRig` action (separate from the existing pattern generator `grids.generate`): `GRID_CONTROL` null with 16 sliders + baked-item-index Position/Scale expressions, 6 fit modes (None/Fill/FitW/FitH/FitBest/Stretch), on selected layers.

---

## Known limitations & accepted tradeoffs (read before debugging — these are intentional, not bugs)
- **Distortions:** `warp` type has no animatable scalar → animation is skipped for warp (static only).
- **Pixel Sorter:** `thresholdSweep` animation style drives the Directional-Blur length (not a Levels/threshold prop) — meets the spec minimum but is named optimistically. `radial` direction falls back to horizontal (true radial sort is hard natively). `saturation` sort mode behaves like `brightness` (pre-existing).
- **Deep Glow:** the controller's Glow Intensity drives the AE **Glow effect's Intensity property** (live), not layer opacity (which is baked per-pass falloff). This is by design — the slider IS live.
- **Slides / Grids / Glow controllers:** applying twice creates a second controller null; each rig uses a **unique** controller name (`GLOW_CONTROLLER`, `GLOW_CONTROLLER_2`, `GRID_CONTROL_2`, …) so existing rigs aren't hijacked.
- **Data preservation:** rig expressions are only written to Position/Scale/Opacity when those properties have **no existing keyframes or expression** — so applying a tool won't silently destroy user animation. (If a tool "does nothing" to a layer, check whether that property was already keyframed.)
- **Grids Layout Rig** skips layers without a transform (cameras/lights/audio) and counts only rigged layers.

---

## AE verification checklist (do this at home, per tool)
For each: open a comp, select an appropriate layer, click the tool's apply/generate button.
- [ ] **Distortions** — select a layer, pick a type, toggle Animated (loop), Apply → effect appears & animates; try Target = New Adj → comp-sized adjustment layer created above selection.
- [ ] **Pixel Sorter** — select layer, Target = Adjustment Layer, Apply → `PIXEL_SORT_ADJ` with effect stack; try Apply Mode = Rig → `PIXEL_SORT_CONTROL` null appears and drives the look; load a preset.
- [ ] **Slides** — Generate with Empty source → card grid; enable Live Controller → `SLIDES_CONTROL` + `SLIDES_GROUP`, edit Columns slider and watch layout reflow; try Selected Layers source.
- [ ] **Deep Glow** — select a bright layer, Create Live Controller on, Apply → `GLOW_CONTROLLER` + glow passes; scrub Glow Radius/Intensity sliders on the controller → glow updates; toggle Glow Only checkbox.
- [ ] **Grids Layout Rig** — select several layers, set Fit Mode, click **Create Layout Rig** → `GRID_CONTROL` + layers snap into a grid; edit Columns/Gap sliders → layout updates live; reordering layers in the timeline must NOT change positions (baked index).
- [ ] **Error states** — click apply with nothing selected → friendly status message, no crash.

---

## Debugging in AE (if a tool throws)
1. Panel must be open in AE. Right-click inside the panel → if available, **Show Devtools / Inspect** (CEF devtools) → Console tab shows JS errors and the bridge's returned error string.
2. Alternatively, an optional `.debug` file enables remote Chrome devtools at `http://localhost:<port>` — not present by default; can be added if needed.
3. ExtendScript errors come back as `{ error: "..." }` and surface in the panel's status bar. Note the exact message.
4. Report the message + which tool/button + selection state. Most likely failure class: an AE effect **match-name or property index** differs in your AE version (the code uses `ADBE ...` match-names; some indices were chosen without an AE to verify against).

---

## Notes for the next Claude session
- **Validate JS without AE:** `node --check js/plugins/<x>/ui.js`; for `.jsx` pipe via stdin: `cat jsx/<x>.jsx | node --check --input-type=commonjs`. `node --check` is syntax-only — it will NOT catch ExtendScript-vs-modern-JS issues, so manually scan for `let`/`const`/arrow/`??`/template-literals/`Math.imul` in outer `.jsx` (expression STRINGS that run in AE are exempt and may use modern-ish JS).
- **Conventions:** UI modules are `window.XxxUI` IIFEs exposing `init/getParams/applyPreset`; components `Slider/ButtonGroup/Toggle/Dropdown/ColorPicker`; status `class="status-bar"` (+`error`/`success`), button `class="action-btn"`, sections `class="section-label"`. JSX modules are ES3 IIFEs using globals `withUndo`, `requireComp`, `hexToRgb`, `blendModeFromString`. Tabs registered in `js/app.js` (4 maps) + `index.html` (tab button + `pane-scroll` pane + script tag) + CSS color vars in `css/theme.css` + `css/layout.css`.
- **Factory presets** live in `js/factory-presets.js` (`window.FactoryPresets[pluginId]`), keyed by display name with params inline — NOT `assets/presets/*.json` (those folders are legacy).
- **Method used this session:** superpowers:subagent-driven-development (fresh subagent per task + spec-compliance review then code-quality review). The TOOL GUIDELINES specs are the source of truth for each tool's intended design.
- **Memory:** see `tool-upgrades-progress` and `project_state` in the project memory for status.

## Possible next work (not started)
- AE runtime verification + fixing whatever match-name/index issues surface.
- Post-MVP spec features deliberately skipped: Pixel Sorter glitch-extras/interval-mode/baked apply; Slides selectedComps & placeholder-precomp sources + slides.update/bake/release; Deep Glow chromatic/lens-dirt/anamorphic/tonemapping; Grids responsive weights/bento/line-rig/frames/precomp/bulk-replace.
- Clean up: `feat/suite-tool-upgrades` branch is a redundant duplicate of `main` (can be deleted). Update root `CLAUDE.md` (still says 5 plugins).

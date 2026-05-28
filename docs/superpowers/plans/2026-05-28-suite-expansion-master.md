# AE Plugin Suite Expansion — Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the 5-plugin AE suite to 10 plugins by adding Pattern Pro, Gradient Studio, Physics Rig, Color Lab, and Particle Engine.

**Architecture:** Each new plugin follows the established pattern — a JSX module (ExtendScript) handles AE layer manipulation, a JS UI module builds the panel controls, and both are wired into the existing dispatcher/app bootstrap. No new infrastructure is needed; all 5 plugins slot into existing hooks.

**Tech Stack:** ExtendScript (ES3), vanilla JS, CEP panel HTML/CSS, existing Slider/Dropdown/ButtonGroup/Toggle/ColorPicker/PresetBar components.

---

## Execution Order

Run these plans **in sequence** — each plugin is independent but all share the wiring in Task 1 below.

1. **This file — Task 1:** Shared wiring (index.html, app.js, dispatcher.jsx)
2. `2026-05-28-color-lab.md` — simplest plugin, good warm-up
3. `2026-05-28-gradient-studio.md`
4. `2026-05-28-pattern-pro.md`
5. `2026-05-28-physics-rig.md`
6. `2026-05-28-particle-engine.md` — most complex, do last

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `index.html` | Add 5 tab buttons + 5 panes |
| Modify | `js/app.js:4` | Add 5 tab IDs to `_tabs` array |
| Modify | `js/app.js:6-12` | Add 5 entries to `_UIs` map |
| Modify | `js/app.js:14-21` | Add 5 entries to `_pluginIds` map |
| Modify | `jsx/dispatcher.jsx:5-12` | Add 5 `#include` directives |
| Modify | `jsx/dispatcher.jsx:24-28` | Add 5 routing branches |
| Modify | `js/factory-presets.js` | Add 5 new plugin preset blocks |
| Modify | `preview.html` | Add 5 new pane builders |

---

## Task 1: Shared Wiring

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `jsx/dispatcher.jsx`

### index.html — add 5 tab buttons inside `.tab-strip`

- [ ] Open `index.html`. After the `dist` tab button (line ~73), add:

```html
    <button class="tab-btn" data-tab="colorlab"
            role="tab" aria-selected="false" title="Color Lab">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="8" cy="8" r="5.5"/>
        <path d="M8 2.5 L8 8 L12.5 5.5"/>
        <path d="M8 8 L3.5 10.5"/>
        <path d="M8 8 L8 13.5"/>
      </svg>
      Color
    </button>

    <button class="tab-btn" data-tab="gradient"
            role="tab" aria-selected="false" title="Gradient Studio">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <rect x="1.5" y="4" width="13" height="8" rx="1"/>
        <line x1="5" y1="4" x2="5" y2="12" stroke-opacity="0.5"/>
        <line x1="8.5" y1="4" x2="8.5" y2="12" stroke-opacity="0.7"/>
        <line x1="12" y1="4" x2="12" y2="12" stroke-opacity="0.4"/>
      </svg>
      Grad
    </button>

    <button class="tab-btn" data-tab="patterns"
            role="tab" aria-selected="false" title="Pattern Pro">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M8 1 L8 15"/>
        <path d="M1 8 L15 8"/>
        <path d="M3 3 L13 13"/>
        <path d="M13 3 L3 13"/>
      </svg>
      Patt
    </button>

    <button class="tab-btn" data-tab="physics"
            role="tab" aria-selected="false" title="Physics Rig">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="5" cy="4" r="2"/>
        <circle cx="11" cy="4" r="2"/>
        <path d="M5 6 Q5 11 8 13 Q11 11 11 6"/>
        <line x1="5" y1="4" x2="11" y2="4"/>
      </svg>
      Phys
    </button>

    <button class="tab-btn" data-tab="particles"
            role="tab" aria-selected="false" title="Particle Engine">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
        <circle cx="4" cy="9"  r="0.9" fill="currentColor" opacity="0.8"/>
        <circle cx="12" cy="9"  r="0.9" fill="currentColor" opacity="0.8"/>
        <circle cx="3"  cy="5"  r="0.7" fill="currentColor" opacity="0.6"/>
        <circle cx="8"  cy="4"  r="0.7" fill="currentColor" opacity="0.6"/>
        <circle cx="13" cy="5"  r="0.7" fill="currentColor" opacity="0.6"/>
      </svg>
      Parts
    </button>
```

- [ ] After the `pane-dist` pane div (~line 96), add 5 new panes:

```html
  <div class="tab-pane" id="pane-colorlab" role="tabpanel">
    <div class="pane-scroll" id="controls-colorlab"></div>
  </div>

  <div class="tab-pane" id="pane-gradient" role="tabpanel">
    <div class="pane-scroll" id="controls-gradient"></div>
  </div>

  <div class="tab-pane" id="pane-patterns" role="tabpanel">
    <div class="pane-scroll" id="controls-patterns"></div>
  </div>

  <div class="tab-pane" id="pane-physics" role="tabpanel">
    <div class="pane-scroll" id="controls-physics"></div>
  </div>

  <div class="tab-pane" id="pane-particles" role="tabpanel">
    <div class="pane-scroll" id="controls-particles"></div>
  </div>
```

- [ ] Before `</body>` add the 5 new UI script tags (after `distortions/ui.js`):

```html
<script src="js/plugins/colorlab/ui.js"></script>
<script src="js/plugins/gradient/ui.js"></script>
<script src="js/plugins/patterns/ui.js"></script>
<script src="js/plugins/physics/ui.js"></script>
<script src="js/plugins/particles/ui.js"></script>
```

- [ ] Add per-plugin tab colors to `css/theme.css` inside `:root`:

```css
  --colorlab-color:  #e879f9;
  --gradient-color:  #38bdf8;
  --patterns-color:  #a3e635;
  --physics-color:   #fb923c;
  --particles-color: #f0abfc;
```

- [ ] Add tab color bindings to `css/layout.css` after the `dist` binding:

```css
.tab-btn[data-tab="colorlab"]  { --tab-color: var(--colorlab-color); }
.tab-btn[data-tab="gradient"]  { --tab-color: var(--gradient-color); }
.tab-btn[data-tab="patterns"]  { --tab-color: var(--patterns-color); }
.tab-btn[data-tab="physics"]   { --tab-color: var(--physics-color); }
.tab-btn[data-tab="particles"] { --tab-color: var(--particles-color); }
```

### js/app.js — register the 5 new tabs

- [ ] Replace line 4 in `js/app.js`:

```js
  var _tabs = ['slides', 'grids', 'glow', 'sorter', 'dist',
               'colorlab', 'gradient', 'patterns', 'physics', 'particles'];
```

- [ ] Replace the `_UIs` block (lines 6–12):

```js
  var _UIs = {
    slides:    window.SlidesUI,
    grids:     window.GridsUI,
    glow:      window.GlowUI,
    sorter:    window.SorterUI,
    dist:      window.DistortionsUI,
    colorlab:  window.ColorLabUI,
    gradient:  window.GradientUI,
    patterns:  window.PatternsUI,
    physics:   window.PhysicsUI,
    particles: window.ParticlesUI
  };
```

- [ ] Replace the `_pluginIds` block (lines 14–21):

```js
  var _pluginIds = {
    slides:    'slides',
    grids:     'grids',
    glow:      'glow',
    sorter:    'sorter',
    dist:      'distortions',
    colorlab:  'colorlab',
    gradient:  'gradient',
    patterns:  'patterns',
    physics:   'physics',
    particles: 'particles'
  };
```

### jsx/dispatcher.jsx — include + route new modules

- [ ] Replace the `#include` block (lines 5–12):

```js
//@include "core/utils.jsx"
//@include "core/undo.jsx"
//@include "presets_io.jsx"
//@include "slides.jsx"
//@include "grids.jsx"
//@include "glow.jsx"
//@include "sorter.jsx"
//@include "distortions.jsx"
//@include "colorlab.jsx"
//@include "gradient.jsx"
//@include "patterns.jsx"
//@include "physics.jsx"
//@include "particles.jsx"
```

- [ ] Add 5 routing branches after line 28 (`distortions.apply`):

```js
        else if (action === 'colorlab.apply')    result = ColorLab.apply(params);
        else if (action === 'gradient.apply')    result = GradientStudio.apply(params);
        else if (action === 'patterns.generate') result = Patterns.generate(params);
        else if (action === 'physics.simulate')  result = PhysicsRig.simulate(params);
        else if (action === 'particles.generate') result = ParticleEngine.generate(params);
```

- [ ] Verify `dispatcher.jsx` now looks like this in full — confirm no duplicate lines, save.

- [ ] Open `preview.html`, add 5 new pane IDs and stub builders (copy pattern from existing panes).

- [ ] Commit:

```bash
git add index.html js/app.js jsx/dispatcher.jsx css/theme.css css/layout.css preview.html
git commit -m "feat: wire 5 new plugin slots into panel, dispatcher, and tab strip"
```

---

## Next

→ Continue with `2026-05-28-color-lab.md`

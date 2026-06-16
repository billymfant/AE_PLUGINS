# SP-1 UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shared component library + CSS to the approved "Compact Inline" design (one control per row, per-tool accents, collapsible sections, polished hover/edit states), inherited by all 3 hero tools.

**Architecture:** UI-only. The per-tool accent already flows through `--tab-color` (set per `#pane-X` in `css/layout.css`, consumed by components via `var(--tab-color, var(--accent))`). We (a) update the 3 hero accent values + add precomputed rgba tints, (b) restructure `Slider` from stacked to single-row inline, (c) add a non-invasive collapsible-section helper that toggles siblings after each `.section-label`, (d) polish tab strip / apply button / spacing. No `.jsx` changes. Component public APIs (`new Slider({...})`, etc.) stay intact.

**Tech Stack:** Vanilla ES3-safe JS, plain CSS (CEP Chromium ≈ Chrome 88 → no `color-mix()`, `:has()`, nesting, container queries; flexbox only), `node --check` for parse validation, visual check in the companion browser, final verify in After Effects.

**Reference:** Design spec `docs/superpowers/specs/2026-06-04-ui-redesign-design.md`. Approved mockup: `.superpowers/brainstorm/1095-1780575386/content/compact-panel-v2.html`.

**Branch:** `feat/suite-scope-reduction` (already checked out).

---

## File map

- `css/theme.css` — update 3 hero accent colors; add `--tab-soft` / `--tab-glow` rgba tints per pane (via layout.css pane blocks).
- `css/layout.css` — per-pane `--tab-color` + new rgba tints (hero panes only matter now); tab strip labels back on; collapsible `.section-label` chevron + `.collapsed`; apply/preset polish.
- `css/components.css` — Slider becomes single-row inline; value box + hover/edit states; `.component-slider.compact` for paired half-width use.
- `js/components/Slider.js` — restructure `_build()` markup to one row; keep API, `--track-fill`, `setValue`, `setEnabled`.
- `js/core/sections.js` — NEW small helper: make `.section-label`s collapsible by toggling following siblings.
- `js/app.js` — call the sections helper after each plugin's controls render.
- `index.html` — add `<script src="js/core/sections.js">` before `app.js`.

---

## Task 1: Hero accent colors + rgba tints

**Files:**
- Modify: `css/theme.css:33-43` (per-plugin colors)
- Modify: `css/layout.css:275-286` (per-pane `--tab-color` block)

- [ ] **Step 1: Update the 3 hero accent colors in theme.css**

Replace the three relevant lines in the `--*-color` block (`css/theme.css`) with the approved values; leave the archived tools' colors untouched (harmless, unused now):

```css
  --glow-color:       #f0a83a;   /* amber (was #fbbf24) */
  --dist-color:       #22b8cf;   /* cyan  (was #34d399) */
  --colorlab-color:   #e0559a;   /* magenta (was #e879f9) */
```

- [ ] **Step 2: Add precomputed rgba tints for the hero panes**

In `css/layout.css`, replace the hero lines inside the per-pane block (keep the other panes as-is) so each hero pane defines accent tints used by hover rings / apply glow (no `color-mix` — hardcoded rgba of each accent):

```css
#pane-dist      { --tab-color: var(--dist-color);
                  --tab-soft: rgba(34,184,207,0.18); --tab-glow: rgba(34,184,207,0.32); }
#pane-colorlab  { --tab-color: var(--colorlab-color);
                  --tab-soft: rgba(224,85,154,0.18); --tab-glow: rgba(224,85,154,0.32); }
#pane-glow      { --tab-color: var(--glow-color);
                  --tab-soft: rgba(240,168,58,0.18); --tab-glow: rgba(240,168,58,0.32); }
```

- [ ] **Step 3: Verify CSS loads (no parse tool for CSS — visual)**

Open `index.html` in a browser (or reload the companion). Expected: Distortions tab/accents render cyan, no console errors.

- [ ] **Step 4: Commit**

```bash
git add css/theme.css css/layout.css
git commit -m "style(ui): hero accent colors (cyan/magenta/amber) + rgba tints"
```

---

## Task 2: Slider → single-row compact inline

**Files:**
- Modify: `js/components/Slider.js:31-101` (`_build`)
- Modify: `css/components.css:1-105` (slider block)

- [ ] **Step 1: Restructure `Slider._build()` to one row**

Replace the body of `_build` (`js/components/Slider.js`) so the wrap is a single flex row `[label][track][value][reset]` instead of header-over-track. Keep all behavior, `--track-fill`, refs, and the API:

```javascript
Slider.prototype._build = function() {
  var self  = this;
  var wrap  = Utils.el('div', { class: 'component-slider' });
  var label = Utils.el('span', { class: 'slider-label' }, this.label);

  var track = document.createElement('input');
  track.type = 'range';
  track.className = 'slider-track';
  track.min = this.min; track.max = this.max; track.step = this.step; track.value = this.value;

  var input = document.createElement('input');
  input.type = 'number';
  input.className = 'slider-input';
  input.min = this.min; input.max = this.max; input.step = this.step; input.value = this.value;

  wrap.appendChild(label);
  wrap.appendChild(track);
  wrap.appendChild(input);

  if (this.defaultValue !== undefined) {
    var resetBtn = document.createElement('button');
    resetBtn.className = 'slider-reset';
    resetBtn.title = 'Reset to ' + this.defaultValue;
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', function(e) {
      e.preventDefault();
      self.setValue(self.defaultValue);
      self.onChange(self.defaultValue);
    });
    wrap.appendChild(resetBtn);
  }

  if (this.tooltip) wrap.setAttribute('data-tooltip', this.tooltip);
  self._fillTrack(track);

  var debounced = Utils.debounce(function(v) { self.onChange(v); }, 120);

  track.addEventListener('input', function() {
    var v = parseFloat(track.value);
    input.value = Utils.round(v, self.decimals);
    self.value = v;
    self._fillTrack(track);
    self._updateModified(v);
    debounced(v);
  });

  input.addEventListener('change', function() {
    var v = Utils.clamp(parseFloat(input.value) || 0, self.min, self.max);
    v = Utils.round(v, self.decimals);
    input.value = v; track.value = v; self.value = v;
    self._fillTrack(track);
    self._updateModified(v);
    self.onChange(v);
  });

  this._track = track;
  this._input = input;
  return wrap;
};
```

- [ ] **Step 2: Verify JS parses**

Run: `node --check js/components/Slider.js`
Expected: no output (exit 0).

- [ ] **Step 3: Rewrite the slider CSS block to the inline row**

Replace `css/components.css` lines 1–105 (the `/* Slider */` block through `.slider-reset:hover`) with:

```css
/* ── Slider (compact inline) ───────────────────────────────── */
.component-slider {
  display: flex;
  align-items: center;
  gap: 9px;
}

.slider-label {
  width: 58px;
  flex: none;
  color: var(--text);
  font-size: 11px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slider-track {
  -webkit-appearance: none;
  flex: 1;
  min-width: 0;
  height: 4px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--tab-color, var(--accent)) 0%,
    var(--tab-color, var(--accent)) var(--track-fill, 0%),
    var(--surface-4) var(--track-fill, 0%),
    var(--surface-4) 100%
  );
}

.slider-track::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #f2f2f2;
  border: none;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.6);
  transition: box-shadow var(--t-fast);
}
.component-slider:hover .slider-track::-webkit-slider-thumb,
.slider-track:active::-webkit-slider-thumb {
  box-shadow: 0 0 0 4px var(--tab-soft, rgba(255,255,255,0.08)), 0 1px 3px rgba(0,0,0,0.6);
}

.slider-input {
  width: 38px;
  flex: none;
  padding: 3px 0;
  text-align: center;
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--font-mono);
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-bright);
  -moz-appearance: textfield;
  transition: border-color var(--t-base), color var(--t-base);
}
.slider-input::-webkit-inner-spin-button,
.slider-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.component-slider:hover .slider-input,
.slider-input:focus { border-color: var(--tab-color, var(--accent)); color: #fff; }

.component-slider[data-modified] .slider-label { color: var(--tab-color, var(--accent)); }

.slider-reset {
  width: 14px;
  flex: none;
  font-size: 12px;
  color: var(--text-dim);
  opacity: 0;
  text-align: center;
  line-height: 1;
  transition: opacity var(--t-base), color var(--t-base);
}
.component-slider:hover .slider-reset { opacity: 0.65; }
.slider-reset:hover { opacity: 1; color: var(--tab-color, var(--accent)); }

/* Half-width / paired use inside .row-2 */
.row-2 .slider-label { width: 40px; }
```

- [ ] **Step 4: Visual verify in browser**

Reload `index.html` in a browser. Expected: every slider is one row — label left, track middle, value box right, ↺ on hover; track fill uses the tab accent.

- [ ] **Step 5: Commit**

```bash
git add js/components/Slider.js css/components.css
git commit -m "feat(ui): compact inline slider (label · track · value · reset on one row)"
```

---

## Task 3: Collapsible sections (non-invasive helper)

**Files:**
- Create: `js/core/sections.js`
- Modify: `index.html` (add script before `app.js`)
- Modify: `js/app.js` (call helper after plugin init)
- Modify: `css/layout.css:129-160` (`.section-label` block)

- [ ] **Step 1: Create the helper**

Create `js/core/sections.js`. It finds each `.section-label` in a container, prepends a chevron, and on click toggles visibility of all following siblings until the next `.section-label`:

```javascript
'use strict';

var Sections = (function () {
  function _siblingsUntilNextLabel(label) {
    var out = [], n = label.nextElementSibling;
    while (n && !n.classList.contains('section-label')) {
      out.push(n);
      n = n.nextElementSibling;
    }
    return out;
  }

  function makeCollapsible(container) {
    var labels = container.querySelectorAll('.section-label');
    Array.prototype.forEach.call(labels, function (label) {
      if (label.getAttribute('data-collapsible')) return;
      label.setAttribute('data-collapsible', '1');

      var chev = document.createElement('span');
      chev.className = 'sec-chevron';
      chev.textContent = '▾';
      label.insertBefore(chev, label.firstChild);

      label.addEventListener('click', function () {
        var collapsed = label.classList.toggle('collapsed');
        var sibs = _siblingsUntilNextLabel(label);
        for (var i = 0; i < sibs.length; i++) {
          sibs[i].style.display = collapsed ? 'none' : '';
        }
      });
    });
  }

  return { makeCollapsible: makeCollapsible };
}());
```

- [ ] **Step 2: Verify JS parses**

Run: `node --check js/core/sections.js`
Expected: no output (exit 0).

- [ ] **Step 3: Load the helper in index.html**

In `index.html`, add this line in the Core utilities block (after `js/core/presets.js`, before the components):

```html
<script src="js/core/sections.js"></script>
```

- [ ] **Step 4: Call the helper after each plugin renders**

In `js/app.js`, inside `_initPlugins()`'s `forEach`, after `ui.init(controls);` add:

```javascript
      if (window.Sections) Sections.makeCollapsible(controls);
```

- [ ] **Step 5: Verify app.js parses**

Run: `node --check js/app.js`
Expected: no output (exit 0).

- [ ] **Step 6: Add chevron + collapsed CSS**

Replace the `.section-label` block in `css/layout.css` (lines 129–160) with a version that includes the chevron and clickable affordance (keep the colored bar `::before` and trailing line `::after`):

```css
/* ── Section Labels (collapsible) ──────────────────────────── */
.section-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin: 13px 0 7px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}

.sec-chevron {
  font-size: 8px;
  color: var(--text-dim);
  transition: transform var(--t-fast);
  flex-shrink: 0;
}
.section-label.collapsed .sec-chevron { transform: rotate(-90deg); }

.section-label::before {
  content: '';
  width: 2px;
  height: 10px;
  background: var(--tab-color, var(--border-light));
  border-radius: 2px;
  flex-shrink: 0;
  opacity: 0.9;
}

.section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.section-label:hover { color: var(--text); }
.section-label:first-child { margin-top: 2px; }
```

- [ ] **Step 7: Visual verify**

Reload `index.html`. Expected: section headers show a ▾; clicking one hides/shows its controls and rotates the chevron.

- [ ] **Step 8: Commit**

```bash
git add js/core/sections.js index.html js/app.js css/layout.css
git commit -m "feat(ui): collapsible section headers via shared Sections helper"
```

---

## Task 4: Tab strip labels + Apply/Preset polish

**Files:**
- Modify: `css/layout.css:8-59` (tab strip), `162-188` (action button)

- [ ] **Step 1: Bring back tab labels (3 tabs now have room)**

In `css/layout.css`, in the tab strip block: remove the `.tab-btn { font-size: 0; }` rule (line ~38) and give the button a readable label. Replace the `.tab-btn` font-size override and svg rule region with:

```css
.tab-btn {
  font-size: 9.5px;
  gap: 4px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.tab-strip { height: 46px; }
```

(The button already stacks icon over text via `flex-direction: column`; the SVG label text node renders below.)

- [ ] **Step 2: Polish the Apply (action) button with accent glow**

In `css/layout.css`, update `.action-btn:hover` to use the per-tool glow tint:

```css
.action-btn:hover {
  filter: brightness(1.12);
  box-shadow: 0 3px 14px var(--tab-glow, rgba(255,255,255,0.12)), 0 1px 0 rgba(0,0,0,0.4);
}
```

- [ ] **Step 3: Visual verify**

Reload `index.html`. Expected: 3 tabs show icon + label (Dist / Color / Glow); active tab cyan; Apply button glows in the tool accent on hover.

- [ ] **Step 4: Commit**

```bash
git add css/layout.css
git commit -m "style(ui): 3-tab labels + accent-tinted apply button glow"
```

---

## Task 5: Final integration verify

**Files:** none (verification only)

- [ ] **Step 1: Parse-check all touched JS**

Run: `node --check js/components/Slider.js; node --check js/core/sections.js; node --check js/app.js`
Expected: all exit 0, no output.

- [ ] **Step 2: Full visual sweep in browser**

Open `index.html`, click through all 3 tabs (Dist / Color / Glow). Confirm: compact inline sliders, per-tool accent changes per tab, sections collapse, hover/edit/reset states work, no console errors.

- [ ] **Step 3: Hand to user for AE verification**

Ask the user to deploy the panel in After Effects and screenshot the 3 tabs. Confirm readability at docked width and that nothing regressed. (No AE in dev env — this is the only true runtime check.)

- [ ] **Step 4: Final commit if any tweaks**

```bash
git add -A
git commit -m "chore(ui): SP-1 redesign integration verified"
```

---

## Self-review notes (coverage check)

- Compact inline layout → Task 2 ✓
- Per-tool accents (cyan/magenta/amber) → Task 1 ✓
- Collapsible sections → Task 3 ✓
- Paired rows → handled via existing `.row-2` + `.row-2 .slider-label` rule in Task 2 (plugins wrap pairs in `.row-2`; no per-plugin markup change needed now).
- Hover/edit/reset slider states → Task 2 ✓
- Tab strip / apply / preset polish → Task 4 ✓
- CEP Chrome-88 constraint (no color-mix) → all colors are hex/rgba; verified no `color-mix()` introduced ✓
- Component APIs unchanged → Slider keeps `new Slider({...})`, `setValue`, `setEnabled`; other components untouched ✓
- `.jsx` untouched ✓
```

# Color Lab — Preset Overhaul (Phase B) Design

**Date:** 2026-06-10
**Branch target:** `main`
**Scope:** Re-author the Color Lab factory presets for the display-space engine.
Panel/data only — no `.aex`, no engine change.

## Why

The current 16 colorlab presets in `js/factory-presets.js` were tuned for the OLD
linear-light pipeline and hard-code `linearLight: true` + `tonemap: 2/3`. The engine
default flipped to **display space** (`linearLight: false`, `tonemap: 1`/None) on
2026-06-10 to fix "everything too intense." On the current engine these presets are
overcooked and feel like IG filters, and they don't use the now-working tone curves.

## Positioning (the lens for every value)

Color Lab is a **fast in-AE color tool**. Editors with good footage that needs real
grading go to DaVinci. So presets are tasteful one-click **starting points** — look
good immediately, never overcooked, leave room to nudge. No film-stock emulation, no
LUT accuracy chasing. Authored from descriptions, fully native.

## The Set — 12 presets, balanced 6 fix / 6 look

**Fix-first (correct fast):**
1. **Neutral Punch** — gentle contrast + micro-saturation; clean general improvement.
2. **Warm Up** — temperature + a touch of warmth in gamma.
3. **Cool Down** — temperature − ; slightly cooler shadows.
4. **Flat → Pop** — recover flat/log-ish footage: contrast + sat + gentle S-curve.
5. **Soft Contrast** — gentle S-curve only (curve-driven), minimal slider moves.
6. **Bright & Clean** — exposure lift + Soft-clip tonemap so highlights roll off, not clip.

**Stylized looks (instant vibe):**
7. **Teal & Orange** — restrained classic; warm gain, teal lift.
8. **Cinematic Warm** — filmic warm + soft S-curve.
9. **Moody Blue** — cold, low-key, slightly desaturated.
10. **Vintage Fade** — lifted toe (lift luma + curve), desaturated, warm.
11. **Bleach** — high contrast, low saturation, neutral.
12. **Golden Hour** — warm glow, gentle highlight lift.

## Technical rules (from reading `js/plugins/colorlab/ui.js`)

- **Full field set, always.** `applyPreset` (ui.js:74–75) has fallbacks that flip the
  Linear toggle ON when `linearLight` is omitted and default Tonemap to 2. Every preset
  MUST explicitly set the full primary set + `linearLight: false` + an explicit `tonemap`.
- **Display-space ceilings** (gentle, ~Lumetri scale): contrast ≤ ~22, saturation
  −26…+20, wheel pushes |x|,|y| ≲ 0.4, exposure small (−0.5…+0.4), liftLuma for fades
  ≤ ~16.
- **Tonemap:** `1` (None) on all presets unless a look needs highlight rolloff
  (Bright & Clean → `2` Soft-clip). `highlightComp: 50` only matters when tonemap ≠ None.
- **Curves:** optional per preset, keys `m/r/g/b` (NOT `master`), each a list of
  `{x,y}` points in 0..1, identity = `[{x:0,y:0},{x:1,y:1}]`. Keep to 2–3 points.
  Used by: Flat → Pop, Soft Contrast, Cinematic Warm, Vintage Fade.
- **Omit `applyToSelection`** so presets never hijack the user's chosen apply target.
- **Preset names are the keys** (`window.FactoryPresets.colorlab[name]`), display order
  = object order.

## Field shape (per preset)

```
{ exposure, contrast, contrastPivot:0.18, temperature, tint, saturation,
  liftX, liftY, liftLuma, gammaX, gammaY, gammaLuma, gainX, gainY, gainLuma,
  linearLight:false, tonemap:1, highlightComp:50,
  curves: { m:[...], r:[...], g:[...], b:[...] }   // optional, only when used
}
```

## Out of scope

- No `.aex` / engine changes.
- No LUT loading, no .cube import, no camera-log input transforms — that's **Phase C**.
- No new panel UI (the PresetBar already lists `FactoryPresets.colorlab`).

## Validation

No AE in dev env. `node --check js/factory-presets.js` for syntax. Visual correctness
is user-verified in AE: load each preset, confirm it looks like a tasteful starting
point (not overcooked). Iterate on any that feel off — one variable at a time.

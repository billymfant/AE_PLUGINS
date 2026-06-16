# Distort Flow — UX Handoff (2026-06-16)

**Branch:** `feat/distort-native` (~31 commits ahead of `main`, NOT merged — user wants to eyeball in AE first).
**Read also:** `docs/handoffs/2026-06-12-distort-native-resume.md`, memory `distort-native-d3a-verified`, `distort-panel-ux-feedback`.

## Context — user feedback this session
User (motion designer, not an engineer) tested the now-shipped Distort Flow panel and hit two things:
1. **"Too many settings, nothing makes sense."** The panel exposes the full raw engine (~25 knobs).
2. **"Slider changes aren't live on the layer."** ← this was the core of "working weird": sliders only
   set state; nothing reached AE until the **Apply** button. Felt broken/unresponsive.
User confirmed they HAD reinstalled the fresh 72KB `.aex` (so it's not a stale-install issue).
User chose simplification style = **"fewer knobs + better defaults"** (NOT a preset gallery).

## DONE this session
- **Live preview** (committed). `jsx/distortflow.jsx` gained `liveOnly` (update existing effect only —
  never create, never throw, silent no-op if no target). `js/plugins/distortions/ui.js`: a debounced
  (150ms) `_liveFlow()` fires on every flow slider (`_mk`), the 6 flow dropdowns, and preset loads;
  pushes `distortflow.apply` with `liveOnly:true`. Apply button still creates the effect. Mirrors
  Color Lab's live model. Syntax-clean; panel-only (no `.aex` rebuild/reinstall — just reload panel).
  ⚠️ **NOT yet eyeballed in AE** — user must: select layer → Apply once → then drag sliders and confirm
  the layer updates live.

## NEXT (deferred — ready to build, panel-only, no reinstall)
**Simplify the Distort Flow panel — "fewer knobs, better defaults":**
- Replace the visible control wall with **Style ▾** + **Strength** + **Scale** + **Speed**, everything
  else under a collapsed **Advanced ▾**.
- **Style** dropdown bakes the fiddly params (map type, displace mode, mosaic/slat config, edges) to
  known-good values per look: **Liquid Wave** (default) · **Noise Warp** · **Mosaic** · **Woven Slats**.
- **Strength** = `dfAmount`. **Speed** = `dfFlowSpeed`. **Scale** = the most relevant size knob per style
  (Wave→`dfWaveFreq`, Noise→`dfNoiseScale`, Mosaic→`dfMosaic`, Woven Slats→`dfSlatRows`+`dfSlatCols`).
- Tune defaults so picking a Style + Apply looks good immediately.
- Implementation lives in `js/plugins/distortions/ui.js` (the `_buildFlow` block) + a small style→params
  mapping; reuse the existing `_df` widgets under Advanced. No engine/.aex change.

## OPEN questions for user
- After the live fix lands in AE: is "working weird" fully resolved, or is there ALSO a render bug when
  you DO Apply (tears/smears/flicker/barely-moves)? If the latter → systematic-debugging, separate fix.

## Other queued (later, fresh budget)
- Merge `feat/distort-native` → `main` once Distort Flow v1 is eyeballed-good in AE.
- **Synapse** tool (blob-tracking HUD) — spec written (`docs/superpowers/specs/2026-06-16-synapse-blob-tracking-design.md`), build not started.
- Distort: D2 CUDA · D4 temporal slit-scan · refract lens.

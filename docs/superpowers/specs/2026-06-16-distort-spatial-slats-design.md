# Distort Flow — Spatial Rows/Slats Mode + Presets (Design Spec)

**Date:** 2026-06-16
**Status:** Design approved, implementation not started
**Branch:** `feat/distort-native`
**Tool:** Distort Flow (native `DistortFlow.aex` + CEP panel) — the last v1 feature

---

## 1. Summary

Add a **Slats mode** to the existing Distort Flow engine: slice the frame into rigid
horizontal **Rows** and/or vertical **Columns** that slide, producing an interwoven
basket / cross-hatch look (the woven reference in `image.png`, the flat single-frame
cousin of the SYSTMS Time Slice slat aesthetic). Plus a starter set of **presets** for
the Distort Flow engine.

This is a single-frame extension of the current CPU engine — it reuses the map field,
flow animation, edge handling, and bilinear sampler. It is **not** the temporal
slit-scan (that stays as the later D4 phase).

## 2. Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Slat geometry | **Both axes / grid** — independent Rows + Columns, each off when its count is 0 |
| Slide model | **Auto-weave** — rows slide along X, columns slide along Y, summed; magnitude from the map field (Map Type + Flow drive & animate it) |
| Parameterization | **Count** — integer `Rows` (0..64) and `Columns` (0..64) |
| Mode relationship | **Its own mode** — when Rows or Columns > 0, the smooth per-pixel warp and Mosaic switch OFF (mutually exclusive); Angle / Displace Mode are inactive (the weave defines direction) |
| Stagger | Included — `Slat Stagger %` (0 = all bands same direction, 100 = alternate ± for the classic over/under weave) |
| Presets | Yes — a starter set for the Distort Flow engine (see §7) |

## 3. Engine math (`distort-native/core/distort_core.cpp`, `warpBand`)

A new branch, mutually exclusive with the existing smooth/mosaic path:

```
if (P.slatRows > 0 || P.slatCols > 0) {
    float shiftX = 0.f, shiftY = 0.f;
    if (P.slatRows > 0) {
        float rowH  = (float)src.h / P.slatRows;
        int   ri    = (int)floorf(y / rowH);                 // row band index
        float vrow  = (((ri + 0.5f) * rowH + 0.5f) / src.h) * 2.f - 1.f;
        float f     = mapValue(P, 0.f, vrow);                // field per row (reuse map)
        f           = ds_clamp(f * flowWeight(P,0.f,vrow) * modul
                               + flowJitter(P, ri, 0), -1.f, 1.f);
        float sign  = (1.f - P.slatStagger) + P.slatStagger * ((ri & 1) ? -1.f : 1.f);
        shiftX     += f * P.amount * sign;
    }
    if (P.slatCols > 0) {
        // symmetric on X: ci from column width, sample mapValue(P, ucol, 0),
        // shiftY += f * amount * stagger-sign(ci)
    }
    sampleBilinear(src, x + shiftX, y + shiftY, P.edgeMode, out);   // reuse edge + sampler
    // opacity blend over source identical to the smooth path
}
else { /* existing smooth + mosaic path, unchanged */ }
```

Reuses `mapValue`, `flowWeight` + time `modul`, `flowJitter` (per band index),
`sampleBilinear`, `EdgeMode`, and the opacity blend. Shift is **constant across a band**
→ the band slides rigidly (the slat look). Still multithreaded (per-row-band parallel-for
is unchanged; each output row's work is independent).

## 4. New params (`distort-native/core/distort_params.h`)

```cpp
int   slatRows    = 0;   // 0 = off; N horizontal bands
int   slatCols    = 0;   // 0 = off; M vertical bands
float slatStagger = 0.f; // 0..1; alternate-band direction flip
```
`amount` is reused as the slat shift magnitude. All defaults keep the engine at its
current behavior (slats off).

## 5. AE plugin (`distort-native/ae/DistortFlow.{cpp,h}`) — requires `.aex` rebuild

Add to the `DFP_*` enum (after `DFP_MOSAIC`, before `DF_NUM_PARAMS`) + `ParamsSetup` +
`ReadParams`:
- **Rows** — `PF_ADD_FLOAT_SLIDERX` int, 0..64, default 0
- **Columns** — int, 0..64, default 0
- **Slat Stagger** — %, 0..100, default 0 (→ 0..1 in ReadParams)

Bump nothing else; order must stay in sync across enum / ParamsSetup / ReadParams.
Rebuild via the documented recipe (`aex-build-recipe`); user admin-copies the new `.aex`
to the AE Plug-ins folder and relaunches.

## 6. Panel (`js/plugins/distortions/ui.js` + `jsx/distortflow.jsx`)

New **Slats** `section-label` in the Distort Flow control block (after Output):
- `Rows` slider (0..64, step 1, default 0)
- `Columns` slider (0..64, step 1, default 0)
- `Stagger %` slider (0..100, step 1, default 0)

State fields `dfSlatRows` / `dfSlatCols` / `dfSlatStagger` (defaults 0). `distortflow.jsx`
pushes them by display name (`'Rows'`, `'Columns'`, `'Slat Stagger'`) via the existing
silent-skip `_set`, so an older `.aex` without these params still applies the rest.
`applyPreset`'s `_df` loop already covers the new widgets (no extra wiring).

## 7. Presets (`js/factory-presets.js`, `distortions` block)

Each Distort Flow preset is a flat param blob with `engine:'flow'` + the full `df*` set
(complete, so loading is predictable regardless of prior state). Starter set:

| Name | Key params |
|---|---|
| **Woven Slats** | Wave map, Rows 16, Cols 16, Stagger 60, Amount 60, Flow Speed 0.3, Edge Mirror |
| **Venetian Blinds** | Wave map, Rows 24, Cols 0, Stagger 100, Amount 40, Angle 0 |
| **Ripple Grid** | Radial map, Rows 20, Cols 20, Stagger 40, Amount 50, Flow Speed 0.4 |
| **Liquid Wave** | Wave map, no slats, Displace Fixed, Amount 50, Freq 4, Flow Speed 0.5 |
| **Noise Drift** | Noise map, Along-Gradient, Amount 60, Noise Scale 4, Flow Speed 0.4 |
| **Mosaic Shuffle** | Noise map, Mosaic 24, Amount 40, Flow Speed 0.5 |

**Cleanup:** add `engine:'builtin'` to the existing built-in presets (Fisheye, Barrel,
Vortex, Ocean, Magnify) so loading one while the Distort Flow engine is active snaps the
panel back to Built-in correctly.

## 8. Tests (`distort-native/tests/distort_tests.cpp`)

- **Slats off** (`slatRows=slatCols=0`) → output identical to the current smooth path (no regression).
- **Rows>0** → every pixel within a band displaces by the *same* horizontal shift (rigid slat); adjacent bands differ.
- **Cols>0** → symmetric on Y.
- **Stagger** → alternate bands shift in opposite directions at stagger=1.
- **Determinism** → same params + time ⇒ identical output.
All run via `build-cli.bat` → `distort_tests.exe` = `ALL PASS`.

## 9. Phasing (single cohesive feature, one implementation plan)

1. **Engine** — params + weave math in `warpBand` + tests (`ALL PASS`).
2. **AE** — add 3 params, rebuild `.aex`.
3. **Panel + presets** — Slats sliders, `df*` state, `distortflow.jsx` setters, factory presets, built-in-preset `engine` tags.
4. **Verify** — offline render-test PNG (slats on synthetic image), browser panel check (`preview.html`), user in-AE eyeball on footage.

After this, **Distort Flow is feature-complete for v1**. Remaining D2 (CUDA) and D4
(temporal slit-scan) are separate, later phases.

## 10. Out of scope (v1)

- True 3-D woven-mesh depth (perspective basket) — that's temporal/mesh territory (D4+).
- Per-slat independent random offsets beyond the map field + stagger + jitter already provided.
- CUDA parity for the slat path (folded into the general D2 CUDA phase later).
- Tilted/arbitrary-angle slats (Angle stays inactive in Slats mode for v1).

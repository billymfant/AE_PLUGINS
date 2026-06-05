# Design — Deep Glow Native (C++ / CUDA / AE SDK)

**Date:** 2026-06-05
**Status:** Approved (proceeding to implementation plan)
**Supersedes for the native path:** `TOOL GUIDELINES/deep_glow_style_tool_analysis_for_claude.md`
(that doc describes the ExtendScript "Path A"; this is "Path B", the compiled plugin)
**Related:** `docs/handoffs/2026-06-05-native-glow-gpu-handoff.md`, `glow-native/`, `jsx/glow.jsx`

---

## 1. Summary

A standalone, compiled After Effects effect (`.aex`) that renders a GPU-accelerated,
cinematic multi-scale bloom doing its own image math — NOT an ExtendScript panel that
wires up AE's built-in effects. Commercial-grade, Windows-first.

- **Primary render path:** CUDA (NVIDIA). **Fallback:** CPU (Adobe-required for every
  Smart FX GPU effect). **OpenCL** (AMD/Intel) is a post-v1 fast-follow before commercial
  release. **Metal/Mac** is a later milestone, out of scope for v1.
- **Build target:** AE 2024 (this PC) — PiPL min-version set to 2024 so the same `.aex`
  also loads in AE 2026. Built with the AE 2025 SDK (25.6), VS2022, CUDA 13.3, `sm_89`.

## 2. Goals / Non-goals

**Goals (v1 — "cinematic-quality core"):**
- A loadable, stable AE effect that looks genuinely cinematic: soft, deep, wide bloom.
- Linear-light processing + highlight tonemapping so it never clips to ugly white.
- Real-time interactive scrubbing at 4K on the CUDA path.
- Behavioral lineage with `jsx/glow.jsx` (same param meanings / look intents).

**Non-goals (v1):**
- OpenCL / Metal backends (post-v1).
- Custom-drawn UI (v1 uses the standard AE Effect Controls panel).
- Exotic features from the analysis doc: lens dirt, chromatic aberration, RGB-radius
  multipliers, image-based iris, multiple source-channel modes, gradient/heatmap tint.
  These are explicitly deferred to v1.x+.

## 3. Acceptance criteria (failure-mode driven)

These exist because the previous native attempt produced "a hard square halo around the
source, and threshold at 10% produced no glow." v1 must provably not do that. All four are
verified by the CLI harness (§8) on fixtures BEFORE any AE testing.

- **AC1 — Threshold direction & units.** Fixture: white square (luma ≈ 1.0) on black.
  At `Threshold = 10%` the square fully contributes and produces a strong, obvious bloom.
  Increasing threshold toward 100% monotonically *reduces* the bloom. (Guards the
  inverted/mis-scaled threshold bug. UI threshold 0–255 maps explicitly to a 0–1 luma
  compare; document the mapping in code.)
- **AC2 — Soft, round falloff (no box).** Around a hard-edged bright square, sampling
  outward along a ray from the edge must give a smooth, monotonically *decreasing*
  intensity — no hard secondary ring/box, no flat plateau. Golden-image + radial-profile
  assertion. (Guards the "dilate/edge instead of glow" bug.)
- **AC3 — Source preserved.** Composite ADDS glow over the source; the lit interior is not
  punched out or darkened. Glow-Only mode shows only the bloom.
- **AC4 — CPU↔GPU parity.** Identical input through CPU and CUDA paths matches within a
  small epsilon (per-channel), so the fallback is faithful.

## 4. Parameters (v1)

Carried over from `jsx/glow.jsx` (identical meanings):
Intensity %, Radius, Threshold (0–255), Threshold Softness, Source Gain, Glow Color,
Colorize, Saturation, Hue Shift, Passes, Falloff (Linear/Soft/Exp), Blend (Add/Screen),
Glow Dimensions (Both/Horizontal/Vertical), Glow Only.

New for the cinematic core:
- **Linear Light** (checkbox, default ON) — decode to linear before bloom, re-encode after.
- **Tonemap** (popup: None / Soft-clip / Filmic, default Soft-clip) — compress bloom
  highlights to avoid harsh clipping.
- **Highlight Compression** (0–100) — strength of the tonemap knee.

Param-to-engine mapping (see §5): `Radius` → mip-level count + sample spread;
`Passes` + `Falloff` → the per-mip-level weight ramp; `Glow Dimensions` → anamorphic
(non-square) mip sampling.

## 5. Architecture & data flow

```
AE input (32f) ─▶ [linearize?] ─▶ threshold/extract (smooth knee) ─▶ bright buffer
                                                                          │
                       ┌──────────────────── mip pyramid ────────────────┘
                       ▼
  downsample chain (13-tap filter) ─▶ N half-res mips ─▶ upsample chain (9-tap tent),
  additively combine levels weighted by (falloff curve × intensity)
                       │
                       ▼
  tint / saturation / hue ─▶ TONEMAP highlights (None / Soft-clip / Filmic, by knee)
                       │
                       ▼
  composite over source (Add / Screen) | glow-only ─▶ [de-linearize?] ─▶ AE output
```

**Bloom engine = mip-pyramid (dual-filter downsample/upsample)**, the modern
"next-gen bloom" approach (Jimenez/CoD-style). Chosen because its cost is ~independent of
radius (huge soft cinematic radius stays real-time) and it produces a naturally smooth,
round energy falloff — the opposite of the boxy artifact from the last attempt.

**Color management:** AE hands 32-bit float pixels in the project working space. With
Linear Light ON, apply an sRGB→linear decode before extraction and linear→sRGB encode
after composite. This is a known subtlety (AE projects may already be linearized); v1
exposes the toggle and documents the assumption rather than auto-detecting.

## 6. Components / files (in `glow-native/`)

| File | Role |
|---|---|
| `DeepGlowGPU.h` | versions, param enum, `GlowParams` POD (shared host/CUDA/CPU), enums |
| `DeepGlowGPU.cpp` | AE entry, command dispatch, ParamsSetup, **SmartPreRender rect expansion** (bloom grows the frame by the max effective radius), GPU device setup/setdown, GPU render orchestration, CPU render |
| `DeepGlowGPU.cu` | CUDA kernels: threshold, downsample, upsample, tint, tonemap, composite; `extern "C"` launchers |
| `cpu_render.cpp` | CPU mirror of the EXACT same math (the Adobe-required fallback; AC4 keeps it honest) |
| `DeepGlowGPU.r` | PiPL resource; **min AE version = 2024** |
| `DeepGlowGPU.vcxproj` / `.sln` | VS2022 project copied from SDK `SDK_Invert_ProcAmp` GPU sample + a CUDA build step |
| `harness/glow_cli.cpp` | standalone PNG-in → PNG-out runner of the pipeline (no AE); drives golden-image + parity tests |
| `tests/` | fixtures + reference PNGs + the radial-profile/parity assertions |

**Pyramid buffers:** a chain of ping-pong device buffers sized to the comp, allocated at
`GPU_DEVICE_SETUP` and **reallocated when comp dimensions change**; freed at
`GPU_DEVICE_SETDOWN`.

## 7. Error handling

- GPU unavailable / not F32 → CPU path (already required).
- Every CUDA call checked; on error return a clean `PF_Err` and never crash AE.
- Buffers reallocated on size change; guard against zero-size / empty-alpha input (no-op).
- All params clamped to declared ranges before use.

## 8. Testing

- **CLI harness (`glow_cli`)** — runs the pipeline on PNG fixtures without AE, so we
  iterate on the look fast and run regression tests in CI-like fashion. This is the
  primary guardrail for AC1–AC4.
- **Golden-image tests** — render fixtures (white square, gradient, point lights, neon
  text image), compare to reference PNGs within epsilon.
- **Radial-profile assertion** (AC2) — monotonic smooth falloff from a square's edge.
- **CPU↔GPU parity test** (AC4).
- **Manual AE smoke checklist** — load in AE 2024, apply to a solid + a text layer, scrub,
  exercise every param, test 8/16/32 bpc, do a full render. Repeat the exact reproduction
  from last time (square, threshold 10%) and confirm a real soft glow.

## 9. Milestones (v1)

- **M0 — Loads.** Project builds; an empty/passthrough effect with the full PiPL loads in
  AE 2024 and shows its params. (De-risks the SDK + PiPL + build wiring first.)
- **M1 — CPU look correct.** Full pipeline on CPU (threshold → pyramid → tonemap →
  composite) passing AC1–AC3 via the CLI harness golden images.
- **M2 — CUDA fast + faithful.** CUDA path passes AC4 (parity) and scrubs in real time
  in AE.
- **M3 — Cinematic params.** Linear Light, Tonemap, Highlight Compression, anamorphic, and
  all carried-over params wired; looks match the `glow.jsx` preset intents.
- **Post-v1:** OpenCL backend; then lens dirt / chromatic / RGB-radius / iris / Mac-Metal.

## 10. Risks & open items

- **Color space correctness** — getting linear-light right across AE project settings is
  fiddly; mitigated by the explicit toggle + documented assumption, refined against real
  footage in M3.
- **GPU buffer plumbing** — the AE GPU suite (device ptrs, stride, stream) is SDK-version
  specific; mitigated by mirroring the `SDK_Invert_ProcAmp` sample exactly in M0/M2.
- **Product name** — TBD; must be original (not "Deep Glow"). Pick before commercial
  release; does not block engineering. Working title: `glow-native`.
- **Pre-render rect math** — must expand the output region by the true maximum bloom
  radius or the glow clips at layer edges; covered explicitly in M1/M2.

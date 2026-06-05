# Handoff — Native Deep Glow (C++ / CUDA / AE SDK)

**Date:** 2026-06-05
**Author:** Claude (Opus 4.8) + billymfant
**Status:** Architecture decided, toolchain provisioning started, code scaffold created.

---

## The decision (read this first)

We are building **Deep Glow as a real, compiled, native After Effects plugin** (`.aex`),
written in **C++** with **GPU acceleration (CUDA)** as the primary render path and a
**CPU path as the Adobe-required fallback**.

This is a deliberate move **away** from the existing ExtendScript approach. The
ExtendScript suite (`jsx/glow.jsx`, `js/plugins/glow/ui.js`) only *wires up AE's
built-in effects* (`ADBE Glo2`, Hue/Saturation, expressions on a controller null).
The native plugin does its **own image math** — it is not limited by what AE ships.

- **Primary path:** CUDA kernels on the GPU. Most users run GPU, so this is the path
  that matters in practice.
- **CPU path:** required because every AE Smart FX GPU effect MUST provide a CPU
  render path (Adobe rule). It is a fallback, not the focus.

## Why this isn't already in the repo (important)

There was an **earlier native attempt on the other PC (AE 2026 machine)**. The user
believed it was pushed, but it is **NOT in GitHub** — verified on 2026-06-05:
- Searched `main` and `feat/suite-tool-upgrades` for `.cpp/.cu/.h/.aex/.sln/.vcxproj`
  → zero hits. Every tracked file is still ExtendScript/JSX.
- A compiled AE SDK plugin is a *separate* C++ project; the suite's `git push` never
  carried it. It is most likely sitting **uncommitted / on an unpushed local branch /
  in an untracked subfolder on the other PC**.

**Action when the other PC is reachable** (it's at the user's work, not accessible now):
```
git status            # is the work uncommitted?
git branch -a         # local branch never pushed?
git log --all --oneline -15
dir /s /b C:\*.cu C:\*.vcxproj   # separate project folder?
```
If found: `git add` → `git commit` → `git push`, then `git pull` here and reconcile
with this scaffold. **Until then, do NOT treat this scaffold as the final source of
truth** — the other PC may be further along.

## Machine map (the two dev boxes differ — this matters)

| | This PC (provisioning here) | Other PC (at work) |
|---|---|---|
| AE version | **AE 2024** | **AE 2026** |
| GPU | **RTX 4080 SUPER** (Ada, `sm_89`) | (unknown) |
| Role | **Primary build + test target** | Has the earlier native attempt |

**Build against AE 2024 here.** A plugin built against the older AE generally loads in
newer AE (2024 → loads in 2024 **and** 2026), but not reliably the reverse. So AE 2024
is the safe lowest-common-denominator target.

## Toolchain (provisioning state as of 2026-06-05)

Nothing was installed on this PC at the start. Kicked off via `winget`:
- [ ] **Visual Studio 2022 Community** + "Desktop development with C++" (MSVC v143) — installing
- [ ] **CUDA Toolkit 12.x** (12.4+, supports VS2022 + RTX 4080 / `sm_89`) — installing
- [ ] **After Effects SDK** (AE 2024) — **MANUAL, user-only** (behind Adobe login).
      Download from Adobe's developer portal. This is the one hard blocker.

Driver already present: NVIDIA 576.xx — supports CUDA 12.x. ✅

## Where the code lives

`glow-native/` — separate from the ExtendScript suite, as it should be.
See `glow-native/README.md` for build steps and `glow-native/ARCHITECTURE.md` for the
GPU glow pipeline.

## Parameter set (mirrors jsx/glow.jsx for behavioral parity)

intensity, radius, threshold (0–255), threshold softness, source gain, glow color,
colorize, saturation, hue shift, passes/layers, falloff (Linear/Soft/Exp), blend
operation (Add/Screen), glow dimensions (Both/Horizontal/Vertical = anamorphic),
glow-only.

## Next steps

1. Finish toolchain install (VS + CUDA), user adds AE 2024 SDK.
2. Set `AESDK_ROOT` + CUDA paths, build the scaffold (CPU path first — it's real).
3. Wire + verify CUDA kernels on GPU path.
4. When other PC is reachable: recover its native attempt, reconcile.

> NOTE: This decision lived only in Claude's per-PC memory before, which is gitignored
> and does NOT sync between machines — that's why context was lost. This doc is in the
> repo on purpose so it travels via git to both PCs.

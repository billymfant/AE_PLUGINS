# Handoff — Particle Engine Re-architecture (decision pending)

**Date:** 2026-05-29
**Branch:** `main`
**Status:** Discussion / design only. **No code written.** A key architectural decision is still open and blocks implementation. Read the "Open decision" section first.

---

## TL;DR for the next session
The user wants to rebuild the **Particle Engine** tool. They correctly identified that the current architecture is wrong, and asked what *value* a rebuild adds. We narrowed it to three distinct products (not three tiers of one tool). **The user has not yet chosen a direction** — do not start coding. The next step is to pin down what value they want the tool to add, then the technical path follows.

---

## This session's other (completed) work
1. `git pull` — synced `main` to `f6ecac9` (suite upgrades + new GlitchMosh plugin).
2. Installed the **karpathy-guidelines** skill at `.claude/skills/karpathy-guidelines/SKILL.md` (think-before-coding, simplicity, surgical changes, goal-driven). Source: github.com/multica-ai/andrej-karpathy-skills.
3. **Uninstalled the CEP extension from AE** — deleted `%APPDATA%\Adobe\CEP\extensions\com.aeplugins.suite`. Source repo untouched. (If testing in AE next session, it must be re-copied — see `2026-05-29-suite-upgrades-handoff.md` step 3.)
4. Wrote **`docs/stitch-design-reference.md`** — a complete UI inventory of all 11 plugins (every section, control, type, range, default, CTA) for redesigning the panel in Stitch. Use this as the source of truth for the panel's current UI surface.

---

## The Particle Engine problem

### Current implementation (`jsx/particles.jsx`)
- ExtendScript baker: runs a 2D Verlet-ish sim once at apply-time, writes position/opacity/scale **keyframes** onto a **pre-allocated pool of real AE shape layers** (one layer per particle, capped at 200, `particles.jsx:28`).
- **The architecture is backwards.** Real AE particle systems (Trapcode Particular, built-in CC Particle World / CC Particle Systems II) are a *single effect on one layer* that renders thousands of particles internally — zero per-particle layers. The user reached this conclusion himself: "the wrong is to create a separate layer for each particle."
- **Confirmed bug regardless of direction:** `nextSlot` only increments (`particles.jsx:86,111,143`); dead particles free their `activeParticles` entry but never their layer slot, so the pool is consumed left-to-right and never recycles. Also: no seeded RNG (uses `Math.random()`), so results aren't repeatable.

### The user's original spec (what NOT to do literally)
The user pasted a C++ spec ("PHASE 1B: AUXILIARY PARTICLE EMISSION SYSTEM") describing a native real-time engine: contiguous memory managers (`MainParticleRegistry`/`AuxParticleRegistry`), cache locality, no nested vectors, `Vector3`, a live `dt` loop. **None of the memory/locality/Vector3 parts apply to ExtendScript** — it's interpreted, single-threaded, 2D, no struct layout control. The *algorithm* (accumulator-based sub-frame emission, interpolated spawn position to avoid dot-gaps, velocity-inheritance %, deterministic scatter) maps fine — and our existing code already uses the accumulator pattern (`particles.jsx:82-84`). The spec reads as if written for a different (native) engine.

### The hard constraint that drives everything
**ExtendScript cannot render pixels.** It can only apply/configure effects that already exist, plus create layers/keyframes/expressions. So "thousands of particles on one layer" is only achievable by either driving an existing effect, or writing a compiled effect.

---

## Open decision — THE blocker

The three paths are **different products with different value propositions**, not cost tiers:

| Approach | Good at | Value added | Cost |
|----------|---------|-------------|------|
| **A. Layer-baker** (keep current, fix it) | A few dozen particles, each independently hand-editable afterward (genuinely unique — no effect-based system offers this) | Unique niche; fix recycling + add seeded RNG; lean into it as a deliberately small-scale "hero elements" tool | Low |
| **B. Wrap CC Particle World** (built into AE, no 3rd-party) | Thousands of particles, real-time, one layer | **Usability + presets ONLY — adds no new capability.** Cannot emit from a mask/path (CC effects only emit point/box/sphere). Still CC Particle World underneath. | Medium, stays in ExtendScript/suite |
| **C. Native C++ AE SDK effect** | Thousands of particles **+ capabilities nothing built-in has** (emit from mask/path, custom look, the user's data-oriented engine) | Maximum — a genuinely new tool | High; separate compiled `.aex` product, different language/codebase/install, lives outside the CEP suite, weeks-to-months |

### Where the conversation stopped
The user's last messages:
- "i am not sure yet what is the value you add if you built it based on an existing one?" → I explained a wrapper adds usability, not capability; can never exceed what it wraps.
- "i dont understand options 2 and 3" → I explained: AE add-ons are either (1) JS scripts/panels that only automate existing AE features (our whole suite), or (2) compiled C++ effects built with the AE SDK that draw their own pixels (CC Particle World and Particular are these). Option 2 = write our own such effect. Option 3 = ship wrapper now, scope C++ as a separate later project.

**The reframed question the user still needs to answer** (this unblocks everything):
> What value should this tool add?
> - "Make CC Particle World pleasant + presets" → Path B.
> - "Do something no built-in effect can (mask/path emit, our own engine/look)" → Path C, as its own product.
> - "Keep the per-particle hand-editable trait but stop it crashing" → Path A.

Do **not** proceed past this without the user's answer.

---

## Reference repos (shared with user, for understanding particle systems/physics)
1. **Daniel Shiffman — *Nature of Code*** (`nature-of-code/noc-book-2`) — particle systems + physics (forces, integration, lifespans) in creative-coding JS. Closest in spirit to our tool.
2. **PixiJS particle-emitter** (`pixijs/particle-emitter`) — production 2D emitter (rate, spawn shapes, lifetime, velocity inheritance) in clean TS/JS; feature set nearly mirrors ours.
3. **Robert Nystrom — *Game Programming Patterns*, "Object Pool" chapter** (gameprogrammingpatterns.com) — directly addresses our pool-recycling bug.
4. (Path C only) **EnTT** — standard reference for the data-oriented / registry design in the user's original C++ spec.

---

## Concrete next steps
1. Get the user's answer to "what value should the tool add?" → picks Path A / B / C.
2. If **A**: fix `nextSlot` recycling, add a seeded PRNG + seed slider, optionally add the aux/trail algorithm with a hard layer cap. Brainstorm scope first (skill installed).
3. If **B**: design the param mapping our UI → CC Particle World match-names; rebuild the tab as a controller + presets; note mask/path emit is out of scope. Verify CC Particle World match-name/property indices against a real AE (per the suite-upgrades handoff warning about indices).
4. If **C**: treat as a new project — own spec via brainstorming, AE SDK toolchain, separate from the CEP suite.
5. Regardless: the layer-per-particle baker should not ship as-is for high particle counts.

## Notes
- Root `CLAUDE.md` still says "5-plugin suite" — outdated (suite is 11 tabs). Mentioned in the prior handoff too; still not fixed.
- The karpathy-guidelines and brainstorming skills both say: surface the architecture mismatch and get approval before implementing. That gate is why no code exists yet — by design, not omission.

# Color Tool P4 — HSL Secondary (engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps.

**Goal:** Qualify a hue/sat/luma range with a soft mask and apply hue/sat/luma adjustments only inside it — the "secondary" grade — shared CPU/GPU, parity preserved.

**Architecture:** Add `CL_HD` helpers to `color_params.h` (`hueOf`, `hsvSat`, `smoothstep01`, `hueMask` with wraparound, `rangeMaskLH`, `hueRotate`). `gradePixel` (between curves and saturation) computes mask = hueBand × satRange × lumaRange and applies `hueRotate`/`applySaturation`/luma-multiply scaled by the mask. Eyedropper (panel) just supplies `hslCenterHue`; not in this phase.

> **Note:** qualifies on the in-pipeline (linear) values — same display-vs-linear refinement already flagged for curves; fine for P4 correctness.

**Tech Stack:** C++17 (CPU + nvcc), existing build scripts.

---

### Task 1: qualifier helpers + Params (TDD)

**Files:** Modify `color-native/core/color_params.h`, `color-native/tests/color_tests.cpp`

- [ ] **Step 1:** Add helpers to `color_params.h` (after `toneSoftClip`, before `} // namespace`):

```cpp
CL_HD inline float smoothstep01(float e0, float e1, float x) {
    float t = (x - e0) / (e1 - e0 + 1e-6f); t = t<0?0:(t>1?1:t);
    return t*t*(3.f - 2.f*t);
}
CL_HD inline float hueOf(float r, float g, float b) {           // 0..1
    float mx = fmaxf(r, fmaxf(g,b)), mn = fminf(r, fminf(g,b)), d = mx - mn;
    if (d <= 1e-6f) return 0.f;
    float h;
    if      (mx == r) h = (g - b)/d + (g < b ? 6.f : 0.f);
    else if (mx == g) h = (b - r)/d + 2.f;
    else              h = (r - g)/d + 4.f;
    return h / 6.f;
}
CL_HD inline float hsvSat(float r, float g, float b) {
    float mx = fmaxf(r, fmaxf(g,b)), mn = fminf(r, fminf(g,b));
    return mx <= 1e-6f ? 0.f : (mx - mn)/mx;
}
// hue membership with wraparound: 1 inside +-width, feathered over soft.
CL_HD inline float hueMask(float hue, float center, float width, float soft) {
    float d = fabsf(hue - center); if (d > 0.5f) d = 1.f - d;
    return 1.f - smoothstep01(width, width + soft, d);
}
// range membership [lo,hi] with soft feather on both edges.
CL_HD inline float rangeMaskLH(float v, float lo, float hi, float soft) {
    float up = smoothstep01(lo - soft, lo, v);
    float dn = 1.f - smoothstep01(hi, hi + soft, v);
    return up * dn;
}
// luma-preserving hue rotation (radians) — SVG feColorMatrix hueRotate matrix.
CL_HD inline void hueRotate(float& r, float& g, float& b, float a) {
    float c = cosf(a), s = sinf(a);
    float m00=0.213f+c*0.787f-s*0.213f, m01=0.715f-c*0.715f-s*0.715f, m02=0.072f-c*0.072f+s*0.928f;
    float m10=0.213f-c*0.213f+s*0.143f, m11=0.715f+c*0.285f+s*0.140f, m12=0.072f-c*0.072f-s*0.283f;
    float m20=0.213f-c*0.213f-s*0.787f, m21=0.715f-c*0.715f+s*0.715f, m22=0.072f+c*0.928f+s*0.072f;
    float nr=m00*r+m01*g+m02*b, ng=m10*r+m11*g+m12*b, nb=m20*r+m21*g+m22*b;
    r=nr; g=ng; b=nb;
}
```

- [ ] **Step 2:** Add HSL fields to `struct Params` (after curve fields):

```cpp
    // HSL secondary (qualifier) — disabled by default
    bool  hslEnable = false;
    float hslCenterHue = 0.f;     // 0..1
    float hslHueWidth  = 0.08f;   // half-width 0..0.5
    float hslSatLo = 0.f, hslSatHi = 1.f;
    float hslLumaLo = 0.f, hslLumaHi = 1.f;
    float hslSoftness = 0.10f;
    float hslHueAdj  = 0.f;       // radians, rotate within mask
    float hslSatAdj  = 0.f;       // -1..1
    float hslLumaAdj = 0.f;       // -1..1 (multiply by 1+adj*mask)
```

- [ ] **Step 3:** Add tests (append to `color_tests.cpp`; call in `main`):

```cpp
static void test_hsl_mask_outside_is_zero(){
    // pure green; qualifier centered on red -> mask 0 -> unchanged
    Image im = solid(2,2, 0.1f, 0.8f, 0.1f);
    Image ref = im;
    Params P; P.linearLight=false; P.hslEnable=true;
    P.hslCenterHue=0.f; P.hslHueWidth=0.05f; P.hslSoftness=0.02f; P.hslSatAdj=-1.f;
    grade(im,P);
    for(size_t i=0;i<im.px.size();++i) NEAR(im.px[i], ref.px[i], 2e-3f);
}
static void test_hsl_applies_at_center(){
    // pure red; qualifier on red, desaturate -> channels converge
    Image im = solid(2,2, 0.8f, 0.1f, 0.1f);
    Params P; P.linearLight=false; P.hslEnable=true;
    P.hslCenterHue=0.f; P.hslHueWidth=0.1f; P.hslSoftness=0.05f; P.hslSatAdj=-1.f;
    grade(im,P);
    CHECK(std::fabs(im.px[0]-im.px[1]) < std::fabs(0.8f-0.1f)); // moved toward gray
}
static void test_hsl_helpers(){
    NEAR(hueOf(1,0,0), 0.f, 1e-4f);
    NEAR(hueOf(0,1,0), 1.f/3.f, 1e-3f);
    NEAR(hsvSat(1,0,0), 1.f, 1e-4f);
    NEAR(hsvSat(0.5f,0.5f,0.5f), 0.f, 1e-4f);
    CHECK(hueMask(0.f,0.f,0.1f,0.02f) > 0.95f);    // at center
    CHECK(hueMask(0.5f,0.f,0.1f,0.02f) < 0.05f);   // opposite hue
}
```

Add to `main()`:
```cpp
    test_hsl_helpers();
    test_hsl_mask_outside_is_zero();
    test_hsl_applies_at_center();
```

---

### Task 2: apply in `gradePixel`

**Files:** Modify `color-native/core/color_core.h`

- [ ] **Step 1:** Insert after the curves block (step 6), before `// 7. saturation`:

```cpp
    // 6b. HSL secondary (qualified hue/sat/luma adjustment)
    if (P.hslEnable) {
        float hue = hueOf(r,g,b), sv = hsvSat(r,g,b), yv = lumaRec709(r,g,b);
        float m = hueMask(hue, P.hslCenterHue, P.hslHueWidth, P.hslSoftness)
                * rangeMaskLH(sv, P.hslSatLo, P.hslSatHi, P.hslSoftness)
                * rangeMaskLH(yv, P.hslLumaLo, P.hslLumaHi, P.hslSoftness);
        if (m > 1e-5f) {
            if (P.hslHueAdj  != 0.f) hueRotate(r,g,b, P.hslHueAdj * m);
            if (P.hslSatAdj  != 0.f) applySaturation(r,g,b, P.hslSatAdj * m);
            if (P.hslLumaAdj != 0.f) { float k = 1.f + P.hslLumaAdj * m; r*=k; g*=k; b*=k; }
        }
    }
```

- [ ] **Step 2:** Build CPU + tests → `ALL PASS`.

---

### Task 3: CLI `--hsl` + parity set

**Files:** Modify `color-native/cli/color_cli.cpp`, `color-native/cuda/color_parity.cpp`

- [ ] **Step 1:** In the CLI arg loop add:
```cpp
        else if (!strcmp(a,"--hsl")) { // center width satAdj lumaAdj hueAdj
            P.hslEnable=true; P.hslCenterHue=f(argv[++i]); P.hslHueWidth=f(argv[++i]);
            P.hslSatAdj=f(argv[++i]); P.hslLumaAdj=f(argv[++i]); P.hslHueAdj=f(argv[++i]); }
```

- [ ] **Step 2:** In `color_parity.cpp` add a set:
```cpp
    { Params p; p.linearLight=false; p.hslEnable=true; p.hslCenterHue=0.08f;
      p.hslHueWidth=0.12f; p.hslSoftness=0.08f; p.hslSatAdj=-0.6f; p.hslLumaAdj=0.2f;
      p.hslHueAdj=0.2f; sweep.push_back(p); }
```

- [ ] **Step 3:** Rebuild both + verify → `ALL PASS` and `PARITY PASS`.

Run: `color-native\build-cli.bat && color-native\build-cuda.bat && color-native\build\color_tests.exe && color-native\build\color_parity.exe`

- [ ] **Step 4:** CLI smoke (desaturate reds): `color-native\build\color_cli.exe docs\reference\glow-selection-reference.png color-native\build\graded_hsl.png --hsl 0.0 0.12 -0.8 0 0`

---

### Task 4: commit + status
- [ ] Update README + memory; commit:
```bash
git add color-native/ docs/superpowers/plans/2026-06-09-color-tool-P4-hsl.md
git commit -m "feat(color-native): P4 HSL secondary qualifier + tests + parity"
```

## Self-Review
- **Spec coverage (§4 step 8, §5 HSL):** soft hue/sat/luma qualifier ✓, masked H/S/L adjust ✓, parity ✓.
- **Placeholders:** none. **Types:** `hueOf/hsvSat/hueMask/rangeMaskLH/hueRotate/smoothstep01` + `hsl*` Params fields consistent across params/core/tests/cli/parity.
- **Deferred:** eyedropper + UI (panel); display-domain qualify (flagged).

## Next: P5 scopes (engine-emit stats via mmap) — own plan.

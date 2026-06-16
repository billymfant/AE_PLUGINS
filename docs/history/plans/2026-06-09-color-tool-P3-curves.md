# Color Tool P3 — Curves (engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox steps.

**Goal:** Add tone curves (master + per-channel R/G/B + luma) to the color engine, evaluated with a **monotonic cubic** (Fritsch–Carlson) so curves are smooth with **no overshoot** — same code on CPU & GPU, parity preserved.

**Architecture:** A small `Curve` struct (≤16 control points + precomputed tangents) lives in `color_params.h`. `prepareCurve()` (host) computes monotone tangents once; `evalCurve()` (`CL_HD`) evaluates per pixel (segment search + Hermite, linear extrapolation outside [x0,xN] so linear-light highlights aren't clamped). `gradePixel` applies master→per-channel→luma between contrast and saturation. The curve-editor *UI* is deferred to the panel phase; this phase is engine + verification only.

**Tech Stack:** C++17 (CPU + nvcc), existing `color-native/` build scripts.

> **Note (working domain):** per spec, curves sit in the linear pipeline. `evalCurve` extrapolates beyond [0,1] via endpoint tangents (no hard clamp). Whether curves should instead run in a display/gamma sub-domain is a refinement flagged for the `.aex`/panel phase; out of scope for P3.

---

### Task 1: `Curve` type + monotonic-cubic helpers (TDD)

**Files:**
- Modify: `color-native/core/color_params.h`
- Modify: `color-native/tests/color_tests.cpp`

- [ ] **Step 1:** Add to `color_params.h` (inside `namespace colorlab`, before `struct Params`):

```cpp
static const int CL_MAXPTS = 16;

// Tone curve as ≤16 control points (x,y in nominal 0..1, x ascending).
// n<2 => identity. m[] = monotone tangents filled by prepareCurve().
struct Curve {
    int   n = 0;
    float x[CL_MAXPTS];
    float y[CL_MAXPTS];
    float m[CL_MAXPTS];
};

// Host: compute Fritsch–Carlson monotone tangents (call once before grading).
inline void prepareCurve(Curve& c) {
    int n = c.n;
    if (n < 2) return;
    float d[CL_MAXPTS];
    for (int i = 0; i < n - 1; ++i) {
        float h = c.x[i+1] - c.x[i];
        d[i] = (h > 1e-6f) ? (c.y[i+1] - c.y[i]) / h : 0.f;
    }
    c.m[0] = d[0]; c.m[n-1] = d[n-2];
    for (int i = 1; i < n - 1; ++i)
        c.m[i] = (d[i-1]*d[i] <= 0.f) ? 0.f : 0.5f*(d[i-1]+d[i]);
    for (int i = 0; i < n - 1; ++i) {
        if (d[i] == 0.f) { c.m[i] = 0.f; c.m[i+1] = 0.f; continue; }
        float a = c.m[i]/d[i], b = c.m[i+1]/d[i], s = a*a + b*b;
        if (s > 9.f) { float t = 3.f/sqrtf(s); c.m[i] = t*a*d[i]; c.m[i+1] = t*b*d[i]; }
    }
}

// Shared host/device: evaluate the curve (Hermite); extrapolate linearly outside.
CL_HD inline float evalCurve(const Curve& c, float x) {
    int n = c.n;
    if (n < 2) return x;
    if (x <= c.x[0])     return c.y[0]     + (x - c.x[0])     * c.m[0];
    if (x >= c.x[n-1])   return c.y[n-1]   + (x - c.x[n-1])   * c.m[n-1];
    int i = 0; while (i < n-1 && x > c.x[i+1]) ++i;
    float h = c.x[i+1] - c.x[i], t = (x - c.x[i]) / h;
    float t2 = t*t, t3 = t2*t;
    float h00 = 2*t3 - 3*t2 + 1, h10 = t3 - 2*t2 + t, h01 = -2*t3 + 3*t2, h11 = t3 - t2;
    return h00*c.y[i] + h10*h*c.m[i] + h01*c.y[i+1] + h11*h*c.m[i+1];
}
```

- [ ] **Step 2:** Add curve fields to `struct Params` (after the wheel fields, before output):

```cpp
    // tone curves (identity by default; prepareCurve() before grading)
    Curve curveMaster, curveR, curveG, curveB, curveLuma;
```

- [ ] **Step 3:** Add tests (append to `color_tests.cpp`, call from `main`):

```cpp
static Curve mkCurve3(float x0,float y0,float x1,float y1,float x2,float y2){
    Curve c; c.n=3; c.x[0]=x0;c.y[0]=y0; c.x[1]=x1;c.y[1]=y1; c.x[2]=x2;c.y[2]=y2;
    prepareCurve(c); return c;
}
static void test_curve_identity_returns_x(){
    Curve c;                                  // n=0 => identity
    NEAR(evalCurve(c,0.3f),0.3f,1e-6f); NEAR(evalCurve(c,0.9f),0.9f,1e-6f);
}
static void test_curve_endpoints(){
    Curve c = mkCurve3(0,0, 0.5f,0.75f, 1,1);
    NEAR(evalCurve(c,0.f),0.f,1e-5f); NEAR(evalCurve(c,1.f),1.f,1e-5f);
    NEAR(evalCurve(c,0.5f),0.75f,1e-5f);
}
static void test_curve_monotonic_no_overshoot(){
    Curve c = mkCurve3(0,0, 0.5f,0.75f, 1,1);    // lifted mids
    float prev=-1.f;
    for(float x=0;x<=1.f;x+=0.05f){
        float v=evalCurve(c,x);
        CHECK(v >= prev-1e-5f);                  // monotonic increasing
        CHECK(v >= -1e-4f && v <= 1.0001f);      // no overshoot past [0,1] inside domain
        prev=v;
    }
}
static void test_curve_in_pipeline(){
    Image im = solid(2,2,0.3f,0.3f,0.3f);
    Params P; P.linearLight=false;               // isolate the curve
    P.curveMaster = mkCurve3(0,0, 0.5f,0.8f, 1,1);// raise mids
    grade(im,P);
    CHECK(im.px[0] > 0.3f);                       // 0.3 pushed up toward ~0.8 region
}
```

Add to `main()`:
```cpp
    test_curve_identity_returns_x();
    test_curve_endpoints();
    test_curve_monotonic_no_overshoot();
    test_curve_in_pipeline();
```

---

### Task 2: Apply curves in `gradePixel`

**Files:**
- Modify: `color-native/core/color_core.h` (the inline `gradePixel`)

- [ ] **Step 1:** Replace the `// 6. (curves P3, HSL P4 — no-op hooks here)` line with:

```cpp
    // 6. curves: master on each channel, then per-channel, then luma (chroma-preserving)
    r=evalCurve(P.curveMaster,r); g=evalCurve(P.curveMaster,g); b=evalCurve(P.curveMaster,b);
    r=evalCurve(P.curveR,r); g=evalCurve(P.curveG,g); b=evalCurve(P.curveB,b);
    if (P.curveLuma.n >= 2) {
        float y = lumaRec709(r,g,b);
        float ny = evalCurve(P.curveLuma, y);
        float s = (y > 1e-5f) ? ny / y : 1.f;
        r*=s; g*=s; b*=s;
    }
```

- [ ] **Step 2:** Build CPU + run tests.

Run: `color-native\build-cli.bat && color-native\build\color_tests.exe`
Expected: `ALL PASS`.

---

### Task 3: CLI `--scurve` + parity set

**Files:**
- Modify: `color-native/cli/color_cli.cpp`
- Modify: `color-native/cuda/color_parity.cpp`

- [ ] **Step 1:** In `color_cli.cpp`, before the arg loop add a helper and a flag.

After `static float f(...)` add:
```cpp
static colorlab::Curve sCurve(float k){ // k 0..1 contrast S-curve on master
    using namespace colorlab; Curve c; c.n=3;
    c.x[0]=0; c.y[0]=0; c.x[1]=0.5f; c.y[1]=0.5f;
    c.x[2]=1; c.y[2]=1;
    c.y[0]=0.0f + 0.0f; c.y[2]=1.0f;            // endpoints fixed
    c.x[1]=0.25f; c.y[1]=0.25f - 0.15f*k;        // pull low
    Curve d; d.n=5;
    d.x[0]=0;    d.y[0]=0;
    d.x[1]=0.25f;d.y[1]=0.25f-0.15f*k;
    d.x[2]=0.5f; d.y[2]=0.5f;
    d.x[3]=0.75f;d.y[3]=0.75f+0.15f*k;
    d.x[4]=1;    d.y[4]=1;
    prepareCurve(d); return d;
}
```
In the arg loop add:
```cpp
        else if (!strcmp(a,"--scurve")) P.curveMaster = sCurve(f(argv[++i]));
```

- [ ] **Step 2:** In `color_parity.cpp`, add a curve set to the sweep (after set 5):

```cpp
    { Params p; Curve c; c.n=3; c.x[0]=0;c.y[0]=0.05f; c.x[1]=0.5f;c.y[1]=0.6f; c.x[2]=1;c.y[2]=0.95f;
      prepareCurve(c); p.curveMaster=c; p.linearLight=false; sweep.push_back(p); }
```

- [ ] **Step 3:** Rebuild both + verify.

Run: `color-native\build-cli.bat && color-native\build-cuda.bat && color-native\build\color_tests.exe && color-native\build\color_parity.exe`
Expected: `ALL PASS` and `PARITY PASS (<= 1e-03)`.

- [ ] **Step 4:** CLI smoke.

Run: `color-native\build\color_cli.exe docs\reference\glow-selection-reference.png color-native\build\graded_scurve.png --scurve 0.8`
Expected: `wrote ...`; image shows added contrast (deeper shadows, brighter highs).

---

### Task 4: Commit + status

- [ ] **Step 1:** Update README status to include P3; update memory `color-native-progress.md`.
- [ ] **Step 2:** Commit:

```bash
git add color-native/ docs/superpowers/plans/2026-06-09-color-tool-P3-curves.md
git commit -m "feat(color-native): P3 tone curves (monotonic cubic, master/RGB/luma) + tests + parity"
```

---

## Self-Review
- **Spec coverage (§4 step 7, §5 Curves):** master + per-channel + luma curves ✓; monotonic cubic, no overshoot ✓ (test). CUDA parity maintained ✓ (curves are `CL_HD`, added to sweep).
- **Placeholder scan:** none.
- **Type consistency:** `Curve`/`prepareCurve`/`evalCurve` used identically in params, core, tests, cli, parity; `Params.curveMaster/R/G/B/Luma` names consistent; namespace `colorlab`.
- **Deferred:** curve-editor canvas UI (panel phase); display-vs-linear curve domain refinement (noted).

## Next: P4 HSL secondary (qualifier mask + eyedropper) — own plan.

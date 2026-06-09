#include <cstdio>
#include <cmath>
#include <vector>
#include "../core/color_core.h"
#include "color_cuda.h"
using namespace colorlab;

static Image randomImg(int w, int h, unsigned seed) {
    Image im(w, h);
    unsigned s = seed;
    for (size_t i = 0; i < im.px.size(); ++i) {
        s = s * 1664525u + 1013904223u;          // LCG
        im.px[i] = (s >> 8) / 16777215.0f;        // 0..1
    }
    return im;
}

static float maxDiff(const Image& a, const Image& b) {
    float m = 0.f;
    for (size_t i = 0; i < a.px.size(); ++i) {
        float d = std::fabs(a.px[i] - b.px[i]);
        if (d > m) m = d;
    }
    return m;
}

int main() {
    Image base = randomImg(128, 128, 7u);

    std::vector<Params> sweep;
    { Params p; p.exposure=1.2f; sweep.push_back(p); }
    { Params p; p.contrast=0.4f; p.contrastPivot=0.18f; sweep.push_back(p); }
    { Params p; p.temperature=0.5f; p.tint=-0.3f; sweep.push_back(p); }
    { Params p; p.saturation=0.7f; sweep.push_back(p); }
    { Params p; p.liftLuma=0.15f; p.gammaG=0.2f; p.gainR=0.3f; sweep.push_back(p); }
    { Params p; p.exposure=-0.8f; p.contrast=0.3f; p.saturation=0.4f;
      p.temperature=0.2f; p.tonemap=TONE_SOFTCLIP; p.highlightComp=0.6f; sweep.push_back(p); }

    float worst = 0.f; int idx = 0;
    for (size_t k = 0; k < sweep.size(); ++k) {
        Image a = base, b = base;
        grade(a, sweep[k]);          // CPU
        gradeCuda(b, sweep[k]);      // GPU
        float d = maxDiff(a, b);
        printf("param set %zu: max|CPU-GPU| = %.3e\n", k, d);
        if (d > worst) { worst = d; idx = (int)k; }
    }
    printf("WORST = %.3e (set %d)\n", worst, idx);
    const float TOL = 1e-3f;
    if (worst <= TOL) { printf("PARITY PASS (<= %.0e)\n", TOL); return 0; }
    printf("PARITY FAIL (> %.0e)\n", TOL); return 1;
}

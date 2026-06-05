/*
 *  glow_parity.cpp  —  AC4 CPU/GPU parity guardrail.
 *
 *  Builds a fixture (white square + a gradient), runs BOTH glow::bloom (CPU,
 *  authoritative) and glow_bloom_cuda (GPU mirror) with the SAME Params, and
 *  reports the max per-channel absolute difference. Returns nonzero on FAIL.
 *
 *  Two configs are checked:
 *    (a) STRICT: linearLight=false, tonemap=NONE  -> tightest bound (no pow/exp
 *        divergence). Must pass < 1e-3.
 *    (b) DEFAULTS: linearLight=true, tonemap=SOFTCLIP -> includes sRGB pow and
 *        the soft-clip rational; slightly looser bound documented below.
 */
#include <cstdio>
#include <cmath>
#include <vector>
#include "glow_core.h"
#include "glow_cuda.h"

using namespace glow;

// Fixture: a white square on black + a horizontal luma gradient blended in, so
// both the threshold knee (gradient) and the spread (square) are exercised.
static Image makeFixture(int W, int H){
    Image im(W,H);
    int sq=W/4, x0=(W-sq)/2, y0=(H-sq)/2;
    for (int y=0;y<H;++y) for (int x=0;x<W;++x){
        float ramp = (W>1) ? (float)x/(float)(W-1) : 0.f;  // 0..1 gradient
        bool inSq = (x>=x0 && x<x0+sq && y>=y0 && y<y0+sq);
        float v = inSq ? 1.0f : (ramp*0.6f);               // square is brightest
        float* px = im.at(x,y);
        px[0]=v; px[1]=v*0.9f; px[2]=v*0.8f;               // mild chroma to test tint paths
        px[3]= inSq ? 1.0f : (x>W/2 ? 1.0f : 0.0f);        // mixed alpha (test alpha-over)
    }
    return im;
}

static float maxDiff(const Image& a, const std::vector<float>& b){
    float m=0.f;
    for (size_t i=0;i<a.px.size();++i){
        float d = std::fabs(a.px[i]-b[i]);
        if (d>m) m=d;
    }
    return m;
}

static int runConfig(const char* name, const Params& p, int W, int H, float eps){
    Image src = makeFixture(W,H);

    Image cpu = bloom(src, p);

    std::vector<float> gpu((size_t)W*H*4, 0.f);
    int rc = glow_bloom_cuda(src.px.data(), gpu.data(), W, H, p);
    if (rc != 0){
        printf("[%s] GPU run FAILED (rc=%d) — cannot compare\n", name, rc);
        return 1;
    }

    float md = maxDiff(cpu, gpu);
    if (md < eps){
        printf("[%s] PARITY PASS (max diff = %.3e < %.0e)\n", name, md, eps);
        return 0;
    }
    printf("[%s] PARITY FAIL (max diff = %.3e, eps = %.0e)\n", name, md, eps);
    return 1;
}

int main(){
    const int W=257, H=193;   // odd dims to exercise ceil halving + edge clamps
    int fails = 0;

    // (a) STRICT — no color-management / tonemap, tightest comparison.
    {
        Params p;
        p.linearLight=false; p.tonemap=TONE_NONE;
        p.threshold=0.40f; p.thresholdSoft=0.15f; p.radius=60.f; p.levels=0;
        p.intensity=1.5f; p.blendOp=BLEND_SCREEN; p.dimensions=DIM_BOTH;
        fails += runConfig("STRICT", p, W, H, 1e-3f);
    }
    // (b) DEFAULTS — full pipeline (linear light + soft-clip tonemap).
    {
        Params p; // all defaults: linearLight=true, tonemap=SOFTCLIP
        p.threshold=0.30f; p.thresholdSoft=0.10f; p.radius=80.f;
        fails += runConfig("DEFAULTS", p, W, H, 1e-3f);
    }
    // (c) GLOW-ONLY + anamorphic + EXP falloff — exercises alpha path + squash.
    {
        Params p;
        p.linearLight=false; p.tonemap=TONE_NONE;
        p.glowOnly=true; p.dimensions=DIM_HORIZONTAL; p.falloff=FALLOFF_EXP;
        p.threshold=0.35f; p.thresholdSoft=0.0f; p.radius=120.f; p.colorize=true;
        p.glowR=0.6f; p.glowG=0.8f; p.glowB=1.0f; p.saturation=0.3f;
        fails += runConfig("GLOWONLY_ANAMORPHIC", p, W, H, 1e-3f);
    }

    if (fails){ printf("\n%d config(s) FAILED parity\n", fails); return 1; }
    printf("\nALL PARITY CONFIGS PASSED\n");
    return 0;
}

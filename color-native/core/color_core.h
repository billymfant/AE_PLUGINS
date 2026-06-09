#pragma once
#include <vector>
#include "color_params.h"

namespace colorlab {

// RGBA float image, row-major, 4 floats/pixel.
struct Image {
    int w = 0, h = 0;
    std::vector<float> px;             // size w*h*4
    Image() {}
    Image(int W, int H) : w(W), h(H), px((size_t)W*H*4, 0.f) {}
    float* at(int x, int y) { return &px[((size_t)y*w + x) * 4]; }
    const float* at(int x, int y) const { return &px[((size_t)y*w + x) * 4]; }
};

// Grade one RGB triplet in place (alpha untouched by caller). Pure point op —
// header-inline so the SAME code runs on CPU (grade) and GPU (CUDA kernel).
CL_HD inline void gradePixel(float& r, float& g, float& b, const Params& P) {
    // 1. linearize
    if (P.linearLight) { r=srgb_to_linear(r); g=srgb_to_linear(g); b=srgb_to_linear(b); }
    // 2. exposure (stops)
    if (P.exposure != 0.f) { float m=exp2f(P.exposure); r*=m; g*=m; b*=m; }
    // 3. white balance
    if (P.temperature != 0.f || P.tint != 0.f) applyWhiteBalance(r,g,b,P.temperature,P.tint);
    // 4. lift/gamma/gain (per channel = master luma + channel push)
    r = applyLGGChannel(r, P.liftLuma+P.liftR, P.gammaLuma+P.gammaR, P.gainLuma+P.gainR);
    g = applyLGGChannel(g, P.liftLuma+P.liftG, P.gammaLuma+P.gammaG, P.gainLuma+P.gainG);
    b = applyLGGChannel(b, P.liftLuma+P.liftB, P.gammaLuma+P.gammaB, P.gainLuma+P.gainB);
    // 5. contrast (pivot)
    if (P.contrast != 0.f) {
        r=applyContrast(r,P.contrast,P.contrastPivot);
        g=applyContrast(g,P.contrast,P.contrastPivot);
        b=applyContrast(b,P.contrast,P.contrastPivot);
    }
    // 6. curves: master on each channel, then per-channel, then luma (chroma-preserving)
    r=evalCurve(P.curveMaster,r); g=evalCurve(P.curveMaster,g); b=evalCurve(P.curveMaster,b);
    r=evalCurve(P.curveR,r); g=evalCurve(P.curveG,g); b=evalCurve(P.curveB,b);
    if (P.curveLuma.n >= 2) {
        float y = lumaRec709(r,g,b);
        float ny = evalCurve(P.curveLuma, y);
        float s = (y > 1e-5f) ? ny / y : 1.f;
        r*=s; g*=s; b*=s;
    }
    // 7. saturation
    if (P.saturation != 0.f) applySaturation(r,g,b,P.saturation);
    // 8. tone-map
    if (P.tonemap == TONE_SOFTCLIP) { r=toneSoftClip(r,P.highlightComp); g=toneSoftClip(g,P.highlightComp); b=toneSoftClip(b,P.highlightComp); }
    // 9. delinearize
    if (P.linearLight) { r=linear_to_srgb(r); g=linear_to_srgb(g); b=linear_to_srgb(b); }
}

// Grade a whole image in place (CPU).
void grade(Image& im, const Params& P);

} // namespace colorlab

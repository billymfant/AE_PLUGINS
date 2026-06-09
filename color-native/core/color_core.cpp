#include "color_core.h"

namespace colorlab {

CL_HD void gradePixel(float& r, float& g, float& b, const Params& P) {
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
    // 6. (curves P3, HSL P4 — no-op hooks here)
    // 7. saturation
    if (P.saturation != 0.f) applySaturation(r,g,b,P.saturation);
    // 8. tone-map
    if (P.tonemap == TONE_SOFTCLIP) { r=toneSoftClip(r,P.highlightComp); g=toneSoftClip(g,P.highlightComp); b=toneSoftClip(b,P.highlightComp); }
    // 9. delinearize
    if (P.linearLight) { r=linear_to_srgb(r); g=linear_to_srgb(g); b=linear_to_srgb(b); }
}

void grade(Image& im, const Params& P) {
    const size_t n = (size_t)im.w * im.h;
    for (size_t i = 0; i < n; ++i) {
        float* p = &im.px[i*4];
        gradePixel(p[0], p[1], p[2], P);   // alpha p[3] untouched
    }
}

} // namespace colorlab

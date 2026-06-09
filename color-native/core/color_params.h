#pragma once
#include <cmath>

// Shared host/device marker (mirrors glow's GLOW_HD). nvcc defines __CUDACC__.
#ifdef __CUDACC__
#define CL_HD __host__ __device__
#else
#define CL_HD
#endif

namespace colorlab {

enum Tonemap { TONE_NONE = 1, TONE_SOFTCLIP = 2, TONE_FILMIC = 3 };

// Normalized params. Wheel RGB pushes ~[-0.5,0.5], luma ~[-0.5,0.5]; defaults = identity.
struct Params {
    // primaries
    float exposure      = 0.0f;   // stops (linear *= 2^exposure)
    float contrast      = 0.0f;   // -1..1 (factor = 1+contrast)
    float contrastPivot = 0.18f;  // linear mid-grey pivot
    float temperature   = 0.0f;   // -1..1 (+ = warmer)
    float tint          = 0.0f;   // -1..1 (+ = magenta)
    float saturation    = 0.0f;   // -1..1 (factor = 1+saturation)
    // 3-way wheels (shadows/mids/highs): per-channel push + master luma
    float liftR=0, liftG=0, liftB=0, liftLuma=0;
    float gammaR=0, gammaG=0, gammaB=0, gammaLuma=0;
    float gainR=0, gainG=0, gainB=0, gainLuma=0;
    // output
    bool  linearLight   = true;
    int   tonemap       = TONE_NONE;
    float highlightComp = 0.5f;   // 0..1 soft-clip knee strength
};

// ---- sRGB transfer (IEC 61966-2-1) ----
CL_HD inline float srgb_to_linear(float c) {
    if (c <= 0.f) return 0.f;
    return c <= 0.04045f ? c / 12.92f : powf((c + 0.055f) / 1.055f, 2.4f);
}
CL_HD inline float linear_to_srgb(float c) {
    if (c <= 0.f) return 0.f;
    return c <= 0.0031308f ? c * 12.92f : 1.055f * powf(c, 1.f / 2.4f) - 0.055f;
}
CL_HD inline float lumaRec709(float r, float g, float b) {
    return 0.2126f * r + 0.7152f * g + 0.0722f * b;
}

// ---- white balance: per-channel gains in linear (approx chromatic adaptation) ----
CL_HD inline void applyWhiteBalance(float& r, float& g, float& b, float temp, float tint) {
    float rGain = 1.f + 0.50f * temp + 0.20f * tint;
    float gGain = 1.f - 0.30f * tint;
    float bGain = 1.f - 0.50f * temp + 0.20f * tint;
    r *= rGain; g *= gGain; b *= bGain;
}

// ---- 3-way lift/gamma/gain on ONE channel (shadows -> mids -> highs) ----
// lift lifts blacks (shadow-weighted), gamma is a mid power, gain multiplies highs.
CL_HD inline float applyLGGChannel(float c, float lift, float gamma, float gain) {
    c = c + lift * (1.f - c);                 // lift (shadow-weighted offset)
    float p = 1.f + gamma;                    // gamma push -> power 1/p
    if (p < 0.05f) p = 0.05f;
    c = c < 0.f ? 0.f : powf(c, 1.f / p);
    c = c * (1.f + gain);                     // gain (highlight multiply)
    return c;
}

// ---- contrast around a pivot (linear) ----
CL_HD inline float applyContrast(float c, float contrast, float pivot) {
    return (c - pivot) * (1.f + contrast) + pivot;
}

// ---- luma-preserving saturation ----
CL_HD inline void applySaturation(float& r, float& g, float& b, float sat) {
    float y = lumaRec709(r, g, b);
    float s = 1.f + sat;
    r = y + (r - y) * s; g = y + (g - y) * s; b = y + (b - y) * s;
}

// ---- soft-clip tone-map (Reinhard-style, knee = highlightComp) ----
CL_HD inline float toneSoftClip(float c, float knee) {
    if (c <= 0.f) return 0.f;
    float k = 0.25f + 1.75f * knee;           // stronger knee = earlier roll-off
    return c / (1.f + c * k) * (1.f + k);     // normalized so small values ~unchanged
}

} // namespace colorlab

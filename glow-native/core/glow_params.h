#pragma once
#include <cmath>

// Mark helpers that must run in BOTH the CPU engine (core/glow_core.cpp) and the
// CUDA kernels (cuda/glow_cuda.cu). nvcc defines __CUDACC__; a plain host C++
// compiler does not understand the attributes, so it expands to nothing there.
#ifdef __CUDACC__
#define GLOW_HD __host__ __device__
#else
#define GLOW_HD
#endif

namespace glow {

enum Falloff   { FALLOFF_LINEAR = 1, FALLOFF_SOFT = 2, FALLOFF_EXP = 3 };
enum BlendOp   { BLEND_ADD = 1, BLEND_SCREEN = 2 };
enum Dimensions{ DIM_BOTH = 1, DIM_HORIZONTAL = 2, DIM_VERTICAL = 3 };
enum Tonemap   { TONE_NONE = 1, TONE_SOFTCLIP = 2, TONE_FILMIC = 3 };
// Which channel the glow-selection band qualifies on (the "Range Mode" UI popup).
enum RangeMode { RANGE_LUMINANCE = 1, RANGE_SATURATION = 2, RANGE_HUE = 3 };

// Normalized parameters (UI ranges converted by the caller; see DeepGlowGPU.h bridge).
struct Params {
    float intensity     = 1.5f;          // 150% / 100
    float radius        = 60.0f;         // px
    float threshold     = 80.0f / 255.f; // 0..1 LOW edge of the selection band (UI 0..255 / 255)
    float thresholdSoft = 20.0f / 100.f; // 0..1 feather BELOW the low edge
    // --- glow-selection band (interactive "Glow Selection" range qualifier) ---
    float rangeHigh     = 1.0f;          // 0..1 HIGH edge of the band; >=1 => unbounded (legacy high-pass, HDR-safe)
    float rangeSoftHigh = 0.0f;          // 0..1 feather ABOVE the high edge
    int   rangeMode     = RANGE_LUMINANCE; // qualify on luminance / saturation / hue
    bool  invertRange   = false;         // select OUTSIDE the band instead of inside
    float sourceGain    = 1.0f;          // 0..4
    float glowR = 1.f, glowG = 1.f, glowB = 1.f; // tint 0..1
    bool  colorize      = false;
    float saturation    = 0.0f;          // -1..1
    float hueShift      = 0.0f;          // radians
    int   levels        = 0;             // mip levels; 0 = auto from radius (was "Passes")
    int   falloff       = FALLOFF_SOFT;
    int   blendOp       = BLEND_SCREEN;
    int   dimensions    = DIM_BOTH;
    bool  glowOnly      = false;
    bool  linearLight   = true;
    int   tonemap       = TONE_SOFTCLIP;
    float highlightComp = 0.5f;          // 0..1 tonemap knee strength
};

// Weight applied to mip LEVEL l (0 = finest) when accumulating the upsample.
// Mirrors _glowPassScale() in jsx/glow.jsx: level 0 -> 1.0.
inline float levelWeight(int l, int levels, int falloff) {
    if (levels < 1) levels = 1;
    if (falloff == FALLOFF_LINEAR) {
        float denom = (levels - 1) > 1 ? float(levels - 1) : 1.0f;
        float v = 1.0f - (float(l) / denom) * 0.9f;
        return v < 0.05f ? 0.05f : v;
    }
    if (falloff == FALLOFF_EXP) {
        float v = 1.0f;
        for (int i = 0; i < l; ++i) v *= 0.45f;
        return v;
    }
    return 1.0f / std::sqrt(float(l + 1)); // SOFT (default)
}

// Energy-normalization factor for the across-levels accumulation: 1 / sum of
// the per-level weights. Multiplying the accumulated glow by this makes the
// bloom energy-preserving, so Radius/Layers change spread & softness only, not
// brightness. Host-only (called on the host side of BOTH engines), so it stays
// in parity by construction.
inline float levelWeightNorm(int levels, int falloff) {
    if (levels < 1) levels = 1;
    float s = 0.f;
    for (int l = 0; l < levels; ++l) s += levelWeight(l, levels, falloff);
    return (s > 1e-6f) ? 1.f / s : 1.f;
}

// Number of mip levels to build for an image of min-dimension `minDim`.
// radius -> how many halvings reach that spread; capped by image size and 10.
inline int autoLevels(float radius, int minDim) {
    int byRadius = int(std::ceil(std::log2(radius > 2.f ? radius : 2.f))); // e.g. 60->6, 300->9
    int byImage  = int(std::floor(std::log2(minDim > 2 ? minDim : 2))) - 1;
    int n = byRadius < byImage ? byRadius : byImage;
    if (n < 1)  n = 1;
    if (n > 10) n = 10;
    return n;
}

/* ------------------------------------------------------------------ *
 *  Glow-selection helpers (shared host + device; keep bit-identical so
 *  the CPU engine and the CUDA kernels stay in AC4 parity).
 * ------------------------------------------------------------------ */

// The qualifier value for a pixel under the chosen Range Mode, 0..1
// (luminance may exceed 1 in linear light; saturation/hue are bounded 0..1).
GLOW_HD inline float selValue(float r, float g, float b, int mode) {
    if (mode == RANGE_SATURATION) {
        float mx = r>g ? (r>b?r:b) : (g>b?g:b);
        float mn = r<g ? (r<b?r:b) : (g<b?g:b);
        return mx <= 1e-6f ? 0.f : (mx - mn) / mx;      // HSV saturation
    }
    if (mode == RANGE_HUE) {
        float mx = r>g ? (r>b?r:b) : (g>b?g:b);
        float mn = r<g ? (r<b?r:b) : (g<b?g:b);
        float d  = mx - mn;
        if (d <= 1e-6f) return 0.f;                     // achromatic -> hue 0
        float h;
        if      (mx == r) h = (g - b) / d + (g < b ? 6.f : 0.f);
        else if (mx == g) h = (b - r) / d + 2.f;
        else              h = (r - g) / d + 4.f;
        return h / 6.f;                                 // 0..1
    }
    return 0.2126f*r + 0.7152f*g + 0.0722f*b;           // RANGE_LUMINANCE (Rec.709)
}

GLOW_HD inline float selSmooth(float e0, float e1, float x) {
    float t = (x - e0) / (e1 - e0 + 1e-6f);
    t = t<0?0:(t>1?1:t);
    return t*t*(3.0f - 2.0f*t);
}

// Trapezoidal selection over [low, high] with feathered feet: ramps up across
// [low-softLow, low], plateaus to `high`, ramps down across [high, high+softHigh].
// high >= 1 => no upper bound (preserves the legacy threshold high-pass and keeps
// HDR/superbright pixels glowing). invert flips inside<->outside the band.
GLOW_HD inline float rangeMask(float v, float low, float softLow,
                               float high, float softHigh, bool invert) {
    float lo = (softLow <= 0.f) ? (v >= low ? 1.f : 0.f)
                                : selSmooth(low - softLow, low, v);
    float hi;
    if      (high >= 1.f)      hi = 1.f;                        // unbounded top
    else if (softHigh <= 0.f)  hi = (v <= high ? 1.f : 0.f);    // hard top
    else                       hi = 1.f - selSmooth(high, high + softHigh, v);
    float m = lo * hi;
    return invert ? (1.f - m) : m;
}

// Luma-preserving hue rotation (radians) of an RGB triplet — the standard
// matrix used by SVG/CSS feColorMatrix "hueRotate". Drives the Hue Shift param.
GLOW_HD inline void hueRotate(float& r, float& g, float& b, float a) {
    float c = cosf(a), s = sinf(a);
    float m00=0.213f+c*0.787f-s*0.213f, m01=0.715f-c*0.715f-s*0.715f, m02=0.072f-c*0.072f+s*0.928f;
    float m10=0.213f-c*0.213f+s*0.143f, m11=0.715f+c*0.285f+s*0.140f, m12=0.072f-c*0.072f-s*0.283f;
    float m20=0.213f-c*0.213f-s*0.787f, m21=0.715f-c*0.715f+s*0.715f, m22=0.072f+c*0.928f+s*0.072f;
    float nr=m00*r+m01*g+m02*b, ng=m10*r+m11*g+m12*b, nb=m20*r+m21*g+m22*b;
    r=nr; g=ng; b=nb;
}

} // namespace glow

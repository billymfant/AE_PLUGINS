#pragma once
#include <cmath>

namespace glow {

enum Falloff   { FALLOFF_LINEAR = 1, FALLOFF_SOFT = 2, FALLOFF_EXP = 3 };
enum BlendOp   { BLEND_ADD = 1, BLEND_SCREEN = 2 };
enum Dimensions{ DIM_BOTH = 1, DIM_HORIZONTAL = 2, DIM_VERTICAL = 3 };
enum Tonemap   { TONE_NONE = 1, TONE_SOFTCLIP = 2, TONE_FILMIC = 3 };

// Normalized parameters (UI ranges converted by the caller; see DeepGlowGPU.h bridge).
struct Params {
    float intensity     = 1.5f;          // 150% / 100
    float radius        = 60.0f;         // px
    float threshold     = 80.0f / 255.f; // 0..1 luma compare (UI 0..255 / 255)
    float thresholdSoft = 20.0f / 100.f; // 0..1 knee width below threshold
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

} // namespace glow

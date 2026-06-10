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

static const int CL_MAXPTS = 16;

// Tone curve as <=16 control points (x,y in nominal 0..1, x ascending).
// n<2 => identity. m[] = monotone tangents filled by prepareCurve().
struct Curve {
    int   n = 0;
    float x[CL_MAXPTS];
    float y[CL_MAXPTS];
    float m[CL_MAXPTS];
};

// Host: compute Fritsch-Carlson monotone tangents (call once before grading).
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
    if (x <= c.x[0])   return c.y[0]   + (x - c.x[0])   * c.m[0];
    if (x >= c.x[n-1]) return c.y[n-1] + (x - c.x[n-1]) * c.m[n-1];
    int i = 0; while (i < n-1 && x > c.x[i+1]) ++i;
    float h = c.x[i+1] - c.x[i], t = (x - c.x[i]) / h;
    float t2 = t*t, t3 = t2*t;
    float h00 = 2*t3 - 3*t2 + 1, h10 = t3 - 2*t2 + t, h01 = -2*t3 + 3*t2, h11 = t3 - t2;
    return h00*c.y[i] + h10*h*c.m[i] + h01*c.y[i+1] + h11*h*c.m[i+1];
}

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
    // tone curves (identity by default; run prepareCurve() before grading)
    Curve curveMaster, curveR, curveG, curveB, curveLuma;
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
    // output
    // linearLight OFF by default: the whole grade runs in display space so
    // contrast/saturation/curves/white-balance feel like Lumetri/DaVinci (gentler,
    // predictable). Turn ON for physically-linear exposure work. (Was true.)
    bool  linearLight   = false;
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

// ---- white balance: per-channel gains (approx chromatic adaptation) ----
// Coefficients deliberately gentle: at full slider (+-1) Temp shifts R/B by 30%,
// Tint by 12% — strong but not garish. (Was 0.50/0.20; halved-ish per user feedback.)
CL_HD inline void applyWhiteBalance(float& r, float& g, float& b, float temp, float tint) {
    float rGain = 1.f + 0.30f * temp + 0.12f * tint;
    float gGain = 1.f - 0.18f * tint;
    float bGain = 1.f - 0.30f * temp + 0.12f * tint;
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

// ---- HSL secondary qualifier helpers (shared host/device) ----
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

} // namespace colorlab

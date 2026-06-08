/*
 *  DeepGlowGPU.h
 *  Deep Glow — native After Effects GPU plugin (C++ / CUDA)
 *
 *  Shared definitions used by BOTH the host-side C++ (DeepGlowGPU.cpp) and,
 *  where noted, the CUDA kernels (DeepGlowGPU.cu). Keep this header free of
 *  AE-SDK-only types in the sections marked "shared with CUDA".
 *
 *  Parameter layout intentionally mirrors jsx/glow.jsx so the native plugin
 *  reproduces the ExtendScript tool's behavior.
 */

#pragma once

#include <math.h>

/* ------------------------------------------------------------------ *
 *  Versioning (shown in About + used by AE for effect cache keys)
 * ------------------------------------------------------------------ */
#define DG_NAME              "Deep Glow"
#define DG_DESCRIPTION       "Photoreal multi-pass glow (GPU accelerated)"
#define DG_CATEGORY          "AE Plugin Suite"

#define DG_MAJOR_VERSION     0
#define DG_MINOR_VERSION     1
#define DG_BUG_VERSION       0
#define DG_STAGE_VERSION     PF_Stage_DEVELOP
#define DG_BUILD_VERSION     1

/* ------------------------------------------------------------------ *
 *  Parameter indices  (AE params are 1-based; index 0 is the input)
 *  Order here defines the UI order and the param-checkout order.
 * ------------------------------------------------------------------ */
enum {
    DG_INPUT = 0,          /* the layer the effect is applied to        */
    DG_INTENSITY,          /* float %   0..1000   (default 150)         */
    DG_RADIUS,             /* float px  0..500    (default 60)          */
    DG_THRESHOLD,          /* float     0..255    (default 80) low edge  */
    DG_THRESHOLD_SOFT,     /* float     0..100    (default 20) low feather*/

    /* --- glow selection band (interactive range qualifier) -------- */
    DG_RANGE_MODE,         /* popup  Luminance/Saturation/Hue (default 1)*/
    DG_RANGE_HIGH,         /* float     0..255    (default 255 = open)   */
    DG_RANGE_HIGH_SOFT,    /* float     0..100    (default 0) high feather*/
    DG_INVERT_RANGE,       /* checkbox            (default off)          */

    DG_SOURCE_GAIN,        /* float %   0..400    (default 100)         */
    DG_GLOW_COLOR,         /* color               (default white)       */
    DG_COLORIZE,           /* checkbox            (default off)         */
    DG_SATURATION,         /* float   -100..100   (default 0)           */
    DG_HUE_SHIFT,          /* float   -180..180   (default 0)           */
    DG_PASSES,             /* int       1..8      (default 2)           */
    DG_FALLOFF,            /* popup  Linear/Soft/Exp (default Soft=2)   */
    DG_BLEND_OP,           /* popup  Add/Screen      (default Screen=2) */
    DG_DIMENSIONS,         /* popup  Both/Horiz/Vert (default Both=1)   */
    DG_GLOW_ONLY,          /* checkbox            (default off)         */

    /* --- cinematic params (v1 §4) --------------------------------- */
    DG_LINEAR_LIGHT,       /* checkbox            (default ON)          */
    DG_TONEMAP,            /* popup  None/Soft-clip/Filmic (default 2)  */
    DG_HIGHLIGHT_COMP,     /* float     0..100    (default 0)           */

    DG_NUM_PARAMS          /* keep last */
};

/* Popup option strings (pipe-separated as AE expects) */
#define DG_FALLOFF_CHOICES     "Linear|Soft|Exponential"
#define DG_BLEND_OP_CHOICES    "Add|Screen"
#define DG_DIMENSIONS_CHOICES  "Both|Horizontal|Vertical"
#define DG_TONEMAP_CHOICES     "None|Soft-clip|Filmic"
#define DG_RANGE_MODE_CHOICES  "Luminance|Saturation|Hue"

/* Falloff enum (1-based to match AE popup values) */
enum { DG_FALLOFF_LINEAR = 1, DG_FALLOFF_SOFT, DG_FALLOFF_EXP };
/* Blend op enum */
enum { DG_BLEND_ADD = 1, DG_BLEND_SCREEN };
/* Dimensions enum */
enum { DG_DIM_BOTH = 1, DG_DIM_HORIZONTAL, DG_DIM_VERTICAL };
/* Tonemap enum (1-based to match AE popup values) */
enum { DG_TONEMAP_NONE = 1, DG_TONEMAP_SOFTCLIP, DG_TONEMAP_FILMIC };

/* ------------------------------------------------------------------ *
 *  GlowParams  —  shared with CUDA  (plain data, no AE types)
 *  The host fills this from the checked-out params and hands it to the
 *  kernel launchers. Keep it POD so it can be memcpy'd to device.
 * ------------------------------------------------------------------ */
typedef struct {
    float  intensity;        /* 0..10   (already / 100 from the %)      */
    float  radius;           /* px                                      */
    float  threshold;        /* 0..1    (already / 255)                 */
    float  thresholdSoft;    /* 0..1    (already / 100)                 */
    float  sourceGain;       /* 0..4    (already / 100)                 */
    float  glowR, glowG, glowB; /* 0..1 tint color                      */
    int    colorize;         /* 0/1                                     */
    float  saturation;       /* -1..1                                   */
    float  hueShift;         /* radians                                 */
    int    passes;           /* 1..8                                    */
    int    falloff;          /* DG_FALLOFF_*                            */
    int    blendOp;          /* DG_BLEND_*                              */
    int    dimensions;       /* DG_DIM_*                                */
    int    glowOnly;         /* 0/1                                     */

    int    linearLight;      /* 0/1   (cinematic: work in linear light) */
    int    tonemap;          /* DG_TONEMAP_*                            */
    float  highlightComp;    /* 0..1  (already / 100 from the %)        */

    int    width;            /* buffer dims (pixels)                    */
    int    height;
    int    srcPitch;         /* row pitch in elements (not bytes)       */
    int    dstPitch;
} GlowParams;

/* ------------------------------------------------------------------ *
 *  Per-pass weighting — MUST match _glowPassScale() in jsx/glow.jsx
 *  so the native look matches the ExtendScript look.
 * ------------------------------------------------------------------ */
static inline float DG_PassScale(int pass, int passes, int falloff) {
    if (falloff == DG_FALLOFF_LINEAR) {
        float denom = (passes - 1) > 1 ? (float)(passes - 1) : 1.0f;
        float v = 1.0f - ((float)pass / denom) * 0.9f;
        return v < 0.05f ? 0.05f : v;
    }
    if (falloff == DG_FALLOFF_EXP) {
        /* 0.45 ^ pass */
        float v = 1.0f;
        for (int i = 0; i < pass; ++i) v *= 0.45f;
        return v;
    }
    /* Soft (default): 1 / sqrt(pass + 1) */
    return 1.0f / (float)sqrt((double)(pass + 1));
}

static inline float DG_PassRadiusFactor(int pass) {
    return 1.0f + (float)pass * 0.8f;   /* matches jsx passRadiusFactor */
}

/*
 *  ColorLab.h
 *  Color Lab — native After Effects color-grading plugin (C++ / CUDA engine).
 *
 *  Shared definitions for the AE host adapter (ColorLab.cpp). The grading MATH
 *  lives entirely in ../core/ (colorlab::grade); this .aex is a thin adapter.
 *
 *  Scope (this build): CPU SmartRender path, primaries + 3-way wheels + output
 *  + tone curves (Master + per-channel R/G/B, 16-node LUT each, driven by the
 *  CEP panel). HSL secondary + GPU SmartRender + scope emit are follow-ups
 *  (the engine already supports them; see README).
 */
#pragma once
#include <math.h>

#define CL_NAME           "Color Lab"
#define CL_DESCRIPTION    "Fast color correction (native engine)"
#define CL_CATEGORY       "AE Plugin Suite"

#define CL_MAJOR_VERSION  0
#define CL_MINOR_VERSION  1
#define CL_BUG_VERSION    0
#define CL_STAGE_VERSION  PF_Stage_DEVELOP
#define CL_BUILD_VERSION  1

/* Parameter indices (AE params are 1-based; index 0 is the input).
 * Order defines UI order + checkout order; must match ParamsSetup + ReadParams. */
enum {
    CLP_INPUT = 0,
    /* primaries */
    CLP_EXPOSURE,     /* stops      -5..5     default 0   */
    CLP_CONTRAST,     /* %         -100..100  default 0   */
    CLP_PIVOT,        /* 0..1                 default 0.18*/
    CLP_TEMP,         /* %         -100..100  default 0   */
    CLP_TINT,         /* %         -100..100  default 0   */
    CLP_SAT,          /* %         -100..100  default 0   */
    /* lift (shadows) */
    CLP_LIFT_R, CLP_LIFT_G, CLP_LIFT_B, CLP_LIFT_L,   /* % -50..50 -> -0.5..0.5 */
    /* gamma (mids) */
    CLP_GAMMA_R, CLP_GAMMA_G, CLP_GAMMA_B, CLP_GAMMA_L,
    /* gain (highlights) */
    CLP_GAIN_R, CLP_GAIN_G, CLP_GAIN_B, CLP_GAIN_L,
    /* output */
    CLP_LINEAR,       /* checkbox             default OFF (grade in display space) */
    CLP_TONEMAP,      /* popup None/Soft/Filmic default None */
    CLP_HICOMP,       /* %          0..100    default 50  */
    /* tone curves: 4 channels (Master,R,G,B) x 16 LUT nodes (x = i/15),
     * value 0..1, identity default. Contiguous from CLP_CURVE_BASE so
     * ReadParams can index params[CLP_CURVE_BASE + ch*16 + i]. */
    CLP_CURVE_BASE,
    CL_NUM_PARAMS = CLP_CURVE_BASE + 64   /* keep last (4 ch x 16 nodes) */
};

#define CL_CURVE_N        16
#define CL_TONEMAP_CHOICES "None|Soft-clip|Filmic"   /* values 1,2,3 == colorlab::TONE_* */

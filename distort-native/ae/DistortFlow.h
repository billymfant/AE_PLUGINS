/*
 *  DistortFlow.h
 *  Distort Flow — native After Effects map-driven warp plugin (C++ engine).
 *
 *  Shared definitions for the AE host adapter (DistortFlow.cpp). All warp MATH
 *  lives in ../core/ (distort::warp); this .aex is a thin adapter. D3a build:
 *  CPU SmartRender, generator maps (gradient/radial/wave/noise), spatial warp
 *  with flow animated across footage time. Layer-map + CEP panel are D3b.
 */
#pragma once

#define DF_NAME           "Distort Flow"
#define DF_DESCRIPTION     "Map-driven spatial warp (native engine)"
#define DF_CATEGORY        "AE Plugin Suite"

#define DF_MAJOR_VERSION  0
#define DF_MINOR_VERSION  1
#define DF_BUG_VERSION    0
#define DF_STAGE_VERSION  PF_Stage_DEVELOP
#define DF_BUILD_VERSION  1

/* Parameter indices (AE params are 1-based; index 0 is the input layer).
 * Order defines UI order + checkout order; must match ParamsSetup + ReadParams. */
enum {
    DFP_INPUT = 0,
    /* map */
    DFP_MAPTYPE,      /* popup Gradient|Radial|Wave|Noise  (1..4 == MAP_*)        */
    DFP_ANGLE,        /* deg   -180..180   default 0                              */
    DFP_SPACING,      /* 0..32             default 4   (0 => uniform field)       */
    DFP_WAVEFREQ,     /* 0..20             default 4                              */
    DFP_WAVEPHASE,    /* deg   -360..360   default 0   (-> radians in ReadParams) */
    DFP_NOISESCALE,   /* 0.5..16           default 3                             */
    DFP_NOISEDETAIL,  /* int   1..6        default 3   (fbm octaves)             */
    DFP_NOISESEED,    /* int   1..999      default 1                             */
    DFP_CONTRAST,     /* %     -100..100   default 0   (-> -1..1)                */
    /* displace */
    DFP_DISPMODE,     /* popup Fixed|Along Gradient|Push-Pull (1..3 == DISP_*)   */
    DFP_AMOUNT,       /* px    0..400      default 0   (0 => identity warp)      */
    /* flow */
    DFP_FLOWDIR,      /* popup Forward|Reverse|Center-Out|Edges-In (1..4)        */
    DFP_FLOWSPEED,    /* cyc/s -4..4       default 0   (0 => static)             */
    DFP_LOOP,         /* popup Loop|Ping-Pong|Once  (1..3 == LOOP_*)             */
    DFP_EASING,       /* popup Linear|In|Out|InOut|Sine|Exp (1..6 == EASE_*)     */
    DFP_JITTER,       /* %     0..100      default 0   (-> 0..1)                 */
    DFP_JITTERSEED,   /* int   1..999      default 1                            */
    DFP_PHASE,        /* 0..1              default 0                            */
    /* output */
    DFP_EDGE,         /* popup Clamp|Wrap|Mirror|Transparent (1..4 == EDGE_*)    */
    DFP_OPACITY,      /* %     0..100      default 100 (-> 0..1)                 */
    DFP_MOSAIC,       /* px    0..200      default 0   (>=1 => blocky mosaic)    */
    DF_NUM_PARAMS     /* keep last */
};

/* Popup choice strings (values are 1-based, matching the distort:: enums). */
#define DF_MAP_CHOICES   "Gradient|Radial|Wave|Noise"
#define DF_DISP_CHOICES  "Fixed|Along Gradient|Push-Pull"
#define DF_FLOW_CHOICES  "Forward|Reverse|Center-Out|Edges-In"
#define DF_LOOP_CHOICES  "Loop|Ping-Pong|Once"
#define DF_EASE_CHOICES  "Linear|Ease In|Ease Out|Ease In-Out|Sine|Exp"
#define DF_EDGE_CHOICES  "Clamp|Wrap|Mirror|Transparent"

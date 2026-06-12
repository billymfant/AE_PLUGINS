#pragma once
#include <vector>
#include "distort_params.h"
namespace distort {
struct Image {
    int w=0,h=0; std::vector<float> px;          // w*h*4 RGBA
    Image(){}
    Image(int W,int H):w(W),h(H),px((size_t)W*H*4,0.f){}
    float* at(int x,int y){ return &px[((size_t)y*w+x)*4]; }
    const float* at(int x,int y) const { return &px[((size_t)y*w+x)*4]; }
};
// Map an out-of-range index to a valid one per edge mode (clamp/wrap/mirror).
int edgeIndex(int i,int n,int mode);

// Bilinear RGBA sample at floating (fx,fy). EDGE_TRANSPARENT returns 0000 for
// taps fully outside; clamp/wrap/mirror fold coords back in.
void sampleBilinear(const Image& im,float fx,float fy,int edge,float out[4]);

// Spatial warp: dst(x,y) <- src sampled at (x,y)+displacement(map,flow). mapLayer
// is required only when P.mapType==MAP_LAYER (else pass nullptr). time drives flow.
void warp(const Image& src, Image& dst, const Params& P, const Image* mapLayer, float time=0.f);
} // namespace distort

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
// (warp/sampleBilinear filled in Tasks 4-5)
} // namespace distort

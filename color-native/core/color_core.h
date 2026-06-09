#pragma once
#include <vector>
#include "color_params.h"

namespace colorlab {

// RGBA float image, row-major, 4 floats/pixel.
struct Image {
    int w = 0, h = 0;
    std::vector<float> px;             // size w*h*4
    Image() {}
    Image(int W, int H) : w(W), h(H), px((size_t)W*H*4, 0.f) {}
    float* at(int x, int y) { return &px[((size_t)y*w + x) * 4]; }
    const float* at(int x, int y) const { return &px[((size_t)y*w + x) * 4]; }
};

// Grade one RGB triplet in place (alpha untouched by caller). Pure point op.
CL_HD void gradePixel(float& r, float& g, float& b, const Params& P);

// Grade a whole image in place.
void grade(Image& im, const Params& P);

} // namespace colorlab

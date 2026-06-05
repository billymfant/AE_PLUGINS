#pragma once
#include <vector>
#include <cstddef>
#include "glow_params.h"

namespace glow {

// RGBA interleaved, linear float, row-major.
struct Image {
    int w = 0, h = 0;
    std::vector<float> px;               // size w*h*4
    Image() = default;
    Image(int W, int H) : w(W), h(H), px(size_t(W) * H * 4, 0.0f) {}
    float*       at(int x, int y)       { return &px[(size_t(y) * w + x) * 4]; }
    const float* at(int x, int y) const { return &px[(size_t(y) * w + x) * 4]; }
};

float luma(float r, float g, float b);                 // Rec.709
void  sampleBilinear(const Image& s, float u, float v, float out[4]); // u,v in pixel space, clamp-to-edge

Image extractBright(const Image& src, const Params& p);          // threshold/knee*gain -> bright buffer
Image downsampleHalf(const Image& src);                          // 13-tap -> ceil(w/2) x ceil(h/2)
void  upsampleAdd(const Image& low, Image& hi, float weight, int dimensions); // 9-tap tent, hi += w*up(low)
Image bloom(const Image& src, const Params& p);                  // full pipeline -> composited output

} // namespace glow

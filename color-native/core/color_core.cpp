#include "color_core.h"

namespace colorlab {

// gradePixel is defined header-inline in color_core.h (shared CPU/GPU).

void grade(Image& im, const Params& P) {
    const size_t n = (size_t)im.w * im.h;
    for (size_t i = 0; i < n; ++i) {
        float* p = &im.px[i*4];
        gradePixel(p[0], p[1], p[2], P);   // alpha p[3] untouched
    }
}

} // namespace colorlab

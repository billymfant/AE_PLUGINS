#pragma once
#include "../core/color_core.h"
namespace colorlab {
// Grade an image on the GPU (in place). Same math as grade() — see gradePixel.
void gradeCuda(Image& im, const Params& P);
}

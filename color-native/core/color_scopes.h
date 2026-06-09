#pragma once
#include <vector>
#include <string>
#include "color_core.h"

namespace colorlab {

// Scope statistics computed from a graded image, ready to hand to the panel.
// Layout is flat so it serializes 1:1 to the panel's mmap/temp-file reader.
struct ScopeData {
    enum { HBINS = 256, WFW = 256, WFH = 256, VEC = 128 };
    int srcW = 0, srcH = 0, frame = 0;
    std::vector<unsigned> hist;     // 4 * HBINS  (R, G, B, Luma)
    std::vector<unsigned> waveform; // WFW * WFH  (luma distribution per column)
    std::vector<unsigned> vec;      // VEC * VEC  (U/V density)

    void reset(int w, int h, int f) {
        srcW = w; srcH = h; frame = f;
        hist.assign(4 * (size_t)HBINS, 0u);
        waveform.assign((size_t)WFW * WFH, 0u);
        vec.assign((size_t)VEC * VEC, 0u);
    }
};

// Compute histogram + waveform + vectorscope from a (already graded) image.
void computeScopes(const Image& im, ScopeData& s, int frame = 0);

// Serialize / read the blob. Format: magic 'CLSC', version, srcW, srcH, frame,
// then hist, waveform, vec arrays. Returns false on I/O / format error.
bool writeScopeFile(const std::string& path, const ScopeData& s);
bool readScopeFile(const std::string& path, ScopeData& s);

} // namespace colorlab

#include "color_scopes.h"
#include <cstdio>
#include <cstdint>

namespace colorlab {

static inline int clampBin(float v, int n) {
    int b = (int)(v * n);
    if (b < 0) b = 0;
    if (b >= n) b = n - 1;
    return b;
}

void computeScopes(const Image& im, ScopeData& s, int frame) {
    s.reset(im.w, im.h, frame);
    const int W = im.w, H = im.h;
    unsigned* hR = &s.hist[0];
    unsigned* hG = &s.hist[ScopeData::HBINS];
    unsigned* hB = &s.hist[2 * ScopeData::HBINS];
    unsigned* hY = &s.hist[3 * ScopeData::HBINS];

    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            const float* p = im.at(x, y);
            float r = p[0], g = p[1], b = p[2];
            float Y = lumaRec709(r, g, b);

            ++hR[clampBin(r, ScopeData::HBINS)];
            ++hG[clampBin(g, ScopeData::HBINS)];
            ++hB[clampBin(b, ScopeData::HBINS)];
            ++hY[clampBin(Y, ScopeData::HBINS)];

            // waveform: column = horizontal position, bin = luma
            int col = (W > 1) ? (x * ScopeData::WFW) / W : 0;
            if (col >= ScopeData::WFW) col = ScopeData::WFW - 1;
            int lb = clampBin(Y, ScopeData::WFH);
            ++s.waveform[(size_t)col * ScopeData::WFH + lb];

            // vectorscope: BT.601 U/V chroma, centered at 0.5
            float U = -0.169f * r - 0.331f * g + 0.5f   * b + 0.5f;
            float V =  0.5f   * r - 0.419f * g - 0.081f * b + 0.5f;
            int ui = clampBin(U, ScopeData::VEC);
            int vi = clampBin(V, ScopeData::VEC);
            ++s.vec[(size_t)vi * ScopeData::VEC + ui];
        }
    }
}

static bool writeArr(FILE* f, const std::vector<unsigned>& a) {
    return fwrite(a.data(), sizeof(unsigned), a.size(), f) == a.size();
}
static bool readArr(FILE* f, std::vector<unsigned>& a) {
    return fread(a.data(), sizeof(unsigned), a.size(), f) == a.size();
}

bool writeScopeFile(const std::string& path, const ScopeData& s) {
    FILE* f = fopen(path.c_str(), "wb");
    if (!f) return false;
    uint32_t magic = 0x43534C43u /* 'CLSC' */, version = 1u;
    int32_t hdr[3] = { s.srcW, s.srcH, s.frame };
    bool ok = fwrite(&magic, 4, 1, f) == 1
           && fwrite(&version, 4, 1, f) == 1
           && fwrite(hdr, sizeof(hdr), 1, f) == 1
           && writeArr(f, s.hist) && writeArr(f, s.waveform) && writeArr(f, s.vec);
    fclose(f);
    return ok;
}

bool readScopeFile(const std::string& path, ScopeData& s) {
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) return false;
    uint32_t magic = 0, version = 0;
    int32_t hdr[3] = { 0, 0, 0 };
    bool ok = fread(&magic, 4, 1, f) == 1
           && fread(&version, 4, 1, f) == 1
           && fread(hdr, sizeof(hdr), 1, f) == 1
           && magic == 0x43534C43u && version == 1u;
    if (ok) {
        s.reset(hdr[0], hdr[1], hdr[2]);
        ok = readArr(f, s.hist) && readArr(f, s.waveform) && readArr(f, s.vec);
    }
    fclose(f);
    return ok;
}

} // namespace colorlab

// color_cli in.png out.png [--exposure f][--contrast f][--temp f][--tint f]
//   [--sat f][--lift r g b l][--gamma r g b l][--gain r g b l][--no-linear][--softclip f]
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include "../core/color_core.h"
#include "../core/color_scopes.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
using namespace colorlab;

static float f(const char* s){ return (float)atof(s); }

static colorlab::Curve sCurve(float k){ // k 0..1 contrast S-curve on master
    using namespace colorlab; Curve d; d.n=5;
    d.x[0]=0;    d.y[0]=0;
    d.x[1]=0.25f;d.y[1]=0.25f-0.15f*k;
    d.x[2]=0.5f; d.y[2]=0.5f;
    d.x[3]=0.75f;d.y[3]=0.75f+0.15f*k;
    d.x[4]=1;    d.y[4]=1;
    prepareCurve(d); return d;
}

int main(int argc, char** argv){
    if (argc < 3){ printf("usage: color_cli in.png out.png [params]\n"); return 2; }
    int w,h,c; unsigned char* data = stbi_load(argv[1], &w,&h,&c, 4);
    if (!data){ printf("load failed: %s\n", argv[1]); return 1; }

    Image im(w,h);
    for (int i=0;i<w*h;++i){ for(int k=0;k<4;++k) im.px[i*4+k] = data[i*4+k]/255.f; }
    stbi_image_free(data);

    Params P;
    const char* scopePath = nullptr;
    for (int i=3;i<argc;++i){
        const char* a=argv[i];
        if (!strcmp(a,"--scopes")) { scopePath = argv[++i]; continue; }
        if      (!strcmp(a,"--exposure")) P.exposure=f(argv[++i]);
        else if (!strcmp(a,"--contrast")) P.contrast=f(argv[++i]);
        else if (!strcmp(a,"--temp"))     P.temperature=f(argv[++i]);
        else if (!strcmp(a,"--tint"))     P.tint=f(argv[++i]);
        else if (!strcmp(a,"--sat"))      P.saturation=f(argv[++i]);
        else if (!strcmp(a,"--lift")) { P.liftR=f(argv[++i]);P.liftG=f(argv[++i]);P.liftB=f(argv[++i]);P.liftLuma=f(argv[++i]); }
        else if (!strcmp(a,"--gamma")){ P.gammaR=f(argv[++i]);P.gammaG=f(argv[++i]);P.gammaB=f(argv[++i]);P.gammaLuma=f(argv[++i]); }
        else if (!strcmp(a,"--gain")) { P.gainR=f(argv[++i]);P.gainG=f(argv[++i]);P.gainB=f(argv[++i]);P.gainLuma=f(argv[++i]); }
        else if (!strcmp(a,"--scurve")) P.curveMaster=sCurve(f(argv[++i]));
        else if (!strcmp(a,"--hsl")) { // center width satAdj lumaAdj hueAdj
            P.hslEnable=true; P.hslCenterHue=f(argv[++i]); P.hslHueWidth=f(argv[++i]);
            P.hslSatAdj=f(argv[++i]); P.hslLumaAdj=f(argv[++i]); P.hslHueAdj=f(argv[++i]); }
        else if (!strcmp(a,"--no-linear")) P.linearLight=false;
        else if (!strcmp(a,"--softclip")) { P.tonemap=TONE_SOFTCLIP; P.highlightComp=f(argv[++i]); }
    }

    grade(im, P);

    if (scopePath) {
        ScopeData sc; computeScopes(im, sc, 0);
        if (writeScopeFile(scopePath, sc)) printf("scopes -> %s\n", scopePath);
        else printf("scope write failed: %s\n", scopePath);
    }

    std::vector<unsigned char> out((size_t)w*h*4);
    for (size_t i=0;i<out.size();++i){ float v=im.px[i]; v=v<0?0:(v>1?1:v); out[i]=(unsigned char)(v*255.f+0.5f); }
    if (!stbi_write_png(argv[2], w,h,4, out.data(), w*4)){ printf("write failed\n"); return 1; }
    printf("wrote %s (%dx%d)\n", argv[2], w, h);
    return 0;
}

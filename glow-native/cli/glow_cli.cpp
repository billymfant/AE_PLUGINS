#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include "glow_core.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
using namespace glow;

int main(int argc, char** argv){
    if (argc < 3){ printf(
        "usage: glow_cli in.png out.png [--threshold 0..255] [--radius px] [--intensity %%] [--glowonly]\n"
        "                 [--rangemode lum|sat|hue] [--rangehigh 0..255] [--rangehighsoft 0..100] [--invertrange]\n"
        "                 [--hue -180..180]\n"); return 2; }
    Params p;
    for (int i=3;i<argc;++i){
        if(!strcmp(argv[i],"--threshold")&&i+1<argc) p.threshold=(float)atof(argv[++i])/255.f;
        else if(!strcmp(argv[i],"--radius")&&i+1<argc) p.radius=(float)atof(argv[++i]);
        else if(!strcmp(argv[i],"--intensity")&&i+1<argc) p.intensity=(float)atof(argv[++i])/100.f;
        else if(!strcmp(argv[i],"--glowonly")) p.glowOnly=true;
        else if(!strcmp(argv[i],"--rangehigh")&&i+1<argc) p.rangeHigh=(float)atof(argv[++i])/255.f;
        else if(!strcmp(argv[i],"--rangehighsoft")&&i+1<argc) p.rangeSoftHigh=(float)atof(argv[++i])/100.f;
        else if(!strcmp(argv[i],"--invertrange")) p.invertRange=true;
        else if(!strcmp(argv[i],"--hue")&&i+1<argc) p.hueShift=(float)atof(argv[++i])*3.14159265f/180.f;
        else if(!strcmp(argv[i],"--rangemode")&&i+1<argc){
            const char* m=argv[++i];
            p.rangeMode = !strcmp(m,"sat") ? RANGE_SATURATION
                        : !strcmp(m,"hue") ? RANGE_HUE
                        : RANGE_LUMINANCE;
        }
    }
    int w,h,n; unsigned char* data = stbi_load(argv[1], &w,&h,&n, 4);
    if(!data){ printf("could not load %s\n", argv[1]); return 1; }
    Image src(w,h);
    for (int i=0;i<w*h*4;++i) src.px[i] = data[i]/255.f;
    stbi_image_free(data);

    Image out = bloom(src, p);
    std::vector<unsigned char> o((size_t)w*h*4);
    for (size_t i=0;i<o.size();++i){ float v=out.px[i]; v=v<0?0:(v>1?1:v); o[i]=(unsigned char)(v*255.f+0.5f); }
    if(!stbi_write_png(argv[2], w,h,4,o.data(), w*4)){ printf("could not write %s\n",argv[2]); return 1; }
    printf("wrote %s (%dx%d)\n", argv[2], w,h);
    return 0;
}

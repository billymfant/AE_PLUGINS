// Headless PNG-in/PNG-out harness for the distort core. Lets us reproduce render
// bugs (e.g. edge streaks) without AE in the loop. Build via build-cli.bat.
//
//   distort_cli in.png out.png [key=value ...]
//   distort_cli --synth out.png [key=value ...]   // object-on-transparency test card
//
// keys mirror distort::Params: mapType angle spacing waveFreq wavePhase noiseScale
//   noiseDetail noiseSeed mapContrast displaceMode amount flowDir flowSpeed jitter
//   jitterSeed phase edgeMode opacity mosaic slatRows slatCols slatStagger time
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"
#include "distort_params.h"
#include "distort_core.h"
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <string>
using namespace distort;

// Test card. mode 0: opaque object (disc) on a transparent bg (isolates colour
// leaking into transparent areas). mode 1: footage-like — opaque light gradient
// filling the whole frame + a dark object (edge replication shows as streaks of
// the frame-edge colours, like the user's pinecone footage).
static Image synth(int w,int h,int mode){
    Image im(w,h);
    float cx=w*0.5f, cy=h*0.42f, r=h*0.22f;
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){
        float dx=x-cx, dy=y-cy; float d=sqrtf(dx*dx+dy*dy);
        float* p=im.at(x,y);
        if(d<=r){ p[0]=0.9f; p[1]=0.55f; p[2]=0.15f; p[3]=1.f; }   // solid orange object
        else if(mode==1){ float g=0.85f-0.25f*(float)y/h; p[0]=g;p[1]=g;p[2]=g+0.05f;p[3]=1.f; } // opaque sky
        else { p[0]=p[1]=p[2]=p[3]=0.f; }                          // transparent
    }
    return im;
}

static void setp(Params& P,const std::string& k,float v){
    if(k=="mapType")P.mapType=(int)v; else if(k=="angle")P.angleDeg=v;
    else if(k=="spacing")P.spacing=v; else if(k=="waveFreq")P.waveFreq=v;
    else if(k=="wavePhase")P.wavePhase=v; else if(k=="noiseScale")P.noiseScale=v;
    else if(k=="noiseDetail")P.noiseDetail=(int)v; else if(k=="noiseSeed")P.noiseSeed=(int)v;
    else if(k=="mapContrast")P.mapContrast=v; else if(k=="displaceMode")P.displaceMode=(int)v;
    else if(k=="amount")P.amount=v; else if(k=="flowDir")P.flowDir=(int)v;
    else if(k=="flowSpeed")P.flowSpeed=v; else if(k=="jitter")P.jitter=v;
    else if(k=="jitterSeed")P.jitterSeed=(int)v; else if(k=="phase")P.phase=v;
    else if(k=="edgeMode")P.edgeMode=(int)v; else if(k=="opacity")P.opacity=v;
    else if(k=="mosaic")P.mosaicBlock=v; else if(k=="slatRows")P.slatRows=(int)v;
    else if(k=="slatCols")P.slatCols=(int)v; else if(k=="slatStagger")P.slatStagger=v;
    else fprintf(stderr,"[warn] unknown key '%s'\n",k.c_str());
}

int main(int argc,char**argv){
    if(argc<3){ fprintf(stderr,"usage: distort_cli <in.png|--synth> <out.png> [k=v ...]\n"); return 2; }
    std::string inArg=argv[1], outPath=argv[2];
    Image src; float time=0.f;
    if(inArg=="--synth"){ src=synth(640,360,0); }
    else if(inArg=="--card"){ src=synth(640,360,1); }
    else{
        int w,h,n; unsigned char* d=stbi_load(inArg.c_str(),&w,&h,&n,4);
        if(!d){ fprintf(stderr,"[err] cannot load %s\n",inArg.c_str()); return 1; }
        src=Image(w,h);
        for(int i=0;i<w*h;i++){ float* p=&src.px[i*4]; for(int k=0;k<4;k++) p[k]=d[i*4+k]/255.f; }
        stbi_image_free(d);
    }
    Params P;
    for(int i=3;i<argc;i++){ std::string a=argv[i]; size_t e=a.find('=');
        if(e==std::string::npos) continue; std::string k=a.substr(0,e); float v=(float)atof(a.substr(e+1).c_str());
        if(k=="time") time=v; else setp(P,k,v); }
    Image dst;
    warp(src,dst,P,nullptr,time);
    std::vector<unsigned char> out((size_t)dst.w*dst.h*4);
    for(int i=0;i<dst.w*dst.h;i++){ for(int k=0;k<4;k++){ float v=dst.px[i*4+k]; v=v<0?0:(v>1?1:v); out[i*4+k]=(unsigned char)(v*255.f+0.5f); } }
    if(!stbi_write_png(outPath.c_str(),dst.w,dst.h,4,out.data(),dst.w*4)){ fprintf(stderr,"[err] write failed\n"); return 1; }
    printf("wrote %s (%dx%d)\n",outPath.c_str(),dst.w,dst.h);
    return 0;
}

#include "color_cuda.h"
#include <cuda_runtime.h>
#include <cstdio>

namespace colorlab {

__global__ void gradeKernel(float* px, int n, Params P) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    float* p = px + (size_t)i * 4;
    gradePixel(p[0], p[1], p[2], P);     // identical host/device code
}

void gradeCuda(Image& im, const Params& P) {
    int n = im.w * im.h;
    if (n <= 0) return;
    size_t bytes = (size_t)n * 4 * sizeof(float);
    float* d = nullptr;
    cudaMalloc(&d, bytes);
    cudaMemcpy(d, im.px.data(), bytes, cudaMemcpyHostToDevice);
    int threads = 256, blocks = (n + threads - 1) / threads;
    gradeKernel<<<blocks, threads>>>(d, n, P);
    cudaDeviceSynchronize();
    cudaMemcpy(im.px.data(), d, bytes, cudaMemcpyDeviceToHost);
    cudaFree(d);
}

} // namespace colorlab

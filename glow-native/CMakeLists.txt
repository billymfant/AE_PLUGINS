cmake_minimum_required(VERSION 3.20)
project(glow_native LANGUAGES CXX)

enable_testing()

# Pure-C++ bloom engine — no AE, no CUDA.
# C++17 is requested per-target so future AE/CUDA targets in this tree are unaffected.
add_library(glow_core STATIC core/glow_core.cpp)
target_include_directories(glow_core PUBLIC core)
target_compile_features(glow_core PUBLIC cxx_std_17)
set_target_properties(glow_core PROPERTIES CXX_EXTENSIONS OFF)

# PNG-in/PNG-out harness. cxx_std_17 propagates via the glow_core link.
add_executable(glow_cli cli/glow_cli.cpp)
target_link_libraries(glow_cli PRIVATE glow_core)
target_include_directories(glow_cli PRIVATE cli)

# Property-based acceptance tests.
add_executable(glow_tests tests/glow_tests.cpp)
target_link_libraries(glow_tests PRIVATE glow_core)

add_test(NAME glow_acceptance COMMAND glow_tests)

# ------------------------------------------------------------------ #
#  Optional CUDA target — AC4 CPU/GPU parity guardrail.
#  Guarded so the CPU-only build still works on machines without CUDA.
# ------------------------------------------------------------------ #
include(CheckLanguage)
check_language(CUDA)
if(CMAKE_CUDA_COMPILER)
    enable_language(CUDA)
    set(CMAKE_CUDA_ARCHITECTURES 89)   # RTX 4080 / Ada (sm_89)

    add_executable(glow_parity
        cuda/glow_parity.cpp
        cuda/glow_cuda.cu)
    target_link_libraries(glow_parity PRIVATE glow_core)
    target_include_directories(glow_parity PRIVATE core cuda)
    set_target_properties(glow_parity PROPERTIES
        CUDA_ARCHITECTURES 89
        CXX_STANDARD 17
        CXX_EXTENSIONS OFF)

    add_test(NAME glow_parity COMMAND glow_parity)
    message(STATUS "CUDA found (${CMAKE_CUDA_COMPILER}) — building glow_parity (AC4)")
else()
    message(STATUS "CUDA not found — skipping glow_parity (CPU-only build)")
endif()

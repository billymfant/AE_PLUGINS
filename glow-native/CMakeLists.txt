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

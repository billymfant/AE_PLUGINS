cmake_minimum_required(VERSION 3.20)
project(glow_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Pure-C++ bloom engine — no AE, no CUDA.
add_library(glow_core STATIC core/glow_core.cpp)
target_include_directories(glow_core PUBLIC core)

# PNG-in/PNG-out harness.
add_executable(glow_cli cli/glow_cli.cpp)
target_link_libraries(glow_cli PRIVATE glow_core)
target_include_directories(glow_cli PRIVATE cli)

# Property-based acceptance tests.
add_executable(glow_tests tests/glow_tests.cpp)
target_link_libraries(glow_tests PRIVATE glow_core)

enable_testing()
add_test(NAME glow_tests COMMAND glow_tests)

# tests/ — property-based acceptance tests

`glow_tests` is a tiny self-contained runner (no framework) that asserts the spec's
acceptance criteria on in-code fixtures (white square, gradient):

- **AC1** threshold direction/units · **AC2** soft round falloff (no box) ·
  **AC3** source preserved · **AC4** CPU↔GPU parity (added in Task 11)

Run via `ctest` or the built `glow_tests.exe`. See the plan Tasks 4–7, 11, 12.

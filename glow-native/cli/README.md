# cli/ — standalone PNG-in/PNG-out harness

`glow_cli` runs the `core/` engine on a PNG without After Effects, so the look can be
iterated and regression-tested fast. Primary guardrail for acceptance criteria AC1–AC4.

- `glow_cli.cpp` — load PNG → `glow::bloom()` → write PNG (param flags)
- `stb_image.h`, `stb_image_write.h` — vendored public-domain PNG I/O (harness/tests only)

See the plan Task 8 (and Task 11 for the `--gpu` parity mode).

# Performance, Resource Budget & Verification (`v1.0.0`)

## Resource & Architecture Design Targets

- **Standalone Binary Size (`lumen.exe`):** Measured **`5,006,848` bytes (`4.77 MiB`)** for `v1.0.0` Windows x64 release binary compiled with LTO (`lto = true`), single codegen unit, `opt-level = "s"`, and stripped symbols (`strip = true`) — well under the **20 MB** budget.
- **Idle Polling Ceilings (`NFR-PERF-3`):**
  - Fullscreen + System HUD monitor loop runs strictly at **2 Hz** (`500 ms` sleep).
  - SMTC Media + active Pomodoro timer loop runs strictly at **1 Hz** (`1000 ms` sleep) and emits `lumen://media-updated` only when snapshot state changes.
  - Prayer schedule refresh runs at **1 / 30 Hz** (`30 s`), using offline `adhan` trigonometry.
- **On-Demand Settings WebView (`Section 7.5`):** The `settings` window is dynamically created only when opened and destroyed upon close so idle WebView2 RAM stays focused solely on the island surface.
- **Crash-Safe Diagnostics (`NFR-REL-1`):** Startup events and unexpected panics are logged to `%APPDATA%\Lumen\logs\lumen.log` with automatic 2 MB rotation.

## Automated Quality Gates Verified for `v1.0.0`

- Frontend static checks: `eslint .`, `prettier --check .`, `tsc --noEmit`
- Frontend unit tests: Vitest (`24/24` passed across 9 test files)
- Production Vite bundle build: `tsc --noEmit && vite build` (`1.30 s`)
- Rust checks: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` (`24/24` passed across all 7 workspace crates: `lumen-core`, `lumen-windows`, `lumen-media`, `lumen-prayer`, `lumen-notify`, `lumen-storage`, `lumen-plugins`)

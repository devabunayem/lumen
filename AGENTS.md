# Lumen Engineering Guidelines (`AGENTS.md`)

1. **Architecture Separation:** Keep Windows Win32/WinRT APIs, SQLite persistence, audio/lyrics bridges, prayer math, and timers strictly inside `src-tauri/crates/*` (`lumen-core`, `lumen-windows`, `lumen-media`, `lumen-prayer`, `lumen-notify`, `lumen-storage`, `lumen-plugins`). React components in `src/` must only render state and invoke typed IPC helpers in `src/lib/ipc.ts`.
2. **Design System Discipline:** Never hardcode hex colors, border radii, or spring timings inside widgets or shell components — use `src/design/tokens.css`, `src/design/tokens.ts`, `src/design/motion.ts`, and `src/design/shapes.ts`.
3. **Zero Telemetry & Privacy First:** Never add analytics, crash telemetry uploads, or unrequested network calls.
4. **Release & Feature Workflow:** After every feature addition:
   - Run `pnpm format`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`
   - Run `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --workspace`
   - Update [`FEATURES.md`](./FEATURES.md) and [`CHANGELOG.md`](./CHANGELOG.md)
   - Commit with a clear Conventional Commit message and push cleanly to `origin main`.

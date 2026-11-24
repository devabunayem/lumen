# Lumen Architecture Overview

## High-Level Split

- **Rust Core (`src-tauri/crates/*`)**: Owns all Windows integration (`windows-rs`), monitor geometry, hit-testing, media (SMTC), offline prayer calculation (`adhan`), notification privacy filtering, SQLite storage, and plugin manifest verification.
- **Tauri Shell (`src-tauri/src/`)**: Wires the Tauri v2 application, positions the top-centre transparent window, exposes typed IPC commands (`get_island_snapshot`, `dispatch_island_event`), and enforces strict capabilities & CSP.
- **React 19 UI (`src/`)**: Pure rendering layer driven by design tokens (`src/design/`), continuous squircle SVG paths (`src/design/shapes.ts`), Motion springs (`src/design/motion.ts`), and a deterministic finite state machine (`src/app/stateMachine.ts`).

## Workspace Crates

1. `lumen-core` — Deterministic Island finite state machine (`hidden`, `minimal`, `idle`, `live`, `peek`, `expanded`, `hud`), typed events, and versioned settings schema.
2. `lumen-windows` — Top-centre monitor geometry, DPI scaling helpers, and Windows styling/hit-testing layer.
3. `lumen-media` — SMTC session types, playback controls, and LRCLIB lyrics cache model.
4. `lumen-prayer` — Offline prayer time configuration (Bangladesh Karachi + Hanafi defaults) and city presets.
5. `lumen-notify` — Toast notification pipeline and privacy filter rules (keyword masking, per-app allow/deny).
6. `lumen-storage` — SQLite schema definitions (`tasks`, `water_log`, `shelf_items`, `lyrics_cache`, `pomodoro_sessions`).
7. `lumen-plugins` — Third-party widget manifest schema and sandbox permission checks.

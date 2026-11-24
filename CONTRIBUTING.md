# Contributing to Lumen

Thank you for helping build **Lumen** — a free and open-source Dynamic Island for Windows 10 and 11!

## Core Principles

1. **Everything Free, Local-First & Private:** No paywalls, no telemetry, and no analytics.
2. **Original Visuals Only:** All icons, notch paths, mascot animations, copy, and UI components must be original work. Never copy code or assets from proprietary notch apps.
3. **System Logic in Rust, UI in React 19:** All Windows APIs (`windows-rs`), persistence, timers, and calculations live inside modular Rust crates (`src-tauri/crates/*`). Frontend components render state and dispatch typed commands.
4. **Design Tokens & Springs Only:** Always reference CSS variables and motion presets in `src/design/` rather than hardcoding colours, radii, or spring constants.
5. **Respect Accessibility & Reduced Motion:** Every interactive surface must support keyboard navigation and Windows Reduce Motion.

## Local Development Setup

### Prerequisites

- **Windows 10 (1809+) or Windows 11**
- **Rust** (stable, with `rustfmt` and `clippy`)
- **Node.js** (20+) & **pnpm**
- **Visual Studio Build Tools** (Desktop development with C++) & **WebView2 Runtime**

### Running Locally

```bash
pnpm install
pnpm tauri dev
```

### Verification Commands

Before opening a pull request, make sure every check passes:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --workspace --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --workspace
```

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(media): add SMTC playback bridge`
- `fix(windows): preserve click-through on monitor change`
- `docs(design): document squircle path helper`
- `chore(ci): update Windows test matrix`

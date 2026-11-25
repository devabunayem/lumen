# Changelog

All notable changes to **Lumen** are documented here following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Pure-Black Apple Settings UI & Notification App Icons (Phase 1):** Upgraded the Settings window to a pure `#000000` OLED black base matching the Dynamic Island notch with vibrant Apple macOS-style gradient squircle sidebar icons, and added smart app-specific icons + masked privacy indicator badges to `NotificationToast`.

- **Apple-Style Settings Window Redesign:** Complete overhaul of the Settings window to match Apple macOS System Settings UI aesthetics. Features a sleek dark sidebar with colorful glyph icons (General, Display, Pages, Appearance, Music & Lyrics, Notifications, Widgets, To-do, Pomodoro, Hydration, Prayer, Shelf, HUD, Plugins, About), native window traffic light controls (close button), grouped card sections with iOS/macOS styled switches, segmented scale control (`Auto`, `100%`, `115%`, `130%`, `150%`), and live IPC synchronization.
- **Strict Notch-Bounds Click Pass-Through:** Dynamically toggles Win32 `WS_EX_TRANSPARENT` layered window style using high-frequency (30 Hz) geometry hit testing. All mouse clicks outside the active notch or expanded island pass completely unhindered to background windows (such as browser tabs, address bars, and desktop icons), while clicks strictly inside the notch boundary remain fully interactive.
- **Minimal Apple-Style Music Player Redesign:** Replaced raised nested containers and box cards with an uncluttered, deep-black Apple-style media interface featuring rounded-2xl album artwork, inline track title and session switcher, minimalist 2px duration scrub bar, centered transport buttons with micro-interactions, lyrics toggle bubble, and inline volume slider.
- **Carousel Slide Page Transitions:** Added directional carousel slide animation (`x: ±60px`, spring-damped opacity and scale) for mouse-wheel and arrow key navigation between active widgets with zero layout reflow.
- **Standardized Notch Geometry:** Refined resting notch dimensions to `184×30` (from `200×32`), minimal notch to `110×26`, slim resting line to `84×12`, and expanded island canvas to `560×172` for optimal visual balance against Windows top screen bezels.
- **Fixed-Canvas Overlay & Zero-Resize Window Architecture:** Eliminated OS-level Win32 window resizing and DWM coordinate shifts entirely during expand/collapse animations by keeping a transparent `660×220` hardware-accelerated canvas at all times. Pure CSS/GPU springs inside the canvas now handle 100% of the island morphing without any jitter, stutter, or cursor displacement.
- **Tuned Apple-Grade Spring Physics:** Refined the expand/collapse spring presets (`stiffness: 240, damping: 26, mass: 0.8`) with a fast 60ms hover response for instant, fluid expansion matching native dynamic island motion.
- **Hover Auto-Open & Ultra-Slim 5s Return:** Removed the legacy `peek` ("Click to open") state completely, switched window bounds updates to single-frame atomic Win32 `SetWindowPos`, and rendered the expanded view inside a fixed-dimension canvas (`620×190`) so morphing has zero reflow or cursor bounce. Hover expands (`60 ms`), leave collapses to the `96×14` slim notch (`350 ms`), and restores the resting pill after `5s`.
- **Pin Lock & Scroll Paging:** Added an expanded header pin button and throttled mouse-wheel page switching across widgets.
- **Unslop Craft & Animation Smoothness Pass:** Replaced all widget/chrome emojis with a unified `1.5`-stroke SVG line icon set (`src/design/icons.tsx`), removed CPU `drop-shadow` & full-size SVG path thrash in favor of hardware-composited surface springs with concave bezel ears, positioned `<AnimatePresence>` layers absolutely to eliminate crossfade vertical jumps, toned springs to critically-damped zero-overshoot motion, and aligned typography weights (`400–600`).

## [1.0.0] - 2026-11-25

### Added

- **Top-Centre Dynamic Island Shell (`Phase 0–1`):** Pure-black (`#000000`) continuous-curvature Notch & Floating Pill surfaces, deterministic 7-state machine, spring transitions (`Motion`), compact surface resizing (`260×52` <-> `660×220`), Windows Reduce Motion support, fullscreen auto-hide, System Tray icon & menu.
- **Music & Synced Lyrics (`Phase 2 & 4`):** Universal Windows SMTC media controls, multi-session switcher, album artwork & contrast-safe accent extraction, master system volume/mute, live animated waveform, LRCLIB synced lyrics with local SQLite cache.
- **SQLite Storage, To-Do, Water Tracker & Offline Prayer Times (`Phase 3`):** Quick-add task management with JSON export/import, circular hydration ring with 5-second undo and 7-day chart, offline `adhan` prayer calculations preloaded with Bangladesh cities (Dhaka, Khulna & more) in English and Bangla (`বাংলা`), Hijri date, and Sehri/Iftar countdown.
- **Pomodoro Timer, File Shelf & System HUDs (`Phase 4`):** Rust-owned 25/5/15 Pomodoro controller with live countdown pill and daily focus counter, zero-copy local File/Link Shelf (cap 50) opening items via Windows Shell, compact 64 px popups for Volume, Mute, Caps Lock, and Battery/AC status.
- **Privacy-First Notifications (`Phase 5`):** Filter pipeline with allow/deny lists, sensitive OTP/PIN/currency keyword masking, hide-preview mode, fullscreen/Focus Assist quiet hours, swipe-to-dismiss notification toast, and `ADR 0001`.
- **Settings App, Multi-Monitor DPI, Global Hotkeys, Mascot & Bangla i18n (`Phase 6`):** On-demand Settings window, Primary / Active Cursor / Indexed monitor selection, live horizontal offset & scaling, live-rebindable Win32 global hotkeys (`Ctrl+Alt+L`, `Ctrl+Alt+Space`), HKCU Run autostart & single-instance mutex, animated Lumi mascot, full English & Bangla localization, keyboard accessibility.
- **Plugin SDK & Packaging (`Phase 7`):** Strict `manifest.json` path-traversal validation, sandboxed `<iframe sandbox="allow-scripts">` plugin host, permission-checked `postMessage` storage bridge, crash-safe log rotation (`%APPDATA%/Lumen/logs/lumen.log`), Windows release workflow, WinGet & Scoop manifests.

# Changelog

All notable changes to **Lumen** are documented here following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Home Page ("Day Arc + Living Glow", `760×376`):** Added the default `home` page (`page 0`) with a header quick-toggles row (`Wi-Fi`, `Bluetooth`, `Focus`, `Mic`, `Keep awake`, `Lock`), an interactive SVG `DayArc` (de Casteljau amber progress arc, prayer & Ramadan markers, Friday `Jumu'ah`, night-mode moon arc, event lanes, hover scrub cursor, `Full day / Next 3 h` zoom, Open-Meteo cached weather & Windows Location opt-in, `Tasbih` counter chip), 3 glass bento cards (`MusicCard` with wheel volume HUD & middle-click mute, `NextCard` with digit-roll countdowns, `WaterCard` with `+250 ml` tap & long-press picker) with shared-element `layoutId` morphs, optional status chips (`Focus`, `Time ledger`, OTP-masked 30s auto-clear `Clipboard`, and `Dev pulse` local port probe), 3-layer `Living Glow`, synthesized Win32 UI sounds (`play_ui_sound`, lazy 5s-idle stream, automatic silence rules), Bangla numerals option, and the `/dev/states` 20-state preview route.
- **Fixed Canvas Size (`1220×612`):** Updated the zero-resize transparent overlay canvas to comfortably fit `150%` scaled Home (`1140×564`) plus margin with dynamic 30 Hz `SetWindowRgn` pass-through and Auto scale thresholds (`<=1440 -> 100%`, `1920+ -> 115%`, `2560+ -> 130%`).

### Fixed

- **Compact Home Size, Instant Open Speed & Zero Bottom Jitter:**
  - Compacted Home geometry from `760×376` (`r=40`) to `640×312` (`r=32`), shrunk the fixed transparent overlay canvas from `1220×612` to `1040×510` (fitting `150%` `960×468` + margin), and kept `Auto` scale at `100%` up to `1920px` displays (`2560+ -> 115%`, `3840+ -> 130%`).
  - Eliminated WebView2 expand lag by replacing per-card `backdrop-filter: blur(14px)` with lightweight translucent gradient glass, converting `HomePage` subcomponents to synchronous imports (removing `<Suspense>` skeleton waterfalls), removing SVG `pathLength` initial draw thrash, disabling continuous infinite glow/halo background keyframes, and simplifying expanded Home fade-in without conflicting inner scale transforms.
  - Eliminated bottom bento card & chip row jitter by switching `HomePage` to top-down fixed-height `justify-start` layout, removing `<LayoutGroup>` / `layoutId` cross-page projections and `<AnimatePresence mode="popLayout">` digit swaps, locking `MusicCard`/`NextCard`/`WaterCard` to `94px`, stabilizing tabular timer widths on `Focus`/`Client A` chips, truncating long clipboard text (`110px`), and windowing Home page dots (`<= 5` dots).

- **Responsive Fit Across All Notch Panels (`560×172`):** Adjusted `.type-display` (`28px`), `--capsule-height` (`28px`), and inner card/SVG heights across `MusicWidget`, `TodoWidget`, `WaterWidget`, `PomodoroWidget`, `PrayerWidget`, `ShelfWidget`, and `CalendarWidget` so all 7 panels fit cleanly inside the fixed `560×172` notch without vertical clipping.

- **Responsive Notch Inner Spacing, Icon-First Control Panel & Borderless Settings:**
  - Removed ugly native scrollbars globally (`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`) while preserving smooth wheel scrolling.
  - Removed the duplicate Windows titlebar (`decorations(false)`) on the Settings window so only the custom Apple Traffic Light controls (`Close` / `Minimize` + `data-tauri-drag-region`) appear.
  - Refactored `ControlPanelWidget` into a compact, non-clipping icon-first 3×2 grid with live pointer-hover action labels inside the exact `560×172` notch dimensions.

### Added

- **Camera & Mic Privacy Indicators + Calendar Agenda (Phase 4):** Added real-time Windows `CapabilityAccessManager\ConsentStore` webcam/microphone active detection (`lumen-windows::privacy_device_status`) displaying Apple-style green/orange indicator dots in the notch, plus a local SQLite-backed `Today Agenda` (`CalendarWidget`) with live event countdowns.

- **Screenshot Capture, Offline Screen OCR & File Shelf Sync (Phase 3):** Added native Win32 GDI + WinRT `BitmapEncoder` PNG screenshot capture that auto-drops captures into the File Shelf, plus offline WinRT `Windows.Media.Ocr` screen text extraction to clipboard with one-click "Save OCR as To-Do" integration inside the Control Center.

- **Control Panel Home Hub & Core System Actions (Phase 2):** Added a default `Control Center` first page featuring one-tap Windows Core Audio microphone mute/unmute (`eCapture`), Quiet/DND notification toggle, `LockWorkStation` PC lock, and connected live glance cards for To-Do count, Water intake, Pomodoro countdown, and active Music playback.

- **Pure-Black Apple Settings UI & Notification App Icons (Phase 1):** Upgraded the Settings window to a pure `#000000` OLED black base matching the Dynamic Island notch with vibrant Apple macOS-style gradient squircle sidebar icons, and added smart app-specific icons + masked privacy indicator badges to `NotificationToast`.
- **Async Settings Window Launch & TypeScript 6.0.3:** Converted `open_settings_window` to an `async` Tauri command and spawned tray launches asynchronously to prevent Windows WebView2 UI-thread deadlocks on window creation; upgraded TypeScript to `6.0.3` (latest compatible with `typescript-eslint`).
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

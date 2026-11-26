# Changelog

All notable changes to **Lumen** are documented here following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **Content-Fitted Notification Sizing & Inner Bottom-Edge Aurora Glow:**
  - Replaced the oversized `440×84` minimum toast footprint with dynamic `measureNotificationDimensions()` (`248×58` up to `428×138`) and tightened `NotificationToast` padding (`px-3.5 py-2.5`) so notification bubbles hug their actual title and body copy with only subtle rim breathing room.
  - Constrained `ActionGlowLayer` to a crisp, vibrant `38px` bottom strip inside the notch silhouette (`inset-x-0 bottom-0 h-[38px] max-h-full overflow-hidden`, boosted `--aurora-*` token luminescence) so the movable aurora glow always stays cleanly inside the notch bottom edge across every state without spilling outside or stretching into tall empty slabs.

- **Interactive Play/Pause Movable Notch Glow & Reliable SMTC Thumbnail/Color Sync:**
  - Updated `IslandShell` and `ActionGlowLayer` so the bottom flowing aurora glow remains active and smoothly drifting in sync with the playing media's extracted artwork `accent_hex` (`color-mix` harmonized stops) throughout active playback, and immediately pauses/stops when music is paused.
  - Reworked `lumen-media`'s Windows SMTC thumbnail extractor (`read_stream_bytes` chunked reads -> `InMemoryRandomAccessStream` -> `BitmapDecoder::GetPixelDataTransformedAsync` into `64×64` `Rgba8` + MIME header detection) and eliminated redundant `TryGetMediaPropertiesAsync()` IPC calls per poll, preventing WebP/stream-seek decode drops so album art thumbnails and accent colors sync reliably across Chrome, Edge, and desktop players.

### Changed

- **Unified Home Music Card & Removed Standalone Music Page:**
  - Brought interactive Seek progress scrubbing (`onSeek`), top-right source badge + multi-session player switcher (`onSelectSession`), visible Mute button + inline capsule Volume slider, and empty-state **Resume / Open Spotify** actions directly into Home's `MusicCard`.
  - Removed the redundant standalone `music` island page (`MusicWidget` + `BUILTIN_WIDGET_IDS` / `BUILTIN_PAGE_ORDER` / `SettingsWindow` / `ControlPanelWidget` routing) so all media controls live cleanly inside Home.

### Added

- **Auto-Tracked Windows Location Across Weather, Prayer Times, Iftar/Sehri, Day Arc & Qibla:**
  - Enabled fast Windows Geolocation tracking (`locationOptIn` defaulting to `true` with `GetGeopositionWithAgeAndTimeoutAsync` 5s timeout & 10-min cache) on startup, settings toggle, weather refresh, and periodic 30-minute background checks.
  - Wired resolved coordinates (`latitude`, `longitude`), host local timezone offset, and offline `resolve_city_name_for_coords` directly into `AppState.prayer_config`, recomputing all 5 daily prayers, Ramadan Sehri/Iftar countdowns, Qibla compass bearing (`PrayerSchedule.latitude/longitude`), Day Arc curve, and coordinate-scoped Open-Meteo weather cache simultaneously.

- **Real-Time WASAPI Peak Audio Sync (`AudioPeakReader` at `~30 fps`):**
  - Added Windows Core Audio `IAudioMeterInformation::GetPeakValue()` metering in `lumen-media` (`AudioPeakReader` + perceptual `shape_audio_peak` attack/decay shaper) streaming `lumen://audio-peak` events at `~30 fps` strictly while media playback is active (`0%` CPU/IPC when paused or in fullscreen).
  - Wired `audioPeak` into `ActionGlowLayer` (opacity + GPU bottom scale pulse) and `LiveWaveform` so the notch bottom aurora glow and right-side waveform react smoothly and accurately to real-time playback audio energy.

- **Home Bento Polish — Standard `NextCard` Hours/Minutes & Animated `WaterCard` Liquid Vessel:**
  - Updated `NextCard` (`formatNextCountdown`) to render durations `< 60 min` in minutes (e.g. `45 min`) and `>= 60 min` cleanly in standard hours/minutes (e.g. `575` -> `9h 35m`, localized for English & Bangla).
  - Added an animated GPU-composited dual-wave liquid fill vessel with subtle rising bubbles beside the readout inside `WaterCard` (`lumen-water-wave-a`/`b`, `reduce-motion` safe).

- **Redesigned Music Player & Prayer Solar Dashboard (`580×208`):**
  - Rebuilt `MusicWidget` with a `96×96` squircle artwork + album-tinted ambient glow, output device/session switcher pill, automatic 2-line synced lyrics preview, interactive 46-bar audio waveform scrubber, pure-white circular play/pause transport button, shuffle toggle, and always-accessible capsule volume bar.
  - Rebuilt `PrayerWidget` with emerald/amber ambient washes, interactive SQLite-synced **Tasbih** pill (`+1` / right-click reset), offline great-circle **Qibla** compass bearing toggle, parabolic de Casteljau solar arc curve with dashed drop guides, and a 5-prayer status strip with green checkmark circles.

- **Expressive Lumi Action Mascot & Movable Flowing Aurora Glow:**
  - Added `ActionGlowLayer` with GPU-composited async counter-drifting bottom aurora gradient lobes (`--aurora-wave-*`, `--aurora-celebrate-*`, `--aurora-confirm-*`, `--aurora-focus-*`, or active track `accent_hex`) with CSS vertical fade masking and zero sharp seams.
  - Upgraded `LumenMascot` with `size="hero"` expressive glowing mood eyes (`wave`, `celebrate`, `confirm`, `music`, `sleep`, blinking `idle`) and an animated wrist-waving vector hand, automatically triggered on app greetings, hydration logs, task completions, reminders, clipboard/focus toggles, charger plug-in, and Pomodoro milestones before returning smoothly to the centered-clock notch.
  - Added `Lumi Action Mascot` and `Movable Action Glow` (`On Action` / `Always` / `Off`, persisted via `actionGlowMode` in `LumenSettings`) inside the Appearance tab.

- **Centered-Clock Resting Notch, Brief Now-Playing Track Banner & Streamlined 7-Tab Settings:**
  - Updated the default resting notch (`idle` and `live`) to show a centered clock, left live status dots (Camera green, Mic orange, circular Charging `%` ring, Focus), and a right music waveform (animated only while playing).
  - Added `NowPlayingBanner` (`320×60`) to briefly highlight newly started/switched YouTube or desktop media playback before smoothly returning to the centered clock notch.
  - Added standard-capped notification previews (`440×84..148`) with a **More / Show less** reader (`460×260`) for extra-long messages, plus Settings controls (`restingShowClock`, `restingShowWaveform`, `restingShowSensorDots`, `restingShowBatteryRing`, `nowPlayingBannerEnabled`, `nowPlayingBannerSeconds`, `notificationDurationSeconds`).
  - Consolidated `SettingsWindow` from 15 tabs (including empty placeholders) into 7 clean tabs (`General`, `Appearance`, `Pages`, `Notifications`, `Widgets`, `Plugins`, `About`).

- **Manual Timed Reminders, Medium Alarm Notch & Snooze:** Added SQLite + `localStorage` persisted `reminders` storage (with automatic 7-day post-expiry deletion and non-Tauri preview scheduler), `RemindersWidget` with native `<input type="date">` / `<input type="time">` pickers and auto-collapse editing lock, `ReminderSnoozeMinutes` (`2/3/5/10 min`) and `Default Lead Reminder` preferences in Settings, synthesized `reminder_alarm` tone, and the medium `380×108` `ReminderAlertOverlay` with **OK, Got it** (canceling the early alarm while keeping the exact-time notification armed) and **Snooze** actions.
- **All Windows App & Browser Notification Sync with Real App Logos:** Added `SystemNotificationWatcher` in `lumen-notify` capturing live desktop & browser toast notifications (`Chrome`, `Edge`, `Firefox`, `Brave`, `WhatsApp`, `Discord`, etc.) with Win32 `shell:AppsFolder` 48×48 PNG icon extraction and `<toast>` local image loading inside `NotificationToast`.
- **Real-Time Audio/Video Player Sync & Continuous Timeline:** Upgraded `lumen-media` (`LastUpdatedTime` real-time timeline math, cached thumbnails, active playing session auto-priority across browsers & video players) and `MusicCard` / collapsed `live` pill progress strip (`2 Hz` backend + smooth UI tick).

- **Home Page ("Day Arc + Living Glow", `760×376`):** Added the default `home` page (`page 0`) with a header quick-toggles row (`Wi-Fi`, `Bluetooth`, `Focus`, `Mic`, `Keep awake`, `Lock`), an interactive SVG `DayArc` (de Casteljau amber progress arc, prayer & Ramadan markers, Friday `Jumu'ah`, night-mode moon arc, event lanes, hover scrub cursor, `Full day / Next 3 h` zoom, Open-Meteo cached weather & Windows Location opt-in, `Tasbih` counter chip), 3 glass bento cards (`MusicCard` with wheel volume HUD & middle-click mute, `NextCard` with digit-roll countdowns, `WaterCard` with `+250 ml` tap & long-press picker) with shared-element `layoutId` morphs, optional status chips (`Focus`, `Time ledger`, OTP-masked 30s auto-clear `Clipboard`, and `Dev pulse` local port probe), 3-layer `Living Glow`, synthesized Win32 UI sounds (`play_ui_sound`, lazy 5s-idle stream, automatic silence rules), Bangla numerals option, and the `/dev/states` 20-state preview route.
- **Fixed Canvas Size (`1220×612`):** Updated the zero-resize transparent overlay canvas to comfortably fit `150%` scaled Home (`1140×564`) plus margin with dynamic 30 Hz `SetWindowRgn` pass-through and Auto scale thresholds (`<=1440 -> 100%`, `1920+ -> 115%`, `2560+ -> 130%`).

### Fixed

- **Video/Music Accent Color Sync, Real Mic Detection & Steady Home Ambient Glow:**
  - Fixed `lumen-media` thumbnail color extraction converting `BitmapPixelFormat::Bgra8` pixels properly to RGBA before quantized hue clustering, and prevented permanently caching `None` before Chrome/players finish loading YouTube thumbnails — so Home ambient glow, `MusicCard` progress bar, and the resting notch waveform accurately match the playing video/track colors.
  - Upgraded `lumen-windows::privacy_device_status()` to detect live microphone capture via real-time WASAPI `AudioSessionStateActive` capture sessions (avoiding stale `ConsentStore` `LastUsedTimeStop = 0` entries) and fixed registry enumeration access (`KEY_READ`) for desktop camera apps, plus removed the idle fallback blue dot from the resting notch.
  - Removed cursor-tracking Home background glow translation and expanded `GlowLayer` bleed (`-inset-10`) so moving the pointer across Home never shifts glow edges along the sides.

- **Larger Full-Preview Notifications, Extended Display Duration & Clean Notch Corners:**
  - Enlarged `NotificationToast` sizing from the compact `240×56` HUD box to a dedicated `440×84` container (growing dynamically up to `200px` height) with full multi-line wrapping instead of single-line truncation when previews are enabled.
  - Extended notification auto-dismiss duration from `4.5s` to `8.5s` (`11s` for longer messages) and paused dismissal while hovering over the toast.
  - Removed GDI `SetWindowRgn` polygon corner clipping from the transparent overlay hit-test loop (`60 Hz` `WS_EX_TRANSPARENT`), eliminating the light-blue/white corner triangles around the concave Notch ears while keeping background click pass-through intact.

- **Win32 Access Violation (`0xc0000005`) Crash Fixes:**
  - Updated `lumen-media::sounds` (`LazyWaveOut::play_blocking`) to synchronize `WAVEHDR.dwFlags` (`WHDR_DONE`) via unaligned reads + memory fence before calling `waveOutUnprepareHeader` and dropping the PCM buffer, preventing audio driver DMA read-after-free crashes.
  - Updated `lumen-notify` to skip WinRT `UserNotificationListener` COM probing when `wpndatabase.db` is present and isolated Shell `SHCreateItemFromParsingName` / `IShellItemImageFactory::GetImage` icon extraction onto a dedicated STA COM thread with bitmap dimension bounds checking.

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

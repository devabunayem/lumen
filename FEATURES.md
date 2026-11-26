# Lumen — Feature Tracker

A concise, living overview of shipped capabilities and upcoming additions for **Lumen** (`Windows 10 & 11`).

## Implemented (`v1.0+`)

### Island Shell & Window Engine

- **Day Arc + Living Glow Home Page (`640×312`, `page 0`):** Compact glanceable home overview featuring a responsive parabolic solar/moon Day Arc (`Fajr–Isha` day arc & `Isha–Fajr` moon night arc, Friday `Jumu'ah`, Ramadan Sehri/Iftar markers, de Casteljau amber progress glow, overlapping event lane bars, interactive Tasbih counter chip, hover time scrubber, `Full day / Next 3 hours` zoom toggle, and keyboard marker navigation), three radial transform-only Living Ambient Glow layers (time-of-day dawn/day/dusk/night, contrast-guarded album art accent, Focus session desaturation, low-battery `< 10%` edge alert, plus Reduce Transparency solid fallback), 6 native quick toggles (`Wi-Fi`, `Bluetooth`, `Focus`, `Mic`, `Keep awake`, `Lock`), 3 hardware-light glass bento cards (`Music` unified Home player with interactive Seek bar, source session switcher pill, inline Mute/Volume slider + wheel HUD, and `Resume / Open Spotify` fallback; `Next` standard `h/m` and `<60 min` color-coded countdown; `Water` `+250 ml` tap, animated liquid-wave vessel & long-press `150/250/500 ml` picker), and optional zero-jitter status chips (`Focus timer`, `Time ledger`, auto-masked & 30s auto-cleared `Clipboard OTP`, and home-visible `Dev pulse`)
- **Synthesized Soft UI Sound Engine (`lumen-media::sounds`):** Lazy Win32 `waveOut` waveform synthesizer (`5 s` idle auto-close) covering interface clicks, water droplets, chime reminders, and rate-limited `15 min` arc scrub ticks; automatically silenced during active calls/mic, fullscreen apps, Focus sessions, Windows mute, and quiet hours
- **20-State Visual QA Gallery (`/dev/states`):** Dedicated preview matrix covering all interaction, locale (English + Bangla numerals), scale (`100%`–`150%`), accessibility, Focus, night, Friday, and Ramadan states
- Pure-black (`#000000`) continuous **Notch** (`r=32` Home / `r=24` secondary) and **Floating Pill** bezel surfaces with critically-damped Motion springs (`snappy`, `smooth`, `bouncy`, `gentle`) and uniform `1.5`-stroke SVG line icons (`src/design/icons.tsx`, `src/design/motion.ts`)
- **Zero-Resize Fixed Transparent Canvas (`1040×510`):** Accommodates `150%` Home (`960×468`) + margin without OS window resizes, backed by dynamic 60 Hz Win32 `WS_EX_TRANSPARENT` hit-test click pass-through and pure DirectComposition alpha compositing (no GDI `SetWindowRgn` polygon corner clipping artifacts) plus Auto scale (`<= 1920 -> 100%`, `2560+ -> 115%`, `3840+ -> 130%`)
- **Camera & Mic Privacy Dots, Timed Reminders & Calendar Agenda:** Live Windows `ConsentStore` green/orange sensor dots in the notch, dual-persisted (`SQLite` + `localStorage`) manual `RemindersWidget` with native `<input type="date">` & `<input type="time">` pickers, automatic 7-day post-expiry cleanup, editing focus lock preventing accidental auto-collapse, custom advance lead warning (`0–30 min`), medium synthesized repeating alarm alert overlay (`380×108`), **OK, Got it** early dismiss that preserves the mandatory exact-time notification, plus configurable `2/3/5/10 min` Settings-backed **Snooze** and offline `Today Agenda` events with live countdowns
- **Universal Windows & Browser Notification Sync with Real App Logos:** Real-time Windows notification pipeline (`lumen-notify` via `UserNotificationListener` + safe read-only `wpndatabase.db` snapshot) capturing live desktop and web-browser (`Chrome`, `Edge`, `Firefox`, `Brave`, WhatsApp, Discord, etc.) toasts along with Win32 `shell:AppsFolder` 48×48 PNG icon extraction, tight content-fitted dynamic sizing (`248×58` up to `428×138`) with inline **More / Show less** full-message reader (`460×260`), under-notch flowing aurora halo (`ActionGlowLayer` projected cleanly beneath `#000000` notch boundaries in any state), and configurable auto-dismiss duration (`5–15s`)
- **Centered-Clock Resting Notch, Action Lumi & Interactive Music Aurora Glow:** Default `184×30` resting notch displays a centered clock flanked by real-time left indicators (Camera green dot via `KEY_READ`, live WASAPI Microphone orange dot, circular Charging `%` ring, Focus dot — hidden cleanly when idle) and a right album/video-color-synced music waveform (animating only while playing), brief `320×60` **Now Playing** track banner, plus action-triggered `LumenMascot` (`wave` / `celebrate` / `confirm` / `sleep` eyes & waving hand) over a GPU-composited flowing aurora rim glow (`ActionGlowLayer`, configurable as `On Action`, `Always`, or `Off` in Appearance Settings) that stays continuously animated and synced to active artwork color while music plays and pauses immediately when paused
- **Real-Time Browser & Desktop Audio/Video Player Sync:** Windows SMTC background interpolation (`LastUpdatedTime` anchor math at `2 Hz` + `250 ms` UI interpolation) automatically switching to active playing audio/video sources across browsers and desktop players (`Chrome`, `Edge`, `VLC`, `Spotify`, `mpv`), keeping playback controls and timelines synchronized continuously even while collapsed
- **Screenshot & Offline Screen OCR:** Capture PNG screenshots directly into the File Shelf, and extract on-screen text offline via `Windows.Media.Ocr` to clipboard with 1-click To-Do creation
- **Control Panel Home Hub:** Default first screen with one-tap Global Mic Mute (`Core Audio`), Quiet/DND mode, Lock PC (`LockWorkStation`), and connected live summary cards that jump directly to To-Do, Water, Pomodoro, and Music pages
- **Apple-Style System Settings:** Pure `#000000` OLED black macOS-inspired dark settings window matching the Notch, featuring traffic light controls, vibrant Apple gradient squircle sidebar icons, grouped preference cards, segmented notch scaling (`Auto`, `100%`, `115%`, `130%`, `150%`), toggle switches, and full live IPC synchronization
- **Apple-Style Music Player (`580×208`):** Rounded `96px` squircle artwork with multi-stop album glow, output device/session pill, 2-line live synced lyrics preview, 46-bar interactive waveform scrubber, pure-white circular play/pause button, shuffle toggle, and inline capsule volume slider
- **Prayer Times Solar Dashboard (`580×208`):** Dual emerald/amber ambient wash, crisp next-prayer countdown & progress track, SQLite-synced **Tasbih** counter pill, offline spherical-trigonometry **Qibla** bearing toggle, and parabolic de Casteljau solar arc with green checkmark completion dots for all 5 daily prayers
- **Carousel Slide Page Transitions:** Directional horizontal slide animations when switching pages via mouse wheel or arrows
- **Standardized Proportions:** Streamlined resting notch (`184×30`), minimal notch (`110×26`), slim line (`84×12`), and expanded island (`560×172`) for a balanced, premium look
- **Hover Auto-Open & Ultra-Slim Notch Return:** Hovering expands directly without any legacy "Click to open" state (`60 ms` intent delay with zero-resize fixed transparent canvas architecture and reflow-free spring morphing), leaving shrinks into an ultra-slim `84×12` notch indicator (`350 ms`), and restores the resting clock pill after `5s` (configurable in Settings)
- **Strict Notch-Bounds Click Pass-Through:** Dynamic 30 Hz hit-testing that sets Win32 `WS_EX_TRANSPARENT` whenever the cursor is outside the physical notch/island boundaries, allowing clicks to pass through completely to background windows, browser tabs, and desktop icons with zero obstruction
- **Zero-Resize Window Architecture:** Windows OS-level window resizing is completely eliminated during hover transitions by maintaining a transparent GPU canvas, enabling 100% silk-smooth 60fps/120fps CSS transform morphing without DWM coordinate lag or cursor displacement
- **Pin Lock (`📌`), Typing Protection & Wheel Paging:** Lock the expanded island open while pinning or typing inside widgets, and scroll the mouse wheel to switch pages
- Compact transparent Win32 window sizing (`260×52` ↔ `660×220`) that never blocks adjacent browser tabs
- Auto-hide in true fullscreen apps/games (`FR-WIN-4`), single-instance lock, Windows Startup (`HKCU\...\Run`), System Tray controls, and global hotkeys (`Ctrl+Alt+L`, `Ctrl+Alt+Space`)

### Music & Synced Lyrics

- Universal Windows SMTC media controls (play/pause, next/prev, seek, multi-session switcher)
- Album artwork preview with contrast-guarded dominant accent color extraction (`lumen-media`)
- Live animated waveform & master system volume/mute slider
- Synced `.lrc` lyrics via LRCLIB cached offline in SQLite

### Productivity & Faith Widgets

- **To-Do List:** Quick inline tasks with due timestamps, SQLite persistence, and JSON export/import
- **Water Tracker:** Daily hydration ring (default `1500 ml`), quick log + 5-second undo, 7-day history
- **Offline Prayer Times (`adhan`):** Bangladesh defaults (`Karachi` / `Hanafi`), Dhaka/Khulna & 8 BD cities, English & Bangla (`বাংলা`) UI, Hijri date, Sehri/Iftar countdown, sun-arc progress
- **Pomodoro Focus Timer:** Rust-owned Focus / Short Break / Long Break cycles with collapsed live badge & daily focus minutes
- **File & Link Shelf:** Zero-copy local file/folder/URL shelf opening natively via Windows Shell (`cap 50`)

### Privacy, Notifications, Settings & SDK

- Privacy-first Notification Toast with swipe-to-dismiss, OTP/PIN/currency keyword masking, allow/deny lists, and Focus Assist quiet respect
- Compact `64 px` System HUDs for Volume, Mute, Caps Lock, and Battery/AC
- Separate on-demand **Settings Window** (General, Multi-Monitor DPI Display, Pages Reorder/Hide, Appearance, Widgets, Plugins, About) + English & Bangla (`বাংলা`) localization + animated **Lumi** mascot
- Sandboxed third-party **Plugin SDK** (`%APPDATA%\Lumen\plugins`, `<iframe sandbox="allow-scripts">`), crash-safe rotating logs (`%APPDATA%\Lumen\logs\lumen.log`), and automated GitHub Release `.exe`/`.msi`/`.zip` builds

---

## Upcoming / Planned

- [ ] **System Telemetry Pill (Opt-In):** Lightweight CPU / RAM / Network sparklines (`<= 1 Hz`)
- [ ] **Ask (BYO-Key AI):** Optional assistant using Windows Credential Manager (strictly zero calls until configured)
- [ ] **Hardware-Signed Installers & ARM64 Builds:** Authenticode-signed NSIS/MSI packages eliminating Windows SmartScreen prompts

# Lumen — Feature Tracker

A concise, living overview of shipped capabilities and upcoming additions for **Lumen** (`Windows 10 & 11`).

## Implemented (`v1.0+`)

### Island Shell & Window Engine

- Pure-black (`#000000`) continuous-curvature SVG **Notch** and **Floating Pill** shapes with Motion spring morphing (`src/design/shapes.ts`)
- **Hover Auto-Open & Ultra-Slim Notch Return:** Hover opens the expanded island (`150 ms`), leaving shrinks into an ultra-slim `96×14` notch indicator (`350 ms`), and restores the resting clock pill after `5s` (configurable in Settings)
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

- [ ] **Weather Widget:** Local offline cache + Open-Meteo current conditions, hourly outlook & rain badge
- [ ] **Calendar & Agenda Preview:** Upcoming meetings countdown in pill + expanded agenda card
- [ ] **Clipboard History Shelf:** Privacy-filtered recent text/link clips with masked password detection
- [ ] **System Telemetry Pill (Opt-In):** Lightweight CPU / RAM / Network sparklines (`<= 1 Hz`)
- [ ] **Ask (BYO-Key AI):** Optional assistant using Windows Credential Manager (strictly zero calls until configured)
- [ ] **Hardware-Signed Installers & ARM64 Builds:** Authenticode-signed NSIS/MSI packages eliminating Windows SmartScreen prompts

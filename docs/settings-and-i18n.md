# Settings Architecture, Multi-Monitor & Localization

## Versioned Settings Schema (`%APPDATA%/Lumen/settings.json`)

- `lumen_core::LumenSettings` persists all user configuration in JSON with `version: 1` (`NFR-REL-2`).
- `LumenSettings::load_or_migrate` automatically repairs out-of-range numeric settings, missing keys, invalid shape/scale strings, or `version: 0` payloads without failing startup.
- Changes committed via `settings_update` immediately resize and reposition the `island` window and broadcast `lumen://settings-updated` over Tauri IPC.

## Multi-Monitor DPI, Global Hotkeys & Single-Instance (`FR-WIN-5..8`)

- **Multi-Monitor Positioning:** `pick_target_monitor` supports `primary`, `active` (following live `GetCursorPos` monitor bounds), and explicit monitor `index`, computing physical `(x, y)` center from the target monitor's DPI `scale_factor()` plus `positionOffsetX`.
- **On-Demand Settings Window:** Opened dynamically via `open_settings_window` (tray menu `"Settings..."` or the expanded header gear button) and completely unloaded from WebView2 memory when closed.
- **Global Hotkeys (`FR-WIN-6`):** `lumen_windows::GlobalHotkeyManager` runs a dedicated Win32 `WM_HOTKEY` thread supporting live rebinding (`Ctrl+Alt+L` to toggle hide, `Ctrl+Alt+Space` to toggle expand) and returns immediate conflict diagnostics if another application holds a chord.
- **Autostart & Single Instance (`FR-WIN-7`):** Named mutex `Local\EtarnityLumenSingleInstanceMutex` prevents duplicate running instances, while `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` registers optional startup launch.

## English / Bangla Localization & Accessibility (`FR-I18N-1`, `FR-A11Y-1`)

- All shell chrome and settings views resolve strings from `src/i18n/en.json` and `src/i18n/bn.json`.
- Full keyboard navigation (`Enter` / `Space` to open, `ArrowLeft` / `ArrowRight` to switch pages, `Escape` to collapse), high-contrast `:focus-visible` outlines, and `reducedMotionOverride` work independently of mouse input.

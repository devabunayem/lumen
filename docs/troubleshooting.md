# Lumen Troubleshooting Guide

## 1. Windows SmartScreen Warning ("Windows protected your PC")

Current open-source `v1.0+` executables are unsigned. Verify the file checksum against `SHA256SUMS.txt` on the [Releases page](https://github.com/devabunayem/lumen/releases/latest), then click **More info → Run anyway**.

## 2. Live Development (`pnpm tauri dev`) Starts But Window Is Invisible

Run `pnpm tauri dev` from a normal **Windows Start Menu → PowerShell / Windows Terminal** window (not inside sandboxed IDE terminals), and quit any previously running `lumen.exe` from the System Tray (`Quit Lumen`) first because Lumen enforces single-instance mode.

## 3. Media Widget Shows "Nothing Playing"

- Lumen reads **Windows System Media Transport Controls (SMTC)**. Play audio in Spotify, Chrome/Edge, VLC, or Windows Media Player and ensure hardware/media key integration isn't disabled in browser flags (`chrome://flags/#hardware-media-key-handling`).
- Check **Settings → Widgets → Exclude Media Apps** to verify the app wasn't filtered out.

## 4. Global Hotkey Conflict Warning

If `Ctrl+Alt+L` or `Ctrl+Alt+Space` is already registered by another app (such as PowerToys or clipboard tools), open **Tray → Settings... → General** and assign a custom chord like `Shift+Win+F9`.

## 5. Logs & Resetting Preferences

- **Crash & startup logs:** `%APPDATA%\Lumen\logs\lumen.log`
- **Settings file:** `%APPDATA%\Lumen\settings.json` (delete or edit while closed to reset to defaults)
- **Database (To-Do, Water, Shelf, Lyrics cache):** `%APPDATA%\Lumen\lumen.db`

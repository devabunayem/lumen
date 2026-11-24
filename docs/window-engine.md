# Lumen Window Engine (`lumen-windows`)

Phase 1 implements Windows 10/11 overlay ergonomics without blocking background applications (`FR-WIN-1` to `FR-WIN-4`, `FR-WIN-7`):

1. **Native DWM Transparency & Focus Safety (`FR-WIN-1`, `FR-WIN-3`):**
   - Uses Tauri v2's native WebView2 transparency (`transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `focus: false`) so WebView2 DirectComposition renders crisp per-pixel alpha without `WS_EX_LAYERED` conflicts.
2. **Dynamic Compact Window Sizing (`FR-WIN-2`, Section 7.5):**
   - Keeps the OS window shrunk tightly to `260×52` logical px when collapsed (so browser tabs on the left and right remain completely uncovered) and resizes to `660×220` logical px only while expanded.
3. **Fullscreen Auto-Hide (`FR-WIN-4`):**
   - Evaluates `GetForegroundWindow`, `IsWindowVisible`, `IsZoomed`, and `GetWindowRect` against `MonitorFromWindow` (`rcMonitor`), ignoring desktop shell windows (`Progman`, `WorkerW`, `Shell_TrayWnd`) and maximized windows, emitting `lumen://fullscreen-changed`.
4. **System Tray Icon (`FR-WIN-7`):**
   - Provides a tray icon and menu (`Open / Collapse Lumen`, `Show / Hide Island`, `Quit Lumen`) for instant visibility and control.

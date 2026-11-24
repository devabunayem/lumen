# Lumen Window Engine (`lumen-windows`)

Phase 1 implements Windows 10/11 overlay ergonomics without blocking background applications (`FR-WIN-1` to `FR-WIN-4`):

1. **Tool Window & Focus Safety (`FR-WIN-1`, `FR-WIN-3`):**
   - Applies `WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE` via `SetWindowLongPtrW` so Lumen never appears in the taskbar or `Alt+Tab` and clicking the pill never steals keyboard focus from the active editor, game, or browser.
   - `request_keyboard_focus` removes `WS_EX_NOACTIVATE` only when an explicit text input inside the island requests focus, restoring it afterward.
2. **Dynamic Click-Through Hit-Testing (`FR-WIN-2`):**
   - The transparent `700×250` canvas stays click-through (`set_ignore_cursor_events(true)`) everywhere outside the active animated pill rectangle (`200×32` collapsed, `236×36` peek, `620×190` expanded).
   - Runs at **10 Hz (`100 ms`)** when the cursor is away from the top monitor band (`NFR-PERF-3`), stepping up to **30 Hz (`33 ms`)** only while hovering near the top edge.
3. **Fullscreen Auto-Hide (`FR-WIN-4`):**
   - Evaluates `GetForegroundWindow`, `GetWindowRect` against `MonitorFromWindow` (`rcMonitor`), and `SHQueryUserNotificationState` while ignoring desktop shell classes (`Progman`, `WorkerW`, `Shell_TrayWnd`), emitting `lumen://fullscreen-changed` to smoothly shrink the island into the top edge.

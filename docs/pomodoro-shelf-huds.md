# Pomodoro, File Shelf, System HUDs & Synced Lyrics

Phase 4 completes the core productivity and media utilities (`FR-PO-1..3`, `FR-SH-1..3`, `FR-HUD-1..2`, `FR-MUS-4`):

- **Pomodoro (`lumen-core` + `lumen-storage`):** Deterministic focus/short-break/long-break timer running in Rust, emitting 1 Hz `lumen://pomodoro-tick` events only when active and logging completed focus minutes to `pomodoro_sessions`.
- **File Shelf (`lumen-storage` + `lumen-windows`):** References files, folders, URLs, and notes without copying (`cap: 50`), highlights missing files, and opens targets via `ShellExecuteW`.
- **System HUDs (`lumen-windows`):** Detects volume/mute, Caps Lock, and AC/battery changes at 2 Hz (`lumen://hud-event`), rendering a `360×64` transient pill that restores the prior island state.
- **Synced Lyrics (`lumen-media` + `lumen-storage`):** Fetches LRC lyrics from LRCLIB via native Windows `HttpClient`, caches them in `lyrics_cache`, and shows live line-by-line highlights.

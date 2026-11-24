# Lumen Storage & Core Widgets (`lumen-storage`, `lumen-prayer`)

Phase 3 delivers local-first SQLite persistence and offline Bangladesh-default prayer times (`FR-TD-1..5`, `FR-WT-1..4`, `FR-PR-1..6`):

- **`lumen-storage` (`%APPDATA%/Lumen/lumen.db`):**
  - Thread-safe `StorageRepo` with automatic table migrations (`tasks`, `water_log`, `shelf_items`, `lyrics_cache`, `pomodoro_sessions`).
  - Full To-do CRUD + JSON export/import and Water Tracker logging with 5-second undo, configurable daily reset hour, and 7-day weekly history.
- **`lumen-prayer` (`adhan` v0.2):**
  - Pure offline astronomical calculations defaulting to **Bangladesh (Karachi method, Hanafi Asr)** with 8 preloaded cities (`Dhaka`, `Khulna`, `Chattogram`, `Rajshahi`, `Sylhet`, `Barishal`, `Rangpur`, `Mymensingh`).
  - Supports English and Bangla prayer names, Hijri date approximation, Sehri/Iftar countdown helper, and sun-arc ratio calculation for the UI arc timeline.

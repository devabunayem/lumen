/// Core SQLite schema matching SRS Section 7.4.
pub const INITIAL_SCHEMA_SQL: &str = r"
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    due_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS water_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ml INTEGER NOT NULL,
    logged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shelf_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    path_or_text TEXT NOT NULL,
    added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lyrics_cache (
    track_key TEXT PRIMARY KEY,
    lrc TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    started_at TEXT NOT NULL,
    duration_s INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
);
";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_contains_all_required_tables() {
        for table in [
            "tasks",
            "water_log",
            "shelf_items",
            "lyrics_cache",
            "pomodoro_sessions",
        ] {
            assert!(
                INITIAL_SCHEMA_SQL.contains(table),
                "missing SQLite table {table}"
            );
        }
    }
}

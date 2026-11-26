use std::path::Path;
use std::sync::Mutex;

use chrono::{DateTime, Duration, Local, NaiveTime, TimeZone, Utc};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

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
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_cache (
    city_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    elapsed_secs INTEGER NOT NULL DEFAULT 0,
    running INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target_at TEXT NOT NULL,
    lead_minutes INTEGER NOT NULL DEFAULT 10,
    lead_dismissed INTEGER NOT NULL DEFAULT 0,
    snooze_until TEXT,
    exact_fired INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeLedgerState {
    pub id: i64,
    pub client_name: String,
    pub elapsed_secs: i64,
    pub running: bool,
    pub started_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TasbihState {
    pub count: i64,
    pub target: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: i64,
    pub title: String,
    pub start_at: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskItem {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub due_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReminderItem {
    pub id: i64,
    pub title: String,
    pub target_at: String,
    pub lead_minutes: i64,
    pub lead_dismissed: bool,
    pub snooze_until: Option<String>,
    pub exact_fired: bool,
    pub completed: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReminderAlertPayload {
    pub reminder: ReminderItem,
    pub stage: String,
    pub is_exact_due: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaterDayPoint {
    pub date_label: String,
    pub total_ml: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WaterSummary {
    pub today_ml: i64,
    pub goal_ml: i64,
    pub percentage: f64,
    pub goal_reached: bool,
    pub last_entry_id: Option<i64>,
    pub weekly: Vec<WaterDayPoint>,
}

/// File/link/text item stored by reference in the Shelf (`FR-SH-1..3`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShelfItem {
    pub id: i64,
    pub kind: String,
    pub path_or_text: String,
    pub display_name: String,
    pub available: bool,
    pub added_at: String,
}

/// Thread-safe SQLite repository backing Lumen's local-first storage.
pub struct StorageRepo {
    conn: Mutex<Connection>,
}

impl StorageRepo {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create storage directory: {e}"))?;
        }
        let conn = Connection::open(path).map_err(|e| format!("SQLite open failed: {e}"))?;
        conn.execute_batch(INITIAL_SCHEMA_SQL)
            .map_err(|e| format!("SQLite migration failed: {e}"))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn open_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(|e| format!("SQLite open failed: {e}"))?;
        conn.execute_batch(INITIAL_SCHEMA_SQL)
            .map_err(|e| format!("SQLite migration failed: {e}"))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn list_tasks(&self) -> Result<Vec<TaskItem>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, done, due_at, created_at FROM tasks ORDER BY done ASC, id DESC",
            )
            .map_err(|e| format!("prepare tasks failed: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(TaskItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    done: row.get::<_, i64>(2)? != 0,
                    due_at: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| format!("query tasks failed: {e}"))?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| format!("row decode failed: {e}"))?);
        }
        Ok(items)
    }

    pub fn add_task(&self, title: &str, due_at: Option<String>) -> Result<Vec<TaskItem>, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("task title cannot be empty".into());
        }
        let now = Utc::now().to_rfc3339();
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "INSERT INTO tasks (title, done, due_at, created_at) VALUES (?1, 0, ?2, ?3)",
                params![trimmed, due_at, now],
            )
            .map_err(|e| format!("insert task failed: {e}"))?;
        }
        self.list_tasks()
    }

    pub fn toggle_task(&self, id: i64) -> Result<Vec<TaskItem>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "UPDATE tasks SET done = CASE WHEN done = 0 THEN 1 ELSE 0 END WHERE id = ?1",
                params![id],
            )
            .map_err(|e| format!("toggle task failed: {e}"))?;
        }
        self.list_tasks()
    }

    pub fn update_task(
        &self,
        id: i64,
        title: &str,
        due_at: Option<String>,
    ) -> Result<Vec<TaskItem>, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("task title cannot be empty".into());
        }
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "UPDATE tasks SET title = ?1, due_at = ?2 WHERE id = ?3",
                params![trimmed, due_at, id],
            )
            .map_err(|e| format!("update task failed: {e}"))?;
        }
        self.list_tasks()
    }

    pub fn delete_task(&self, id: i64) -> Result<Vec<TaskItem>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
                .map_err(|e| format!("delete task failed: {e}"))?;
        }
        self.list_tasks()
    }

    pub fn export_tasks_json(&self) -> Result<String, String> {
        let tasks = self.list_tasks()?;
        serde_json::to_string_pretty(&tasks).map_err(|e| format!("JSON serialize failed: {e}"))
    }

    pub fn import_tasks_json(&self, raw_json: &str) -> Result<Vec<TaskItem>, String> {
        #[derive(Deserialize)]
        struct ImportedTask {
            title: String,
            #[serde(default)]
            done: bool,
            #[serde(default)]
            due_at: Option<String>,
            #[serde(default)]
            created_at: Option<String>,
        }
        let parsed: Vec<ImportedTask> =
            serde_json::from_str(raw_json).map_err(|e| format!("invalid tasks JSON: {e}"))?;
        let now = Utc::now().to_rfc3339();
        {
            let mut conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            let tx = conn
                .transaction()
                .map_err(|e| format!("transaction start failed: {e}"))?;
            for item in parsed {
                let title = item.title.trim();
                if title.is_empty() {
                    continue;
                }
                tx.execute(
                    "INSERT INTO tasks (title, done, due_at, created_at) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        title,
                        i64::from(item.done),
                        item.due_at,
                        item.created_at.unwrap_or_else(|| now.clone())
                    ],
                )
                .map_err(|e| format!("import insert failed: {e}"))?;
            }
            tx.commit()
                .map_err(|e| format!("transaction commit failed: {e}"))?;
        }
        self.list_tasks()
    }

    /// Computes the start of the active hydration day using a configurable local reset hour.
    #[must_use]
    pub fn day_window_start_utc(now_utc: DateTime<Utc>, reset_hour: u32) -> DateTime<Utc> {
        let local_now = now_utc.with_timezone(&Local);
        let safe_hour = reset_hour.min(23);
        let reset_time = NaiveTime::from_hms_opt(safe_hour, 0, 0).unwrap_or(NaiveTime::MIN);
        let mut day = local_now.date_naive();
        if local_now.time() < reset_time {
            day = day.pred_opt().unwrap_or(day);
        }
        let naive_dt = day.and_time(reset_time);
        Local
            .from_local_datetime(&naive_dt)
            .single()
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or(now_utc)
    }

    pub fn log_water(
        &self,
        ml: i64,
        now_utc: DateTime<Utc>,
        goal_ml: i64,
        reset_hour: u32,
    ) -> Result<WaterSummary, String> {
        if ml <= 0 {
            return Err("serving ml must be positive".into());
        }
        let entry_id = {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "INSERT INTO water_log (ml, logged_at) VALUES (?1, ?2)",
                params![ml, now_utc.to_rfc3339()],
            )
            .map_err(|e| format!("log water failed: {e}"))?;
            conn.last_insert_rowid()
        };
        let mut summary = self.water_summary(now_utc, goal_ml, reset_hour)?;
        summary.last_entry_id = Some(entry_id);
        Ok(summary)
    }

    pub fn undo_water(
        &self,
        entry_id: i64,
        now_utc: DateTime<Utc>,
        goal_ml: i64,
        reset_hour: u32,
    ) -> Result<WaterSummary, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute("DELETE FROM water_log WHERE id = ?1", params![entry_id])
                .map_err(|e| format!("undo water failed: {e}"))?;
        }
        self.water_summary(now_utc, goal_ml, reset_hour)
    }

    pub fn water_summary(
        &self,
        now_utc: DateTime<Utc>,
        goal_ml: i64,
        reset_hour: u32,
    ) -> Result<WaterSummary, String> {
        let day_start = Self::day_window_start_utc(now_utc, reset_hour);
        let safe_goal = goal_ml.max(100);
        let week_start = day_start - Duration::days(6);

        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare(
                "SELECT id, ml, logged_at FROM water_log WHERE logged_at >= ?1 ORDER BY id DESC",
            )
            .map_err(|e| format!("prepare water query failed: {e}"))?;

        let rows = stmt
            .query_map(params![week_start.to_rfc3339()], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| format!("query water failed: {e}"))?;

        let mut today_ml = 0i64;
        let mut last_entry_id = None;
        let mut day_buckets = [0i64; 7];

        for row in rows {
            let (id, ml, ts_str) = row.map_err(|e| format!("water row error: {e}"))?;
            let Ok(ts) = DateTime::parse_from_rfc3339(&ts_str).map(|d| d.with_timezone(&Utc))
            else {
                continue;
            };
            if ts >= day_start && ts <= now_utc + Duration::minutes(5) {
                today_ml += ml;
                if last_entry_id.is_none() {
                    last_entry_id = Some(id);
                }
            }
            let days_since = (ts - week_start).num_days();
            if (0..7).contains(&days_since) {
                day_buckets[days_since as usize] += ml;
            }
        }

        let weekly = (0..7)
            .map(|offset| {
                let d = (week_start + Duration::days(offset)).with_timezone(&Local);
                WaterDayPoint {
                    date_label: d.format("%a").to_string(),
                    total_ml: day_buckets[offset as usize],
                }
            })
            .collect();

        let percentage = ((today_ml as f64) / (safe_goal as f64)) * 100.0;
        Ok(WaterSummary {
            today_ml,
            goal_ml: safe_goal,
            percentage,
            goal_reached: percentage >= 100.0,
            last_entry_id,
            weekly,
        })
    }

    pub fn list_shelf(&self) -> Result<Vec<ShelfItem>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare("SELECT id, kind, path_or_text, added_at FROM shelf_items ORDER BY id DESC")
            .map_err(|e| format!("prepare shelf failed: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                let kind: String = row.get(1)?;
                let path_or_text: String = row.get(2)?;
                let available = if kind == "file" || kind == "folder" {
                    Path::new(&path_or_text).exists()
                } else {
                    true
                };
                let display_name = if kind == "file" || kind == "folder" {
                    Path::new(&path_or_text)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&path_or_text)
                        .to_string()
                } else {
                    path_or_text.chars().take(48).collect()
                };
                Ok(ShelfItem {
                    id: row.get(0)?,
                    kind,
                    path_or_text,
                    display_name,
                    available,
                    added_at: row.get(3)?,
                })
            })
            .map_err(|e| format!("query shelf failed: {e}"))?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| format!("shelf row error: {e}"))?);
        }
        Ok(items)
    }

    pub fn add_shelf_item(
        &self,
        kind: &str,
        path_or_text: &str,
        cap: usize,
    ) -> Result<Vec<ShelfItem>, String> {
        let trimmed = path_or_text.trim();
        if trimmed.is_empty() {
            return Err("shelf item cannot be empty".into());
        }
        let max_items = cap.max(1) as i64;
        let now = Utc::now().to_rfc3339();
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "INSERT INTO shelf_items (kind, path_or_text, added_at) VALUES (?1, ?2, ?3)",
                params![kind, trimmed, now],
            )
            .map_err(|e| format!("insert shelf failed: {e}"))?;
            conn.execute(
                "DELETE FROM shelf_items WHERE id NOT IN (SELECT id FROM shelf_items ORDER BY id DESC LIMIT ?1)",
                params![max_items],
            )
            .map_err(|e| format!("enforce shelf cap failed: {e}"))?;
        }
        self.list_shelf()
    }

    pub fn remove_shelf_item(&self, id: i64) -> Result<Vec<ShelfItem>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute("DELETE FROM shelf_items WHERE id = ?1", params![id])
                .map_err(|e| format!("remove shelf failed: {e}"))?;
        }
        self.list_shelf()
    }

    pub fn clear_shelf(&self) -> Result<Vec<ShelfItem>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute("DELETE FROM shelf_items", [])
                .map_err(|e| format!("clear shelf failed: {e}"))?;
        }
        Ok(Vec::new())
    }

    pub fn get_cached_lyrics(&self, track_key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.query_row(
            "SELECT lrc FROM lyrics_cache WHERE track_key = ?1",
            params![track_key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("lyrics cache read failed: {e}"))
    }

    pub fn save_cached_lyrics(&self, track_key: &str, lrc: &str) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO lyrics_cache (track_key, lrc, fetched_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(track_key) DO UPDATE SET lrc = excluded.lrc, fetched_at = excluded.fetched_at",
            params![track_key, lrc, now],
        )
        .map_err(|e| format!("lyrics cache write failed: {e}"))?;
        Ok(())
    }

    pub fn record_pomodoro_session(
        &self,
        kind: &str,
        duration_s: u32,
        completed: bool,
    ) -> Result<(), String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO pomodoro_sessions (kind, started_at, duration_s, completed) VALUES (?1, ?2, ?3, ?4)",
            params![kind, now, i64::from(duration_s), i64::from(completed)],
        )
        .map_err(|e| format!("record pomodoro failed: {e}"))?;
        Ok(())
    }

    pub fn list_calendar_events(&self) -> Result<Vec<CalendarEvent>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, start_at, created_at FROM calendar_events ORDER BY start_at ASC",
            )
            .map_err(|e| format!("prepare calendar failed: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(CalendarEvent {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    start_at: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|e| format!("query calendar failed: {e}"))?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| format!("calendar row error: {e}"))?);
        }
        Ok(out)
    }

    pub fn add_calendar_event(
        &self,
        title: &str,
        start_at: &str,
    ) -> Result<Vec<CalendarEvent>, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("event title cannot be empty".into());
        }
        let now = Utc::now().to_rfc3339();
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "INSERT INTO calendar_events (title, start_at, created_at) VALUES (?1, ?2, ?3)",
                params![trimmed, start_at.trim(), now],
            )
            .map_err(|e| format!("insert calendar failed: {e}"))?;
        }
        self.list_calendar_events()
    }

    pub fn delete_calendar_event(&self, id: i64) -> Result<Vec<CalendarEvent>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute("DELETE FROM calendar_events WHERE id = ?1", params![id])
                .map_err(|e| format!("delete calendar failed: {e}"))?;
        }
        self.list_calendar_events()
    }

    pub fn daily_focus_minutes(&self, now_utc: DateTime<Utc>) -> Result<i64, String> {
        let day_start = Self::day_window_start_utc(now_utc, 0);
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let secs: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_s), 0) FROM pomodoro_sessions
                 WHERE kind = 'focus' AND completed = 1 AND started_at >= ?1",
                params![day_start.to_rfc3339()],
                |row| row.get(0),
            )
            .map_err(|e| format!("daily focus query failed: {e}"))?;
        Ok(secs / 60)
    }

    pub fn with_connection<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        f(&conn)
    }

    pub fn get_weather_cache(&self, city_key: &str) -> Result<Option<(String, String)>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.query_row(
            "SELECT payload_json, fetched_at FROM weather_cache WHERE city_key = ?1",
            params![city_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|e| format!("query weather cache failed: {e}"))
    }

    pub fn save_weather_cache(
        &self,
        city_key: &str,
        payload_json: &str,
        fetched_at_rfc3339: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO weather_cache (city_key, payload_json, fetched_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(city_key) DO UPDATE SET
                payload_json = excluded.payload_json,
                fetched_at = excluded.fetched_at",
            params![city_key, payload_json, fetched_at_rfc3339],
        )
        .map_err(|e| format!("save weather cache failed: {e}"))?;
        Ok(())
    }

    pub fn get_tasbih(&self) -> Result<TasbihState, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let count = conn
            .query_row(
                "SELECT value FROM kv_state WHERE key = 'tasbih_count'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("query tasbih failed: {e}"))?
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(0);
        let target = conn
            .query_row(
                "SELECT value FROM kv_state WHERE key = 'tasbih_target'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("query tasbih target failed: {e}"))?
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(33);
        Ok(TasbihState { count, target })
    }

    pub fn increment_tasbih(&self) -> Result<TasbihState, String> {
        let current = self.get_tasbih()?;
        let next_count = current.count + 1;
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO kv_state (key, value, updated_at) VALUES ('tasbih_count', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![next_count.to_string(), now],
        )
        .map_err(|e| format!("update tasbih failed: {e}"))?;
        Ok(TasbihState {
            count: next_count,
            target: current.target,
        })
    }

    pub fn reset_tasbih(&self) -> Result<TasbihState, String> {
        let current = self.get_tasbih()?;
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO kv_state (key, value, updated_at) VALUES ('tasbih_count', '0', ?1)
             ON CONFLICT(key) DO UPDATE SET value = '0', updated_at = excluded.updated_at",
            params![now],
        )
        .map_err(|e| format!("reset tasbih failed: {e}"))?;
        Ok(TasbihState {
            count: 0,
            target: current.target,
        })
    }

    pub fn get_active_ledger(&self) -> Result<TimeLedgerState, String> {
        let now = Utc::now();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let existing: Option<TimeLedgerState> = conn
            .query_row(
                "SELECT id, client_name, elapsed_secs, running, started_at, updated_at
                 FROM time_ledger ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok(TimeLedgerState {
                        id: row.get(0)?,
                        client_name: row.get(1)?,
                        elapsed_secs: row.get(2)?,
                        running: row.get::<_, i64>(3)? != 0,
                        started_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .optional()
            .map_err(|e| format!("query ledger failed: {e}"))?;

        if let Some(mut item) = existing {
            if item.running
                && let Some(ref start_str) = item.started_at
                && let Ok(dt) = DateTime::parse_from_rfc3339(start_str)
            {
                let live_delta = (now - dt.with_timezone(&Utc)).num_seconds().max(0);
                item.elapsed_secs += live_delta;
            }
            return Ok(item);
        }

        let ts = now.to_rfc3339();
        conn.execute(
            "INSERT INTO time_ledger (client_name, elapsed_secs, running, started_at, updated_at)
             VALUES (?1, 0, 0, NULL, ?2)",
            params!["Client A", ts],
        )
        .map_err(|e| format!("seed ledger failed: {e}"))?;
        let id = conn.last_insert_rowid();
        Ok(TimeLedgerState {
            id,
            client_name: "Client A".into(),
            elapsed_secs: 0,
            running: false,
            started_at: None,
            updated_at: ts,
        })
    }

    pub fn toggle_ledger(&self, client_name: Option<&str>) -> Result<TimeLedgerState, String> {
        let current = self.get_active_ledger()?;
        let now = Utc::now().to_rfc3339();
        let next_client = client_name
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(&current.client_name);
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        if current.running {
            conn.execute(
                "UPDATE time_ledger SET client_name = ?1, elapsed_secs = ?2, running = 0, started_at = NULL, updated_at = ?3 WHERE id = ?4",
                params![next_client, current.elapsed_secs, now, current.id],
            )
            .map_err(|e| format!("pause ledger failed: {e}"))?;
        } else {
            conn.execute(
                "UPDATE time_ledger SET client_name = ?1, running = 1, started_at = ?2, updated_at = ?2 WHERE id = ?3",
                params![next_client, now, current.id],
            )
            .map_err(|e| format!("start ledger failed: {e}"))?;
        }
        drop(conn);
        self.get_active_ledger()
    }

    pub fn reset_ledger(&self, client_name: Option<&str>) -> Result<TimeLedgerState, String> {
        let current = self.get_active_ledger()?;
        let now = Utc::now().to_rfc3339();
        let next_client = client_name
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(&current.client_name);
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "UPDATE time_ledger SET client_name = ?1, elapsed_secs = 0, running = 0, started_at = NULL, updated_at = ?2 WHERE id = ?3",
            params![next_client, now, current.id],
        )
        .map_err(|e| format!("reset ledger failed: {e}"))?;
        drop(conn);
        self.get_active_ledger()
    }

    pub fn list_reminders(&self) -> Result<Vec<ReminderItem>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, target_at, lead_minutes, lead_dismissed, snooze_until, exact_fired, completed, created_at
                 FROM reminders
                 ORDER BY completed ASC, target_at ASC, id DESC",
            )
            .map_err(|e| format!("prepare reminders failed: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(ReminderItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    target_at: row.get(2)?,
                    lead_minutes: row.get(3)?,
                    lead_dismissed: row.get::<_, i64>(4)? != 0,
                    snooze_until: row.get(5)?,
                    exact_fired: row.get::<_, i64>(6)? != 0,
                    completed: row.get::<_, i64>(7)? != 0,
                    created_at: row.get(8)?,
                })
            })
            .map_err(|e| format!("query reminders failed: {e}"))?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| format!("reminder decode failed: {e}"))?);
        }
        Ok(items)
    }

    pub fn add_reminder(
        &self,
        title: &str,
        target_at: &str,
        lead_minutes: i64,
    ) -> Result<Vec<ReminderItem>, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("reminder title cannot be empty".into());
        }
        let parsed_target = DateTime::parse_from_rfc3339(target_at.trim())
            .map_err(|e| format!("invalid reminder target_at timestamp: {e}"))?
            .with_timezone(&Utc)
            .to_rfc3339();
        let clamped_lead = lead_minutes.clamp(0, 1440);
        let now = Utc::now().to_rfc3339();
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "INSERT INTO reminders (title, target_at, lead_minutes, lead_dismissed, snooze_until, exact_fired, completed, created_at)
                 VALUES (?1, ?2, ?3, 0, NULL, 0, 0, ?4)",
                params![trimmed, parsed_target, clamped_lead, now],
            )
            .map_err(|e| format!("insert reminder failed: {e}"))?;
        }
        self.list_reminders()
    }

    pub fn delete_reminder(&self, id: i64) -> Result<Vec<ReminderItem>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute("DELETE FROM reminders WHERE id = ?1", params![id])
                .map_err(|e| format!("delete reminder failed: {e}"))?;
        }
        self.list_reminders()
    }

    pub fn stop_reminder_alert_at(
        &self,
        id: i64,
        stage: &str,
        now: DateTime<Utc>,
    ) -> Result<Vec<ReminderItem>, String> {
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            let existing: Option<(String, i64)> = conn
                .query_row(
                    "SELECT target_at, exact_fired FROM reminders WHERE id = ?1",
                    params![id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()
                .map_err(|e| format!("query reminder for stop failed: {e}"))?;
            if let Some((target_at_str, exact_fired)) = existing {
                let target_passed = DateTime::parse_from_rfc3339(&target_at_str)
                    .map(|dt| now >= dt.with_timezone(&Utc))
                    .unwrap_or(false);
                if stage == "exact" || exact_fired != 0 || target_passed {
                    conn.execute(
                        "UPDATE reminders SET lead_dismissed = 1, snooze_until = NULL, exact_fired = 1, completed = 1 WHERE id = ?1",
                        params![id],
                    )
                    .map_err(|e| format!("complete reminder failed: {e}"))?;
                } else {
                    // Stopping an early lead/snooze alert keeps exact_fired = 0 so the final exact-time reminder still fires.
                    conn.execute(
                        "UPDATE reminders SET lead_dismissed = 1, snooze_until = NULL WHERE id = ?1",
                        params![id],
                    )
                    .map_err(|e| format!("dismiss lead reminder failed: {e}"))?;
                }
            }
        }
        self.list_reminders()
    }

    pub fn stop_reminder_alert(&self, id: i64, stage: &str) -> Result<Vec<ReminderItem>, String> {
        self.stop_reminder_alert_at(id, stage, Utc::now())
    }

    pub fn snooze_reminder_alert_at(
        &self,
        id: i64,
        snooze_minutes: i64,
        now: DateTime<Utc>,
    ) -> Result<Vec<ReminderItem>, String> {
        let mins = snooze_minutes.clamp(1, 60);
        let snooze_at = (now + Duration::minutes(mins)).to_rfc3339();
        {
            let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
            conn.execute(
                "UPDATE reminders SET lead_dismissed = 1, snooze_until = ?1 WHERE id = ?2",
                params![snooze_at, id],
            )
            .map_err(|e| format!("snooze reminder failed: {e}"))?;
        }
        self.list_reminders()
    }

    pub fn snooze_reminder_alert(
        &self,
        id: i64,
        snooze_minutes: i64,
    ) -> Result<Vec<ReminderItem>, String> {
        self.snooze_reminder_alert_at(id, snooze_minutes, Utc::now())
    }

    pub fn poll_due_reminders(
        &self,
        now: DateTime<Utc>,
    ) -> Result<Vec<ReminderAlertPayload>, String> {
        let items = self.list_reminders()?;
        let mut due = Vec::new();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;

        for item in items {
            if item.completed {
                continue;
            }
            let Ok(target_dt) = DateTime::parse_from_rfc3339(&item.target_at) else {
                continue;
            };
            let target_utc = target_dt.with_timezone(&Utc);

            // Priority 1: Mandatory exact-time notification whenever scheduled time arrives.
            if !item.exact_fired && now >= target_utc {
                conn.execute(
                    "UPDATE reminders SET exact_fired = 1, lead_dismissed = 1, snooze_until = NULL WHERE id = ?1",
                    params![item.id],
                )
                .map_err(|e| format!("mark exact reminder fired failed: {e}"))?;
                let mut updated = item.clone();
                updated.exact_fired = true;
                updated.lead_dismissed = true;
                updated.snooze_until = None;
                due.push(ReminderAlertPayload {
                    reminder: updated,
                    stage: "exact".into(),
                    is_exact_due: true,
                });
                continue;
            }

            // Priority 2: Automatic snooze firing.
            if let Some(ref snooze_str) = item.snooze_until
                && let Ok(snooze_dt) = DateTime::parse_from_rfc3339(snooze_str)
                && now >= snooze_dt.with_timezone(&Utc)
            {
                conn.execute(
                    "UPDATE reminders SET snooze_until = NULL WHERE id = ?1",
                    params![item.id],
                )
                .map_err(|e| format!("consume snooze reminder failed: {e}"))?;
                let mut updated = item.clone();
                updated.snooze_until = None;
                due.push(ReminderAlertPayload {
                    reminder: updated,
                    stage: "snooze".into(),
                    is_exact_due: item.exact_fired,
                });
                continue;
            }

            // Priority 3: Early lead-time notification (e.g. 10 min before).
            if item.lead_minutes > 0 && !item.lead_dismissed && !item.exact_fired {
                let lead_at = target_utc - Duration::minutes(item.lead_minutes);
                if now >= lead_at && now < target_utc {
                    conn.execute(
                        "UPDATE reminders SET lead_dismissed = 1 WHERE id = ?1",
                        params![item.id],
                    )
                    .map_err(|e| format!("mark lead reminder fired failed: {e}"))?;
                    let mut updated = item.clone();
                    updated.lead_dismissed = true;
                    due.push(ReminderAlertPayload {
                        reminder: updated,
                        stage: "lead".into(),
                        is_exact_due: false,
                    });
                }
            }
        }

        Ok(due)
    }
}

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
            "weather_cache",
            "time_ledger",
            "kv_state",
        ] {
            assert!(
                INITIAL_SCHEMA_SQL.contains(table),
                "missing SQLite table {table}"
            );
        }
    }

    #[test]
    fn crud_and_json_roundtrip_tasks() {
        let repo = StorageRepo::open_in_memory().expect("in-memory db");
        let tasks = repo
            .add_task("Ship Phase 3", Some("18:00".into()))
            .expect("add");
        assert_eq!(tasks.len(), 1);
        assert!(!tasks[0].done);

        let toggled = repo.toggle_task(tasks[0].id).expect("toggle");
        assert!(toggled[0].done);

        let exported = repo.export_tasks_json().expect("export");
        let repo2 = StorageRepo::open_in_memory().expect("in-memory db2");
        let imported = repo2.import_tasks_json(&exported).expect("import");
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].title, "Ship Phase 3");
        assert!(imported[0].done);
    }

    #[test]
    fn tracks_water_totals_undo_and_daily_reset() {
        let repo = StorageRepo::open_in_memory().expect("in-memory db");
        let day1 = DateTime::parse_from_rfc3339("2026-11-24T12:00:00Z")
            .expect("ts")
            .with_timezone(&Utc);
        let summary = repo.log_water(500, day1, 1500, 4).expect("log");
        assert_eq!(summary.today_ml, 500);
        assert!(!summary.goal_reached);

        let entry_id = summary.last_entry_id.expect("id");
        let after_undo = repo.undo_water(entry_id, day1, 1500, 4).expect("undo");
        assert_eq!(after_undo.today_ml, 0);

        repo.log_water(1600, day1, 1500, 4).expect("log goal");
        let goal_summary = repo.water_summary(day1, 1500, 4).expect("summary");
        assert!(goal_summary.goal_reached);
        assert!(goal_summary.percentage > 100.0);

        let day2 = day1 + Duration::days(1);
        let reset_summary = repo.water_summary(day2, 1500, 4).expect("next day");
        assert_eq!(reset_summary.today_ml, 0);
    }

    #[test]
    fn enforces_shelf_cap_missing_files_and_caches_lyrics() {
        let repo = StorageRepo::open_in_memory().expect("db");
        for idx in 0..5 {
            repo.add_shelf_item("text", &format!("note {idx}"), 3)
                .expect("add note");
        }
        let shelf = repo.list_shelf().expect("list");
        assert_eq!(shelf.len(), 3);

        let with_missing = repo
            .add_shelf_item("file", "Z:\\definitely_missing_lumen_file.txt", 10)
            .expect("add missing");
        assert!(!with_missing[0].available);

        repo.save_cached_lyrics("artist::song", "[00:01.00] Hello")
            .expect("save lrc");
        assert_eq!(
            repo.get_cached_lyrics("artist::song").expect("get lrc"),
            Some("[00:01.00] Hello".into())
        );

        repo.record_pomodoro_session("focus", 1500, true)
            .expect("record pomodoro");
        assert_eq!(repo.daily_focus_minutes(Utc::now()).expect("mins"), 25);
    }

    #[test]
    fn persists_weather_cache_tasbih_and_ledger() {
        let repo = StorageRepo::open_in_memory().expect("db");
        repo.save_weather_cache("khulna", r#"{"tempC":29.0}"#, "2026-11-26T10:00:00Z")
            .expect("save weather");
        let cached = repo
            .get_weather_cache("khulna")
            .expect("get weather")
            .expect("present");
        assert!(cached.0.contains("29.0"));

        let t0 = repo.get_tasbih().expect("tasbih0");
        assert_eq!(t0.count, 0);
        let t1 = repo.increment_tasbih().expect("inc");
        assert_eq!(t1.count, 1);
        let t_reset = repo.reset_tasbih().expect("reset");
        assert_eq!(t_reset.count, 0);

        let l0 = repo.get_active_ledger().expect("ledger0");
        assert!(!l0.running);
        let l1 = repo.toggle_ledger(Some("Client A")).expect("start");
        assert!(l1.running);
        assert_eq!(l1.client_name, "Client A");
        let l2 = repo.reset_ledger(None).expect("reset ledger");
        assert!(!l2.running);
        assert_eq!(l2.elapsed_secs, 0);
    }

    #[test]
    fn fires_lead_snooze_and_mandatory_exact_time_reminders() {
        let repo = StorageRepo::open_in_memory().expect("db");
        let target = DateTime::parse_from_rfc3339("2026-11-26T20:00:00Z")
            .expect("target")
            .with_timezone(&Utc);
        let list = repo
            .add_reminder("Evening Meeting", &target.to_rfc3339(), 10)
            .expect("add reminder");
        assert_eq!(list.len(), 1);
        let rem_id = list[0].id;

        // 15 minutes before -> nothing due
        assert!(
            repo.poll_due_reminders(target - Duration::minutes(15))
                .expect("poll")
                .is_empty()
        );

        // 10 minutes before -> lead alert fires
        let lead_due = repo
            .poll_due_reminders(target - Duration::minutes(10))
            .expect("lead");
        assert_eq!(lead_due.len(), 1);
        assert_eq!(lead_due[0].stage, "lead");
        assert!(!lead_due[0].is_exact_due);

        // User hits OK / Stop early: must clear early alert WITHOUT disabling exact-time alert.
        let after_stop = repo
            .stop_reminder_alert_at(rem_id, "lead", target - Duration::minutes(9))
            .expect("stop lead");
        assert!(!after_stop[0].completed);
        assert!(!after_stop[0].exact_fired);

        // Snooze case: user hits Snooze (3 min) at -10m -> fires at -7m
        repo.snooze_reminder_alert_at(rem_id, 3, target - Duration::minutes(10))
            .expect("snooze");
        assert!(
            repo.poll_due_reminders(target - Duration::minutes(8))
                .expect("before snooze")
                .is_empty()
        );
        let snooze_due = repo
            .poll_due_reminders(target - Duration::minutes(7))
            .expect("snooze due");
        assert_eq!(snooze_due.len(), 1);
        assert_eq!(snooze_due[0].stage, "snooze");

        // User stops snooze -> exact time MUST still fire at target!
        repo.stop_reminder_alert_at(rem_id, "snooze", target - Duration::minutes(6))
            .expect("stop snooze");
        let exact_due = repo.poll_due_reminders(target).expect("exact due");
        assert_eq!(exact_due.len(), 1);
        assert_eq!(exact_due[0].stage, "exact");
        assert!(exact_due[0].is_exact_due);

        // Final OK completes reminder
        let final_list = repo
            .stop_reminder_alert_at(rem_id, "exact", target)
            .expect("stop exact");
        assert!(final_list[0].completed);
    }
}

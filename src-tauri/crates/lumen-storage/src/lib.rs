use std::path::Path;
use std::sync::Mutex;

use chrono::{DateTime, Duration, Local, NaiveTime, TimeZone, Utc};
use rusqlite::{Connection, params};
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
";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskItem {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub due_at: Option<String>,
    pub created_at: String,
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

/// Thread-safe SQLite repository backing Lumen's local-first storage (`FR-TD-*`, `FR-WT-*`).
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

    pub fn with_connection<T>(
        &self,
        f: impl FnOnce(&Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        f(&conn)
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

        // Next day after reset hour must start fresh at 0 ml
        let day2 = day1 + Duration::days(1);
        let reset_summary = repo.water_summary(day2, 1500, 4).expect("next day");
        assert_eq!(reset_summary.today_ml, 0);
    }
}

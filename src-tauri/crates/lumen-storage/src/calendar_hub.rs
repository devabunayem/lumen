use std::collections::{BTreeMap, HashSet};

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, NaiveDateTime, Utc};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

use crate::StorageRepo;

pub const CALENDAR_HUB_SCHEMA_SQL: &str = r"
CREATE TABLE IF NOT EXISTS calendar_sources (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    account_label TEXT NOT NULL,
    ics_url TEXT,
    sync_token TEXT,
    last_synced_at TEXT,
    last_error TEXT,
    connected INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due_date TEXT,
    due_time TEXT,
    estimate_min INTEGER,
    done_at TEXT,
    client TEXT,
    project_id TEXT,
    is_deadline INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'once',
    at TEXT,
    repeat_rule TEXT,
    prayer_name TEXT,
    prayer_offset_min INTEGER,
    prayer_relation TEXT,
    snooze_count INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    importance TEXT NOT NULL DEFAULT 'normal',
    missed INTEGER NOT NULL DEFAULT 0,
    next_trigger_at TEXT,
    repeat_fired_once INTEGER NOT NULL DEFAULT 0,
    last_fired_at TEXT,
    deferred_for_break INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL DEFAULT 'local',
    external_id TEXT,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#30d158',
    meeting_url TEXT,
    location TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    start_at TEXT NOT NULL,
    end_at TEXT,
    kind TEXT NOT NULL DEFAULT 'focus',
    completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS day_marks (
    date_key TEXT PRIMARY KEY,
    task_count INTEGER NOT NULL DEFAULT 0,
    event_count INTEGER NOT NULL DEFAULT 0,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    deadline_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarTask {
    pub id: i64,
    pub title: String,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub estimate_min: Option<i64>,
    pub done_at: Option<String>,
    pub client: Option<String>,
    pub project_id: Option<String>,
    pub is_deadline: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrayerAnchorSpec {
    pub prayer: String,
    pub offset_min: i64,
    pub relation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarReminder {
    pub id: i64,
    pub title: String,
    pub kind: String,
    pub at: Option<String>,
    pub repeat_rule: Option<String>,
    pub prayer_anchor: Option<PrayerAnchorSpec>,
    pub snooze_count: i64,
    pub active: bool,
    pub importance: String,
    pub missed: bool,
    #[serde(default)]
    pub next_trigger_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DueCalendarReminderAlert {
    pub reminder: CalendarReminder,
    pub is_repeat: bool,
    pub was_deferred: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarPollResult {
    pub due_alerts: Vec<DueCalendarReminderAlert>,
    pub missed_reminders: Vec<CalendarReminder>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarSource {
    pub id: String,
    pub provider: String,
    pub account_label: String,
    pub ics_url: Option<String>,
    pub last_synced_at: Option<String>,
    pub last_error: Option<String>,
    pub connected: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarHubEvent {
    pub id: i64,
    pub source_id: String,
    pub title: String,
    pub start: String,
    pub end: String,
    pub all_day: bool,
    pub color: String,
    pub meeting_url: Option<String>,
    pub location: Option<String>,
    pub read_only: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusSessionRecord {
    pub id: i64,
    pub task_id: Option<i64>,
    pub start_at: String,
    pub end_at: Option<String>,
    pub kind: String,
    pub completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayMarkSummary {
    pub date_key: String,
    pub task_count: i64,
    pub event_count: i64,
    pub reminder_count: i64,
    pub deadline_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarHubSnapshot {
    pub year: i32,
    pub month: u32,
    pub day_marks: Vec<DayMarkSummary>,
    pub tasks: Vec<CalendarTask>,
    pub events: Vec<CalendarHubEvent>,
    pub reminders: Vec<CalendarReminder>,
    pub sources: Vec<CalendarSource>,
    pub recent_focus_sessions: Vec<FocusSessionRecord>,
    pub focus_task_id: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedEventInput {
    pub external_id: String,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub color: String,
    pub meeting_url: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegacyMigrationReport {
    pub migrated_tasks: usize,
    pub migrated_events: usize,
    pub migrated_reminders: usize,
    pub migrated_focus_sessions: usize,
    pub already_migrated: bool,
}

fn migrate_calendar_reminder_columns(conn: &Connection) -> Result<(), String> {
    let cols: HashSet<String> = {
        let mut stmt = conn
            .prepare("PRAGMA table_info(calendar_reminders)")
            .map_err(|e| format!("pragma calendar_reminders failed: {e}"))?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(1))
            .map_err(|e| format!("pragma map failed: {e}"))?;
        rows.filter_map(Result::ok).collect()
    };
    const ALTERS: [(&str, &str); 4] = [
        (
            "next_trigger_at",
            "ALTER TABLE calendar_reminders ADD COLUMN next_trigger_at TEXT",
        ),
        (
            "repeat_fired_once",
            "ALTER TABLE calendar_reminders ADD COLUMN repeat_fired_once INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "last_fired_at",
            "ALTER TABLE calendar_reminders ADD COLUMN last_fired_at TEXT",
        ),
        (
            "deferred_for_break",
            "ALTER TABLE calendar_reminders ADD COLUMN deferred_for_break INTEGER NOT NULL DEFAULT 0",
        ),
    ];
    for (col, sql) in ALTERS {
        if !cols.contains(col) {
            conn.execute(sql, [])
                .map_err(|e| format!("migrate calendar_reminders.{col} failed: {e}"))?;
        }
    }
    Ok(())
}

pub(crate) fn init_calendar_hub_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(CALENDAR_HUB_SCHEMA_SQL)
        .map_err(|e| format!("calendar_hub schema init failed: {e}"))?;
    migrate_calendar_reminder_columns(conn)?;
    let existing_local: Option<String> = conn
        .query_row(
            "SELECT id FROM calendar_sources WHERE id = 'local'",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("check local source failed: {e}"))?;
    if existing_local.is_none() {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO calendar_sources (id, provider, account_label, connected, created_at)
             VALUES ('local', 'local', 'Local calendar', 1, ?1)",
            params![now],
        )
        .map_err(|e| format!("seed local source failed: {e}"))?;
    }
    let _ = migrate_legacy_to_calendar_hub_for_conn(conn, false)?;
    Ok(())
}

fn split_legacy_task_due(
    due_at: Option<&str>,
    start_at: Option<&str>,
) -> (Option<String>, Option<String>) {
    let raw = start_at.or(due_at).map(str::trim).filter(|s| !s.is_empty());
    let Some(val) = raw else {
        return (None, None);
    };
    let date_part = extract_date_key(val);
    let time_part = if val.len() >= 16 && (val.as_bytes()[10] == b'T' || val.as_bytes()[10] == b' ')
    {
        let hm = &val[11..16];
        if hm.len() == 5 && hm.as_bytes()[2] == b':' {
            Some(hm.to_string())
        } else {
            None
        }
    } else if val.len() <= 8 && val.contains(':') {
        Some(val.to_string())
    } else {
        None
    };
    (date_part, time_part)
}

pub(crate) fn migrate_legacy_to_calendar_hub_for_conn(
    conn: &Connection,
    force: bool,
) -> Result<LegacyMigrationReport, String> {
    let already: Option<String> = conn
        .query_row(
            "SELECT value FROM kv_state WHERE key = 'calendar_hub_migrated_v1'",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| format!("check calendar_hub migration flag failed: {e}"))?;
    if already.is_some() && !force {
        return Ok(LegacyMigrationReport {
            already_migrated: true,
            ..Default::default()
        });
    }

    let legacy_total: i64 = conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM tasks)
                  + (SELECT COUNT(*) FROM calendar_events)
                  + (SELECT COUNT(*) FROM reminders)
                  + (SELECT COUNT(*) FROM pomodoro_sessions)",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if legacy_total == 0 && !force {
        return Ok(LegacyMigrationReport::default());
    }

    let mut report = LegacyMigrationReport::default();

    // 1. tasks -> calendar_tasks
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, due_at, created_at, estimate_min, start_at, fixed, done_at, done, client, kind
                 FROM tasks ORDER BY id ASC",
            )
            .map_err(|e| format!("prepare legacy tasks migration failed: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, i64>(4).unwrap_or(25),
                    r.get::<_, Option<String>>(5)?,
                    r.get::<_, i64>(6).unwrap_or(0),
                    r.get::<_, Option<String>>(7)?,
                    r.get::<_, i64>(8).unwrap_or(0),
                    r.get::<_, Option<String>>(9)?,
                    r.get::<_, String>(10).unwrap_or_else(|_| "task".into()),
                ))
            })
            .map_err(|e| format!("query legacy tasks migration failed: {e}"))?;
        for row in rows.flatten() {
            let (
                _id,
                title,
                due_at,
                created_at,
                estimate_min,
                start_at,
                fixed,
                done_at,
                done,
                client,
                kind,
            ) = row;
            if title.trim().is_empty() {
                continue;
            }
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM calendar_tasks WHERE title = ?1 AND created_at = ?2",
                    params![title.trim(), created_at],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            if exists > 0 {
                continue;
            }
            let (due_date, due_time) =
                split_legacy_task_due(due_at.as_deref(), start_at.as_deref());
            let final_done_at = if done != 0 {
                done_at.or_else(|| Some(created_at.clone()))
            } else {
                None
            };
            let is_deadline = kind == "deadline" || fixed != 0;
            conn.execute(
                "INSERT INTO calendar_tasks (title, due_date, due_time, estimate_min, done_at, client, is_deadline, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    title.trim(),
                    due_date,
                    due_time,
                    Some(estimate_min.clamp(5, 240)),
                    final_done_at,
                    client,
                    i64::from(is_deadline),
                    created_at
                ],
            )
            .map_err(|e| format!("migrate legacy task failed: {e}"))?;
            report.migrated_tasks += 1;
        }
    }

    // 2. calendar_events -> calendar_events_v2
    {
        let mut stmt = conn
            .prepare("SELECT id, title, start_at, created_at FROM calendar_events ORDER BY id ASC")
            .map_err(|e| format!("prepare legacy calendar_events migration failed: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })
            .map_err(|e| format!("query legacy calendar_events migration failed: {e}"))?;
        for row in rows.flatten() {
            let (id, title, start_at, created_at) = row;
            if title.trim().is_empty() {
                continue;
            }
            let ext_id = format!("legacy_event:{id}");
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM calendar_events_v2 WHERE external_id = ?1",
                    params![ext_id],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            if exists > 0 {
                continue;
            }
            let end_at = parse_datetime_utc_or_local(&start_at)
                .map(|dt| (dt + Duration::minutes(30)).to_rfc3339())
                .unwrap_or_else(|| start_at.clone());
            conn.execute(
                "INSERT INTO calendar_events_v2 (source_id, external_id, title, start_at, end_at, all_day, color, created_at)
                 VALUES ('local', ?1, ?2, ?3, ?4, 0, '#30d158', ?5)",
                params![ext_id, title.trim(), start_at, end_at, created_at],
            )
            .map_err(|e| format!("migrate legacy event failed: {e}"))?;
            report.migrated_events += 1;
        }
    }

    // 3. reminders -> calendar_reminders
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, target_at, snooze_until, completed, created_at
                 FROM reminders ORDER BY id ASC",
            )
            .map_err(|e| format!("prepare legacy reminders migration failed: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, i64>(4).unwrap_or(0),
                    r.get::<_, String>(5)?,
                ))
            })
            .map_err(|e| format!("query legacy reminders migration failed: {e}"))?;
        for row in rows.flatten() {
            let (_id, title, target_at, snooze_until, completed, created_at) = row;
            if title.trim().is_empty() {
                continue;
            }
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM calendar_reminders WHERE title = ?1 AND created_at = ?2",
                    params![title.trim(), created_at],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            if exists > 0 {
                continue;
            }
            let active = i64::from(completed == 0);
            let next_trig = snooze_until
                .or_else(|| parse_datetime_utc_or_local(&target_at).map(|d| d.to_rfc3339()));
            conn.execute(
                "INSERT INTO calendar_reminders (title, kind, at, active, importance, missed, next_trigger_at, created_at)
                 VALUES (?1, 'once', ?2, ?3, 'normal', 0, ?4, ?5)",
                params![title.trim(), target_at, active, next_trig, created_at],
            )
            .map_err(|e| format!("migrate legacy reminder failed: {e}"))?;
            report.migrated_reminders += 1;
        }
    }

    // 4. pomodoro_sessions -> focus_sessions
    {
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, started_at, duration_s, completed
                 FROM pomodoro_sessions ORDER BY id ASC",
            )
            .map_err(|e| format!("prepare legacy pomodoro migration failed: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            })
            .map_err(|e| format!("query legacy pomodoro migration failed: {e}"))?;
        for row in rows.flatten() {
            let (_id, kind, started_at, duration_s, completed) = row;
            let exists: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM focus_sessions WHERE start_at = ?1 AND kind = ?2",
                    params![started_at, kind],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            if exists > 0 {
                continue;
            }
            let end_at = parse_datetime_utc_or_local(&started_at)
                .map(|dt| (dt + Duration::seconds(duration_s.max(0))).to_rfc3339());
            conn.execute(
                "INSERT INTO focus_sessions (task_id, start_at, end_at, kind, completed)
                 VALUES (NULL, ?1, ?2, ?3, ?4)",
                params![started_at, end_at, kind, completed],
            )
            .map_err(|e| format!("migrate legacy focus session failed: {e}"))?;
            report.migrated_focus_sessions += 1;
        }
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO kv_state (key, value, updated_at) VALUES ('calendar_hub_migrated_v1', ?1, ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![now],
    )
    .map_err(|e| format!("mark calendar_hub migration flag failed: {e}"))?;
    Ok(report)
}

fn extract_date_key(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.len() >= 10 && NaiveDate::parse_from_str(&trimmed[..10], "%Y-%m-%d").is_ok() {
        return Some(trimmed[..10].to_string());
    }
    None
}

fn expand_recurring_dates_for_month(
    kind: &str,
    anchor_date: Option<NaiveDate>,
    year: i32,
    month: u32,
) -> Vec<String> {
    let Some(start_date) = anchor_date else {
        return Vec::new();
    };
    let Some(first_of_month) = NaiveDate::from_ymd_opt(year, month, 1) else {
        return Vec::new();
    };
    let next_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    };
    let days_in_month = next_month
        .map(|nm| nm.signed_duration_since(first_of_month).num_days() as u32)
        .unwrap_or(30);

    let mut out = Vec::new();
    match kind {
        "once" | "prayer" => {
            if start_date.year() == year && start_date.month() == month {
                out.push(start_date.format("%Y-%m-%d").to_string());
            } else if kind == "prayer" {
                for d in 1..=days_in_month {
                    if let Some(day) = NaiveDate::from_ymd_opt(year, month, d)
                        && day >= start_date
                    {
                        out.push(day.format("%Y-%m-%d").to_string());
                    }
                }
            }
        }
        "daily" => {
            for d in 1..=days_in_month {
                if let Some(day) = NaiveDate::from_ymd_opt(year, month, d)
                    && day >= start_date
                {
                    out.push(day.format("%Y-%m-%d").to_string());
                }
            }
        }
        "weekly" => {
            let target_wd = start_date.weekday();
            for d in 1..=days_in_month {
                if let Some(day) = NaiveDate::from_ymd_opt(year, month, d)
                    && day >= start_date
                    && day.weekday() == target_wd
                {
                    out.push(day.format("%Y-%m-%d").to_string());
                }
            }
        }
        "monthly" => {
            let target_dom = start_date.day().min(days_in_month);
            if let Some(day) = NaiveDate::from_ymd_opt(year, month, target_dom)
                && day >= start_date
            {
                out.push(day.format("%Y-%m-%d").to_string());
            }
        }
        _ => {}
    }
    out
}

pub(crate) fn rebuild_day_marks_for_conn(
    conn: &Connection,
    year: i32,
    month: u32,
) -> Result<Vec<DayMarkSummary>, String> {
    let prefix = format!("{year:04}-{month:02}-");
    let mut map: BTreeMap<String, (i64, i64, i64, i64)> = BTreeMap::new();

    {
        let mut stmt = conn
            .prepare(
                "SELECT due_date, is_deadline FROM calendar_tasks
                 WHERE done_at IS NULL AND due_date LIKE ?1",
            )
            .map_err(|e| format!("query task marks failed: {e}"))?;
        let mut rows = stmt
            .query(params![format!("{prefix}%")])
            .map_err(|e| format!("exec task marks failed: {e}"))?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let due_opt: Option<String> = row.get(0).map_err(|e| e.to_string())?;
            let is_deadline: i64 = row.get(1).map_err(|e| e.to_string())?;
            if let Some(key) = due_opt.as_deref().and_then(extract_date_key) {
                let entry = map.entry(key).or_insert((0, 0, 0, 0));
                if is_deadline != 0 {
                    entry.3 += 1;
                } else {
                    entry.0 += 1;
                }
            }
        }
    }

    {
        let mut stmt = conn
            .prepare("SELECT start_at FROM calendar_events_v2 WHERE start_at LIKE ?1")
            .map_err(|e| format!("query event marks failed: {e}"))?;
        let mut rows = stmt
            .query(params![format!("{prefix}%")])
            .map_err(|e| format!("exec event marks failed: {e}"))?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let start: String = row.get(0).map_err(|e| e.to_string())?;
            if let Some(key) = extract_date_key(&start) {
                map.entry(key).or_insert((0, 0, 0, 0)).1 += 1;
            }
        }
    }

    {
        let mut stmt = conn
            .prepare("SELECT kind, at, created_at FROM calendar_reminders WHERE active = 1")
            .map_err(|e| format!("query reminder marks failed: {e}"))?;
        let mut rows = stmt
            .query([])
            .map_err(|e| format!("exec reminder marks failed: {e}"))?;
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let kind: String = row.get(0).map_err(|e| e.to_string())?;
            let at_opt: Option<String> = row.get(1).map_err(|e| e.to_string())?;
            let created_at: String = row.get(2).map_err(|e| e.to_string())?;
            let anchor = at_opt
                .as_deref()
                .and_then(extract_date_key)
                .or_else(|| extract_date_key(&created_at))
                .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());
            for key in expand_recurring_dates_for_month(&kind, anchor, year, month) {
                map.entry(key).or_insert((0, 0, 0, 0)).2 += 1;
            }
        }
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "DELETE FROM day_marks WHERE date_key LIKE ?1",
        params![format!("{prefix}%")],
    )
    .map_err(|e| format!("clear month day_marks failed: {e}"))?;

    let mut out = Vec::with_capacity(map.len());
    for (date_key, (t, e, r, d)) in map {
        conn.execute(
            "INSERT INTO day_marks (date_key, task_count, event_count, reminder_count, deadline_count, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![date_key, t, e, r, d, now],
        )
        .map_err(|err| format!("insert day_marks failed: {err}"))?;
        out.push(DayMarkSummary {
            date_key,
            task_count: t,
            event_count: e,
            reminder_count: r,
            deadline_count: d,
        });
    }
    Ok(out)
}

impl StorageRepo {
    pub fn calendar_hub_snapshot(
        &self,
        year: i32,
        month: u32,
    ) -> Result<CalendarHubSnapshot, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let day_marks = rebuild_day_marks_for_conn(&conn, year, month)?;

        let tasks = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, title, due_date, due_time, estimate_min, done_at, client, project_id, is_deadline, created_at
                     FROM calendar_tasks
                     ORDER BY CASE WHEN done_at IS NULL THEN 0 ELSE 1 END,
                              COALESCE(due_date, '9999-12-31') ASC,
                              COALESCE(due_time, '99:99') ASC,
                              id ASC",
                )
                .map_err(|e| format!("list calendar_tasks failed: {e}"))?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(CalendarTask {
                        id: r.get(0)?,
                        title: r.get(1)?,
                        due_date: r.get(2)?,
                        due_time: r.get(3)?,
                        estimate_min: r.get(4)?,
                        done_at: r.get(5)?,
                        client: r.get(6)?,
                        project_id: r.get(7)?,
                        is_deadline: r.get::<_, i64>(8)? != 0,
                        created_at: r.get(9)?,
                    })
                })
                .map_err(|e| format!("map calendar_tasks failed: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("collect calendar_tasks failed: {e}"))?
        };

        let events = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, source_id, title, start_at, end_at, all_day, color, meeting_url, location
                     FROM calendar_events_v2
                     ORDER BY start_at ASC, id ASC",
                )
                .map_err(|e| format!("list calendar_events_v2 failed: {e}"))?;
            let rows = stmt
                .query_map([], |r| {
                    let source_id: String = r.get(1)?;
                    Ok(CalendarHubEvent {
                        id: r.get(0)?,
                        read_only: source_id != "local",
                        source_id,
                        title: r.get(2)?,
                        start: r.get(3)?,
                        end: r.get(4)?,
                        all_day: r.get::<_, i64>(5)? != 0,
                        color: r.get(6)?,
                        meeting_url: r.get(7)?,
                        location: r.get(8)?,
                    })
                })
                .map_err(|e| format!("map calendar_events_v2 failed: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("collect calendar_events_v2 failed: {e}"))?
        };

        let reminders = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, title, kind, at, repeat_rule, prayer_name, prayer_offset_min, prayer_relation,
                            snooze_count, active, importance, missed, next_trigger_at, created_at
                     FROM calendar_reminders
                     ORDER BY missed DESC, active DESC, COALESCE(next_trigger_at, at, '9999-12-31') ASC, id ASC",
                )
                .map_err(|e| format!("list calendar_reminders failed: {e}"))?;
            let rows = stmt
                .query_map([], |r| {
                    let prayer_name: Option<String> = r.get(5)?;
                    let prayer_offset: Option<i64> = r.get(6)?;
                    let prayer_rel: Option<String> = r.get(7)?;
                    let prayer_anchor = match (prayer_name, prayer_offset, prayer_rel) {
                        (Some(prayer), Some(offset_min), Some(relation)) => {
                            Some(PrayerAnchorSpec {
                                prayer,
                                offset_min,
                                relation,
                            })
                        }
                        _ => None,
                    };
                    Ok(CalendarReminder {
                        id: r.get(0)?,
                        title: r.get(1)?,
                        kind: r.get(2)?,
                        at: r.get(3)?,
                        repeat_rule: r.get(4)?,
                        prayer_anchor,
                        snooze_count: r.get(8)?,
                        active: r.get::<_, i64>(9)? != 0,
                        importance: r.get(10)?,
                        missed: r.get::<_, i64>(11)? != 0,
                        next_trigger_at: r.get(12)?,
                        created_at: r.get(13)?,
                    })
                })
                .map_err(|e| format!("map calendar_reminders failed: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("collect calendar_reminders failed: {e}"))?
        };

        let sources = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, provider, account_label, ics_url, last_synced_at, last_error, connected
                     FROM calendar_sources ORDER BY created_at ASC",
                )
                .map_err(|e| format!("list calendar_sources failed: {e}"))?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(CalendarSource {
                        id: r.get(0)?,
                        provider: r.get(1)?,
                        account_label: r.get(2)?,
                        ics_url: r.get(3)?,
                        last_synced_at: r.get(4)?,
                        last_error: r.get(5)?,
                        connected: r.get::<_, i64>(6)? != 0,
                    })
                })
                .map_err(|e| format!("map calendar_sources failed: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("collect calendar_sources failed: {e}"))?
        };

        let recent_focus_sessions = {
            let mut stmt = conn
                .prepare(
                    "SELECT id, task_id, start_at, end_at, kind, completed
                     FROM focus_sessions ORDER BY id DESC LIMIT 10",
                )
                .map_err(|e| format!("list focus_sessions failed: {e}"))?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(FocusSessionRecord {
                        id: r.get(0)?,
                        task_id: r.get(1)?,
                        start_at: r.get(2)?,
                        end_at: r.get(3)?,
                        kind: r.get(4)?,
                        completed: r.get::<_, i64>(5)? != 0,
                    })
                })
                .map_err(|e| format!("map focus_sessions failed: {e}"))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("collect focus_sessions failed: {e}"))?
        };

        let focus_task_id: Option<i64> = conn
            .query_row(
                "SELECT value FROM kv_state WHERE key = 'calendar_focus_task_id'",
                [],
                |r| r.get::<_, String>(0),
            )
            .optional()
            .ok()
            .flatten()
            .and_then(|s| s.parse::<i64>().ok());

        Ok(CalendarHubSnapshot {
            year,
            month,
            day_marks,
            tasks,
            events,
            reminders,
            sources,
            recent_focus_sessions,
            focus_task_id,
        })
    }

    pub fn calendar_hub_add_task(
        &self,
        title: &str,
        due_date: Option<&str>,
        due_time: Option<&str>,
        estimate_min: Option<i64>,
        is_deadline: bool,
    ) -> Result<CalendarTask, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("task title cannot be empty".into());
        }
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO calendar_tasks (title, due_date, due_time, estimate_min, is_deadline, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                trimmed,
                due_date,
                due_time,
                estimate_min,
                i64::from(is_deadline),
                now
            ],
        )
        .map_err(|e| format!("insert calendar_task failed: {e}"))?;
        let id = conn.last_insert_rowid();
        Ok(CalendarTask {
            id,
            title: trimmed.to_string(),
            due_date: due_date.map(ToString::to_string),
            due_time: due_time.map(ToString::to_string),
            estimate_min,
            done_at: None,
            client: None,
            project_id: None,
            is_deadline,
            created_at: now,
        })
    }

    pub fn calendar_hub_toggle_task(&self, id: i64) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let cur: Option<Option<String>> = conn
            .query_row(
                "SELECT done_at FROM calendar_tasks WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| format!("query calendar_task failed: {e}"))?;
        let Some(existing_done) = cur else {
            return Err("calendar task not found".into());
        };
        let next_done = if existing_done.is_some() {
            None
        } else {
            Some(Utc::now().to_rfc3339())
        };
        conn.execute(
            "UPDATE calendar_tasks SET done_at = ?1 WHERE id = ?2",
            params![next_done, id],
        )
        .map_err(|e| format!("toggle calendar_task failed: {e}"))?;
        Ok(next_done)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn calendar_hub_add_local_event(
        &self,
        title: &str,
        start: &str,
        end: &str,
        all_day: bool,
        color: &str,
        meeting_url: Option<&str>,
        location: Option<&str>,
    ) -> Result<CalendarHubEvent, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("event title cannot be empty".into());
        }
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO calendar_events_v2 (source_id, title, start_at, end_at, all_day, color, meeting_url, location, created_at)
             VALUES ('local', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                trimmed,
                start,
                end,
                i64::from(all_day),
                color,
                meeting_url,
                location,
                now
            ],
        )
        .map_err(|e| format!("insert calendar_event failed: {e}"))?;
        let id = conn.last_insert_rowid();
        Ok(CalendarHubEvent {
            id,
            source_id: "local".into(),
            title: trimmed.to_string(),
            start: start.to_string(),
            end: end.to_string(),
            all_day,
            color: color.to_string(),
            meeting_url: meeting_url.map(ToString::to_string),
            location: location.map(ToString::to_string),
            read_only: false,
        })
    }

    pub fn calendar_hub_add_reminder(
        &self,
        title: &str,
        kind: &str,
        at: Option<&str>,
        repeat_rule: Option<&str>,
        prayer_anchor: Option<PrayerAnchorSpec>,
        importance: &str,
    ) -> Result<CalendarReminder, String> {
        let trimmed = title.trim();
        if trimmed.is_empty() {
            return Err("reminder title cannot be empty".into());
        }
        let now = Utc::now().to_rfc3339();
        let next_trig = initial_trigger_for_reminder(kind, at);
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let p_name = prayer_anchor.as_ref().map(|p| p.prayer.as_str());
        let p_off = prayer_anchor.as_ref().map(|p| p.offset_min);
        let p_rel = prayer_anchor.as_ref().map(|p| p.relation.as_str());
        conn.execute(
            "INSERT INTO calendar_reminders (title, kind, at, repeat_rule, prayer_name, prayer_offset_min, prayer_relation, importance, next_trigger_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![trimmed, kind, at, repeat_rule, p_name, p_off, p_rel, importance, next_trig, now],
        )
        .map_err(|e| format!("insert calendar_reminder failed: {e}"))?;
        let id = conn.last_insert_rowid();
        Ok(CalendarReminder {
            id,
            title: trimmed.to_string(),
            kind: kind.to_string(),
            at: at.map(ToString::to_string),
            repeat_rule: repeat_rule.map(ToString::to_string),
            prayer_anchor,
            snooze_count: 0,
            active: true,
            importance: importance.to_string(),
            missed: false,
            next_trigger_at: next_trig,
            created_at: now,
        })
    }

    pub fn calendar_hub_move_task_due(
        &self,
        id: i64,
        due_date: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "UPDATE calendar_tasks SET due_date = ?1 WHERE id = ?2",
            params![due_date, id],
        )
        .map_err(|e| format!("move calendar_task failed: {e}"))?;
        Ok(())
    }

    pub fn calendar_hub_delete_task(&self, id: i64) -> Result<Option<CalendarTask>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let existing: Option<CalendarTask> = conn
            .query_row(
                "SELECT id, title, due_date, due_time, estimate_min, done_at, client, project_id, is_deadline, created_at
                 FROM calendar_tasks WHERE id = ?1",
                params![id],
                |r| {
                    Ok(CalendarTask {
                        id: r.get(0)?,
                        title: r.get(1)?,
                        due_date: r.get(2)?,
                        due_time: r.get(3)?,
                        estimate_min: r.get(4)?,
                        done_at: r.get(5)?,
                        client: r.get(6)?,
                        project_id: r.get(7)?,
                        is_deadline: r.get::<_, i64>(8)? != 0,
                        created_at: r.get(9)?,
                    })
                },
            )
            .optional()
            .map_err(|e| format!("find calendar_task failed: {e}"))?;
        if existing.is_some() {
            conn.execute("DELETE FROM calendar_tasks WHERE id = ?1", params![id])
                .map_err(|e| format!("delete calendar_task failed: {e}"))?;
        }
        Ok(existing)
    }

    pub fn calendar_hub_restore_task(&self, task: &CalendarTask) -> Result<CalendarTask, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO calendar_tasks (title, due_date, due_time, estimate_min, done_at, client, project_id, is_deadline, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                task.title,
                task.due_date,
                task.due_time,
                task.estimate_min,
                task.done_at,
                task.client,
                task.project_id,
                i64::from(task.is_deadline),
                task.created_at
            ],
        )
        .map_err(|e| format!("restore calendar_task failed: {e}"))?;
        let mut restored = task.clone();
        restored.id = conn.last_insert_rowid();
        Ok(restored)
    }

    pub fn calendar_hub_set_focus_task(&self, task_id: Option<i64>) -> Result<Option<i64>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        if let Some(id) = task_id {
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO kv_state (key, value, updated_at) VALUES ('calendar_focus_task_id', ?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                params![id.to_string(), now],
            )
            .map_err(|e| format!("set focus task failed: {e}"))?;
        } else {
            conn.execute(
                "DELETE FROM kv_state WHERE key = 'calendar_focus_task_id'",
                [],
            )
            .map_err(|e| format!("clear focus task failed: {e}"))?;
        }
        Ok(task_id)
    }

    pub fn calendar_hub_complete_reminder(
        &self,
        id: i64,
        now_utc: DateTime<Utc>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let row: Option<(String, Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT kind, at, next_trigger_at FROM calendar_reminders WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()
            .map_err(|e| format!("query reminder failed: {e}"))?;
        let Some((kind, at, next_trig)) = row else {
            return Ok(());
        };
        if kind == "once" {
            conn.execute(
                "UPDATE calendar_reminders
                 SET active = 0, missed = 0, repeat_fired_once = 0, deferred_for_break = 0
                 WHERE id = ?1",
                params![id],
            )
            .map_err(|e| format!("complete once reminder failed: {e}"))?;
        } else {
            let base = next_trig
                .as_deref()
                .and_then(parse_datetime_utc_or_local)
                .or_else(|| at.as_deref().and_then(parse_datetime_utc_or_local))
                .unwrap_or(now_utc);
            let next_after = advance_occurrence_past(&kind, base, now_utc);
            conn.execute(
                "UPDATE calendar_reminders
                 SET missed = 0, repeat_fired_once = 0, last_fired_at = NULL, deferred_for_break = 0, next_trigger_at = ?1
                 WHERE id = ?2",
                params![next_after.map(|d| d.to_rfc3339()), id],
            )
            .map_err(|e| format!("advance recurring reminder failed: {e}"))?;
        }
        Ok(())
    }

    pub fn calendar_hub_snooze_reminder(
        &self,
        id: i64,
        minutes: i64,
        now_utc: DateTime<Utc>,
    ) -> Result<(), String> {
        let next = (now_utc + Duration::minutes(minutes.max(1))).to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "UPDATE calendar_reminders
             SET snooze_count = snooze_count + 1, missed = 0, repeat_fired_once = 0, last_fired_at = NULL, deferred_for_break = 0, next_trigger_at = ?1
             WHERE id = ?2",
            params![next, id],
        )
        .map_err(|e| format!("snooze reminder failed: {e}"))?;
        Ok(())
    }

    pub fn calendar_hub_dismiss_missed(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "UPDATE calendar_reminders SET missed = 0 WHERE missed = 1",
            [],
        )
        .map_err(|e| format!("dismiss missed reminders failed: {e}"))?;
        Ok(())
    }

    /// Evaluates due reminders against `now_utc`, honoring sleep recovery, 5-min repeat once -> missed,
    /// prayer anchor timestamps `prayer_map` (today/tomorrow prayer times in UTC), and Focus/call deferral.
    pub fn calendar_hub_poll_reminders(
        &self,
        now_utc: DateTime<Utc>,
        defer_normal: bool,
        prayer_utc_by_name: &[(String, DateTime<Utc>)],
    ) -> Result<CalendarPollResult, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, kind, at, repeat_rule, prayer_name, prayer_offset_min, prayer_relation,
                        snooze_count, active, importance, missed, next_trigger_at, repeat_fired_once, last_fired_at, deferred_for_break, created_at
                 FROM calendar_reminders WHERE active = 1",
            )
            .map_err(|e| format!("poll calendar_reminders failed: {e}"))?;

        #[allow(clippy::type_complexity)]
        let rows: Vec<(CalendarReminder, bool, Option<String>, bool)> = stmt
            .query_map([], |r| {
                let p_name: Option<String> = r.get(5)?;
                let p_off: Option<i64> = r.get(6)?;
                let p_rel: Option<String> = r.get(7)?;
                let prayer_anchor = match (p_name, p_off, p_rel) {
                    (Some(prayer), Some(offset_min), Some(relation)) => Some(PrayerAnchorSpec {
                        prayer,
                        offset_min,
                        relation,
                    }),
                    _ => None,
                };
                let rem = CalendarReminder {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    kind: r.get(2)?,
                    at: r.get(3)?,
                    repeat_rule: r.get(4)?,
                    prayer_anchor,
                    snooze_count: r.get(8)?,
                    active: r.get::<_, i64>(9)? != 0,
                    importance: r.get(10)?,
                    missed: r.get::<_, i64>(11)? != 0,
                    next_trigger_at: r.get(12)?,
                    created_at: r.get(16)?,
                };
                Ok((
                    rem,
                    r.get::<_, i64>(13)? != 0,
                    r.get::<_, Option<String>>(14)?,
                    r.get::<_, i64>(15)? != 0,
                ))
            })
            .map_err(|e| format!("map poll reminders failed: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("collect poll reminders failed: {e}"))?;
        drop(stmt);

        let mut due_alerts = Vec::new();
        let mut missed_reminders = Vec::new();

        for (mut rem, repeat_fired_once, last_fired_at, was_deferred) in rows {
            if rem.kind == "prayer"
                && rem.next_trigger_at.is_none()
                && let Some(ref anchor) = rem.prayer_anchor
                && let Some(resolved) = resolve_prayer_trigger_utc(anchor, prayer_utc_by_name)
            {
                let iso = resolved.to_rfc3339();
                conn.execute(
                    "UPDATE calendar_reminders SET next_trigger_at = ?1 WHERE id = ?2",
                    params![iso, rem.id],
                )
                .map_err(|e| format!("set prayer trigger failed: {e}"))?;
                rem.next_trigger_at = Some(iso);
            }

            if rem.missed {
                missed_reminders.push(rem);
                continue;
            }

            let Some(trig_dt) = rem
                .next_trigger_at
                .as_deref()
                .and_then(parse_datetime_utc_or_local)
            else {
                continue;
            };

            if now_utc < trig_dt {
                continue;
            }

            let is_urgent = rem.importance == "urgent";
            let last_dt = last_fired_at
                .as_deref()
                .and_then(parse_datetime_utc_or_local);

            match last_dt {
                None => {
                    // Missed while PC was asleep/off (> 15 min overdue without initial fire)
                    if now_utc.signed_duration_since(trig_dt) > Duration::minutes(15) {
                        let next_after = if rem.kind == "once" {
                            None
                        } else {
                            advance_occurrence_past(&rem.kind, trig_dt, now_utc)
                                .map(|d| d.to_rfc3339())
                        };
                        conn.execute(
                            "UPDATE calendar_reminders SET missed = 1, next_trigger_at = COALESCE(?1, next_trigger_at) WHERE id = ?2",
                            params![next_after, rem.id],
                        )
                        .map_err(|e| format!("mark missed sleep reminder failed: {e}"))?;
                        rem.missed = true;
                        missed_reminders.push(rem);
                    } else if defer_normal && !is_urgent {
                        if !was_deferred {
                            conn.execute(
                                "UPDATE calendar_reminders SET deferred_for_break = 1 WHERE id = ?1",
                                params![rem.id],
                            )
                            .map_err(|e| format!("defer reminder failed: {e}"))?;
                        }
                    } else {
                        let now_iso = now_utc.to_rfc3339();
                        conn.execute(
                            "UPDATE calendar_reminders SET last_fired_at = ?1, deferred_for_break = 0 WHERE id = ?2",
                            params![now_iso, rem.id],
                        )
                        .map_err(|e| format!("record initial fire failed: {e}"))?;
                        due_alerts.push(DueCalendarReminderAlert {
                            reminder: rem,
                            is_repeat: false,
                            was_deferred,
                        });
                    }
                }
                Some(prev_fire) => {
                    let since_fire = now_utc.signed_duration_since(prev_fire);
                    if !repeat_fired_once && since_fire >= Duration::minutes(5) {
                        if defer_normal && !is_urgent {
                            conn.execute(
                                "UPDATE calendar_reminders SET deferred_for_break = 1 WHERE id = ?1",
                                params![rem.id],
                            )
                            .map_err(|e| format!("defer repeat failed: {e}"))?;
                        } else {
                            let now_iso = now_utc.to_rfc3339();
                            conn.execute(
                                "UPDATE calendar_reminders SET repeat_fired_once = 1, last_fired_at = ?1, deferred_for_break = 0 WHERE id = ?2",
                                params![now_iso, rem.id],
                            )
                            .map_err(|e| format!("record repeat fire failed: {e}"))?;
                            due_alerts.push(DueCalendarReminderAlert {
                                reminder: rem,
                                is_repeat: true,
                                was_deferred,
                            });
                        }
                    } else if repeat_fired_once && since_fire >= Duration::minutes(5) {
                        let next_after = if rem.kind == "once" {
                            None
                        } else {
                            advance_occurrence_past(&rem.kind, trig_dt, now_utc)
                                .map(|d| d.to_rfc3339())
                        };
                        conn.execute(
                            "UPDATE calendar_reminders
                             SET missed = 1, repeat_fired_once = 0, last_fired_at = NULL, deferred_for_break = 0,
                                 next_trigger_at = COALESCE(?1, next_trigger_at)
                             WHERE id = ?2",
                            params![next_after, rem.id],
                        )
                        .map_err(|e| format!("mark unacked reminder missed failed: {e}"))?;
                        rem.missed = true;
                        missed_reminders.push(rem);
                    }
                }
            }
        }

        Ok(CalendarPollResult {
            due_alerts,
            missed_reminders,
        })
    }

    pub fn migrate_legacy_to_calendar_hub(&self) -> Result<LegacyMigrationReport, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        migrate_legacy_to_calendar_hub_for_conn(&conn, true)
    }

    pub fn calendar_hub_upsert_sync_source(
        &self,
        id: &str,
        provider: &str,
        account_label: &str,
        ics_url: Option<&str>,
    ) -> Result<CalendarSource, String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO calendar_sources (id, provider, account_label, ics_url, connected, created_at)
             VALUES (?1, ?2, ?3, ?4, 1, ?5)
             ON CONFLICT(id) DO UPDATE SET
                 provider = excluded.provider,
                 account_label = excluded.account_label,
                 ics_url = excluded.ics_url,
                 connected = 1,
                 last_error = NULL",
            params![id, provider, account_label, ics_url, now],
        )
        .map_err(|e| format!("upsert calendar_source failed: {e}"))?;
        conn.query_row(
            "SELECT id, provider, account_label, ics_url, last_synced_at, last_error, connected
             FROM calendar_sources WHERE id = ?1",
            params![id],
            |r| {
                Ok(CalendarSource {
                    id: r.get(0)?,
                    provider: r.get(1)?,
                    account_label: r.get(2)?,
                    ics_url: r.get(3)?,
                    last_synced_at: r.get(4)?,
                    last_error: r.get(5)?,
                    connected: r.get::<_, i64>(6)? != 0,
                })
            },
        )
        .map_err(|e| format!("read back calendar_source failed: {e}"))
    }

    pub fn calendar_hub_list_sync_sources(
        &self,
    ) -> Result<Vec<(CalendarSource, Option<String>)>, String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let mut stmt = conn
            .prepare(
                "SELECT id, provider, account_label, ics_url, last_synced_at, last_error, connected, sync_token
                 FROM calendar_sources WHERE connected = 1 ORDER BY created_at ASC",
            )
            .map_err(|e| format!("prepare sync sources failed: {e}"))?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    CalendarSource {
                        id: r.get(0)?,
                        provider: r.get(1)?,
                        account_label: r.get(2)?,
                        ics_url: r.get(3)?,
                        last_synced_at: r.get(4)?,
                        last_error: r.get(5)?,
                        connected: r.get::<_, i64>(6)? != 0,
                    },
                    r.get::<_, Option<String>>(7)?,
                ))
            })
            .map_err(|e| format!("query sync sources failed: {e}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("collect sync sources failed: {e}"))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn calendar_hub_apply_sync_result(
        &self,
        source_id: &str,
        events: &[SyncedEventInput],
        removed_external_ids: &[String],
        next_sync_token: Option<&str>,
        full_replace: bool,
        now: DateTime<Utc>,
        min_cache: DateTime<Utc>,
        max_cache: DateTime<Utc>,
    ) -> Result<usize, String> {
        let mut conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("begin sync tx failed: {e}"))?;

        if full_replace {
            tx.execute(
                "DELETE FROM calendar_events_v2 WHERE source_id = ?1",
                params![source_id],
            )
            .map_err(|e| format!("clear source events failed: {e}"))?;
        } else {
            for ext_id in removed_external_ids {
                tx.execute(
                    "DELETE FROM calendar_events_v2 WHERE source_id = ?1 AND external_id = ?2",
                    params![source_id, ext_id],
                )
                .map_err(|e| format!("delete removed event failed: {e}"))?;
            }
        }

        let now_iso = now.to_rfc3339();
        let mut stored = 0usize;
        for ev in events {
            let Some(start_dt) = parse_datetime_utc_or_local(&ev.start_at) else {
                continue;
            };
            let end_dt = parse_datetime_utc_or_local(&ev.end_at).unwrap_or(start_dt);
            if end_dt < min_cache || start_dt > max_cache {
                continue;
            }
            if !full_replace {
                tx.execute(
                    "DELETE FROM calendar_events_v2 WHERE source_id = ?1 AND external_id = ?2",
                    params![source_id, ev.external_id],
                )
                .map_err(|e| format!("replace existing synced event failed: {e}"))?;
            }
            tx.execute(
                "INSERT INTO calendar_events_v2
                 (source_id, external_id, title, start_at, end_at, all_day, color, meeting_url, location, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    source_id,
                    ev.external_id,
                    ev.title.trim(),
                    start_dt.to_rfc3339(),
                    end_dt.to_rfc3339(),
                    i64::from(ev.all_day),
                    ev.color,
                    ev.meeting_url,
                    ev.location,
                    now_iso,
                ],
            )
            .map_err(|e| format!("insert synced event failed: {e}"))?;
            stored += 1;
        }

        // Prune out-of-window (-14d..+60d) external cache rows for this source
        tx.execute(
            "DELETE FROM calendar_events_v2
             WHERE source_id = ?1 AND (start_at < ?2 OR start_at > ?3)",
            params![source_id, min_cache.to_rfc3339(), max_cache.to_rfc3339()],
        )
        .map_err(|e| format!("prune cache window failed: {e}"))?;

        tx.execute(
            "UPDATE calendar_sources
             SET sync_token = COALESCE(?1, sync_token),
                 last_synced_at = ?2,
                 last_error = NULL
             WHERE id = ?3",
            params![next_sync_token, now_iso, source_id],
        )
        .map_err(|e| format!("update source sync status failed: {e}"))?;

        tx.commit()
            .map_err(|e| format!("commit sync tx failed: {e}"))?;
        Ok(stored)
    }

    pub fn calendar_hub_record_sync_error(&self, source_id: &str, err: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "UPDATE calendar_sources SET last_error = ?1 WHERE id = ?2",
            params![err.trim(), source_id],
        )
        .map_err(|e| format!("record sync error failed: {e}"))?;
        Ok(())
    }

    pub fn calendar_hub_disconnect_source(&self, source_id: &str) -> Result<(), String> {
        if source_id == "local" {
            return Err("Local calendar cannot be disconnected".into());
        }
        let mut conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("begin disconnect tx failed: {e}"))?;
        tx.execute(
            "DELETE FROM calendar_events_v2 WHERE source_id = ?1",
            params![source_id],
        )
        .map_err(|e| format!("delete source events failed: {e}"))?;
        tx.execute(
            "DELETE FROM calendar_sources WHERE id = ?1",
            params![source_id],
        )
        .map_err(|e| format!("delete calendar_source failed: {e}"))?;
        tx.commit()
            .map_err(|e| format!("commit disconnect tx failed: {e}"))?;
        Ok(())
    }

    pub fn calendar_hub_delete_all_data(&self) -> Result<Vec<String>, String> {
        let mut conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        let external_ids: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT id FROM calendar_sources WHERE id != 'local'")
                .map_err(|e| format!("list external source ids failed: {e}"))?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(|e| format!("map external source ids failed: {e}"))?;
            rows.filter_map(Result::ok).collect()
        };
        let tx = conn
            .transaction()
            .map_err(|e| format!("begin delete_all tx failed: {e}"))?;
        for sql in [
            "DELETE FROM calendar_events_v2",
            "DELETE FROM calendar_tasks",
            "DELETE FROM calendar_reminders",
            "DELETE FROM focus_sessions",
            "DELETE FROM day_marks",
            "DELETE FROM calendar_sources WHERE id != 'local'",
            "DELETE FROM kv_state WHERE key = 'calendar_focus_task_id'",
        ] {
            tx.execute(sql, [])
                .map_err(|e| format!("delete_all step failed ({sql}): {e}"))?;
        }
        tx.commit()
            .map_err(|e| format!("commit delete_all tx failed: {e}"))?;
        Ok(external_ids)
    }

    pub fn calendar_hub_record_focus_session(
        &self,
        task_id: Option<i64>,
        kind: &str,
        duration_s: u32,
        completed: bool,
    ) -> Result<i64, String> {
        let now = Utc::now();
        let start = (now - Duration::seconds(i64::from(duration_s))).to_rfc3339();
        let end = now.to_rfc3339();
        let conn = self.conn.lock().map_err(|_| "storage lock poisoned")?;
        conn.execute(
            "INSERT INTO focus_sessions (task_id, start_at, end_at, kind, completed)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![task_id, start, end, kind, i64::from(completed)],
        )
        .map_err(|e| format!("record focus_session failed: {e}"))?;
        Ok(conn.last_insert_rowid())
    }
}

fn parse_datetime_utc_or_local(raw: &str) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(raw.trim()) {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(ndt) = NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%dT%H:%M:%S") {
        return ndt
            .and_local_timezone(Local)
            .single()
            .or_else(|| ndt.and_local_timezone(Local).earliest())
            .map(|l| l.with_timezone(&Utc));
    }
    None
}

fn initial_trigger_for_reminder(kind: &str, at: Option<&str>) -> Option<String> {
    if kind == "prayer" {
        return None;
    }
    at.and_then(parse_datetime_utc_or_local)
        .map(|dt| dt.to_rfc3339())
}

pub fn step_recurring_occurrence(kind: &str, from_utc: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let local_dt = from_utc.with_timezone(&Local);
    let time = local_dt.time();
    let date = local_dt.date_naive();
    let next_date = match kind {
        "daily" | "prayer" => date + Duration::days(1),
        "weekly" => date + Duration::days(7),
        "monthly" => {
            let (ny, nm) = if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            clamp_day_in_month_local(ny, nm, date.day())
        }
        _ => return None,
    };
    let next_naive = NaiveDateTime::new(next_date, time);
    next_naive
        .and_local_timezone(Local)
        .single()
        .or_else(|| next_naive.and_local_timezone(Local).earliest())
        .map(|d| d.with_timezone(&Utc))
}

fn clamp_day_in_month_local(year: i32, month: u32, dom: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let next_m = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let max_d = next_m.signed_duration_since(first).num_days() as u32;
    NaiveDate::from_ymd_opt(year, month, dom.min(max_d)).unwrap()
}

fn advance_occurrence_past(
    kind: &str,
    from_utc: DateTime<Utc>,
    now_utc: DateTime<Utc>,
) -> Option<DateTime<Utc>> {
    let mut cur = step_recurring_occurrence(kind, from_utc)?;
    let mut guard = 0usize;
    while cur <= now_utc && guard < 400 {
        cur = step_recurring_occurrence(kind, cur)?;
        guard += 1;
    }
    Some(cur)
}

pub fn resolve_prayer_trigger_utc(
    anchor: &PrayerAnchorSpec,
    prayer_utc_by_name: &[(String, DateTime<Utc>)],
) -> Option<DateTime<Utc>> {
    let (_, prayer_dt) = prayer_utc_by_name
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case(&anchor.prayer))?;
    let delta = Duration::minutes(anchor.offset_min.max(0));
    if anchor.relation == "after" {
        Some(*prayer_dt + delta)
    } else {
        Some(*prayer_dt - delta)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn computes_incremental_day_marks_and_recurrence_for_month() {
        let repo = StorageRepo::open_in_memory().expect("open memory repo");
        repo.calendar_hub_add_task(
            "Design review",
            Some("2026-11-26"),
            Some("14:30"),
            Some(25),
            false,
        )
        .expect("add task");
        repo.calendar_hub_add_task(
            "Tax filing",
            Some("2026-11-26"),
            Some("17:00"),
            Some(30),
            true,
        )
        .expect("add deadline");
        repo.calendar_hub_add_local_event(
            "Team standup",
            "2026-11-26T10:00:00",
            "2026-11-26T10:30:00",
            false,
            "#30d158",
            Some("https://meet.google.com/abc-defg-hij"),
            None,
        )
        .expect("add event");
        repo.calendar_hub_add_reminder(
            "Read 10 pages",
            "daily",
            Some("2026-11-25T21:00:00"),
            Some("Daily · 9:00 PM"),
            None,
            "normal",
        )
        .expect("add daily reminder");
        repo.calendar_hub_add_reminder(
            "Pay rent",
            "monthly",
            Some("2026-11-01T09:00:00"),
            Some("1st of month"),
            None,
            "normal",
        )
        .expect("add monthly reminder");

        let snap = repo.calendar_hub_snapshot(2026, 11).expect("snapshot");
        let nov26 = snap
            .day_marks
            .iter()
            .find(|m| m.date_key == "2026-11-26")
            .expect("nov 26 marks");
        assert_eq!(nov26.task_count, 1);
        assert_eq!(nov26.deadline_count, 1);
        assert_eq!(nov26.event_count, 1);
        assert_eq!(nov26.reminder_count, 1); // daily reminder starting Nov 25

        let nov1 = snap
            .day_marks
            .iter()
            .find(|m| m.date_key == "2026-11-01")
            .expect("nov 1 monthly mark");
        assert_eq!(nov1.reminder_count, 1);

        let dec = repo.calendar_hub_snapshot(2026, 12).expect("dec snapshot");
        let dec1 = dec
            .day_marks
            .iter()
            .find(|m| m.date_key == "2026-12-01")
            .expect("dec 1 monthly rollover");
        assert_eq!(dec1.reminder_count, 2); // monthly + daily
    }

    #[test]
    fn monthly_recurrence_clamps_month_ends_and_snoozes_cleanly() {
        let jan31 = Utc.with_ymd_and_hms(2026, 1, 31, 9, 0, 0).unwrap();
        let feb = step_recurring_occurrence("monthly", jan31).expect("feb step");
        assert_eq!(feb.with_timezone(&Local).date_naive().month(), 2);
        assert!(feb.with_timezone(&Local).date_naive().day() <= 29);

        let repo = StorageRepo::open_in_memory().expect("open repo");
        let task = repo
            .calendar_hub_add_task(
                "Draft spec",
                Some("2026-11-26"),
                Some("3:00 PM"),
                Some(25),
                false,
            )
            .expect("add");
        repo.calendar_hub_move_task_due(task.id, Some("2026-11-28"))
            .expect("move");
        let deleted = repo.calendar_hub_delete_task(task.id).expect("delete");
        assert_eq!(
            deleted.as_ref().and_then(|t| t.due_date.as_deref()),
            Some("2026-11-28")
        );
        let restored = repo
            .calendar_hub_restore_task(&deleted.expect("deleted"))
            .expect("restore");
        assert_eq!(restored.title, "Draft spec");
    }

    #[test]
    fn enforces_sleep_missed_repeat_once_deferral_and_prayer_schedule() {
        let repo = StorageRepo::open_in_memory().expect("open repo");

        let t_base = Utc.with_ymd_and_hms(2026, 11, 26, 10, 0, 0).unwrap();
        // Normal reminder due at 10:00
        let normal = repo
            .calendar_hub_add_reminder(
                "Call supplier",
                "once",
                Some(&t_base.to_rfc3339()),
                None,
                None,
                "normal",
            )
            .expect("add normal");
        // Urgent reminder due at 10:00
        let urgent = repo
            .calendar_hub_add_reminder(
                "Submit tax",
                "once",
                Some(&t_base.to_rfc3339()),
                None,
                None,
                "urgent",
            )
            .expect("add urgent");
        // Missed while PC off (due 30 min ago at 09:30)
        let missed_past = t_base - Duration::minutes(30);
        repo.calendar_hub_add_reminder(
            "Take vitamins",
            "once",
            Some(&missed_past.to_rfc3339()),
            None,
            None,
            "normal",
        )
        .expect("add missed sleep");

        // During Focus/call/fullscreen: urgent breaks through, normal defers, >15m overdue recovers as missed
        let p1 = repo
            .calendar_hub_poll_reminders(t_base, true, &[])
            .expect("poll 1");
        assert_eq!(p1.due_alerts.len(), 1);
        assert_eq!(p1.due_alerts[0].reminder.id, urgent.id);
        assert_eq!(p1.missed_reminders.len(), 1);
        assert_eq!(p1.missed_reminders[0].title, "Take vitamins");

        // Break begins (+1 min): deferred normal reminder wakes up cleanly
        let p2 = repo
            .calendar_hub_poll_reminders(t_base + Duration::minutes(1), false, &[])
            .expect("poll 2");
        assert_eq!(p2.due_alerts.len(), 1);
        assert_eq!(p2.due_alerts[0].reminder.id, normal.id);
        assert!(p2.due_alerts[0].was_deferred);

        // +5 min unacknowledged -> repeats once
        let p3 = repo
            .calendar_hub_poll_reminders(t_base + Duration::minutes(6), false, &[])
            .expect("poll 3");
        assert!(
            p3.due_alerts
                .iter()
                .any(|a| a.reminder.id == normal.id && a.is_repeat)
        );

        // +5 more min unacknowledged -> marked missed
        let p4 = repo
            .calendar_hub_poll_reminders(t_base + Duration::minutes(11), false, &[])
            .expect("poll 4");
        assert!(
            p4.missed_reminders
                .iter()
                .any(|r| r.id == normal.id && r.missed)
        );

        // Prayer-anchored reminder resolves cleanly 10 min before Maghrib
        let maghrib = Utc.with_ymd_and_hms(2026, 11, 26, 11, 11, 0).unwrap();
        let p_rem = repo
            .calendar_hub_add_reminder(
                "Review notes",
                "prayer",
                Some("2026-11-26"),
                None,
                Some(PrayerAnchorSpec {
                    prayer: "Maghrib".into(),
                    offset_min: 10,
                    relation: "before".into(),
                }),
                "normal",
            )
            .expect("add prayer rem");
        let p5 = repo
            .calendar_hub_poll_reminders(
                maghrib - Duration::minutes(10),
                false,
                &[("Maghrib".into(), maghrib)],
            )
            .expect("poll prayer");
        assert!(p5.due_alerts.iter().any(|a| a.reminder.id == p_rem.id));
    }

    #[test]
    fn migrates_legacy_tables_zero_loss_and_prunes_sync_cache() {
        let repo = StorageRepo::open_in_memory().expect("open memory");
        // Seed legacy data directly into old tables
        repo.add_planner_task(
            "Legacy Deadline",
            Some("2026-11-26T16:30:00Z".into()),
            45,
            Some("asr".into()),
            true,
            Some("2026-11-26T16:30:00Z".into()),
            Some("Acme".into()),
            "deadline",
        )
        .expect("legacy task");
        repo.add_calendar_event("Legacy Meeting", "2026-11-26T11:00:00Z")
            .expect("legacy event");
        repo.add_reminder("Legacy Alert", "2026-11-26T19:00:00Z", 10)
            .expect("legacy reminder");
        repo.with_connection(|conn| {
            conn.execute(
                "INSERT INTO pomodoro_sessions (kind, started_at, duration_s, completed)
                 VALUES ('focus', ?1, 1500, 1)",
                params![Utc::now().to_rfc3339()],
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        })
        .expect("legacy pom row");

        let report = repo
            .migrate_legacy_to_calendar_hub()
            .expect("migrate legacy");
        assert_eq!(report.migrated_tasks, 1);
        assert_eq!(report.migrated_events, 1);
        assert_eq!(report.migrated_reminders, 1);
        assert_eq!(report.migrated_focus_sessions, 1);
        // Second call is idempotent without forcing duplicates
        assert!(
            repo.calendar_hub_snapshot(2026, 11)
                .expect("snap")
                .tasks
                .iter()
                .any(|t| t.title == "Legacy Deadline" && t.is_deadline)
        );

        // External sync window pruning (-14d..+60d) & explicit disconnect cleanup
        let now = Utc.with_ymd_and_hms(2026, 11, 26, 10, 0, 0).unwrap();
        let min_w = now - Duration::days(14);
        let max_w = now + Duration::days(60);
        repo.calendar_hub_upsert_sync_source("gcal:primary", "google", "Google", None)
            .expect("upsert source");
        let kept = repo
            .calendar_hub_apply_sync_result(
                "gcal:primary",
                &[
                    SyncedEventInput {
                        external_id: "in-win".into(),
                        title: "Inside Window".into(),
                        start_at: (now + Duration::days(2)).to_rfc3339(),
                        end_at: (now + Duration::days(2) + Duration::minutes(30)).to_rfc3339(),
                        all_day: false,
                        color: "#30d158".into(),
                        meeting_url: None,
                        location: None,
                    },
                    SyncedEventInput {
                        external_id: "too-far".into(),
                        title: "Too Far Future".into(),
                        start_at: (now + Duration::days(90)).to_rfc3339(),
                        end_at: (now + Duration::days(90) + Duration::minutes(30)).to_rfc3339(),
                        all_day: false,
                        color: "#30d158".into(),
                        meeting_url: None,
                        location: None,
                    },
                ],
                &[],
                Some("tok-1"),
                false,
                now,
                min_w,
                max_w,
            )
            .expect("apply sync");
        assert_eq!(kept, 1);

        repo.calendar_hub_disconnect_source("gcal:primary")
            .expect("disconnect");
        let after_dc = repo.calendar_hub_snapshot(2026, 11).expect("snap after dc");
        assert!(after_dc.events.iter().all(|e| e.source_id == "local"));

        let cleared_ids = repo.calendar_hub_delete_all_data().expect("delete all");
        assert!(cleared_ids.is_empty());
        let after_del = repo
            .calendar_hub_snapshot(2026, 11)
            .expect("snap after del");
        assert!(after_del.tasks.is_empty());
        assert!(after_del.events.is_empty());
        assert!(after_del.reminders.is_empty());
    }
}

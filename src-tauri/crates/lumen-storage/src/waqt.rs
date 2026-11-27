use std::collections::HashMap;

use chrono::{DateTime, Local, NaiveTime, Timelike, Utc};
use serde::{Deserialize, Serialize};

use crate::{ActivityLogItem, CalendarEvent, TaskItem};

/// Prayer anchor boundary used to derive Waqt timeline blocks.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaqtAnchor {
    pub id: String,
    pub label: String,
    pub time_12h: String,
    pub minute_of_day: i32,
    pub passed: bool,
    pub is_next: bool,
}

/// Capacity status for a Waqt block (`free` >= 15m, `tight` 0..14m, `overbooked` < 0).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WaqtCapacityStatus {
    Free,
    Tight,
    Overbooked,
}

/// Computed slot placement for a task or calendar event inside a Waqt block.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaqtBlockItem {
    pub id: i64,
    pub title: String,
    pub kind: String,
    pub source: String,
    pub estimate_min: i64,
    pub done: bool,
    pub done_at: Option<String>,
    pub fixed: bool,
    pub start_at: Option<String>,
    pub slot_start_min: i32,
    pub slot_end_min: i32,
    pub client: Option<String>,
    pub calendar_event_id: Option<i64>,
    pub sort_order: i64,
}

/// Derived Waqt Block (not stored in SQLite; recomputed dynamically).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaqtBlockView {
    pub id: String,
    pub default_name: String,
    pub name: String,
    pub prayer_label: String,
    pub start_min: i32,
    pub end_min: i32,
    pub range_label: String,
    pub is_past: bool,
    pub is_current: bool,
    pub fill_ratio_pct: u8,
    pub remaining_min: i32,
    pub free_capacity_min: i32,
    pub used_capacity_min: i32,
    pub capacity_status: WaqtCapacityStatus,
    pub focus_minutes: i32,
    pub status_text: String,
    pub items: Vec<WaqtBlockItem>,
}

/// Full derived state for the Waqt Timeline page (`page 1` right after Home).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WaqtTimelineState {
    pub date_label: String,
    pub now_min: i32,
    pub rail_start_min: i32,
    pub rail_end_min: i32,
    pub sun_progress_pct: u8,
    pub is_friday: bool,
    pub is_ramadan: bool,
    pub sehri_min: i32,
    pub iftar_min: i32,
    pub location_configured: bool,
    pub active_block_id: String,
    pub next_prayer_name: String,
    pub next_prayer_in_min: i32,
    pub current_focus_task_id: Option<i64>,
    pub yesterday_rollover_count: usize,
    pub total_focus_min: i32,
    pub prayers_done_count: usize,
    pub water_today_ml: i64,
    pub focus_bars: Vec<u32>,
    pub blocks: Vec<WaqtBlockView>,
    pub unplanned: Vec<TaskItem>,
    pub activity_log: Vec<ActivityLogItem>,
}

pub struct WaqtComputeInput<'a> {
    pub now_utc: DateTime<Utc>,
    pub anchors: &'a [WaqtAnchor],
    pub tasks: &'a [TaskItem],
    pub calendar_events: &'a [CalendarEvent],
    pub activity_log: &'a [ActivityLogItem],
    pub custom_block_names: &'a HashMap<String, String>,
    pub bedtime_hhmm: &'a str,
    pub ramadan_taraweeh: bool,
    pub is_friday: bool,
    pub is_ramadan: bool,
    pub sehri_min: i32,
    pub iftar_min: i32,
    pub location_configured: bool,
    pub pomodoro_focus_min: i32,
    pub water_today_ml: i64,
    pub rollover_at_fajr: bool,
    pub current_focus_task_id: Option<i64>,
}

/// Parses `HH:MM` (24-hour) into minute-of-day, clamping cleanly.
#[must_use]
pub fn parse_hhmm_minutes(hhmm: &str, fallback: i32) -> i32 {
    let trimmed = hhmm.trim();
    if let Some((h_str, m_str)) = trimmed.split_once(':')
        && let (Ok(h), Ok(m)) = (h_str.parse::<i32>(), m_str.parse::<i32>())
        && (0..=23).contains(&h)
        && (0..=59).contains(&m)
    {
        return h * 60 + m;
    }
    fallback
}

/// Parses ISO RFC3339 or `HH:MM` into minute-of-day in local timezone.
#[must_use]
pub fn parse_event_minute_local(raw: &str) -> Option<i32> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        let local = dt.with_timezone(&Local);
        return Some((local.hour() as i32) * 60 + (local.minute() as i32));
    }
    if let Some((h_str, rest)) = trimmed.split_once(':')
        && let Ok(h) = h_str.trim().parse::<i32>()
    {
        let mins_digits: String = rest
            .trim()
            .chars()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        if let Ok(m) = mins_digits.parse::<i32>() {
            return Some((h.rem_euclid(24)) * 60 + m.clamp(0, 59));
        }
    }
    None
}

fn format_compact_clock(min_of_day: i32) -> String {
    let wrapped = min_of_day.rem_euclid(1440);
    let h24 = wrapped / 60;
    let m = wrapped % 60;
    let h12 = match h24 % 12 {
        0 => 12,
        other => other,
    };
    format!("{h12}:{m:02}")
}

fn format_short_duration(total_min: i32) -> String {
    let safe = total_min.max(0);
    let h = safe / 60;
    let m = safe % 60;
    if h > 0 && m > 0 {
        format!("{h}h {m}m")
    } else if h > 0 {
        format!("{h}h")
    } else {
        format!("{m}m")
    }
}

/// Counts unfinished local tasks created prior to today's rollover boundary.
#[must_use]
pub fn count_unfinished_yesterday_tasks(
    tasks: &[TaskItem],
    now_utc: DateTime<Utc>,
    fajr_min: i32,
    rollover_at_fajr: bool,
) -> usize {
    let local_now = now_utc.with_timezone(&Local);
    let now_min = (local_now.hour() as i32) * 60 + (local_now.minute() as i32);
    let rollover_min = if rollover_at_fajr { fajr_min } else { 0 };
    let mut today_date = local_now.date_naive();
    if now_min < rollover_min {
        today_date = today_date.pred_opt().unwrap_or(today_date);
    }
    let cutoff_naive = today_date.and_time(
        NaiveTime::from_hms_opt((rollover_min / 60) as u32, (rollover_min % 60) as u32, 0)
            .unwrap_or(NaiveTime::MIN),
    );
    let cutoff_utc = Local
        .from_local_datetime(&cutoff_naive)
        .single()
        .map_or(now_utc, |d| d.with_timezone(&Utc));

    tasks
        .iter()
        .filter(|t| {
            !t.done
                && t.block_id.is_some()
                && DateTime::parse_from_rfc3339(&t.created_at)
                    .map(|d| d.with_timezone(&Utc) < cutoff_utc)
                    .unwrap_or(false)
        })
        .count()
}

use chrono::TimeZone;

/// Computes live derived Waqt Blocks, auto-fit capacities, replay sparkline, and unplanned pool.
#[must_use]
pub fn compute_waqt_timeline(input: &WaqtComputeInput<'_>) -> WaqtTimelineState {
    let local_now = input.now_utc.with_timezone(&Local);
    let now_min = (local_now.hour() as i32) * 60 + (local_now.minute() as i32);
    let date_label = local_now.format("%a %-d %b").to_string();

    // Fixed-hour fallback if location is unset.
    let default_anchors = [
        WaqtAnchor {
            id: "fajr".into(),
            label: "Fajr".into(),
            time_12h: "5:00 AM".into(),
            minute_of_day: 300,
            passed: now_min >= 300,
            is_next: now_min < 300,
        },
        WaqtAnchor {
            id: "dhuhr".into(),
            label: if input.is_friday {
                "Jumu'ah".into()
            } else {
                "Dhuhr".into()
            },
            time_12h: "12:00 PM".into(),
            minute_of_day: 720,
            passed: now_min >= 720,
            is_next: (300..720).contains(&now_min),
        },
        WaqtAnchor {
            id: "asr".into(),
            label: "Asr".into(),
            time_12h: "3:45 PM".into(),
            minute_of_day: 945,
            passed: now_min >= 945,
            is_next: (720..945).contains(&now_min),
        },
        WaqtAnchor {
            id: "maghrib".into(),
            label: "Maghrib".into(),
            time_12h: "5:30 PM".into(),
            minute_of_day: 1050,
            passed: now_min >= 1050,
            is_next: (945..1050).contains(&now_min),
        },
        WaqtAnchor {
            id: "isha".into(),
            label: "Isha".into(),
            time_12h: "7:00 PM".into(),
            minute_of_day: 1140,
            passed: now_min >= 1140,
            is_next: (1050..1140).contains(&now_min),
        },
    ];

    let anchors: &[WaqtAnchor] = if input.location_configured && input.anchors.len() >= 5 {
        input.anchors
    } else {
        &default_anchors
    };

    let fajr_min = anchors[0].minute_of_day;
    let dhuhr_min = anchors[1].minute_of_day;
    let asr_min = anchors[2].minute_of_day;
    let maghrib_min = anchors[3].minute_of_day;
    let isha_min = anchors[4].minute_of_day;

    let mut bedtime_min = parse_hhmm_minutes(input.bedtime_hhmm, 23 * 60 + 30);
    if bedtime_min <= isha_min {
        bedtime_min += 1440;
    }

    let taraweeh_start = isha_min + 25;
    let mut specs: Vec<(&str, &str, String, i32, i32)> = vec![
        (
            "fajr",
            "Morning",
            format!("Fajr {}", format_compact_clock(fajr_min)),
            fajr_min,
            dhuhr_min,
        ),
        (
            "dhuhr",
            if input.is_friday { "Jumu'ah" } else { "Midday" },
            format!("{} {}", anchors[1].label, format_compact_clock(dhuhr_min)),
            dhuhr_min,
            asr_min,
        ),
        (
            "asr",
            "Afternoon",
            format!("Asr {}", format_compact_clock(asr_min)),
            asr_min,
            maghrib_min,
        ),
        (
            "maghrib",
            "Evening",
            format!("Maghrib {}", format_compact_clock(maghrib_min)),
            maghrib_min,
            isha_min,
        ),
    ];

    if input.is_ramadan && input.ramadan_taraweeh && bedtime_min > taraweeh_start + 30 {
        specs.push((
            "isha",
            "Night",
            format!("Isha {}", format_compact_clock(isha_min)),
            isha_min,
            taraweeh_start,
        ));
        specs.push((
            "taraweeh",
            "Taraweeh",
            format!("Taraweeh {}", format_compact_clock(taraweeh_start)),
            taraweeh_start,
            bedtime_min,
        ));
    } else {
        specs.push((
            "isha",
            "Night",
            format!("Isha {}", format_compact_clock(isha_min)),
            isha_min,
            bedtime_min,
        ));
    }

    let rail_start_min = fajr_min;
    let rail_end_min = bedtime_min.max(isha_min + 60);
    let effective_now = if now_min < fajr_min {
        now_min + 1440
    } else {
        now_min
    };

    // Map today's calendar events as fixed items into matching blocks.
    let today_ymd = local_now.date_naive();
    let mut calendar_items_by_block: HashMap<String, Vec<WaqtBlockItem>> = HashMap::new();
    for ev in input.calendar_events {
        if let Ok(dt) = DateTime::parse_from_rfc3339(&ev.start_at)
            && dt.with_timezone(&Local).date_naive() != today_ymd
        {
            continue;
        }
        let Some(mut ev_min) = parse_event_minute_local(&ev.start_at) else {
            continue;
        };
        if ev_min < fajr_min {
            ev_min += 1440;
        }
        if let Some((bid, _, _, _, b_end)) = specs
            .iter()
            .find(|(_, _, _, s, e)| ev_min >= *s && ev_min < *e)
            .or_else(|| specs.last())
        {
            let duration = 30.min((b_end - ev_min).max(15));
            calendar_items_by_block
                .entry((*bid).to_string())
                .or_default()
                .push(WaqtBlockItem {
                    id: -ev.id,
                    title: ev.title.clone(),
                    kind: "meeting".into(),
                    source: "calendar".into(),
                    estimate_min: i64::from(duration),
                    done: ev_min + duration <= effective_now,
                    done_at: None,
                    fixed: true,
                    start_at: Some(format_compact_clock(ev_min)),
                    slot_start_min: ev_min,
                    slot_end_min: ev_min + duration,
                    client: None,
                    calendar_event_id: Some(ev.id),
                    sort_order: i64::from(ev_min),
                });
        }
    }

    // Group focus logs by minute bucket so each block shows real logged focus minutes.
    let mut focus_minutes_total = 0i32;
    let mut focus_bins = vec![0u32; 10];
    let rail_span = (rail_end_min - rail_start_min).max(60);
    let mut block_focus_mins: HashMap<String, i32> = HashMap::new();

    for log in input.activity_log {
        if log.kind != "focus" {
            continue;
        }
        let Ok(st) = DateTime::parse_from_rfc3339(&log.start_at) else {
            continue;
        };
        let end_dt = log
            .end_at
            .as_deref()
            .and_then(|e| DateTime::parse_from_rfc3339(e).ok())
            .unwrap_or_else(|| input.now_utc.into());
        let dur_min = ((end_dt.timestamp() - st.timestamp()) / 60).clamp(1, 240) as i32;
        focus_minutes_total += dur_min;

        let local_st = st.with_timezone(&Local);
        let mut st_min = (local_st.hour() as i32) * 60 + (local_st.minute() as i32);
        if st_min < fajr_min {
            st_min += 1440;
        }
        let bin = (((st_min - rail_start_min).max(0) * 10) / rail_span).clamp(0, 9) as usize;
        focus_bins[bin] = focus_bins[bin].saturating_add(dur_min as u32);
        if let Some((bid, _, _, _, _)) = specs
            .iter()
            .find(|(_, _, _, s, e)| st_min >= *s && st_min < *e)
        {
            *block_focus_mins.entry((*bid).to_string()).or_insert(0) += dur_min;
        }
    }
    if focus_minutes_total == 0 && input.pomodoro_focus_min > 0 {
        focus_minutes_total = input.pomodoro_focus_min;
        let now_bin =
            (((effective_now - rail_start_min).max(0) * 10) / rail_span).clamp(0, 9) as usize;
        focus_bins[now_bin] = input.pomodoro_focus_min.max(0) as u32;
    }

    // Active block resolution
    let active_block_id = specs
        .iter()
        .find(|(_, _, _, s, e)| effective_now >= *s && effective_now < *e)
        .or_else(|| specs.first())
        .map(|(id, _, _, _, _)| (*id).to_string())
        .unwrap_or_else(|| "fajr".into());

    let mut blocks = Vec::with_capacity(specs.len());
    for (idx, (id, default_name, prayer_label, start_min, end_min)) in specs.iter().enumerate() {
        let block_id = (*id).to_string();
        let name = input
            .custom_block_names
            .get(&block_id)
            .filter(|n| !n.trim().is_empty())
            .cloned()
            .unwrap_or_else(|| (*default_name).to_string());

        let duration = (end_min - start_min).max(15);
        let is_past = effective_now >= *end_min;
        let is_current = block_id == active_block_id && !is_past && effective_now >= *start_min;
        let remaining_min = if is_past {
            0
        } else if is_current {
            (end_min - effective_now).max(0)
        } else {
            duration
        };

        let fill_ratio_pct = if is_past {
            100
        } else if is_current {
            (((effective_now - start_min) * 100) / duration).clamp(2, 100) as u8
        } else {
            0
        };

        // Gather assigned tasks & calendar meetings
        let mut fixed_items: Vec<WaqtBlockItem> = calendar_items_by_block
            .remove(&block_id)
            .unwrap_or_default();
        let mut flex_tasks: Vec<&TaskItem> = Vec::new();
        for task in input.tasks {
            if task.block_id.as_deref() != Some(id) {
                continue;
            }
            if task.fixed {
                let mut f_min = task
                    .start_at
                    .as_deref()
                    .and_then(parse_event_minute_local)
                    .unwrap_or(*start_min);
                if f_min < fajr_min {
                    f_min += 1440;
                }
                let est = task.estimate_min.clamp(5, 240) as i32;
                fixed_items.push(WaqtBlockItem {
                    id: task.id,
                    title: task.title.clone(),
                    kind: task.kind.clone(),
                    source: task.source.clone(),
                    estimate_min: i64::from(est),
                    done: task.done,
                    done_at: task.done_at.clone(),
                    fixed: true,
                    start_at: task.start_at.clone(),
                    slot_start_min: f_min,
                    slot_end_min: f_min + est,
                    client: task.client.clone(),
                    calendar_event_id: task.calendar_event_id,
                    sort_order: task.sort_order,
                });
            } else {
                flex_tasks.push(task);
            }
        }
        flex_tasks.sort_by_key(|t| (t.done, t.sort_order, t.id));
        fixed_items.sort_by_key(|i| i.slot_start_min);

        let fixed_used_min: i32 = fixed_items.iter().map(|i| i.estimate_min as i32).sum();
        let flex_used_min: i32 = flex_tasks
            .iter()
            .filter(|t| !t.done)
            .map(|t| (t.estimate_min.clamp(5, 240) as i32) + 5)
            .sum();

        // Auto-fit flexible tasks sequentially starting from block start or after current fixed items
        let mut cursor_min = (*start_min).max(if is_current {
            effective_now
        } else {
            *start_min
        });
        let mut placed_items = fixed_items;
        for task in &flex_tasks {
            let est = task.estimate_min.clamp(5, 240) as i32;
            while let Some(clash) = placed_items.iter().find(|p| {
                p.fixed && cursor_min < p.slot_end_min && cursor_min + est > p.slot_start_min
            }) {
                cursor_min = clash.slot_end_min + 5;
            }
            let slot_end = cursor_min + est;
            placed_items.push(WaqtBlockItem {
                id: task.id,
                title: task.title.clone(),
                kind: task.kind.clone(),
                source: task.source.clone(),
                estimate_min: i64::from(est),
                done: task.done,
                done_at: task.done_at.clone(),
                fixed: false,
                start_at: task.start_at.clone(),
                slot_start_min: cursor_min,
                slot_end_min: slot_end,
                client: task.client.clone(),
                calendar_event_id: task.calendar_event_id,
                sort_order: task.sort_order,
            });
            cursor_min = slot_end + 5;
        }
        placed_items.sort_by_key(|i| (i.done, i.slot_start_min, i.sort_order));

        let used_capacity_min = fixed_used_min + flex_used_min;
        let free_capacity_min = duration - used_capacity_min;
        let capacity_status = if free_capacity_min < 0 {
            WaqtCapacityStatus::Overbooked
        } else if free_capacity_min < 15 {
            WaqtCapacityStatus::Tight
        } else {
            WaqtCapacityStatus::Free
        };

        let block_focus = *block_focus_mins.get(&block_id).unwrap_or(&0);
        let range_label = if idx == specs.len() - 1 {
            format!("{} – bed", format_compact_clock(*start_min))
        } else {
            format!(
                "{} – {}",
                format_compact_clock(*start_min),
                format_compact_clock(*end_min)
            )
        };

        let status_text = if is_past {
            if block_focus > 0 {
                format!("Done · focus {}", format_short_duration(block_focus))
            } else {
                "Done".into()
            }
        } else if capacity_status == WaqtCapacityStatus::Overbooked {
            let next_label = specs
                .get(idx + 1)
                .and_then(|s| s.2.split_whitespace().next())
                .unwrap_or("end");
            format!("No room before {next_label}")
        } else if is_current {
            format!("{} left", format_short_duration(remaining_min))
        } else if placed_items.is_empty() {
            "Open".into()
        } else {
            format!("{} free", format_short_duration(free_capacity_min))
        };

        blocks.push(WaqtBlockView {
            id: block_id,
            default_name: (*default_name).to_string(),
            name,
            prayer_label: prayer_label.clone(),
            start_min: *start_min,
            end_min: *end_min,
            range_label,
            is_past,
            is_current,
            fill_ratio_pct,
            remaining_min,
            free_capacity_min,
            used_capacity_min,
            capacity_status,
            focus_minutes: block_focus,
            status_text,
            items: placed_items,
        });
    }

    let sun_progress_pct =
        (((effective_now - rail_start_min) * 100) / rail_span).clamp(0, 100) as u8;
    let next_anchor = anchors.iter().find(|a| !a.passed).unwrap_or(&anchors[0]);
    let next_prayer_in_min = if next_anchor.minute_of_day >= now_min {
        next_anchor.minute_of_day - now_min
    } else {
        (next_anchor.minute_of_day + 1440) - now_min
    };

    let prayers_done_count = input
        .activity_log
        .iter()
        .filter(|l| l.kind == "prayer")
        .map(|l| l.ref_id.as_deref().unwrap_or(""))
        .collect::<std::collections::HashSet<_>>()
        .len()
        .max(anchors.iter().filter(|a| a.passed).count());

    let unplanned: Vec<TaskItem> = input
        .tasks
        .iter()
        .filter(|t| t.block_id.is_none() && !t.done)
        .cloned()
        .collect();

    let yesterday_rollover_count = count_unfinished_yesterday_tasks(
        input.tasks,
        input.now_utc,
        fajr_min,
        input.rollover_at_fajr,
    );

    WaqtTimelineState {
        date_label,
        now_min: effective_now,
        rail_start_min,
        rail_end_min,
        sun_progress_pct,
        is_friday: input.is_friday,
        is_ramadan: input.is_ramadan,
        sehri_min: input.sehri_min,
        iftar_min: input.iftar_min,
        location_configured: input.location_configured,
        active_block_id,
        next_prayer_name: next_anchor.label.clone(),
        next_prayer_in_min,
        current_focus_task_id: input.current_focus_task_id,
        yesterday_rollover_count,
        total_focus_min: focus_minutes_total,
        prayers_done_count: prayers_done_count.min(5),
        water_today_ml: input.water_today_ml,
        focus_bars: focus_bins,
        blocks,
        unplanned,
        activity_log: input.activity_log.to_vec(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_anchors() -> Vec<WaqtAnchor> {
        vec![
            WaqtAnchor {
                id: "fajr".into(),
                label: "Fajr".into(),
                time_12h: "5:04 AM".into(),
                minute_of_day: 304,
                passed: true,
                is_next: false,
            },
            WaqtAnchor {
                id: "dhuhr".into(),
                label: "Dhuhr".into(),
                time_12h: "11:50 AM".into(),
                minute_of_day: 710,
                passed: true,
                is_next: false,
            },
            WaqtAnchor {
                id: "asr".into(),
                label: "Asr".into(),
                time_12h: "3:40 PM".into(),
                minute_of_day: 940,
                passed: false,
                is_next: true,
            },
            WaqtAnchor {
                id: "maghrib".into(),
                label: "Maghrib".into(),
                time_12h: "5:16 PM".into(),
                minute_of_day: 1036,
                passed: false,
                is_next: false,
            },
            WaqtAnchor {
                id: "isha".into(),
                label: "Isha".into(),
                time_12h: "6:35 PM".into(),
                minute_of_day: 1115,
                passed: false,
                is_next: false,
            },
        ]
    }

    #[test]
    fn computes_capacity_status_auto_fit_and_overbooked_detection() {
        let anchors = sample_anchors();
        let names = HashMap::new();
        let now = Utc::now();
        // Afternoon block: 3:40 PM (940) -> 5:16 PM (1036) = 96 mins total.
        // Put 2 tasks x 45 min + 2 x 5 min buffer = 100 mins -> overbooked (-4m).
        let tasks = vec![
            TaskItem {
                id: 1,
                title: "Deep work A".into(),
                done: false,
                due_at: None,
                created_at: now.to_rfc3339(),
                estimate_min: 45,
                block_id: Some("asr".into()),
                start_at: None,
                fixed: false,
                done_at: None,
                source: "local".into(),
                calendar_event_id: None,
                client: None,
                kind: "task".into(),
                sort_order: 1,
            },
            TaskItem {
                id: 2,
                title: "Deep work B".into(),
                done: false,
                due_at: None,
                created_at: now.to_rfc3339(),
                estimate_min: 45,
                block_id: Some("asr".into()),
                start_at: None,
                fixed: false,
                done_at: None,
                source: "local".into(),
                calendar_event_id: None,
                client: None,
                kind: "task".into(),
                sort_order: 2,
            },
            TaskItem {
                id: 3,
                title: "Unplanned item".into(),
                done: false,
                due_at: None,
                created_at: now.to_rfc3339(),
                estimate_min: 25,
                block_id: None,
                start_at: None,
                fixed: false,
                done_at: None,
                source: "local".into(),
                calendar_event_id: None,
                client: None,
                kind: "task".into(),
                sort_order: 3,
            },
        ];

        let state = compute_waqt_timeline(&WaqtComputeInput {
            now_utc: now,
            anchors: &anchors,
            tasks: &tasks,
            calendar_events: &[],
            activity_log: &[],
            custom_block_names: &names,
            bedtime_hhmm: "23:30",
            ramadan_taraweeh: false,
            is_friday: true,
            is_ramadan: false,
            sehri_min: 0,
            iftar_min: 0,
            location_configured: true,
            pomodoro_focus_min: 50,
            water_today_ml: 750,
            rollover_at_fajr: true,
            current_focus_task_id: Some(1),
        });

        assert_eq!(state.blocks.len(), 5);
        assert_eq!(state.blocks[1].name, "Jumu'ah");
        assert_eq!(
            state.blocks[2].capacity_status,
            WaqtCapacityStatus::Overbooked
        );
        assert_eq!(state.blocks[2].status_text, "No room before Maghrib");
        assert_eq!(state.unplanned.len(), 1);
        assert_eq!(state.unplanned[0].title, "Unplanned item");
    }
}

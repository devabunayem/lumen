use chrono::{Datelike, Duration, NaiveDate, Weekday};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPrayerAnchor {
    pub prayer: String,
    pub offset_min: i64,
    pub relation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedQuickAdd {
    pub title: String,
    pub target_kind: String, // "task" | "reminder"
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub is_deadline: bool,
    pub reminder_kind: String, // "once" | "daily" | "weekly" | "monthly" | "prayer"
    pub at: Option<String>,
    pub repeat_rule: Option<String>,
    pub prayer_anchor: Option<ParsedPrayerAnchor>,
    pub importance: String, // "normal" | "urgent"
    pub chip_label: String,
}

fn canonical_prayer(token: &str) -> Option<&'static str> {
    match token
        .trim_matches(|c: char| !c.is_alphanumeric())
        .to_ascii_lowercase()
        .as_str()
    {
        "fajr" | "fojor" | "fojr" => Some("Fajr"),
        "dhuhr" | "zuhr" | "zohor" | "johor" => Some("Dhuhr"),
        "asr" | "asor" | "asar" => Some("Asr"),
        "maghrib" | "magrib" | "magreb" => Some("Maghrib"),
        "isha" | "esha" | "isha'a" => Some("Isha"),
        _ => None,
    }
}

fn parse_ordinal_day(token: &str) -> Option<u32> {
    let lower = token.to_ascii_lowercase();
    let trimmed = lower
        .trim_end_matches("st")
        .trim_end_matches("nd")
        .trim_end_matches("rd")
        .trim_end_matches("th");
    trimmed.parse::<u32>().ok().filter(|d| (1..=31).contains(d))
}

fn format_display_12h(hour24: u32, min: u32) -> String {
    let suffix = if hour24 >= 12 { "PM" } else { "AM" };
    let h12 = if hour24.is_multiple_of(12) {
        12
    } else {
        hour24 % 12
    };
    format!("{h12}:{min:02} {suffix}")
}

fn parse_time_tokens(tokens: &[&str]) -> Option<(u32, u32, Vec<usize>)> {
    let period_hint = tokens.iter().position(|t| {
        matches!(
            t.to_ascii_lowercase().as_str(),
            "shokale" | "sokal" | "sokale" | "morning" | "am"
        )
    });
    let pm_hint = tokens.iter().position(|t| {
        matches!(
            t.to_ascii_lowercase().as_str(),
            "bikal"
                | "bikale"
                | "dupur"
                | "dupure"
                | "sondha"
                | "sondhay"
                | "raat"
                | "rat"
                | "evening"
                | "night"
                | "pm"
        )
    });

    // Pattern: "<num>[:min] [am/pm/tay/ta]"
    for (idx, raw) in tokens.iter().enumerate() {
        let lower = raw.to_ascii_lowercase();
        let next = tokens.get(idx + 1).map(|s| s.to_ascii_lowercase());

        // "5pm", "5:30pm", "10am"
        if lower.ends_with("am") || lower.ends_with("pm") {
            let is_pm = lower.ends_with("pm");
            let num_part = lower.trim_end_matches("am").trim_end_matches("pm");
            if let Some((h, m)) = parse_hh_or_hhmm(num_part, Some(is_pm)) {
                return Some((h, m, vec![idx]));
            }
        }

        // "9 tay" / "9 ta" / "5 pm" / "5 am"
        if let Some(ref nxt) = next {
            if matches!(nxt.as_str(), "am" | "pm")
                && let Some((h, m)) = parse_hh_or_hhmm(&lower, Some(nxt == "pm"))
            {
                let mut consumed = vec![idx, idx + 1];
                if let Some(p_idx) = period_hint {
                    consumed.push(p_idx);
                }
                if let Some(p_idx) = pm_hint {
                    consumed.push(p_idx);
                }
                return Some((h, m, consumed));
            }
            if matches!(nxt.as_str(), "tay" | "ta" | "baje") {
                let is_pm = pm_hint.map(|_| true).or_else(|| period_hint.map(|_| false));
                if let Some((h, m)) = parse_hh_or_hhmm(&lower, is_pm) {
                    let mut consumed = vec![idx, idx + 1];
                    if let Some(p_idx) = period_hint {
                        consumed.push(p_idx);
                    }
                    if let Some(p_idx) = pm_hint {
                        consumed.push(p_idx);
                    }
                    return Some((h, m, consumed));
                }
            }
        }

        // Explicit 24h HH:MM ("17:30")
        if lower.contains(':')
            && let Some((h, m)) = parse_hh_or_hhmm(&lower, None)
        {
            return Some((h, m, vec![idx]));
        }
    }
    None
}

fn parse_hh_or_hhmm(raw: &str, force_pm: Option<bool>) -> Option<(u32, u32)> {
    let (h_str, m_str) = if let Some((h, m)) = raw.split_once(':') {
        (h, m)
    } else {
        (raw, "0")
    };
    let mut h: u32 = h_str.parse().ok()?;
    let m: u32 = m_str.parse().ok()?;
    if h > 23 || m > 59 {
        return None;
    }
    match force_pm {
        Some(true) => {
            if (1..=11).contains(&h) {
                h += 12;
            }
        }
        Some(false) => {
            if h == 12 {
                h = 0;
            }
        }
        None => {
            if !raw.contains(':') {
                return None;
            }
        }
    }
    Some((h, m))
}

fn parse_weekday_token(token: &str) -> Option<Weekday> {
    match token.to_ascii_lowercase().as_str() {
        "mon" | "monday" | "sombar" => Some(Weekday::Mon),
        "tue" | "tues" | "tuesday" | "mongolbar" => Some(Weekday::Tue),
        "wed" | "wednesday" | "budhbar" => Some(Weekday::Wed),
        "thu" | "thurs" | "thursday" | "brihospotibar" => Some(Weekday::Thu),
        "fri" | "friday" | "shukrobar" | "jumuah" => Some(Weekday::Fri),
        "sat" | "saturday" | "shonibar" => Some(Weekday::Sat),
        "sun" | "sunday" | "robibar" => Some(Weekday::Sun),
        _ => None,
    }
}

fn weekday_short(wd: Weekday) -> &'static str {
    match wd {
        Weekday::Mon => "Mon",
        Weekday::Tue => "Tue",
        Weekday::Wed => "Wed",
        Weekday::Thu => "Thu",
        Weekday::Fri => "Fri",
        Weekday::Sat => "Sat",
        Weekday::Sun => "Sun",
    }
}

/// Parses an English or Banglish natural quick-add string into structured Task / Reminder metadata.
#[must_use]
pub fn parse_quick_add(raw: &str, today_ymd: &str, default_mode: &str) -> ParsedQuickAdd {
    let trimmed = raw.trim();
    let base_today = NaiveDate::parse_from_str(today_ymd, "%Y-%m-%d")
        .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2026, 11, 26).unwrap());
    let words: Vec<&str> = trimmed.split_whitespace().collect();
    let mut consumed = vec![false; words.len()];

    let mut is_deadline = false;
    let mut importance = "normal".to_string();
    let mut target_kind = if default_mode == "reminder" {
        "reminder".to_string()
    } else {
        "task".to_string()
    };

    for (i, w) in words.iter().enumerate() {
        let lw = w
            .trim_matches(|c: char| !c.is_alphanumeric())
            .to_ascii_lowercase();
        if matches!(lw.as_str(), "deadline" | "due" | "hardstop") {
            is_deadline = true;
            consumed[i] = true;
        } else if matches!(lw.as_str(), "urgent" | "joruri" | "asap") {
            importance = "urgent".to_string();
            consumed[i] = true;
        }
    }

    // 1. Check prayer-anchored phrase: "<N> min(s) before/after <prayer>" or "<prayer> er <N> min age/por"
    let mut prayer_anchor: Option<ParsedPrayerAnchor> = None;
    for i in 0..words.len() {
        if let Some(prayer) = canonical_prayer(words[i]) {
            let mut offset_min = 10i64;
            let mut relation = "before".to_string();
            consumed[i] = true;

            for j in 0..words.len() {
                let lw = words[j]
                    .trim_matches(|c: char| !c.is_alphanumeric())
                    .to_ascii_lowercase();
                if matches!(lw.as_str(), "before" | "age" | "agey") {
                    relation = "before".to_string();
                    consumed[j] = true;
                } else if matches!(lw.as_str(), "after" | "por" | "pore") {
                    relation = "after".to_string();
                    consumed[j] = true;
                } else if matches!(
                    lw.as_str(),
                    "min" | "mins" | "minute" | "minutes" | "m" | "er"
                ) {
                    consumed[j] = true;
                } else if (j < i || (j > i && (j - i) <= 3))
                    && let Ok(n) = lw.trim_end_matches('m').parse::<i64>()
                    && (0..=180).contains(&n)
                {
                    offset_min = n;
                    consumed[j] = true;
                }
            }
            prayer_anchor = Some(ParsedPrayerAnchor {
                prayer: prayer.to_string(),
                offset_min,
                relation,
            });
            target_kind = "reminder".to_string();
            break;
        }
    }

    // 2. Recurrence detection (daily, weekly, monthly)
    let mut reminder_kind = if prayer_anchor.is_some() {
        "prayer".to_string()
    } else {
        "once".to_string()
    };
    let mut repeat_rule: Option<String> = None;
    let mut due_date: Option<NaiveDate> = None;

    if prayer_anchor.is_none() {
        let lower_full = trimmed.to_ascii_lowercase();
        if lower_full.contains("every month") || lower_full.contains("monthly") {
            reminder_kind = "monthly".to_string();
            target_kind = "reminder".to_string();
            let mut dom = base_today.day();
            for (i, w) in words.iter().enumerate() {
                let lw = w.to_ascii_lowercase();
                if matches!(lw.as_str(), "every" | "month" | "monthly" | "on" | "the") {
                    consumed[i] = true;
                } else if let Some(d) = parse_ordinal_day(&lw) {
                    dom = d;
                    consumed[i] = true;
                }
            }
            let next_m_day = clamp_day_in_month(base_today.year(), base_today.month(), dom);
            due_date = Some(if next_m_day >= base_today {
                next_m_day
            } else {
                let (ny, nm) = if base_today.month() == 12 {
                    (base_today.year() + 1, 1)
                } else {
                    (base_today.year(), base_today.month() + 1)
                };
                clamp_day_in_month(ny, nm, dom)
            });
            repeat_rule = Some(format!("Monthly · Day {dom}"));
        } else if lower_full.contains("every day")
            || lower_full.contains("daily")
            || lower_full.contains("protidin")
        {
            reminder_kind = "daily".to_string();
            target_kind = "reminder".to_string();
            due_date = Some(base_today);
            for (i, w) in words.iter().enumerate() {
                let lw = w.to_ascii_lowercase();
                if matches!(lw.as_str(), "every" | "day" | "daily" | "protidin") {
                    consumed[i] = true;
                }
            }
            repeat_rule = Some("Daily".to_string());
        } else {
            // Check "every <weekday>" or "weekly"
            let mut found_every = false;
            let mut found_wd: Option<Weekday> = None;
            for (i, w) in words.iter().enumerate() {
                let lw = w.to_ascii_lowercase();
                if matches!(lw.as_str(), "every" | "weekly" | "protishoptaho") {
                    found_every = true;
                    consumed[i] = true;
                } else if let Some(wd) = parse_weekday_token(&lw) {
                    found_wd = Some(wd);
                    consumed[i] = true;
                }
            }
            if found_every || lower_full.contains("weekly") {
                reminder_kind = "weekly".to_string();
                target_kind = "reminder".to_string();
                let wd = found_wd.unwrap_or_else(|| base_today.weekday());
                due_date = Some(next_or_same_weekday(base_today, wd));
                repeat_rule = Some(format!("Weekly · {}", weekday_short(wd)));
            } else if let Some(wd) = found_wd {
                due_date = Some(next_or_same_weekday(base_today, wd));
            }
        }
    }

    // 3. Relative day ("today", "ajke", "tomorrow", "kal", "kal shokale ...")
    if due_date.is_none() {
        for (i, w) in words.iter().enumerate() {
            let lw = w.to_ascii_lowercase();
            if matches!(lw.as_str(), "today" | "ajke" | "aj") {
                due_date = Some(base_today);
                consumed[i] = true;
                break;
            }
            if matches!(
                lw.as_str(),
                "tomorrow" | "tmrw" | "kal" | "kalke" | "agamikal"
            ) {
                due_date = Some(base_today + Duration::days(1));
                consumed[i] = true;
                break;
            }
        }
    }

    // 4. Time parsing (English + Banglish)
    let time_res = if prayer_anchor.is_none() {
        parse_time_tokens(&words)
    } else {
        None
    };

    let (due_time, time_24_str, disp_time) = if let Some((h, m, idxs)) = time_res {
        for idx in idxs {
            if idx < consumed.len() {
                consumed[idx] = true;
            }
        }
        let t24 = format!("{h:02}:{m:02}");
        let d12 = format_display_12h(h, m);
        (Some(d12.clone()), Some(t24), Some(d12))
    } else {
        (None, None, None)
    };

    // Update daily/weekly repeat_rule text with time if present
    if let Some(ref d12) = disp_time
        && matches!(reminder_kind.as_str(), "daily" | "weekly" | "monthly")
        && let Some(ref mut rule) = repeat_rule
    {
        *rule = format!("{rule} · {d12}");
    }

    let resolved_date = due_date.unwrap_or(base_today);
    let date_key = resolved_date.format("%Y-%m-%d").to_string();
    let at_iso = if prayer_anchor.is_some() {
        Some(date_key.clone())
    } else if time_24_str.is_some() || due_date.is_some() {
        let hm = time_24_str.as_deref().unwrap_or("09:00");
        Some(format!("{date_key}T{hm}:00"))
    } else {
        None
    };

    // Reconstruct clean title preserving unconsumed tokens
    let mut title_words: Vec<&str> = words
        .iter()
        .enumerate()
        .filter_map(|(i, w)| if !consumed[i] { Some(*w) } else { None })
        .collect();
    // Strip trailing connector words like "at", "on" if dangling
    while let Some(&last) = title_words.last() {
        if matches!(
            last.to_ascii_lowercase().as_str(),
            "at" | "on" | "by" | "for" | "every"
        ) {
            title_words.pop();
        } else {
            break;
        }
    }
    let title = if title_words.is_empty() {
        trimmed.to_string()
    } else {
        title_words.join(" ")
    };

    let chip_label = if let Some(ref anchor) = prayer_anchor {
        format!(
            "{}m {} {}",
            anchor.offset_min, anchor.relation, anchor.prayer
        )
    } else if let Some(ref rr) = repeat_rule {
        rr.clone()
    } else {
        let day_tag = if resolved_date == base_today {
            "Today".to_string()
        } else if resolved_date == base_today + Duration::days(1) {
            "Tomorrow".to_string()
        } else {
            resolved_date.format("%a %d %b").to_string()
        };
        if let Some(ref d12) = disp_time {
            format!("{day_tag} · {d12}")
        } else {
            day_tag
        }
    };

    ParsedQuickAdd {
        title,
        target_kind,
        due_date: Some(date_key),
        due_time,
        is_deadline,
        reminder_kind,
        at: at_iso,
        repeat_rule,
        prayer_anchor,
        importance,
        chip_label,
    }
}

pub fn clamp_day_in_month(year: i32, month: u32, dom: u32) -> NaiveDate {
    let first = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let next_m = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    };
    let max_d = next_m.signed_duration_since(first).num_days() as u32;
    NaiveDate::from_ymd_opt(year, month, dom.min(max_d)).unwrap()
}

fn next_or_same_weekday(from: NaiveDate, target: Weekday) -> NaiveDate {
    let cur = from.weekday().num_days_from_sunday() as i64;
    let tgt = target.num_days_from_sunday() as i64;
    let diff = (tgt - cur + 7) % 7;
    from + Duration::days(diff)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_english_and_banglish_quick_add_phrases() {
        let p1 = parse_quick_add("call supplier 5pm", "2026-11-26", "task");
        assert_eq!(p1.title, "call supplier");
        assert_eq!(p1.due_date.as_deref(), Some("2026-11-26"));
        assert_eq!(p1.due_time.as_deref(), Some("5:00 PM"));

        let p2 = parse_quick_add("pay rent every month 1st", "2026-11-26", "reminder");
        assert_eq!(p2.title, "pay rent");
        assert_eq!(p2.reminder_kind, "monthly");
        assert_eq!(p2.due_date.as_deref(), Some("2026-12-01"));

        let p3 = parse_quick_add(
            "review notes 10 min before maghrib",
            "2026-11-26",
            "reminder",
        );
        assert_eq!(p3.title, "review notes");
        assert_eq!(p3.reminder_kind, "prayer");
        assert_eq!(
            p3.prayer_anchor,
            Some(ParsedPrayerAnchor {
                prayer: "Maghrib".into(),
                offset_min: 10,
                relation: "before".into(),
            })
        );

        let p4 = parse_quick_add("kal shokale 9 tay", "2026-11-26", "task");
        assert_eq!(p4.due_date.as_deref(), Some("2026-11-27"));
        assert_eq!(p4.due_time.as_deref(), Some("9:00 AM"));

        let p5 = parse_quick_add(
            "bikal 4 tay demo review deadline urgent",
            "2026-11-26",
            "task",
        );
        assert_eq!(p5.title, "demo review");
        assert_eq!(p5.due_time.as_deref(), Some("4:00 PM"));
        assert!(p5.is_deadline);
        assert_eq!(p5.importance, "urgent");
    }
}

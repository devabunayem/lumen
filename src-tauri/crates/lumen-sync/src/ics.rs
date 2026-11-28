use chrono::{DateTime, Duration, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};

use crate::NormalizedCalendarEvent;

/// Unfolds RFC 5545 folded content lines (`CRLF` / `LF` followed by single space or tab).
#[must_use]
pub fn unfold_ics_lines(raw: &str) -> Vec<String> {
    let mut unfolded = Vec::<String>::new();
    for line in raw.replace("\r\n", "\n").replace('\r', "\n").split('\n') {
        if let Some(rest) = line.strip_prefix(' ').or_else(|| line.strip_prefix('\t')) {
            if let Some(last) = unfolded.last_mut() {
                last.push_str(rest);
            }
        } else {
            unfolded.push(line.to_string());
        }
    }
    unfolded
}

fn unescape_ics_text(raw: &str) -> String {
    raw.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
}

fn parse_ics_timestamp(val: &str) -> Option<(String, bool)> {
    let clean = val.trim();
    // YYYYMMDD all-day
    if clean.len() == 8 && clean.chars().all(|c| c.is_ascii_digit()) {
        let d = NaiveDate::parse_from_str(clean, "%Y%m%d").ok()?;
        let ndt = d.and_hms_opt(0, 0, 0)?;
        let local_dt = Local
            .from_local_datetime(&ndt)
            .single()
            .or_else(|| Local.from_local_datetime(&ndt).earliest())?;
        return Some((local_dt.with_timezone(&Utc).to_rfc3339(), true));
    }
    // YYYYMMDDTHHMMSSZ (UTC)
    if clean.ends_with('Z')
        && let Ok(ndt) = NaiveDateTime::parse_from_str(clean, "%Y%m%dT%H%M%SZ")
    {
        return Some((
            DateTime::<Utc>::from_naive_utc_and_offset(ndt, Utc).to_rfc3339(),
            false,
        ));
    }
    // YYYYMMDDTHHMMSS (floating/local TZID)
    if let Ok(ndt) = NaiveDateTime::parse_from_str(clean, "%Y%m%dT%H%M%S") {
        let local_dt = Local
            .from_local_datetime(&ndt)
            .single()
            .or_else(|| Local.from_local_datetime(&ndt).earliest())?;
        return Some((local_dt.with_timezone(&Utc).to_rfc3339(), false));
    }
    None
}

fn parse_iso8601_duration_secs(raw: &str) -> Option<i64> {
    let s = raw.trim();
    if !s.starts_with('P') && !s.starts_with("-P") {
        return None;
    }
    let body = s.trim_start_matches('-').trim_start_matches('P');
    let mut total_secs = 0i64;
    let mut in_time = false;
    let mut num_buf = String::new();
    for ch in body.chars() {
        if ch == 'T' {
            in_time = true;
            continue;
        }
        if ch.is_ascii_digit() {
            num_buf.push(ch);
            continue;
        }
        let n = num_buf.parse::<i64>().unwrap_or(0);
        num_buf.clear();
        match (in_time, ch) {
            (false, 'W') => total_secs += n * 7 * 86_400,
            (false, 'D') => total_secs += n * 86_400,
            (true, 'H') => total_secs += n * 3_600,
            (true, 'M') => total_secs += n * 60,
            (true, 'S') => total_secs += n,
            _ => {}
        }
    }
    (total_secs > 0).then_some(total_secs)
}

fn extract_meeting_url(text: &str) -> Option<String> {
    for token in text.split_whitespace() {
        let clean = token.trim_matches(|c: char| matches!(c, '<' | '>' | '"' | '\'' | ',' | ';'));
        if (clean.starts_with("https://") || clean.starts_with("http://"))
            && (clean.contains("meet.google.com")
                || clean.contains("zoom.us")
                || clean.contains("teams.microsoft.com")
                || clean.contains("webex.com"))
        {
            return Some(clean.to_string());
        }
    }
    None
}

/// Parses VEVENT components from an RFC 5545 `.ics` feed into normalized events.
#[must_use]
pub fn parse_ics_events(raw_ics: &str, default_color: &str) -> Vec<NormalizedCalendarEvent> {
    let lines = unfold_ics_lines(raw_ics);
    let mut out = Vec::new();
    let mut in_event = false;

    let mut uid = String::new();
    let mut summary = String::new();
    let mut start_val: Option<(String, bool)> = None;
    let mut end_val: Option<(String, bool)> = None;
    let mut duration_secs: Option<i64> = None;
    let mut location: Option<String> = None;
    let mut meeting_url: Option<String> = None;
    let mut description: Option<String> = None;
    let mut cancelled = false;

    for line in lines {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case("BEGIN:VEVENT") {
            in_event = true;
            uid.clear();
            summary.clear();
            start_val = None;
            end_val = None;
            duration_secs = None;
            location = None;
            meeting_url = None;
            description = None;
            cancelled = false;
            continue;
        }
        if trimmed.eq_ignore_ascii_case("END:VEVENT") {
            if in_event
                && !cancelled
                && !summary.trim().is_empty()
                && let Some((start_iso, all_day)) = start_val.take()
            {
                let end_iso = if let Some((e, _)) = end_val.take() {
                    e
                } else if let Some(dur) = duration_secs {
                    DateTime::parse_from_rfc3339(&start_iso)
                        .map(|d| (d.with_timezone(&Utc) + Duration::seconds(dur)).to_rfc3339())
                        .unwrap_or_else(|_| start_iso.clone())
                } else if all_day {
                    DateTime::parse_from_rfc3339(&start_iso)
                        .map(|d| (d.with_timezone(&Utc) + Duration::days(1)).to_rfc3339())
                        .unwrap_or_else(|_| start_iso.clone())
                } else {
                    DateTime::parse_from_rfc3339(&start_iso)
                        .map(|d| (d.with_timezone(&Utc) + Duration::minutes(30)).to_rfc3339())
                        .unwrap_or_else(|_| start_iso.clone())
                };
                if meeting_url.is_none()
                    && let Some(ref desc) = description
                {
                    meeting_url = extract_meeting_url(desc);
                }
                if meeting_url.is_none()
                    && let Some(ref loc) = location
                {
                    meeting_url = extract_meeting_url(loc);
                }
                let ext_id = if uid.trim().is_empty() {
                    format!("ics:{summary}:{start_iso}")
                } else {
                    uid.trim().to_string()
                };
                out.push(NormalizedCalendarEvent {
                    external_id: ext_id,
                    title: unescape_ics_text(summary.trim()),
                    start_at: start_iso,
                    end_at: end_iso,
                    all_day,
                    color: default_color.to_string(),
                    meeting_url: meeting_url.take(),
                    location: location.take().map(|l| unescape_ics_text(l.trim())),
                    cancelled: false,
                });
            }
            in_event = false;
            continue;
        }
        if !in_event {
            continue;
        }
        let Some((key_raw, val)) = line.split_once(':') else {
            continue;
        };
        let key = key_raw
            .split(';')
            .next()
            .unwrap_or(key_raw)
            .trim()
            .to_ascii_uppercase();
        match key.as_str() {
            "UID" => uid = val.trim().to_string(),
            "SUMMARY" => summary = val.trim().to_string(),
            "DTSTART" => start_val = parse_ics_timestamp(val),
            "DTEND" => end_val = parse_ics_timestamp(val),
            "DURATION" => duration_secs = parse_iso8601_duration_secs(val),
            "LOCATION" if !val.trim().is_empty() => location = Some(val.trim().to_string()),
            "DESCRIPTION" if !val.trim().is_empty() => description = Some(val.trim().to_string()),
            "X-GOOGLE-CONFERENCE" => {
                if !val.trim().is_empty() {
                    meeting_url = Some(val.trim().to_string());
                }
            }
            "URL" if meeting_url.is_none() && !val.trim().is_empty() => {
                if let Some(found) = extract_meeting_url(val) {
                    meeting_url = Some(found);
                }
            }
            "STATUS" if val.trim().eq_ignore_ascii_case("CANCELLED") => {
                cancelled = true;
            }
            _ => {}
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_folded_ics_events_including_all_day_and_conference_links() {
        let ics = "\
BEGIN:VCALENDAR\r\n\
VERSION:2.0\r\n\
BEGIN:VEVENT\r\n\
UID:standup-1\r\n\
SUMMARY:Team stand\r\n up\r\n\
DTSTART:20261126T100000Z\r\n\
DTEND:20261126T103000Z\r\n\
DESCRIPTION:Join at https://meet.google.com/abc-defg-hij today\r\n\
LOCATION:Room 4B\\, Dhaka\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
UID:holiday-1\r\n\
SUMMARY:Design offsite\r\n\
DTSTART;VALUE=DATE:20261127\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\n\
UID:skip-cancelled\r\n\
SUMMARY:Old call\r\n\
DTSTART:20261126T120000Z\r\n\
STATUS:CANCELLED\r\n\
END:VEVENT\r\n\
END:VCALENDAR\r\n";

        let events = parse_ics_events(ics, "#30d158");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].title, "Team standup");
        assert_eq!(
            events[0].meeting_url.as_deref(),
            Some("https://meet.google.com/abc-defg-hij")
        );
        assert_eq!(events[0].location.as_deref(), Some("Room 4B, Dhaka"));
        assert!(!events[0].all_day);
        assert!(events[1].all_day);
        assert_eq!(events[1].title, "Design offsite");
    }
}

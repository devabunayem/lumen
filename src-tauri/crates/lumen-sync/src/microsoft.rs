use chrono::{DateTime, Duration, Utc};
use serde_json::Value;

use crate::keyring_store::OAuthTokenBundle;
use crate::oauth::{
    bind_loopback_listener, encode_form_params, generate_pkce_pair, http_get_text, http_post_text,
    open_browser_url, url_encode_component, wait_for_loopback_code,
};
use crate::{NormalizedCalendarEvent, SyncFetchResult, cache_window_bounds};

const MS_AUTH_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_DELTA_URL: &str = "https://graph.microsoft.com/v1.0/me/calendarView/delta";
const MS_EVENTS_URL: &str = "https://graph.microsoft.com/v1.0/me/events";

pub fn parse_microsoft_delta_json(
    body: &str,
    default_color: &str,
) -> Result<SyncFetchResult, String> {
    let json: Value =
        serde_json::from_str(body).map_err(|e| format!("Microsoft Graph JSON invalid: {e}"))?;
    let mut events = Vec::new();
    let mut removed_external_ids = Vec::new();

    if let Some(items) = json.get("value").and_then(Value::as_array) {
        for item in items {
            let ext_id = item
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .to_string();
            if ext_id.is_empty() {
                continue;
            }
            if item.get("@removed").is_some() {
                removed_external_ids.push(ext_id);
                continue;
            }
            let title = item
                .get("subject")
                .and_then(Value::as_str)
                .unwrap_or("Outlook event")
                .to_string();
            let start_raw = item
                .get("start")
                .and_then(|s| s.get("dateTime"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if start_raw.is_empty() {
                continue;
            }
            let normalize_dt = |raw: &str| {
                if raw.ends_with('Z') || raw.contains('+') {
                    raw.to_string()
                } else {
                    format!("{raw}Z")
                }
            };
            let start_at = normalize_dt(start_raw);
            let end_at = item
                .get("end")
                .and_then(|e| e.get("dateTime"))
                .and_then(Value::as_str)
                .map(normalize_dt)
                .unwrap_or_else(|| start_at.clone());
            let all_day = item
                .get("isAllDay")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let meeting_url = item
                .get("onlineMeeting")
                .and_then(|m| m.get("joinUrl"))
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .map(str::to_string);
            let location = item
                .get("location")
                .and_then(|l| l.get("displayName"))
                .and_then(Value::as_str)
                .filter(|s| !s.trim().is_empty())
                .map(str::to_string);

            events.push(NormalizedCalendarEvent {
                external_id: ext_id,
                title,
                start_at,
                end_at,
                all_day,
                color: default_color.to_string(),
                meeting_url,
                location,
                cancelled: false,
            });
        }
    }

    let next_sync_token = json
        .get("@odata.deltaLink")
        .and_then(Value::as_str)
        .map(str::to_string);

    Ok(SyncFetchResult {
        events,
        removed_external_ids,
        next_sync_token,
        full_replace: false,
    })
}

pub fn connect_microsoft_pkce(
    client_id: &str,
    write_scope: bool,
) -> Result<(OAuthTokenBundle, String), String> {
    let clean_client = client_id.trim();
    if clean_client.is_empty() {
        return Err(
            "Microsoft Client ID is required (enter yours in Calendar Sync settings)".into(),
        );
    }
    let (listener, port) = bind_loopback_listener()?;
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let pkce = generate_pkce_pair();
    let scope = if write_scope {
        "Calendars.ReadWrite offline_access"
    } else {
        "Calendars.Read offline_access"
    };

    let auth_url = format!(
        "{MS_AUTH_URL}?client_id={}&response_type=code&redirect_uri={}&response_mode=query&scope={}&code_challenge={}&code_challenge_method=S256&state={}",
        url_encode_component(clean_client),
        url_encode_component(&redirect_uri),
        url_encode_component(scope),
        url_encode_component(&pkce.challenge),
        url_encode_component(&pkce.state),
    );
    open_browser_url(&auth_url)?;
    let code = wait_for_loopback_code(listener, &pkce.state, 180)?;

    let body = encode_form_params(&[
        ("client_id", clean_client),
        ("scope", scope),
        ("code", &code),
        ("redirect_uri", &redirect_uri),
        ("grant_type", "authorization_code"),
        ("code_verifier", &pkce.verifier),
    ]);
    let resp = http_post_text(
        MS_TOKEN_URL,
        "application/x-www-form-urlencoded",
        &body,
        None,
    )?;
    if resp.status >= 400 {
        return Err(format!(
            "Microsoft token exchange failed ({}): {}",
            resp.status, resp.body
        ));
    }
    let json: Value =
        serde_json::from_str(&resp.body).map_err(|e| format!("Microsoft token json error: {e}"))?;
    let access_token = json["access_token"]
        .as_str()
        .ok_or_else(|| "Microsoft response missing access_token".to_string())?
        .to_string();
    let refresh_token = json["refresh_token"].as_str().map(str::to_string);
    let expires_in = json["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = (Utc::now() + Duration::seconds((expires_in - 60).max(60))).to_rfc3339();

    Ok((
        OAuthTokenBundle {
            access_token,
            refresh_token,
            expires_at_rfc3339: Some(expires_at),
            scope: Some(scope.to_string()),
        },
        "Outlook".to_string(),
    ))
}

pub fn refresh_microsoft_token(
    client_id: &str,
    bundle: &OAuthTokenBundle,
) -> Result<OAuthTokenBundle, String> {
    let refresh_token = bundle
        .refresh_token
        .as_deref()
        .ok_or_else(|| "Microsoft refresh token unavailable; reconnect account".to_string())?;
    let scope = bundle
        .scope
        .as_deref()
        .unwrap_or("Calendars.Read offline_access");
    let body = encode_form_params(&[
        ("client_id", client_id.trim()),
        ("scope", scope),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ]);
    let resp = http_post_text(
        MS_TOKEN_URL,
        "application/x-www-form-urlencoded",
        &body,
        None,
    )?;
    if resp.status >= 400 {
        return Err(format!(
            "Microsoft refresh failed ({}): {}",
            resp.status, resp.body
        ));
    }
    let json: Value = serde_json::from_str(&resp.body)
        .map_err(|e| format!("Microsoft refresh json error: {e}"))?;
    let access_token = json["access_token"]
        .as_str()
        .ok_or_else(|| "Microsoft refresh missing access_token".to_string())?
        .to_string();
    let expires_in = json["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = (Utc::now() + Duration::seconds((expires_in - 60).max(60))).to_rfc3339();
    Ok(OAuthTokenBundle {
        access_token,
        refresh_token: json["refresh_token"]
            .as_str()
            .map(str::to_string)
            .or_else(|| bundle.refresh_token.clone()),
        expires_at_rfc3339: Some(expires_at),
        scope: bundle.scope.clone(),
    })
}

pub fn sync_microsoft_events(
    access_token: &str,
    delta_link: Option<&str>,
    now: DateTime<Utc>,
) -> Result<SyncFetchResult, String> {
    let url = if let Some(link) = delta_link.filter(|s| !s.trim().is_empty()) {
        link.to_string()
    } else {
        let (min_dt, max_dt) = cache_window_bounds(now);
        format!(
            "{MS_DELTA_URL}?startDateTime={}&endDateTime={}",
            url_encode_component(&min_dt.to_rfc3339()),
            url_encode_component(&max_dt.to_rfc3339()),
        )
    };
    let resp = http_get_text(&url, Some(access_token))?;
    if resp.status == 410 && delta_link.is_some() {
        return sync_microsoft_events(access_token, None, now);
    }
    if resp.status >= 400 {
        return Err(format!(
            "Microsoft Graph sync failed (HTTP {})",
            resp.status
        ));
    }
    let mut parsed = parse_microsoft_delta_json(&resp.body, "#0a84ff")?;
    if delta_link.is_none() {
        parsed.full_replace = true;
    }
    Ok(parsed)
}

pub fn push_microsoft_task_event(
    access_token: &str,
    title: &str,
    start_rfc3339: &str,
    end_rfc3339: &str,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "subject": title,
        "body": { "contentType": "text", "content": "Created by Lumen Calendar Hub" },
        "start": { "dateTime": start_rfc3339, "timeZone": "UTC" },
        "end": { "dateTime": end_rfc3339, "timeZone": "UTC" },
    });
    let resp = http_post_text(
        MS_EVENTS_URL,
        "application/json",
        &payload.to_string(),
        Some(access_token),
    )?;
    if resp.status >= 400 {
        return Err(format!("Microsoft write-back failed ({})", resp.status));
    }
    let json: Value = serde_json::from_str(&resp.body).unwrap_or(Value::Null);
    Ok(json["id"].as_str().unwrap_or("created").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_microsoft_graph_delta_and_removed_markers() {
        let sample = r##"{
            "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=abc",
            "value": [
                {
                    "id": "ms-1",
                    "subject": "Client call",
                    "start": { "dateTime": "2026-11-26T18:30:00.0000000" },
                    "end": { "dateTime": "2026-11-26T19:00:00.0000000" },
                    "isAllDay": false,
                    "onlineMeeting": { "joinUrl": "https://teams.microsoft.com/l/meetup-join/123" },
                    "location": { "displayName": "Teams" }
                },
                {
                    "id": "ms-2",
                    "@removed": { "reason": "deleted" }
                }
            ]
        }"##;
        let parsed = parse_microsoft_delta_json(sample, "#0a84ff").expect("parse ms delta");
        assert!(
            parsed
                .next_sync_token
                .as_deref()
                .unwrap_or("")
                .contains("deltatoken=abc")
        );
        assert_eq!(parsed.events.len(), 1);
        assert_eq!(parsed.events[0].title, "Client call");
        assert_eq!(
            parsed.events[0].meeting_url.as_deref(),
            Some("https://teams.microsoft.com/l/meetup-join/123")
        );
        assert_eq!(parsed.removed_external_ids, vec!["ms-2".to_string()]);
    }
}

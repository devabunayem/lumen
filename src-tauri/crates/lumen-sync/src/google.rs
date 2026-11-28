use chrono::{DateTime, Duration, Utc};
use serde_json::Value;

use crate::keyring_store::OAuthTokenBundle;
use crate::oauth::{
    bind_loopback_listener, encode_form_params, generate_pkce_pair, http_get_text, http_post_text,
    open_browser_url, url_encode_component, wait_for_loopback_code,
};
use crate::{NormalizedCalendarEvent, SyncFetchResult, cache_window_bounds};

const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS_URL: &str = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

pub fn parse_google_events_json(
    body: &str,
    default_color: &str,
) -> Result<SyncFetchResult, String> {
    let json: Value =
        serde_json::from_str(body).map_err(|e| format!("Google Calendar JSON invalid: {e}"))?;
    let mut events = Vec::new();
    let mut removed_external_ids = Vec::new();

    if let Some(items) = json.get("items").and_then(Value::as_array) {
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
            if item.get("status").and_then(Value::as_str) == Some("cancelled") {
                removed_external_ids.push(ext_id);
                continue;
            }
            let title = item
                .get("summary")
                .and_then(Value::as_str)
                .unwrap_or("Calendar event")
                .to_string();
            let start_obj = item.get("start");
            let end_obj = item.get("end");
            let all_day = start_obj.and_then(|s| s.get("date")).is_some()
                && start_obj.and_then(|s| s.get("dateTime")).is_none();

            let start_at = start_obj
                .and_then(|s| s.get("dateTime").or_else(|| s.get("date")))
                .and_then(Value::as_str)
                .map(|s| {
                    if s.len() == 10 {
                        format!("{s}T00:00:00Z")
                    } else {
                        s.to_string()
                    }
                })
                .unwrap_or_default();
            if start_at.is_empty() {
                continue;
            }
            let end_at = end_obj
                .and_then(|e| e.get("dateTime").or_else(|| e.get("date")))
                .and_then(Value::as_str)
                .map(|s| {
                    if s.len() == 10 {
                        format!("{s}T00:00:00Z")
                    } else {
                        s.to_string()
                    }
                })
                .unwrap_or_else(|| start_at.clone());

            let meeting_url = item
                .get("hangoutLink")
                .and_then(Value::as_str)
                .map(str::to_string)
                .or_else(|| {
                    item.get("conferenceData")
                        .and_then(|cd| cd.get("entryPoints"))
                        .and_then(Value::as_array)
                        .and_then(|eps| {
                            eps.iter()
                                .find(|ep| {
                                    ep.get("entryPointType").and_then(Value::as_str)
                                        == Some("video")
                                })
                                .and_then(|ep| ep.get("uri").and_then(Value::as_str))
                                .map(str::to_string)
                        })
                });
            let location = item
                .get("location")
                .and_then(Value::as_str)
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
        .get("nextSyncToken")
        .and_then(Value::as_str)
        .map(str::to_string);

    Ok(SyncFetchResult {
        events,
        removed_external_ids,
        next_sync_token,
        full_replace: false,
    })
}

pub fn connect_google_pkce(
    client_id: &str,
    write_scope: bool,
) -> Result<(OAuthTokenBundle, String), String> {
    let clean_client = client_id.trim();
    if clean_client.is_empty() {
        return Err(
            "Google OAuth Client ID is required (enter yours in Calendar Sync settings)".into(),
        );
    }
    let (listener, port) = bind_loopback_listener()?;
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let pkce = generate_pkce_pair();
    let scope = if write_scope {
        "https://www.googleapis.com/auth/calendar.events"
    } else {
        "https://www.googleapis.com/auth/calendar.readonly"
    };

    let auth_url = format!(
        "{GOOGLE_AUTH_URL}?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&state={}&access_type=offline&prompt=consent",
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
        ("code", &code),
        ("code_verifier", &pkce.verifier),
        ("redirect_uri", &redirect_uri),
        ("grant_type", "authorization_code"),
    ]);
    let resp = http_post_text(
        GOOGLE_TOKEN_URL,
        "application/x-www-form-urlencoded",
        &body,
        None,
    )?;
    if resp.status >= 400 {
        return Err(format!(
            "Google token exchange failed ({}): {}",
            resp.status, resp.body
        ));
    }
    let json: Value =
        serde_json::from_str(&resp.body).map_err(|e| format!("Google token json error: {e}"))?;
    let access_token = json["access_token"]
        .as_str()
        .ok_or_else(|| "Google response missing access_token".to_string())?
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
        "Google".to_string(),
    ))
}

pub fn refresh_google_token(
    client_id: &str,
    bundle: &OAuthTokenBundle,
) -> Result<OAuthTokenBundle, String> {
    let refresh_token = bundle
        .refresh_token
        .as_deref()
        .ok_or_else(|| "Google refresh token unavailable; reconnect account".to_string())?;
    let body = encode_form_params(&[
        ("client_id", client_id.trim()),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ]);
    let resp = http_post_text(
        GOOGLE_TOKEN_URL,
        "application/x-www-form-urlencoded",
        &body,
        None,
    )?;
    if resp.status >= 400 {
        return Err(format!(
            "Google token refresh failed ({}): {}",
            resp.status, resp.body
        ));
    }
    let json: Value =
        serde_json::from_str(&resp.body).map_err(|e| format!("Google refresh json error: {e}"))?;
    let access_token = json["access_token"]
        .as_str()
        .ok_or_else(|| "Google refresh missing access_token".to_string())?
        .to_string();
    let expires_in = json["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = (Utc::now() + Duration::seconds((expires_in - 60).max(60))).to_rfc3339();
    Ok(OAuthTokenBundle {
        access_token,
        refresh_token: bundle.refresh_token.clone(),
        expires_at_rfc3339: Some(expires_at),
        scope: bundle.scope.clone(),
    })
}

pub fn sync_google_events(
    access_token: &str,
    sync_token: Option<&str>,
    now: DateTime<Utc>,
) -> Result<SyncFetchResult, String> {
    let url = if let Some(tok) = sync_token.filter(|s| !s.trim().is_empty()) {
        format!(
            "{GOOGLE_EVENTS_URL}?singleEvents=true&syncToken={}",
            url_encode_component(tok)
        )
    } else {
        let (min_dt, max_dt) = cache_window_bounds(now);
        format!(
            "{GOOGLE_EVENTS_URL}?singleEvents=true&maxResults=250&timeMin={}&timeMax={}",
            url_encode_component(&min_dt.to_rfc3339()),
            url_encode_component(&max_dt.to_rfc3339()),
        )
    };
    let resp = http_get_text(&url, Some(access_token))?;
    if resp.status == 410 && sync_token.is_some() {
        // RFC/Google 410 GONE invalidates incremental syncToken -> fall back to full -14d..+60d fetch
        return sync_google_events(access_token, None, now);
    }
    if resp.status >= 400 {
        return Err(format!("Google sync failed (HTTP {})", resp.status));
    }
    let mut parsed = parse_google_events_json(&resp.body, "#30d158")?;
    if sync_token.is_none() {
        parsed.full_replace = true;
    }
    Ok(parsed)
}

pub fn push_google_task_event(
    access_token: &str,
    title: &str,
    start_rfc3339: &str,
    end_rfc3339: &str,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "summary": title,
        "description": "Created by Lumen Calendar Hub",
        "start": { "dateTime": start_rfc3339 },
        "end": { "dateTime": end_rfc3339 },
    });
    let resp = http_post_text(
        GOOGLE_EVENTS_URL,
        "application/json",
        &payload.to_string(),
        Some(access_token),
    )?;
    if resp.status >= 400 {
        return Err(format!("Google write-back failed ({})", resp.status));
    }
    let json: Value = serde_json::from_str(&resp.body).unwrap_or(Value::Null);
    Ok(json["id"].as_str().unwrap_or("created").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_google_incremental_items_cancellations_and_sync_token() {
        let sample = r##"{
            "nextSyncToken": "sync-tok-99",
            "items": [
                {
                    "id": "g-1",
                    "summary": "Team standup",
                    "start": { "dateTime": "2026-11-26T10:00:00Z" },
                    "end": { "dateTime": "2026-11-26T10:30:00Z" },
                    "hangoutLink": "https://meet.google.com/abc-defg-hij",
                    "location": "Online"
                },
                {
                    "id": "g-2",
                    "status": "cancelled"
                }
            ]
        }"##;
        let parsed = parse_google_events_json(sample, "#30d158").expect("parse");
        assert_eq!(parsed.next_sync_token.as_deref(), Some("sync-tok-99"));
        assert_eq!(parsed.events.len(), 1);
        assert_eq!(parsed.events[0].title, "Team standup");
        assert_eq!(
            parsed.events[0].meeting_url.as_deref(),
            Some("https://meet.google.com/abc-defg-hij")
        );
        assert_eq!(parsed.removed_external_ids, vec!["g-2".to_string()]);
    }
}

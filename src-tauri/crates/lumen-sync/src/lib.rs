pub mod google;
pub mod ics;
pub mod keyring_store;
pub mod microsoft;
pub mod oauth;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::keyring_store::{OAuthTokenBundle, delete_tokens, load_tokens, save_tokens};
use crate::oauth::http_get_text;

pub const CACHE_PAST_DAYS: i64 = 14;
pub const CACHE_FUTURE_DAYS: i64 = 60;

#[must_use]
pub fn cache_window_bounds(now: DateTime<Utc>) -> (DateTime<Utc>, DateTime<Utc>) {
    (
        now - Duration::days(CACHE_PAST_DAYS),
        now + Duration::days(CACHE_FUTURE_DAYS),
    )
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedCalendarEvent {
    pub external_id: String,
    pub title: String,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub color: String,
    pub meeting_url: Option<String>,
    pub location: Option<String>,
    pub cancelled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFetchResult {
    pub events: Vec<NormalizedCalendarEvent>,
    pub removed_external_ids: Vec<String>,
    pub next_sync_token: Option<String>,
    pub full_replace: bool,
}

pub trait CalendarProvider {
    fn provider_id(&self) -> &'static str;
    fn sync(
        &self,
        source_id: &str,
        ics_url: Option<&str>,
        sync_token: Option<&str>,
        client_id: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<SyncFetchResult, String>;
    fn disconnect(&self, source_id: &str) -> Result<(), String>;
}

pub struct LocalProvider;
pub struct IcsProvider;
pub struct GoogleProvider;
pub struct MicrosoftProvider;

impl CalendarProvider for LocalProvider {
    fn provider_id(&self) -> &'static str {
        "local"
    }

    fn sync(
        &self,
        _source_id: &str,
        _ics_url: Option<&str>,
        sync_token: Option<&str>,
        _client_id: Option<&str>,
        _now: DateTime<Utc>,
    ) -> Result<SyncFetchResult, String> {
        Ok(SyncFetchResult {
            events: Vec::new(),
            removed_external_ids: Vec::new(),
            next_sync_token: sync_token.map(str::to_string),
            full_replace: false,
        })
    }

    fn disconnect(&self, _source_id: &str) -> Result<(), String> {
        Ok(())
    }
}

impl CalendarProvider for IcsProvider {
    fn provider_id(&self) -> &'static str {
        "ics"
    }

    fn sync(
        &self,
        _source_id: &str,
        ics_url: Option<&str>,
        _sync_token: Option<&str>,
        _client_id: Option<&str>,
        _now: DateTime<Utc>,
    ) -> Result<SyncFetchResult, String> {
        let raw_url = ics_url
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "ICS feed URL is empty".to_string())?;
        let http_url = if let Some(rest) = raw_url.strip_prefix("webcal://") {
            format!("https://{rest}")
        } else {
            raw_url.to_string()
        };
        if !http_url.starts_with("https://") && !http_url.starts_with("http://") {
            return Err("ICS URL must start with https:// or webcal://".into());
        }
        let resp = http_get_text(&http_url, None)?;
        if resp.status >= 400 {
            return Err(format!("ICS feed returned HTTP {}", resp.status));
        }
        let events = crate::ics::parse_ics_events(&resp.body, "#30d158");
        Ok(SyncFetchResult {
            events,
            removed_external_ids: Vec::new(),
            next_sync_token: None,
            full_replace: true,
        })
    }

    fn disconnect(&self, source_id: &str) -> Result<(), String> {
        delete_tokens(source_id)
    }
}

fn resolve_fresh_oauth_token(
    source_id: &str,
    client_id: Option<&str>,
    refresher: fn(&str, &OAuthTokenBundle) -> Result<OAuthTokenBundle, String>,
    now: DateTime<Utc>,
) -> Result<OAuthTokenBundle, String> {
    let bundle = load_tokens(source_id)?
        .ok_or_else(|| "Calendar account signed out; please reconnect".to_string())?;
    let needs_refresh = bundle
        .expires_at_rfc3339
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|exp| exp.with_timezone(&Utc) <= now + Duration::seconds(30))
        .unwrap_or(false);
    if !needs_refresh {
        return Ok(bundle);
    }
    let cid = client_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "OAuth Client ID missing; enter it in Settings to refresh".to_string())?;
    let next = refresher(cid, &bundle)?;
    save_tokens(source_id, &next)?;
    Ok(next)
}

impl CalendarProvider for GoogleProvider {
    fn provider_id(&self) -> &'static str {
        "google"
    }

    fn sync(
        &self,
        source_id: &str,
        _ics_url: Option<&str>,
        sync_token: Option<&str>,
        client_id: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<SyncFetchResult, String> {
        let token =
            resolve_fresh_oauth_token(source_id, client_id, google::refresh_google_token, now)?;
        google::sync_google_events(&token.access_token, sync_token, now)
    }

    fn disconnect(&self, source_id: &str) -> Result<(), String> {
        delete_tokens(source_id)
    }
}

impl CalendarProvider for MicrosoftProvider {
    fn provider_id(&self) -> &'static str {
        "microsoft"
    }

    fn sync(
        &self,
        source_id: &str,
        _ics_url: Option<&str>,
        sync_token: Option<&str>,
        client_id: Option<&str>,
        now: DateTime<Utc>,
    ) -> Result<SyncFetchResult, String> {
        let token = resolve_fresh_oauth_token(
            source_id,
            client_id,
            microsoft::refresh_microsoft_token,
            now,
        )?;
        microsoft::sync_microsoft_events(&token.access_token, sync_token, now)
    }

    fn disconnect(&self, source_id: &str) -> Result<(), String> {
        delete_tokens(source_id)
    }
}

pub fn sync_provider(
    provider: &str,
    source_id: &str,
    ics_url: Option<&str>,
    sync_token: Option<&str>,
    client_id: Option<&str>,
    now: DateTime<Utc>,
) -> Result<SyncFetchResult, String> {
    match provider {
        "local" => LocalProvider.sync(source_id, ics_url, sync_token, client_id, now),
        "ics" => IcsProvider.sync(source_id, ics_url, sync_token, client_id, now),
        "google" => GoogleProvider.sync(source_id, ics_url, sync_token, client_id, now),
        "microsoft" => MicrosoftProvider.sync(source_id, ics_url, sync_token, client_id, now),
        other => Err(format!("Unsupported calendar provider: {other}")),
    }
}

pub fn disconnect_provider(provider: &str, source_id: &str) -> Result<(), String> {
    match provider {
        "ics" => IcsProvider.disconnect(source_id),
        "google" => GoogleProvider.disconnect(source_id),
        "microsoft" => MicrosoftProvider.disconnect(source_id),
        _ => Ok(()),
    }
}

pub fn push_task_to_provider(
    provider: &str,
    source_id: &str,
    client_id: Option<&str>,
    title: &str,
    start_rfc3339: &str,
    end_rfc3339: &str,
) -> Result<String, String> {
    let now = Utc::now();
    match provider {
        "google" => {
            let tok =
                resolve_fresh_oauth_token(source_id, client_id, google::refresh_google_token, now)?;
            google::push_google_task_event(&tok.access_token, title, start_rfc3339, end_rfc3339)
        }
        "microsoft" => {
            let tok = resolve_fresh_oauth_token(
                source_id,
                client_id,
                microsoft::refresh_microsoft_token,
                now,
            )?;
            microsoft::push_microsoft_task_event(
                &tok.access_token,
                title,
                start_rfc3339,
                end_rfc3339,
            )
        }
        _ => Err(
            "Task write-back is supported only on connected Google or Microsoft accounts".into(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keyring_token_bundle_roundtrip_and_disconnect() {
        let src = "google-test-source";
        let bundle = OAuthTokenBundle {
            access_token: "ya29.test".into(),
            refresh_token: Some("1//refresh".into()),
            expires_at_rfc3339: Some((Utc::now() + Duration::hours(1)).to_rfc3339()),
            scope: Some("readonly".into()),
        };
        save_tokens(src, &bundle).expect("save token");
        let loaded = load_tokens(src).expect("load token");
        assert_eq!(loaded.as_ref(), Some(&bundle));
        disconnect_provider("google", src).expect("disconnect clears tokens");
        assert!(load_tokens(src).expect("load after disconnect").is_none());
    }
}

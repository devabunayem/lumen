use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "app.lumen.calendar";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthTokenBundle {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at_rfc3339: Option<String>,
    pub scope: Option<String>,
}

static MEMORY_FALLBACK: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn memory_store() -> &'static Mutex<HashMap<String, String>> {
    MEMORY_FALLBACK.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(windows)]
fn keyring_entry(source_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, source_id)
        .map_err(|e| format!("Windows Credential Manager init failed: {e}"))
}

pub fn save_tokens(source_id: &str, tokens: &OAuthTokenBundle) -> Result<(), String> {
    let serialized =
        serde_json::to_string(tokens).map_err(|e| format!("serialize tokens failed: {e}"))?;
    #[cfg(windows)]
    {
        if cfg!(test) {
            if let Ok(mut guard) = memory_store().lock() {
                guard.insert(source_id.to_string(), serialized);
            }
            return Ok(());
        }
        let entry = keyring_entry(source_id)?;
        entry
            .set_password(&serialized)
            .map_err(|e| format!("Credential Manager write failed: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        if let Ok(mut guard) = memory_store().lock() {
            guard.insert(source_id.to_string(), serialized);
        }
        Ok(())
    }
}

pub fn load_tokens(source_id: &str) -> Result<Option<OAuthTokenBundle>, String> {
    #[cfg(windows)]
    {
        if cfg!(test) {
            let raw = memory_store()
                .lock()
                .ok()
                .and_then(|g| g.get(source_id).cloned());
            return match raw {
                Some(v) => serde_json::from_str(&v)
                    .map(Some)
                    .map_err(|e| format!("token decode failed: {e}")),
                None => Ok(None),
            };
        }
        let entry = keyring_entry(source_id)?;
        match entry.get_password() {
            Ok(raw) => serde_json::from_str(&raw)
                .map(Some)
                .map_err(|e| format!("token decode failed: {e}")),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Credential Manager read failed: {e}")),
        }
    }
    #[cfg(not(windows))]
    {
        let raw = memory_store()
            .lock()
            .ok()
            .and_then(|g| g.get(source_id).cloned());
        match raw {
            Some(v) => serde_json::from_str(&v)
                .map(Some)
                .map_err(|e| format!("token decode failed: {e}")),
            None => Ok(None),
        }
    }
}

pub fn delete_tokens(source_id: &str) -> Result<(), String> {
    if let Ok(mut guard) = memory_store().lock() {
        guard.remove(source_id);
    }
    #[cfg(windows)]
    {
        if cfg!(test) {
            return Ok(());
        }
        let entry = keyring_entry(source_id)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Credential Manager delete failed: {e}")),
        }
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

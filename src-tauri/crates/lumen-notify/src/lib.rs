use serde::{Deserialize, Serialize};

/// Privacy filter settings for toast notification popups (`FR-NT-2`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NotificationPrivacyConfig {
    pub enabled: bool,
    pub hide_previews: bool,
    pub quiet_during_fullscreen: bool,
    pub respect_focus_assist: bool,
    pub allow_list: Vec<String>,
    pub deny_list: Vec<String>,
    pub masked_keywords: Vec<String>,
    pub suppress_native_toast: bool,
}

impl Default for NotificationPrivacyConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            hide_previews: false,
            quiet_during_fullscreen: true,
            respect_focus_assist: true,
            allow_list: Vec::new(),
            deny_list: Vec::new(),
            masked_keywords: vec![
                "OTP".into(),
                "PIN".into(),
                "CVV".into(),
                "bKash".into(),
                "Nagad".into(),
            ],
            suppress_native_toast: false,
        }
    }
}

/// Incoming toast notification payload sent to the frontend pill (`FR-NT-1`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NotificationPopup {
    pub id: u64,
    pub app_name: String,
    pub title: String,
    pub body: String,
}

/// Masks 4+ digit sensitive payment/OTP tokens and configured keywords (`FR-NT-2`).
#[must_use]
pub fn sanitize_body(body: &str, config: &NotificationPrivacyConfig) -> String {
    if config.hide_previews {
        return String::new();
    }
    let mut output = body.to_string();
    for keyword in &config.masked_keywords {
        if !keyword.is_empty() {
            output = output.replace(keyword, "••••");
        }
    }

    // Mask standalone 4-to-16 digit payment/OTP numbers when digit runs appear.
    let mut masked = String::with_capacity(output.len());
    let chars: Vec<char> = output.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_ascii_digit() {
            let start = i;
            while i < chars.len() && chars[i].is_ascii_digit() {
                i += 1;
            }
            let len = i - start;
            if len >= 4 {
                masked.push_str("••••");
            } else {
                for ch in &chars[start..i] {
                    masked.push(*ch);
                }
            }
        } else {
            masked.push(chars[i]);
            i += 1;
        }
    }
    masked
}

/// Applies allow/deny app filters, fullscreen/Focus Assist quiet rules, and preview sanitization.
#[must_use]
pub fn filter_notification(
    id: u64,
    app_name: &str,
    title: &str,
    body: &str,
    config: &NotificationPrivacyConfig,
    is_fullscreen: bool,
    focus_assist_quiet: bool,
) -> Option<NotificationPopup> {
    if !config.enabled {
        return None;
    }
    if config.quiet_during_fullscreen && is_fullscreen {
        return None;
    }
    if config.respect_focus_assist && focus_assist_quiet {
        return None;
    }

    let app_lower = app_name.trim().to_lowercase();
    if config
        .deny_list
        .iter()
        .any(|d| !d.trim().is_empty() && app_lower.contains(&d.trim().to_lowercase()))
    {
        return None;
    }
    if !config.allow_list.is_empty()
        && !config
            .allow_list
            .iter()
            .any(|a| !a.trim().is_empty() && app_lower.contains(&a.trim().to_lowercase()))
    {
        return None;
    }

    if config.hide_previews {
        return Some(NotificationPopup {
            id,
            app_name: app_name.to_string(),
            title: app_name.to_string(),
            body: "Notification received".to_string(),
        });
    }

    Some(NotificationPopup {
        id,
        app_name: app_name.to_string(),
        title: title.to_string(),
        body: sanitize_body(body, config),
    })
}

#[cfg(windows)]
mod platform {
    use windows::UI::Notifications::Management::{
        UserNotificationListener, UserNotificationListenerAccessStatus,
    };
    use windows::Win32::UI::Shell::{QUNS_ACCEPTS_NOTIFICATIONS, SHQueryUserNotificationState};

    /// Checks Windows Focus Assist / Presentation quiet state (`FR-NT-2`).
    #[must_use]
    pub fn is_focus_assist_quiet() -> bool {
        // SAFETY: Read-only shell notification state query.
        unsafe { SHQueryUserNotificationState() }
            .map(|state| state != QUNS_ACCEPTS_NOTIFICATIONS)
            .unwrap_or(false)
    }

    /// Safe runtime probe for WinRT `UserNotificationListener` package-identity support (`FR-NT-4`).
    #[must_use]
    pub fn listener_access_available() -> bool {
        let Ok(listener) = UserNotificationListener::Current() else {
            return false;
        };
        let Ok(op) = listener.RequestAccessAsync() else {
            return false;
        };
        matches!(op.join(), Ok(UserNotificationListenerAccessStatus::Allowed))
    }
}

#[cfg(not(windows))]
mod platform {
    #[must_use]
    pub const fn is_focus_assist_quiet() -> bool {
        false
    }

    #[must_use]
    pub const fn listener_access_available() -> bool {
        false
    }
}

pub use platform::{is_focus_assist_quiet, listener_access_available};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_sensitive_keywords_and_hides_previews() {
        let cfg = NotificationPrivacyConfig {
            hide_previews: false,
            masked_keywords: vec!["4242".to_string(), "OTP".to_string()],
            ..Default::default()
        };
        assert_eq!(
            sanitize_body("Your OTP for card 4242 is 918273", &cfg),
            "Your •••• for card •••• is ••••"
        );

        let hidden_cfg = NotificationPrivacyConfig {
            hide_previews: true,
            ..Default::default()
        };
        assert_eq!(sanitize_body("Secret OTP", &hidden_cfg), "");
    }

    #[test]
    fn enforces_allow_deny_and_quiet_rules() {
        let cfg = NotificationPrivacyConfig {
            deny_list: vec!["spam".into()],
            allow_list: vec!["slack".into(), "whatsapp".into()],
            ..Default::default()
        };
        assert!(filter_notification(1, "Slack", "Ping", "Hi", &cfg, true, false).is_none());
        assert!(filter_notification(2, "Slack", "Ping", "Hi", &cfg, false, true).is_none());
        assert!(filter_notification(3, "SpamApp", "Ad", "Buy", &cfg, false, false).is_none());
        assert!(filter_notification(4, "Discord", "Msg", "Yo", &cfg, false, false).is_none());
        let ok = filter_notification(5, "Slack", "Build passed", "OTP 8821", &cfg, false, false)
            .expect("allowed");
        assert_eq!(ok.body, "•••• ••••");
    }
}

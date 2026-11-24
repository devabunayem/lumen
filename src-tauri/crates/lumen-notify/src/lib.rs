use serde::{Deserialize, Serialize};

/// Privacy filter settings for toast notification popups (FR-NT-2).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct NotificationPrivacyConfig {
    pub hide_previews: bool,
    pub masked_keywords: Vec<String>,
}

/// Applies preview hiding or keyword masking before sending text to the UI.
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
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_sensitive_keywords_and_hides_previews() {
        let cfg = NotificationPrivacyConfig {
            hide_previews: false,
            masked_keywords: vec!["4242".to_string()],
        };
        assert_eq!(
            sanitize_body("Card ending 4242 charged", &cfg),
            "Card ending •••• charged"
        );

        let hidden_cfg = NotificationPrivacyConfig {
            hide_previews: true,
            masked_keywords: vec![],
        };
        assert_eq!(sanitize_body("Secret OTP", &hidden_cfg), "");
    }
}

use serde::{Deserialize, Serialize};

/// Snapshot of the currently active Windows SMTC media session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaSessionInfo {
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub is_playing: bool,
    pub position_secs: u64,
    pub duration_secs: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_media_session_info() {
        let info = MediaSessionInfo {
            app_id: "Spotify.exe".into(),
            title: "Dawn".into(),
            artist: "Lumen".into(),
            is_playing: true,
            position_secs: 12,
            duration_secs: 180,
        };
        assert!(info.is_playing);
        assert_eq!(info.duration_secs, 180);
    }
}

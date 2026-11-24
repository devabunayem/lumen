use serde::{Deserialize, Serialize};

pub const DEFAULT_MEDIA_ACCENT: &str = "#0A84FF";

/// Summary entry for multi-session switching (`FR-MUS-7`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaSessionSummary {
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub is_playing: bool,
}

/// Snapshot of the currently active Windows SMTC media session (`FR-MUS-1`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaSessionInfo {
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub album_title: String,
    pub is_playing: bool,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub album_art_data_url: Option<String>,
    pub accent_hex: String,
}

/// Full media state sent to the frontend over Tauri IPC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaStateSnapshot {
    pub active: Option<MediaSessionInfo>,
    pub sessions: Vec<MediaSessionSummary>,
    pub volume_percent: u8,
    pub muted: bool,
}

impl Default for MediaStateSnapshot {
    fn default() -> Self {
        Self {
            active: None,
            sessions: Vec::new(),
            volume_percent: 50,
            muted: false,
        }
    }
}

/// Playback control verbs (`FR-MUS-2`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaCommand {
    PlayPause,
    Next,
    Previous,
    ToggleMute,
}

impl MediaCommand {
    #[must_use]
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "play_pause" => Some(Self::PlayPause),
            "next" => Some(Self::Next),
            "previous" => Some(Self::Previous),
            "toggle_mute" => Some(Self::ToggleMute),
            _ => None,
        }
    }
}

/// Checks if a media session matches any entry in the user's auto-expand exclusions (`FR-MUS-5`).
#[must_use]
pub fn is_excluded_media_source(app_id: &str, title: &str, exclusions: &[String]) -> bool {
    let app_lower = app_id.to_lowercase();
    let title_lower = title.to_lowercase();
    exclusions.iter().any(|entry| {
        let needle = entry.trim().to_lowercase();
        !needle.is_empty() && (app_lower.contains(&needle) || title_lower.contains(&needle))
    })
}

fn srgb_channel_luminance(c: u8) -> f64 {
    let v = f64::from(c) / 255.0;
    if v <= 0.03928 {
        v / 12.92
    } else {
        ((v + 0.055) / 1.055).powf(2.4)
    }
}

fn relative_luminance(r: u8, g: u8, b: u8) -> f64 {
    0.2126 * srgb_channel_luminance(r)
        + 0.7152 * srgb_channel_luminance(g)
        + 0.0722 * srgb_channel_luminance(b)
}

/// Extracts a vibrant dominant RGB accent colour from RGBA pixel data with contrast safeguard
/// against Lumen's `#000000` island background (`FR-MUS-6`).
#[must_use]
pub fn extract_dominant_accent_from_rgba(rgba: &[u8]) -> String {
    if rgba.len() < 4 {
        return DEFAULT_MEDIA_ACCENT.to_string();
    }

    let mut best_score = 0.0f64;
    let mut best_rgb = None;

    for chunk in rgba.as_chunks::<4>().0.iter().step_by(4) {
        let (r, g, b, a) = (chunk[0], chunk[1], chunk[2], chunk[3]);
        if a < 180 {
            continue;
        }
        let max_c = r.max(g).max(b);
        let min_c = r.min(g).min(b);
        if max_c < 40 {
            continue;
        }
        let saturation = f64::from(max_c - min_c) / f64::from(max_c.max(1));
        let brightness = f64::from(max_c) / 255.0;
        let score = saturation * 2.0 + brightness * 0.6;
        if saturation > 0.18 && score > best_score {
            best_score = score;
            best_rgb = Some((r, g, b));
        }
    }

    let Some((mut r, mut g, mut b)) = best_rgb else {
        return DEFAULT_MEDIA_ACCENT.to_string();
    };

    // Contrast safeguard against pure black (#000000): ensure luminance >= 0.22 (>= 5.4:1 contrast).
    for _ in 0..8 {
        if relative_luminance(r, g, b) >= 0.22 {
            break;
        }
        r = r.saturating_add(((255 - r) / 4).max(8));
        g = g.saturating_add(((255 - g) / 4).max(8));
        b = b.saturating_add(((255 - b) / 4).max(8));
    }

    format!("#{r:02X}{g:02X}{b:02X}")
}

#[cfg(windows)]
mod platform {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use windows::Foundation::TimeSpan;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Storage::Streams::DataReader;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        IMMDeviceEnumerator, MMDeviceEnumerator, eConsole, eRender,
    };
    use windows::Win32::System::Com::{
        CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx,
    };
    use windows::core::GUID;

    use super::{
        DEFAULT_MEDIA_ACCENT, MediaCommand, MediaSessionInfo, MediaSessionSummary,
        MediaStateSnapshot, extract_dominant_accent_from_rgba,
    };

    fn get_sessions() -> Vec<GlobalSystemMediaTransportControlsSession> {
        let Ok(op) = GlobalSystemMediaTransportControlsSessionManager::RequestAsync() else {
            return Vec::new();
        };
        let Ok(manager) = op.join() else {
            return Vec::new();
        };
        let Ok(list) = manager.GetSessions() else {
            return Vec::new();
        };
        let mut sessions = Vec::new();
        if let Ok(count) = list.Size() {
            for idx in 0..count {
                if let Ok(item) = list.GetAt(idx) {
                    sessions.push(item);
                }
            }
        }
        sessions
    }

    fn pick_session<'a>(
        sessions: &'a [GlobalSystemMediaTransportControlsSession],
        preferred_app_id: Option<&str>,
    ) -> Option<&'a GlobalSystemMediaTransportControlsSession> {
        if let Some(pref) = preferred_app_id
            && let Some(found) = sessions.iter().find(|s| {
                s.SourceAppUserModelId()
                    .map(|id| id.to_string_lossy() == pref)
                    .unwrap_or(false)
            })
        {
            return Some(found);
        }
        sessions
            .iter()
            .find(|s| {
                s.GetPlaybackInfo()
                    .and_then(|p| p.PlaybackStatus())
                    .map(|st| {
                        st == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
                    })
                    .unwrap_or(false)
            })
            .or_else(|| sessions.first())
    }

    fn read_thumbnail(
        session: &GlobalSystemMediaTransportControlsSession,
    ) -> (Option<String>, String) {
        let Ok(op) = session.TryGetMediaPropertiesAsync() else {
            return (None, DEFAULT_MEDIA_ACCENT.to_string());
        };
        let Ok(props) = op.join() else {
            return (None, DEFAULT_MEDIA_ACCENT.to_string());
        };
        let Ok(thumb_ref) = props.Thumbnail() else {
            return (None, DEFAULT_MEDIA_ACCENT.to_string());
        };
        let Ok(stream_op) = thumb_ref.OpenReadAsync() else {
            return (None, DEFAULT_MEDIA_ACCENT.to_string());
        };
        let Ok(stream) = stream_op.join() else {
            return (None, DEFAULT_MEDIA_ACCENT.to_string());
        };
        let size = stream.Size().unwrap_or(0).min(1_500_000) as u32;
        if size == 0 {
            return (None, DEFAULT_MEDIA_ACCENT.to_string());
        }

        let mut accent = DEFAULT_MEDIA_ACCENT.to_string();
        if let Ok(dec_op) = BitmapDecoder::CreateAsync(&stream)
            && let Ok(decoder) = dec_op.join()
            && let Ok(px_op) = decoder.GetPixelDataAsync()
            && let Ok(px_provider) = px_op.join()
            && let Ok(pixels) = px_provider.DetachPixelData()
        {
            accent = extract_dominant_accent_from_rgba(pixels.as_slice());
        }

        let _ = stream.Seek(0);
        let Ok(reader) = DataReader::CreateDataReader(&stream) else {
            return (None, accent);
        };
        let Ok(load_op) = reader.LoadAsync(size) else {
            return (None, accent);
        };
        if load_op.join().is_err() {
            return (None, accent);
        }
        let mut bytes = vec![0u8; size as usize];
        if reader.ReadBytes(&mut bytes).is_err() {
            return (None, accent);
        }
        let mime = if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            "image/png"
        } else {
            "image/jpeg"
        };
        let encoded = STANDARD.encode(&bytes);
        (Some(format!("data:{mime};base64,{encoded}")), accent)
    }

    fn with_endpoint_volume<T>(f: impl FnOnce(&IAudioEndpointVolume) -> Option<T>) -> Option<T> {
        // SAFETY: Initializes COM apartment for current worker thread and queries default render endpoint.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
            let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
            f(&volume)
        }
    }

    #[must_use]
    pub fn get_system_volume() -> (u8, bool) {
        with_endpoint_volume(|vol| unsafe {
            let level = vol.GetMasterVolumeLevelScalar().ok()?;
            let muted = vol.GetMute().ok()?.as_bool();
            Some(((level.clamp(0.0, 1.0) * 100.0).round() as u8, muted))
        })
        .unwrap_or((50, false))
    }

    pub fn set_system_volume(percent: u8) -> Result<(), String> {
        let clamped = (f32::from(percent.min(100))) / 100.0;
        with_endpoint_volume(|vol| unsafe {
            vol.SetMasterVolumeLevelScalar(clamped, &GUID::zeroed())
                .ok()
        })
        .ok_or_else(|| "unable to access default audio endpoint".to_string())
    }

    pub fn toggle_system_mute() -> Result<(), String> {
        with_endpoint_volume(|vol| unsafe {
            let currently_muted = vol.GetMute().ok()?.as_bool();
            vol.SetMute(!currently_muted, &GUID::zeroed()).ok()
        })
        .ok_or_else(|| "unable to toggle system mute".to_string())
    }

    #[must_use]
    pub fn read_media_state(preferred_app_id: Option<&str>) -> MediaStateSnapshot {
        let sessions = get_sessions();
        let mut summaries = Vec::with_capacity(sessions.len());

        for session in &sessions {
            let app_id = session
                .SourceAppUserModelId()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let is_playing = session
                .GetPlaybackInfo()
                .and_then(|p| p.PlaybackStatus())
                .map(|st| st == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                .unwrap_or(false);
            let (title, artist) = session
                .TryGetMediaPropertiesAsync()
                .ok()
                .and_then(|op| op.join().ok())
                .map(|props| {
                    (
                        props
                            .Title()
                            .map(|t| t.to_string_lossy().to_string())
                            .unwrap_or_default(),
                        props
                            .Artist()
                            .map(|a| a.to_string_lossy().to_string())
                            .unwrap_or_default(),
                    )
                })
                .unwrap_or_default();

            if !title.is_empty() || !app_id.is_empty() {
                summaries.push(MediaSessionSummary {
                    app_id,
                    title,
                    artist,
                    is_playing,
                });
            }
        }

        let active = pick_session(&sessions, preferred_app_id).and_then(|session| {
            let app_id = session
                .SourceAppUserModelId()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let props = session.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
            let title = props
                .Title()
                .map(|t| t.to_string_lossy().to_string())
                .unwrap_or_default();
            let artist = props
                .Artist()
                .map(|a| a.to_string_lossy().to_string())
                .unwrap_or_default();
            let album_title = props
                .AlbumTitle()
                .map(|a| a.to_string_lossy().to_string())
                .unwrap_or_default();
            if title.is_empty() && artist.is_empty() {
                return None;
            }

            let is_playing = session
                .GetPlaybackInfo()
                .and_then(|p| p.PlaybackStatus())
                .map(|st| st == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
                .unwrap_or(false);

            let (position_ms, duration_ms) = session
                .GetTimelineProperties()
                .map(|tl| {
                    let pos = tl
                        .Position()
                        .map(|d| (d.Duration.max(0) / 10_000) as u64)
                        .unwrap_or(0);
                    let end = tl
                        .EndTime()
                        .map(|d| (d.Duration.max(0) / 10_000) as u64)
                        .unwrap_or(0);
                    (pos, end.max(pos))
                })
                .unwrap_or((0, 0));

            let (album_art_data_url, accent_hex) = read_thumbnail(session);

            Some(MediaSessionInfo {
                app_id,
                title,
                artist,
                album_title,
                is_playing,
                position_ms,
                duration_ms,
                album_art_data_url,
                accent_hex,
            })
        });

        let (volume_percent, muted) = get_system_volume();

        MediaStateSnapshot {
            active,
            sessions: summaries,
            volume_percent,
            muted,
        }
    }

    pub fn send_media_command(
        cmd: MediaCommand,
        preferred_app_id: Option<&str>,
    ) -> Result<(), String> {
        if cmd == MediaCommand::ToggleMute {
            return toggle_system_mute();
        }
        let sessions = get_sessions();
        let session = pick_session(&sessions, preferred_app_id).ok_or("no active media session")?;
        let op = match cmd {
            MediaCommand::PlayPause => session.TryTogglePlayPauseAsync(),
            MediaCommand::Next => session.TrySkipNextAsync(),
            MediaCommand::Previous => session.TrySkipPreviousAsync(),
            MediaCommand::ToggleMute => unreachable!(),
        }
        .map_err(|e| format!("SMTC command failed: {e}"))?;
        let _ = op.join();
        Ok(())
    }

    pub fn seek_media(position_ms: u64, preferred_app_id: Option<&str>) -> Result<(), String> {
        let sessions = get_sessions();
        let session = pick_session(&sessions, preferred_app_id).ok_or("no active media session")?;
        let ticks = (position_ms as i64).saturating_mul(10_000);
        let op = session
            .TryChangePlaybackPositionAsync(ticks)
            .map_err(|e| format!("SMTC seek failed: {e}"))?;
        let _ = op.join();
        let _ = TimeSpan { Duration: ticks };
        Ok(())
    }
}

#[cfg(not(windows))]
mod platform {
    use super::{MediaCommand, MediaStateSnapshot};

    #[must_use]
    pub fn get_system_volume() -> (u8, bool) {
        (50, false)
    }

    pub fn set_system_volume(_percent: u8) -> Result<(), String> {
        Ok(())
    }

    #[must_use]
    pub fn read_media_state(_preferred_app_id: Option<&str>) -> MediaStateSnapshot {
        MediaStateSnapshot::default()
    }

    pub fn send_media_command(
        _cmd: MediaCommand,
        _preferred_app_id: Option<&str>,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn seek_media(_position_ms: u64, _preferred_app_id: Option<&str>) -> Result<(), String> {
        Ok(())
    }
}

pub use platform::{
    get_system_volume, read_media_state, seek_media, send_media_command, set_system_volume,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_media_session_info() {
        let info = MediaSessionInfo {
            app_id: "Spotify.exe".into(),
            title: "Dawn".into(),
            artist: "Lumen".into(),
            album_title: "Horizons".into(),
            is_playing: true,
            position_ms: 12_000,
            duration_ms: 180_000,
            album_art_data_url: None,
            accent_hex: DEFAULT_MEDIA_ACCENT.into(),
        };
        assert!(info.is_playing);
        assert_eq!(info.duration_ms, 180_000);
    }

    #[test]
    fn matches_media_exclusions_case_insensitively() {
        let exclusions = vec!["youtube.com".into(), "Zoom.exe".into()];
        assert!(is_excluded_media_source(
            "msedge.exe",
            "Meeting - YouTube.com",
            &exclusions
        ));
        assert!(is_excluded_media_source("zoom.exe", "Call", &exclusions));
        assert!(!is_excluded_media_source(
            "Spotify.exe",
            "Lo-fi Beats",
            &exclusions
        ));
    }

    #[test]
    fn extracts_vivid_accent_with_contrast_safeguard() {
        // Dark red pixels should be lifted so contrast against #000000 remains readable.
        let mut dark_red = Vec::new();
        for _ in 0..32 {
            dark_red.extend_from_slice(&[80, 12, 16, 255]);
        }
        let hex = extract_dominant_accent_from_rgba(&dark_red);
        assert!(hex.starts_with('#'));
        assert_eq!(hex.len(), 7);
        assert_ne!(hex, "#500C10");

        // Monochrome pixels fall back safely to default blue accent.
        let gray = [120u8, 120, 120, 255].repeat(16);
        assert_eq!(
            extract_dominant_accent_from_rgba(&gray),
            DEFAULT_MEDIA_ACCENT
        );
    }
}

use serde::{Deserialize, Serialize};

pub mod sounds;

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

/// Single timestamped lyric line parsed from LRC (`FR-MUS-4`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

/// Parses `[mm:ss.xx]` or `[mm:ss.xxx]` synced LRC lines in chronological order.
#[must_use]
pub fn parse_lrc_lines(lrc: &str) -> Vec<LyricLine> {
    let mut lines = Vec::new();
    for raw in lrc.lines() {
        let trimmed = raw.trim();
        let Some(rest) = trimmed.strip_prefix('[') else {
            continue;
        };
        let Some((tag, text)) = rest.split_once(']') else {
            continue;
        };
        let Some((mm_str, ss_str)) = tag.split_once(':') else {
            continue;
        };
        let Ok(mins) = mm_str.parse::<u64>() else {
            continue;
        };
        let (sec_str, frac_str) = ss_str.split_once('.').unwrap_or((ss_str, "0"));
        let Ok(secs) = sec_str.parse::<u64>() else {
            continue;
        };
        let frac_ms = match frac_str.len() {
            0 => 0,
            1 => frac_str.parse::<u64>().unwrap_or(0) * 100,
            2 => frac_str.parse::<u64>().unwrap_or(0) * 10,
            _ => frac_str[..3].parse::<u64>().unwrap_or(0),
        };
        let line_text = text.trim();
        if !line_text.is_empty() {
            lines.push(LyricLine {
                time_ms: mins * 60_000 + secs * 1000 + frac_ms,
                text: line_text.to_string(),
            });
        }
    }
    lines.sort_by_key(|l| l.time_ms);
    lines
}

/// Finds the active lyric index for a playback position (`FR-MUS-4`).
#[must_use]
pub fn active_lyric_index(lines: &[LyricLine], position_ms: u64) -> Option<usize> {
    lines.iter().rposition(|line| line.time_ms <= position_ms)
}

/// Derives a clean display label from a Windows SMTC `SourceAppUserModelId`.
#[must_use]
pub fn friendly_media_app_label(app_id: &str) -> String {
    let lower = app_id.trim().to_ascii_lowercase();
    if lower.contains("chrome") {
        return "Google Chrome".into();
    }
    if lower.contains("msedge") {
        return "Microsoft Edge".into();
    }
    if lower.contains("firefox") {
        return "Firefox".into();
    }
    if lower.contains("brave") {
        return "Brave".into();
    }
    if lower.contains("spotify") {
        return "Spotify".into();
    }
    if lower.contains("vlc") {
        return "VLC Media Player".into();
    }
    if lower.contains("potplayer") {
        return "PotPlayer".into();
    }
    if lower.contains("mpv") {
        return "mpv".into();
    }
    if lower.contains("mpc-hc") || lower.contains("mpc-be") {
        return "Media Player Classic".into();
    }
    let tail = app_id
        .trim()
        .rsplit(['\\', '/', '!'])
        .next()
        .unwrap_or(app_id)
        .trim_end_matches(".exe")
        .trim_end_matches(".EXE");
    if tail.is_empty() {
        "Media Player".into()
    } else {
        tail.to_string()
    }
}

/// Computes continuous SMTC playback position using `LastUpdatedTime` so browser/video timelines
/// advance smoothly every second in real time even when a player only emits anchor timestamps.
#[must_use]
pub fn interpolate_smtc_position_ms(
    raw_pos_ms: u64,
    start_ms: u64,
    end_ms: u64,
    is_playing: bool,
    last_updated_universal_time: i64,
    now_filetime_100ns: i64,
) -> (u64, u64) {
    let base_pos = raw_pos_ms.saturating_sub(start_ms);
    let duration_raw = end_ms.saturating_sub(start_ms);
    let live_pos = if is_playing
        && last_updated_universal_time > 0
        && now_filetime_100ns > last_updated_universal_time
    {
        let elapsed_ms = ((now_filetime_100ns - last_updated_universal_time) / 10_000) as u64;
        // Guard against stale suspended sessions without duration bounds.
        let safe_elapsed = if duration_raw > 0 {
            elapsed_ms.min(duration_raw)
        } else {
            elapsed_ms.min(12 * 3600 * 1000)
        };
        let advanced = base_pos.saturating_add(safe_elapsed);
        if duration_raw > 0 {
            advanced.min(duration_raw)
        } else {
            advanced
        }
    } else {
        base_pos
    };
    (live_pos, duration_raw.max(live_pos))
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push_str("%20"),
            other => {
                use std::fmt::Write;
                let _ = write!(out, "%{other:02X}");
            }
        }
    }
    out
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

/// Extracts a vibrant dominant RGB accent colour from RGBA pixel data using quantized
/// hue-frequency clustering with contrast safeguard against `#000000` (`FR-MUS-6`).
#[must_use]
pub fn extract_dominant_accent_from_rgba(rgba: &[u8]) -> String {
    if rgba.len() < 4 {
        return DEFAULT_MEDIA_ACCENT.to_string();
    }

    // 8x8x8 quantized color buckets: (weighted_score, sum_r, sum_g, sum_b, count)
    let mut buckets: Vec<(f64, u64, u64, u64, u64)> = vec![(0.0, 0, 0, 0, 0); 512];
    let step = if rgba.len() > 4 * 16_384 { 4 } else { 1 };

    for chunk in rgba.as_chunks::<4>().0.iter().step_by(step) {
        let (r, g, b, a) = (chunk[0], chunk[1], chunk[2], chunk[3]);
        if a < 180 {
            continue;
        }
        let max_c = r.max(g).max(b);
        let min_c = r.min(g).min(b);
        if max_c < 42 {
            continue;
        }
        let saturation = f64::from(max_c - min_c) / f64::from(max_c.max(1));
        if saturation <= 0.18 {
            continue;
        }
        let brightness = f64::from(max_c) / 255.0;
        // Favor saturated, mid-bright dominant artwork colors over dark shadows or washed highlights.
        let weight = saturation * saturation * 2.4 + brightness * 0.55;
        let idx = (((r as usize) >> 5) << 6) | (((g as usize) >> 5) << 3) | ((b as usize) >> 5);
        let entry = &mut buckets[idx];
        entry.0 += weight;
        entry.1 += u64::from(r);
        entry.2 += u64::from(g);
        entry.3 += u64::from(b);
        entry.4 += 1;
    }

    let best_bucket = buckets
        .into_iter()
        .filter(|b| b.4 > 0)
        .max_by(|a, b| a.0.total_cmp(&b.0));

    let Some((_, sum_r, sum_g, sum_b, count)) = best_bucket else {
        return DEFAULT_MEDIA_ACCENT.to_string();
    };

    let mut r = (sum_r / count) as u8;
    let mut g = (sum_g / count) as u8;
    let mut b = (sum_b / count) as u8;

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
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use windows::Foundation::TimeSpan;
    use windows::Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Storage::Streams::DataReader;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        EDataFlow, IMMDeviceEnumerator, MMDeviceEnumerator, eCapture, eConsole, eRender,
    };
    use windows::Win32::System::Com::{
        CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx,
    };
    use windows::core::GUID;

    use super::{
        DEFAULT_MEDIA_ACCENT, MediaCommand, MediaSessionInfo, MediaSessionSummary,
        MediaStateSnapshot, extract_dominant_accent_from_rgba, friendly_media_app_label,
        interpolate_smtc_position_ms,
    };

    type ThumbnailCacheEntry = (String, Option<String>, String);
    static THUMB_CACHE: OnceLock<Mutex<Option<ThumbnailCacheEntry>>> = OnceLock::new();

    fn current_windows_filetime_100ns() -> i64 {
        let Ok(dur) = SystemTime::now().duration_since(UNIX_EPOCH) else {
            return 0;
        };
        let unix_100ns = (dur.as_secs() as i64)
            .saturating_mul(10_000_000)
            .saturating_add((dur.subsec_nanos() / 100) as i64);
        unix_100ns.saturating_add(116_444_736_000_000_000)
    }

    fn session_is_playing(session: &GlobalSystemMediaTransportControlsSession) -> bool {
        session
            .GetPlaybackInfo()
            .and_then(|p| p.PlaybackStatus())
            .map(|st| st == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
            .unwrap_or(false)
    }

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
                    && session_is_playing(s)
            })
        {
            return Some(found);
        }
        if let Some(playing) = sessions.iter().find(|s| session_is_playing(s)) {
            return Some(playing);
        }
        if let Some(pref) = preferred_app_id
            && let Some(found) = sessions.iter().find(|s| {
                s.SourceAppUserModelId()
                    .map(|id| id.to_string_lossy() == pref)
                    .unwrap_or(false)
            })
        {
            return Some(found);
        }
        sessions.first()
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
            && let Ok(mut pixels) = px_provider.DetachPixelData()
        {
            // Windows BitmapDecoder commonly yields BGRA8; swap B<->R into RGBA before extraction.
            if decoder.BitmapPixelFormat().ok() == Some(BitmapPixelFormat::Bgra8) {
                for chunk in pixels.as_chunks_mut::<4>().0 {
                    chunk.swap(0, 2);
                }
            }
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

    fn with_endpoint_volume_flow<T>(
        flow: EDataFlow,
        f: impl FnOnce(&IAudioEndpointVolume) -> Option<T>,
    ) -> Option<T> {
        // SAFETY: Initializes COM apartment for current worker thread and queries default endpoint.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
            let device = enumerator.GetDefaultAudioEndpoint(flow, eConsole).ok()?;
            let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None).ok()?;
            f(&volume)
        }
    }

    fn with_endpoint_volume<T>(f: impl FnOnce(&IAudioEndpointVolume) -> Option<T>) -> Option<T> {
        with_endpoint_volume_flow(eRender, f)
    }

    #[must_use]
    pub fn get_mic_muted() -> bool {
        with_endpoint_volume_flow(eCapture, |vol| unsafe {
            Some(vol.GetMute().ok()?.as_bool())
        })
        .unwrap_or(false)
    }

    pub fn toggle_mic_mute() -> Result<bool, String> {
        with_endpoint_volume_flow(eCapture, |vol| unsafe {
            let next = !vol.GetMute().ok()?.as_bool();
            vol.SetMute(next, &GUID::zeroed()).ok()?;
            Some(next)
        })
        .ok_or_else(|| "unable to access default microphone endpoint".to_string())
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
            let props = session
                .TryGetMediaPropertiesAsync()
                .ok()
                .and_then(|op| op.join().ok());
            let raw_title = props
                .as_ref()
                .and_then(|p| p.Title().ok())
                .map(|t| t.to_string_lossy().trim().to_string())
                .unwrap_or_default();
            let artist = props
                .as_ref()
                .and_then(|p| p.Artist().ok())
                .map(|a| a.to_string_lossy().trim().to_string())
                .unwrap_or_default();
            let album_title = props
                .as_ref()
                .and_then(|p| p.AlbumTitle().ok())
                .map(|a| a.to_string_lossy().trim().to_string())
                .unwrap_or_default();

            let is_playing = session_is_playing(session);
            let now_ft = current_windows_filetime_100ns();

            let (position_ms, duration_ms) = session
                .GetTimelineProperties()
                .map(|tl| {
                    let start = tl
                        .StartTime()
                        .map(|d| (d.Duration.max(0) / 10_000) as u64)
                        .unwrap_or(0);
                    let pos = tl
                        .Position()
                        .map(|d| (d.Duration.max(0) / 10_000) as u64)
                        .unwrap_or(0);
                    let end = tl
                        .EndTime()
                        .map(|d| (d.Duration.max(0) / 10_000) as u64)
                        .unwrap_or(0);
                    let updated_ut = tl.LastUpdatedTime().map(|dt| dt.UniversalTime).unwrap_or(0);
                    interpolate_smtc_position_ms(pos, start, end, is_playing, updated_ut, now_ft)
                })
                .unwrap_or((0, 0));

            let friendly = friendly_media_app_label(&app_id);
            let title = if !raw_title.is_empty() {
                raw_title
            } else if is_playing || duration_ms > 0 {
                friendly.clone()
            } else {
                return None;
            };
            let display_artist = if !artist.is_empty() { artist } else { friendly };

            let cache_key = format!("{app_id}::{title}::{display_artist}");
            let cached = THUMB_CACHE
                .get_or_init(|| Mutex::new(None))
                .lock()
                .ok()
                .and_then(|g| g.clone())
                .filter(|(k, _, _)| k == &cache_key);

            let (album_art_data_url, accent_hex) = if let Some((_, art, acc)) = cached {
                (art, acc)
            } else {
                let (art, acc) = read_thumbnail(session);
                // Only cache once Chrome/player has actually populated thumbnail artwork.
                if art.is_some()
                    && let Ok(mut guard) = THUMB_CACHE.get_or_init(|| Mutex::new(None)).lock()
                {
                    *guard = Some((cache_key, art.clone(), acc.clone()));
                }
                (art, acc)
            };

            Some(MediaSessionInfo {
                app_id,
                title,
                artist: display_artist,
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

    /// Fetches synced LRC lyrics from LRCLIB (`FR-MUS-4`).
    #[must_use]
    pub fn fetch_lrclib_lrc(artist: &str, title: &str) -> Option<String> {
        if title.trim().is_empty() {
            return None;
        }
        let url = format!(
            "https://lrclib.net/api/get?artist_name={}&track_name={}",
            super::percent_encode(artist.trim()),
            super::percent_encode(title.trim())
        );
        let uri = windows::Foundation::Uri::CreateUri(&windows::core::HSTRING::from(url)).ok()?;
        let client = windows::Web::Http::HttpClient::new().ok()?;
        let body = client
            .GetStringAsync(&uri)
            .ok()?
            .join()
            .ok()?
            .to_string_lossy()
            .to_string();
        let json: serde_json::Value = serde_json::from_str(&body).ok()?;
        json.get("syncedLyrics")
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(ToString::to_string)
    }
}

#[cfg(not(windows))]
mod platform {
    use super::{MediaCommand, MediaStateSnapshot};

    #[must_use]
    pub fn get_mic_muted() -> bool {
        false
    }

    pub fn toggle_mic_mute() -> Result<bool, String> {
        Ok(false)
    }

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

    #[must_use]
    pub fn fetch_lrclib_lrc(_artist: &str, _title: &str) -> Option<String> {
        None
    }
}

pub use platform::{
    fetch_lrclib_lrc, get_mic_muted, get_system_volume, read_media_state, seek_media,
    send_media_command, set_system_volume, toggle_mic_mute,
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

    #[test]
    fn parses_synced_lrc_and_tracks_active_line() {
        let lrc = "[00:01.50] First line\n[00:10.00] Second line\n[00:25.25] Third line";
        let lines = parse_lrc_lines(lrc);
        assert_eq!(lines.len(), 3);
        assert_eq!(active_lyric_index(&lines, 500), None);
        assert_eq!(active_lyric_index(&lines, 1500), Some(0));
        assert_eq!(active_lyric_index(&lines, 12_000), Some(1));
        assert_eq!(active_lyric_index(&lines, 30_000), Some(2));
    }

    #[test]
    fn interpolates_smtc_position_and_formats_browser_video_apps() {
        let base_ft = 134_000_000_000_000_000i64;
        // 5 seconds elapsed since anchor at 12s while playing -> 17s
        let (pos, dur) =
            interpolate_smtc_position_ms(12_000, 0, 180_000, true, base_ft, base_ft + 50_000_000);
        assert_eq!(pos, 17_000);
        assert_eq!(dur, 180_000);

        // Paused -> stays at anchor 12s
        let (paused_pos, _) =
            interpolate_smtc_position_ms(12_000, 0, 180_000, false, base_ft, base_ft + 50_000_000);
        assert_eq!(paused_pos, 12_000);

        assert_eq!(friendly_media_app_label("chrome.exe"), "Google Chrome");
        assert_eq!(friendly_media_app_label("vlc.exe"), "VLC Media Player");
        assert_eq!(friendly_media_app_label("MSEdge"), "Microsoft Edge");
    }
}

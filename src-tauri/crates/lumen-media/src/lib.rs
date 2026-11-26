use std::time::{Duration, Instant};

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

/// Detects canonical image MIME type from encoded thumbnail header bytes.
#[must_use]
pub fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        "image/png"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.starts_with(b"BM") {
        "image/bmp"
    } else {
        "image/jpeg"
    }
}

/// Computes a fast 64-bit FNV-1a fingerprint over encoded image bytes so thumbnail updates
/// during delayed browser hydration are detected cheaply without decoding unchanged frames.
#[must_use]
pub fn compute_thumbnail_fingerprint(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325 ^ (bytes.len() as u64);
    let step = (bytes.len() / 2048).max(1);
    for &b in bytes.iter().step_by(step) {
        hash ^= u64::from(b);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

/// Detects symmetric vertical `#000000` letterboxing (common in YouTube `4:3` `hqdefault` thumbs)
/// and returns `(top_trim_rows, kept_height)` when both top and bottom bars are present.
#[must_use]
pub fn detect_vertical_letterbox(rgba: &[u8], width: u32, height: u32) -> Option<(u32, u32)> {
    let w = usize::try_from(width).ok()?;
    let h = usize::try_from(height).ok()?;
    if w < 64 || h < 48 || rgba.len() < w.saturating_mul(h).saturating_mul(4) {
        return None;
    }

    let row_stride = w * 4;
    let col_step = (w / 24).max(1);
    let is_black_row = |row: usize| -> bool {
        let base = row * row_stride;
        let mut sampled = 0usize;
        let mut black = 0usize;
        for col in (0..w).step_by(col_step) {
            let px = &rgba[base + col * 4..base + col * 4 + 4];
            sampled += 1;
            if px[3] >= 240 && px[0] <= 18 && px[1] <= 18 && px[2] <= 18 {
                black += 1;
            }
        }
        sampled > 0 && black * 100 >= sampled * 92
    };

    let mut top = 0usize;
    while top < h && is_black_row(top) {
        top += 1;
    }
    let mut bottom = 0usize;
    while bottom < h.saturating_sub(top) && is_black_row(h - 1 - bottom) {
        bottom += 1;
    }

    let min_bar = (h / 14).max(4);
    if top < min_bar || bottom < min_bar {
        return None;
    }
    let kept = h.saturating_sub(top + bottom);
    if kept < h / 2 {
        return None;
    }
    Some((top as u32, kept as u32))
}

/// Crops contiguous RGBA pixel rows `[top_row .. top_row + kept_height]`.
#[must_use]
pub fn crop_rgba_rows(rgba: &[u8], width: u32, top_row: u32, kept_height: u32) -> Vec<u8> {
    let row_bytes = (width as usize).saturating_mul(4);
    let start = (top_row as usize).saturating_mul(row_bytes);
    let end = start.saturating_add((kept_height as usize).saturating_mul(row_bytes));
    if end > rgba.len() || start >= end {
        return Vec::new();
    }
    rgba[start..end].to_vec()
}

/// Smooths brief SMTC `active: None` or placeholder app-title drops when skipping tracks or
/// loading the next browser video so UI transitions go directly old-track -> new-track.
#[derive(Debug, Default)]
pub struct MediaGraceStabilizer {
    last_active: Option<MediaSessionInfo>,
    skip_hold_until: Option<Instant>,
    drop_grace_until: Option<Instant>,
}

impl MediaGraceStabilizer {
    const SKIP_HOLD: Duration = Duration::from_millis(2600);
    const DROP_GRACE: Duration = Duration::from_millis(2000);

    /// Creates a fresh stabilizer.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Marks that a manual `Next` or `Previous` track command was just issued.
    pub fn notify_skip(&mut self, now: Instant) {
        self.skip_hold_until = Some(now + Self::SKIP_HOLD);
    }

    fn is_placeholder_session(info: &MediaSessionInfo) -> bool {
        let friendly = friendly_media_app_label(&info.app_id);
        let generic = info.title.is_empty() || info.title == friendly;
        generic && (!info.is_playing || info.duration_ms == 0)
    }

    /// Filters a raw SMTC snapshot through the skip/drop grace window.
    pub fn stabilize(&mut self, mut raw: MediaStateSnapshot, now: Instant) -> MediaStateSnapshot {
        let skip_active = self.skip_hold_until.is_some_and(|u| now < u);

        if let Some(ref current) = raw.active {
            if Self::is_placeholder_session(current)
                && let Some(ref prev) = self.last_active
                && prev.app_id == current.app_id
                && (skip_active || self.drop_grace_until.is_some_and(|u| now < u))
            {
                if self.drop_grace_until.is_none() {
                    self.drop_grace_until = Some(now + Self::DROP_GRACE);
                }
                raw.active = Some(prev.clone());
                return raw;
            }

            let switched_real_track = self
                .last_active
                .as_ref()
                .is_some_and(|prev| prev.title != current.title && !current.title.is_empty());
            if switched_real_track {
                self.skip_hold_until = None;
            }
            self.drop_grace_until = None;
            self.last_active = Some(current.clone());
            return raw;
        }

        if let Some(ref prev) = self.last_active {
            if self.drop_grace_until.is_none() {
                self.drop_grace_until = Some(now + Self::DROP_GRACE);
            }
            if skip_active || self.drop_grace_until.is_some_and(|u| now < u) {
                raw.active = Some(prev.clone());
                return raw;
            }
        }

        self.last_active = None;
        self.drop_grace_until = None;
        self.skip_hold_until = None;
        raw
    }
}

/// Applies perceptual compression, noise-gating, and fast-attack / smooth-decay envelope
/// shaping to raw `0.0..=1.0` endpoint peak levels for fluid glow reactivity.
#[must_use]
pub fn shape_audio_peak(raw_peak: f32, prev_shaped: f32) -> f32 {
    let clamped_raw = if raw_peak.is_finite() {
        raw_peak.clamp(0.0, 1.0)
    } else {
        0.0
    };
    let prev = if prev_shaped.is_finite() {
        prev_shaped.clamp(0.0, 1.0)
    } else {
        0.0
    };
    let boosted = if clamped_raw < 0.002 {
        0.0
    } else {
        clamped_raw.powf(0.65)
    };
    let next = if boosted >= prev {
        prev + (boosted - prev) * 0.78
    } else {
        prev * 0.80
    };
    if next < 0.005 {
        0.0
    } else {
        next.clamp(0.0, 1.0)
    }
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
    use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use windows::Foundation::TimeSpan;
    use windows::Graphics::Imaging::{
        BitmapAlphaMode, BitmapDecoder, BitmapEncoder, BitmapPixelFormat, BitmapTransform,
        ColorManagementMode, ExifOrientationMode,
    };
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession,
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionMediaProperties,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Storage::Streams::{
        DataReader, DataWriter, IRandomAccessStreamWithContentType, InMemoryRandomAccessStream,
    };
    use windows::Win32::Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioMeterInformation};
    use windows::Win32::Media::Audio::{
        EDataFlow, IMMDeviceEnumerator, MMDeviceEnumerator, eCapture, eConsole, eRender,
    };
    use windows::Win32::System::Com::{
        CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx,
    };
    use windows::core::GUID;

    use super::{
        DEFAULT_MEDIA_ACCENT, MediaCommand, MediaSessionInfo, MediaSessionSummary,
        MediaStateSnapshot, compute_thumbnail_fingerprint, crop_rgba_rows,
        detect_vertical_letterbox, extract_dominant_accent_from_rgba, friendly_media_app_label,
        interpolate_smtc_position_ms,
    };

    #[derive(Clone)]
    struct CachedThumbnail {
        key: String,
        first_seen_at: Instant,
        raw_fingerprint: u64,
        data_url: Option<String>,
        accent_hex: String,
    }

    static THUMB_CACHE: OnceLock<Mutex<Option<CachedThumbnail>>> = OnceLock::new();
    const THUMB_REVALIDATE_WINDOW: Duration = Duration::from_secs(4);

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

    fn pick_session_index(
        sessions: &[GlobalSystemMediaTransportControlsSession],
        preferred_app_id: Option<&str>,
    ) -> Option<usize> {
        if let Some(pref) = preferred_app_id
            && let Some(idx) = sessions.iter().position(|s| {
                s.SourceAppUserModelId()
                    .map(|id| id.to_string_lossy() == pref)
                    .unwrap_or(false)
                    && session_is_playing(s)
            })
        {
            return Some(idx);
        }
        if let Some(idx) = sessions.iter().position(session_is_playing) {
            return Some(idx);
        }
        if let Some(pref) = preferred_app_id
            && let Some(idx) = sessions.iter().position(|s| {
                s.SourceAppUserModelId()
                    .map(|id| id.to_string_lossy() == pref)
                    .unwrap_or(false)
            })
        {
            return Some(idx);
        }
        (!sessions.is_empty()).then_some(0)
    }

    fn pick_session<'a>(
        sessions: &'a [GlobalSystemMediaTransportControlsSession],
        preferred_app_id: Option<&str>,
    ) -> Option<&'a GlobalSystemMediaTransportControlsSession> {
        pick_session_index(sessions, preferred_app_id).map(|idx| &sessions[idx])
    }

    fn read_stream_bytes(stream: &IRandomAccessStreamWithContentType) -> Option<Vec<u8>> {
        const MAX_THUMB_BYTES: usize = 4_000_000;
        let _ = stream.Seek(0);
        let declared = stream.Size().unwrap_or(0).min(MAX_THUMB_BYTES as u64) as usize;
        let reader = DataReader::CreateDataReader(stream).ok()?;
        let target = if declared > 0 {
            declared
        } else {
            MAX_THUMB_BYTES
        };
        let mut bytes = Vec::with_capacity(declared.max(4096));
        while bytes.len() < target {
            let chunk_len = ((target - bytes.len()).min(65_536)) as u32;
            let Ok(load_op) = reader.LoadAsync(chunk_len) else {
                break;
            };
            let Ok(loaded) = load_op.join() else {
                break;
            };
            if loaded == 0 {
                break;
            }
            let mut chunk = vec![0u8; loaded as usize];
            if reader.ReadBytes(&mut chunk).is_err() {
                break;
            }
            bytes.extend_from_slice(&chunk);
        }
        let _ = reader.DetachStream();
        if bytes.is_empty() { None } else { Some(bytes) }
    }

    fn encode_rgba_as_jpeg_data_url(rgba: &[u8], width: u32, height: u32) -> Option<String> {
        let mem = InMemoryRandomAccessStream::new().ok()?;
        let encoder = BitmapEncoder::CreateAsync(BitmapEncoder::JpegEncoderId().ok()?, &mem)
            .ok()?
            .join()
            .ok()?;
        encoder
            .SetPixelData(
                BitmapPixelFormat::Rgba8,
                BitmapAlphaMode::Ignore,
                width,
                height,
                96.0,
                96.0,
                rgba,
            )
            .ok()?;
        encoder.FlushAsync().ok()?.join().ok()?;
        let _ = mem.Seek(0);
        let reader = DataReader::CreateDataReader(&mem).ok()?;
        let size = usize::try_from(mem.Size().ok()?).ok()?;
        if size == 0 || size > 4_000_000 {
            return None;
        }
        let loaded = reader.LoadAsync(size as u32).ok()?.join().ok()?;
        let mut encoded = vec![0u8; loaded as usize];
        reader.ReadBytes(&mut encoded).ok()?;
        let _ = reader.DetachStream();
        if encoded.is_empty() {
            None
        } else {
            Some(format!(
                "data:image/jpeg;base64,{}",
                STANDARD.encode(&encoded)
            ))
        }
    }

    fn decode_thumbnail_and_accent(bytes: &[u8]) -> (Option<String>, String) {
        let raw_fallback = || {
            let mime = super::detect_image_mime(bytes);
            Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
        };

        let Ok(mem) = InMemoryRandomAccessStream::new() else {
            return (raw_fallback(), DEFAULT_MEDIA_ACCENT.to_string());
        };
        let Ok(writer) = DataWriter::CreateDataWriter(&mem) else {
            return (raw_fallback(), DEFAULT_MEDIA_ACCENT.to_string());
        };
        if writer.WriteBytes(bytes).is_err()
            || writer
                .StoreAsync()
                .ok()
                .and_then(|op| op.join().ok())
                .is_none()
        {
            let _ = writer.DetachStream();
            return (raw_fallback(), DEFAULT_MEDIA_ACCENT.to_string());
        }
        let _ = writer.FlushAsync().ok().and_then(|op| op.join().ok());
        let _ = writer.DetachStream();
        let _ = mem.Seek(0);

        let Ok(dec_op) = BitmapDecoder::CreateAsync(&mem) else {
            return (raw_fallback(), DEFAULT_MEDIA_ACCENT.to_string());
        };
        let Ok(decoder) = dec_op.join() else {
            return (raw_fallback(), DEFAULT_MEDIA_ACCENT.to_string());
        };

        let src_w = decoder.PixelWidth().unwrap_or(0);
        let src_h = decoder.PixelHeight().unwrap_or(0);
        // Inspect/trim at up to 480px wide so large covers stay fast and memory-light.
        let (target_w, target_h) = if src_w > 0 && src_h > 0 {
            if src_w > 480 {
                let scaled_h = ((u64::from(src_h) * 480) / u64::from(src_w)).max(1) as u32;
                (480, scaled_h)
            } else {
                (src_w, src_h)
            }
        } else {
            (64, 64)
        };

        if let Ok(transform) = BitmapTransform::new() {
            let _ = transform.SetScaledWidth(target_w);
            let _ = transform.SetScaledHeight(target_h);
            if let Ok(px_op) = decoder.GetPixelDataTransformedAsync(
                BitmapPixelFormat::Rgba8,
                BitmapAlphaMode::Straight,
                &transform,
                ExifOrientationMode::IgnoreExifOrientation,
                ColorManagementMode::DoNotColorManage,
            ) && let Ok(px_provider) = px_op.join()
                && let Ok(pixels) = px_provider.DetachPixelData()
            {
                if let Some((top_row, kept_h)) =
                    detect_vertical_letterbox(pixels.as_slice(), target_w, target_h)
                {
                    let cropped = crop_rgba_rows(pixels.as_slice(), target_w, top_row, kept_h);
                    if !cropped.is_empty() {
                        let accent = extract_dominant_accent_from_rgba(&cropped);
                        let cropped_url = encode_rgba_as_jpeg_data_url(&cropped, target_w, kept_h)
                            .or_else(raw_fallback);
                        return (cropped_url, accent);
                    }
                }
                let accent = extract_dominant_accent_from_rgba(pixels.as_slice());
                return (raw_fallback(), accent);
            }
        }

        if let Ok(px_op) = decoder.GetPixelDataAsync()
            && let Ok(px_provider) = px_op.join()
            && let Ok(mut pixels) = px_provider.DetachPixelData()
        {
            if decoder.BitmapPixelFormat().ok() == Some(BitmapPixelFormat::Bgra8) {
                for chunk in pixels.as_chunks_mut::<4>().0 {
                    chunk.swap(0, 2);
                }
            }
            return (
                raw_fallback(),
                extract_dominant_accent_from_rgba(pixels.as_slice()),
            );
        }

        (raw_fallback(), DEFAULT_MEDIA_ACCENT.to_string())
    }

    fn read_raw_thumbnail_bytes(
        props: Option<&GlobalSystemMediaTransportControlsSessionMediaProperties>,
    ) -> Option<Vec<u8>> {
        let props = props?;
        let thumb_ref = props.Thumbnail().ok()?;
        let stream = thumb_ref.OpenReadAsync().ok()?.join().ok()?;
        // Read encoded bytes BEFORE decoding so WIC BitmapDecoder cannot exhaust or lock the WinRT stream.
        read_stream_bytes(&stream)
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

    /// Lightweight per-thread COM handle for polling system render output peak amplitude (~0% CPU).
    pub struct AudioPeakReader {
        meter: Option<IAudioMeterInformation>,
    }

    impl Default for AudioPeakReader {
        fn default() -> Self {
            Self::new()
        }
    }

    impl AudioPeakReader {
        /// Initializes COM on the current worker thread and attaches to the default render meter.
        #[must_use]
        pub fn new() -> Self {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            }
            Self {
                meter: Self::acquire_meter(),
            }
        }

        fn acquire_meter() -> Option<IAudioMeterInformation> {
            unsafe {
                let enumerator: IMMDeviceEnumerator =
                    CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
                let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
                device.Activate(CLSCTX_ALL, None).ok()
            }
        }

        /// Samples the instantaneous peak render amplitude (`0.0..=1.0`), re-acquiring on device switches.
        pub fn sample(&mut self) -> f32 {
            if self.meter.is_none() {
                self.meter = Self::acquire_meter();
            }
            let Some(ref meter) = self.meter else {
                return 0.0;
            };
            match unsafe { meter.GetPeakValue() } {
                Ok(val) if val.is_finite() => val.clamp(0.0, 1.0),
                Ok(_) => 0.0,
                Err(_) => {
                    self.meter = Self::acquire_meter();
                    self.meter
                        .as_ref()
                        .and_then(|m| unsafe { m.GetPeakValue().ok() })
                        .filter(|v| v.is_finite())
                        .map_or(0.0, |v| v.clamp(0.0, 1.0))
                }
            }
        }
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
        let mut props_by_idx: Vec<
            Option<GlobalSystemMediaTransportControlsSessionMediaProperties>,
        > = Vec::with_capacity(sessions.len());

        for session in &sessions {
            let app_id = session
                .SourceAppUserModelId()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let is_playing = session_is_playing(session);
            let props = session
                .TryGetMediaPropertiesAsync()
                .ok()
                .and_then(|op| op.join().ok());
            let title = props
                .as_ref()
                .and_then(|p| p.Title().ok())
                .map(|t| t.to_string_lossy().trim().to_string())
                .unwrap_or_default();
            let artist = props
                .as_ref()
                .and_then(|p| p.Artist().ok())
                .map(|a| a.to_string_lossy().trim().to_string())
                .unwrap_or_default();

            if !title.is_empty() || !app_id.is_empty() {
                summaries.push(MediaSessionSummary {
                    app_id,
                    title,
                    artist,
                    is_playing,
                });
            }
            props_by_idx.push(props);
        }

        let active = pick_session_index(&sessions, preferred_app_id).and_then(|idx| {
            let session = &sessions[idx];
            let props = props_by_idx.get(idx).and_then(|p| p.as_ref());
            let app_id = session
                .SourceAppUserModelId()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let raw_title = props
                .and_then(|p| p.Title().ok())
                .map(|t| t.to_string_lossy().trim().to_string())
                .unwrap_or_default();
            let artist = props
                .and_then(|p| p.Artist().ok())
                .map(|a| a.to_string_lossy().trim().to_string())
                .unwrap_or_default();
            let album_title = props
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
            let now = Instant::now();
            let cached = THUMB_CACHE
                .get_or_init(|| Mutex::new(None))
                .lock()
                .ok()
                .and_then(|g| g.clone())
                .filter(|c| c.key == cache_key);

            let (album_art_data_url, accent_hex) = if let Some(entry) = cached {
                let settled = entry.data_url.is_some()
                    && now.duration_since(entry.first_seen_at) > THUMB_REVALIDATE_WINDOW;
                if settled {
                    (entry.data_url, entry.accent_hex)
                } else if let Some(bytes) = read_raw_thumbnail_bytes(props) {
                    let fp = compute_thumbnail_fingerprint(&bytes);
                    if fp == entry.raw_fingerprint && entry.data_url.is_some() {
                        (entry.data_url, entry.accent_hex)
                    } else {
                        let (art, acc) = decode_thumbnail_and_accent(&bytes);
                        if let Ok(mut guard) = THUMB_CACHE.get_or_init(|| Mutex::new(None)).lock() {
                            *guard = Some(CachedThumbnail {
                                key: cache_key,
                                first_seen_at: entry.first_seen_at,
                                raw_fingerprint: fp,
                                data_url: art.clone(),
                                accent_hex: acc.clone(),
                            });
                        }
                        (art, acc)
                    }
                } else {
                    (entry.data_url, entry.accent_hex)
                }
            } else if let Some(bytes) = read_raw_thumbnail_bytes(props) {
                let fp = compute_thumbnail_fingerprint(&bytes);
                let (art, acc) = decode_thumbnail_and_accent(&bytes);
                if let Ok(mut guard) = THUMB_CACHE.get_or_init(|| Mutex::new(None)).lock() {
                    *guard = Some(CachedThumbnail {
                        key: cache_key,
                        first_seen_at: now,
                        raw_fingerprint: fp,
                        data_url: art.clone(),
                        accent_hex: acc.clone(),
                    });
                }
                (art, acc)
            } else {
                (None, DEFAULT_MEDIA_ACCENT.to_string())
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

    /// Cross-platform stub for systems without Windows Core Audio endpoint metering.
    #[derive(Default)]
    pub struct AudioPeakReader;

    impl AudioPeakReader {
        /// Returns an empty peak meter stub.
        #[must_use]
        pub fn new() -> Self {
            Self
        }

        /// Returns silent `0.0` outside Windows.
        pub fn sample(&mut self) -> f32 {
            0.0
        }
    }
}

pub use platform::{
    AudioPeakReader, fetch_lrclib_lrc, get_mic_muted, get_system_volume, read_media_state,
    seek_media, send_media_command, set_system_volume, toggle_mic_mute,
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

    #[test]
    fn detects_thumbnail_mime_headers() {
        assert_eq!(
            detect_image_mime(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]),
            "image/png"
        );
        assert_eq!(detect_image_mime(b"RIFF1234WEBPVP8 "), "image/webp");
        assert_eq!(detect_image_mime(b"GIF89a..."), "image/gif");
        assert_eq!(detect_image_mime(b"BM\x00\x01"), "image/bmp");
        assert_eq!(detect_image_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), "image/jpeg");
    }

    #[test]
    fn shapes_audio_peak_attack_decay_and_noise_gate() {
        assert_eq!(shape_audio_peak(0.001, 0.0), 0.0);
        assert_eq!(shape_audio_peak(f32::NAN, 0.0), 0.0);

        // Beat hit lifts fast while staying bounded [0, 1].
        let hit = shape_audio_peak(0.85, 0.05);
        assert!(hit > 0.7 && hit <= 1.0);

        // Silence decays smoothly back toward zero.
        let decayed = shape_audio_peak(0.0, hit);
        assert!(decayed < hit && decayed > 0.4);
    }

    #[test]
    fn trims_symmetric_youtube_letterbox_bars_and_detects_fingerprint_changes() {
        let w = 80u32;
        let h = 60u32;
        let mut rgba = Vec::with_capacity((w * h * 4) as usize);
        for y in 0..h {
            for _ in 0..w {
                if !(8..52).contains(&y) {
                    rgba.extend_from_slice(&[0, 0, 0, 255]);
                } else {
                    rgba.extend_from_slice(&[240, 80, 30, 255]);
                }
            }
        }
        let crop = detect_vertical_letterbox(&rgba, w, h);
        assert_eq!(crop, Some((8, 44)));
        let cropped = crop_rgba_rows(&rgba, w, 8, 44);
        assert_eq!(cropped.len(), (w * 44 * 4) as usize);
        assert_ne!(
            compute_thumbnail_fingerprint(&rgba),
            compute_thumbnail_fingerprint(&cropped)
        );
    }

    #[test]
    fn grace_stabilizer_prevents_empty_flash_during_track_skip() {
        let mut stab = MediaGraceStabilizer::new();
        let t0 = Instant::now();
        let track_a = MediaStateSnapshot {
            active: Some(MediaSessionInfo {
                app_id: "chrome.exe".into(),
                title: "Song A".into(),
                artist: "Artist".into(),
                album_title: String::new(),
                is_playing: true,
                position_ms: 10_000,
                duration_ms: 180_000,
                album_art_data_url: None,
                accent_hex: DEFAULT_MEDIA_ACCENT.into(),
            }),
            sessions: Vec::new(),
            volume_percent: 60,
            muted: false,
        };
        assert_eq!(
            stab.stabilize(track_a.clone(), t0).active.map(|a| a.title),
            Some("Song A".into())
        );

        // User skips Next; Chrome temporarily emits empty session after 200ms.
        stab.notify_skip(t0 + Duration::from_millis(100));
        let empty = MediaStateSnapshot::default();
        let held = stab.stabilize(empty.clone(), t0 + Duration::from_millis(400));
        assert_eq!(held.active.map(|a| a.title), Some("Song A".into()));

        // Song B loads at +900ms -> transitions directly from Song A to Song B.
        let mut track_b = track_a;
        track_b.active.as_mut().unwrap().title = "Song B".into();
        let next = stab.stabilize(track_b, t0 + Duration::from_millis(900));
        assert_eq!(next.active.map(|a| a.title), Some("Song B".into()));

        // True stop clears cleanly after > 2.1s grace period.
        let held_late = stab.stabilize(empty.clone(), t0 + Duration::from_millis(1200));
        assert!(held_late.active.is_some());
        let cleared = stab.stabilize(empty, t0 + Duration::from_millis(3500));
        assert!(cleared.active.is_none());
    }
}

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
    #[serde(default)]
    pub app_icon_data_url: Option<String>,
    #[serde(default)]
    pub source_app_id: Option<String>,
}

/// Raw system or browser notification captured from Windows Action Center / Listener.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapturedSystemNotification {
    pub external_id: i64,
    pub source_app_id: String,
    pub app_name: String,
    pub title: String,
    pub body: String,
    pub app_icon_data_url: Option<String>,
}

/// Decodes minimal XML character references (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&#...;`).
#[must_use]
pub fn decode_xml_entities(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let after = &rest[amp..];
        if let Some(semi) = after.find(';')
            && semi <= 12
        {
            let entity = &after[1..semi];
            let decoded = match entity {
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" => Some('\''),
                _ if entity.starts_with("#x") || entity.starts_with("#X") => {
                    u32::from_str_radix(&entity[2..], 16)
                        .ok()
                        .and_then(char::from_u32)
                }
                _ if entity.starts_with('#') => {
                    entity[1..].parse::<u32>().ok().and_then(char::from_u32)
                }
                _ => None,
            };
            if let Some(ch) = decoded {
                out.push(ch);
                rest = &after[semi + 1..];
                continue;
            }
        }
        out.push('&');
        rest = &rest[amp + 1..];
    }
    out.push_str(rest);
    out
}

/// Parsed fields from Windows `<toast>` XML notification payloads.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ParsedToastXml {
    pub title: String,
    pub body: String,
    pub image_src: Option<String>,
}

/// Extracts `<text>` lines and `<image src="...">` attributes from a Windows toast XML string.
#[must_use]
pub fn parse_toast_xml(xml: &str) -> ParsedToastXml {
    let mut texts: Vec<String> = Vec::new();
    let mut scan = xml;
    while let Some(start) = scan.find("<text") {
        let after_tag = &scan[start..];
        let Some(gt) = after_tag.find('>') else {
            break;
        };
        // Skip self-closing <text ... />
        if after_tag[..gt].ends_with('/') {
            scan = &after_tag[gt + 1..];
            continue;
        }
        let inner = &after_tag[gt + 1..];
        let Some(end) = inner.find("</text>") else {
            break;
        };
        let text = decode_xml_entities(inner[..end].trim())
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if !text.is_empty() {
            texts.push(text);
        }
        scan = &inner[end + 7..];
    }

    let mut image_src: Option<String> = None;
    let mut img_scan = xml;
    while let Some(start) = img_scan.find("<image") {
        let after_img = &img_scan[start..];
        let Some(gt) = after_img.find('>') else {
            break;
        };
        let tag = &after_img[..gt];
        if let Some(src_val) = extract_xml_attr(tag, "src")
            && !src_val.is_empty()
        {
            let is_logo = extract_xml_attr(tag, "placement")
                .map(|p| p.eq_ignore_ascii_case("appLogoOverride"))
                .unwrap_or(false);
            if is_logo || image_src.is_none() {
                image_src = Some(decode_xml_entities(&src_val));
                if is_logo {
                    break;
                }
            }
        }
        img_scan = &after_img[gt + 1..];
    }

    let title = texts.first().cloned().unwrap_or_default();
    let body = if texts.len() > 1 {
        texts[1..].join(" · ")
    } else {
        String::new()
    };
    ParsedToastXml {
        title,
        body,
        image_src,
    }
}

fn extract_xml_attr(tag: &str, attr_name: &str) -> Option<String> {
    for quote in ['"', '\''] {
        let needle = format!("{attr_name}={quote}");
        if let Some(idx) = tag.find(&needle) {
            let val_start = idx + needle.len();
            if let Some(end) = tag[val_start..].find(quote) {
                return Some(tag[val_start..val_start + end].to_string());
            }
        }
    }
    None
}

/// Maps raw Windows AUMIDs (`PrimaryId`) to clean human-readable app or browser names.
#[must_use]
pub fn format_aumid_display_name(aumid: &str) -> String {
    let trimmed = aumid.trim();
    let lower = trimmed.to_ascii_lowercase();
    if lower == "chrome" || lower.contains("google.chrome") {
        return "Google Chrome".into();
    }
    if lower == "msedge" || lower.contains("microsoft.microsoftedge") {
        return "Microsoft Edge".into();
    }
    if lower.contains("firefox") {
        return "Firefox".into();
    }
    if lower.contains("brave") {
        return "Brave".into();
    }
    if lower.contains("whatsapp") {
        return "WhatsApp".into();
    }
    if lower.contains("discord") {
        return "Discord".into();
    }
    if lower.contains("telegram") {
        return "Telegram".into();
    }
    if lower.contains("slack") {
        return "Slack".into();
    }
    if lower.contains("teams") {
        return "Microsoft Teams".into();
    }
    if lower.contains("spotify") {
        return "Spotify".into();
    }
    if lower.contains("outlook") {
        return "Outlook".into();
    }
    if lower.contains("defender") || lower.contains("security") {
        return "Windows Security".into();
    }
    if let Some(stripped) = trimmed.strip_prefix("electron.app.") {
        return stripped.to_string();
    }
    let before_bang = trimmed.split('!').next().unwrap_or(trimmed);
    let clean = before_bang
        .split('_')
        .next()
        .unwrap_or(before_bang)
        .rsplit(['.', '\\'])
        .next()
        .unwrap_or(trimmed);
    if clean.is_empty() {
        "Windows".into()
    } else {
        clean.to_string()
    }
}

/// Encodes raw 32-bit RGBA pixels (`width * height * 4` bytes) into a valid PNG buffer.
#[must_use]
pub fn encode_rgba_png(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let expected = (width as usize)
        .checked_mul(height as usize)?
        .checked_mul(4)?;
    if width == 0 || height == 0 || rgba.len() != expected {
        return None;
    }

    fn crc32(data: &[u8]) -> u32 {
        let mut crc = 0xFFFF_FFFFu32;
        for &b in data {
            crc ^= u32::from(b);
            for _ in 0..8 {
                let mask = (crc & 1).wrapping_neg();
                crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
            }
        }
        !crc
    }

    fn push_chunk(out: &mut Vec<u8>, kind: &[u8; 4], payload: &[u8]) {
        out.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        out.extend_from_slice(kind);
        out.extend_from_slice(payload);
        let mut crc_input = Vec::with_capacity(4 + payload.len());
        crc_input.extend_from_slice(kind);
        crc_input.extend_from_slice(payload);
        out.extend_from_slice(&crc32(&crc_input).to_be_bytes());
    }

    let stride = width as usize * 4;
    let mut raw_scanlines = Vec::with_capacity((stride + 1) * height as usize);
    for y in 0..height as usize {
        raw_scanlines.push(0u8); // filter type 0 (None)
        let row = &rgba[y * stride..(y + 1) * stride];
        raw_scanlines.extend_from_slice(row);
    }

    // Zlib wrapper + uncompressed DEFLATE blocks (max 65535 bytes each).
    let mut zlib = Vec::with_capacity(raw_scanlines.len() + 32);
    zlib.push(0x78);
    zlib.push(0x01);

    let mut pos = 0usize;
    while pos < raw_scanlines.len() {
        let chunk_len = (raw_scanlines.len() - pos).min(65_535);
        let is_final = if pos + chunk_len >= raw_scanlines.len() {
            1u8
        } else {
            0u8
        };
        zlib.push(is_final);
        let len16 = chunk_len as u16;
        zlib.extend_from_slice(&len16.to_le_bytes());
        zlib.extend_from_slice(&(!len16).to_le_bytes());
        zlib.extend_from_slice(&raw_scanlines[pos..pos + chunk_len]);
        pos += chunk_len;
    }

    // Adler-32 checksum
    let mut s1 = 1u32;
    let mut s2 = 0u32;
    for &b in &raw_scanlines {
        s1 = (s1 + u32::from(b)) % 65_521;
        s2 = (s2 + s1) % 65_521;
    }
    zlib.extend_from_slice(&((s2 << 16) | s1).to_be_bytes());

    let mut png = Vec::with_capacity(64 + zlib.len());
    png.extend_from_slice(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);

    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.push(8); // bit depth
    ihdr.push(6); // color type: RGBA
    ihdr.push(0); // compression
    ihdr.push(0); // filter
    ihdr.push(0); // interlace
    push_chunk(&mut png, b"IHDR", &ihdr);
    push_chunk(&mut png, b"IDAT", &zlib);
    push_chunk(&mut png, b"IEND", &[]);
    Some(png)
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

/// Applies allow/deny app filters, fullscreen/Focus Assist quiet rules, and preview sanitization
/// to a captured OS/browser notification preserving its real app icon.
#[must_use]
pub fn filter_captured_notification(
    id: u64,
    captured: &CapturedSystemNotification,
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

    let app_lower = captured.app_name.trim().to_lowercase();
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
            app_name: captured.app_name.clone(),
            title: captured.app_name.clone(),
            body: "Notification received".to_string(),
            app_icon_data_url: captured.app_icon_data_url.clone(),
            source_app_id: Some(captured.source_app_id.clone()),
        });
    }

    Some(NotificationPopup {
        id,
        app_name: captured.app_name.clone(),
        title: captured.title.clone(),
        body: sanitize_body(&captured.body, config),
        app_icon_data_url: captured.app_icon_data_url.clone(),
        source_app_id: Some(captured.source_app_id.clone()),
    })
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
    let captured = CapturedSystemNotification {
        external_id: id as i64,
        source_app_id: String::new(),
        app_name: app_name.to_string(),
        title: title.to_string(),
        body: body.to_string(),
        app_icon_data_url: None,
    };
    let mut popup =
        filter_captured_notification(id, &captured, config, is_fullscreen, focus_assist_quiet)?;
    popup.source_app_id = None;
    Some(popup)
}

#[cfg(windows)]
mod platform {
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};
    use std::time::SystemTime;

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use rusqlite::{Connection, OpenFlags};
    use windows::Foundation::Size;
    use windows::Storage::Streams::DataReader;
    use windows::UI::Notifications::Management::{
        UserNotificationListener, UserNotificationListenerAccessStatus,
    };
    use windows::UI::Notifications::{KnownNotificationBindings, NotificationKinds};
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, CreateCompatibleDC, DIB_RGB_COLORS, DeleteDC,
        DeleteObject, GetDIBits, GetObjectW, HGDIOBJ,
    };
    use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize};
    use windows::Win32::UI::Shell::{
        IShellItemImageFactory, QUNS_ACCEPTS_NOTIFICATIONS, SHCreateItemFromParsingName,
        SHQueryUserNotificationState, SIIGBF_BIGGERSIZEOK, SIIGBF_ICONONLY,
    };
    use windows::core::HSTRING;

    use super::{
        CapturedSystemNotification, encode_rgba_png, format_aumid_display_name, parse_toast_xml,
    };

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

    fn read_local_image_data_url(uri_or_path: &str) -> Option<String> {
        let trimmed = uri_or_path.trim();
        let lower = trimmed.to_ascii_lowercase();
        let local_path = if lower.starts_with("file:///") {
            let raw = &trimmed[8..];
            raw.replace("%20", " ").replace('/', "\\")
        } else if Path::new(trimmed).is_absolute() {
            trimmed.to_string()
        } else {
            return None;
        };

        let meta = std::fs::metadata(&local_path).ok()?;
        if meta.len() == 0 || meta.len() > 512 * 1024 {
            return None;
        }
        let bytes = std::fs::read(&local_path).ok()?;
        let mime = if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
            "image/png"
        } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
            "image/jpeg"
        } else if bytes.starts_with(b"RIFF") {
            "image/webp"
        } else {
            return None;
        };
        Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
    }

    /// Extracts a 48x48 PNG data URL for any installed Windows desktop/Store/browser app AUMID.
    #[must_use]
    pub fn extract_app_logo_data_url(aumid: &str) -> Option<String> {
        if aumid.trim().is_empty() {
            return None;
        }
        let parsing = HSTRING::from(format!("shell:AppsFolder\\{}", aumid.trim()));
        unsafe {
            let hr_co = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let should_uninit = hr_co.is_ok();
            let factory_res: windows::core::Result<IShellItemImageFactory> =
                SHCreateItemFromParsingName(&parsing, None);
            let result = match factory_res {
                Ok(factory) => match factory.GetImage(
                    SIZE { cx: 48, cy: 48 },
                    SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK,
                ) {
                    Ok(hbmp) => {
                        let mut bmp = BITMAP::default();
                        let got = GetObjectW(
                            HGDIOBJ(hbmp.0),
                            std::mem::size_of::<BITMAP>() as i32,
                            Some((&mut bmp as *mut BITMAP).cast()),
                        );
                        let png_opt = if got > 0 && bmp.bmWidth > 0 && bmp.bmHeight > 0 {
                            let w = bmp.bmWidth as u32;
                            let h = bmp.bmHeight as u32;
                            let mut bgra = vec![0u8; (w * h * 4) as usize];
                            let mut bmi = BITMAPINFO {
                                bmiHeader: BITMAPINFOHEADER {
                                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                                    biWidth: bmp.bmWidth,
                                    biHeight: -bmp.bmHeight,
                                    biPlanes: 1,
                                    biBitCount: 32,
                                    biCompression: BI_RGB.0,
                                    ..Default::default()
                                },
                                ..Default::default()
                            };
                            let hdc = CreateCompatibleDC(None);
                            let lines = GetDIBits(
                                hdc,
                                hbmp,
                                0,
                                h,
                                Some(bgra.as_mut_ptr().cast()),
                                &mut bmi,
                                DIB_RGB_COLORS,
                            );
                            let _ = DeleteDC(hdc);
                            if lines > 0 {
                                for px in bgra.as_chunks_mut::<4>().0 {
                                    px.swap(0, 2); // BGRA -> RGBA
                                }
                                encode_rgba_png(w, h, &bgra)
                            } else {
                                None
                            }
                        } else {
                            None
                        };
                        let _ = DeleteObject(HGDIOBJ(hbmp.0));
                        png_opt.map(|png| format!("data:image/png;base64,{}", STANDARD.encode(png)))
                    }
                    Err(_) => None,
                },
                Err(_) => None,
            };
            if should_uninit {
                CoUninitialize();
            }
            result
        }
    }

    fn wpndatabase_path() -> Option<PathBuf> {
        let local_app_data = std::env::var_os("LOCALAPPDATA")?;
        let p = PathBuf::from(local_app_data)
            .join("Microsoft")
            .join("Windows")
            .join("Notifications")
            .join("wpndatabase.db");
        p.exists().then_some(p)
    }

    fn copy_wpn_snapshot(src: &Path, snap_db: &Path) -> bool {
        if std::fs::copy(src, snap_db).is_err() {
            return false;
        }
        for ext in ["-wal", "-shm"] {
            let ext_src = PathBuf::from(format!("{}{}", src.display(), ext));
            let ext_dst = PathBuf::from(format!("{}{}", snap_db.display(), ext));
            if ext_src.exists() {
                let _ = std::fs::copy(&ext_src, &ext_dst);
            } else {
                let _ = std::fs::remove_file(&ext_dst);
            }
        }
        true
    }

    fn wpn_stamp(src: &Path) -> Option<(SystemTime, u64)> {
        let wal = PathBuf::from(format!("{}-wal", src.display()));
        let target = if wal.exists() { &wal } else { src };
        let meta = std::fs::metadata(target).ok()?;
        let modified = meta.modified().ok()?;
        Some((modified, meta.len()))
    }

    /// Captures live toast notifications across ALL Windows apps and browsers (Chrome, Edge,
    /// Firefox, WhatsApp, Discord, etc.) along with crisp app/site logos.
    pub struct SystemNotificationWatcher {
        last_seen_id: i64,
        last_seen_winrt_id: u32,
        last_stamp: Option<(SystemTime, u64)>,
        snap_path: PathBuf,
        icon_cache: HashMap<String, Option<String>>,
        display_name_cache: HashMap<String, String>,
        winrt_enabled: bool,
    }

    impl Default for SystemNotificationWatcher {
        fn default() -> Self {
            Self::new()
        }
    }

    impl SystemNotificationWatcher {
        #[must_use]
        pub fn new() -> Self {
            let pid = std::process::id();
            let snap_path = std::env::temp_dir().join(format!("lumen_wpn_snap_{pid}.db"));
            let winrt_enabled = listener_access_available();
            let mut watcher = Self {
                last_seen_id: 0,
                last_seen_winrt_id: 0,
                last_stamp: None,
                snap_path,
                icon_cache: HashMap::new(),
                display_name_cache: HashMap::new(),
                winrt_enabled,
            };
            watcher.seed_baseline();
            watcher
        }

        fn seed_baseline(&mut self) {
            if self.winrt_enabled
                && let Ok(listener) = UserNotificationListener::Current()
                && let Ok(op) = listener.GetNotificationsAsync(NotificationKinds::Toast)
                && let Ok(list) = op.join()
                && let Ok(count) = list.Size()
            {
                for idx in 0..count {
                    if let Ok(item) = list.GetAt(idx)
                        && let Ok(id) = item.Id()
                    {
                        self.last_seen_winrt_id = self.last_seen_winrt_id.max(id);
                    }
                }
            }

            if let Some(src) = wpndatabase_path()
                && copy_wpn_snapshot(&src, &self.snap_path)
                && let Ok(conn) =
                    Connection::open_with_flags(&self.snap_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            {
                let max_id: i64 = conn
                    .query_row("SELECT COALESCE(MAX(Id), 0) FROM Notification", [], |r| {
                        r.get(0)
                    })
                    .unwrap_or(0);
                self.last_seen_id = max_id;
                self.last_stamp = wpn_stamp(&src);
            }
        }

        fn resolve_app_logo_cached(&mut self, aumid: &str) -> Option<String> {
            if let Some(cached) = self.icon_cache.get(aumid) {
                return cached.clone();
            }
            let fetched = extract_app_logo_data_url(aumid);
            self.icon_cache.insert(aumid.to_string(), fetched.clone());
            fetched
        }

        fn resolve_handler_name(
            &mut self,
            conn: &Connection,
            handler_id: i64,
            aumid: &str,
        ) -> String {
            if let Some(cached) = self.display_name_cache.get(aumid) {
                return cached.clone();
            }
            let asset_name: Option<String> = conn
                .query_row(
                    "SELECT AssetValue FROM HandlerAssets WHERE HandlerId = ?1 AND AssetKey = 'DisplayName' LIMIT 1",
                    [handler_id],
                    |r| r.get(0),
                )
                .ok();
            let resolved = asset_name
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty() && !s.starts_with("ms-resource:"))
                .unwrap_or_else(|| format_aumid_display_name(aumid));
            self.display_name_cache
                .insert(aumid.to_string(), resolved.clone());
            resolved
        }

        fn poll_winrt(&mut self) -> Vec<CapturedSystemNotification> {
            let mut out = Vec::new();
            let Ok(listener) = UserNotificationListener::Current() else {
                return out;
            };
            let Ok(op) = listener.GetNotificationsAsync(NotificationKinds::Toast) else {
                return out;
            };
            let Ok(list) = op.join() else {
                return out;
            };
            let Ok(count) = list.Size() else {
                return out;
            };
            for idx in 0..count {
                let Ok(item) = list.GetAt(idx) else {
                    continue;
                };
                let Ok(id) = item.Id() else {
                    continue;
                };
                if id <= self.last_seen_winrt_id {
                    continue;
                }
                self.last_seen_winrt_id = self.last_seen_winrt_id.max(id);

                let app_info = item.AppInfo().ok();
                let aumid = app_info
                    .as_ref()
                    .and_then(|ai| ai.AppUserModelId().ok())
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Windows".into());
                let app_name = app_info
                    .as_ref()
                    .and_then(|ai| ai.DisplayInfo().ok())
                    .and_then(|di| di.DisplayName().ok())
                    .map(|s| s.to_string_lossy().trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format_aumid_display_name(&aumid));
                if app_name.eq_ignore_ascii_case("Lumen")
                    || aumid.to_ascii_lowercase().contains("lumen")
                {
                    continue;
                }

                let mut texts = Vec::new();
                if let Ok(notif) = item.Notification()
                    && let Ok(visual) = notif.Visual()
                    && let Ok(template) = KnownNotificationBindings::ToastGeneric()
                    && let Ok(binding) = visual.GetBinding(&template)
                    && let Ok(elements) = binding.GetTextElements()
                    && let Ok(elen) = elements.Size()
                {
                    for t_idx in 0..elen {
                        if let Ok(el) = elements.GetAt(t_idx)
                            && let Ok(txt) = el.Text()
                        {
                            let s = txt.to_string_lossy().trim().to_string();
                            if !s.is_empty() {
                                texts.push(s);
                            }
                        }
                    }
                }
                if texts.is_empty() {
                    continue;
                }

                let winrt_logo = app_info
                    .as_ref()
                    .and_then(|ai| ai.DisplayInfo().ok())
                    .and_then(|di| {
                        di.GetLogo(Size {
                            Width: 48.0,
                            Height: 48.0,
                        })
                        .ok()
                    })
                    .and_then(|logo| logo.OpenReadAsync().ok()?.join().ok())
                    .and_then(|stream| {
                        let size = stream.Size().ok()?.min(512 * 1024) as u32;
                        if size == 0 {
                            return None;
                        }
                        let reader = DataReader::CreateDataReader(&stream).ok()?;
                        reader.LoadAsync(size).ok()?.join().ok()?;
                        let mut buf = vec![0u8; size as usize];
                        reader.ReadBytes(&mut buf).ok()?;
                        Some(format!("data:image/png;base64,{}", STANDARD.encode(buf)))
                    })
                    .or_else(|| self.resolve_app_logo_cached(&aumid));

                let title = texts.first().cloned().unwrap_or_else(|| app_name.clone());
                let body = if texts.len() > 1 {
                    texts[1..].join(" · ")
                } else {
                    String::new()
                };
                out.push(CapturedSystemNotification {
                    external_id: i64::from(id),
                    source_app_id: aumid,
                    app_name,
                    title,
                    body,
                    app_icon_data_url: winrt_logo,
                });
            }
            out
        }

        pub fn poll_new(&mut self) -> Vec<CapturedSystemNotification> {
            if self.winrt_enabled {
                let winrt = self.poll_winrt();
                if !winrt.is_empty() {
                    return winrt;
                }
            }

            let Some(src) = wpndatabase_path() else {
                return Vec::new();
            };
            let current_stamp = wpn_stamp(&src);
            if current_stamp.is_some() && current_stamp == self.last_stamp {
                return Vec::new();
            }
            if !copy_wpn_snapshot(&src, &self.snap_path) {
                return Vec::new();
            }
            self.last_stamp = current_stamp;

            let Ok(conn) =
                Connection::open_with_flags(&self.snap_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            else {
                return Vec::new();
            };

            let Ok(mut stmt) = conn.prepare(
                "SELECT n.Id, n.HandlerId, h.PrimaryId, n.Payload
                 FROM Notification n
                 JOIN NotificationHandler h ON n.HandlerId = h.RecordId
                 WHERE n.Id > ?1 AND n.Type = 'toast'
                 ORDER BY n.Id ASC
                 LIMIT 12",
            ) else {
                return Vec::new();
            };

            let rows = match stmt.query_map([self.last_seen_id], |row| {
                let id: i64 = row.get(0)?;
                let handler_id: i64 = row.get(1)?;
                let primary_id: String = row.get(2)?;
                let payload_bytes: Vec<u8> = row.get(3)?;
                Ok((id, handler_id, primary_id, payload_bytes))
            }) {
                Ok(r) => r,
                Err(_) => return Vec::new(),
            };

            let mut results = Vec::new();
            for row in rows.flatten() {
                let (id, handler_id, primary_id, payload_bytes) = row;
                self.last_seen_id = self.last_seen_id.max(id);

                let lower_id = primary_id.to_ascii_lowercase();
                if lower_id.contains("etarnity.lumen") || lower_id.ends_with(".lumen") {
                    continue;
                }

                let xml = String::from_utf8_lossy(&payload_bytes);
                let parsed = parse_toast_xml(&xml);
                if parsed.title.is_empty() && parsed.body.is_empty() {
                    continue;
                }

                let app_name = self.resolve_handler_name(&conn, handler_id, &primary_id);
                let logo_from_payload = parsed
                    .image_src
                    .as_deref()
                    .and_then(read_local_image_data_url);
                let app_icon_data_url =
                    logo_from_payload.or_else(|| self.resolve_app_logo_cached(&primary_id));

                results.push(CapturedSystemNotification {
                    external_id: id,
                    source_app_id: primary_id,
                    app_name: app_name.clone(),
                    title: if parsed.title.is_empty() {
                        app_name
                    } else {
                        parsed.title
                    },
                    body: parsed.body,
                    app_icon_data_url,
                });
            }
            results
        }
    }

    impl Drop for SystemNotificationWatcher {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.snap_path);
            for ext in ["-wal", "-shm"] {
                let _ = std::fs::remove_file(format!("{}{}", self.snap_path.display(), ext));
            }
        }
    }
}

#[cfg(not(windows))]
mod platform {
    use super::CapturedSystemNotification;

    #[must_use]
    pub const fn is_focus_assist_quiet() -> bool {
        false
    }

    #[must_use]
    pub const fn listener_access_available() -> bool {
        false
    }

    #[derive(Debug, Default)]
    pub struct SystemNotificationWatcher;

    impl SystemNotificationWatcher {
        #[must_use]
        pub const fn new() -> Self {
            Self
        }

        pub fn poll_new(&mut self) -> Vec<CapturedSystemNotification> {
            Vec::new()
        }
    }
}

pub use platform::{SystemNotificationWatcher, is_focus_assist_quiet, listener_access_available};

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

    #[test]
    fn parses_toast_xml_entities_images_and_browser_aumids() {
        let xml = r#"<toast><visual><binding template="ToastGeneric"><image placement="appLogoOverride" src="file:///C:/Temp/icon.png"/><text>GitHub &amp; PR #42</text><text>Build passed &lt;main&gt;</text></binding></visual></toast>"#;
        let parsed = parse_toast_xml(xml);
        assert_eq!(parsed.title, "GitHub & PR #42");
        assert_eq!(parsed.body, "Build passed <main>");
        assert_eq!(
            parsed.image_src.as_deref(),
            Some("file:///C:/Temp/icon.png")
        );

        assert_eq!(format_aumid_display_name("Chrome"), "Google Chrome");
        assert_eq!(format_aumid_display_name("MSEdge"), "Microsoft Edge");
        assert_eq!(
            format_aumid_display_name("5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App"),
            "WhatsApp"
        );
        assert_eq!(
            format_aumid_display_name("electron.app.Antigravity"),
            "Antigravity"
        );

        let png = encode_rgba_png(2, 2, &[255; 16]).expect("png");
        assert_eq!(&png[..8], &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]);
    }
}

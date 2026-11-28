use serde::{Deserialize, Serialize};

/// Physical screen rectangle of the active visible island surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PillRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// System HUD popup payload (`FR-HUD-1..2`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HudEvent {
    pub kind: String,
    pub label: String,
    pub value_pct: Option<u8>,
    pub active: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardChipSnapshot {
    pub display_text: String,
    pub sensitive: bool,
    pub raw_hash: String,
    pub has_content: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenMeteoWeather {
    pub temp_c: f64,
    pub weather_code: i32,
    pub condition: String,
    pub precip_note: Option<String>,
    pub city: String,
    pub fetched_at: String,
    pub offline: bool,
}

/// Detects OTP/password-like clipboard strings, masks them (e.g. `OTP 482 •••`), and flags auto-clear.
#[must_use]
pub fn classify_and_mask_clipboard(raw: &str) -> ClipboardChipSnapshot {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return ClipboardChipSnapshot {
            display_text: String::new(),
            sensitive: false,
            raw_hash: String::new(),
            has_content: false,
        };
    }

    let hash = {
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for b in trimmed.as_bytes() {
            h ^= u64::from(*b);
            h = h.wrapping_mul(0x0100_0000_01b3);
        }
        format!("{h:016x}")
    };

    // Pure 4..8 digit OTP (or grouped `123 456` / `123-456`)
    let compact: String = trimmed
        .chars()
        .filter(|c| !c.is_ascii_whitespace() && *c != '-')
        .collect();
    if (4..=8).contains(&compact.len()) && compact.chars().all(|c| c.is_ascii_digit()) {
        let prefix: String = compact.chars().take(3).collect();
        return ClipboardChipSnapshot {
            display_text: format!("OTP {prefix} •••"),
            sensitive: true,
            raw_hash: hash,
            has_content: true,
        };
    }

    // Extract 4..8 digit code adjacent to OTP / verification / code keywords
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("otp") || lower.contains("code") || lower.contains("verification") {
        let digits: Vec<&str> = trimmed
            .split(|c: char| !c.is_ascii_digit())
            .filter(|s| (4..=8).contains(&s.len()))
            .collect();
        if let Some(code) = digits.first() {
            let prefix: String = code.chars().take(3).collect();
            return ClipboardChipSnapshot {
                display_text: format!("OTP {prefix} •••"),
                sensitive: true,
                raw_hash: hash,
                has_content: true,
            };
        }
    }

    // Token/password-like single-token secrets (e.g. API keys or mixed symbol+digit tokens >= 12 chars)
    let is_single_token = !trimmed.chars().any(char::is_whitespace);
    let has_secret_prefix = lower.starts_with("sk_")
        || lower.starts_with("ghp_")
        || lower.starts_with("glpat-")
        || lower.starts_with("bearer ");
    let has_upper = trimmed.chars().any(|c| c.is_ascii_uppercase());
    let has_lower = trimmed.chars().any(|c| c.is_ascii_lowercase());
    let has_digit = trimmed.chars().any(|c| c.is_ascii_digit());
    let has_symbol = trimmed.chars().any(|c| !c.is_ascii_alphanumeric());
    let looks_like_password = is_single_token
        && trimmed.len() >= 10
        && !trimmed.starts_with("http")
        && (u8::from(has_upper) + u8::from(has_lower) + u8::from(has_digit) + u8::from(has_symbol)
            >= 3);

    if has_secret_prefix || looks_like_password {
        let prefix: String = trimmed.chars().take(3).collect();
        return ClipboardChipSnapshot {
            display_text: format!("{prefix} •••"),
            sensitive: true,
            raw_hash: hash,
            has_content: true,
        };
    }

    let preview: String = trimmed.chars().take(24).collect();
    ClipboardChipSnapshot {
        display_text: if trimmed.chars().count() > 24 {
            format!("{preview}…")
        } else {
            preview
        },
        sensitive: false,
        raw_hash: hash,
        has_content: true,
    }
}

/// Checks local TCP dev ports (`127.0.0.1:port`) with a short non-blocking timeout.
#[must_use]
pub fn check_dev_ports(ports: &[u16]) -> Vec<u16> {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    ports
        .iter()
        .copied()
        .filter(|port| {
            let addr = SocketAddr::from(([127, 0, 0, 1], *port));
            TcpStream::connect_timeout(&addr, Duration::from_millis(55)).is_ok()
        })
        .collect()
}

/// Action triggered by a registered global hotkey (`FR-WIN-6`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HotkeyAction {
    ToggleHide,
    ToggleExpand,
}

/// Parses a human-readable hotkey chord (e.g. `"Ctrl+Alt+Space"`, `"Ctrl+Alt+L"`)
/// into Win32 `(modifiers_with_norepeat, virtual_key)`.
#[must_use]
pub fn parse_hotkey_spec(spec: &str) -> Option<(u32, u32)> {
    const MOD_ALT: u32 = 0x0001;
    const MOD_CONTROL: u32 = 0x0002;
    const MOD_SHIFT: u32 = 0x0004;
    const MOD_WIN: u32 = 0x0008;
    const MOD_NOREPEAT: u32 = 0x4000;

    let mut mods = MOD_NOREPEAT;
    let mut vk: Option<u32> = None;

    for raw_part in spec.split('+') {
        let part = raw_part.trim().to_ascii_lowercase();
        match part.as_str() {
            "" => {}
            "ctrl" | "control" => mods |= MOD_CONTROL,
            "alt" => mods |= MOD_ALT,
            "shift" => mods |= MOD_SHIFT,
            "win" | "super" | "meta" => mods |= MOD_WIN,
            "space" => vk = Some(0x20),
            "tab" => vk = Some(0x09),
            "enter" | "return" => vk = Some(0x0D),
            s if s.len() == 1 => {
                let ch = s.as_bytes()[0];
                if ch.is_ascii_lowercase() {
                    vk = Some(u32::from(ch.to_ascii_uppercase()));
                } else if ch.is_ascii_digit() {
                    vk = Some(u32::from(ch));
                } else {
                    return None;
                }
            }
            s if s.starts_with('f') => {
                let num: u32 = s[1..].parse().ok()?;
                if (1..=12).contains(&num) {
                    vk = Some(0x70 + num - 1);
                } else {
                    return None;
                }
            }
            _ => return None,
        }
    }

    let key = vk?;
    if mods == MOD_NOREPEAT {
        return None;
    }
    Some((mods, key))
}

impl PillRect {
    /// Returns `true` when screen coordinates `(px, py)` lie within the pill rectangle
    /// (with an optional hit padding margin in physical pixels).
    #[must_use]
    pub const fn contains_point(&self, px: i32, py: i32, margin: i32) -> bool {
        px >= self.x - margin
            && px <= self.x + self.width + margin
            && py >= self.y - margin
            && py <= self.y + self.height + margin
    }
}

/// Computes the physical `(x, y)` coordinates that horizontally centre `window_width`
/// at the top edge (`monitor_y`) of a monitor.
#[must_use]
pub const fn compute_top_center_position(
    monitor_x: i32,
    monitor_y: i32,
    monitor_width: i32,
    window_width: i32,
) -> (i32, i32) {
    let x = monitor_x + (monitor_width - window_width) / 2;
    (x, monitor_y)
}

/// Computes the exact physical [`PillRect`] inside the transparent top-centred window.
#[must_use]
pub const fn compute_pill_screen_rect(
    window_x: i32,
    window_y: i32,
    window_width: i32,
    pill_width: i32,
    pill_height: i32,
    top_offset: i32,
) -> PillRect {
    let x = window_x + (window_width - pill_width) / 2;
    let y = window_y + top_offset;
    PillRect {
        x,
        y,
        width: pill_width,
        height: pill_height,
    }
}

#[cfg(windows)]
mod win32 {
    use std::sync::mpsc;
    use std::sync::{Arc, Mutex, OnceLock};

    use windows::Win32::Foundation::{
        CloseHandle, ERROR_ALREADY_EXISTS, ERROR_SUCCESS, GetLastError, HWND, LPARAM, POINT, RECT,
        WPARAM,
    };
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromWindow,
    };
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    use windows::Win32::System::Registry::{
        HKEY, HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE, REG_SZ, RegCloseKey,
        RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    };
    use windows::Win32::System::Threading::{CreateMutexW, GetCurrentThreadId};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetKeyState, HOT_KEY_MODIFIERS, RegisterHotKey, UnregisterHotKey, VK_CAPITAL,
    };
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetCursorPos, GetForegroundWindow, GetMessageW, GetWindowRect,
        IsWindowVisible, IsZoomed, MSG, PM_NOREMOVE, PeekMessageW, PostThreadMessageW,
        SW_SHOWNORMAL, SWP_NOACTIVATE, SWP_NOZORDER, SetWindowPos, WM_HOTKEY, WM_USER,
    };
    use windows::core::{HSTRING, PCWSTR};

    use crate::{HotkeyAction, parse_hotkey_spec};

    const HOTKEY_ID_HIDE: i32 = 1;
    const HOTKEY_ID_EXPAND: i32 = 2;
    const WM_REBIND_HOTKEYS: u32 = WM_USER + 1;
    const RUN_KEY_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const RUN_VALUE_NAME: &str = "Lumen";

    static INSTANCE_MUTEX: OnceLock<usize> = OnceLock::new();

    /// Acquires a per-user named mutex so duplicate Lumen instances exit cleanly (`FR-WIN-7`).
    #[must_use]
    pub fn acquire_single_instance_mutex() -> bool {
        if INSTANCE_MUTEX.get().is_some() {
            return true;
        }
        let name = HSTRING::from("Local\\EtarnityLumenSingleInstanceMutex");
        // SAFETY: Valid null-terminated HSTRING; mutex handle is kept open for process lifetime.
        let Ok(handle) = (unsafe { CreateMutexW(None, false, &name) }) else {
            return true;
        };
        // SAFETY: `GetLastError` reads thread-local error immediately after `CreateMutexW`.
        let err = unsafe { GetLastError() };
        if err == ERROR_ALREADY_EXISTS {
            // SAFETY: Valid handle created by `CreateMutexW`.
            let _ = unsafe { CloseHandle(handle) };
            return false;
        }
        let _ = INSTANCE_MUTEX.set(handle.0 as usize);
        true
    }

    /// Reads current screen cursor coordinates for active-monitor placement (`FR-WIN-5`).
    #[must_use]
    pub fn cursor_screen_pos() -> Option<(i32, i32)> {
        let mut pt = POINT::default();
        // SAFETY: Valid mutable `POINT` pointer.
        if unsafe { GetCursorPos(&mut pt) }.is_ok() {
            Some((pt.x, pt.y))
        } else {
            None
        }
    }

    /// Checks whether Lumen is currently configured in Windows Run startup registry (`FR-WIN-7`).
    #[must_use]
    pub fn is_autostart_enabled() -> bool {
        let subkey = HSTRING::from(RUN_KEY_PATH);
        let value = HSTRING::from(RUN_VALUE_NAME);
        let mut hkey = HKEY::default();
        // SAFETY: Standard read-only registry open & query under HKCU.
        unsafe {
            if RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                Some(0),
                KEY_QUERY_VALUE,
                &mut hkey,
            ) != ERROR_SUCCESS
            {
                return false;
            }
            let status = RegQueryValueExW(hkey, PCWSTR(value.as_ptr()), None, None, None, None);
            let _ = RegCloseKey(hkey);
            status == ERROR_SUCCESS
        }
    }

    /// Enables or disables automatic launch with Windows in `HKCU\...\Run` (`FR-WIN-7`).
    pub fn set_autostart_enabled(enabled: bool, exe_path: &str) -> Result<(), String> {
        let subkey = HSTRING::from(RUN_KEY_PATH);
        let value = HSTRING::from(RUN_VALUE_NAME);
        let mut hkey = HKEY::default();
        // SAFETY: Standard HKCU Run registry modification scoped to Lumen value only.
        unsafe {
            let err = RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                Some(0),
                KEY_SET_VALUE,
                &mut hkey,
            );
            if err != ERROR_SUCCESS {
                return Err(format!("open HKCU Run key failed: {:?}", err));
            }
            let res = if enabled {
                let quoted = format!("\"{exe_path}\"");
                let mut wide: Vec<u16> = quoted.encode_utf16().collect();
                wide.push(0);
                let bytes: Vec<u8> = wide.iter().flat_map(|u| u.to_le_bytes()).collect();
                RegSetValueExW(hkey, PCWSTR(value.as_ptr()), Some(0), REG_SZ, Some(&bytes))
            } else {
                let del = RegDeleteValueW(hkey, PCWSTR(value.as_ptr()));
                if del == ERROR_SUCCESS {
                    ERROR_SUCCESS
                } else {
                    // Missing entry counts as already disabled.
                    ERROR_SUCCESS
                }
            };
            let _ = RegCloseKey(hkey);
            if res != ERROR_SUCCESS {
                return Err(format!("update HKCU Run key failed: {:?}", res));
            }
        }
        Ok(())
    }

    struct PendingBind {
        hide_spec: String,
        expand_spec: String,
        reply: Option<mpsc::SyncSender<Option<String>>>,
    }

    /// Manages Windows global hotkeys on a dedicated message-loop thread (`FR-WIN-6`).
    pub struct GlobalHotkeyManager {
        thread_id: u32,
        pending: Arc<Mutex<PendingBind>>,
    }

    impl GlobalHotkeyManager {
        pub fn start<F>(
            hide_spec: &str,
            expand_spec: &str,
            on_hotkey: F,
        ) -> Result<(Self, Option<String>), String>
        where
            F: Fn(HotkeyAction) + Send + Sync + 'static,
        {
            let pending = Arc::new(Mutex::new(PendingBind {
                hide_spec: hide_spec.to_string(),
                expand_spec: expand_spec.to_string(),
                reply: None,
            }));
            let pending_thread = Arc::clone(&pending);
            let (ready_tx, ready_rx) = mpsc::sync_channel::<(u32, Option<String>)>(1);

            std::thread::Builder::new()
                .name("lumen-hotkeys".into())
                .spawn(move || {
                    let mut msg = MSG::default();
                    // SAFETY: Initializes Win32 thread message queue before posting events.
                    unsafe {
                        let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
                    }
                    let tid = unsafe { GetCurrentThreadId() };
                    let initial_warn = apply_hotkey_binds(&pending_thread);
                    let _ = ready_tx.send((tid, initial_warn));

                    // SAFETY: Thread-local Win32 message loop for `WM_HOTKEY` and rebind signals.
                    unsafe {
                        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                            if msg.message == WM_HOTKEY {
                                match msg.wParam.0 as i32 {
                                    HOTKEY_ID_HIDE => on_hotkey(HotkeyAction::ToggleHide),
                                    HOTKEY_ID_EXPAND => on_hotkey(HotkeyAction::ToggleExpand),
                                    _ => {}
                                }
                            } else if msg.message == WM_REBIND_HOTKEYS {
                                let warn = apply_hotkey_binds(&pending_thread);
                                if let Ok(mut guard) = pending_thread.lock()
                                    && let Some(tx) = guard.reply.take()
                                {
                                    let _ = tx.send(warn);
                                }
                            }
                        }
                        let _ = UnregisterHotKey(None, HOTKEY_ID_HIDE);
                        let _ = UnregisterHotKey(None, HOTKEY_ID_EXPAND);
                    }
                })
                .map_err(|e| format!("spawn hotkey thread failed: {e}"))?;

            let (thread_id, warning) = ready_rx
                .recv()
                .map_err(|e| format!("hotkey thread startup failed: {e}"))?;
            Ok((Self { thread_id, pending }, warning))
        }

        pub fn rebind(&self, hide_spec: &str, expand_spec: &str) -> Option<String> {
            let (tx, rx) = mpsc::sync_channel::<Option<String>>(1);
            if let Ok(mut guard) = self.pending.lock() {
                guard.hide_spec = hide_spec.to_string();
                guard.expand_spec = expand_spec.to_string();
                guard.reply = Some(tx);
            }
            // SAFETY: Valid Win32 thread ID captured from live hotkey thread.
            if unsafe {
                PostThreadMessageW(self.thread_id, WM_REBIND_HOTKEYS, WPARAM(0), LPARAM(0))
            }
            .is_err()
            {
                return Some("Unable to reach global hotkey thread".into());
            }
            rx.recv_timeout(std::time::Duration::from_millis(500))
                .ok()
                .flatten()
        }
    }

    fn apply_hotkey_binds(pending: &Arc<Mutex<PendingBind>>) -> Option<String> {
        let (hide_spec, expand_spec) = match pending.lock() {
            Ok(g) => (g.hide_spec.clone(), g.expand_spec.clone()),
            Err(_) => return Some("Hotkey state mutex poisoned".into()),
        };

        let mut warnings = Vec::new();
        // SAFETY: Thread-local hotkey unregistration & registration.
        unsafe {
            let _ = UnregisterHotKey(None, HOTKEY_ID_HIDE);
            let _ = UnregisterHotKey(None, HOTKEY_ID_EXPAND);

            if let Some((mods, vk)) = parse_hotkey_spec(&hide_spec) {
                if RegisterHotKey(None, HOTKEY_ID_HIDE, HOT_KEY_MODIFIERS(mods), vk).is_err() {
                    warnings.push(format!("{hide_spec} is unavailable or held by another app"));
                }
            } else {
                warnings.push(format!("Invalid hotkey format: {hide_spec}"));
            }

            if let Some((mods, vk)) = parse_hotkey_spec(&expand_spec) {
                if RegisterHotKey(None, HOTKEY_ID_EXPAND, HOT_KEY_MODIFIERS(mods), vk).is_err() {
                    warnings.push(format!(
                        "{expand_spec} is unavailable or held by another app"
                    ));
                }
            } else {
                warnings.push(format!("Invalid hotkey format: {expand_spec}"));
            }
        }

        if warnings.is_empty() {
            None
        } else {
            Some(warnings.join("; "))
        }
    }

    /// Detects whether another visible foreground application covers the entire monitor (`FR-WIN-4`).
    #[must_use]
    pub fn is_other_app_fullscreen(own_raw_hwnd: isize) -> bool {
        // SAFETY: Win32 read-only queries against foreground HWND and monitor geometry.
        unsafe {
            let fg = GetForegroundWindow();
            if fg.0.is_null() || fg.0 as isize == own_raw_hwnd || !IsWindowVisible(fg).as_bool() {
                return false;
            }

            if IsZoomed(fg).as_bool() {
                return false;
            }

            let mut class_buf = [0u16; 64];
            let len = GetClassNameW(fg, &mut class_buf);
            if len > 0 {
                let class_name = String::from_utf16_lossy(&class_buf[..len as usize]);
                if matches!(
                    class_name.as_str(),
                    "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
                ) {
                    return false;
                }
            }

            let mut win_rect = RECT::default();
            if GetWindowRect(fg, &mut win_rect).is_err() {
                return false;
            }

            let monitor = MonitorFromWindow(fg, MONITOR_DEFAULTTONEAREST);
            let mut mon_info = MONITORINFO {
                cbSize: core::mem::size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            if !GetMonitorInfoW(monitor, &mut mon_info).as_bool() {
                return false;
            }

            let mr = mon_info.rcMonitor;
            win_rect.left == mr.left
                && win_rect.top == mr.top
                && win_rect.right == mr.right
                && win_rect.bottom == mr.bottom
        }
    }

    /// Reads Caps Lock toggle state (`FR-HUD-1`).
    #[must_use]
    pub fn is_caps_lock_on() -> bool {
        // SAFETY: Read-only keyboard toggle query.
        unsafe { (GetKeyState(i32::from(VK_CAPITAL.0)) & 1) != 0 }
    }

    /// Reads battery percentage and AC charging state (`FR-HUD-1`).
    #[must_use]
    pub fn battery_status() -> Option<(u8, bool)> {
        let mut status = SYSTEM_POWER_STATUS::default();
        // SAFETY: Valid pointer to stack-allocated `SYSTEM_POWER_STATUS`.
        if unsafe { GetSystemPowerStatus(&mut status) }.is_err() {
            return None;
        }
        if status.BatteryFlag == 128 || status.BatteryLifePercent > 100 {
            return None;
        }
        let charging = status.ACLineStatus == 1;
        Some((status.BatteryLifePercent, charging))
    }

    /// Opens a file, folder, or URL using the Windows Shell (`FR-SH-2`).
    pub fn open_shell_target(target: &str) -> Result<(), String> {
        let verb = HSTRING::from("open");
        let file = HSTRING::from(target);
        // SAFETY: HSTRING pointers live for the duration of ShellExecuteW call.
        let res = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(file.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if (res.0 as isize) <= 32 {
            return Err("failed to open target via Windows Shell".into());
        }
        Ok(())
    }

    /// Launches the native Windows Snipping Tool capture overlay (`ms-screenclip:`).
    pub fn launch_snipping_screenshot() -> Result<(), String> {
        open_shell_target("ms-screenclip:").or_else(|_| open_shell_target("SnippingTool.exe"))
    }

    /// Launches Windows Snipping Tool video recording mode (`ms-screenclip:?clippingMode=Video`).
    pub fn launch_screen_recording() -> Result<(), String> {
        open_shell_target("ms-screenclip:?clippingMode=Video")
            .or_else(|_| open_shell_target("ms-screenclip:"))
    }

    /// Checks whether user-level Windows webcam access is currently allowed (`KEY_READ` on ConsentStore).
    #[must_use]
    pub fn is_camera_access_allowed() -> bool {
        use windows::Win32::System::Registry::{KEY_READ, REG_SZ, REG_VALUE_TYPE};

        let subkey = HSTRING::from(
            "Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam",
        );
        let mut root = HKEY::default();
        if unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                Some(0),
                KEY_READ,
                &mut root,
            )
        } != ERROR_SUCCESS
        {
            return true;
        }
        let val_name = HSTRING::from("Value");
        let mut buf = [0u16; 32];
        let mut byte_len = (buf.len() * core::mem::size_of::<u16>()) as u32;
        let mut val_type = REG_VALUE_TYPE::default();
        let ok = unsafe {
            RegQueryValueExW(
                root,
                PCWSTR(val_name.as_ptr()),
                None,
                Some(&mut val_type),
                Some(buf.as_mut_ptr().cast::<u8>()),
                Some(&mut byte_len),
            ) == ERROR_SUCCESS
                && val_type == REG_SZ
        };
        let _ = unsafe { RegCloseKey(root) };
        if !ok || byte_len == 0 {
            return true;
        }
        let chars_len = (byte_len as usize / 2).min(buf.len());
        let val = String::from_utf16_lossy(&buf[..chars_len])
            .trim_end_matches('\0')
            .to_ascii_lowercase();
        val != "deny"
    }

    /// Opens the official Windows Camera privacy settings page (`ms-settings:privacy-webcam`).
    pub fn open_camera_privacy_settings() -> Result<(), String> {
        open_shell_target("ms-settings:privacy-webcam")
    }

    /// Checks active camera (ConsentStore `KEY_READ`) and real-time WASAPI active microphone capture sessions.
    #[must_use]
    pub fn privacy_device_status() -> (bool, bool) {
        let webcam = is_consent_device_active(
            "Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam",
        );
        let mic = is_wasapi_mic_capture_active();
        (webcam, mic)
    }

    fn is_wasapi_mic_capture_active() -> bool {
        use windows::Win32::Media::Audio::{
            AudioSessionStateActive, DEVICE_STATE_ACTIVE, IAudioSessionManager2,
            IMMDeviceEnumerator, MMDeviceEnumerator, eCapture,
        };
        use windows::Win32::System::Com::{
            CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx,
        };
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let Ok(enumerator): Result<IMMDeviceEnumerator, _> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            else {
                return false;
            };
            let Ok(collection) = enumerator.EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE)
            else {
                return false;
            };
            let count = collection.GetCount().unwrap_or(0);
            for dev_idx in 0..count {
                let Ok(device) = collection.Item(dev_idx) else {
                    continue;
                };
                let Ok(mgr) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) else {
                    continue;
                };
                let Ok(sessions) = mgr.GetSessionEnumerator() else {
                    continue;
                };
                let sess_count = sessions.GetCount().unwrap_or(0);
                for s_idx in 0..sess_count {
                    let Ok(ctrl) = sessions.GetSession(s_idx) else {
                        continue;
                    };
                    if ctrl.GetState().ok() == Some(AudioSessionStateActive) {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn is_consent_device_active(base_subkey: &str) -> bool {
        use windows::Win32::System::Registry::{
            KEY_READ, REG_QWORD, REG_VALUE_TYPE, RegEnumKeyExW,
        };

        fn check_key(hkey: HKEY, depth: u8) -> bool {
            let mut stop_val = 0u64;
            let mut stop_size = core::mem::size_of::<u64>() as u32;
            let mut val_type = REG_VALUE_TYPE::default();
            let stop_name = HSTRING::from("LastUsedTimeStop");
            // SAFETY: Standard read-only registry query on open HKEY.
            let has_stop = unsafe {
                RegQueryValueExW(
                    hkey,
                    PCWSTR(stop_name.as_ptr()),
                    None,
                    Some(&mut val_type),
                    Some((&mut stop_val as *mut u64).cast::<u8>()),
                    Some(&mut stop_size),
                ) == ERROR_SUCCESS
                    && val_type == REG_QWORD
            };
            if has_stop && stop_val == 0 {
                let mut start_val = 0u64;
                let mut start_size = core::mem::size_of::<u64>() as u32;
                let start_name = HSTRING::from("LastUsedTimeStart");
                let has_start = unsafe {
                    RegQueryValueExW(
                        hkey,
                        PCWSTR(start_name.as_ptr()),
                        None,
                        None,
                        Some((&mut start_val as *mut u64).cast::<u8>()),
                        Some(&mut start_size),
                    ) == ERROR_SUCCESS
                };
                if has_start && start_val > 0 {
                    return true;
                }
            }

            if depth >= 2 {
                return false;
            }

            let mut idx = 0u32;
            loop {
                let mut buf = [0u16; 256];
                let mut len = buf.len() as u32;
                // SAFETY: Enumerating subkeys of an open HKCU key.
                let err = unsafe {
                    RegEnumKeyExW(
                        hkey,
                        idx,
                        Some(windows::core::PWSTR(buf.as_mut_ptr())),
                        &mut len,
                        None,
                        None,
                        None,
                        None,
                    )
                };
                if err != ERROR_SUCCESS {
                    break;
                }
                idx += 1;
                let mut sub = HKEY::default();
                // SAFETY: `buf[..len]` is valid UTF-16 subkey name.
                let sub_wide: Vec<u16> = buf[..len as usize].iter().copied().chain([0]).collect();
                if unsafe {
                    RegOpenKeyExW(hkey, PCWSTR(sub_wide.as_ptr()), Some(0), KEY_READ, &mut sub)
                } == ERROR_SUCCESS
                {
                    let active = check_key(sub, depth + 1);
                    let _ = unsafe { RegCloseKey(sub) };
                    if active {
                        return true;
                    }
                }
            }
            false
        }

        let subkey = HSTRING::from(base_subkey);
        let mut root = HKEY::default();
        // SAFETY: Read-only open under HKCU with KEY_READ so NonPackaged subkeys enumerate.
        if unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                Some(0),
                KEY_READ,
                &mut root,
            )
        } != ERROR_SUCCESS
        {
            return false;
        }
        let active = check_key(root, 0);
        let _ = unsafe { RegCloseKey(root) };
        active
    }

    /// Locks the active Windows workstation session (`LockWorkStation`).
    pub fn lock_workstation() -> Result<(), String> {
        // SAFETY: Standard Win32 user-session lock call with no pointer arguments.
        unsafe {
            windows::Win32::System::Shutdown::LockWorkStation()
                .map_err(|e| format!("LockWorkStation failed: {e}"))
        }
    }

    fn capture_primary_bgra() -> Result<(i32, i32, Vec<u8>), String> {
        use windows::Win32::Graphics::Gdi::{
            BI_RGB, BITMAPINFO, BITMAPINFOHEADER, BitBlt, CreateCompatibleBitmap,
            CreateCompatibleDC, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDC, GetDIBits,
            ReleaseDC, SRCCOPY, SelectObject,
        };
        use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

        // SAFETY: Standard Win32 GDI screen capture of primary display into a top-down BGRA buffer.
        unsafe {
            let w = GetSystemMetrics(SM_CXSCREEN);
            let h = GetSystemMetrics(SM_CYSCREEN);
            if w <= 0 || h <= 0 {
                return Err("invalid screen dimensions".into());
            }
            let screen_dc = GetDC(None);
            let mem_dc = CreateCompatibleDC(Some(screen_dc));
            let bmp = CreateCompatibleBitmap(screen_dc, w, h);
            let old = SelectObject(mem_dc, bmp.into());
            let blit_ok = BitBlt(mem_dc, 0, 0, w, h, Some(screen_dc), 0, 0, SRCCOPY).is_ok();

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: core::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: -h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut pixels = vec![0u8; (w as usize) * (h as usize) * 4];
            let lines = if blit_ok {
                GetDIBits(
                    mem_dc,
                    bmp,
                    0,
                    h as u32,
                    Some(pixels.as_mut_ptr().cast()),
                    &mut bmi,
                    DIB_RGB_COLORS,
                )
            } else {
                0
            };

            SelectObject(mem_dc, old);
            let _ = DeleteObject(bmp.into());
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);

            if lines == 0 {
                return Err("screen capture failed".into());
            }
            Ok((w, h, pixels))
        }
    }

    fn copy_unicode_to_clipboard(text: &str) -> Result<(), String> {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::DataExchange::{
            CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
        };
        use windows::Win32::System::Memory::{
            GMEM_MOVEABLE, GlobalAlloc, GlobalLock, GlobalUnlock,
        };

        const CF_UNICODETEXT: u32 = 13;
        let mut wide: Vec<u16> = text.encode_utf16().collect();
        wide.push(0);
        let byte_len = wide.len() * 2;

        // SAFETY: Standard Win32 clipboard allocation and ownership transfer on success.
        unsafe {
            OpenClipboard(None).map_err(|e| format!("OpenClipboard failed: {e}"))?;
            let _ = EmptyClipboard();
            let Ok(hmem) = GlobalAlloc(GMEM_MOVEABLE, byte_len) else {
                let _ = CloseClipboard();
                return Err("GlobalAlloc failed".into());
            };
            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                let _ = CloseClipboard();
                return Err("GlobalLock failed".into());
            }
            core::ptr::copy_nonoverlapping(wide.as_ptr().cast::<u8>(), ptr.cast::<u8>(), byte_len);
            let _ = GlobalUnlock(hmem);
            if SetClipboardData(CF_UNICODETEXT, Some(HANDLE(hmem.0))).is_err() {
                let _ = CloseClipboard();
                return Err("SetClipboardData failed".into());
            }
            let _ = CloseClipboard();
        }
        Ok(())
    }

    pub fn write_clipboard_text(text: &str) -> Result<(), String> {
        copy_unicode_to_clipboard(text)
    }

    #[must_use]
    pub fn read_clipboard_text() -> Option<String> {
        use windows::Win32::System::DataExchange::{
            CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
        };
        use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};

        const CF_UNICODETEXT: u32 = 13;
        unsafe {
            if IsClipboardFormatAvailable(CF_UNICODETEXT).is_err() {
                return None;
            }
            if OpenClipboard(None).is_err() {
                return None;
            }
            let result = (|| {
                let handle = GetClipboardData(CF_UNICODETEXT).ok()?;
                let hmem = windows::Win32::Foundation::HGLOBAL(handle.0);
                let ptr = GlobalLock(hmem);
                if ptr.is_null() {
                    return None;
                }
                let wide_ptr = ptr.cast::<u16>();
                let mut len = 0usize;
                while len < 4096 && *wide_ptr.add(len) != 0 {
                    len += 1;
                }
                let slice = core::slice::from_raw_parts(wide_ptr, len);
                let text = String::from_utf16_lossy(slice);
                let _ = GlobalUnlock(hmem);
                Some(text)
            })();
            let _ = CloseClipboard();
            result
        }
    }

    pub fn clear_clipboard_if_matching(expected_text: &str) -> bool {
        use windows::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard};

        let Some(current) = read_clipboard_text() else {
            return false;
        };
        if current.trim() != expected_text.trim() {
            return false;
        }
        unsafe {
            if OpenClipboard(None).is_err() {
                return false;
            }
            let cleared = EmptyClipboard().is_ok();
            let _ = CloseClipboard();
            cleared
        }
    }

    #[must_use]
    pub fn quick_radios_status() -> (Option<bool>, Option<bool>) {
        use windows::Devices::Radios::{Radio, RadioKind, RadioState};

        let Ok(op) = Radio::GetRadiosAsync() else {
            return (None, None);
        };
        let Ok(radios) = op.join() else {
            return (None, None);
        };
        let mut wifi: Option<bool> = None;
        let mut bt: Option<bool> = None;
        for radio in radios {
            let Ok(kind) = radio.Kind() else {
                continue;
            };
            let is_on = radio.State().ok().map(|s| s == RadioState::On);
            if kind == RadioKind::WiFi {
                wifi = is_on;
            } else if kind == RadioKind::Bluetooth {
                bt = is_on;
            }
        }
        (wifi, bt)
    }

    pub fn toggle_radio_kind(wifi: bool) -> Result<bool, String> {
        use windows::Devices::Radios::{Radio, RadioAccessStatus, RadioKind, RadioState};

        let _ = Radio::RequestAccessAsync()
            .map_err(|e| format!("radio access request failed: {e}"))?
            .join()
            .map_err(|e| format!("radio access join failed: {e}"))?;
        let radios = Radio::GetRadiosAsync()
            .map_err(|e| format!("enumerate radios failed: {e}"))?
            .join()
            .map_err(|e| format!("enumerate radios join failed: {e}"))?;
        let target_kind = if wifi {
            RadioKind::WiFi
        } else {
            RadioKind::Bluetooth
        };
        for radio in radios {
            if radio.Kind().ok() == Some(target_kind) {
                let current = radio.State().unwrap_or(RadioState::Off);
                let next = if current == RadioState::On {
                    RadioState::Off
                } else {
                    RadioState::On
                };
                let status = radio
                    .SetStateAsync(next)
                    .map_err(|e| format!("set radio state failed: {e}"))?
                    .join()
                    .map_err(|e| format!("set radio state join failed: {e}"))?;
                if status != RadioAccessStatus::Allowed {
                    return Err("radio control denied by Windows".into());
                }
                return Ok(next == RadioState::On);
            }
        }
        Err("requested radio adapter not found".into())
    }

    static KEEP_AWAKE_TX: std::sync::OnceLock<std::sync::mpsc::Sender<bool>> =
        std::sync::OnceLock::new();
    static KEEP_AWAKE_ACTIVE: std::sync::atomic::AtomicBool =
        std::sync::atomic::AtomicBool::new(false);

    /// Controls Windows display/system idle sleep prevention on a persistent thread (`SetThreadExecutionState`).
    pub fn set_keep_awake(enabled: bool) -> bool {
        use std::sync::atomic::Ordering;
        use windows::Win32::System::Power::{
            ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED, SetThreadExecutionState,
        };

        KEEP_AWAKE_ACTIVE.store(enabled, Ordering::Relaxed);
        let tx = KEEP_AWAKE_TX.get_or_init(|| {
            let (tx, rx) = std::sync::mpsc::channel::<bool>();
            let _ = std::thread::Builder::new()
                .name("lumen-keep-awake".into())
                .spawn(move || {
                    while let Ok(on) = rx.recv() {
                        unsafe {
                            let flags = if on {
                                ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
                            } else {
                                ES_CONTINUOUS
                            };
                            let _ = SetThreadExecutionState(flags);
                        }
                    }
                });
            tx
        });
        let _ = tx.send(enabled);
        enabled
    }

    #[must_use]
    pub fn is_keep_awake() -> bool {
        KEEP_AWAKE_ACTIVE.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Reads current Windows Geolocation coordinates using fast OS cached/timed lookup.
    pub fn get_windows_location_opt_in() -> Result<(f64, f64), String> {
        use windows::Devices::Geolocation::{Geolocator, PositionAccuracy};
        use windows::Foundation::TimeSpan;

        let locator = Geolocator::new().map_err(|e| format!("Geolocator init failed: {e}"))?;
        let _ = locator.SetDesiredAccuracy(PositionAccuracy::Default);
        let max_age = TimeSpan {
            Duration: 10 * 60 * 10_000_000,
        };
        let timeout = TimeSpan {
            Duration: 5 * 10_000_000,
        };
        let pos = locator
            .GetGeopositionAsyncWithAgeAndTimeout(max_age, timeout)
            .map_err(|e| format!("GetGeopositionAsyncWithAgeAndTimeout failed: {e}"))?
            .join()
            .map_err(|e| format!("Geoposition join failed: {e}"))?;
        let coord = pos
            .Coordinate()
            .map_err(|e| format!("Coordinate failed: {e}"))?;
        let point = coord.Point().map_err(|e| format!("Point failed: {e}"))?;
        let basic = point
            .Position()
            .map_err(|e| format!("Position failed: {e}"))?;
        if !basic.Latitude.is_finite() || !basic.Longitude.is_finite() {
            return Err("invalid non-finite geolocation coordinates".into());
        }
        Ok((basic.Latitude, basic.Longitude))
    }

    /// Fetches local current temperature and 15-min precipitation forecast from Open-Meteo.
    pub fn fetch_open_meteo_weather(
        city: &str,
        lat: f64,
        lon: f64,
    ) -> Result<crate::OpenMeteoWeather, String> {
        use windows::Foundation::Uri;
        use windows::Web::Http::HttpClient;

        let url = format!(
            "https://api.open-meteo.com/v1/forecast?latitude={lat:.4}&longitude={lon:.4}&current=temperature_2m,weather_code&minutely_15=precipitation&forecast_minutely_15=4&timezone=auto"
        );
        let uri = Uri::CreateUri(&HSTRING::from(url)).map_err(|e| format!("uri error: {e}"))?;
        let client = HttpClient::new().map_err(|e| format!("http client error: {e}"))?;
        let body = client
            .GetStringAsync(&uri)
            .map_err(|e| format!("weather request failed: {e}"))?
            .join()
            .map_err(|e| format!("weather fetch failed: {e}"))?
            .to_string_lossy()
            .to_string();

        let json: serde_json::Value =
            serde_json::from_str(&body).map_err(|e| format!("invalid weather json: {e}"))?;
        let temp_c = json["current"]["temperature_2m"]
            .as_f64()
            .ok_or_else(|| "missing temperature_2m".to_string())?;
        let code = json["current"]["weather_code"].as_i64().unwrap_or(0) as i32;
        let condition = match code {
            0 | 1 => "clear",
            2 | 3 | 45 | 48 => "cloudy",
            51..=67 | 80..=82 => "rain",
            95..=99 => "storm",
            _ => "clear",
        }
        .to_string();

        let mut precip_note = None;
        if let Some(arr) = json["minutely_15"]["precipitation"].as_array() {
            for (idx, v) in arr.iter().enumerate() {
                if v.as_f64().unwrap_or(0.0) >= 0.1 {
                    let mins = (idx as i32 + 1) * 15;
                    precip_note = Some(format!("rain in {mins} min"));
                    break;
                }
            }
        }

        Ok(crate::OpenMeteoWeather {
            temp_c,
            weather_code: code,
            condition,
            precip_note,
            city: city.to_string(),
            fetched_at: chrono::Utc::now().to_rfc3339(),
            offline: false,
        })
    }

    /// Captures the primary screen, writes a PNG file to `output_path`, and copies its path.
    pub fn capture_screen_to_png(output_path: &std::path::Path) -> Result<String, String> {
        use windows::Graphics::Imaging::{BitmapAlphaMode, BitmapEncoder, BitmapPixelFormat};
        use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

        let (w, h, pixels) = capture_primary_bgra()?;
        if let Some(parent) = output_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let stream =
            InMemoryRandomAccessStream::new().map_err(|e| format!("create stream failed: {e}"))?;
        let encoder = BitmapEncoder::CreateAsync(
            BitmapEncoder::PngEncoderId().map_err(|e| e.to_string())?,
            &stream,
        )
        .map_err(|e| format!("BitmapEncoder::CreateAsync failed: {e}"))?
        .join()
        .map_err(|e| format!("BitmapEncoder join failed: {e}"))?;
        encoder
            .SetPixelData(
                BitmapPixelFormat::Bgra8,
                BitmapAlphaMode::Ignore,
                w as u32,
                h as u32,
                96.0,
                96.0,
                &pixels,
            )
            .map_err(|e| format!("SetPixelData failed: {e}"))?;
        encoder
            .FlushAsync()
            .map_err(|e| format!("FlushAsync failed: {e}"))?
            .join()
            .map_err(|e| format!("FlushAsync join failed: {e}"))?;

        let size = stream.Size().map_err(|e| e.to_string())? as usize;
        let _ = stream.Seek(0);
        let reader = windows::Storage::Streams::DataReader::CreateDataReader(&stream)
            .map_err(|e| e.to_string())?;
        reader
            .LoadAsync(size as u32)
            .map_err(|e| e.to_string())?
            .join()
            .map_err(|e| e.to_string())?;
        let mut png_bytes = vec![0u8; size];
        reader
            .ReadBytes(&mut png_bytes)
            .map_err(|e| e.to_string())?;
        drop(DataWriter::new());
        std::fs::write(output_path, &png_bytes).map_err(|e| format!("write png failed: {e}"))?;
        Ok(output_path.to_string_lossy().to_string())
    }

    /// Runs offline Windows WinRT OCR (`Windows.Media.Ocr`) on the current screen and copies text to clipboard.
    pub fn ocr_screen_to_clipboard() -> Result<String, String> {
        use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
        use windows::Media::Ocr::OcrEngine;
        use windows::Storage::Streams::DataWriter;

        let (w, h, pixels) = capture_primary_bgra()?;
        let writer = DataWriter::new().map_err(|e| format!("DataWriter failed: {e}"))?;
        writer
            .WriteBytes(&pixels)
            .map_err(|e| format!("WriteBytes failed: {e}"))?;
        let buffer = writer
            .DetachBuffer()
            .map_err(|e| format!("DetachBuffer failed: {e}"))?;
        let bitmap = SoftwareBitmap::CreateCopyFromBuffer(&buffer, BitmapPixelFormat::Bgra8, w, h)
            .map_err(|e| format!("SoftwareBitmap failed: {e}"))?;

        let engine = OcrEngine::TryCreateFromUserProfileLanguages()
            .map_err(|e| format!("OCR engine unavailable: {e}"))?;
        let result = engine
            .RecognizeAsync(&bitmap)
            .map_err(|e| format!("RecognizeAsync failed: {e}"))?
            .join()
            .map_err(|e| format!("OCR join failed: {e}"))?;
        let text = result
            .Text()
            .map(|t| t.to_string_lossy().trim().to_string())
            .unwrap_or_default();
        if !text.is_empty() {
            let _ = copy_unicode_to_clipboard(&text);
        }
        Ok(text)
    }

    /// Atomically moves and resizes an overlay HWND in a single DWM frame without cursor flicker.
    pub fn set_window_bounds_atomic(raw_hwnd: isize, x: i32, y: i32, width: i32, height: i32) {
        if raw_hwnd == 0 {
            return;
        }
        // SAFETY: Valid HWND belonging to our Tauri overlay window.
        let _ = unsafe {
            SetWindowPos(
                HWND(raw_hwnd as *mut core::ffi::c_void),
                None,
                x,
                y,
                width,
                height,
                SWP_NOZORDER | SWP_NOACTIVATE,
            )
        };
    }

    const WS_EX_LAYERED_FLAG: isize = 0x00080000;
    const WS_EX_TRANSPARENT_FLAG: isize = 0x00000020;
    const GWL_EXSTYLE_INDEX: windows::Win32::UI::WindowsAndMessaging::WINDOW_LONG_PTR_INDEX =
        windows::Win32::UI::WindowsAndMessaging::GWL_EXSTYLE;

    /// Toggles click pass-through on the overlay window (`WS_EX_TRANSPARENT`).
    /// When pass_through is true, mouse clicks pass directly to underlying applications (Chrome, Desktop, etc).
    /// When false, mouse clicks are handled by the Island.
    pub fn set_click_through(raw_hwnd: isize, pass_through: bool) {
        if raw_hwnd == 0 {
            return;
        }
        let hwnd = HWND(raw_hwnd as *mut core::ffi::c_void);
        unsafe {
            use windows::Win32::UI::WindowsAndMessaging::{
                GetWindowLongPtrW, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
                SWP_NOZORDER, SetWindowLongPtrW, SetWindowPos,
            };
            let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE_INDEX);
            let target = if pass_through {
                current | WS_EX_LAYERED_FLAG | WS_EX_TRANSPARENT_FLAG
            } else {
                (current | WS_EX_LAYERED_FLAG) & !WS_EX_TRANSPARENT_FLAG
            };
            if current != target {
                SetWindowLongPtrW(hwnd, GWL_EXSTYLE_INDEX, target);
                let _ = SetWindowPos(
                    hwnd,
                    None,
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
                );
            }
        }
    }

    /// Clips the OS window's hit-testable & DWM region to the exact active pill rectangle
    /// (in window-relative physical pixels) so surrounding transparent canvas pixels
    /// are completely non-existent to mouse events and never block apps behind the notch.
    pub fn set_window_pill_region(
        raw_hwnd: isize,
        rel_x: i32,
        rel_y: i32,
        width: i32,
        height: i32,
        corner_radius_px: i32,
        visible: bool,
    ) {
        if raw_hwnd == 0 {
            return;
        }
        let hwnd = HWND(raw_hwnd as *mut core::ffi::c_void);
        unsafe {
            use windows::Win32::Foundation::POINT;
            use windows::Win32::Graphics::Gdi::{
                CombineRgn, CreatePolygonRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject,
                RGN_OR, SetWindowRgn, WINDING,
            };
            let hrgn = if !visible || width <= 0 || height <= 0 {
                CreateRectRgn(0, 0, 0, 0)
            } else if corner_radius_px > 0 {
                let diam = corner_radius_px * 2;
                let rgn_round =
                    CreateRoundRectRgn(rel_x, rel_y, rel_x + width, rel_y + height, diam, diam);
                // In flush-top Notch mode (rel_y <= 0), keep the top corners square and use
                // tight curved polygons for the concave top ears so no rectangular corner
                // artifacts ever appear when clicking/focusing the island.
                if rel_y <= 0 && !rgn_round.is_invalid() {
                    let top_strip_h = corner_radius_px.min(height);
                    let rgn_top = CreateRectRgn(rel_x, rel_y, rel_x + width, rel_y + top_strip_h);
                    if !rgn_top.is_invalid() {
                        let _ = CombineRgn(Some(rgn_round), Some(rgn_round), Some(rgn_top), RGN_OR);
                        let _ = DeleteObject(rgn_top.into());
                    }
                    let ear = (corner_radius_px * 3 / 4).clamp(16, 24).min(height);
                    let left_pts = [
                        POINT {
                            x: rel_x - ear,
                            y: rel_y,
                        },
                        POINT {
                            x: rel_x + 2,
                            y: rel_y,
                        },
                        POINT {
                            x: rel_x + 2,
                            y: rel_y + ear,
                        },
                        POINT {
                            x: rel_x - ear / 4,
                            y: rel_y + ear / 2,
                        },
                    ];
                    let rgn_left_ear = CreatePolygonRgn(&left_pts, WINDING);
                    if !rgn_left_ear.is_invalid() {
                        let _ = CombineRgn(
                            Some(rgn_round),
                            Some(rgn_round),
                            Some(rgn_left_ear),
                            RGN_OR,
                        );
                        let _ = DeleteObject(rgn_left_ear.into());
                    }
                    let right_pts = [
                        POINT {
                            x: rel_x + width - 2,
                            y: rel_y,
                        },
                        POINT {
                            x: rel_x + width + ear,
                            y: rel_y,
                        },
                        POINT {
                            x: rel_x + width + ear / 4,
                            y: rel_y + ear / 2,
                        },
                        POINT {
                            x: rel_x + width - 2,
                            y: rel_y + ear,
                        },
                    ];
                    let rgn_right_ear = CreatePolygonRgn(&right_pts, WINDING);
                    if !rgn_right_ear.is_invalid() {
                        let _ = CombineRgn(
                            Some(rgn_round),
                            Some(rgn_round),
                            Some(rgn_right_ear),
                            RGN_OR,
                        );
                        let _ = DeleteObject(rgn_right_ear.into());
                    }
                }
                rgn_round
            } else {
                CreateRectRgn(rel_x, rel_y, rel_x + width, rel_y + height)
            };
            if !hrgn.is_invalid() && SetWindowRgn(hwnd, Some(hrgn), false) == 0 {
                let _ = DeleteObject(hrgn.into());
            }
        }
    }
}

#[cfg(not(windows))]
mod win32 {
    use crate::HotkeyAction;

    pub const fn set_window_bounds_atomic(
        _raw_hwnd: isize,
        _x: i32,
        _y: i32,
        _width: i32,
        _height: i32,
    ) {
    }

    pub const fn set_click_through(_raw_hwnd: isize, _pass_through: bool) {}

    pub const fn set_window_pill_region(
        _raw_hwnd: isize,
        _rel_x: i32,
        _rel_y: i32,
        _width: i32,
        _height: i32,
        _corner_radius_px: i32,
        _visible: bool,
    ) {
    }

    #[must_use]
    pub const fn acquire_single_instance_mutex() -> bool {
        true
    }

    #[must_use]
    pub const fn cursor_screen_pos() -> Option<(i32, i32)> {
        None
    }

    #[must_use]
    pub const fn is_autostart_enabled() -> bool {
        false
    }

    pub fn set_autostart_enabled(_enabled: bool, _exe_path: &str) -> Result<(), String> {
        Ok(())
    }

    pub struct GlobalHotkeyManager;

    impl GlobalHotkeyManager {
        pub fn start<F>(
            _hide_spec: &str,
            _expand_spec: &str,
            _on_hotkey: F,
        ) -> Result<(Self, Option<String>), String>
        where
            F: Fn(HotkeyAction) + Send + Sync + 'static,
        {
            Ok((Self, None))
        }

        pub fn rebind(&self, _hide_spec: &str, _expand_spec: &str) -> Option<String> {
            None
        }
    }

    #[must_use]
    pub const fn is_other_app_fullscreen(_own_raw_hwnd: isize) -> bool {
        false
    }

    #[must_use]
    pub const fn is_caps_lock_on() -> bool {
        false
    }

    #[must_use]
    pub const fn battery_status() -> Option<(u8, bool)> {
        None
    }

    pub fn open_shell_target(_target: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn launch_snipping_screenshot() -> Result<(), String> {
        Ok(())
    }

    pub fn launch_screen_recording() -> Result<(), String> {
        Ok(())
    }

    #[must_use]
    pub const fn is_camera_access_allowed() -> bool {
        true
    }

    pub fn open_camera_privacy_settings() -> Result<(), String> {
        Ok(())
    }

    pub fn lock_workstation() -> Result<(), String> {
        Ok(())
    }

    pub fn capture_screen_to_png(output_path: &std::path::Path) -> Result<String, String> {
        Ok(output_path.to_string_lossy().to_string())
    }

    pub fn ocr_screen_to_clipboard() -> Result<String, String> {
        Ok(String::new())
    }

    #[must_use]
    pub const fn privacy_device_status() -> (bool, bool) {
        (false, false)
    }

    pub fn write_clipboard_text(_text: &str) -> Result<(), String> {
        Ok(())
    }

    #[must_use]
    pub const fn read_clipboard_text() -> Option<String> {
        None
    }

    pub const fn clear_clipboard_if_matching(_expected_text: &str) -> bool {
        false
    }

    #[must_use]
    pub const fn quick_radios_status() -> (Option<bool>, Option<bool>) {
        (None, None)
    }

    pub fn toggle_radio_kind(_wifi: bool) -> Result<bool, String> {
        Err("unavailable".into())
    }

    pub const fn set_keep_awake(_enabled: bool) -> bool {
        false
    }

    #[must_use]
    pub const fn is_keep_awake() -> bool {
        false
    }

    pub fn get_windows_location_opt_in() -> Result<(f64, f64), String> {
        Err("unavailable".into())
    }

    pub fn fetch_open_meteo_weather(
        _city: &str,
        _lat: f64,
        _lon: f64,
    ) -> Result<crate::OpenMeteoWeather, String> {
        Err("unavailable".into())
    }
}

pub use win32::{
    GlobalHotkeyManager, acquire_single_instance_mutex, battery_status, capture_screen_to_png,
    clear_clipboard_if_matching, cursor_screen_pos, fetch_open_meteo_weather,
    get_windows_location_opt_in, is_autostart_enabled, is_camera_access_allowed, is_caps_lock_on,
    is_keep_awake, is_other_app_fullscreen, launch_screen_recording, launch_snipping_screenshot,
    lock_workstation, ocr_screen_to_clipboard, open_camera_privacy_settings, open_shell_target,
    privacy_device_status, quick_radios_status, read_clipboard_text, set_autostart_enabled,
    set_click_through, set_keep_awake, set_window_bounds_atomic, set_window_pill_region,
    toggle_radio_kind, write_clipboard_text,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centers_window_at_top_of_1920x1080_monitor() {
        let (x, y) = compute_top_center_position(0, 0, 1920, 260);
        assert_eq!(x, 830);
        assert_eq!(y, 0);
    }

    #[test]
    fn supports_secondary_monitor_offset() {
        let (x, y) = compute_top_center_position(-1920, 0, 1920, 260);
        assert_eq!(x, -1090);
        assert_eq!(y, 0);
    }

    #[test]
    fn pill_hit_test_allows_clicks_outside_pill_over_browser_tabs() {
        let rect = compute_pill_screen_rect(830, 0, 260, 200, 32, 0);
        assert_eq!(rect.x, 860);
        assert_eq!(rect.y, 0);
        assert!(rect.contains_point(960, 16, 4));
        assert!(!rect.contains_point(650, 16, 4));
        assert!(!rect.contains_point(1200, 16, 4));
        assert!(!rect.contains_point(960, 80, 4));
    }

    #[test]
    fn handles_negative_secondary_monitor_pill_hit_test() {
        let rect = compute_pill_screen_rect(-1090, 0, 260, 200, 32, 8);
        assert!(rect.contains_point(-960, 20, 2));
        assert!(!rect.contains_point(-960, 2, 2));
    }

    #[test]
    fn parses_global_hotkey_specs_with_modifiers_and_keys() {
        let space = parse_hotkey_spec("Ctrl+Alt+Space").expect("valid chord");
        assert_eq!(space, (0x4000 | 0x0002 | 0x0001, 0x20));

        let letter = parse_hotkey_spec("Ctrl+Alt+L").expect("valid letter chord");
        assert_eq!(letter, (0x4000 | 0x0002 | 0x0001, u32::from(b'L')));

        let fn_key = parse_hotkey_spec("Shift+Win+F9").expect("valid fn chord");
        assert_eq!(fn_key, (0x4000 | 0x0004 | 0x0008, 0x78));

        assert!(parse_hotkey_spec("Space").is_none());
        assert!(parse_hotkey_spec("Ctrl+Alt+UnknownKey").is_none());
    }

    #[test]
    fn masks_otp_and_secret_clipboard_items() {
        let otp = classify_and_mask_clipboard("482910");
        assert!(otp.sensitive);
        assert_eq!(otp.display_text, "OTP 482 •••");

        let msg = classify_and_mask_clipboard("Your verification code is 719304");
        assert!(msg.sensitive);
        assert_eq!(msg.display_text, "OTP 719 •••");

        let plain = classify_and_mask_clipboard("Standup meeting notes");
        assert!(!plain.sensitive);
        assert_eq!(plain.display_text, "Standup meeting notes");
    }
}

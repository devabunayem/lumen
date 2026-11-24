/// Physical screen rectangle of the active visible island surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PillRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
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
    use windows::Win32::Foundation::{HWND, POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromWindow,
    };
    use windows::Win32::UI::Shell::{
        QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN, SHQueryUserNotificationState,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GWL_EXSTYLE, GetClassNameW, GetCursorPos, GetForegroundWindow, GetWindowLongPtrW,
        GetWindowRect, IsZoomed, SetWindowLongPtrW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    /// Configures the Tauri window as a non-activating tool window (`FR-WIN-1`, `FR-WIN-3`).
    pub fn apply_tool_window_no_activate(raw_hwnd: isize) -> Result<(), String> {
        let hwnd = HWND(raw_hwnd as *mut core::ffi::c_void);
        // SAFETY: `hwnd` is a valid top-level window handle owned by the calling process.
        unsafe {
            let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let next = current | (WS_EX_TOOLWINDOW.0 as isize) | (WS_EX_NOACTIVATE.0 as isize);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        }
        Ok(())
    }

    /// Toggles `WS_EX_NOACTIVATE` dynamically when a text input requests focus (`FR-WIN-3`).
    pub fn set_no_activate(raw_hwnd: isize, no_activate: bool) {
        let hwnd = HWND(raw_hwnd as *mut core::ffi::c_void);
        // SAFETY: `hwnd` is owned by the calling process and updated on demand.
        unsafe {
            let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let flag = WS_EX_NOACTIVATE.0 as isize;
            let next = if no_activate {
                current | flag
            } else {
                current & !flag
            };
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        }
    }

    /// Reads the current global cursor position in physical screen coordinates (`FR-WIN-2`).
    #[must_use]
    pub fn cursor_screen_pos() -> Option<(i32, i32)> {
        let mut pt = POINT::default();
        // SAFETY: `pt` points to valid stack-allocated `POINT`.
        unsafe { GetCursorPos(&mut pt).ok() }.map(|()| (pt.x, pt.y))
    }

    /// Detects whether another application is running fullscreen on the monitor (`FR-WIN-4`).
    #[must_use]
    pub fn is_other_app_fullscreen(own_raw_hwnd: isize) -> bool {
        // SAFETY: Win32 read-only queries against foreground HWND and monitor geometry.
        unsafe {
            let fg = GetForegroundWindow();
            if fg.0.is_null() || fg.0 as isize == own_raw_hwnd {
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
            let is_exact_fullscreen = !IsZoomed(fg).as_bool()
                && win_rect.left == mr.left
                && win_rect.top == mr.top
                && win_rect.right == mr.right
                && win_rect.bottom == mr.bottom;

            if is_exact_fullscreen {
                return true;
            }

            if let Ok(state) = SHQueryUserNotificationState() {
                return matches!(state, QUNS_RUNNING_D3D_FULL_SCREEN | QUNS_PRESENTATION_MODE);
            }

            false
        }
    }
}

#[cfg(not(windows))]
mod win32 {
    pub fn apply_tool_window_no_activate(_raw_hwnd: isize) -> Result<(), String> {
        Ok(())
    }

    pub fn set_no_activate(_raw_hwnd: isize, _no_activate: bool) {}

    #[must_use]
    pub const fn cursor_screen_pos() -> Option<(i32, i32)> {
        None
    }

    #[must_use]
    pub const fn is_other_app_fullscreen(_own_raw_hwnd: isize) -> bool {
        false
    }
}

pub use win32::{
    apply_tool_window_no_activate, cursor_screen_pos, is_other_app_fullscreen, set_no_activate,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centers_window_at_top_of_1920x1080_monitor() {
        let (x, y) = compute_top_center_position(0, 0, 1920, 700);
        assert_eq!(x, 610);
        assert_eq!(y, 0);
    }

    #[test]
    fn supports_secondary_monitor_offset() {
        let (x, y) = compute_top_center_position(-1920, 0, 1920, 700);
        assert_eq!(x, -1310);
        assert_eq!(y, 0);
    }

    #[test]
    fn pill_hit_test_allows_clicks_outside_pill_over_browser_tabs() {
        let rect = compute_pill_screen_rect(610, 0, 700, 200, 32, 0);
        assert_eq!(rect.x, 860);
        assert_eq!(rect.y, 0);
        assert!(rect.contains_point(960, 16, 4));
        // Far left/right inside transparent 700px canvas must remain click-through
        assert!(!rect.contains_point(650, 16, 4));
        assert!(!rect.contains_point(1200, 16, 4));
        assert!(!rect.contains_point(960, 80, 4));
    }

    #[test]
    fn handles_negative_secondary_monitor_pill_hit_test() {
        let rect = compute_pill_screen_rect(-1310, 0, 700, 200, 32, 8);
        assert!(rect.contains_point(-960, 20, 2));
        assert!(!rect.contains_point(-960, 2, 2));
    }
}

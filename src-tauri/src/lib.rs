use std::sync::{Arc, Mutex};
use std::time::Duration;

use lumen_core::{IslandEvent, IslandMachine, IslandSnapshot};
use lumen_windows::{
    compute_pill_screen_rect, compute_top_center_position, cursor_screen_pos, init_island_window,
    is_other_app_fullscreen, set_no_activate, set_window_click_through,
};
use serde::Serialize;
use tauri::{Emitter, Manager, PhysicalPosition, State};

#[derive(Debug, Clone, Copy)]
struct ActivePillBounds {
    width_logical: f64,
    height_logical: f64,
    top_offset_logical: f64,
    visible: bool,
    hide_in_fullscreen: bool,
}

impl Default for ActivePillBounds {
    fn default() -> Self {
        Self {
            width_logical: 200.0,
            height_logical: 32.0,
            top_offset_logical: 0.0,
            visible: true,
            hide_in_fullscreen: true,
        }
    }
}

struct AppState {
    machine: Mutex<IslandMachine>,
    bounds: Arc<Mutex<ActivePillBounds>>,
}

#[derive(Debug, Clone, Serialize)]
struct FullscreenChangedPayload {
    active: bool,
}

#[tauri::command]
fn get_island_snapshot(state: State<'_, AppState>) -> Result<IslandSnapshot, String> {
    let guard = state
        .machine
        .lock()
        .map_err(|_| "island state mutex poisoned".to_string())?;
    Ok(guard.snapshot())
}

#[tauri::command]
fn dispatch_island_event(
    event_name: String,
    state: State<'_, AppState>,
) -> Result<IslandSnapshot, String> {
    let event = IslandEvent::from_command(&event_name)
        .ok_or_else(|| format!("unknown island event: {event_name}"))?;
    let mut guard = state
        .machine
        .lock()
        .map_err(|_| "island state mutex poisoned".to_string())?;
    guard.apply(event);
    Ok(guard.snapshot())
}

#[tauri::command]
fn sync_pill_bounds(
    width: f64,
    height: f64,
    top_offset: f64,
    visible: bool,
    hide_in_fullscreen: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state
        .bounds
        .lock()
        .map_err(|_| "pill bounds mutex poisoned".to_string())?;
    guard.width_logical = width.max(0.0);
    guard.height_logical = height.max(0.0);
    guard.top_offset_logical = top_offset.max(0.0);
    guard.visible = visible;
    guard.hide_in_fullscreen = hide_in_fullscreen;
    Ok(())
}

#[tauri::command]
fn request_keyboard_focus(focused: bool, app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("island") {
        #[cfg(windows)]
        if let Ok(hwnd) = window.hwnd() {
            set_no_activate(hwnd.0 as isize, !focused);
        }
        if focused {
            let _ = window.set_focus();
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_bounds = Arc::new(Mutex::new(ActivePillBounds::default()));

    tauri::Builder::default()
        .manage(AppState {
            machine: Mutex::new(IslandMachine::new()),
            bounds: Arc::clone(&shared_bounds),
        })
        .setup(move |app| {
            let Some(window) = app.get_webview_window("island") else {
                return Ok(());
            };

            let (mut target_x, mut target_y) = (0, 0);
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let monitor_pos = monitor.position();
                let monitor_size = monitor.size();
                let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
                    width: 700,
                    height: 250,
                });
                let (x, y) = compute_top_center_position(
                    monitor_pos.x,
                    monitor_pos.y,
                    monitor_size.width as i32,
                    window_size.width as i32,
                );
                target_x = x;
                target_y = y;
                let _ = window.set_position(PhysicalPosition::new(x, y));
            }

            #[cfg(windows)]
            let own_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
            #[cfg(not(windows))]
            let own_hwnd = 0isize;

            if own_hwnd != 0 {
                let _ = init_island_window(own_hwnd, target_x, target_y);
            }
            let _ = window.show();

            let hit_window = window.clone();
            let hit_bounds = Arc::clone(&shared_bounds);
            tauri::async_runtime::spawn(async move {
                let mut last_ignore = true;
                let mut last_fullscreen = false;
                let mut tick_counter: u8 = 0;

                loop {
                    let snapshot = hit_bounds.lock().map(|g| *g).unwrap_or_default();

                    let scale = hit_window.scale_factor().unwrap_or(1.0);
                    let pos = hit_window.outer_position().ok();
                    let size = hit_window.outer_size().ok();

                    let mut near_top_band = false;
                    let mut should_ignore = true;

                    if snapshot.visible
                        && !last_fullscreen
                        && let (Some(win_pos), Some(win_size), Some((cx, cy))) =
                            (pos, size, cursor_screen_pos())
                    {
                        near_top_band = cy <= win_pos.y + (280.0 * scale).round() as i32;
                        let pill_rect = compute_pill_screen_rect(
                            win_pos.x,
                            win_pos.y,
                            win_size.width as i32,
                            (snapshot.width_logical * scale).round() as i32,
                            (snapshot.height_logical * scale).round() as i32,
                            (snapshot.top_offset_logical * scale).round() as i32,
                        );
                        let margin = (4.0 * scale).round() as i32;
                        should_ignore = !pill_rect.contains_point(cx, cy, margin);
                    }

                    if should_ignore != last_ignore && own_hwnd != 0 {
                        set_window_click_through(own_hwnd, should_ignore);
                        last_ignore = should_ignore;
                    }

                    tick_counter = tick_counter.wrapping_add(1);
                    if tick_counter.is_multiple_of(5) {
                        let fullscreen = if snapshot.hide_in_fullscreen {
                            is_other_app_fullscreen(own_hwnd)
                        } else {
                            false
                        };
                        if fullscreen != last_fullscreen {
                            last_fullscreen = fullscreen;
                            let _ = hit_window.emit(
                                "lumen://fullscreen-changed",
                                FullscreenChangedPayload { active: fullscreen },
                            );
                            if fullscreen && !last_ignore && own_hwnd != 0 {
                                set_window_click_through(own_hwnd, true);
                                last_ignore = true;
                            }
                        }
                    }

                    // 10 Hz when idle away from top band (NFR-PERF-3), 30 Hz near the pill for crisp hover
                    let interval = if near_top_band {
                        Duration::from_millis(33)
                    } else {
                        Duration::from_millis(100)
                    };
                    tokio::time::sleep(interval).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_island_snapshot,
            dispatch_island_event,
            sync_pill_bounds,
            request_keyboard_focus
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}

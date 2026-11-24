use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Utc;
use lumen_core::{IslandEvent, IslandMachine, IslandSnapshot};
use lumen_media::{
    MediaCommand, MediaStateSnapshot, read_media_state, seek_media, send_media_command,
    set_system_volume,
};
use lumen_prayer::{
    BANGLADESH_CITIES, PrayerCityPreset, PrayerConfig, PrayerSchedule, compute_prayer_schedule,
};
use lumen_storage::{StorageRepo, TaskItem, WaterSummary};
use lumen_windows::{compute_top_center_position, is_other_app_fullscreen};
use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, LogicalSize, Manager, PhysicalPosition, State, WebviewWindow};

const COLLAPSED_WIN_W: f64 = 260.0;
const COLLAPSED_WIN_H: f64 = 52.0;
const EXPANDED_WIN_W: f64 = 660.0;
const EXPANDED_WIN_H: f64 = 220.0;

#[derive(Debug, Clone, Copy)]
struct IslandRuntimeConfig {
    hide_in_fullscreen: bool,
    visible: bool,
}

impl Default for IslandRuntimeConfig {
    fn default() -> Self {
        Self {
            hide_in_fullscreen: true,
            visible: true,
        }
    }
}

struct AppState {
    machine: Mutex<IslandMachine>,
    config: Arc<Mutex<IslandRuntimeConfig>>,
    preferred_media_app: Arc<Mutex<Option<String>>>,
    storage: Arc<StorageRepo>,
    prayer_config: Mutex<PrayerConfig>,
}

#[derive(Debug, Clone, Serialize)]
struct FullscreenChangedPayload {
    active: bool,
}

fn recenter_window(window: &WebviewWindow, logical_width: f64, logical_height: f64) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let _ = window.set_size(LogicalSize::new(logical_width, logical_height));

    if let Ok(Some(monitor)) = window.primary_monitor() {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let phys_w = (logical_width * scale).round() as i32;
        let (x, y) = compute_top_center_position(
            monitor_pos.x,
            monitor_pos.y,
            monitor_size.width as i32,
            phys_w,
        );
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
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
    _width: f64,
    _height: f64,
    _top_offset: f64,
    visible: bool,
    hide_in_fullscreen: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state
        .config
        .lock()
        .map_err(|_| "runtime config mutex poisoned".to_string())?;
    guard.visible = visible;
    guard.hide_in_fullscreen = hide_in_fullscreen;
    Ok(())
}

#[tauri::command]
fn set_island_surface_mode(
    expanded: bool,
    hidden: bool,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("island") {
        if hidden {
            let _ = window.hide();
        } else {
            let (w, h) = if expanded {
                (EXPANDED_WIN_W, EXPANDED_WIN_H)
            } else {
                (COLLAPSED_WIN_W, COLLAPSED_WIN_H)
            };
            recenter_window(&window, w, h);
            let _ = window.show();
        }
    }
    Ok(())
}

#[tauri::command]
fn request_keyboard_focus(focused: bool, app: tauri::AppHandle) -> Result<(), String> {
    if focused && let Some(window) = app.get_webview_window("island") {
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
async fn media_get_state(state: State<'_, AppState>) -> Result<MediaStateSnapshot, String> {
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    tokio::task::spawn_blocking(move || read_media_state(preferred.as_deref()))
        .await
        .map_err(|e| format!("media task error: {e}"))
}

#[tauri::command]
async fn media_control(
    command: String,
    state: State<'_, AppState>,
) -> Result<MediaStateSnapshot, String> {
    let cmd = MediaCommand::from_name(&command)
        .ok_or_else(|| format!("unknown media command: {command}"))?;
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    tokio::task::spawn_blocking(move || {
        send_media_command(cmd, preferred.as_deref())?;
        Ok::<MediaStateSnapshot, String>(read_media_state(preferred.as_deref()))
    })
    .await
    .map_err(|e| format!("media control join error: {e}"))?
}

#[tauri::command]
async fn media_seek(
    position_ms: u64,
    state: State<'_, AppState>,
) -> Result<MediaStateSnapshot, String> {
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    tokio::task::spawn_blocking(move || {
        seek_media(position_ms, preferred.as_deref())?;
        Ok::<MediaStateSnapshot, String>(read_media_state(preferred.as_deref()))
    })
    .await
    .map_err(|e| format!("media seek join error: {e}"))?
}

#[tauri::command]
async fn media_set_volume(
    volume_percent: u8,
    state: State<'_, AppState>,
) -> Result<MediaStateSnapshot, String> {
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    tokio::task::spawn_blocking(move || {
        set_system_volume(volume_percent)?;
        Ok::<MediaStateSnapshot, String>(read_media_state(preferred.as_deref()))
    })
    .await
    .map_err(|e| format!("volume task join error: {e}"))?
}

#[tauri::command]
async fn media_select_session(
    app_id: String,
    state: State<'_, AppState>,
) -> Result<MediaStateSnapshot, String> {
    if let Ok(mut guard) = state.preferred_media_app.lock() {
        *guard = if app_id.is_empty() {
            None
        } else {
            Some(app_id)
        };
    }
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    tokio::task::spawn_blocking(move || read_media_state(preferred.as_deref()))
        .await
        .map_err(|e| format!("session select join error: {e}"))
}

#[tauri::command]
fn tasks_list(state: State<'_, AppState>) -> Result<Vec<TaskItem>, String> {
    state.storage.list_tasks()
}

#[tauri::command]
fn tasks_add(
    title: String,
    due_at: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<TaskItem>, String> {
    state.storage.add_task(&title, due_at)
}

#[tauri::command]
fn tasks_toggle(id: i64, state: State<'_, AppState>) -> Result<Vec<TaskItem>, String> {
    state.storage.toggle_task(id)
}

#[tauri::command]
fn tasks_update(
    id: i64,
    title: String,
    due_at: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<TaskItem>, String> {
    state.storage.update_task(id, &title, due_at)
}

#[tauri::command]
fn tasks_delete(id: i64, state: State<'_, AppState>) -> Result<Vec<TaskItem>, String> {
    state.storage.delete_task(id)
}

#[tauri::command]
fn tasks_export_json(state: State<'_, AppState>) -> Result<String, String> {
    state.storage.export_tasks_json()
}

#[tauri::command]
fn tasks_import_json(
    raw_json: String,
    state: State<'_, AppState>,
) -> Result<Vec<TaskItem>, String> {
    state.storage.import_tasks_json(&raw_json)
}

#[tauri::command]
fn water_get_summary(
    goal_ml: i64,
    reset_hour: u32,
    state: State<'_, AppState>,
) -> Result<WaterSummary, String> {
    state.storage.water_summary(Utc::now(), goal_ml, reset_hour)
}

#[tauri::command]
fn water_log(
    ml: i64,
    goal_ml: i64,
    reset_hour: u32,
    state: State<'_, AppState>,
) -> Result<WaterSummary, String> {
    state.storage.log_water(ml, Utc::now(), goal_ml, reset_hour)
}

#[tauri::command]
fn water_undo(
    entry_id: i64,
    goal_ml: i64,
    reset_hour: u32,
    state: State<'_, AppState>,
) -> Result<WaterSummary, String> {
    state
        .storage
        .undo_water(entry_id, Utc::now(), goal_ml, reset_hour)
}

#[tauri::command]
fn prayer_list_cities() -> Vec<PrayerCityPreset> {
    BANGLADESH_CITIES.to_vec()
}

#[tauri::command]
fn prayer_get_schedule(state: State<'_, AppState>) -> Result<PrayerSchedule, String> {
    let cfg = state
        .prayer_config
        .lock()
        .map_err(|_| "prayer config mutex poisoned".to_string())?;
    Ok(compute_prayer_schedule(Utc::now(), &cfg))
}

#[tauri::command]
fn prayer_set_city(city_id: String, state: State<'_, AppState>) -> Result<PrayerSchedule, String> {
    let preset = BANGLADESH_CITIES
        .iter()
        .find(|c| c.id == city_id)
        .ok_or_else(|| format!("unknown Bangladesh city preset: {city_id}"))?;
    let mut cfg = state
        .prayer_config
        .lock()
        .map_err(|_| "prayer config mutex poisoned".to_string())?;
    cfg.city_name = preset.name_en.into();
    cfg.latitude = preset.latitude;
    cfg.longitude = preset.longitude;
    cfg.tz_offset_minutes = preset.tz_offset_minutes;
    Ok(compute_prayer_schedule(Utc::now(), &cfg))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_config = Arc::new(Mutex::new(IslandRuntimeConfig::default()));
    let preferred_media_app = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .setup(move |app| {
            let db_path = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("Lumen"))
                .join("lumen.db");
            let storage = Arc::new(
                StorageRepo::open(&db_path)
                    .or_else(|_| StorageRepo::open_in_memory())
                    .expect("failed to initialize Lumen storage"),
            );

            app.manage(AppState {
                machine: Mutex::new(IslandMachine::new()),
                config: Arc::clone(&shared_config),
                preferred_media_app: Arc::clone(&preferred_media_app),
                storage,
                prayer_config: Mutex::new(PrayerConfig::default()),
            });

            let Some(window) = app.get_webview_window("island") else {
                return Ok(());
            };

            recenter_window(&window, COLLAPSED_WIN_W, COLLAPSED_WIN_H);
            let _ = window.show();

            // System tray icon & menu (FR-WIN-7)
            let toggle_item =
                MenuItem::with_id(app, "toggle", "Open / Collapse Lumen", true, None::<&str>)?;
            let show_item =
                MenuItem::with_id(app, "show_hide", "Show / Hide Island", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Lumen", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&toggle_item, &show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("Lumen — Dynamic Island")
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "toggle" => {
                        let _ = app_handle.emit("lumen://tray-toggle-expand", ());
                    }
                    "show_hide" => {
                        let _ = app_handle.emit("lumen://tray-toggle-hide", ());
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = tray.app_handle().emit("lumen://tray-toggle-expand", ());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            let _ = tray_builder.build(app)?;

            // Fullscreen monitor loop at 2 Hz (FR-WIN-4, NFR-PERF-3 compliant)
            #[cfg(windows)]
            let own_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
            #[cfg(not(windows))]
            let own_hwnd = 0isize;

            let fs_window = window.clone();
            let fs_config = Arc::clone(&shared_config);
            tauri::async_runtime::spawn(async move {
                let mut last_fullscreen = false;
                loop {
                    let hide_in_fullscreen = fs_config
                        .lock()
                        .map(|c| c.hide_in_fullscreen)
                        .unwrap_or(true);
                    let fullscreen = if hide_in_fullscreen {
                        is_other_app_fullscreen(own_hwnd)
                    } else {
                        false
                    };
                    if fullscreen != last_fullscreen {
                        last_fullscreen = fullscreen;
                        let _ = fs_window.emit(
                            "lumen://fullscreen-changed",
                            FullscreenChangedPayload { active: fullscreen },
                        );
                    }
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            });

            // Background SMTC watcher at 1 Hz (FR-MUS-1, NFR-PERF-3 compliant)
            let media_window = window.clone();
            let media_pref = Arc::clone(&preferred_media_app);
            tauri::async_runtime::spawn(async move {
                let mut last_snapshot: Option<MediaStateSnapshot> = None;
                loop {
                    let pref = media_pref.lock().ok().and_then(|g| g.clone());
                    if let Ok(snapshot) =
                        tokio::task::spawn_blocking(move || read_media_state(pref.as_deref())).await
                        && last_snapshot.as_ref() != Some(&snapshot)
                    {
                        last_snapshot = Some(snapshot.clone());
                        let _ = media_window.emit("lumen://media-updated", snapshot);
                    }
                    tokio::time::sleep(Duration::from_millis(1000)).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_island_snapshot,
            dispatch_island_event,
            sync_pill_bounds,
            set_island_surface_mode,
            request_keyboard_focus,
            media_get_state,
            media_control,
            media_seek,
            media_set_volume,
            media_select_session,
            tasks_list,
            tasks_add,
            tasks_toggle,
            tasks_update,
            tasks_delete,
            tasks_export_json,
            tasks_import_json,
            water_get_summary,
            water_log,
            water_undo,
            prayer_list_cities,
            prayer_get_schedule,
            prayer_set_city
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}

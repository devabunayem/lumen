use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Utc;
use lumen_core::{
    IslandEvent, IslandMachine, IslandSnapshot, PomodoroController, PomodoroPhase, PomodoroSnapshot,
};
use lumen_media::{
    LyricLine, MediaCommand, MediaStateSnapshot, fetch_lrclib_lrc, get_system_volume,
    parse_lrc_lines, read_media_state, seek_media, send_media_command, set_system_volume,
};
use lumen_notify::{
    NotificationPopup, NotificationPrivacyConfig, filter_notification, is_focus_assist_quiet,
    listener_access_available,
};
use lumen_prayer::{
    BANGLADESH_CITIES, PrayerCityPreset, PrayerConfig, PrayerSchedule, compute_prayer_schedule,
};
use lumen_storage::{ShelfItem, StorageRepo, TaskItem, WaterSummary};
use lumen_windows::{
    HudEvent, battery_status, compute_top_center_position, is_caps_lock_on,
    is_other_app_fullscreen, open_shell_target,
};
use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, LogicalSize, Manager, PhysicalPosition, State, WebviewWindow};

const COLLAPSED_WIN_W: f64 = 260.0;
const COLLAPSED_WIN_H: f64 = 52.0;
const EXPANDED_WIN_W: f64 = 660.0;
const EXPANDED_WIN_H: f64 = 220.0;
const HUD_WIN_W: f64 = 380.0;
const HUD_WIN_H: f64 = 84.0;

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
    pomodoro: Arc<Mutex<PomodoroController>>,
    notify_config: Mutex<NotificationPrivacyConfig>,
    notify_seq: Mutex<u64>,
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
    hud: Option<bool>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("island") {
        if hidden {
            let _ = window.hide();
        } else {
            let (w, h) = if expanded {
                (EXPANDED_WIN_W, EXPANDED_WIN_H)
            } else if hud.unwrap_or(false) {
                (HUD_WIN_W, HUD_WIN_H)
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
async fn media_get_lyrics(
    artist: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<Vec<LyricLine>, String> {
    let key = format!(
        "{}::{}",
        artist.trim().to_lowercase(),
        title.trim().to_lowercase()
    );
    if let Ok(Some(cached)) = state.storage.get_cached_lyrics(&key) {
        return Ok(parse_lrc_lines(&cached));
    }
    let storage = Arc::clone(&state.storage);
    tokio::task::spawn_blocking(move || {
        if let Some(lrc) = fetch_lrclib_lrc(&artist, &title) {
            let _ = storage.save_cached_lyrics(&key, &lrc);
            return parse_lrc_lines(&lrc);
        }
        Vec::new()
    })
    .await
    .map_err(|e| format!("lyrics task error: {e}"))
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

#[tauri::command]
fn pomodoro_get_state(state: State<'_, AppState>) -> Result<PomodoroSnapshot, String> {
    let guard = state
        .pomodoro
        .lock()
        .map_err(|_| "pomodoro lock poisoned".to_string())?;
    Ok(guard.snapshot())
}

#[tauri::command]
fn pomodoro_toggle(state: State<'_, AppState>) -> Result<PomodoroSnapshot, String> {
    let mut guard = state
        .pomodoro
        .lock()
        .map_err(|_| "pomodoro lock poisoned".to_string())?;
    guard.toggle_start_pause();
    Ok(guard.snapshot())
}

#[tauri::command]
fn pomodoro_skip(state: State<'_, AppState>) -> Result<PomodoroSnapshot, String> {
    let mut guard = state
        .pomodoro
        .lock()
        .map_err(|_| "pomodoro lock poisoned".to_string())?;
    guard.skip();
    Ok(guard.snapshot())
}

#[tauri::command]
fn pomodoro_reset(state: State<'_, AppState>) -> Result<PomodoroSnapshot, String> {
    let mut guard = state
        .pomodoro
        .lock()
        .map_err(|_| "pomodoro lock poisoned".to_string())?;
    guard.reset();
    Ok(guard.snapshot())
}

#[tauri::command]
fn shelf_list(state: State<'_, AppState>) -> Result<Vec<ShelfItem>, String> {
    state.storage.list_shelf()
}

#[tauri::command]
fn shelf_add(
    kind: String,
    path_or_text: String,
    state: State<'_, AppState>,
) -> Result<Vec<ShelfItem>, String> {
    state.storage.add_shelf_item(&kind, &path_or_text, 50)
}

#[tauri::command]
fn shelf_remove(id: i64, state: State<'_, AppState>) -> Result<Vec<ShelfItem>, String> {
    state.storage.remove_shelf_item(id)
}

#[tauri::command]
fn shelf_clear(state: State<'_, AppState>) -> Result<Vec<ShelfItem>, String> {
    state.storage.clear_shelf()
}

#[tauri::command]
fn shelf_open(target: String) -> Result<(), String> {
    open_shell_target(&target)
}

#[tauri::command]
fn notify_get_config(state: State<'_, AppState>) -> Result<NotificationPrivacyConfig, String> {
    let guard = state
        .notify_config
        .lock()
        .map_err(|_| "notify config mutex poisoned".to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
fn notify_set_config(
    config: NotificationPrivacyConfig,
    state: State<'_, AppState>,
) -> Result<NotificationPrivacyConfig, String> {
    let mut guard = state
        .notify_config
        .lock()
        .map_err(|_| "notify config mutex poisoned".to_string())?;
    *guard = config.clone();
    Ok(config)
}

#[tauri::command]
fn notify_listener_status() -> bool {
    listener_access_available()
}

#[tauri::command]
fn notify_push_test(
    app_name: String,
    title: String,
    body: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<NotificationPopup>, String> {
    let cfg = state
        .notify_config
        .lock()
        .map_err(|_| "notify config mutex poisoned".to_string())?
        .clone();
    let mut seq = state
        .notify_seq
        .lock()
        .map_err(|_| "notify seq mutex poisoned".to_string())?;
    *seq = seq.saturating_add(1);
    let filtered = filter_notification(
        *seq,
        &app_name,
        &title,
        &body,
        &cfg,
        false,
        is_focus_assist_quiet(),
    );
    if let Some(ref popup) = filtered
        && let Some(win) = app.get_webview_window("island")
    {
        let _ = win.emit("lumen://notification-popup", popup);
    }
    Ok(filtered)
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
            let daily_mins = storage.daily_focus_minutes(Utc::now()).unwrap_or(0);
            let pomodoro = Arc::new(Mutex::new(PomodoroController::new(
                Default::default(),
                daily_mins,
            )));

            app.manage(AppState {
                machine: Mutex::new(IslandMachine::new()),
                config: Arc::clone(&shared_config),
                preferred_media_app: Arc::clone(&preferred_media_app),
                storage: Arc::clone(&storage),
                prayer_config: Mutex::new(PrayerConfig::default()),
                pomodoro: Arc::clone(&pomodoro),
                notify_config: Mutex::new(NotificationPrivacyConfig::default()),
                notify_seq: Mutex::new(0),
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

            // Fullscreen & System HUD monitor loop at 2 Hz (FR-WIN-4, FR-HUD-1, NFR-PERF-3)
            #[cfg(windows)]
            let own_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
            #[cfg(not(windows))]
            let own_hwnd = 0isize;

            let fs_window = window.clone();
            let fs_config = Arc::clone(&shared_config);
            tauri::async_runtime::spawn(async move {
                let mut last_fullscreen = false;
                let mut last_caps = is_caps_lock_on();
                let mut last_vol = get_system_volume();
                let mut last_battery = battery_status();

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

                    let caps = is_caps_lock_on();
                    if caps != last_caps {
                        last_caps = caps;
                        let _ = fs_window.emit(
                            "lumen://hud-event",
                            HudEvent {
                                kind: "caps_lock".into(),
                                label: if caps {
                                    "Caps Lock On"
                                } else {
                                    "Caps Lock Off"
                                }
                                .into(),
                                value_pct: None,
                                active: caps,
                            },
                        );
                    }

                    let vol = get_system_volume();
                    if vol != last_vol {
                        last_vol = vol;
                        let _ = fs_window.emit(
                            "lumen://hud-event",
                            HudEvent {
                                kind: if vol.1 { "mute" } else { "volume" }.into(),
                                label: if vol.1 {
                                    "Muted".into()
                                } else {
                                    format!("Volume {}%", vol.0)
                                },
                                value_pct: Some(if vol.1 { 0 } else { vol.0 }),
                                active: !vol.1,
                            },
                        );
                    }

                    let bat = battery_status();
                    if let (Some((prev_pct, prev_chg)), Some((pct, chg))) = (last_battery, bat)
                        && (chg != prev_chg || (pct <= 15 && prev_pct > 15))
                    {
                        let _ = fs_window.emit(
                            "lumen://hud-event",
                            HudEvent {
                                kind: "battery".into(),
                                label: if chg {
                                    format!("Charging · {pct}%")
                                } else {
                                    format!("Battery {pct}%")
                                },
                                value_pct: Some(pct),
                                active: chg,
                            },
                        );
                    }
                    last_battery = bat;

                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            });

            // Background SMTC + Pomodoro tick loop at 1 Hz (FR-MUS-1, FR-PO-2, NFR-PERF-3)
            let media_window = window.clone();
            let media_pref = Arc::clone(&preferred_media_app);
            let pom_ref = Arc::clone(&pomodoro);
            let storage_ref = Arc::clone(&storage);
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

                    let mut completed: Option<(PomodoroPhase, u32)> = None;
                    let mut snap_to_emit: Option<PomodoroSnapshot> = None;
                    if let Ok(mut guard) = pom_ref.lock()
                        && guard.is_running()
                    {
                        completed = guard.tick();
                        if completed.is_some() {
                            let mins = storage_ref.daily_focus_minutes(Utc::now()).unwrap_or(0);
                            guard.set_daily_focus_minutes(mins);
                        }
                        snap_to_emit = Some(guard.snapshot());
                    }

                    if let Some((phase, secs)) = completed {
                        let kind = match phase {
                            PomodoroPhase::Focus => "focus",
                            PomodoroPhase::ShortBreak => "short_break",
                            PomodoroPhase::LongBreak => "long_break",
                        };
                        let _ = storage_ref.record_pomodoro_session(kind, secs, true);
                        if let Ok(mut guard) = pom_ref.lock() {
                            let mins = storage_ref.daily_focus_minutes(Utc::now()).unwrap_or(0);
                            guard.set_daily_focus_minutes(mins);
                            snap_to_emit = Some(guard.snapshot());
                        }
                    }

                    if let Some(snap) = snap_to_emit {
                        let _ = media_window.emit("lumen://pomodoro-tick", snap);
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
            media_get_lyrics,
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
            prayer_set_city,
            pomodoro_get_state,
            pomodoro_toggle,
            pomodoro_skip,
            pomodoro_reset,
            shelf_list,
            shelf_add,
            shelf_remove,
            shelf_clear,
            shelf_open,
            notify_get_config,
            notify_set_config,
            notify_listener_status,
            notify_push_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}

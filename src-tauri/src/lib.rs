use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::{DateTime, Local, Utc};
use lumen_core::{
    IslandMachine, LumenSettings, PomodoroController, PomodoroPhase, PomodoroSnapshot,
};
use lumen_media::sounds::{SoundSilenceContext, UiSoundName, try_play_ui_sound};
use lumen_media::{
    AudioPeakReader, MediaCommand, MediaGraceStabilizer, MediaStateSnapshot, get_mic_muted,
    get_system_volume, read_media_state, seek_media, send_media_command, set_system_volume,
    shape_audio_peak, toggle_mic_mute,
};
use lumen_notify::{
    NotificationPopup, NotificationPrivacyConfig, SystemNotificationWatcher,
    filter_captured_notification, filter_notification, is_focus_assist_quiet,
};
use lumen_plugins::{LoadedPlugin, discover_plugins};
use lumen_prayer::{
    BANGLADESH_CITIES, CalculationMethod, Madhab, PrayerCityPreset, PrayerConfig, PrayerSchedule,
    compute_prayer_schedule, resolve_city_name_for_coords,
};
use lumen_storage::{
    CalendarEvent, ReminderItem, ShelfItem, StorageRepo, TasbihState, TaskItem, TimeLedgerState,
    WaterSummary,
};
use lumen_windows::{
    ClipboardChipSnapshot, GlobalHotkeyManager, HotkeyAction, HudEvent, OpenMeteoWeather,
    acquire_single_instance_mutex, battery_status, capture_screen_to_png, check_dev_ports,
    classify_and_mask_clipboard, clear_clipboard_if_matching, compute_pill_screen_rect,
    compute_top_center_position, cursor_screen_pos, fetch_open_meteo_weather,
    get_windows_location_opt_in, is_autostart_enabled, is_caps_lock_on, is_keep_awake,
    is_other_app_fullscreen, lock_workstation, ocr_screen_to_clipboard, open_shell_target,
    privacy_device_status, quick_radios_status, read_clipboard_text, set_autostart_enabled,
    set_click_through, set_keep_awake, set_window_bounds_atomic, toggle_radio_kind,
    write_clipboard_text,
};
use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    Emitter, LogicalSize, Manager, Monitor, PhysicalPosition, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const CANVAS_WIN_W: f64 = 1040.0;
const CANVAS_WIN_H: f64 = 510.0;

#[derive(Debug, Clone, Copy)]
struct IslandRuntimeConfig {
    hide_in_fullscreen: bool,
    visible: bool,
    width_logical: f64,
    height_logical: f64,
    top_offset_logical: f64,
    corner_radius_logical: f64,
}

impl Default for IslandRuntimeConfig {
    fn default() -> Self {
        Self {
            hide_in_fullscreen: true,
            visible: true,
            width_logical: 184.0,
            height_logical: 30.0,
            top_offset_logical: 0.0,
            corner_radius_logical: 15.0,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    width: u32,
    height: u32,
    scale_factor: f64,
    is_primary: bool,
}

#[derive(Debug, Clone, Serialize)]
struct SettingsUpdateResult {
    settings: LumenSettings,
    hotkey_warning: Option<String>,
    autostart_warning: Option<String>,
}

struct AppState {
    machine: Mutex<IslandMachine>,
    config: Arc<Mutex<IslandRuntimeConfig>>,
    preferred_media_app: Arc<Mutex<Option<String>>>,
    media_stabilizer: Arc<Mutex<MediaGraceStabilizer>>,
    storage: Arc<StorageRepo>,
    prayer_config: Mutex<PrayerConfig>,
    pomodoro: Arc<Mutex<PomodoroController>>,
    notify_config: Arc<Mutex<NotificationPrivacyConfig>>,
    notify_seq: Arc<Mutex<u64>>,
    settings: Arc<Mutex<LumenSettings>>,
    settings_path: PathBuf,
    plugins_dir: PathBuf,
    surface_mode: Mutex<(bool, bool, bool)>,
    hotkeys: Mutex<Option<GlobalHotkeyManager>>,
    home_visible: Arc<AtomicBool>,
    clipboard_secret: Arc<Mutex<Option<(String, Instant)>>>,
    is_fullscreen: Arc<AtomicBool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickTogglesState {
    wifi: Option<bool>,
    bluetooth: Option<bool>,
    focus: bool,
    mic_muted: bool,
    mic_in_use: bool,
    keep_awake: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevPulseSnapshot {
    ports: Vec<u16>,
    primary_port: Option<u16>,
    up: bool,
}

fn append_log_line(log_dir: &Path, line: &str) {
    let _ = std::fs::create_dir_all(log_dir);
    let log_path = log_dir.join("lumen.log");
    if let Ok(meta) = std::fs::metadata(&log_path)
        && meta.len() > 2 * 1024 * 1024
    {
        let prev = log_dir.join("lumen.prev.log");
        let _ = std::fs::rename(&log_path, prev);
    }
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let stamp = Utc::now().to_rfc3339();
        let _ = writeln!(file, "[{stamp}] {line}");
    }
}

fn install_crash_logger(log_dir: PathBuf) {
    append_log_line(
        &log_dir,
        &format!("Lumen v{} started", env!("CARGO_PKG_VERSION")),
    );
    let hook_dir = log_dir;
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        append_log_line(&hook_dir, &format!("PANIC: {info}"));
        prev_hook(info);
    }));
}

#[derive(Debug, Clone, Serialize)]
struct FullscreenChangedPayload {
    active: bool,
}

fn pick_target_monitor(window: &WebviewWindow, settings: &LumenSettings) -> Option<Monitor> {
    let monitors = window.available_monitors().ok().unwrap_or_default();
    if monitors.is_empty() {
        return window.primary_monitor().ok().flatten();
    }

    match settings.monitor_mode.as_str() {
        "index" => monitors
            .get(settings.monitor_index)
            .cloned()
            .or_else(|| window.primary_monitor().ok().flatten())
            .or_else(|| monitors.into_iter().next()),
        "active" => {
            if let Some((cx, cy)) = cursor_screen_pos()
                && let Some(found) = monitors.iter().find(|m| {
                    let pos = m.position();
                    let size = m.size();
                    cx >= pos.x
                        && cx < pos.x + size.width as i32
                        && cy >= pos.y
                        && cy < pos.y + size.height as i32
                })
            {
                return Some(found.clone());
            }
            window
                .primary_monitor()
                .ok()
                .flatten()
                .or_else(|| monitors.into_iter().next())
        }
        _ => window
            .primary_monitor()
            .ok()
            .flatten()
            .or_else(|| monitors.into_iter().next()),
    }
}

fn recenter_window(
    window: &WebviewWindow,
    base_width: f64,
    base_height: f64,
    settings: &LumenSettings,
) {
    // Keep canvas zero-resize across scale changes: fits 150% Home (1140x564) + 16px margin + ears.
    let logical_width = base_width.round();
    let logical_height = base_height.round();

    if let Some(monitor) = pick_target_monitor(window, settings) {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let dpi_scale = monitor.scale_factor();
        let phys_w = (logical_width * dpi_scale).round() as i32;
        let phys_h = (logical_height * dpi_scale).round() as i32;
        let (x, y) = compute_top_center_position(
            monitor_pos.x,
            monitor_pos.y,
            monitor_size.width as i32,
            phys_w,
        );
        let target_x = x + settings.position_offset_x;

        #[cfg(windows)]
        if let Ok(hwnd) = window.hwnd() {
            set_window_bounds_atomic(hwnd.0 as isize, target_x, y, phys_w, phys_h);
            return;
        }

        let _ = window.set_size(LogicalSize::new(logical_width, logical_height));
        let _ = window.set_position(PhysicalPosition::new(target_x, y));
    } else {
        let _ = window.set_size(LogicalSize::new(logical_width, logical_height));
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn sync_pill_bounds(
    width: f64,
    height: f64,
    top_offset: f64,
    visible: bool,
    hide_in_fullscreen: bool,
    corner_radius: Option<f64>,
    home_visible: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state
        .config
        .lock()
        .map_err(|_| "runtime config mutex poisoned".to_string())?;
    guard.width_logical = width;
    guard.height_logical = height;
    guard.top_offset_logical = top_offset;
    guard.visible = visible;
    guard.hide_in_fullscreen = hide_in_fullscreen;
    guard.corner_radius_logical =
        corner_radius.unwrap_or(if height <= 40.0 { height * 0.5 } else { 24.0 });
    if let Some(hv) = home_visible {
        state.home_visible.store(hv, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
fn set_island_surface_mode(
    expanded: bool,
    hidden: bool,
    hud: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let is_hud = hud.unwrap_or(false);
    if let Ok(mut mode_guard) = state.surface_mode.lock() {
        *mode_guard = (expanded, hidden, is_hud);
    }
    let settings = state.settings.lock().map(|s| s.clone()).unwrap_or_default();

    if let Some(window) = app.get_webview_window("island") {
        if hidden {
            let _ = window.hide();
        } else {
            recenter_window(&window, CANVAS_WIN_W, CANVAS_WIN_H, &settings);
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

fn read_stabilized_media(
    preferred: Option<&str>,
    stabilizer: &Arc<Mutex<MediaGraceStabilizer>>,
) -> MediaStateSnapshot {
    let raw = read_media_state(preferred);
    stabilizer
        .lock()
        .map(|mut s| s.stabilize(raw.clone(), Instant::now()))
        .unwrap_or(raw)
}

#[tauri::command]
async fn media_get_state(state: State<'_, AppState>) -> Result<MediaStateSnapshot, String> {
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let stabilizer = Arc::clone(&state.media_stabilizer);
    tokio::task::spawn_blocking(move || read_stabilized_media(preferred.as_deref(), &stabilizer))
        .await
        .map_err(|e| format!("media task error: {e}"))
}

#[tauri::command]
async fn media_control(
    command: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<MediaStateSnapshot, String> {
    let cmd = MediaCommand::from_name(&command)
        .ok_or_else(|| format!("unknown media command: {command}"))?;
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let stabilizer = Arc::clone(&state.media_stabilizer);
    if matches!(cmd, MediaCommand::Next | MediaCommand::Previous)
        && let Ok(mut guard) = stabilizer.lock()
    {
        guard.notify_skip(Instant::now());
    }
    let snap = tokio::task::spawn_blocking(move || {
        send_media_command(cmd, preferred.as_deref())?;
        Ok::<MediaStateSnapshot, String>(read_stabilized_media(preferred.as_deref(), &stabilizer))
    })
    .await
    .map_err(|e| format!("media control join error: {e}"))??;
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.emit("lumen://media-updated", &snap);
    }
    Ok(snap)
}

#[tauri::command]
async fn media_seek(
    position_ms: u64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<MediaStateSnapshot, String> {
    let preferred = state
        .preferred_media_app
        .lock()
        .ok()
        .and_then(|g| g.clone());
    let stabilizer = Arc::clone(&state.media_stabilizer);
    let snap = tokio::task::spawn_blocking(move || {
        seek_media(position_ms, preferred.as_deref())?;
        Ok::<MediaStateSnapshot, String>(read_stabilized_media(preferred.as_deref(), &stabilizer))
    })
    .await
    .map_err(|e| format!("media seek join error: {e}"))??;
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.emit("lumen://media-updated", &snap);
    }
    Ok(snap)
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
    let stabilizer = Arc::clone(&state.media_stabilizer);
    tokio::task::spawn_blocking(move || {
        set_system_volume(volume_percent)?;
        Ok::<MediaStateSnapshot, String>(read_stabilized_media(preferred.as_deref(), &stabilizer))
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
    let stabilizer = Arc::clone(&state.media_stabilizer);
    tokio::task::spawn_blocking(move || read_stabilized_media(preferred.as_deref(), &stabilizer))
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
fn tasks_delete(id: i64, state: State<'_, AppState>) -> Result<Vec<TaskItem>, String> {
    state.storage.delete_task(id)
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

#[tauri::command]
fn monitors_list(app: tauri::AppHandle) -> Vec<MonitorInfo> {
    let Some(win) = app.get_webview_window("island") else {
        return Vec::new();
    };
    let primary = win.primary_monitor().ok().flatten();
    win.available_monitors()
        .ok()
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(idx, m)| {
            let is_primary = primary
                .as_ref()
                .is_some_and(|p| p.position() == m.position() && p.size() == m.size());
            MonitorInfo {
                index: idx,
                name: m
                    .name()
                    .map_or_else(|| format!("Monitor {}", idx + 1), |n| n.to_string()),
                width: m.size().width,
                height: m.size().height,
                scale_factor: m.scale_factor(),
                is_primary,
            }
        })
        .collect()
}

#[tauri::command]
fn settings_get(state: State<'_, AppState>) -> Result<LumenSettings, String> {
    let guard = state
        .settings
        .lock()
        .map_err(|_| "settings mutex poisoned".to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
fn settings_update(
    settings: LumenSettings,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SettingsUpdateResult, String> {
    let mut clean = settings;
    clean.normalize();

    let prev = state
        .settings
        .lock()
        .map_err(|_| "settings mutex poisoned".to_string())?
        .clone();

    let mut autostart_warning = None;
    if clean.start_with_windows != prev.start_with_windows {
        let exe_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.to_str().map(ToOwned::to_owned))
            .unwrap_or_default();
        if exe_path.is_empty() {
            autostart_warning = Some("Unable to resolve executable path for startup entry".into());
        } else if let Err(err) = set_autostart_enabled(clean.start_with_windows, &exe_path) {
            autostart_warning = Some(err);
        }
    }

    let mut hotkey_warning = None;
    if (clean.hotkey_hide != prev.hotkey_hide || clean.hotkey_expand != prev.hotkey_expand)
        && let Ok(guard) = state.hotkeys.lock()
        && let Some(ref mgr) = *guard
    {
        hotkey_warning = mgr.rebind(&clean.hotkey_hide, &clean.hotkey_expand);
    }

    clean.save_to_path(&state.settings_path)?;

    if let Ok(mut cfg) = state.config.lock() {
        cfg.hide_in_fullscreen = clean.hide_in_fullscreen;
    }
    if let Ok(mut machine) = state.machine.lock() {
        machine.set_minimal_mode(clean.minimal_notch);
    }
    if let Ok(mut guard) = state.settings.lock() {
        *guard = clean.clone();
    }

    if let Some(window) = app.get_webview_window("island") {
        let (_expanded, hidden, _is_hud) =
            state.surface_mode.lock().map(|g| *g).unwrap_or_default();
        if !hidden {
            recenter_window(&window, CANVAS_WIN_W, CANVAS_WIN_H, &clean);
        }
    }

    if !prev.location_opt_in && clean.location_opt_in {
        let loc_app = app.clone();
        tauri::async_runtime::spawn(async move {
            let _ = sync_auto_location_if_enabled(&loc_app).await;
        });
    }

    let _ = app.emit("lumen://settings-updated", &clean);

    Ok(SettingsUpdateResult {
        settings: clean,
        hotkey_warning,
        autostart_warning,
    })
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("Lumen Settings")
    .inner_size(920.0, 640.0)
    .min_inner_size(780.0, 540.0)
    .center()
    .decorations(false)
    .transparent(false)
    .build()
    .map_err(|e| format!("failed to open settings window: {e}"))?;

    Ok(())
}

#[tauri::command]
fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.close();
    }
    Ok(())
}

#[tauri::command]
async fn system_get_mic_muted() -> Result<bool, String> {
    tokio::task::spawn_blocking(get_mic_muted)
        .await
        .map_err(|e| format!("mic query error: {e}"))
}

#[tauri::command]
async fn system_toggle_mic_mute() -> Result<bool, String> {
    tokio::task::spawn_blocking(toggle_mic_mute)
        .await
        .map_err(|e| format!("mic toggle error: {e}"))?
}

#[tauri::command]
fn system_lock_workstation() -> Result<(), String> {
    lock_workstation()
}

#[tauri::command]
async fn system_capture_screenshot(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let captures_dir = state
        .settings_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("captures");
    let filename = format!("screenshot-{}.png", Utc::now().format("%Y%m%d-%H%M%S"));
    let out_path = captures_dir.join(filename);
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.hide();
        tokio::time::sleep(Duration::from_millis(80)).await;
    }
    let saved_res = tokio::task::spawn_blocking(move || capture_screen_to_png(&out_path))
        .await
        .map_err(|e| format!("screenshot task error: {e}"))?;
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.show();
    }
    let saved = saved_res?;
    let _ = state.storage.add_shelf_item("file", &saved, 50);
    Ok(saved)
}

#[tauri::command]
async fn system_ocr_screen(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.hide();
        tokio::time::sleep(Duration::from_millis(80)).await;
    }
    let ocr_res = tokio::task::spawn_blocking(ocr_screen_to_clipboard)
        .await
        .map_err(|e| format!("ocr task error: {e}"))?;
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.show();
    }
    ocr_res
}

#[tauri::command]
async fn system_privacy_indicators() -> Result<(bool, bool), String> {
    tokio::task::spawn_blocking(privacy_device_status)
        .await
        .map_err(|e| format!("privacy status error: {e}"))
}

#[tauri::command]
fn calendar_list(state: State<'_, AppState>) -> Result<Vec<CalendarEvent>, String> {
    state.storage.list_calendar_events()
}

#[tauri::command]
fn calendar_add(
    title: String,
    start_at: String,
    state: State<'_, AppState>,
) -> Result<Vec<CalendarEvent>, String> {
    state.storage.add_calendar_event(&title, &start_at)
}

#[tauri::command]
fn calendar_delete(id: i64, state: State<'_, AppState>) -> Result<Vec<CalendarEvent>, String> {
    state.storage.delete_calendar_event(id)
}

#[tauri::command]
fn reminders_list(state: State<'_, AppState>) -> Result<Vec<ReminderItem>, String> {
    state.storage.list_reminders()
}

#[tauri::command]
fn reminders_add(
    title: String,
    target_at: String,
    lead_minutes: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ReminderItem>, String> {
    let list = state
        .storage
        .add_reminder(&title, &target_at, lead_minutes)?;
    let _ = app.emit("lumen://reminders-updated", &list);
    Ok(list)
}

#[tauri::command]
fn reminders_delete(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ReminderItem>, String> {
    let list = state.storage.delete_reminder(id)?;
    let _ = app.emit("lumen://reminders-updated", &list);
    Ok(list)
}

#[tauri::command]
fn reminders_stop(
    id: i64,
    stage: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ReminderItem>, String> {
    let list = state.storage.stop_reminder_alert(id, &stage)?;
    let _ = app.emit("lumen://reminders-updated", &list);
    Ok(list)
}

#[tauri::command]
fn reminders_snooze(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ReminderItem>, String> {
    let snooze_mins = state
        .settings
        .lock()
        .map(|g| i64::from(g.reminder_snooze_minutes))
        .unwrap_or(3);
    let list = state.storage.snooze_reminder_alert(id, snooze_mins)?;
    let _ = app.emit("lumen://reminders-updated", &list);
    Ok(list)
}

#[tauri::command]
fn plugins_list(state: State<'_, AppState>) -> Vec<LoadedPlugin> {
    discover_plugins(&state.plugins_dir)
}

fn build_sound_ctx(
    settings: &LumenSettings,
    pomodoro: &Mutex<PomodoroController>,
    is_fullscreen: bool,
    allow_during_focus: bool,
) -> SoundSilenceContext {
    let focus_active = if allow_during_focus {
        false
    } else {
        pomodoro
            .lock()
            .map(|p| {
                let s = p.snapshot();
                s.running && matches!(s.phase, PomodoroPhase::Focus)
            })
            .unwrap_or(false)
    };
    let (_, mic_in_use) = privacy_device_status();
    let (_, windows_muted) = get_system_volume();
    let quiet_hours = is_focus_assist_quiet();

    SoundSilenceContext {
        enabled: settings.sound_enabled,
        interface_enabled: settings.sound_interface,
        reminders_enabled: settings.sound_reminders,
        volume_pct: settings.sound_volume,
        mic_or_call_active: mic_in_use,
        is_fullscreen,
        focus_session_active: focus_active,
        windows_muted,
        quiet_hours_active: quiet_hours,
    }
}

#[tauri::command]
fn play_ui_sound(name: String, state: State<'_, AppState>) -> Result<bool, String> {
    let Some(sound) = UiSoundName::from_str_name(&name) else {
        return Ok(false);
    };
    let settings = state.settings.lock().map(|g| g.clone()).unwrap_or_default();
    let is_fs = state.is_fullscreen.load(Ordering::Relaxed);
    let allow_focus = matches!(sound, UiSoundName::ReminderAlarm);
    let ctx = build_sound_ctx(&settings, &state.pomodoro, is_fs, allow_focus);
    Ok(try_play_ui_sound(sound, &ctx))
}

#[tauri::command]
async fn system_quick_toggles_state(
    state: State<'_, AppState>,
) -> Result<QuickTogglesState, String> {
    let focus = is_focus_assist_quiet()
        || state
            .pomodoro
            .lock()
            .map(|p| {
                let s = p.snapshot();
                s.running && matches!(s.phase, PomodoroPhase::Focus)
            })
            .unwrap_or(false);
    tokio::task::spawn_blocking(move || {
        let (wifi, bluetooth) = quick_radios_status();
        let mic_muted = get_mic_muted();
        let (_, mic_in_use) = privacy_device_status();
        let keep_awake = is_keep_awake();
        QuickTogglesState {
            wifi,
            bluetooth,
            focus,
            mic_muted,
            mic_in_use,
            keep_awake,
        }
    })
    .await
    .map_err(|e| format!("toggles query error: {e}"))
}

#[tauri::command]
async fn system_toggle_wifi() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| toggle_radio_kind(true))
        .await
        .map_err(|e| format!("wifi toggle error: {e}"))?
}

#[tauri::command]
async fn system_toggle_bluetooth() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| toggle_radio_kind(false))
        .await
        .map_err(|e| format!("bluetooth toggle error: {e}"))?
}

#[tauri::command]
fn system_toggle_keep_awake(enabled: Option<bool>) -> bool {
    set_keep_awake(enabled.unwrap_or_else(|| !is_keep_awake()))
}

#[tauri::command]
fn prayer_set_method(
    method: CalculationMethod,
    madhab: Madhab,
    state: State<'_, AppState>,
) -> Result<PrayerSchedule, String> {
    let mut cfg = state
        .prayer_config
        .lock()
        .map_err(|_| "prayer config mutex poisoned".to_string())?;
    cfg.method = method;
    cfg.madhab = madhab;
    Ok(compute_prayer_schedule(Utc::now(), &cfg))
}

fn apply_auto_coordinates_to_prayer(
    state: &AppState,
    glat: f64,
    glon: f64,
) -> Option<(String, PrayerSchedule, bool)> {
    let tz_offset_minutes = Local::now().offset().local_minus_utc() / 60;
    let city_name = resolve_city_name_for_coords(glat, glon);
    let mut cfg = state.prayer_config.lock().ok()?;
    let changed = (cfg.latitude - glat).abs() > 0.005
        || (cfg.longitude - glon).abs() > 0.005
        || cfg.tz_offset_minutes != tz_offset_minutes
        || cfg.city_name != city_name;
    cfg.city_name = city_name.clone();
    cfg.latitude = glat;
    cfg.longitude = glon;
    cfg.tz_offset_minutes = tz_offset_minutes;
    let schedule = compute_prayer_schedule(Utc::now(), &cfg);
    Some((city_name, schedule, changed))
}

async fn sync_auto_location_if_enabled(app: &tauri::AppHandle) -> Option<(String, f64, f64)> {
    let state = app.try_state::<AppState>()?;
    let location_opt_in = state
        .settings
        .lock()
        .map(|s| s.location_opt_in)
        .unwrap_or(true);
    if !location_opt_in {
        return None;
    }
    let (glat, glon) = tokio::task::spawn_blocking(get_windows_location_opt_in)
        .await
        .ok()?
        .ok()?;
    if let Some((city, schedule, changed)) = apply_auto_coordinates_to_prayer(&state, glat, glon) {
        if changed {
            let _ = app.emit("lumen://prayer-updated", &schedule);
        }
        return Some((city, glat, glon));
    }
    None
}

#[tauri::command]
async fn weather_get_current(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<OpenMeteoWeather, String> {
    let _ = sync_auto_location_if_enabled(&app).await;

    let (city_name, lat, lon) = {
        let cfg = state
            .prayer_config
            .lock()
            .map_err(|_| "prayer config mutex poisoned".to_string())?;
        (cfg.city_name.clone(), cfg.latitude, cfg.longitude)
    };

    let city_key = format!("{city_name}@{lat:.2}_{lon:.2}").to_ascii_lowercase();
    if let Ok(Some((payload_json, fetched_at))) = state.storage.get_weather_cache(&city_key)
        && let Ok(dt) = DateTime::parse_from_rfc3339(&fetched_at)
        && (Utc::now() - dt.with_timezone(&Utc)).num_minutes() < 30
        && let Ok(mut cached) = serde_json::from_str::<OpenMeteoWeather>(&payload_json)
    {
        cached.offline = false;
        return Ok(cached);
    }

    let city_clone = city_name.clone();
    match tokio::task::spawn_blocking(move || fetch_open_meteo_weather(&city_clone, lat, lon)).await
    {
        Ok(Ok(fresh)) => {
            if let Ok(json) = serde_json::to_string(&fresh) {
                let _ = state
                    .storage
                    .save_weather_cache(&city_key, &json, &fresh.fetched_at);
            }
            Ok(fresh)
        }
        _ => {
            if let Ok(Some((payload_json, _))) = state.storage.get_weather_cache(&city_key)
                && let Ok(mut stale) = serde_json::from_str::<OpenMeteoWeather>(&payload_json)
            {
                stale.offline = true;
                return Ok(stale);
            }
            Err("weather unavailable offline".into())
        }
    }
}

#[tauri::command]
fn tasbih_get(state: State<'_, AppState>) -> Result<TasbihState, String> {
    state.storage.get_tasbih()
}

#[tauri::command]
fn tasbih_increment(state: State<'_, AppState>) -> Result<TasbihState, String> {
    state.storage.increment_tasbih()
}

#[tauri::command]
fn tasbih_reset(state: State<'_, AppState>) -> Result<TasbihState, String> {
    state.storage.reset_tasbih()
}

#[tauri::command]
fn ledger_get(state: State<'_, AppState>) -> Result<TimeLedgerState, String> {
    state.storage.get_active_ledger()
}

#[tauri::command]
fn ledger_toggle(
    client_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<TimeLedgerState, String> {
    state.storage.toggle_ledger(client_name.as_deref())
}

#[tauri::command]
fn clipboard_get_latest(state: State<'_, AppState>) -> Result<ClipboardChipSnapshot, String> {
    let raw = read_clipboard_text().unwrap_or_default();
    let snap = classify_and_mask_clipboard(&raw);
    if snap.has_content {
        if snap.sensitive
            && let Ok(mut guard) = state.clipboard_secret.lock()
        {
            *guard = Some((raw, Instant::now()));
        }
        return Ok(snap);
    }
    if let Ok(guard) = state.clipboard_secret.lock()
        && let Some((ref stored, _)) = *guard
    {
        return Ok(classify_and_mask_clipboard(stored));
    }
    Ok(snap)
}

#[tauri::command]
fn clipboard_copy_latest(state: State<'_, AppState>) -> Result<ClipboardChipSnapshot, String> {
    if let Some(raw) = read_clipboard_text()
        && !raw.trim().is_empty()
    {
        write_clipboard_text(&raw)?;
        let snap = classify_and_mask_clipboard(&raw);
        if snap.sensitive
            && let Ok(mut guard) = state.clipboard_secret.lock()
        {
            *guard = Some((raw, Instant::now()));
        }
        return Ok(snap);
    }
    if let Ok(mut guard) = state.clipboard_secret.lock()
        && let Some((ref stored, ref mut ts)) = *guard
    {
        write_clipboard_text(stored)?;
        *ts = Instant::now();
        return Ok(classify_and_mask_clipboard(stored));
    }
    Err("clipboard empty".into())
}

#[tauri::command]
fn home_set_visible(visible: bool, state: State<'_, AppState>) {
    state.home_visible.store(visible, Ordering::Relaxed);
}

#[tauri::command]
fn system_battery_status() -> Option<(u8, bool)> {
    battery_status()
}

#[tauri::command]
fn monitor_auto_scale_factor(app: tauri::AppHandle, state: State<'_, AppState>) -> f64 {
    let settings = state.settings.lock().map(|g| g.clone()).unwrap_or_default();
    if let Some(win) = app.get_webview_window("island")
        && let Some(mon) = pick_target_monitor(&win, &settings)
    {
        return settings.scale_multiplier_for_width(mon.size().width as f64);
    }
    settings.scale_multiplier()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if !acquire_single_instance_mutex() {
        return;
    }

    let shared_config = Arc::new(Mutex::new(IslandRuntimeConfig::default()));
    let preferred_media_app = Arc::new(Mutex::new(None));
    let shared_media_stabilizer = Arc::new(Mutex::new(MediaGraceStabilizer::new()));

    tauri::Builder::default()
        .setup(move |app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("Lumen"));
            install_crash_logger(data_dir.join("logs"));
            let plugins_dir = data_dir.join("plugins");
            let _ = std::fs::create_dir_all(&plugins_dir);

            let settings_path = data_dir.join("settings.json");
            let mut initial_settings = LumenSettings::load_from_path(&settings_path);
            if !settings_path.exists() {
                initial_settings.start_with_windows = is_autostart_enabled();
            }

            if let Ok(mut cfg) = shared_config.lock() {
                cfg.hide_in_fullscreen = initial_settings.hide_in_fullscreen;
            }

            let db_path = data_dir.join("lumen.db");
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

            let mut machine = IslandMachine::new();
            machine.set_minimal_mode(initial_settings.minimal_notch);
            let home_visible = Arc::new(AtomicBool::new(false));
            let clipboard_secret: Arc<Mutex<Option<(String, Instant)>>> =
                Arc::new(Mutex::new(None));
            let is_fullscreen = Arc::new(AtomicBool::new(false));

            let hotkey_app = app.handle().clone();
            let hotkeys = GlobalHotkeyManager::start(
                &initial_settings.hotkey_hide,
                &initial_settings.hotkey_expand,
                move |action| match action {
                    HotkeyAction::ToggleHide => {
                        let _ = hotkey_app.emit("lumen://tray-toggle-hide", ());
                    }
                    HotkeyAction::ToggleExpand => {
                        let _ = hotkey_app.emit("lumen://tray-toggle-expand", ());
                    }
                },
            )
            .ok()
            .map(|(mgr, _warn)| mgr);

            let shared_notify_config = Arc::new(Mutex::new(NotificationPrivacyConfig::default()));
            let shared_notify_seq = Arc::new(Mutex::new(0u64));
            let shared_settings = Arc::new(Mutex::new(initial_settings.clone()));

            app.manage(AppState {
                machine: Mutex::new(machine),
                config: Arc::clone(&shared_config),
                preferred_media_app: Arc::clone(&preferred_media_app),
                media_stabilizer: Arc::clone(&shared_media_stabilizer),
                storage: Arc::clone(&storage),
                prayer_config: Mutex::new(PrayerConfig::default()),
                pomodoro: Arc::clone(&pomodoro),
                notify_config: Arc::clone(&shared_notify_config),
                notify_seq: Arc::clone(&shared_notify_seq),
                settings: Arc::clone(&shared_settings),
                settings_path,
                plugins_dir,
                surface_mode: Mutex::new((false, false, false)),
                hotkeys: Mutex::new(hotkeys),
                home_visible: Arc::clone(&home_visible),
                clipboard_secret: Arc::clone(&clipboard_secret),
                is_fullscreen: Arc::clone(&is_fullscreen),
            });

            let Some(window) = app.get_webview_window("island") else {
                return Ok(());
            };

            recenter_window(&window, CANVAS_WIN_W, CANVAS_WIN_H, &initial_settings);
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.show();

            // Immediately sync Windows Geolocation on startup for prayer, Iftar/Sehri, Qibla, and weather
            let startup_loc_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = sync_auto_location_if_enabled(&startup_loc_app).await;
            });

            // System tray icon & menu (FR-WIN-7)
            let toggle_item =
                MenuItem::with_id(app, "toggle", "Open / Collapse Lumen", true, None::<&str>)?;
            let show_item =
                MenuItem::with_id(app, "show_hide", "Show / Hide Island", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Lumen", true, None::<&str>)?;
            let tray_menu =
                Menu::with_items(app, &[&toggle_item, &show_item, &settings_item, &quit_item])?;

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
                    "settings" => {
                        let handle = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = open_settings_window(handle).await;
                        });
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

            #[cfg(windows)]
            let own_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
            #[cfg(not(windows))]
            let own_hwnd = 0isize;

            // Hit-test and click-through manager loop
            // Dynamically toggles WS_EX_TRANSPARENT on the overlay window:
            // - Inside notch/island bounds -> clicks interact with Lumen
            // - Outside notch/island bounds -> clicks pass directly to underlying windows (browser tabs, desktop, etc.)
            let hit_window = window.clone();
            let hit_config = Arc::clone(&shared_config);
            tauri::async_runtime::spawn(async move {
                let mut last_pass_through: Option<bool> = None;

                loop {
                    let (visible, w_logical, h_logical, top_logical) = {
                        let c = hit_config.lock().map(|cfg| *cfg).unwrap_or_default();
                        (
                            c.visible,
                            c.width_logical,
                            c.height_logical,
                            c.top_offset_logical,
                        )
                    };

                    let scale = hit_window.scale_factor().unwrap_or(1.0);
                    let pill_w_px = (w_logical * scale).round() as i32;
                    let pill_h_px = (h_logical * scale).round() as i32;
                    let top_px = (top_logical * scale).round() as i32;

                    let pass_through = if !visible {
                        true
                    } else if let (Some(pos), Some(size), Some((cx, cy))) = (
                        hit_window.outer_position().ok(),
                        hit_window.outer_size().ok(),
                        cursor_screen_pos(),
                    ) {
                        let pill_rect = compute_pill_screen_rect(
                            pos.x,
                            pos.y,
                            size.width as i32,
                            pill_w_px,
                            pill_h_px,
                            top_px,
                        );
                        !pill_rect.contains_point(cx, cy, 0)
                    } else {
                        true
                    };

                    if last_pass_through != Some(pass_through) {
                        last_pass_through = Some(pass_through);
                        let _ = hit_window.set_ignore_cursor_events(pass_through);
                        #[cfg(windows)]
                        set_click_through(own_hwnd, pass_through);
                    }

                    // 60 Hz cursor hit-test using pure WS_EX_TRANSPARENT + DirectComposition
                    // (no GDI SetWindowRgn polygon clipping, avoiding DWM corner artifacts).
                    tokio::time::sleep(Duration::from_millis(16)).await;
                }
            });

            // Fullscreen & System HUD monitor loop at 2 Hz (FR-WIN-4, FR-HUD-1, NFR-PERF-3)
            let fs_window = window.clone();
            let fs_config = Arc::clone(&shared_config);
            let fs_flag = Arc::clone(&is_fullscreen);
            let fs_home_visible = Arc::clone(&home_visible);
            let fs_clip_secret = Arc::clone(&clipboard_secret);
            tauri::async_runtime::spawn(async move {
                let mut last_fullscreen = false;
                let mut last_caps = is_caps_lock_on();
                let mut last_vol = get_system_volume();
                let mut last_battery = battery_status();
                let mut tick_count: u64 = 0;
                let mut last_clip_hash = String::new();
                let mut last_dev_ports: Option<Vec<u16>> = None;

                loop {
                    tick_count = tick_count.wrapping_add(1);
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
                        fs_flag.store(fullscreen, Ordering::Relaxed);
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
                        && (chg != prev_chg
                            || (pct <= 10 && prev_pct > 10)
                            || (pct <= 15 && prev_pct > 15))
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

                    // Clipboard OTP check every 1s & 30s privacy auto-clear
                    if tick_count.is_multiple_of(2) && !fullscreen {
                        let raw = read_clipboard_text().unwrap_or_default();
                        let snap = classify_and_mask_clipboard(&raw);
                        if snap.sensitive
                            && snap.has_content
                            && let Ok(mut guard) = fs_clip_secret.lock()
                        {
                            match *guard {
                                Some((ref prev_secret, _)) if prev_secret == &raw => {}
                                _ => *guard = Some((raw.clone(), Instant::now())),
                            }
                        }
                        if snap.raw_hash != last_clip_hash {
                            last_clip_hash = snap.raw_hash.clone();
                            let _ = fs_window.emit("lumen://clipboard-updated", &snap);
                        }
                        let expired_secret = if let Ok(mut guard) = fs_clip_secret.lock() {
                            if let Some((ref secret, started)) = *guard
                                && started.elapsed() >= Duration::from_secs(30)
                            {
                                let owned = secret.clone();
                                *guard = None;
                                Some(owned)
                            } else {
                                None
                            }
                        } else {
                            None
                        };
                        if let Some(secret) = expired_secret
                            && clear_clipboard_if_matching(&secret)
                        {
                            last_clip_hash.clear();
                            let _ = fs_window.emit(
                                "lumen://clipboard-updated",
                                ClipboardChipSnapshot {
                                    display_text: String::new(),
                                    sensitive: false,
                                    raw_hash: String::new(),
                                    has_content: false,
                                },
                            );
                        }
                    }

                    // Dev Pulse check every 5s ONLY when Home is visible & not in fullscreen
                    if tick_count.is_multiple_of(10)
                        && fs_home_visible.load(Ordering::Relaxed)
                        && !fullscreen
                    {
                        let ports = fs_window
                            .try_state::<AppState>()
                            .and_then(|s| s.settings.lock().ok().map(|g| g.dev_pulse_ports.clone()))
                            .unwrap_or_else(|| vec![3000, 5173, 1420]);
                        if let Ok(up_ports) =
                            tokio::task::spawn_blocking(move || check_dev_ports(&ports)).await
                            && last_dev_ports.as_ref() != Some(&up_ports)
                        {
                            last_dev_ports = Some(up_ports.clone());
                            let _ = fs_window.emit(
                                "lumen://dev-pulse-updated",
                                DevPulseSnapshot {
                                    primary_port: up_ports.first().copied(),
                                    up: !up_ports.is_empty(),
                                    ports: up_ports,
                                },
                            );
                        }
                    }

                    // Prayer schedule recomputation every 60s (and auto-location refresh every 30 min)
                    if tick_count.is_multiple_of(3600) && !fullscreen {
                        let _ = sync_auto_location_if_enabled(fs_window.app_handle()).await;
                    } else if tick_count.is_multiple_of(120)
                        && !fullscreen
                        && let Some(sched) = fs_window.try_state::<AppState>().and_then(|s| {
                            s.prayer_config
                                .lock()
                                .ok()
                                .map(|cfg| compute_prayer_schedule(Utc::now(), &cfg))
                        })
                    {
                        let _ = fs_window.emit("lumen://prayer-updated", sched);
                    }

                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            });

            // Background SMTC (2 Hz real-time timeline sync) + Pomodoro + OS Notification & Reminder ticker
            let media_window = window.clone();
            let media_pref = Arc::clone(&preferred_media_app);
            let media_stab_loop = Arc::clone(&shared_media_stabilizer);
            let pom_ref = Arc::clone(&pomodoro);
            let storage_ref = Arc::clone(&storage);
            let notify_cfg_ref = Arc::clone(&shared_notify_config);
            let notify_seq_ref = Arc::clone(&shared_notify_seq);
            let settings_ref = Arc::clone(&shared_settings);
            let bg_fs_flag = Arc::clone(&is_fullscreen);
            let media_playing_flag = Arc::new(AtomicBool::new(false));
            let media_playing_for_poll = Arc::clone(&media_playing_flag);

            // Real-time ~30 fps WASAPI render peak meter thread (idles at 0% IPC/polling while paused).
            let peak_window = window.clone();
            let peak_playing = Arc::clone(&media_playing_flag);
            let peak_fullscreen = Arc::clone(&is_fullscreen);
            let _ = std::thread::Builder::new()
                .name("lumen-audio-peak".into())
                .spawn(move || {
                    let mut reader = AudioPeakReader::new();
                    let mut shaped = 0.0f32;
                    let mut last_emitted = -1.0f32;
                    loop {
                        let playing = peak_playing.load(Ordering::Relaxed);
                        let fullscreen = peak_fullscreen.load(Ordering::Relaxed);
                        if !playing || fullscreen {
                            if last_emitted > 0.0 {
                                last_emitted = 0.0;
                                shaped = 0.0;
                                let _ = peak_window.emit("lumen://audio-peak", 0.0f32);
                            }
                            std::thread::sleep(Duration::from_millis(200));
                            continue;
                        }
                        let raw = reader.sample();
                        shaped = shape_audio_peak(raw, shaped);
                        if (shaped - last_emitted).abs() > 0.015
                            || (shaped == 0.0 && last_emitted > 0.0)
                        {
                            last_emitted = shaped;
                            let _ = peak_window.emit("lumen://audio-peak", shaped);
                        }
                        std::thread::sleep(Duration::from_millis(33));
                    }
                });

            tauri::async_runtime::spawn(async move {
                let mut last_snapshot: Option<MediaStateSnapshot> = None;
                let mut half_tick: u64 = 0;
                let watcher = Arc::new(Mutex::new(SystemNotificationWatcher::new()));

                loop {
                    half_tick = half_tick.wrapping_add(1);
                    let pref = media_pref.lock().ok().and_then(|g| g.clone());
                    let stab = Arc::clone(&media_stab_loop);
                    if let Ok(snapshot) = tokio::task::spawn_blocking(move || {
                        read_stabilized_media(pref.as_deref(), &stab)
                    })
                    .await
                    {
                        let playing_now = snapshot.active.as_ref().is_some_and(|a| a.is_playing);
                        media_playing_for_poll.store(playing_now, Ordering::Relaxed);
                        if last_snapshot.as_ref() != Some(&snapshot) {
                            last_snapshot = Some(snapshot.clone());
                            let _ = media_window.emit("lumen://media-updated", snapshot);
                        }
                    }

                    if half_tick.is_multiple_of(2) {
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

                        // Real-time Desktop + Browser Notification Sync with app logos
                        let watcher_clone = Arc::clone(&watcher);
                        if let Ok(captured) = tokio::task::spawn_blocking(move || {
                            watcher_clone
                                .lock()
                                .map(|mut w| w.poll_new())
                                .unwrap_or_default()
                        })
                        .await
                            && !captured.is_empty()
                        {
                            let cfg = notify_cfg_ref.lock().map(|g| g.clone()).unwrap_or_default();
                            let settings =
                                settings_ref.lock().map(|g| g.clone()).unwrap_or_default();
                            let is_fs = bg_fs_flag.load(Ordering::Relaxed);
                            let quiet = is_focus_assist_quiet();
                            for item in captured {
                                let next_id = notify_seq_ref
                                    .lock()
                                    .map(|mut seq| {
                                        *seq = seq.saturating_add(1);
                                        *seq
                                    })
                                    .unwrap_or(1);
                                if let Some(popup) =
                                    filter_captured_notification(next_id, &item, &cfg, is_fs, quiet)
                                {
                                    let _ = media_window.emit("lumen://notification-popup", &popup);
                                    let ctx = build_sound_ctx(&settings, &pom_ref, is_fs, false);
                                    let _ = try_play_ui_sound(UiSoundName::MailArrival, &ctx);
                                }
                            }
                        }

                        // Manual Reminders scheduler (lead-time alert, snooze, and mandatory exact-time trigger)
                        if let Ok(due_alerts) = storage_ref.poll_due_reminders(Utc::now())
                            && !due_alerts.is_empty()
                        {
                            let settings =
                                settings_ref.lock().map(|g| g.clone()).unwrap_or_default();
                            let is_fs = bg_fs_flag.load(Ordering::Relaxed);
                            let ctx = build_sound_ctx(&settings, &pom_ref, is_fs, true);
                            for alert in &due_alerts {
                                let _ = media_window.emit("lumen://reminder-alert", alert);
                            }
                            let _ = try_play_ui_sound(UiSoundName::ReminderAlarm, &ctx);
                            if let Ok(updated_list) = storage_ref.list_reminders() {
                                let _ =
                                    media_window.emit("lumen://reminders-updated", &updated_list);
                            }
                        }
                    }

                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
            tasks_delete,
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
            notify_push_test,
            monitors_list,
            settings_get,
            settings_update,
            open_settings_window,
            close_settings_window,
            system_get_mic_muted,
            system_toggle_mic_mute,
            system_lock_workstation,
            system_capture_screenshot,
            system_ocr_screen,
            system_privacy_indicators,
            calendar_list,
            calendar_add,
            calendar_delete,
            reminders_list,
            reminders_add,
            reminders_delete,
            reminders_stop,
            reminders_snooze,
            plugins_list,
            play_ui_sound,
            system_quick_toggles_state,
            system_toggle_wifi,
            system_toggle_bluetooth,
            system_toggle_keep_awake,
            prayer_set_method,
            weather_get_current,
            tasbih_get,
            tasbih_increment,
            tasbih_reset,
            ledger_get,
            ledger_toggle,
            clipboard_get_latest,
            clipboard_copy_latest,
            home_set_visible,
            system_battery_status,
            monitor_auto_scale_factor
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}

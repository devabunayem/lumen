use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::{DateTime, Local, Utc};
use lumen_core::calendar_parser::{ParsedQuickAdd, parse_quick_add};
use lumen_core::focus_engine::{FocusConfig, FocusEngine, FocusFlowState, PrayerArrivalMode};
use lumen_core::{
    IslandMachine, LumenSettings, PomodoroController, PomodoroPhase, PomodoroSnapshot,
};
use lumen_media::sounds::{SoundSilenceContext, UiSoundName, try_play_ui_sound};
use lumen_media::{
    AudioPeakReader, MediaCommand, MediaGraceStabilizer, MediaStateSnapshot, get_mic_muted,
    get_system_volume, read_media_state_with_exclusions, seek_media, send_media_command,
    set_system_volume, shape_audio_peak, toggle_mic_mute,
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
use lumen_storage::calendar_hub::{
    CalendarHubEvent, CalendarHubSnapshot, CalendarReminder, CalendarTask, PrayerAnchorSpec,
    SyncedEventInput,
};
use lumen_storage::{
    CLIPBOARD_MAX_CONTENT_BYTES, CLIPBOARD_MAX_UNPINNED, ClipboardHistoryItem, SHELF_MAX_ITEMS,
    ShelfItem, StorageRepo, TasbihState, TimeLedgerState, WaterSummary,
};
use lumen_sync::google::connect_google_pkce;
use lumen_sync::keyring_store::{delete_tokens, save_tokens};
use lumen_sync::microsoft::connect_microsoft_pkce;
use lumen_sync::oauth::open_browser_url;
use lumen_sync::{cache_window_bounds, disconnect_provider, push_task_to_provider, sync_provider};
use lumen_windows::{
    ClipboardChipSnapshot, GlobalHotkeyManager, HotkeyAction, HudEvent, OpenMeteoWeather,
    SystemTelemetrySampler, SystemTelemetrySnapshot, acquire_single_instance_mutex, battery_status,
    capture_screen_to_png, check_dev_ports, classify_and_mask_clipboard, classify_clipboard_kind,
    clear_clipboard_if_matching, clipboard_preview_text, compute_pill_screen_rect,
    compute_top_center_position, cursor_screen_pos, fetch_open_meteo_weather,
    get_windows_location_opt_in, is_autostart_enabled, is_camera_access_allowed, is_caps_lock_on,
    is_keep_awake, is_other_app_fullscreen, launch_screen_recording, launch_snipping_screenshot,
    lock_workstation, ocr_screen_to_clipboard, open_camera_privacy_settings, open_shell_target,
    pick_shelf_files, privacy_device_status, quick_radios_status, read_clipboard_text,
    set_autostart_enabled, set_click_through, set_keep_awake, set_window_bounds_atomic,
    toggle_radio_kind, write_clipboard_text,
};
use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    Emitter, LogicalSize, Manager, Monitor, PhysicalPosition, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const CANVAS_WIN_W: f64 = 1220.0;
const CANVAS_WIN_H: f64 = 600.0;

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
    system_shelf_visible: Arc<AtomicBool>,
    telemetry_sampler: Arc<Mutex<SystemTelemetrySampler>>,
    clipboard_secret: Arc<Mutex<Option<(String, Instant, String)>>>,
    clipboard_capture_paused: Arc<AtomicBool>,
    is_fullscreen: Arc<AtomicBool>,
    silent_mode: Arc<AtomicBool>,
    focus_managed_silent: Arc<AtomicBool>,
    focus_engine: Arc<Mutex<FocusEngine>>,
    last_calendar_sync: Arc<Mutex<Option<Instant>>>,
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
    camera_enabled: bool,
    camera_in_use: bool,
    silent_mode: bool,
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
    // Keep canvas zero-resize across scale changes: fits 150% Home & Calendar Hub (960x468) + 16px margin + ears.
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
            if expanded {
                let is_stale = state
                    .last_calendar_sync
                    .lock()
                    .ok()
                    .and_then(|g| g.map(|t| t.elapsed() >= Duration::from_secs(60)))
                    .unwrap_or(true);
                if is_stale {
                    let sync_app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = calendar_sync_background(&sync_app, None).await;
                    });
                }
            }
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
    exclusions: &[String],
    stabilizer: &Arc<Mutex<MediaGraceStabilizer>>,
) -> MediaStateSnapshot {
    let raw = read_media_state_with_exclusions(preferred, exclusions);
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
    let exclusions = state
        .settings
        .lock()
        .map(|s| s.media_exclusions.clone())
        .unwrap_or_default();
    let stabilizer = Arc::clone(&state.media_stabilizer);
    tokio::task::spawn_blocking(move || {
        read_stabilized_media(preferred.as_deref(), &exclusions, &stabilizer)
    })
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
    let exclusions = state
        .settings
        .lock()
        .map(|s| s.media_exclusions.clone())
        .unwrap_or_default();
    let stabilizer = Arc::clone(&state.media_stabilizer);
    if matches!(cmd, MediaCommand::Next | MediaCommand::Previous)
        && let Ok(mut guard) = stabilizer.lock()
    {
        guard.notify_skip(Instant::now());
    }
    let snap = tokio::task::spawn_blocking(move || {
        send_media_command(cmd, preferred.as_deref())?;
        Ok::<MediaStateSnapshot, String>(read_stabilized_media(
            preferred.as_deref(),
            &exclusions,
            &stabilizer,
        ))
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
    let exclusions = state
        .settings
        .lock()
        .map(|s| s.media_exclusions.clone())
        .unwrap_or_default();
    let stabilizer = Arc::clone(&state.media_stabilizer);
    let snap = tokio::task::spawn_blocking(move || {
        seek_media(position_ms, preferred.as_deref())?;
        Ok::<MediaStateSnapshot, String>(read_stabilized_media(
            preferred.as_deref(),
            &exclusions,
            &stabilizer,
        ))
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
    let exclusions = state
        .settings
        .lock()
        .map(|s| s.media_exclusions.clone())
        .unwrap_or_default();
    let stabilizer = Arc::clone(&state.media_stabilizer);
    tokio::task::spawn_blocking(move || {
        set_system_volume(volume_percent)?;
        Ok::<MediaStateSnapshot, String>(read_stabilized_media(
            preferred.as_deref(),
            &exclusions,
            &stabilizer,
        ))
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
    let exclusions = state
        .settings
        .lock()
        .map(|s| s.media_exclusions.clone())
        .unwrap_or_default();
    let stabilizer = Arc::clone(&state.media_stabilizer);
    tokio::task::spawn_blocking(move || {
        read_stabilized_media(preferred.as_deref(), &exclusions, &stabilizer)
    })
    .await
    .map_err(|e| format!("session select join error: {e}"))
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
    let summary = state
        .storage
        .log_water(ml, Utc::now(), goal_ml, reset_hour)?;
    let _ = state.storage.log_activity(
        "water",
        &Utc::now().to_rfc3339(),
        Some(&Utc::now().to_rfc3339()),
        None,
        Some(&format!("+{ml} ml")),
    );
    Ok(summary)
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

fn focus_config_from_settings(settings: &LumenSettings) -> FocusConfig {
    FocusConfig {
        focus_min: settings.focus_minutes,
        short_break_min: settings.focus_short_break_minutes,
        long_break_min: settings.focus_long_break_minutes,
        rounds: settings.focus_rounds,
        social_blocked_armed: settings.calendar_social_block_armed,
        sync_dnd: true,
        sync_time_ledger: true,
        prayer_arrival_mode: PrayerArrivalMode::from_str_mode(&settings.calendar_prayer_pause_mode),
    }
}

fn sync_focus_side_effects(
    app: &tauri::AppHandle,
    pom_snap: &PomodoroSnapshot,
    focus_state: &FocusFlowState,
    storage: &StorageRepo,
    silent_flag: &AtomicBool,
    managed_silent: &AtomicBool,
) {
    let now = Utc::now().to_rfc3339();
    if focus_state.dnd_active {
        if !silent_flag.load(Ordering::Relaxed) {
            silent_flag.store(true, Ordering::Relaxed);
            managed_silent.store(true, Ordering::Relaxed);
        }
    } else if managed_silent.swap(false, Ordering::Relaxed) {
        silent_flag.store(false, Ordering::Relaxed);
    }

    if pom_snap.running && pom_snap.phase == PomodoroPhase::Focus {
        let task_ref = focus_state.bound_task_id.map(|id| id.to_string());
        let label = focus_state
            .bound_task_title
            .as_deref()
            .unwrap_or("Free focus");
        let _ = storage.log_activity("focus", &now, None, task_ref.as_deref(), Some(label));
        if focus_state.time_ledger_active
            && let Ok(cur) = storage.get_active_ledger()
            && !cur.running
        {
            let _ = storage.toggle_ledger(Some(label));
        }
    } else {
        let _ = storage.finish_open_focus_activity(&now);
        if let Ok(cur) = storage.get_active_ledger()
            && cur.running
        {
            let _ = storage.toggle_ledger(None);
        }
    }

    if let Some(win) = app.get_webview_window("island") {
        let _ = win.emit("lumen://pomodoro-tick", pom_snap);
        let _ = win.emit("lumen://focus-flow-updated", focus_state);
    }
    let _ = app.emit("lumen://calendar-hub-updated", ());
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
fn pomodoro_toggle(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<PomodoroSnapshot, String> {
    let snap = {
        let mut guard = state
            .pomodoro
            .lock()
            .map_err(|_| "pomodoro lock poisoned".to_string())?;
        guard.toggle_start_pause();
        guard.snapshot()
    };
    let focus_state = {
        let mut fe = state
            .focus_engine
            .lock()
            .map_err(|_| "focus engine lock poisoned".to_string())?;
        fe.on_manual_toggle(snap.running);
        fe.snapshot(&snap)
    };
    sync_focus_side_effects(
        &app,
        &snap,
        &focus_state,
        &state.storage,
        &state.silent_mode,
        &state.focus_managed_silent,
    );
    if snap.running {
        let settings = state.settings.lock().map(|g| g.clone()).unwrap_or_default();
        let is_fs = state.is_fullscreen.load(Ordering::Relaxed);
        let ctx = build_sound_ctx(&settings, &state.pomodoro, is_fs, true);
        let _ = try_play_ui_sound(UiSoundName::FocusStart, &ctx);
    }
    Ok(snap)
}

#[tauri::command]
fn pomodoro_skip(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<PomodoroSnapshot, String> {
    let snap = {
        let mut guard = state
            .pomodoro
            .lock()
            .map_err(|_| "pomodoro lock poisoned".to_string())?;
        guard.skip();
        guard.snapshot()
    };
    let focus_state = state
        .focus_engine
        .lock()
        .map_err(|_| "focus engine lock poisoned".to_string())?
        .snapshot(&snap);
    sync_focus_side_effects(
        &app,
        &snap,
        &focus_state,
        &state.storage,
        &state.silent_mode,
        &state.focus_managed_silent,
    );
    Ok(snap)
}

#[tauri::command]
fn pomodoro_reset(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<PomodoroSnapshot, String> {
    let snap = {
        let mut guard = state
            .pomodoro
            .lock()
            .map_err(|_| "pomodoro lock poisoned".to_string())?;
        guard.reset();
        guard.snapshot()
    };
    let focus_state = state
        .focus_engine
        .lock()
        .map_err(|_| "focus engine lock poisoned".to_string())?
        .snapshot(&snap);
    sync_focus_side_effects(
        &app,
        &snap,
        &focus_state,
        &state.storage,
        &state.silent_mode,
        &state.focus_managed_silent,
    );
    Ok(snap)
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
    state
        .storage
        .add_shelf_item(&kind, &path_or_text, SHELF_MAX_ITEMS)
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
async fn shelf_pick_files(state: State<'_, AppState>) -> Result<Vec<ShelfItem>, String> {
    let paths = tokio::task::spawn_blocking(pick_shelf_files)
        .await
        .map_err(|e| format!("shelf file picker join error: {e}"))??;
    for path in paths {
        let _ = state.storage.add_shelf_item("file", &path, SHELF_MAX_ITEMS);
    }
    state.storage.list_shelf()
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
    let silent = state.silent_mode.load(Ordering::Relaxed);
    let filtered = filter_notification(
        *seq,
        &app_name,
        &title,
        &body,
        &cfg,
        false,
        is_focus_assist_quiet() || silent,
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

    let next_focus_cfg = focus_config_from_settings(&clean);
    let pom_cfg = next_focus_cfg.to_pomodoro_config(true);
    let pom_snap = if let Ok(mut p) = state.pomodoro.lock() {
        p.update_config(pom_cfg);
        p.snapshot()
    } else {
        PomodoroController::new(pom_cfg, 0).snapshot()
    };
    if let Ok(mut fe) = state.focus_engine.lock() {
        fe.update_config(next_focus_cfg);
        let focus_state = fe.snapshot(&pom_snap);
        let _ = app.emit("lumen://focus-flow-updated", focus_state);
    }
    let _ = app.emit("lumen://pomodoro-tick", pom_snap);

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
    let _ = state
        .storage
        .add_shelf_item("file", &saved, SHELF_MAX_ITEMS);
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
async fn system_launch_snipping_screenshot(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.hide();
        tokio::time::sleep(Duration::from_millis(120)).await;
    }
    let res = tokio::task::spawn_blocking(launch_snipping_screenshot)
        .await
        .map_err(|e| format!("snipping launch error: {e}"))?;
    if let Some(win) = app.get_webview_window("island") {
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(650)).await;
            let _ = win.show();
        });
    }
    res
}

#[tauri::command]
async fn system_launch_screen_recording(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("island") {
        let _ = win.hide();
        tokio::time::sleep(Duration::from_millis(120)).await;
    }
    let res = tokio::task::spawn_blocking(launch_screen_recording)
        .await
        .map_err(|e| format!("screen record launch error: {e}"))?;
    if let Some(win) = app.get_webview_window("island") {
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(650)).await;
            let _ = win.show();
        });
    }
    res
}

#[tauri::command]
async fn system_toggle_camera() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        open_camera_privacy_settings()?;
        Ok(is_camera_access_allowed())
    })
    .await
    .map_err(|e| format!("camera settings error: {e}"))?
}

#[tauri::command]
fn system_toggle_silent_mode(enabled: Option<bool>, state: State<'_, AppState>) -> bool {
    let next = enabled.unwrap_or_else(|| !state.silent_mode.load(Ordering::Relaxed));
    state.silent_mode.store(next, Ordering::Relaxed);
    next
}

#[tauri::command]
fn play_ui_sound(name: String, state: State<'_, AppState>) -> Result<bool, String> {
    if state.silent_mode.load(Ordering::Relaxed) {
        return Ok(false);
    }
    let Some(sound) = UiSoundName::from_str_name(&name) else {
        return Ok(false);
    };
    let settings = state.settings.lock().map(|g| g.clone()).unwrap_or_default();
    if matches!(sound, UiSoundName::LumiHello | UiSoundName::LumiHappy)
        && (!settings.mascot_enabled || !settings.lumi_sounds_enabled)
    {
        return Ok(false);
    }
    let is_fs = state.is_fullscreen.load(Ordering::Relaxed);
    let allow_focus = matches!(
        sound,
        UiSoundName::ReminderAlarm | UiSoundName::FocusStart | UiSoundName::FocusEnd
    );
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
    let silent_mode = state.silent_mode.load(Ordering::Relaxed);
    tokio::task::spawn_blocking(move || {
        let (wifi, bluetooth) = quick_radios_status();
        let mic_muted = get_mic_muted();
        let (camera_in_use, mic_in_use) = privacy_device_status();
        let camera_enabled = is_camera_access_allowed();
        let keep_awake = is_keep_awake();
        QuickTogglesState {
            wifi,
            bluetooth,
            focus,
            mic_muted,
            mic_in_use,
            keep_awake,
            camera_enabled,
            camera_in_use,
            silent_mode,
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
    let next = state.storage.toggle_ledger(client_name.as_deref())?;
    if next.running {
        let _ = state.storage.log_activity(
            "ledger",
            &Utc::now().to_rfc3339(),
            None,
            None,
            Some(&next.client_name),
        );
    }
    Ok(next)
}

#[tauri::command]
fn calendar_hub_get_snapshot(
    year: i32,
    month: u32,
    state: State<'_, AppState>,
) -> Result<CalendarHubSnapshot, String> {
    state.storage.calendar_hub_snapshot(year, month)
}

#[tauri::command]
fn calendar_hub_add_task(
    title: String,
    due_date: Option<String>,
    due_time: Option<String>,
    estimate_min: Option<i64>,
    is_deadline: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<CalendarTask, String> {
    let task = state.storage.calendar_hub_add_task(
        &title,
        due_date.as_deref(),
        due_time.as_deref(),
        estimate_min,
        is_deadline.unwrap_or(false),
    )?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(task)
}

#[tauri::command]
fn calendar_hub_toggle_task(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let res = state.storage.calendar_hub_toggle_task(id)?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(res)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn calendar_hub_add_local_event(
    title: String,
    start: String,
    end: String,
    all_day: bool,
    color: String,
    meeting_url: Option<String>,
    location: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<CalendarHubEvent, String> {
    let ev = state.storage.calendar_hub_add_local_event(
        &title,
        &start,
        &end,
        all_day,
        &color,
        meeting_url.as_deref(),
        location.as_deref(),
    )?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(ev)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn calendar_hub_add_reminder(
    title: String,
    kind: String,
    at: Option<String>,
    repeat_rule: Option<String>,
    prayer_anchor: Option<PrayerAnchorSpec>,
    importance: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<CalendarReminder, String> {
    let rem = state.storage.calendar_hub_add_reminder(
        &title,
        &kind,
        at.as_deref(),
        repeat_rule.as_deref(),
        prayer_anchor,
        importance.as_deref().unwrap_or("normal"),
    )?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(rem)
}

#[tauri::command]
fn calendar_hub_parse_quick_add(raw: String, mode: String) -> ParsedQuickAdd {
    let today = Local::now().format("%Y-%m-%d").to_string();
    parse_quick_add(&raw, &today, &mode)
}

#[tauri::command]
fn calendar_hub_move_task_due(
    id: i64,
    due_date: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .calendar_hub_move_task_due(id, due_date.as_deref())?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
fn calendar_hub_delete_task(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<CalendarTask>, String> {
    let deleted = state.storage.calendar_hub_delete_task(id)?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(deleted)
}

#[tauri::command]
fn calendar_hub_restore_task(
    task: CalendarTask,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<CalendarTask, String> {
    let restored = state.storage.calendar_hub_restore_task(&task)?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(restored)
}

#[tauri::command]
fn calendar_hub_set_focus_task(
    task_id: Option<i64>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<i64>, String> {
    let out = state.storage.calendar_hub_set_focus_task(task_id)?;
    let title = out.and_then(|tid| {
        let now = Local::now();
        state
            .storage
            .calendar_hub_snapshot(
                now.format("%Y").to_string().parse().unwrap_or(2026),
                now.format("%m").to_string().parse().unwrap_or(1),
            )
            .ok()
            .and_then(|snap| {
                snap.tasks
                    .into_iter()
                    .find(|t| t.id == tid)
                    .map(|t| t.title)
            })
    });
    let pom_snap = state
        .pomodoro
        .lock()
        .map(|p| p.snapshot())
        .map_err(|_| "pomodoro lock poisoned".to_string())?;
    if let Ok(mut fe) = state.focus_engine.lock() {
        fe.set_bound_task(out, title);
        let focus_state = fe.snapshot(&pom_snap);
        let _ = app.emit("lumen://focus-flow-updated", focus_state);
    }
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(out)
}

#[tauri::command]
fn calendar_hub_complete_reminder(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .calendar_hub_complete_reminder(id, Utc::now())?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
fn calendar_hub_snooze_reminder(
    id: i64,
    minutes: Option<i64>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .storage
        .calendar_hub_snooze_reminder(id, minutes.unwrap_or(10), Utc::now())?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
fn calendar_hub_dismiss_missed(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.storage.calendar_hub_dismiss_missed()?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

async fn calendar_sync_background(
    app: &tauri::AppHandle,
    target_source_id: Option<String>,
) -> Result<(), String> {
    let Some(st) = app.try_state::<AppState>() else {
        return Ok(());
    };
    let sources = st.storage.calendar_hub_list_sync_sources()?;
    let settings = st.settings.lock().map(|g| g.clone()).unwrap_or_default();
    let external: Vec<_> = sources
        .into_iter()
        .filter(|(src, _)| src.provider != "local")
        .filter(|(src, _)| {
            target_source_id
                .as_deref()
                .map(|tid| tid == src.id)
                .unwrap_or(true)
        })
        .collect();
    if external.is_empty() {
        if let Ok(mut ts) = st.last_calendar_sync.lock() {
            *ts = Some(Instant::now());
        }
        return Ok(());
    }

    let storage_ref = Arc::clone(&st.storage);
    let google_cid = settings.calendar_google_client_id.clone();
    let ms_cid = settings.calendar_microsoft_client_id.clone();

    tokio::task::spawn_blocking(move || {
        let now = Utc::now();
        let (min_w, max_w) = cache_window_bounds(now);
        for (source, sync_token) in external {
            let client_id = match source.provider.as_str() {
                "google" => (!google_cid.trim().is_empty()).then_some(google_cid.as_str()),
                "microsoft" => (!ms_cid.trim().is_empty()).then_some(ms_cid.as_str()),
                _ => None,
            };
            match sync_provider(
                &source.provider,
                &source.id,
                source.ics_url.as_deref(),
                sync_token.as_deref(),
                client_id,
                now,
            ) {
                Ok(res) => {
                    let mapped: Vec<SyncedEventInput> = res
                        .events
                        .into_iter()
                        .map(|e| SyncedEventInput {
                            external_id: e.external_id,
                            title: e.title,
                            start_at: e.start_at,
                            end_at: e.end_at,
                            all_day: e.all_day,
                            color: e.color,
                            meeting_url: e.meeting_url,
                            location: e.location,
                        })
                        .collect();
                    let _ = storage_ref.calendar_hub_apply_sync_result(
                        &source.id,
                        &mapped,
                        &res.removed_external_ids,
                        res.next_sync_token.as_deref(),
                        res.full_replace,
                        now,
                        min_w,
                        max_w,
                    );
                }
                Err(err) => {
                    let _ = storage_ref.calendar_hub_record_sync_error(&source.id, &err);
                }
            }
        }
    })
    .await
    .map_err(|e| format!("calendar sync task failed: {e}"))?;

    if let Some(st2) = app.try_state::<AppState>()
        && let Ok(mut ts) = st2.last_calendar_sync.lock()
    {
        *ts = Some(Instant::now());
    }
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
async fn calendar_hub_connect_ics(
    label: String,
    url: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let clean_url = url.trim().to_string();
    let clean_label = if label.trim().is_empty() {
        "Subscribed ICS".to_string()
    } else {
        label.trim().to_string()
    };
    let now = Utc::now();
    let source_id = format!("ics:{}", now.timestamp_millis());
    let storage_ref = Arc::clone(&state.storage);

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let fetched = sync_provider("ics", &source_id, Some(&clean_url), None, None, now)?;
        storage_ref.calendar_hub_upsert_sync_source(
            &source_id,
            "ics",
            &clean_label,
            Some(&clean_url),
        )?;
        let (min_w, max_w) = cache_window_bounds(now);
        let mapped: Vec<SyncedEventInput> = fetched
            .events
            .into_iter()
            .map(|e| SyncedEventInput {
                external_id: e.external_id,
                title: e.title,
                start_at: e.start_at,
                end_at: e.end_at,
                all_day: e.all_day,
                color: e.color,
                meeting_url: e.meeting_url,
                location: e.location,
            })
            .collect();
        storage_ref.calendar_hub_apply_sync_result(
            &source_id,
            &mapped,
            &fetched.removed_external_ids,
            fetched.next_sync_token.as_deref(),
            true,
            now,
            min_w,
            max_w,
        )?;
        Ok(())
    })
    .await
    .map_err(|e| format!("ICS connect join failed: {e}"))??;

    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
async fn calendar_hub_connect_oauth(
    provider: String,
    client_id: String,
    write_scope: Option<bool>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let prov = provider.trim().to_ascii_lowercase();
    let clean_cid = client_id.trim().to_string();
    let write_opt = write_scope.unwrap_or(false);
    let storage_ref = Arc::clone(&state.storage);
    let source_id = format!("{prov}:primary");

    // Persist client ID cleanly in settings if entered here
    if !clean_cid.is_empty()
        && let Ok(mut guard) = state.settings.lock()
    {
        match prov.as_str() {
            "google" => guard.calendar_google_client_id = clean_cid.clone(),
            "microsoft" => guard.calendar_microsoft_client_id = clean_cid.clone(),
            _ => {}
        }
        let _ = guard.save_to_path(&state.settings_path);
        let _ = app.emit("lumen://settings-updated", guard.clone());
    }

    let sid_clone = source_id.clone();
    let prov_clone = prov.clone();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let (tokens, account_label) = match prov_clone.as_str() {
            "google" => connect_google_pkce(&clean_cid, write_opt)?,
            "microsoft" => connect_microsoft_pkce(&clean_cid, write_opt)?,
            other => return Err(format!("Unsupported OAuth provider: {other}")),
        };
        save_tokens(&sid_clone, &tokens)?;
        storage_ref.calendar_hub_upsert_sync_source(
            &sid_clone,
            &prov_clone,
            &account_label,
            None,
        )?;
        Ok(())
    })
    .await
    .map_err(|e| format!("OAuth connect join failed: {e}"))??;

    calendar_sync_background(&app, Some(source_id)).await?;
    Ok(())
}

#[tauri::command]
async fn calendar_hub_sync_now(
    source_id: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    calendar_sync_background(&app, source_id).await
}

#[tauri::command]
fn calendar_hub_disconnect_source(
    source_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let prov = state
        .storage
        .calendar_hub_list_sync_sources()?
        .into_iter()
        .find(|(s, _)| s.id == source_id)
        .map(|(s, _)| s.provider)
        .unwrap_or_else(|| "google".into());
    disconnect_provider(&prov, &source_id)?;
    state.storage.calendar_hub_disconnect_source(&source_id)?;
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
fn calendar_hub_delete_all_data(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let external_ids = state.storage.calendar_hub_delete_all_data()?;
    for sid in external_ids {
        let _ = delete_tokens(&sid);
    }
    let pom_snap = state
        .pomodoro
        .lock()
        .map(|p| p.snapshot())
        .unwrap_or_else(|_| PomodoroController::new(Default::default(), 0).snapshot());
    if let Ok(mut fe) = state.focus_engine.lock() {
        fe.set_bound_task(None, None);
        fe.dismiss_free_focus_prompt();
        let focus_state = fe.snapshot(&pom_snap);
        let _ = app.emit("lumen://focus-flow-updated", focus_state);
    }
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(())
}

#[tauri::command]
fn calendar_hub_open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return Err("Only http/https URLs can be opened".into());
    }
    open_browser_url(trimmed)
}

#[tauri::command]
fn calendar_hub_push_task_event(
    title: String,
    start_rfc3339: String,
    end_rfc3339: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let settings = state.settings.lock().map(|g| g.clone()).unwrap_or_default();
    if !settings.calendar_writeback_tasks {
        return Err("Enable 'Add Lumen tasks to my calendar' in Settings first".into());
    }
    let sources = state.storage.calendar_hub_list_sync_sources()?;
    let writable = sources
        .into_iter()
        .find(|(s, _)| s.provider == "google" || s.provider == "microsoft")
        .ok_or_else(|| "No connected Google or Microsoft calendar found".to_string())?;
    let cid = match writable.0.provider.as_str() {
        "google" => (!settings.calendar_google_client_id.trim().is_empty())
            .then_some(settings.calendar_google_client_id.as_str()),
        "microsoft" => (!settings.calendar_microsoft_client_id.trim().is_empty())
            .then_some(settings.calendar_microsoft_client_id.as_str()),
        _ => None,
    };
    push_task_to_provider(
        &writable.0.provider,
        &writable.0.id,
        cid,
        &title,
        &start_rfc3339,
        &end_rfc3339,
    )
}

#[tauri::command]
fn calendar_hub_focus_get_state(state: State<'_, AppState>) -> Result<FocusFlowState, String> {
    let pom_snap = state
        .pomodoro
        .lock()
        .map_err(|_| "pomodoro lock poisoned".to_string())?
        .snapshot();
    let fe = state
        .focus_engine
        .lock()
        .map_err(|_| "focus engine lock poisoned".to_string())?;
    Ok(fe.snapshot(&pom_snap))
}

#[tauri::command]
fn calendar_hub_focus_respond_prayer(
    pause: bool,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<FocusFlowState, String> {
    let should_pause = {
        let mut fe = state
            .focus_engine
            .lock()
            .map_err(|_| "focus engine lock poisoned".to_string())?;
        fe.respond_prayer_prompt(pause)
    };
    let pom_snap = {
        let mut pom = state
            .pomodoro
            .lock()
            .map_err(|_| "pomodoro lock poisoned".to_string())?;
        if should_pause {
            pom.set_running(false);
        }
        pom.snapshot()
    };
    let focus_state = state
        .focus_engine
        .lock()
        .map_err(|_| "focus engine lock poisoned".to_string())?
        .snapshot(&pom_snap);
    sync_focus_side_effects(
        &app,
        &pom_snap,
        &focus_state,
        &state.storage,
        &state.silent_mode,
        &state.focus_managed_silent,
    );
    Ok(focus_state)
}

#[tauri::command]
fn calendar_hub_focus_dismiss_free_log(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<FocusFlowState, String> {
    let pom_snap = state
        .pomodoro
        .lock()
        .map_err(|_| "pomodoro lock poisoned".to_string())?
        .snapshot();
    let focus_state = {
        let mut fe = state
            .focus_engine
            .lock()
            .map_err(|_| "focus engine lock poisoned".to_string())?;
        fe.dismiss_free_focus_prompt();
        fe.snapshot(&pom_snap)
    };
    let _ = app.emit("lumen://focus-flow-updated", &focus_state);
    Ok(focus_state)
}

#[tauri::command]
fn calendar_hub_focus_log_free_task(
    title: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<CalendarTask, String> {
    let prompt_mins = state
        .focus_engine
        .lock()
        .ok()
        .and_then(|mut fe| fe.dismiss_free_focus_prompt())
        .map(|p| i64::from(p.duration_min));
    let today = Local::now().format("%Y-%m-%d").to_string();
    let created = state.storage.calendar_hub_add_task(
        title.trim(),
        Some(&today),
        None,
        prompt_mins.or(Some(25)),
        false,
    )?;
    // Immediately mark the logged free-focus session task complete
    let _ = state.storage.calendar_hub_toggle_task(created.id)?;
    let pom_snap = state
        .pomodoro
        .lock()
        .map(|p| p.snapshot())
        .unwrap_or_else(|_| PomodoroController::new(Default::default(), 0).snapshot());
    if let Ok(fe) = state.focus_engine.lock() {
        let _ = app.emit("lumen://focus-flow-updated", fe.snapshot(&pom_snap));
    }
    let _ = app.emit("lumen://calendar-hub-updated", ());
    Ok(created)
}

#[tauri::command]
fn clipboard_get_latest(state: State<'_, AppState>) -> Result<ClipboardChipSnapshot, String> {
    let raw = read_clipboard_text().unwrap_or_default();
    let snap = classify_and_mask_clipboard(&raw);
    if snap.has_content {
        if snap.sensitive
            && !state.clipboard_capture_paused.load(Ordering::Relaxed)
            && let Ok(mut guard) = state.clipboard_secret.lock()
        {
            match *guard {
                Some((ref prev, _, _)) if prev == &raw => {}
                _ => *guard = Some((raw, Instant::now(), Utc::now().to_rfc3339())),
            }
        }
        return Ok(snap);
    }
    if let Ok(guard) = state.clipboard_secret.lock()
        && let Some((ref stored, started, _)) = *guard
        && started.elapsed() < Duration::from_secs(30)
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
            *guard = Some((raw, Instant::now(), Utc::now().to_rfc3339()));
        }
        return Ok(snap);
    }
    if let Ok(mut guard) = state.clipboard_secret.lock()
        && let Some((ref stored, ref mut ts, ref mut copied_at)) = *guard
    {
        write_clipboard_text(stored)?;
        *ts = Instant::now();
        *copied_at = Utc::now().to_rfc3339();
        return Ok(classify_and_mask_clipboard(stored));
    }
    Err("clipboard empty".into())
}

fn assemble_clipboard_history_list(
    storage: &StorageRepo,
    secret_guard: &Mutex<Option<(String, Instant, String)>>,
) -> Result<Vec<ClipboardHistoryItem>, String> {
    let mut items = storage.list_clipboard_history(CLIPBOARD_MAX_UNPINNED)?;
    if let Ok(guard) = secret_guard.lock()
        && let Some((ref secret_raw, started, ref copied_at)) = *guard
        && started.elapsed() < Duration::from_secs(30)
    {
        let masked = classify_and_mask_clipboard(secret_raw);
        if masked.has_content && masked.sensitive {
            let remaining = 30u64.saturating_sub(started.elapsed().as_secs()).max(1) as u8;
            items.insert(
                0,
                ClipboardHistoryItem {
                    id: -1,
                    preview: masked.display_text,
                    kind: "secret".into(),
                    raw_hash: masked.raw_hash,
                    pinned: false,
                    sensitive: true,
                    copied_at: copied_at.clone(),
                    expires_in_secs: Some(remaining),
                },
            );
        }
    }
    Ok(items)
}

#[tauri::command]
fn clipboard_history_list(state: State<'_, AppState>) -> Result<Vec<ClipboardHistoryItem>, String> {
    assemble_clipboard_history_list(&state.storage, &state.clipboard_secret)
}

#[tauri::command]
fn clipboard_get_capture_paused(state: State<'_, AppState>) -> bool {
    state.clipboard_capture_paused.load(Ordering::Relaxed)
}

#[tauri::command]
fn clipboard_set_capture_paused(
    paused: bool,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> bool {
    state
        .clipboard_capture_paused
        .store(paused, Ordering::Relaxed);
    let _ = app.emit("lumen://clipboard-paused-updated", paused);
    paused
}

#[tauri::command]
fn clipboard_history_copy(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ClipboardChipSnapshot, String> {
    let raw = if id < 0 {
        let mut guard = state
            .clipboard_secret
            .lock()
            .map_err(|_| "clipboard secret mutex poisoned".to_string())?;
        let Some((ref mut stored, ref mut ts, ref mut copied_at)) = *guard else {
            return Err("secret clipboard entry expired".into());
        };
        *ts = Instant::now();
        *copied_at = Utc::now().to_rfc3339();
        stored.clone()
    } else {
        state
            .storage
            .get_clipboard_entry_content(id)?
            .ok_or_else(|| "clipboard entry not found".to_string())?
    };

    write_clipboard_text(&raw)?;
    let snap = classify_and_mask_clipboard(&raw);
    let _ = app.emit("lumen://clipboard-updated", &snap);
    if !snap.sensitive
        && !state.clipboard_capture_paused.load(Ordering::Relaxed)
        && raw.len() <= CLIPBOARD_MAX_CONTENT_BYTES
    {
        let kind = classify_clipboard_kind(&raw, false);
        let preview = clipboard_preview_text(&raw, 96);
        let _ = state.storage.record_clipboard_entry(
            &raw,
            &preview,
            kind,
            &snap.raw_hash,
            CLIPBOARD_MAX_UNPINNED,
        );
    }
    if let Ok(list) = assemble_clipboard_history_list(&state.storage, &state.clipboard_secret) {
        let _ = app.emit("lumen://clipboard-history-updated", &list);
    }
    Ok(snap)
}

#[tauri::command]
fn clipboard_history_toggle_pin(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ClipboardHistoryItem>, String> {
    if id < 0 {
        return assemble_clipboard_history_list(&state.storage, &state.clipboard_secret);
    }
    let _ = state.storage.toggle_pin_clipboard_entry(id)?;
    let list = assemble_clipboard_history_list(&state.storage, &state.clipboard_secret)?;
    let _ = app.emit("lumen://clipboard-history-updated", &list);
    Ok(list)
}

#[tauri::command]
fn clipboard_history_delete(
    id: i64,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ClipboardHistoryItem>, String> {
    if id < 0 {
        if let Ok(mut guard) = state.clipboard_secret.lock()
            && let Some((secret, _, _)) = guard.take()
        {
            let _ = clear_clipboard_if_matching(&secret);
            let _ = app.emit(
                "lumen://clipboard-updated",
                ClipboardChipSnapshot {
                    display_text: String::new(),
                    sensitive: false,
                    raw_hash: String::new(),
                    has_content: false,
                },
            );
        }
    } else {
        let _ = state.storage.delete_clipboard_entry(id)?;
    }
    let list = assemble_clipboard_history_list(&state.storage, &state.clipboard_secret)?;
    let _ = app.emit("lumen://clipboard-history-updated", &list);
    Ok(list)
}

#[tauri::command]
fn clipboard_history_clear(
    keep_pinned: bool,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ClipboardHistoryItem>, String> {
    if let Ok(mut guard) = state.clipboard_secret.lock()
        && let Some((secret, _, _)) = guard.take()
    {
        let _ = clear_clipboard_if_matching(&secret);
    }
    let _ = state.storage.clear_clipboard_history(keep_pinned)?;
    let list = assemble_clipboard_history_list(&state.storage, &state.clipboard_secret)?;
    let _ = app.emit("lumen://clipboard-history-updated", &list);
    Ok(list)
}

#[tauri::command]
fn home_set_visible(visible: bool, state: State<'_, AppState>) {
    state.home_visible.store(visible, Ordering::Relaxed);
}

#[tauri::command]
fn system_shelf_set_visible(visible: bool, state: State<'_, AppState>) {
    state.system_shelf_visible.store(visible, Ordering::Relaxed);
}

#[tauri::command]
async fn system_telemetry_get_snapshot(
    state: State<'_, AppState>,
) -> Result<SystemTelemetrySnapshot, String> {
    let sampler = Arc::clone(&state.telemetry_sampler);
    tokio::task::spawn_blocking(move || {
        sampler
            .lock()
            .map(|mut s| s.sample())
            .map_err(|_| "telemetry sampler mutex poisoned".to_string())
    })
    .await
    .map_err(|e| format!("telemetry task join error: {e}"))?
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
            let focus_cfg = focus_config_from_settings(&initial_settings);
            let pomodoro = Arc::new(Mutex::new(PomodoroController::new(
                focus_cfg.to_pomodoro_config(true),
                daily_mins,
            )));
            let focus_engine = Arc::new(Mutex::new(FocusEngine::new(focus_cfg)));
            if let Ok(Some(fid_str)) = storage.get_kv("calendar_focus_task_id")
                && let Ok(fid) = fid_str.parse::<i64>()
                && let Ok(snap) = storage.calendar_hub_snapshot(
                    Local::now()
                        .format("%Y")
                        .to_string()
                        .parse()
                        .unwrap_or(2026),
                    Local::now().format("%m").to_string().parse().unwrap_or(1),
                )
                && let Some(t) = snap.tasks.into_iter().find(|t| t.id == fid)
                && let Ok(mut fe) = focus_engine.lock()
            {
                fe.set_bound_task(Some(t.id), Some(t.title));
            }

            let mut machine = IslandMachine::new();
            machine.set_minimal_mode(initial_settings.minimal_notch);
            let home_visible = Arc::new(AtomicBool::new(false));
            let system_shelf_visible = Arc::new(AtomicBool::new(false));
            let telemetry_sampler = Arc::new(Mutex::new(SystemTelemetrySampler::new()));
            let clipboard_secret: Arc<Mutex<Option<(String, Instant, String)>>> =
                Arc::new(Mutex::new(None));
            let clipboard_capture_paused = Arc::new(AtomicBool::new(false));
            let is_fullscreen = Arc::new(AtomicBool::new(false));
            let silent_mode = Arc::new(AtomicBool::new(false));
            let focus_managed_silent = Arc::new(AtomicBool::new(false));
            let last_calendar_sync = Arc::new(Mutex::new(None));

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
                system_shelf_visible: Arc::clone(&system_shelf_visible),
                telemetry_sampler: Arc::clone(&telemetry_sampler),
                clipboard_secret: Arc::clone(&clipboard_secret),
                clipboard_capture_paused: Arc::clone(&clipboard_capture_paused),
                is_fullscreen: Arc::clone(&is_fullscreen),
                silent_mode: Arc::clone(&silent_mode),
                focus_managed_silent: Arc::clone(&focus_managed_silent),
                focus_engine: Arc::clone(&focus_engine),
                last_calendar_sync: Arc::clone(&last_calendar_sync),
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
            let fs_shelf_visible = Arc::clone(&system_shelf_visible);
            let fs_telemetry = Arc::clone(&telemetry_sampler);
            let fs_storage = Arc::clone(&storage);
            let fs_clip_secret = Arc::clone(&clipboard_secret);
            let fs_clip_paused = Arc::clone(&clipboard_capture_paused);
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

                    // Clipboard OTP check every 1s & 30s privacy auto-clear + local history capture
                    if tick_count.is_multiple_of(2) && !fullscreen {
                        let capture_paused = fs_clip_paused.load(Ordering::Relaxed);
                        if !capture_paused {
                            let raw = read_clipboard_text().unwrap_or_default();
                            let snap = classify_and_mask_clipboard(&raw);
                            if snap.sensitive
                                && snap.has_content
                                && let Ok(mut guard) = fs_clip_secret.lock()
                            {
                                match *guard {
                                    Some((ref prev_secret, _, _)) if prev_secret == &raw => {}
                                    _ => {
                                        *guard = Some((
                                            raw.clone(),
                                            Instant::now(),
                                            Utc::now().to_rfc3339(),
                                        ));
                                    }
                                }
                            }
                            if snap.raw_hash != last_clip_hash {
                                last_clip_hash = snap.raw_hash.clone();
                                let _ = fs_window.emit("lumen://clipboard-updated", &snap);
                                if snap.has_content
                                    && !snap.sensitive
                                    && raw.len() <= CLIPBOARD_MAX_CONTENT_BYTES
                                {
                                    let kind = classify_clipboard_kind(&raw, false);
                                    let preview = clipboard_preview_text(&raw, 96);
                                    let _ = fs_storage.record_clipboard_entry(
                                        &raw,
                                        &preview,
                                        kind,
                                        &snap.raw_hash,
                                        CLIPBOARD_MAX_UNPINNED,
                                    );
                                }
                                if let Ok(list) =
                                    assemble_clipboard_history_list(&fs_storage, &fs_clip_secret)
                                {
                                    let _ =
                                        fs_window.emit("lumen://clipboard-history-updated", &list);
                                }
                            }
                        }
                        let expired_secret = if let Ok(mut guard) = fs_clip_secret.lock() {
                            if let Some((ref secret, started, _)) = *guard
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
                        if let Some(secret) = expired_secret {
                            let _ = clear_clipboard_if_matching(&secret);
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
                            if let Ok(list) =
                                assemble_clipboard_history_list(&fs_storage, &fs_clip_secret)
                            {
                                let _ = fs_window.emit("lumen://clipboard-history-updated", &list);
                            }
                        } else if fs_shelf_visible.load(Ordering::Relaxed)
                            && fs_clip_secret.lock().map(|g| g.is_some()).unwrap_or(false)
                            && let Ok(list) =
                                assemble_clipboard_history_list(&fs_storage, &fs_clip_secret)
                        {
                            // Refresh active secret remaining TTL (30..1s) while Page 3 is open.
                            let _ = fs_window.emit("lumen://clipboard-history-updated", &list);
                        }

                        // Real-time CPU/GPU/Network telemetry every 1s ONLY when Page 3 (System & Shelf) is visible
                        if fs_shelf_visible.load(Ordering::Relaxed) {
                            let sampler_clone = Arc::clone(&fs_telemetry);
                            if let Ok(Some(payload)) = tokio::task::spawn_blocking(move || {
                                sampler_clone.lock().ok().map(|mut s| s.sample())
                            })
                            .await
                            {
                                let _ = fs_window.emit("lumen://system-telemetry", &payload);
                            }
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
            let bg_silent_flag = Arc::clone(&silent_mode);
            let bg_focus_managed_silent = Arc::clone(&focus_managed_silent);
            let focus_engine_ref = Arc::clone(&focus_engine);
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
                let mut last_sync_sec: u64 = 0;
                let watcher = Arc::new(Mutex::new(SystemNotificationWatcher::new()));

                loop {
                    half_tick = half_tick.wrapping_add(1);
                    let pref = media_pref.lock().ok().and_then(|g| g.clone());
                    let exclusions = settings_ref
                        .lock()
                        .map(|s| s.media_exclusions.clone())
                        .unwrap_or_default();
                    let stab = Arc::clone(&media_stab_loop);
                    if let Ok(snapshot) = tokio::task::spawn_blocking(move || {
                        read_stabilized_media(pref.as_deref(), &exclusions, &stab)
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
                            let bound_tid =
                                focus_engine_ref.lock().ok().and_then(|fe| fe.bound_task_id);
                            let _ = storage_ref
                                .calendar_hub_record_focus_session(bound_tid, kind, secs, true);
                            if let Ok(mut fe) = focus_engine_ref.lock() {
                                fe.on_phase_completed(phase, secs, &Utc::now().to_rfc3339());
                            }
                            let settings =
                                settings_ref.lock().map(|g| g.clone()).unwrap_or_default();
                            let is_fs = bg_fs_flag.load(Ordering::Relaxed);
                            let ctx = build_sound_ctx(&settings, &pom_ref, is_fs, true);
                            let _ = try_play_ui_sound(UiSoundName::FocusEnd, &ctx);
                            if let Ok(mut guard) = pom_ref.lock() {
                                let mins = storage_ref.daily_focus_minutes(Utc::now()).unwrap_or(0);
                                guard.set_daily_focus_minutes(mins);
                                snap_to_emit = Some(guard.snapshot());
                            }
                        }

                        if let Some(snap) = snap_to_emit {
                            if let Ok(fe) = focus_engine_ref.lock() {
                                let focus_state = fe.snapshot(&snap);
                                sync_focus_side_effects(
                                    media_window.app_handle(),
                                    &snap,
                                    &focus_state,
                                    &storage_ref,
                                    &bg_silent_flag,
                                    &bg_focus_managed_silent,
                                );
                            } else {
                                let _ = media_window.emit("lumen://pomodoro-tick", snap);
                            }
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
                            let silent = bg_silent_flag.load(Ordering::Relaxed);
                            let quiet = is_focus_assist_quiet() || silent;
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
                                    if !silent {
                                        let ctx =
                                            build_sound_ctx(&settings, &pom_ref, is_fs, false);
                                        let _ = try_play_ui_sound(UiSoundName::MailArrival, &ctx);
                                    }
                                }
                            }
                        }

                        // Calendar Hub Reminders scheduler + Prayer-arrival Focus check + 5-min sync
                        {
                            let app_handle = media_window.app_handle();
                            let is_fs = bg_fs_flag.load(Ordering::Relaxed);
                            let pom_snap_now = pom_ref.lock().ok().map(|p| p.snapshot());
                            let focus_running = pom_snap_now.as_ref().is_some_and(|s| {
                                s.running && matches!(s.phase, PomodoroPhase::Focus)
                            });
                            let (_, mic_in_use) = privacy_device_status();
                            let silent = bg_silent_flag.load(Ordering::Relaxed);
                            let defer_normal = is_fs || focus_running || mic_in_use || silent;
                            let mut prayer_pairs: Vec<(String, DateTime<Utc>)> = Vec::new();
                            if let Some(st) = app_handle.try_state::<AppState>()
                                && let Ok(cfg) = st.prayer_config.lock()
                            {
                                let sched = compute_prayer_schedule(Utc::now(), &cfg);
                                let today_local = Local::now().date_naive();
                                let now_min_local = {
                                    let t = Local::now().format("%H:%M").to_string();
                                    let mut parts = t.split(':');
                                    let h = parts
                                        .next()
                                        .and_then(|s| s.parse::<i32>().ok())
                                        .unwrap_or(0);
                                    let m = parts
                                        .next()
                                        .and_then(|s| s.parse::<i32>().ok())
                                        .unwrap_or(0);
                                    h * 60 + m
                                };
                                for slot in &sched.slots {
                                    let h = (slot.minute_of_day.max(0) as u32) / 60;
                                    let m = (slot.minute_of_day.max(0) as u32) % 60;
                                    if let Some(ndt) =
                                        today_local.and_hms_opt(h.min(23), m.min(59), 0)
                                        && let Some(ldt) = ndt.and_local_timezone(Local).single()
                                    {
                                        prayer_pairs
                                            .push((slot.name_en.clone(), ldt.with_timezone(&Utc)));
                                    }
                                    if let Some(ref p_snap) = pom_snap_now
                                        && (now_min_local - slot.minute_of_day).abs() <= 1
                                        && let Ok(mut fe) = focus_engine_ref.lock()
                                    {
                                        let key = format!("{today_local}:{}", slot.name_en);
                                        let prev_prompt = fe.prayer_prompt.clone();
                                        let should_pause =
                                            fe.on_prayer_arrival(&key, &slot.name_en, p_snap);
                                        if should_pause {
                                            if let Ok(mut p) = pom_ref.lock() {
                                                p.set_running(false);
                                                let updated_snap = p.snapshot();
                                                let focus_state = fe.snapshot(&updated_snap);
                                                sync_focus_side_effects(
                                                    app_handle,
                                                    &updated_snap,
                                                    &focus_state,
                                                    &storage_ref,
                                                    &bg_silent_flag,
                                                    &bg_focus_managed_silent,
                                                );
                                            }
                                            let settings = settings_ref
                                                .lock()
                                                .map(|g| g.clone())
                                                .unwrap_or_default();
                                            let ctx =
                                                build_sound_ctx(&settings, &pom_ref, is_fs, true);
                                            let _ =
                                                try_play_ui_sound(UiSoundName::ReminderChime, &ctx);
                                        } else if fe.prayer_prompt != prev_prompt
                                            && fe.prayer_prompt.is_some()
                                        {
                                            let focus_state = fe.snapshot(p_snap);
                                            let _ = app_handle
                                                .emit("lumen://focus-flow-updated", focus_state);
                                        }
                                    }
                                }
                            }
                            if let Ok(poll) = storage_ref.calendar_hub_poll_reminders(
                                Utc::now(),
                                defer_normal,
                                &prayer_pairs,
                            ) && (!poll.due_alerts.is_empty()
                                || !poll.missed_reminders.is_empty())
                            {
                                if !poll.due_alerts.is_empty() {
                                    let settings =
                                        settings_ref.lock().map(|g| g.clone()).unwrap_or_default();
                                    let ctx = build_sound_ctx(&settings, &pom_ref, is_fs, true);
                                    for alert in &poll.due_alerts {
                                        let _ = media_window
                                            .emit("lumen://calendar-reminder-alert", alert);
                                    }
                                    let _ = try_play_ui_sound(UiSoundName::ReminderChime, &ctx);
                                }
                                let _ = media_window.emit("lumen://calendar-hub-updated", ());
                            }

                            let elapsed_sec = half_tick / 2;
                            if elapsed_sec.saturating_sub(last_sync_sec) >= 300 {
                                last_sync_sec = elapsed_sec;
                                let sync_app = app_handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = calendar_sync_background(&sync_app, None).await;
                                });
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
            shelf_pick_files,
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
            plugins_list,
            play_ui_sound,
            system_quick_toggles_state,
            system_toggle_wifi,
            system_toggle_bluetooth,
            system_toggle_keep_awake,
            system_launch_snipping_screenshot,
            system_launch_screen_recording,
            system_toggle_camera,
            system_toggle_silent_mode,
            prayer_set_method,
            weather_get_current,
            tasbih_get,
            tasbih_increment,
            tasbih_reset,
            ledger_get,
            ledger_toggle,
            clipboard_get_latest,
            clipboard_copy_latest,
            clipboard_history_list,
            clipboard_get_capture_paused,
            clipboard_set_capture_paused,
            clipboard_history_copy,
            clipboard_history_toggle_pin,
            clipboard_history_delete,
            clipboard_history_clear,
            home_set_visible,
            system_shelf_set_visible,
            system_telemetry_get_snapshot,
            system_battery_status,
            monitor_auto_scale_factor,
            calendar_hub_get_snapshot,
            calendar_hub_add_task,
            calendar_hub_toggle_task,
            calendar_hub_add_local_event,
            calendar_hub_add_reminder,
            calendar_hub_parse_quick_add,
            calendar_hub_move_task_due,
            calendar_hub_delete_task,
            calendar_hub_restore_task,
            calendar_hub_set_focus_task,
            calendar_hub_complete_reminder,
            calendar_hub_snooze_reminder,
            calendar_hub_dismiss_missed,
            calendar_hub_connect_ics,
            calendar_hub_connect_oauth,
            calendar_hub_sync_now,
            calendar_hub_disconnect_source,
            calendar_hub_delete_all_data,
            calendar_hub_open_external_url,
            calendar_hub_push_task_event,
            calendar_hub_focus_get_state,
            calendar_hub_focus_respond_prayer,
            calendar_hub_focus_dismiss_free_log,
            calendar_hub_focus_log_free_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}

use std::sync::Mutex;

use lumen_core::{IslandEvent, IslandMachine, IslandSnapshot};
use lumen_windows::compute_top_center_position;
use tauri::{Manager, PhysicalPosition, State};

struct AppState {
    machine: Mutex<IslandMachine>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            machine: Mutex::new(IslandMachine::new()),
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("island")
                && let Ok(Some(monitor)) = window.primary_monitor()
            {
                let monitor_pos = monitor.position();
                let monitor_size = monitor.size();
                let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize {
                    width: 240,
                    height: 48,
                });
                let (x, y) = compute_top_center_position(
                    monitor_pos.x,
                    monitor_pos.y,
                    monitor_size.width as i32,
                    window_size.width as i32,
                );
                let _ = window.set_position(PhysicalPosition::new(x, y));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_island_snapshot,
            dispatch_island_event
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}

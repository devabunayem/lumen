use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// Deterministic states of the Lumen island.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IslandState {
    Hidden,
    Minimal,
    Idle,
    Live,
    Expanded,
    Hud,
}

/// Inputs accepted by the island state machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IslandEvent {
    HoverExpand,
    HoverCollapseSlim,
    RestoreNormal,
    Click,
    Escape,
    HotkeyToggleHide,
    HotkeyToggleExpand,
    MediaChange(bool),
    TimerTick(bool),
    Notification,
    HudDismiss,
    FullscreenChange(bool),
    DragEnter,
}

impl IslandEvent {
    /// Parses an IPC command string into an [`IslandEvent`].
    #[must_use]
    pub fn from_command(name: &str) -> Option<Self> {
        match name {
            "hover_expand" => Some(Self::HoverExpand),
            "hover_collapse_slim" => Some(Self::HoverCollapseSlim),
            "restore_normal" => Some(Self::RestoreNormal),
            "click" => Some(Self::Click),
            "escape" => Some(Self::Escape),
            "hotkey_toggle_hide" => Some(Self::HotkeyToggleHide),
            "hotkey_toggle_expand" => Some(Self::HotkeyToggleExpand),
            "notification" => Some(Self::Notification),
            "hud_dismiss" => Some(Self::HudDismiss),
            "drag_enter" => Some(Self::DragEnter),
            _ => None,
        }
    }
}

/// Serializable state snapshot emitted to the React frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct IslandSnapshot {
    pub state: IslandState,
    pub minimal_mode: bool,
    pub has_live_activity: bool,
}

/// Deterministic finite state machine managing Lumen's top-centre surface.
#[derive(Debug, Clone)]
pub struct IslandMachine {
    state: IslandState,
    previous_non_hidden: IslandState,
    minimal_mode: bool,
    has_live_activity: bool,
}

impl Default for IslandMachine {
    fn default() -> Self {
        Self::new()
    }
}

impl IslandMachine {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            state: IslandState::Idle,
            previous_non_hidden: IslandState::Idle,
            minimal_mode: false,
            has_live_activity: false,
        }
    }

    #[must_use]
    pub const fn snapshot(&self) -> IslandSnapshot {
        IslandSnapshot {
            state: self.state,
            minimal_mode: self.minimal_mode,
            has_live_activity: self.has_live_activity,
        }
    }

    const fn resting_state(&self) -> IslandState {
        if self.has_live_activity {
            IslandState::Live
        } else if self.minimal_mode {
            IslandState::Minimal
        } else {
            IslandState::Idle
        }
    }

    pub fn set_minimal_mode(&mut self, minimal: bool) {
        self.minimal_mode = minimal;
        if matches!(self.state, IslandState::Idle | IslandState::Minimal) {
            let resting = self.resting_state();
            self.previous_non_hidden = resting;
            self.state = resting;
        }
    }

    /// Applies one state transition deterministically.
    pub fn apply(&mut self, event: IslandEvent) {
        match event {
            IslandEvent::FullscreenChange(true) => {
                if !matches!(self.state, IslandState::Hidden | IslandState::Hud) {
                    self.previous_non_hidden = self.state;
                }
                self.state = IslandState::Hidden;
            }
            IslandEvent::FullscreenChange(false) => {
                self.state = self.resting_state();
            }
            IslandEvent::HotkeyToggleHide => {
                if self.state == IslandState::Hidden {
                    self.state = self.previous_non_hidden;
                } else {
                    if self.state != IslandState::Hud {
                        self.previous_non_hidden = self.state;
                    }
                    self.state = IslandState::Hidden;
                }
            }
            IslandEvent::HotkeyToggleExpand | IslandEvent::Click => {
                if self.state == IslandState::Hidden {
                    return;
                }
                self.state = if self.state == IslandState::Expanded {
                    self.resting_state()
                } else {
                    self.previous_non_hidden = IslandState::Expanded;
                    IslandState::Expanded
                };
            }
            IslandEvent::Escape => {
                if self.state == IslandState::Expanded {
                    self.state = self.resting_state();
                }
            }
            IslandEvent::HoverExpand => {
                if !matches!(self.state, IslandState::Hidden | IslandState::Expanded) {
                    self.previous_non_hidden = IslandState::Expanded;
                    self.state = IslandState::Expanded;
                }
            }
            IslandEvent::HoverCollapseSlim => {
                if self.state == IslandState::Expanded {
                    self.previous_non_hidden = IslandState::Minimal;
                    self.state = IslandState::Minimal;
                }
            }
            IslandEvent::RestoreNormal => {
                if self.state == IslandState::Minimal {
                    let resting = self.resting_state();
                    self.previous_non_hidden = resting;
                    self.state = resting;
                }
            }
            IslandEvent::DragEnter => {
                if self.state != IslandState::Hidden {
                    self.previous_non_hidden = IslandState::Expanded;
                    self.state = IslandState::Expanded;
                }
            }
            IslandEvent::MediaChange(active) | IslandEvent::TimerTick(active) => {
                self.has_live_activity = active;
                if matches!(
                    self.state,
                    IslandState::Idle | IslandState::Minimal | IslandState::Live
                ) {
                    let resting = self.resting_state();
                    self.previous_non_hidden = resting;
                    self.state = resting;
                }
            }
            IslandEvent::Notification => {
                if !matches!(self.state, IslandState::Hidden | IslandState::Expanded) {
                    if self.state != IslandState::Hud {
                        self.previous_non_hidden = self.state;
                    }
                    self.state = IslandState::Hud;
                }
            }
            IslandEvent::HudDismiss => {
                if self.state == IslandState::Hud {
                    self.state = self.previous_non_hidden;
                }
            }
        }
    }
}

/// Pomodoro phases (`FR-PO-1`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PomodoroPhase {
    Focus,
    ShortBreak,
    LongBreak,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PomodoroConfig {
    pub focus_secs: u32,
    pub short_break_secs: u32,
    pub long_break_secs: u32,
    pub cycles_before_long: u32,
    pub auto_start_next: bool,
}

impl Default for PomodoroConfig {
    fn default() -> Self {
        Self {
            focus_secs: 25 * 60,
            short_break_secs: 5 * 60,
            long_break_secs: 15 * 60,
            cycles_before_long: 4,
            auto_start_next: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PomodoroSnapshot {
    pub phase: PomodoroPhase,
    pub remaining_secs: u32,
    pub total_secs: u32,
    pub running: bool,
    pub cycle_index: u32,
    pub cycles_before_long: u32,
    pub daily_focus_minutes: i64,
    pub chime_tick: u64,
}

/// Rust-owned Pomodoro state machine (`FR-PO-1..3`, Section 7.1).
#[derive(Debug, Clone)]
pub struct PomodoroController {
    config: PomodoroConfig,
    phase: PomodoroPhase,
    remaining_secs: u32,
    running: bool,
    cycle_index: u32,
    daily_focus_minutes: i64,
    chime_tick: u64,
}

impl Default for PomodoroController {
    fn default() -> Self {
        Self::new(PomodoroConfig::default(), 0)
    }
}

impl PomodoroController {
    #[must_use]
    pub const fn new(config: PomodoroConfig, daily_focus_minutes: i64) -> Self {
        Self {
            remaining_secs: config.focus_secs,
            config,
            phase: PomodoroPhase::Focus,
            running: false,
            cycle_index: 0,
            daily_focus_minutes,
            chime_tick: 0,
        }
    }

    const fn phase_duration(&self, phase: PomodoroPhase) -> u32 {
        match phase {
            PomodoroPhase::Focus => self.config.focus_secs,
            PomodoroPhase::ShortBreak => self.config.short_break_secs,
            PomodoroPhase::LongBreak => self.config.long_break_secs,
        }
    }

    #[must_use]
    pub const fn snapshot(&self) -> PomodoroSnapshot {
        PomodoroSnapshot {
            phase: self.phase,
            remaining_secs: self.remaining_secs,
            total_secs: self.phase_duration(self.phase),
            running: self.running,
            cycle_index: self.cycle_index,
            cycles_before_long: self.config.cycles_before_long,
            daily_focus_minutes: self.daily_focus_minutes,
            chime_tick: self.chime_tick,
        }
    }

    pub const fn is_running(&self) -> bool {
        self.running
    }

    pub fn set_daily_focus_minutes(&mut self, minutes: i64) {
        self.daily_focus_minutes = minutes;
    }

    pub fn toggle_start_pause(&mut self) {
        self.running = !self.running;
    }

    pub fn reset(&mut self) {
        self.running = false;
        self.remaining_secs = self.phase_duration(self.phase);
    }

    pub fn skip(&mut self) {
        self.advance_phase(false);
    }

    /// Advances timer by 1 second; returns `Some((completed_phase, duration_secs))` on completion.
    pub fn tick(&mut self) -> Option<(PomodoroPhase, u32)> {
        if !self.running {
            return None;
        }
        if self.remaining_secs > 1 {
            self.remaining_secs -= 1;
            return None;
        }
        let completed_phase = self.phase;
        let completed_secs = self.phase_duration(completed_phase);
        self.advance_phase(self.config.auto_start_next);
        self.chime_tick = self.chime_tick.wrapping_add(1);
        Some((completed_phase, completed_secs))
    }

    fn advance_phase(&mut self, keep_running: bool) {
        self.running = keep_running;
        match self.phase {
            PomodoroPhase::Focus => {
                self.cycle_index += 1;
                if self.cycle_index >= self.config.cycles_before_long {
                    self.phase = PomodoroPhase::LongBreak;
                    self.cycle_index = 0;
                } else {
                    self.phase = PomodoroPhase::ShortBreak;
                }
            }
            PomodoroPhase::ShortBreak | PomodoroPhase::LongBreak => {
                self.phase = PomodoroPhase::Focus;
            }
        }
        self.remaining_secs = self.phase_duration(self.phase);
    }
}

const BUILTIN_PAGE_ORDER: [&str; 9] = [
    "control",
    "music",
    "calendar",
    "reminders",
    "todo",
    "water",
    "prayer",
    "pomodoro",
    "shelf",
];

fn default_version() -> u32 {
    1
}
fn default_shape_style() -> String {
    "notch".into()
}
fn default_scale() -> String {
    "auto".into()
}
fn default_true() -> bool {
    true
}
fn default_monitor_mode() -> String {
    "primary".into()
}
fn default_language() -> String {
    "en".into()
}
fn default_hotkey_hide() -> String {
    "Ctrl+Alt+L".into()
}
fn default_hotkey_expand() -> String {
    "Ctrl+Alt+Space".into()
}
fn default_page_order() -> Vec<String> {
    BUILTIN_PAGE_ORDER
        .iter()
        .map(|s| (*s).to_string())
        .collect()
}
fn default_water_goal_ml() -> i64 {
    1500
}
fn default_hover_return_seconds() -> u32 {
    5
}
fn default_sound_volume() -> u8 {
    30
}
fn default_reminder_snooze_minutes() -> u32 {
    3
}
fn default_reminder_default_lead_minutes() -> u32 {
    10
}
fn default_now_playing_banner_seconds() -> u32 {
    4
}
fn default_notification_duration_seconds() -> u32 {
    8
}
fn default_action_glow_mode() -> String {
    "action".into()
}
fn default_dev_pulse_ports() -> Vec<u16> {
    vec![3000, 5173, 1420]
}

/// Versioned user preferences persisted in `%APPDATA%/Lumen/settings.json` (`NFR-REL-2`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LumenSettings {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default = "default_shape_style")]
    pub shape_style: String,
    #[serde(default = "default_scale")]
    pub scale: String,
    pub minimal_notch: bool,
    #[serde(default = "default_true")]
    pub hover_to_open: bool,
    #[serde(default = "default_hover_return_seconds")]
    pub hover_return_seconds: u32,
    #[serde(default = "default_true")]
    pub mascot_enabled: bool,
    #[serde(default = "default_true")]
    pub show_header_clock: bool,
    #[serde(default = "default_true")]
    pub hide_in_fullscreen: bool,
    #[serde(default = "default_monitor_mode")]
    pub monitor_mode: String,
    pub monitor_index: usize,
    pub position_offset_x: i32,
    #[serde(default = "default_language")]
    pub language: String,
    pub reduced_motion_override: bool,
    pub start_with_windows: bool,
    #[serde(default = "default_hotkey_hide")]
    pub hotkey_hide: String,
    #[serde(default = "default_hotkey_expand")]
    pub hotkey_expand: String,
    #[serde(default = "default_page_order")]
    pub page_order: Vec<String>,
    pub hidden_pages: Vec<String>,
    #[serde(default = "default_water_goal_ml")]
    pub water_goal_ml: i64,
    pub media_exclusions: Vec<String>,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    #[serde(default = "default_sound_volume")]
    pub sound_volume: u8,
    #[serde(default = "default_true")]
    pub sound_interface: bool,
    #[serde(default = "default_true")]
    pub sound_reminders: bool,
    #[serde(default)]
    pub custom_adhan_path: Option<String>,
    #[serde(default)]
    pub location_opt_in: bool,
    #[serde(default)]
    pub reduce_transparency: bool,
    #[serde(default = "default_true")]
    pub glow_enabled: bool,
    #[serde(default = "default_true")]
    pub parallax_enabled: bool,
    #[serde(default)]
    pub bangla_digits: bool,
    #[serde(default = "default_true")]
    pub chip_focus_enabled: bool,
    #[serde(default = "default_true")]
    pub chip_ledger_enabled: bool,
    #[serde(default = "default_true")]
    pub chip_clipboard_enabled: bool,
    #[serde(default = "default_true")]
    pub chip_dev_pulse_enabled: bool,
    #[serde(default = "default_dev_pulse_ports")]
    pub dev_pulse_ports: Vec<u16>,
    #[serde(default = "default_reminder_snooze_minutes")]
    pub reminder_snooze_minutes: u32,
    #[serde(default = "default_reminder_default_lead_minutes")]
    pub reminder_default_lead_minutes: u32,
    #[serde(default = "default_true")]
    pub resting_show_clock: bool,
    #[serde(default = "default_true")]
    pub resting_show_waveform: bool,
    #[serde(default = "default_true")]
    pub resting_show_sensor_dots: bool,
    #[serde(default = "default_true")]
    pub resting_show_battery_ring: bool,
    #[serde(default = "default_true")]
    pub now_playing_banner_enabled: bool,
    #[serde(default = "default_now_playing_banner_seconds")]
    pub now_playing_banner_seconds: u32,
    #[serde(default = "default_notification_duration_seconds")]
    pub notification_duration_seconds: u32,
    #[serde(default = "default_action_glow_mode")]
    pub action_glow_mode: String,
}

impl Default for LumenSettings {
    fn default() -> Self {
        Self {
            version: default_version(),
            shape_style: default_shape_style(),
            scale: default_scale(),
            minimal_notch: false,
            hover_to_open: true,
            hover_return_seconds: default_hover_return_seconds(),
            mascot_enabled: true,
            show_header_clock: true,
            hide_in_fullscreen: true,
            monitor_mode: default_monitor_mode(),
            monitor_index: 0,
            position_offset_x: 0,
            language: default_language(),
            reduced_motion_override: false,
            start_with_windows: false,
            hotkey_hide: default_hotkey_hide(),
            hotkey_expand: default_hotkey_expand(),
            page_order: default_page_order(),
            hidden_pages: Vec::new(),
            water_goal_ml: default_water_goal_ml(),
            media_exclusions: Vec::new(),
            sound_enabled: true,
            sound_volume: default_sound_volume(),
            sound_interface: true,
            sound_reminders: true,
            custom_adhan_path: None,
            location_opt_in: false,
            reduce_transparency: false,
            glow_enabled: true,
            parallax_enabled: true,
            bangla_digits: false,
            chip_focus_enabled: true,
            chip_ledger_enabled: true,
            chip_clipboard_enabled: true,
            chip_dev_pulse_enabled: true,
            dev_pulse_ports: default_dev_pulse_ports(),
            reminder_snooze_minutes: default_reminder_snooze_minutes(),
            reminder_default_lead_minutes: default_reminder_default_lead_minutes(),
            resting_show_clock: true,
            resting_show_waveform: true,
            resting_show_sensor_dots: true,
            resting_show_battery_ring: true,
            now_playing_banner_enabled: true,
            now_playing_banner_seconds: default_now_playing_banner_seconds(),
            notification_duration_seconds: default_notification_duration_seconds(),
            action_glow_mode: default_action_glow_mode(),
        }
    }
}

impl LumenSettings {
    /// Parses settings JSON, safely migrating older schemas or malformed payloads to v1.
    #[must_use]
    pub fn load_or_migrate(raw_json: &str) -> Self {
        let mut settings = serde_json::from_str::<Self>(raw_json).unwrap_or_default();
        settings.normalize();
        settings
    }

    pub fn normalize(&mut self) {
        self.version = 1;
        if !matches!(self.shape_style.as_str(), "notch" | "pill") {
            self.shape_style = default_shape_style();
        }
        if !matches!(self.scale.as_str(), "auto" | "100" | "115" | "130" | "150") {
            self.scale = default_scale();
        }
        if !matches!(self.monitor_mode.as_str(), "primary" | "active" | "index") {
            self.monitor_mode = default_monitor_mode();
        }
        if !matches!(self.language.as_str(), "en" | "bn") {
            self.language = default_language();
        }
        if !matches!(self.action_glow_mode.as_str(), "action" | "always" | "off") {
            self.action_glow_mode = default_action_glow_mode();
        }
        self.hover_return_seconds = self.hover_return_seconds.clamp(0, 30);
        self.reminder_snooze_minutes = self.reminder_snooze_minutes.clamp(1, 30);
        self.reminder_default_lead_minutes = self.reminder_default_lead_minutes.clamp(0, 120);
        self.now_playing_banner_seconds = self.now_playing_banner_seconds.clamp(1, 15);
        self.notification_duration_seconds = self.notification_duration_seconds.clamp(3, 30);
        self.position_offset_x = self.position_offset_x.clamp(-400, 400);
        self.water_goal_ml = self.water_goal_ml.clamp(250, 10_000);
        self.sound_volume = self.sound_volume.clamp(0, 100);
        if self.dev_pulse_ports.is_empty() {
            self.dev_pulse_ports = default_dev_pulse_ports();
        }
        if self.hotkey_hide.trim().is_empty() {
            self.hotkey_hide = default_hotkey_hide();
        }
        if self.hotkey_expand.trim().is_empty() {
            self.hotkey_expand = default_hotkey_expand();
        }

        let mut deduped = Vec::new();
        for id in &self.page_order {
            if !id.trim().is_empty() && !deduped.contains(id) {
                deduped.push(id.clone());
            }
        }
        for builtin in BUILTIN_PAGE_ORDER {
            if !deduped.iter().any(|p| p == builtin) {
                deduped.push(builtin.to_string());
            }
        }
        self.page_order = deduped;
    }

    #[must_use]
    pub fn scale_multiplier_for_width(&self, screen_width_logical: f64) -> f64 {
        match self.scale.as_str() {
            "100" => 1.0,
            "115" => 1.15,
            "130" => 1.30,
            "150" => 1.50,
            _ => {
                if screen_width_logical >= 3840.0 {
                    1.30
                } else if screen_width_logical >= 2560.0 {
                    1.15
                } else {
                    1.0
                }
            }
        }
    }

    #[must_use]
    pub fn scale_multiplier(&self) -> f64 {
        self.scale_multiplier_for_width(1440.0)
    }

    pub fn load_from_path(path: &Path) -> Self {
        match fs::read_to_string(path) {
            Ok(raw) => Self::load_or_migrate(&raw),
            Err(_) => Self::default(),
        }
    }

    pub fn save_to_path(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create settings dir failed: {e}"))?;
        }
        let mut clean = self.clone();
        clean.normalize();
        let json = serde_json::to_string_pretty(&clean)
            .map_err(|e| format!("serialize settings failed: {e}"))?;
        fs::write(path, json).map_err(|e| format!("write settings failed: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expands_on_click_and_collapses_on_escape() {
        let mut machine = IslandMachine::new();
        assert_eq!(machine.snapshot().state, IslandState::Idle);

        machine.apply(IslandEvent::Click);
        assert_eq!(machine.snapshot().state, IslandState::Expanded);

        machine.apply(IslandEvent::Escape);
        assert_eq!(machine.snapshot().state, IslandState::Idle);
    }

    #[test]
    fn hides_on_fullscreen_and_restores_live_activity() {
        let mut machine = IslandMachine::new();
        machine.apply(IslandEvent::MediaChange(true));
        assert_eq!(machine.snapshot().state, IslandState::Live);

        machine.apply(IslandEvent::FullscreenChange(true));
        assert_eq!(machine.snapshot().state, IslandState::Hidden);

        machine.apply(IslandEvent::FullscreenChange(false));
        assert_eq!(machine.snapshot().state, IslandState::Live);
    }

    #[test]
    fn pomodoro_transitions_through_focus_breaks_and_long_break() {
        let cfg = PomodoroConfig {
            focus_secs: 2,
            short_break_secs: 2,
            long_break_secs: 4,
            cycles_before_long: 2,
            auto_start_next: true,
        };
        let mut ctrl = PomodoroController::new(cfg, 0);
        ctrl.toggle_start_pause();
        assert!(ctrl.tick().is_none());
        let done = ctrl.tick();
        assert_eq!(done, Some((PomodoroPhase::Focus, 2)));
        assert_eq!(ctrl.snapshot().phase, PomodoroPhase::ShortBreak);

        ctrl.skip();
        assert_eq!(ctrl.snapshot().phase, PomodoroPhase::Focus);
        ctrl.toggle_start_pause();
        let _ = ctrl.tick();
        let done2 = ctrl.tick();
        assert_eq!(done2, Some((PomodoroPhase::Focus, 2)));
        assert_eq!(ctrl.snapshot().phase, PomodoroPhase::LongBreak);
    }

    #[test]
    fn settings_roundtrip_and_v0_migration() {
        let migrated = LumenSettings::load_or_migrate(
            r#"{"version":0,"shapeStyle":"pill","language":"bn","waterGoalMl":99999,"positionOffsetX":-900,"scale":"bad"}"#,
        );
        assert_eq!(migrated.version, 1);
        assert_eq!(migrated.shape_style, "pill");
        assert_eq!(migrated.language, "bn");
        assert_eq!(migrated.water_goal_ml, 10_000);
        assert_eq!(migrated.position_offset_x, -400);
        assert_eq!(migrated.scale, "auto");
        assert_eq!(migrated.page_order.len(), 9);
        assert_eq!(migrated.reminder_snooze_minutes, 3);
        assert_eq!(migrated.reminder_default_lead_minutes, 10);

        let fallback = LumenSettings::load_or_migrate("{invalid json");
        assert_eq!(fallback, LumenSettings::default());

        let mut machine = IslandMachine::new();
        machine.set_minimal_mode(true);
        assert_eq!(machine.snapshot().state, IslandState::Minimal);
    }

    #[test]
    fn hover_expand_slim_collapse_and_restore_normal() {
        let mut machine = IslandMachine::new();
        machine.apply(IslandEvent::HoverExpand);
        assert_eq!(machine.snapshot().state, IslandState::Expanded);

        machine.apply(IslandEvent::HoverCollapseSlim);
        assert_eq!(machine.snapshot().state, IslandState::Minimal);

        machine.apply(IslandEvent::RestoreNormal);
        assert_eq!(machine.snapshot().state, IslandState::Idle);
    }
}

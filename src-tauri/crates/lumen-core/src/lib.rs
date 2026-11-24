use serde::{Deserialize, Serialize};

/// All seven deterministic states of the Lumen island (SRS Section 4 & 7.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IslandState {
    Hidden,
    Minimal,
    Idle,
    Live,
    Peek,
    Expanded,
    Hud,
}

/// Inputs accepted by the island state machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IslandEvent {
    Hover,
    Leave,
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
            "hover" => Some(Self::Hover),
            "leave" => Some(Self::Leave),
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
                if matches!(self.state, IslandState::Expanded | IslandState::Peek) {
                    self.state = self.resting_state();
                }
            }
            IslandEvent::Hover => {
                if matches!(
                    self.state,
                    IslandState::Idle | IslandState::Live | IslandState::Minimal
                ) {
                    self.previous_non_hidden = self.state;
                    self.state = IslandState::Peek;
                }
            }
            IslandEvent::Leave => {
                if self.state == IslandState::Peek {
                    self.state = self.resting_state();
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
}

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
}

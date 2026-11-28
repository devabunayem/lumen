use serde::{Deserialize, Serialize};

use crate::{PomodoroConfig, PomodoroPhase, PomodoroSnapshot};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PrayerArrivalMode {
    #[default]
    Ask,
    AutoPause,
    Ignore,
}

impl PrayerArrivalMode {
    #[must_use]
    pub fn from_str_mode(raw: &str) -> Self {
        match raw.trim() {
            "auto_pause" => Self::AutoPause,
            "ignore" => Self::Ignore,
            _ => Self::Ask,
        }
    }

    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Ask => "ask",
            Self::AutoPause => "auto_pause",
            Self::Ignore => "ignore",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusConfig {
    pub focus_min: u32,
    pub short_break_min: u32,
    pub long_break_min: u32,
    pub rounds: u32,
    pub social_blocked_armed: bool,
    pub sync_dnd: bool,
    pub sync_time_ledger: bool,
    pub prayer_arrival_mode: PrayerArrivalMode,
}

impl Default for FocusConfig {
    fn default() -> Self {
        Self {
            focus_min: 25,
            short_break_min: 5,
            long_break_min: 15,
            rounds: 4,
            social_blocked_armed: true,
            sync_dnd: true,
            sync_time_ledger: true,
            prayer_arrival_mode: PrayerArrivalMode::Ask,
        }
    }
}

impl FocusConfig {
    #[must_use]
    pub fn clamped(mut self) -> Self {
        self.focus_min = self.focus_min.clamp(5, 120);
        self.short_break_min = self.short_break_min.clamp(1, 30);
        self.long_break_min = self.long_break_min.clamp(5, 60);
        self.rounds = self.rounds.clamp(1, 8);
        self
    }

    #[must_use]
    pub fn to_pomodoro_config(&self, auto_start_next: bool) -> PomodoroConfig {
        let safe = self.clone().clamped();
        PomodoroConfig {
            focus_secs: safe.focus_min * 60,
            short_break_secs: safe.short_break_min * 60,
            long_break_secs: safe.long_break_min * 60,
            cycles_before_long: safe.rounds,
            auto_start_next,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrayerArrivalPrompt {
    pub prayer_key: String,
    pub prayer_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeFocusLogPrompt {
    pub duration_min: u32,
    pub completed_at: String,
    pub suggested_title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusFlowState {
    pub config: FocusConfig,
    pub bound_task_id: Option<i64>,
    pub bound_task_title: Option<String>,
    pub paused_for_prayer: Option<String>,
    pub prayer_prompt: Option<PrayerArrivalPrompt>,
    pub free_focus_log_prompt: Option<FreeFocusLogPrompt>,
    pub lumi_companion_mode: String,
    pub social_block_active: bool,
    pub dnd_active: bool,
    pub time_ledger_active: bool,
}

#[derive(Debug, Clone)]
pub struct FocusEngine {
    pub config: FocusConfig,
    pub bound_task_id: Option<i64>,
    pub bound_task_title: Option<String>,
    pub paused_for_prayer: Option<String>,
    pub prayer_prompt: Option<PrayerArrivalPrompt>,
    pub free_focus_log_prompt: Option<FreeFocusLogPrompt>,
    last_handled_prayer_key: Option<String>,
}

impl Default for FocusEngine {
    fn default() -> Self {
        Self::new(FocusConfig::default())
    }
}

impl FocusEngine {
    #[must_use]
    pub fn new(config: FocusConfig) -> Self {
        Self {
            config: config.clamped(),
            bound_task_id: None,
            bound_task_title: None,
            paused_for_prayer: None,
            prayer_prompt: None,
            free_focus_log_prompt: None,
            last_handled_prayer_key: None,
        }
    }

    pub fn update_config(&mut self, config: FocusConfig) {
        self.config = config.clamped();
    }

    pub fn set_bound_task(&mut self, task_id: Option<i64>, title: Option<String>) {
        self.bound_task_id = task_id;
        self.bound_task_title = task_id.and(title);
    }

    /// Evaluates prayer arrival against an active Focus round. Returns `true` if caller should pause timer immediately.
    pub fn on_prayer_arrival(
        &mut self,
        prayer_key: &str,
        prayer_name: &str,
        pomodoro: &PomodoroSnapshot,
    ) -> bool {
        if !pomodoro.running || pomodoro.phase != PomodoroPhase::Focus {
            return false;
        }
        if self.last_handled_prayer_key.as_deref() == Some(prayer_key) {
            return false;
        }
        self.last_handled_prayer_key = Some(prayer_key.to_string());

        match self.config.prayer_arrival_mode {
            PrayerArrivalMode::Ask => {
                self.prayer_prompt = Some(PrayerArrivalPrompt {
                    prayer_key: prayer_key.to_string(),
                    prayer_name: prayer_name.to_string(),
                });
                false
            }
            PrayerArrivalMode::AutoPause => {
                self.prayer_prompt = None;
                self.paused_for_prayer = Some(prayer_name.to_string());
                true
            }
            PrayerArrivalMode::Ignore => false,
        }
    }

    /// Resolves the inline prayer arrival prompt. Returns `true` if timer should be paused now.
    pub fn respond_prayer_prompt(&mut self, pause: bool) -> bool {
        let Some(prompt) = self.prayer_prompt.take() else {
            return false;
        };
        if pause {
            self.paused_for_prayer = Some(prompt.prayer_name);
            true
        } else {
            false
        }
    }

    pub fn on_manual_toggle(&mut self, will_run: bool) {
        if will_run {
            self.paused_for_prayer = None;
            self.prayer_prompt = None;
        }
    }

    pub fn on_phase_completed(&mut self, phase: PomodoroPhase, duration_secs: u32, now_iso: &str) {
        if phase == PomodoroPhase::Focus && self.bound_task_id.is_none() {
            let mins = (duration_secs / 60).max(1);
            self.free_focus_log_prompt = Some(FreeFocusLogPrompt {
                duration_min: mins,
                completed_at: now_iso.to_string(),
                suggested_title: format!("Focus session ({mins}m)"),
            });
        }
        self.paused_for_prayer = None;
        self.prayer_prompt = None;
    }

    pub fn dismiss_free_focus_prompt(&mut self) -> Option<FreeFocusLogPrompt> {
        self.free_focus_log_prompt.take()
    }

    #[must_use]
    pub fn snapshot(&self, pomodoro: &PomodoroSnapshot) -> FocusFlowState {
        let is_focus_running = pomodoro.running && pomodoro.phase == PomodoroPhase::Focus;
        let lumi_companion_mode = if self.paused_for_prayer.is_some() {
            "prayer_pause"
        } else if is_focus_running {
            "body_double_focus"
        } else if self.free_focus_log_prompt.is_some() {
            "celebrate_focus"
        } else {
            "idle"
        };
        FocusFlowState {
            config: self.config.clone(),
            bound_task_id: self.bound_task_id,
            bound_task_title: self.bound_task_title.clone(),
            paused_for_prayer: self.paused_for_prayer.clone(),
            prayer_prompt: self.prayer_prompt.clone(),
            free_focus_log_prompt: self.free_focus_log_prompt.clone(),
            lumi_companion_mode: lumi_companion_mode.to_string(),
            social_block_active: is_focus_running && self.config.social_blocked_armed,
            dnd_active: is_focus_running && self.config.sync_dnd,
            time_ledger_active: is_focus_running && self.config.sync_time_ledger,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn running_focus_snap() -> PomodoroSnapshot {
        PomodoroSnapshot {
            phase: PomodoroPhase::Focus,
            remaining_secs: 1500,
            total_secs: 1500,
            running: true,
            cycle_index: 0,
            cycles_before_long: 4,
            daily_focus_minutes: 0,
            chime_tick: 0,
        }
    }

    #[test]
    fn clamps_focus_config_and_handles_prayer_modes() {
        let cfg = FocusConfig {
            focus_min: 1,
            short_break_min: 99,
            long_break_min: 200,
            rounds: 0,
            social_blocked_armed: true,
            sync_dnd: true,
            sync_time_ledger: true,
            prayer_arrival_mode: PrayerArrivalMode::Ask,
        };
        let mut engine = FocusEngine::new(cfg);
        assert_eq!(engine.config.focus_min, 5);
        assert_eq!(engine.config.short_break_min, 30);
        assert_eq!(engine.config.long_break_min, 60);
        assert_eq!(engine.config.rounds, 1);

        let snap = running_focus_snap();
        assert!(!engine.on_prayer_arrival("2026-11-26:Asr", "Asr", &snap));
        assert_eq!(
            engine
                .prayer_prompt
                .as_ref()
                .map(|p| p.prayer_name.as_str()),
            Some("Asr")
        );
        // Same prayer arrival does not prompt twice
        assert!(!engine.on_prayer_arrival("2026-11-26:Asr", "Asr", &snap));
        assert!(engine.respond_prayer_prompt(true));
        assert_eq!(engine.paused_for_prayer.as_deref(), Some("Asr"));

        // Auto-pause mode pauses immediately
        engine.update_config(FocusConfig {
            prayer_arrival_mode: PrayerArrivalMode::AutoPause,
            ..FocusConfig::default()
        });
        assert!(engine.on_prayer_arrival("2026-11-26:Maghrib", "Maghrib", &snap));
        assert_eq!(engine.paused_for_prayer.as_deref(), Some("Maghrib"));

        // Ignore mode ignores arrival
        engine.update_config(FocusConfig {
            prayer_arrival_mode: PrayerArrivalMode::Ignore,
            ..FocusConfig::default()
        });
        assert!(!engine.on_prayer_arrival("2026-11-26:Isha", "Isha", &snap));
    }

    #[test]
    fn free_focus_completion_triggers_log_prompt_only_when_unbound() {
        let mut engine = FocusEngine::default();
        engine.on_phase_completed(PomodoroPhase::Focus, 1500, "2026-11-26T15:00:00Z");
        let prompt = engine
            .free_focus_log_prompt
            .as_ref()
            .expect("free focus prompt");
        assert_eq!(prompt.duration_min, 25);
        assert!(prompt.suggested_title.contains("25m"));

        engine.dismiss_free_focus_prompt();
        engine.set_bound_task(Some(42), Some("Design review".into()));
        engine.on_phase_completed(PomodoroPhase::Focus, 1500, "2026-11-26T16:00:00Z");
        assert!(engine.free_focus_log_prompt.is_none());
    }
}

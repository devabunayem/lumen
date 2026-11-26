import { invoke } from "@tauri-apps/api/core";

export type UiSoundName =
  | "open"
  | "close"
  | "toggle_on"
  | "toggle_off"
  | "water_add"
  | "task_done"
  | "arc_scrub_tick"
  | "reminder_chime"
  | "mail_arrival"
  | "error";

export type SoundCategory = "interface" | "reminders";

export type SoundWaveform = "sine" | "triangle" | "sine_droplet";

export interface SoundPresetSpec {
  name: UiSoundName;
  category: SoundCategory;
  waveform: SoundWaveform;
  frequenciesHz: readonly number[];
  durationMs: number;
  gain: number;
  attackMs: number;
  minIntervalMs?: number;
}

export interface SoundSilenceState {
  soundEnabled: boolean;
  soundInterface: boolean;
  soundReminders: boolean;
  inCallOrMicActive: boolean;
  isFullscreen: boolean;
  focusSessionActive: boolean;
  windowsMuted: boolean;
  quietHoursActive: boolean;
}

export const SOUND_PRESETS: Record<UiSoundName, SoundPresetSpec> = {
  open: {
    name: "open",
    category: "interface",
    waveform: "sine",
    frequenciesHz: [520, 780],
    durationMs: 70,
    gain: 0.12,
    attackMs: 3,
  },
  close: {
    name: "close",
    category: "interface",
    waveform: "sine",
    frequenciesHz: [600, 400],
    durationMs: 70,
    gain: 0.11,
    attackMs: 3,
  },
  toggle_on: {
    name: "toggle_on",
    category: "interface",
    waveform: "triangle",
    frequenciesHz: [880],
    durationMs: 35,
    gain: 0.12,
    attackMs: 3,
  },
  toggle_off: {
    name: "toggle_off",
    category: "interface",
    waveform: "sine",
    frequenciesHz: [660],
    durationMs: 35,
    gain: 0.11,
    attackMs: 3,
  },
  water_add: {
    name: "water_add",
    category: "interface",
    waveform: "sine_droplet",
    frequenciesHz: [1046, 784],
    durationMs: 140,
    gain: 0.14,
    attackMs: 3,
  },
  task_done: {
    name: "task_done",
    category: "interface",
    waveform: "sine",
    frequenciesHz: [988, 1318],
    durationMs: 90,
    gain: 0.12,
    attackMs: 3,
  },
  arc_scrub_tick: {
    name: "arc_scrub_tick",
    category: "interface",
    waveform: "sine",
    frequenciesHz: [1500],
    durationMs: 10,
    gain: 0.1,
    attackMs: 3,
    minIntervalMs: 40,
  },
  reminder_chime: {
    name: "reminder_chime",
    category: "reminders",
    waveform: "sine",
    frequenciesHz: [523, 659, 784],
    durationMs: 740,
    gain: 0.13,
    attackMs: 3,
  },
  mail_arrival: {
    name: "mail_arrival",
    category: "reminders",
    waveform: "sine",
    frequenciesHz: [1175, 1568],
    durationMs: 160,
    gain: 0.12,
    attackMs: 3,
  },
  error: {
    name: "error",
    category: "interface",
    waveform: "sine",
    frequenciesHz: [180],
    durationMs: 90,
    gain: 0.12,
    attackMs: 3,
  },
};

/**
 * Pure check for whether a sound preset is permitted to play given current silence rules.
 * Mirrored in Rust (`lumen_media::sounds::should_play_ui_sound`).
 */
export function shouldAllowUiSound(name: UiSoundName, state: SoundSilenceState): boolean {
  if (!state.soundEnabled) {
    return false;
  }
  if (
    state.inCallOrMicActive ||
    state.isFullscreen ||
    state.focusSessionActive ||
    state.windowsMuted ||
    state.quietHoursActive
  ) {
    return false;
  }
  const preset = SOUND_PRESETS[name];
  if (preset.category === "interface" && !state.soundInterface) {
    return false;
  }
  if (preset.category === "reminders" && !state.soundReminders) {
    return false;
  }
  return true;
}

const lastPlayedAt = new Map<UiSoundName, number>();

export function resetSoundRateLimiterForTests(): void {
  lastPlayedAt.clear();
}

export function canTriggerRateLimitedSound(name: UiSoundName, nowMs = Date.now()): boolean {
  const minInterval = SOUND_PRESETS[name].minIntervalMs ?? 0;
  if (minInterval <= 0) {
    return true;
  }
  const prev = lastPlayedAt.get(name) ?? 0;
  if (nowMs - prev < minInterval) {
    return false;
  }
  lastPlayedAt.set(name, nowMs);
  return true;
}

/**
 * Triggers a synthesized UI sound via Rust (`play_ui_sound`), rate-limiting high-frequency ticks.
 */
export async function playUiSound(
  name: UiSoundName,
  localSilenceState?: Partial<SoundSilenceState>,
): Promise<boolean> {
  if (localSilenceState) {
    const merged: SoundSilenceState = {
      soundEnabled: true,
      soundInterface: true,
      soundReminders: true,
      inCallOrMicActive: false,
      isFullscreen: false,
      focusSessionActive: false,
      windowsMuted: false,
      quietHoursActive: false,
      ...localSilenceState,
    };
    if (!shouldAllowUiSound(name, merged)) {
      return false;
    }
  }
  if (!canTriggerRateLimitedSound(name)) {
    return false;
  }
  try {
    return await invoke<boolean>("play_ui_sound", { name });
  } catch {
    return false;
  }
}

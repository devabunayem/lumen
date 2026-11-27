import {
  resolveAutoScaleFactor,
  resolveScaleFactor,
  type IslandScaleSetting,
  type ShapeStyle,
} from "../design/tokens";

export type MonitorMode = "primary" | "active" | "index";
export type ActionGlowMode = "action" | "always" | "off";
export type WaqtPrayerPauseMode = "ask" | "auto_pause" | "ignore";

export interface WaqtRhythmAnchor {
  id: string;
  title: string;
  blockId: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha" | string;
  kind: "habit" | "water" | "walk" | "stretch" | "eye" | string;
  estimateMin: number;
  enabled: boolean;
  autoAddDaily: boolean;
  isUserTemplate: boolean;
}

export const DEFAULT_WAQT_RHYTHM_ANCHORS: WaqtRhythmAnchor[] = [
  {
    id: "rhythm_water_midday",
    title: "Drink water · 500 ml",
    blockId: "dhuhr",
    kind: "water",
    estimateMin: 5,
    enabled: true,
    autoAddDaily: false,
    isUserTemplate: false,
  },
  {
    id: "rhythm_walk_afternoon",
    title: "Short walk · 10m",
    blockId: "asr",
    kind: "walk",
    estimateMin: 10,
    enabled: true,
    autoAddDaily: false,
    isUserTemplate: false,
  },
  {
    id: "rhythm_stretch_evening",
    title: "Stretch · 5m",
    blockId: "maghrib",
    kind: "stretch",
    estimateMin: 5,
    enabled: false,
    autoAddDaily: false,
    isUserTemplate: false,
  },
  {
    id: "rhythm_eye_break",
    title: "Eye break · 2m",
    blockId: "dhuhr",
    kind: "eye",
    estimateMin: 5,
    enabled: false,
    autoAddDaily: false,
    isUserTemplate: false,
  },
];

export const USER_CHOSEN_ANCHOR_TEMPLATES: WaqtRhythmAnchor[] = [
  {
    id: "user_tpl_quran",
    title: "Quran reading · 15m",
    blockId: "fajr",
    kind: "habit",
    estimateMin: 15,
    enabled: false,
    autoAddDaily: false,
    isUserTemplate: true,
  },
  {
    id: "user_tpl_adhkar",
    title: "Adhkar · 10m",
    blockId: "asr",
    kind: "habit",
    estimateMin: 10,
    enabled: false,
    autoAddDaily: false,
    isUserTemplate: true,
  },
];

export interface LumenSettings {
  version: number;
  shapeStyle: ShapeStyle;
  scale: IslandScaleSetting | "auto" | "100" | "115" | "130" | "150";
  minimalNotch: boolean;
  hoverToOpen: boolean;
  hoverReturnSeconds: number;
  mascotEnabled: boolean;
  showHeaderClock: boolean;
  hideInFullscreen: boolean;
  monitorMode: MonitorMode;
  monitorIndex: number;
  positionOffsetX: number;
  language: "en" | "bn";
  reducedMotionOverride: boolean;
  startWithWindows: boolean;
  hotkeyHide: string;
  hotkeyExpand: string;
  pageOrder: string[];
  hiddenPages: string[];
  waterGoalMl: number;
  mediaExclusions: string[];
  soundEnabled: boolean;
  soundVolume: number;
  soundInterface: boolean;
  soundReminders: boolean;
  locationOptIn: boolean;
  reduceTransparency: boolean;
  glowEnabled: boolean;
  parallaxEnabled: boolean;
  banglaDigits: boolean;
  chipFocusEnabled: boolean;
  chipLedgerEnabled: boolean;
  chipClipboardEnabled: boolean;
  chipDevPulseEnabled: boolean;
  devPulsePorts: number[];
  reminderSnoozeMinutes: number;
  reminderDefaultLeadMinutes: number;
  restingShowClock: boolean;
  restingShowWaveform: boolean;
  restingShowSensorDots: boolean;
  restingShowBatteryRing: boolean;
  nowPlayingBannerEnabled: boolean;
  nowPlayingBannerSeconds: number;
  notificationDurationSeconds: number;
  actionGlowMode: ActionGlowMode;
  waqtBedtimeHHMM: string;
  waqtPrayerPauseMode: WaqtPrayerPauseMode;
  waqtRolloverAtFajr: boolean;
  waqtRamadanTaraweeh: boolean;
  waqtHintDismissed: boolean;
  waqtBlockNames: Record<string, string>;
  waqtQuietMode: boolean;
  waqtFirstRunDismissed: boolean;
  waqtRhythmAnchors: WaqtRhythmAnchor[];
}

export const DEFAULT_SETTINGS: LumenSettings = {
  version: 1,
  shapeStyle: "notch",
  scale: "auto",
  minimalNotch: false,
  hoverToOpen: true,
  hoverReturnSeconds: 5,
  mascotEnabled: true,
  showHeaderClock: true,
  hideInFullscreen: true,
  monitorMode: "primary",
  monitorIndex: 0,
  positionOffsetX: 0,
  language: "en",
  reducedMotionOverride: false,
  startWithWindows: false,
  hotkeyHide: "Ctrl+Alt+L",
  hotkeyExpand: "Ctrl+Alt+Space",
  pageOrder: ["waqt", "control", "calendar", "reminders", "todo", "water", "pomodoro", "shelf"],
  hiddenPages: [],
  waterGoalMl: 1500,
  mediaExclusions: [],
  soundEnabled: true,
  soundVolume: 30,
  soundInterface: true,
  soundReminders: true,
  locationOptIn: true,
  reduceTransparency: false,
  glowEnabled: true,
  parallaxEnabled: true,
  banglaDigits: false,
  chipFocusEnabled: true,
  chipLedgerEnabled: true,
  chipClipboardEnabled: true,
  chipDevPulseEnabled: true,
  devPulsePorts: [3000, 5173, 1420],
  reminderSnoozeMinutes: 3,
  reminderDefaultLeadMinutes: 10,
  restingShowClock: true,
  restingShowWaveform: true,
  restingShowSensorDots: true,
  restingShowBatteryRing: true,
  nowPlayingBannerEnabled: true,
  nowPlayingBannerSeconds: 4,
  notificationDurationSeconds: 8,
  actionGlowMode: "action",
  waqtBedtimeHHMM: "23:30",
  waqtPrayerPauseMode: "ask",
  waqtRolloverAtFajr: true,
  waqtRamadanTaraweeh: false,
  waqtHintDismissed: false,
  waqtBlockNames: {},
  waqtQuietMode: false,
  waqtFirstRunDismissed: false,
  waqtRhythmAnchors: DEFAULT_WAQT_RHYTHM_ANCHORS,
};

export function resolveSettingsScaleFactor(
  scale: LumenSettings["scale"],
  autoScreenWidth?: number,
): number {
  switch (String(scale)) {
    case "auto":
      return resolveScaleFactor(
        "auto",
        typeof autoScreenWidth === "number" ? resolveAutoScaleFactor(autoScreenWidth) : undefined,
      );
    case "100":
      return 1;
    case "115":
      return 1.15;
    case "130":
      return 1.3;
    case "150":
      return 1.5;
    default:
      return 1;
  }
}

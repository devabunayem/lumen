import type { LumiAccessory } from "../design/lumi/types";
import {
  resolveAutoScaleFactor,
  resolveScaleFactor,
  type IslandScaleSetting,
  type ShapeStyle,
} from "../design/tokens";

export type MonitorMode = "primary" | "active" | "index";
export type ActionGlowMode = "action" | "always" | "off";
export type PrayerArrivalModeSetting = "ask" | "auto_pause" | "ignore";

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
  calendarPrayerPauseMode: PrayerArrivalModeSetting;
  lumiTalkLess: boolean;
  lumiSoundsEnabled: boolean;
  lumiAccessories: LumiAccessory[];
  calendarFirstDayOfWeek: 0 | 6;
  calendarColorBlindMarks: boolean;
  calendarSocialBlockArmed: boolean;
  focusMinutes: number;
  focusShortBreakMinutes: number;
  focusLongBreakMinutes: number;
  focusRounds: number;
  calendarGoogleClientId: string;
  calendarMicrosoftClientId: string;
  calendarWritebackTasks: boolean;
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
  pageOrder: ["calendar_hub", "system_shelf"],
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
  calendarPrayerPauseMode: "ask",
  lumiTalkLess: false,
  lumiSoundsEnabled: false,
  lumiAccessories: [],
  calendarFirstDayOfWeek: 0,
  calendarColorBlindMarks: false,
  calendarSocialBlockArmed: true,
  focusMinutes: 25,
  focusShortBreakMinutes: 5,
  focusLongBreakMinutes: 15,
  focusRounds: 4,
  calendarGoogleClientId: "",
  calendarMicrosoftClientId: "",
  calendarWritebackTasks: false,
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

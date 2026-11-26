import {
  resolveAutoScaleFactor,
  resolveScaleFactor,
  type IslandScaleSetting,
  type ShapeStyle,
} from "../design/tokens";

export type MonitorMode = "primary" | "active" | "index";

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
  customAdhanPath: string | null;
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
  pageOrder: [
    "control",
    "music",
    "calendar",
    "reminders",
    "todo",
    "water",
    "prayer",
    "pomodoro",
    "shelf",
  ],
  hiddenPages: [],
  waterGoalMl: 1500,
  mediaExclusions: [],
  soundEnabled: true,
  soundVolume: 30,
  soundInterface: true,
  soundReminders: true,
  customAdhanPath: null,
  locationOptIn: false,
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

import type { IslandScaleSetting, ShapeStyle } from "../design/tokens";

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
  pageOrder: ["control", "music", "todo", "water", "prayer", "pomodoro", "shelf"],
  hiddenPages: [],
  waterGoalMl: 1500,
  mediaExclusions: [],
};

export function resolveSettingsScaleFactor(scale: LumenSettings["scale"]): number {
  switch (String(scale)) {
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

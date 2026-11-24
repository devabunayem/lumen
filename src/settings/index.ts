import type { IslandScaleSetting, ShapeStyle } from "../design/tokens";

export interface LumenSettings {
  version: number;
  shapeStyle: ShapeStyle;
  scale: IslandScaleSetting;
  minimalNotch: boolean;
  hideInFullscreen: boolean;
  language: "en" | "bn";
}

export const DEFAULT_SETTINGS: LumenSettings = {
  version: 1,
  shapeStyle: "notch",
  scale: "auto",
  minimalNotch: false,
  hideInFullscreen: true,
  language: "en",
};

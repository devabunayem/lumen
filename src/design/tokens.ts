export type ShapeStyle = "notch" | "pill";

export type IslandScaleSetting = "auto" | 100 | 115 | 130 | 150;

export const COLOR_TOKENS = {
  surface: "var(--surface)",
  surfaceRaised: "var(--surface-raised)",
  surfaceButton: "var(--surface-button)",
  hairline: "var(--hairline)",
  hairlineTop: "var(--hairline-top)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textTertiary: "var(--text-tertiary)",
  accentGreen: "var(--accent-green)",
  accentBlue: "var(--accent-blue)",
  accentCyan: "var(--accent-cyan)",
  accentOrange: "var(--accent-orange)",
  accentPurple: "var(--accent-purple)",
  accentRed: "var(--accent-red)",
} as const;

export const BASE_GEOMETRY = {
  collapsed: { width: 200, height: 32 },
  minimal: { width: 120, height: 28 },
  slim: { width: 96, height: 14 },
  expanded: { width: 620, height: 190 },
  hud: { width: 360, height: 64 },
  notchBottomRadius: 32,
  pillFloatOffset: 8,
  innerPadding: 20,
  blockGap: 12,
  innerCardRadius: 22,
  capsuleButtonHeight: 36,
} as const;

/**
 * Resolves the active UI multiplier from user scale settings.
 */
export function resolveScaleFactor(setting: IslandScaleSetting, autoFactor = 1): number {
  if (setting === "auto") {
    return autoFactor;
  }
  return setting / 100;
}

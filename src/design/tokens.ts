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
  collapsed: { width: 184, height: 30 },
  minimal: { width: 110, height: 26 },
  slim: { width: 84, height: 12 },
  expanded: { width: 560, height: 172 },
  hud: { width: 340, height: 60 },
  notchBottomRadius: 24,
  pillFloatOffset: 8,
  innerPadding: 12,
  blockGap: 6,
  innerCardRadius: 18,
  capsuleButtonHeight: 32,
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

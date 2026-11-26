export type ShapeStyle = "notch" | "pill";

export type IslandScaleSetting = "auto" | 100 | 115 | 130 | 150;

export const COLOR_TOKENS = {
  surface: "var(--surface)",
  surfaceRaised: "var(--surface-raised)",
  surfaceButton: "var(--surface-button)",
  hairline: "var(--hairline)",
  hairlineTop: "var(--hairline-top)",
  hairlineStrong: "var(--hairline-strong)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textTertiary: "var(--text-tertiary)",
  accentGreen: "var(--accent-green)",
  accentBlue: "var(--accent-blue)",
  accentCyan: "var(--accent-cyan)",
  accentOrange: "var(--accent-orange)",
  accentPurple: "var(--accent-purple)",
  accentFocus: "var(--accent-focus)",
  accentRed: "var(--accent-red)",
  toggleOff: "var(--toggle-off)",
  toggleIconOff: "var(--toggle-icon-off)",
  arcSun: "var(--arc-sun)",
  arcProgress: "var(--arc-progress)",
  arcProgressGlow: "var(--arc-progress-glow)",
  arcSunHalo: "var(--arc-sun-halo)",
  arcMoon: "var(--arc-moon)",
  arcMoonProgress: "var(--arc-moon-progress)",
  arcMoonGlow: "var(--arc-moon-glow)",
  arcMoonHalo: "var(--arc-moon-halo)",
  arcTrack: "var(--arc-track)",
  arcHorizon: "var(--arc-horizon)",
  arcGuide: "var(--arc-guide)",
  arcMarkerRing: "var(--arc-marker-ring)",
  arcTimeMuted: "var(--arc-time-muted)",
  arcTooltipBg: "var(--arc-tooltip-bg)",
  glassCardBg: "var(--glass-card-bg)",
  glassCardBorder: "var(--glass-card-border)",
  glassCardSolid: "var(--glass-card-solid)",
  chipGlassBg: "var(--chip-glass-bg)",
  chipGlassBorder: "var(--chip-glass-border)",
  chipGlassSolid: "var(--chip-glass-solid)",
  musicDefaultFrom: "var(--music-default-from)",
  musicDefaultTo: "var(--music-default-to)",
  glowSunDefault: "var(--glow-sun-default)",
  glowAlbumDefault: "var(--glow-album-default)",
  glowAccentDefault: "var(--glow-accent-default)",
  glowDawn: "var(--glow-dawn)",
  glowDay: "var(--glow-day)",
  glowDusk: "var(--glow-dusk)",
  glowNight: "var(--glow-night)",
  glowFocusTint: "var(--glow-focus-tint)",
  glowLowBattery: "var(--glow-low-battery)",
  pageDotInactive: "var(--page-dot-inactive)",
  skeletonBase: "var(--skeleton-base)",
  skeletonHighlight: "var(--skeleton-highlight)",
} as const;

export const BASE_GEOMETRY = {
  collapsed: { width: 184, height: 30 },
  minimal: { width: 110, height: 26 },
  slim: { width: 84, height: 12 },
  expanded: { width: 560, height: 172 },
  homeExpanded: { width: 760, height: 376 },
  hud: { width: 240, height: 56 },
  notchBottomRadius: 24,
  homeBottomRadius: 40,
  pillFloatOffset: 8,
  innerPadding: 16,
  blockGap: 8,
  innerCardRadius: 18,
  homeCardRadius: 22,
  chipRadius: 99,
  controlRadius: 15,
  capsuleButtonHeight: 28,
} as const;

/**
 * Resolves the Auto scale multiplier from logical/physical screen width:
 * - <= 1440 px -> 1.00
 * - 1920+ px  -> 1.15
 * - 2560+ px  -> 1.30
 */
export function resolveAutoScaleFactor(screenWidth?: number): number {
  const width =
    typeof screenWidth === "number" && Number.isFinite(screenWidth) && screenWidth > 0
      ? screenWidth
      : typeof window !== "undefined"
        ? window.screen?.width || window.innerWidth || 1440
        : 1440;
  if (width >= 2560) {
    return 1.3;
  }
  if (width >= 1920) {
    return 1.15;
  }
  return 1;
}

/**
 * Resolves the active UI multiplier from user scale settings.
 */
export function resolveScaleFactor(setting: IslandScaleSetting, autoFactor?: number): number {
  if (setting === "auto") {
    return typeof autoFactor === "number" ? autoFactor : resolveAutoScaleFactor();
  }
  return setting / 100;
}

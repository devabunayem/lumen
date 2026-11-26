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
  sunDisc: "var(--sun-disc)",
  sunShade: "var(--sun-shade)",
  sunDusk: "var(--sun-dusk)",
  moonCrescent: "var(--moon-crescent)",
  moonStar: "var(--moon-star)",
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
  auroraWaveA: "var(--aurora-wave-a)",
  auroraWaveB: "var(--aurora-wave-b)",
  auroraCelebrateA: "var(--aurora-celebrate-a)",
  auroraCelebrateB: "var(--aurora-celebrate-b)",
  auroraConfirmA: "var(--aurora-confirm-a)",
  auroraConfirmB: "var(--aurora-confirm-b)",
  auroraFocusA: "var(--aurora-focus-a)",
  auroraFocusB: "var(--aurora-focus-b)",
} as const;

export const BASE_GEOMETRY = {
  collapsed: { width: 184, height: 30 },
  minimal: { width: 110, height: 26 },
  slim: { width: 84, height: 12 },
  expanded: { width: 560, height: 172 },
  richExpanded: { width: 580, height: 208 },
  homeExpanded: { width: 640, height: 312 },
  hud: { width: 240, height: 56 },
  nowPlaying: { width: 320, height: 60 },
  notification: { width: 248, height: 58 },
  notificationExpanded: { width: 460, height: 260 },
  reminder: { width: 380, height: 108 },
  notchBottomRadius: 24,
  homeBottomRadius: 32,
  pillFloatOffset: 8,
  innerPadding: 14,
  blockGap: 6,
  innerCardRadius: 18,
  homeCardRadius: 20,
  chipRadius: 99,
  controlRadius: 14,
  capsuleButtonHeight: 28,
} as const;

/**
 * Resolves the Auto scale multiplier from monitor width:
 * - <= 1920 px (laptops / 1080p) -> 1.00
 * - 2560+ px (1440p / QHD)       -> 1.15
 * - 3840+ px (4K UHD)            -> 1.30
 */
export function resolveAutoScaleFactor(screenWidth?: number): number {
  const width =
    typeof screenWidth === "number" && Number.isFinite(screenWidth) && screenWidth > 0
      ? screenWidth
      : typeof window !== "undefined"
        ? window.screen?.width || window.innerWidth || 1440
        : 1440;
  if (width >= 3840) {
    return 1.3;
  }
  if (width >= 2560) {
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

/**
 * Computes tight, content-fitted dimensions for toast notifications with subtle glow clearance.
 */
export function measureNotificationDimensions(
  notification: { title: string; body: string; app_name: string },
  expanded: boolean,
): { width: number; height: number } {
  if (expanded) {
    return BASE_GEOMETRY.notificationExpanded;
  }
  const title = notification.title.trim();
  const body = notification.body.trim();
  const appName = notification.app_name.trim();

  const titleRowPx =
    Math.ceil(title.length * 7.5) + (appName.length > 0 ? Math.ceil(appName.length * 6.5) + 18 : 0);
  const longestBodyLineChars =
    body.length > 0 ? Math.max(...body.split("\n").map((line) => line.length)) : 0;
  const bodyRowPx = Math.ceil(longestBodyLineChars * 6.4);
  const width = Math.max(
    BASE_GEOMETRY.notification.width,
    Math.min(428, Math.max(titleRowPx, bodyRowPx) + 88),
  );

  const textWidth = width - 82;
  const titlePerLine = Math.max(16, Math.floor(textWidth / 7.3));
  const bodyPerLine = Math.max(20, Math.floor(textWidth / 6.3));
  const titleLines = Math.min(2, Math.max(1, Math.ceil(Math.max(1, title.length) / titlePerLine)));
  const bodyLines = body
    ? Math.min(
        3,
        Math.max(
          1,
          body
            .split("\n")
            .reduce((sum, seg) => sum + Math.max(1, Math.ceil(seg.length / bodyPerLine)), 0),
        ),
      )
    : 0;
  const isLong = body.length > 150 || title.length > 75 || body.split("\n").length > 3;

  // 20 px vertical padding + 6 px subtle bottom cushion + wrapped content rows
  const neededHeight =
    26 + titleLines * 17 + (bodyLines > 0 ? 3 + bodyLines * 16 : 0) + (isLong ? 22 : 0);
  return {
    width,
    height: Math.max(BASE_GEOMETRY.notification.height, Math.min(138, neededHeight)),
  };
}

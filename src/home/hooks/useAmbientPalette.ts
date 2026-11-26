import { useMemo } from "react";

export interface AmbientPalette {
  sunGlowColor: string;
  albumGlowColor: string;
  accentGlowColor: string;
  focusTintColor: string;
  lowBatteryGlowColor: string | null;
  glowOpacityScale: number;
  timePhase: "dawn" | "day" | "dusk" | "night";
  reduceTransparency: boolean;
  glowEnabled: boolean;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHexRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const norm = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

export function contrastRatioAgainstWhite(bg: Rgb): number {
  const lumBg = relativeLuminance(bg);
  // #ffffff relative luminance is 1.0
  return (1.0 + 0.05) / (lumBg + 0.05);
}

/**
 * Caps saturation and scales alpha over #000 so foreground white/muted text preserves >= 4.5:1 contrast.
 */
export function buildContrastSafeGlowRgba(
  hex: string | null | undefined,
  desiredAlpha: number,
  focusMode = false,
): string {
  const fallback = focusMode ? "rgba(94, 92, 230, 0.24)" : "rgba(130, 60, 255, 0.42)";
  if (!hex) {
    return fallback;
  }
  const parsed = parseHexRgb(hex);
  if (!parsed) {
    return fallback;
  }

  // Cap saturation slightly by blending 15% toward neutral luma, or 45% in Focus mode
  const luma = Math.round(0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b);
  const desatRatio = focusMode ? 0.45 : 0.15;
  const r = Math.round(parsed.r * (1 - desatRatio) + luma * desatRatio);
  const g = Math.round(parsed.g * (1 - desatRatio) + luma * desatRatio);
  const b = Math.round(parsed.b * (1 - desatRatio) + luma * desatRatio);

  // Iteratively step down alpha until blended background on #000 gives >= 4.5:1 contrast with white
  let alpha = focusMode ? desiredAlpha * 0.7 : desiredAlpha;
  while (alpha > 0.12) {
    const composite: Rgb = {
      r: Math.round(r * alpha),
      g: Math.round(g * alpha),
      b: Math.round(b * alpha),
    };
    if (contrastRatioAgainstWhite(composite) >= 4.5) {
      break;
    }
    alpha -= 0.04;
  }

  return `rgba(${r}, ${g}, ${b}, ${Math.max(0.12, alpha).toFixed(2)})`;
}

export function resolveTimeOfDayPhase(
  nowMin: number,
  isNightMode: boolean,
  fajrMin = 300,
  dhuhrMin = 710,
  asrMin = 930,
): "dawn" | "day" | "dusk" | "night" {
  if (isNightMode) {
    return "night";
  }
  if (nowMin >= fajrMin - 30 && nowMin < fajrMin + 120) {
    return "dawn";
  }
  if (nowMin >= dhuhrMin - 240 && nowMin < asrMin + 15) {
    return "day";
  }
  return "dusk";
}

export interface AmbientPaletteInput {
  nowMin: number;
  isNightMode: boolean;
  fajrMin?: number;
  dhuhrMin?: number;
  asrMin?: number;
  albumAccentHex?: string | null;
  hasActiveMusic: boolean;
  isFocusSession: boolean;
  batteryPct: number | null;
  isCharging: boolean;
  glowEnabled: boolean;
  reduceTransparency: boolean;
}

export function computeAmbientPalette(input: AmbientPaletteInput): AmbientPalette {
  const timePhase = resolveTimeOfDayPhase(
    input.nowMin,
    input.isNightMode,
    input.fajrMin,
    input.dhuhrMin,
    input.asrMin,
  );

  const sunMap = {
    dawn: "var(--glow-dawn)",
    day: "var(--glow-day)",
    dusk: "var(--glow-sun-default)",
    night: "var(--glow-night)",
  } as const;

  const albumGlowColor = input.hasActiveMusic
    ? buildContrastSafeGlowRgba(input.albumAccentHex, 0.42, input.isFocusSession)
    : input.isFocusSession
      ? "rgba(94, 92, 230, 0.22)"
      : "var(--glow-album-default)";

  const sunGlowColor = input.isFocusSession ? "rgba(94, 92, 230, 0.24)" : sunMap[timePhase];
  const accentGlowColor = input.isFocusSession
    ? "rgba(94, 92, 230, 0.16)"
    : "var(--glow-accent-default)";
  const lowBattery =
    input.batteryPct !== null && input.batteryPct < 10 && !input.isCharging
      ? "var(--glow-low-battery)"
      : null;

  return {
    sunGlowColor,
    albumGlowColor,
    accentGlowColor,
    focusTintColor: "var(--glow-focus-tint)",
    lowBatteryGlowColor: lowBattery,
    glowOpacityScale: input.isFocusSession ? 0.7 : 1,
    timePhase,
    reduceTransparency: input.reduceTransparency,
    glowEnabled: input.glowEnabled,
  };
}

export function useAmbientPalette(input: AmbientPaletteInput): AmbientPalette {
  const nowBucket = Math.floor(input.nowMin / 5);
  const {
    isNightMode,
    fajrMin,
    dhuhrMin,
    asrMin,
    albumAccentHex,
    hasActiveMusic,
    isFocusSession,
    batteryPct,
    isCharging,
    glowEnabled,
    reduceTransparency,
  } = input;

  return useMemo(
    () =>
      computeAmbientPalette({
        nowMin: nowBucket * 5,
        isNightMode,
        fajrMin,
        dhuhrMin,
        asrMin,
        albumAccentHex,
        hasActiveMusic,
        isFocusSession,
        batteryPct,
        isCharging,
        glowEnabled,
        reduceTransparency,
      }),
    [
      nowBucket,
      isNightMode,
      fajrMin,
      dhuhrMin,
      asrMin,
      albumAccentHex,
      hasActiveMusic,
      isFocusSession,
      batteryPct,
      isCharging,
      glowEnabled,
      reduceTransparency,
    ],
  );
}

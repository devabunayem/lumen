import { COLOR_TOKENS } from "../tokens";

export const LUMI_BODY_PATH =
  "M100 44 C150 44 176 84 176 122 C176 160 144 182 100 182 C56 182 24 160 24 122 C24 84 50 44 100 44 Z";

export function resolveGlowToken(hue: LumiGlowHue): string {
  switch (hue) {
    case "focus":
      return COLOR_TOKENS.lumiGlowFocus;
    case "prayer":
      return COLOR_TOKENS.lumiGlowPrayer;
    case "night":
      return COLOR_TOKENS.lumiGlowNight;
    case "dusk":
    default:
      return COLOR_TOKENS.lumiGlowDusk;
  }
}

export const LUMI_MOODS = [
  "idle",
  "hello",
  "talk",
  "happy",
  "celebrate",
  "focus",
  "calm",
  "curious",
  "sleepy",
  "worried",
  "oops",
  "love",
] as const;

export type LumiMood = (typeof LUMI_MOODS)[number];

export const LUMI_GLOW_HUES = ["dusk", "focus", "prayer", "night"] as const;

export type LumiGlowHue = (typeof LUMI_GLOW_HUES)[number];

export type LumiAccessory = "ramadanLantern" | "eidSparkle" | "boishakhHat";

export type LumiLodTier = "micro" | "compact" | "full";

export interface LumiLookPoint {
  x: number;
  y: number;
}

export interface LumiProps {
  size?: 18 | 22 | 28 | 56 | 96 | number;
  mood?: LumiMood;
  lookAt?: LumiLookPoint;
  lookX?: number;
  lookY?: number;
  canLook?: boolean;
  active?: boolean;
  allowMultiple?: boolean;
  glow?: boolean | LumiGlowHue;
  glowHue?: LumiGlowHue;
  talking?: boolean;
  beat?: number;
  tap?: number;
  reducedMotion?: boolean;
  nowDate?: Date;
  idleMs?: number;
  accessories?: readonly LumiAccessory[];
  onMoodResolved?: (mood: LumiMood) => void;
  className?: string;
}

/**
 * Resolves the Level-of-Detail tier from pixel size:
 * - micro (<= 22 px): body + eyes + spark only
 * - compact (23..40 px): adds blush + mouth
 * - full (>= 41 px): arms, belly, specular highlight, headphones & accessories
 */
export function resolveLumiLod(size: number): LumiLodTier {
  if (size <= 22) {
    return "micro";
  }
  if (size <= 40) {
    return "compact";
  }
  return "full";
}

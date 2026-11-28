import { useReducedMotion } from "motion/react";
import {
  Lumi,
  type LumiAccessory,
  type LumiGlowHue,
  type LumiLookPoint,
  type LumiMood as NativeLumiMood,
} from "../design/lumi";
import type { LumiMood } from "./ActionGlowLayer";

export interface LumenMascotProps {
  enabled?: boolean;
  musicPlaying?: boolean;
  celebrating?: boolean;
  mood?: LumiMood;
  nativeMood?: NativeLumiMood;
  size?: "compact" | "hero";
  pixelSize?: number;
  accentColor?: string;
  glowHue?: LumiGlowHue;
  talking?: boolean;
  beat?: number;
  active?: boolean;
  canLook?: boolean;
  lookAt?: LumiLookPoint;
  reducedMotion?: boolean;
  nowDate?: Date;
  accessories?: readonly LumiAccessory[];
  bubbleText?: string | null;
}

function mapLegacyMoodToNative(mood: LumiMood): NativeLumiMood {
  switch (mood) {
    case "wave":
      return "hello";
    case "celebrate":
      return "celebrate";
    case "confirm":
      return "happy";
    case "music":
      return "happy";
    case "sleep":
      return "sleepy";
    case "peek":
      return "curious";
    case "idle":
    default:
      return "idle";
  }
}

/**
 * Expressive original vector companion ("Lumi") backed by the unified `<Lumi />` rig
 * and Main state machine, keeping decorative graphics `aria-hidden="true"` while exposing
 * optional speech bubbles via `role="status"`.
 */
export function LumenMascot({
  enabled = true,
  musicPlaying = false,
  celebrating = false,
  mood,
  nativeMood,
  size = "compact",
  pixelSize,
  glowHue,
  talking = false,
  beat = 0,
  active = true,
  canLook = false,
  lookAt,
  reducedMotion = false,
  nowDate,
  accessories = [],
  bubbleText = null,
}: LumenMascotProps) {
  const prefersReduced = (useReducedMotion() ?? false) || reducedMotion;

  if (!enabled) {
    return null;
  }

  const resolvedMood: LumiMood =
    mood ?? (celebrating ? "celebrate" : musicPlaying ? "music" : "idle");
  const targetNativeMood: NativeLumiMood = nativeMood ?? mapLegacyMoodToNative(resolvedMood);
  const resolvedPixelSize = pixelSize ?? (size === "hero" ? 28 : 22);
  const resolvedGlowHue: LumiGlowHue | undefined =
    glowHue ??
    (targetNativeMood === "focus"
      ? "focus"
      : targetNativeMood === "calm"
        ? "prayer"
        : targetNativeMood === "sleepy"
          ? "night"
          : undefined);

  return (
    <span className="relative z-10 inline-flex items-center gap-1.5">
      <span
        data-testid="lumen-mascot"
        data-mood={resolvedMood}
        data-native-mood={targetNativeMood}
        data-size={size === "hero" ? "hero" : undefined}
        aria-hidden="true"
        className="relative inline-flex shrink-0 items-center justify-center"
      >
        <Lumi
          size={resolvedPixelSize}
          mood={targetNativeMood}
          glowHue={resolvedGlowHue}
          talking={Boolean(talking || bubbleText)}
          beat={beat}
          active={active}
          canLook={canLook}
          lookAt={lookAt}
          reducedMotion={prefersReduced}
          nowDate={nowDate}
          accessories={accessories}
        />
      </span>
      {bubbleText && (
        <span
          role="status"
          aria-live="polite"
          data-testid="lumi-speech-bubble"
          className="max-w-[144px] truncate rounded-full border border-white/15 px-2 py-0.5 text-[10.5px] font-medium leading-tight text-white"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
        >
          {bubbleText}
        </span>
      )}
    </span>
  );
}

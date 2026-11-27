import { motion, useReducedMotion } from "motion/react";
import { MOTION_PRESETS } from "../design/motion";
import {
  Lumi,
  type LumiAccessory,
  type LumiGlowHue,
  type LumiLookPoint,
  type LumiMood as NativeLumiMood,
} from "../design/lumi";
import { COLOR_TOKENS } from "../design/tokens";
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

export type WaqtBodyDoubleState = "idle_working" | "focus" | "looks_up" | "break" | "celebrate";

export interface WaqtBodyDoubleLumiProps {
  state: WaqtBodyDoubleState;
  isVisible: boolean;
  reduceMotion?: boolean;
  accessories?: readonly LumiAccessory[];
  beat?: number;
  silent?: boolean;
  canLook?: boolean;
  nowDate?: Date;
}

function mapWaqtStateToLumiMood(state: WaqtBodyDoubleState, silent: boolean): NativeLumiMood {
  if (silent) {
    return "calm";
  }
  switch (state) {
    case "focus":
      return "focus";
    case "celebrate":
      return "celebrate";
    case "break":
      return "happy";
    case "looks_up":
      return "curious";
    case "idle_working":
    default:
      return "idle";
  }
}

/**
 * Unified Lumi body-double companion for Waqt Focus Flow:
 * renders the full-detail `<Lumi />` rig (with Focus headphones in `focus` mood)
 * and animates gently only when visible and `reduceMotion` is disabled.
 */
export function WaqtBodyDoubleLumi({
  state,
  isVisible,
  reduceMotion = false,
  accessories = [],
  beat = 0,
  silent = false,
  canLook = true,
  nowDate,
}: WaqtBodyDoubleLumiProps) {
  const prefersReduced = (useReducedMotion() ?? false) || reduceMotion;
  const shouldAnimate = isVisible && !prefersReduced;
  const nativeMood = mapWaqtStateToLumiMood(state, silent);

  return (
    <motion.div
      data-testid="waqt-lumi-body-double"
      data-body-state={state}
      aria-hidden="true"
      className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle, ${COLOR_TOKENS.waqtGlowIndigo} 0%, rgba(94, 92, 230, 0.14) 70%, transparent 100%)`,
      }}
      animate={
        shouldAnimate
          ? state === "celebrate"
            ? { y: [0, -2, 0] }
            : state === "break"
              ? { rotate: [-2, 2, -2] }
              : { y: [0, -1, 0] }
          : undefined
      }
      transition={
        shouldAnimate
          ? state === "celebrate"
            ? { ...MOTION_PRESETS.bouncy, repeat: 1 }
            : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <Lumi
        size={42}
        mood={nativeMood}
        glowHue={nativeMood === "focus" ? "focus" : nativeMood === "calm" ? "prayer" : "dusk"}
        beat={beat}
        active={isVisible}
        canLook={canLook && isVisible}
        reducedMotion={prefersReduced}
        nowDate={nowDate}
        accessories={accessories}
      />
    </motion.div>
  );
}

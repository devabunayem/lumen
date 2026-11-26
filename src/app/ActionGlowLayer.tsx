import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MOTION_PRESETS } from "../design/motion";
import { COLOR_TOKENS } from "../design/tokens";
import type { ActionGlowMode } from "../settings";

export type LumiMood = "idle" | "wave" | "celebrate" | "confirm" | "music" | "sleep" | "peek";

export interface ActionGlowLayerProps {
  mode: ActionGlowMode;
  active: boolean;
  mood: LumiMood;
  accentHex?: string | null;
  expanded?: boolean;
  paused?: boolean;
}

function resolveAuroraStops(mood: LumiMood, accentHex?: string | null): [string, string] {
  if (accentHex && mood === "music") {
    return [accentHex, `color-mix(in srgb, ${accentHex} 72%, ${COLOR_TOKENS.auroraWaveB} 28%)`];
  }
  switch (mood) {
    case "celebrate":
      return [COLOR_TOKENS.auroraCelebrateA, COLOR_TOKENS.auroraCelebrateB];
    case "confirm":
      return [COLOR_TOKENS.auroraConfirmA, COLOR_TOKENS.auroraConfirmB];
    case "sleep":
      return [COLOR_TOKENS.auroraFocusA, COLOR_TOKENS.auroraFocusB];
    case "wave":
    case "peek":
    case "music":
    case "idle":
    default:
      return [COLOR_TOKENS.auroraWaveA, COLOR_TOKENS.auroraWaveB];
  }
}

/**
 * Flowing, GPU-composited under-notch aurora glow radiating cleanly beneath the bottom edge.
 */
export function ActionGlowLayer({
  mode,
  active,
  mood,
  accentHex,
  expanded = false,
  paused = false,
}: ActionGlowLayerProps) {
  const prefersReduced = useReducedMotion() ?? false;
  if (mode === "off") {
    return null;
  }
  const visible = mode === "always" || (mode === "action" && active);
  const [colorA, colorB] = resolveAuroraStops(mood, accentHex);
  const targetOpacity = active ? (expanded ? 0.62 : 0.94) : expanded ? 0.28 : 0.56;
  const playState = prefersReduced || paused ? "paused" : "running";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="lumen-action-glow"
          data-testid="lumen-action-glow"
          data-mood={mood}
          data-paused={paused ? "true" : "false"}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: targetOpacity }}
          exit={{ opacity: 0 }}
          transition={prefersReduced ? MOTION_PRESETS.reducedMotionFade : MOTION_PRESETS.auroraFade}
          className="pointer-events-none absolute -inset-x-3 -bottom-[15px] z-0 h-[34px] overflow-visible"
        >
          {/* Left-to-right flowing aurora lobe beneath notch contour */}
          <div
            className={
              prefersReduced
                ? "absolute -inset-x-3 inset-y-0"
                : "lumen-aurora-blob-a absolute -inset-x-3 inset-y-0"
            }
            style={{
              background: `radial-gradient(56% 74% at 32% 55%, ${colorA}, transparent 74%)`,
              filter: "blur(11px)",
              animationPlayState: playState,
            }}
          />
          {/* Right-to-left counter-drifting aurora lobe beneath notch contour */}
          <div
            className={
              prefersReduced
                ? "absolute -inset-x-3 inset-y-0"
                : "lumen-aurora-blob-b absolute -inset-x-3 inset-y-0"
            }
            style={{
              background: `radial-gradient(56% 74% at 68% 55%, ${colorB}, transparent 74%)`,
              filter: "blur(12px)",
              animationPlayState: playState,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

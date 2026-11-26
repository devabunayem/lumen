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
 * Flowing, GPU-composited bottom aurora edge glow constrained cleanly inside the notch silhouette.
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
  const targetOpacity = active ? (expanded ? 0.42 : 0.96) : expanded ? 0.24 : 0.56;
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
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[32px] max-h-full overflow-hidden rounded-[inherit]"
          style={{
            maskImage:
              "linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.58) 46%, transparent 96%)",
            WebkitMaskImage:
              "linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.58) 46%, transparent 96%)",
          }}
        >
          {/* Left-to-right flowing aurora lobe */}
          <div
            className={
              prefersReduced
                ? "absolute -inset-x-6 -bottom-3 h-full"
                : "lumen-aurora-blob-a absolute -inset-x-6 -bottom-3 h-full"
            }
            style={{
              background: `radial-gradient(62% 95% at 32% 95%, ${colorA}, transparent 72%)`,
              filter: "blur(8px)",
              animationPlayState: playState,
            }}
          />
          {/* Right-to-left counter-drifting aurora lobe */}
          <div
            className={
              prefersReduced
                ? "absolute -inset-x-6 -bottom-3 h-full"
                : "lumen-aurora-blob-b absolute -inset-x-6 -bottom-3 h-full"
            }
            style={{
              background: `radial-gradient(60% 90% at 70% 95%, ${colorB}, transparent 72%)`,
              filter: "blur(9px)",
              animationPlayState: playState,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

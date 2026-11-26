import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { MOTION_PRESETS } from "../design/motion";
import { COLOR_TOKENS } from "../design/tokens";
import type { LumiMood } from "./ActionGlowLayer";

export interface LumenMascotProps {
  enabled?: boolean;
  musicPlaying?: boolean;
  celebrating?: boolean;
  mood?: LumiMood;
  size?: "compact" | "hero";
  accentColor?: string;
}

/**
 * Expressive original vector companion ("Lumi") with luminous mood eyes and a waving hand
 * during actions, greetings, and celebrations (zero copied assets).
 */
export function LumenMascot({
  enabled = true,
  musicPlaying = false,
  celebrating = false,
  mood,
  size = "compact",
  accentColor = COLOR_TOKENS.accentCyan,
}: LumenMascotProps) {
  const prefersReduced = useReducedMotion() ?? false;
  const glowFilterId = useId();

  if (!enabled) {
    return null;
  }

  const resolvedMood: LumiMood =
    mood ?? (celebrating ? "celebrate" : musicPlaying ? "music" : "idle");

  if (size === "hero") {
    const happyEyes =
      resolvedMood === "wave" ||
      resolvedMood === "celebrate" ||
      resolvedMood === "confirm" ||
      resolvedMood === "music";
    const showHand = resolvedMood === "wave" || resolvedMood === "celebrate";
    const isSleep = resolvedMood === "sleep";

    return (
      <motion.div
        data-testid="lumen-mascot"
        data-mood={resolvedMood}
        data-size="hero"
        aria-hidden="true"
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.9 }}
        animate={
          prefersReduced
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: resolvedMood === "celebrate" || resolvedMood === "music" ? [0, -1.5, 0] : 0,
                scale: 1,
              }
        }
        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.92 }}
        transition={
          resolvedMood === "celebrate" || resolvedMood === "music"
            ? { duration: 0.75, repeat: Infinity, ease: "easeInOut" }
            : prefersReduced
              ? MOTION_PRESETS.reducedMotionFade
              : MOTION_PRESETS.lumiEnter
        }
        className="relative z-10 flex items-center justify-center"
      >
        <svg width="64" height="24" viewBox="0 0 64 24" fill="none">
          <defs>
            <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="1.6"
                floodColor={accentColor}
                floodOpacity="0.8"
              />
            </filter>
          </defs>

          {/* Expressive luminous eyes */}
          <g filter={`url(#${glowFilterId})`}>
            {happyEyes ? (
              <>
                <path
                  d="M17.5 14.8 Q21 9.4 24.5 14.8"
                  stroke={COLOR_TOKENS.textPrimary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M31.5 14.8 Q35 9.4 38.5 14.8"
                  stroke={COLOR_TOKENS.textPrimary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : isSleep ? (
              <>
                <path
                  d="M17.5 12.2 Q21 15.2 24.5 12.2"
                  stroke={COLOR_TOKENS.textSecondary}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M31.5 12.2 Q35 15.2 38.5 12.2"
                  stroke={COLOR_TOKENS.textSecondary}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : (
              <motion.g
                style={{ transformOrigin: "28px 12px" }}
                animate={prefersReduced ? undefined : { scaleY: [1, 1, 1, 0.14, 1, 1] }}
                transition={{
                  duration: 3.4,
                  repeat: Infinity,
                  times: [0, 0.82, 0.88, 0.92, 0.96, 1],
                }}
              >
                <rect
                  x="18.5"
                  y="9"
                  width="4.4"
                  height="6.8"
                  rx="2.2"
                  fill={COLOR_TOKENS.textPrimary}
                />
                <rect
                  x="33.1"
                  y="9"
                  width="4.4"
                  height="6.8"
                  rx="2.2"
                  fill={COLOR_TOKENS.textPrimary}
                />
              </motion.g>
            )}
          </g>

          {/* Animated waving hand beside right eye */}
          {showHand && (
            <motion.g
              style={{ transformOrigin: "47px 19px" }}
              animate={prefersReduced ? undefined : { rotate: [-14, 20, -10, 16, -6, 0] }}
              transition={{
                duration: 1.15,
                repeat: Infinity,
                repeatDelay: 0.25,
                ease: "easeInOut",
              }}
            >
              {/* Minimalist friendly open hand silhouette */}
              <path
                d="M44.6 18.4c-.6-.7-.8-1.8-.3-2.5.4-.5 1-.3 1.4.4l.6 1V13.2c0-.5.4-.9.9-.9s.9.4.9.9v2.9h.5V12c0-.5.4-.9.9-.9s.9.4.9.9v4.1h.5v-3.5c0-.5.4-.9.9-.9s.9.4.9.9v3.9h.5v-2.4c0-.5.4-.8.8-.8s.8.3.8.8v4c0 1.8-1.3 3-3 3h-1.8c-1.1 0-2-.5-2.6-1.3l-1-1.4z"
                fill={COLOR_TOKENS.textPrimary}
              />
            </motion.g>
          )}
        </svg>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-testid="lumen-mascot"
      data-mood={resolvedMood}
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center"
      animate={
        prefersReduced || (!musicPlaying && !celebrating)
          ? undefined
          : celebrating
            ? { y: [0, -2, 0] }
            : { y: [0, -1.5, 0] }
      }
      transition={{
        duration: celebrating ? 0.8 : 0.7,
        repeat: musicPlaying || celebrating ? Infinity : 0,
        ease: "easeInOut",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.5C15.8 6.8 18.5 9.8 18.5 14A6.5 6.5 0 1 1 5.5 14C5.5 9.8 8.2 6.8 12 2.5Z"
          fill="#1C1C1E"
          stroke={accentColor}
          strokeWidth="1.6"
        />
        <circle
          cx="9.6"
          cy="14.2"
          r="1.15"
          fill={celebrating ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.textPrimary}
        />
        <circle
          cx="14.4"
          cy="14.2"
          r="1.15"
          fill={celebrating ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.textPrimary}
        />
        <path
          d={
            celebrating
              ? "M9.8 17.1C10.9 18.2 13.1 18.2 14.2 17.1"
              : "M10.4 17.2C11.3 17.7 12.7 17.7 13.6 17.2"
          }
          stroke={accentColor}
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        {celebrating && (
          <>
            <circle cx="4.5" cy="6.5" r="1.1" fill={COLOR_TOKENS.accentOrange} />
            <circle cx="19.5" cy="6.5" r="1.1" fill={COLOR_TOKENS.accentGreen} />
          </>
        )}
      </svg>
    </motion.div>
  );
}

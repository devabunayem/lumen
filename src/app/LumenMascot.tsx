import { motion, useReducedMotion } from "motion/react";

export interface LumenMascotProps {
  enabled?: boolean;
  musicPlaying?: boolean;
  celebrating?: boolean;
  accentColor?: string;
}

/**
 * Original <5 KB vector mascot ("Lumi") for the Lumen notch (SRS Section 3.8).
 * Blinks calmly while idle, bobs lightly with active music, and sparkles on goals.
 */
export function LumenMascot({
  enabled = true,
  musicPlaying = false,
  celebrating = false,
  accentColor = "var(--accent-cyan)",
}: LumenMascotProps) {
  const prefersReduced = useReducedMotion() ?? false;

  if (!enabled) {
    return null;
  }

  return (
    <motion.div
      data-testid="lumen-mascot"
      data-mood={celebrating ? "celebrate" : musicPlaying ? "music" : "idle"}
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center"
      animate={
        prefersReduced
          ? undefined
          : celebrating
            ? { y: [0, -3, 0], scale: [1, 1.12, 1] }
            : musicPlaying
              ? { y: [0, -1.5, 0] }
              : { scaleY: [1, 1, 0.92, 1] }
      }
      transition={{
        duration: celebrating ? 0.8 : musicPlaying ? 0.7 : 3.6,
        repeat: Infinity,
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
          fill={celebrating ? "var(--accent-green)" : "#FFFFFF"}
        />
        <circle
          cx="14.4"
          cy="14.2"
          r="1.15"
          fill={celebrating ? "var(--accent-green)" : "#FFFFFF"}
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
            <circle cx="4.5" cy="6.5" r="1.1" fill="var(--accent-orange)" />
            <circle cx="19.5" cy="6.5" r="1.1" fill="var(--accent-green)" />
          </>
        )}
      </svg>
    </motion.div>
  );
}

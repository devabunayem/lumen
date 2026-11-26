import { motion, useReducedMotion } from "motion/react";

export interface LiveWaveformProps {
  playing: boolean;
  accentColor?: string;
  audioPeak?: number;
}

const BAR_HEIGHTS = [0.45, 0.9, 0.65, 0.35] as const;

/**
 * Compact 4-bar audio waveform driven by real WASAPI peak levels when live (FR-MUS-5).
 */
export function LiveWaveform({
  playing,
  accentColor = "var(--accent-blue)",
  audioPeak = 0,
}: LiveWaveformProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const hasLivePeak = playing && audioPeak > 0.01;

  return (
    <div className="flex h-3.5 items-center gap-0.5" aria-hidden="true">
      {BAR_HEIGHTS.map((peak, index) => {
        const liveScale = Math.max(0.24, Math.min(1, audioPeak * (0.55 + peak * 0.68)));
        return (
          <motion.span
            key={index}
            className="w-0.5 rounded-full"
            style={{ backgroundColor: accentColor, height: "14px", originY: 0.5 }}
            animate={
              !playing
                ? { scaleY: 0.25 }
                : prefersReducedMotion
                  ? { scaleY: peak }
                  : hasLivePeak
                    ? { scaleY: liveScale }
                    : { scaleY: [0.3, peak, 0.4, 1, 0.35] }
            }
            transition={
              !playing || prefersReducedMotion
                ? { duration: 0.15 }
                : hasLivePeak
                  ? { duration: 0.05, ease: "linear" }
                  : {
                      duration: 0.9 + index * 0.14,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
            }
          />
        );
      })}
    </div>
  );
}

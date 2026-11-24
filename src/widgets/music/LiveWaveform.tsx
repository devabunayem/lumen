import { motion, useReducedMotion } from "motion/react";

export interface LiveWaveformProps {
  playing: boolean;
  accentColor?: string;
}

const BAR_HEIGHTS = [0.45, 0.9, 0.65, 0.35] as const;

/**
 * Compact 4-bar audio waveform for collapsed Live Activity & header status ring (FR-MUS-5).
 */
export function LiveWaveform({ playing, accentColor = "var(--accent-blue)" }: LiveWaveformProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div className="flex h-3.5 items-center gap-0.5" aria-hidden="true">
      {BAR_HEIGHTS.map((peak, index) => (
        <motion.span
          key={index}
          className="w-0.5 rounded-full"
          style={{ backgroundColor: accentColor, height: "14px", originY: 0.5 }}
          animate={
            playing && !prefersReducedMotion
              ? { scaleY: [0.3, peak, 0.4, 1, 0.35] }
              : { scaleY: playing ? peak : 0.25 }
          }
          transition={
            playing && !prefersReducedMotion
              ? {
                  duration: 0.9 + index * 0.14,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
              : { duration: 0.15 }
          }
        />
      ))}
    </div>
  );
}

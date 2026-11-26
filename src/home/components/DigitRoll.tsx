import { AnimatePresence, motion } from "motion/react";
import { CONTENT_STAGGER } from "../../design/motion";
import { formatDigits } from "../../i18n/digits";

export interface DigitRollProps {
  value: string | number;
  banglaDigits?: boolean;
  reduceMotion?: boolean;
  className?: string;
}

/**
 * Tabular numeral roll animation (12 px vertical travel, 220 ms) using transform & opacity only.
 */
export function DigitRoll({
  value,
  banglaDigits = false,
  reduceMotion = false,
  className = "",
}: DigitRollProps) {
  const formatted = formatDigits(value, banglaDigits);

  if (reduceMotion) {
    return <span className={`tabular-nums inline-block ${className}`}>{formatted}</span>;
  }

  return (
    <span
      className={`relative inline-flex overflow-hidden tabular-nums align-baseline ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={formatted}
          initial={{ y: CONTENT_STAGGER.digitRollOffsetPx, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -CONTENT_STAGGER.digitRollOffsetPx, opacity: 0 }}
          transition={{
            duration: CONTENT_STAGGER.digitRollMs / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block will-change-transform"
        >
          {formatted}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

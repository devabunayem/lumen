import { formatDigits } from "../../i18n/digits";

export interface DigitRollProps {
  value: string | number;
  banglaDigits?: boolean;
  reduceMotion?: boolean;
  className?: string;
}

/**
 * Tabular numeral readout locked to single-line intrinsic metrics so ticks never cause layout jitter.
 */
export function DigitRoll({ value, banglaDigits = false, className = "" }: DigitRollProps) {
  const formatted = formatDigits(value, banglaDigits);

  return (
    <span className={`tabular-nums inline-block whitespace-nowrap ${className}`}>{formatted}</span>
  );
}

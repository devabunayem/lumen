import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BellIcon, DropletIcon } from "../../design/icons";
import { getMotionTransition } from "../../design/motion";
import type { WaterSummary } from "../../lib/ipc";

export interface WaterWidgetProps {
  summary: WaterSummary | null;
  servingMl: number;
  remindersEnabled: boolean;
  onDrink: (ml: number) => void;
  onUndo: (entryId: number) => void;
  onToggleReminders: () => void;
  onChangeGoal: (goalMl: number) => void;
}

function formatWaterAmount(ml: number): { value: string; unit: string } {
  if (ml < 1000) {
    return { value: String(ml), unit: "ml" };
  }
  const liters = Number((ml / 1000).toFixed(2));
  return { value: String(liters), unit: "L" };
}

export function WaterWidget({
  summary,
  servingMl,
  remindersEnabled,
  onDrink,
  onUndo,
  onToggleReminders,
  onChangeGoal,
}: WaterWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [undoEntryId, setUndoEntryId] = useState<number | null>(null);
  const [showGoalSettings, setShowGoalSettings] = useState(false);
  const [showServingPicker, setShowServingPicker] = useState(false);
  const [activeServing, setActiveServing] = useState(servingMl);
  const longPressRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const todayMl = summary?.today_ml ?? 0;
  const goalMl = summary?.goal_ml ?? 1500;
  const pct = Math.round(summary?.percentage ?? 0);
  const clampedGaugePct = Math.min(100, Math.max(0, pct));
  const goalReached = Boolean(summary?.goal_reached);

  useEffect(() => {
    if (!undoEntryId) {
      return;
    }
    const timer = window.setTimeout(() => setUndoEntryId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoEntryId]);

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedGaugePct / 100);
  const formatted = formatWaterAmount(todayMl);
  const formattedGoal = Number((goalMl / 1000).toFixed(1));

  const triggerDrink = (ml: number) => {
    onDrink(ml);
    if (summary?.last_entry_id) {
      setUndoEntryId(summary.last_entry_id);
    }
  };

  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-between gap-3 overflow-hidden">
      {/* Left block: amount, progress, Drink / Undo / Settings capsules */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="type-display tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatted.value}
            <span className="type-body ml-1" style={{ color: "var(--text-secondary)" }}>
              {formatted.unit}
            </span>
          </span>
          <span className="type-caption tabular-nums" style={{ color: "var(--text-secondary)" }}>
            / {formattedGoal} L
          </span>
          {goalReached && (
            <span className="type-caption font-semibold" style={{ color: "var(--accent-green)" }}>
              Goal reached
            </span>
          )}
        </div>

        {/* Thin progress bar */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--surface-button)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--accent-blue)" }}
            initial={false}
            animate={{ width: `${clampedGaugePct}%` }}
            transition={getMotionTransition("progressSpring", prefersReducedMotion)}
          />
        </div>

        {showGoalSettings ? (
          <div className="flex items-center gap-1.5">
            {[1500, 2000, 2500, 3000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  onChangeGoal(preset);
                  setShowGoalSettings(false);
                }}
                className="type-caption cursor-pointer rounded-full border-0 px-2.5"
                style={{
                  height: "var(--capsule-height)",
                  backgroundColor:
                    goalMl === preset ? "var(--accent-blue)" : "var(--surface-button)",
                  color: "var(--text-primary)",
                }}
              >
                {(preset / 1000).toFixed(1)}L
              </button>
            ))}
          </div>
        ) : showServingPicker ? (
          <div className="flex items-center gap-1.5">
            {[150, 250, 500].map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => {
                  setActiveServing(ml);
                  setShowServingPicker(false);
                  triggerDrink(ml);
                }}
                className="type-caption cursor-pointer rounded-full border-0 px-3 font-medium"
                style={{
                  height: "var(--capsule-height)",
                  backgroundColor:
                    activeServing === ml ? "var(--accent-blue)" : "var(--surface-button)",
                  color: "var(--text-primary)",
                }}
              >
                +{ml} ml
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Tap to log · Hold or right-click for sizes"
              onPointerDown={() => {
                longPressedRef.current = false;
                clearLongPress();
                longPressRef.current = window.setTimeout(() => {
                  longPressedRef.current = true;
                  setShowServingPicker(true);
                }, 420);
              }}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowServingPicker(true);
              }}
              onClick={() => {
                if (longPressedRef.current) {
                  longPressedRef.current = false;
                  return;
                }
                triggerDrink(activeServing);
              }}
              className="type-caption cursor-pointer rounded-full border-0 px-3.5 font-semibold"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "var(--accent-blue)",
                color: "var(--text-primary)",
              }}
            >
              Drink +{activeServing} ml
            </button>

            {undoEntryId !== null && (
              <button
                type="button"
                onClick={() => {
                  onUndo(undoEntryId);
                  setUndoEntryId(null);
                }}
                className="type-caption cursor-pointer rounded-full border-0 px-3"
                style={{
                  height: "var(--capsule-height)",
                  backgroundColor: "var(--surface-button)",
                  color: "var(--text-primary)",
                }}
              >
                Undo
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowGoalSettings(true)}
              className="type-caption cursor-pointer rounded-full border-0 px-3"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "var(--surface-button)",
                color: "var(--text-secondary)",
              }}
            >
              Goal
            </button>

            <button
              type="button"
              aria-label="Toggle hydration reminders"
              aria-pressed={remindersEnabled}
              onClick={onToggleReminders}
              className="type-caption flex w-8 cursor-pointer items-center justify-center rounded-full bg-transparent transition-colors"
              style={{
                height: "var(--capsule-height)",
                border: remindersEnabled
                  ? "1px solid var(--accent-blue)"
                  : "1px solid var(--hairline-strong)",
                color: remindersEnabled ? "var(--accent-blue)" : "var(--text-secondary)",
              }}
            >
              <BellIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Right block: free-floating tappable circular gauge (no heavy box) */}
      <motion.button
        type="button"
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        aria-label={`Log +${activeServing} ml water`}
        title={`Tap to add +${activeServing} ml`}
        onClick={() => triggerDrink(activeServing)}
        className="relative flex h-[84px] w-[84px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      >
        <svg
          width="78"
          height="78"
          viewBox="0 0 82 82"
          aria-hidden="true"
          style={{
            filter:
              pct === 0
                ? "drop-shadow(0 0 6px rgba(10, 132, 255, 0.24))"
                : "drop-shadow(0 0 8px rgba(10, 132, 255, 0.35))",
          }}
        >
          <circle
            cx="41"
            cy="41"
            r={radius}
            fill="none"
            stroke="rgba(10, 132, 255, 0.16)"
            strokeWidth="6"
          />
          <circle
            cx="41"
            cy="41"
            r={radius}
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 41 41)"
          />
        </svg>
        <div className="absolute flex flex-col items-center gap-0.5">
          <span style={{ color: "var(--accent-blue)" }}>
            <DropletIcon size={13} />
          </span>
          <span
            className="type-caption font-semibold tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {pct}%
          </span>
        </div>
      </motion.button>
    </div>
  );
}

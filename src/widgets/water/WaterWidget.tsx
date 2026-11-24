import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
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

  return (
    <div className="flex h-full w-full items-center justify-between gap-3">
      {/* Left block: amount, progress, Drink / Undo / Settings capsules (FR-WT-1, FR-WT-3) */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="type-display tabular-nums" style={{ color: "var(--text-primary)" }}>
            {(todayMl / 1000).toFixed(2)}
            <span className="type-body ml-0.5" style={{ color: "var(--text-secondary)" }}>
              L
            </span>
          </span>
          <span className="type-caption tabular-nums" style={{ color: "var(--text-secondary)" }}>
            / {(goalMl / 1000).toFixed(1)} L · {pct}%
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
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onDrink(servingMl);
                if (summary?.last_entry_id) {
                  setUndoEntryId(summary.last_entry_id);
                }
              }}
              className="type-caption cursor-pointer rounded-full border-0 px-3.5 font-semibold"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "var(--accent-blue)",
                color: "var(--text-primary)",
              }}
            >
              Drink +{servingMl} ml
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
              Settings
            </button>

            <button
              type="button"
              aria-label="Toggle hydration reminders"
              aria-pressed={remindersEnabled}
              onClick={onToggleReminders}
              className="type-caption cursor-pointer rounded-full border-0 px-2.5"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: remindersEnabled ? "var(--accent-cyan)" : "var(--surface-button)",
                color: remindersEnabled ? "var(--surface)" : "var(--text-secondary)",
              }}
            >
              🔔
            </button>
          </div>
        )}
      </div>

      {/* Right block: circular gradient gauge with percentage & droplet (FR-WT-2) */}
      <div
        className="relative flex h-24 w-24 shrink-0 items-center justify-center"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true">
          <defs>
            <linearGradient id="waterGaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent-cyan)" />
              <stop offset="100%" stopColor="var(--accent-blue)" />
            </linearGradient>
          </defs>
          <circle
            cx="41"
            cy="41"
            r={radius}
            fill="none"
            stroke="var(--surface-button)"
            strokeWidth="6"
          />
          <circle
            cx="41"
            cy="41"
            r={radius}
            fill="none"
            stroke="url(#waterGaugeGrad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 41 41)"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-xs" aria-hidden="true">
            💧
          </span>
          <span
            className="type-caption font-bold tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {pct}%
          </span>
        </div>
      </div>
    </div>
  );
}

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

  // Open 270-degree arc gauge math
  const r = 32;
  const c = 2 * Math.PI * r;
  const arcLen = c * 0.75; // 270 deg
  const filledArc = arcLen * (clampedGaugePct / 100);
  const dotAngleDeg = 135 + (clampedGaugePct / 100) * 270;
  const dotAngleRad = (dotAngleDeg * Math.PI) / 180;
  const dotX = 41 + r * Math.cos(dotAngleRad);
  const dotY = 41 + r * Math.sin(dotAngleRad);

  return (
    <div className="flex h-full w-full items-stretch justify-between gap-3 overflow-hidden px-0.5">
      {/* Left block: 0.0 / 1.5 L + bell toggle, Today · 0%, progress bar, Drink + Settings */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[24px] font-bold leading-none tracking-tight tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {(todayMl / 1000).toFixed(1)}
            </span>
            <span className="type-caption tabular-nums" style={{ color: "var(--text-secondary)" }}>
              / {(goalMl / 1000).toFixed(1)} L
            </span>
          </div>

          {/* iOS-style Bell Toggle Switch */}
          <button
            type="button"
            aria-label="Toggle hydration reminders"
            aria-pressed={remindersEnabled}
            onClick={onToggleReminders}
            className="relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0 p-0.5 transition-colors"
            style={{
              backgroundColor: remindersEnabled ? "var(--accent-blue)" : "var(--surface-button)",
            }}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white transition-transform"
              style={{
                transform: remindersEnabled ? "translateX(20px)" : "translateX(0px)",
                color: remindersEnabled ? "var(--accent-blue)" : "var(--surface)",
              }}
            >
              <BellIcon size={11} />
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] tabular-nums">
          <span style={{ color: "var(--text-secondary)" }}>
            Today · <span style={{ color: "var(--accent-blue)" }}>{pct}%</span>
          </span>
          {goalReached && (
            <span className="font-semibold" style={{ color: "var(--accent-green)" }}>
              Goal reached
            </span>
          )}
        </div>

        {/* Thin progress bar */}
        <div
          className="h-1 w-full overflow-hidden rounded-full"
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
              aria-label={`Drink +${activeServing} ml`}
              title={`Tap +${activeServing} ml · Hold for sizes`}
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
              className="type-caption flex cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 font-semibold transition-transform active:scale-95"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "rgba(10, 132, 255, 0.24)",
                border: "1px solid rgba(10, 132, 255, 0.45)",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ color: "var(--accent-cyan)" }}>
                <DropletIcon size={12} />
              </span>
              <span>Drink</span>
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
          </div>
        )}
      </div>

      {/* Subtle vertical divider */}
      <div className="my-1 w-px self-stretch bg-white/10" />

      {/* Right block: Free-floating 270° open-arc gauge with glowing dot */}
      <motion.button
        type="button"
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        aria-label={`Log +${activeServing} ml water`}
        title={`Tap to add +${activeServing} ml`}
        onClick={() => triggerDrink(activeServing)}
        className="relative flex w-[34%] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      >
        <svg width="70" height="70" viewBox="0 0 82 82" aria-hidden="true">
          <circle
            cx="41"
            cy="41"
            r={r}
            fill="none"
            stroke="rgba(10, 132, 255, 0.18)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${c}`}
            transform="rotate(135 41 41)"
          />
          {clampedGaugePct > 0 && (
            <circle
              cx="41"
              cy="41"
              r={r}
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={`${filledArc} ${c}`}
              transform="rotate(135 41 41)"
            />
          )}
          <circle cx={dotX} cy={dotY} r="3.8" fill="var(--accent-cyan)" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className="text-[22px] font-bold leading-none tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {pct}
          </span>
          <span className="mt-0.5 flex items-center gap-0.5 text-[10px]">
            <span style={{ color: "var(--accent-cyan)" }}>
              <DropletIcon size={9} />
            </span>
            <span style={{ color: "var(--text-secondary)" }}>%</span>
          </span>
        </div>
      </motion.button>
    </div>
  );
}

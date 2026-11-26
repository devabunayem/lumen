import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BellIcon, ClockLedgerIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import { playUiSound } from "../design/sounds";
import type { ReminderAlertPayload } from "../lib/ipc";

export interface ReminderAlertOverlayProps {
  alert: ReminderAlertPayload;
  snoozeMinutes: number;
  language: "en" | "bn";
  onStop: (id: number, stage: string) => void;
  onSnooze: (id: number) => void;
}

function formatTargetClock(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) {
    return "";
  }
  const d = new Date(ts);
  const h24 = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins} ${suffix}`;
}

/**
 * Medium-sized notch alert overlay for scheduled reminders with medium repeating alarm pulse,
 * "OK / Got it" (stop) action, and configurable "Snooze" action.
 */
export function ReminderAlertOverlay({
  alert,
  snoozeMinutes,
  language,
  onStop,
  onSnooze,
}: ReminderAlertOverlayProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isBn = language === "bn";
  const { reminder, stage, is_exact_due } = alert;
  const clockStr = formatTargetClock(reminder.target_at);

  useEffect(() => {
    let pulses = 0;
    const interval = window.setInterval(() => {
      pulses += 1;
      if (pulses >= 4) {
        window.clearInterval(interval);
        return;
      }
      void playUiSound("reminder_alarm");
    }, 4500);
    return () => window.clearInterval(interval);
  }, [reminder.id, stage]);

  const stageLabel = is_exact_due
    ? isBn
      ? "এখনই সময়"
      : "Due now · Exact time"
    : stage === "snooze"
      ? isBn
        ? "স্নুজ রিমাইন্ডার"
        : "Snoozed reminder"
      : isBn
        ? `${reminder.lead_minutes} মি. বাকি`
        : `In ${reminder.lead_minutes} min`;

  const accentColor = is_exact_due ? "var(--accent-red)" : "var(--accent-orange)";

  return (
    <motion.div
      data-testid="reminder-alert-overlay"
      role="alertdialog"
      aria-label={reminder.title}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={getMotionTransition("collapse", prefersReducedMotion)}
      onClick={(e) => e.stopPropagation()}
      className="flex h-full w-full flex-col justify-between px-4 py-2.5"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "rgba(255, 159, 10, 0.16)",
              border: `1px solid ${accentColor}`,
              color: accentColor,
            }}
          >
            <BellIcon size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: accentColor }}
              >
                {stageLabel}
              </span>
              {clockStr && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ClockLedgerIcon size={10} />
                  {clockStr}
                </span>
              )}
            </div>
            <div
              className="truncate text-[14px] font-semibold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {reminder.title}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="reminder-snooze-btn"
          onClick={() => {
            void playUiSound("toggle_off");
            onSnooze(reminder.id);
          }}
          className="type-caption cursor-pointer rounded-full border-0 px-3.5 py-1.5 font-semibold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
          style={{
            backgroundColor: "var(--surface-button)",
            color: "var(--accent-orange)",
          }}
        >
          {isBn ? `স্নুজ (${snoozeMinutes}মি)` : `Snooze (${snoozeMinutes}m)`}
        </button>

        <button
          type="button"
          data-testid="reminder-stop-btn"
          onClick={() => {
            void playUiSound("task_done");
            onStop(reminder.id, stage);
          }}
          className="type-caption cursor-pointer rounded-full border-0 px-4 py-1.5 font-semibold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
          style={{
            backgroundColor: "var(--text-primary)",
            color: "#000000",
          }}
        >
          {isBn ? "ঠিক আছে, মনে পড়েছে" : "OK, Got it"}
        </button>
      </div>
    </motion.div>
  );
}

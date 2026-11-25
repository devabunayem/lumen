import { motion, useReducedMotion } from "motion/react";
import { getMotionTransition } from "../../design/motion";
import type { PomodoroSnapshot } from "../../lib/ipc";

export interface PomodoroWidgetProps {
  pomodoro: PomodoroSnapshot | null;
  onToggle: () => void;
  onSkip: () => void;
  onReset: () => void;
}

function formatTimer(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function PomodoroWidget({ pomodoro, onToggle, onSkip, onReset }: PomodoroWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const snap: PomodoroSnapshot = pomodoro ?? {
    phase: "focus",
    remaining_secs: 25 * 60,
    total_secs: 25 * 60,
    running: false,
    cycle_index: 0,
    cycles_before_long: 4,
    daily_focus_minutes: 0,
    chime_tick: 0,
  };

  const progressPct =
    snap.total_secs > 0
      ? Math.min(
          100,
          Math.max(0, ((snap.total_secs - snap.remaining_secs) / snap.total_secs) * 100),
        )
      : 0;
  const currentRound = Math.min(snap.cycles_before_long, snap.cycle_index + 1);
  const totalMins = Math.round(snap.total_secs / 60);
  const phaseWord =
    snap.phase === "focus" ? "Focus" : snap.phase === "short_break" ? "Break" : "Long Break";

  return (
    <div className="flex h-full w-full items-stretch justify-between gap-3 overflow-hidden px-0.5">
      {/* Left block: round label, big bold timer, status & progress bar */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <span className="type-caption font-medium" style={{ color: "var(--text-secondary)" }}>
          {phaseWord} · {currentRound} of {snap.cycles_before_long}
        </span>

        <span
          className="text-[24px] font-bold leading-none tracking-tight tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {formatTimer(snap.remaining_secs)}
        </span>

        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          <span style={{ color: "var(--text-primary)" }}>{totalMins} min</span>
          <span style={{ color: "var(--accent-purple)" }}>{snap.running ? "Live" : "Ready"}</span>
        </div>

        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--surface-button)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--accent-purple)" }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={getMotionTransition("progressSpring", prefersReducedMotion)}
          />
        </div>
      </div>

      {/* Subtle vertical divider */}
      <div className="my-1 w-px self-stretch bg-white/10" />

      {/* Right block: This round + Start/Reset/Skip + 4-round segmented timeline */}
      <div className="flex w-[50%] flex-col justify-between py-0.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            This round
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggle}
              className="type-caption cursor-pointer rounded-full border-0 px-2.5 font-semibold text-white transition-transform active:scale-95"
              style={{
                height: "26px",
                backgroundColor: "var(--accent-purple)",
              }}
            >
              {snap.running ? "Pause" : "Start"}
            </button>

            <button
              type="button"
              aria-label="Reset"
              title="Reset timer"
              onClick={onReset}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 transition-transform active:scale-95"
              style={{
                backgroundColor: "var(--surface-button)",
                color: "var(--text-secondary)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Skip"
              title="Skip phase"
              onClick={onSkip}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 transition-transform active:scale-95"
              style={{
                backgroundColor: "var(--surface-button)",
                color: "var(--text-secondary)",
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="5 4 15 12 5 20 5 4" />
                <rect x="17" y="4" width="2.5" height="16" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Segmented round timeline: 1 · 2 · 3 · 4 · Long */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((idx) => {
              const filled = idx < snap.cycle_index;
              const active = idx === snap.cycle_index && snap.phase === "focus";
              return (
                <div key={idx} className="flex flex-1 items-center gap-1">
                  <div
                    className="h-1.5 flex-1 rounded-full"
                    style={{
                      backgroundColor: filled
                        ? "var(--accent-purple)"
                        : active
                          ? "rgba(191, 90, 242, 0.45)"
                          : "var(--surface-button)",
                    }}
                  />
                  <span className="h-1 w-1 shrink-0 rounded-full bg-white/25" />
                </div>
              );
            })}
            <div
              className="h-1.5 w-6 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  snap.phase === "long_break" ? "var(--accent-purple)" : "var(--surface-button)",
              }}
            />
          </div>

          <div className="flex items-center justify-between px-2 text-[10px] tabular-nums">
            {[1, 2, 3, 4].map((num) => (
              <span
                key={num}
                style={{
                  color: num === currentRound ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontWeight: num === currentRound ? 600 : 400,
                }}
              >
                {num}
              </span>
            ))}
            <span
              style={{
                color: snap.phase === "long_break" ? "var(--text-primary)" : "var(--text-tertiary)",
              }}
            >
              Long
            </span>
          </div>
        </div>

        <div className="text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {snap.daily_focus_minutes} min focused today
        </div>
      </div>
    </div>
  );
}

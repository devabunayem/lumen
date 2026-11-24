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

function phaseLabel(phase: PomodoroSnapshot["phase"]): string {
  switch (phase) {
    case "focus":
      return "Focus Session";
    case "short_break":
      return "Short Break";
    case "long_break":
      return "Long Break";
  }
}

export function PomodoroWidget({ pomodoro, onToggle, onSkip, onReset }: PomodoroWidgetProps) {
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

  const ratio = snap.total_secs > 0 ? snap.remaining_secs / snap.total_secs : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, ratio)));

  return (
    <div className="flex h-full w-full items-center justify-between gap-3">
      {/* Left block: big timer, session dots & controls (FR-PO-1..3) */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="flex items-center justify-between">
          <span className="type-caption font-semibold" style={{ color: "var(--accent-orange)" }}>
            {phaseLabel(snap.phase)}
          </span>
          <span className="type-caption tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {snap.daily_focus_minutes} min focused today
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="type-display tabular-nums" style={{ color: "var(--text-primary)" }}>
            {formatTimer(snap.remaining_secs)}
          </span>

          <div className="flex items-center gap-1.5" aria-label="Pomodoro session dots">
            {Array.from({ length: snap.cycles_before_long }).map((_, idx) => (
              <span
                key={idx}
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    idx < snap.cycle_index ? "var(--accent-orange)" : "var(--surface-button)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="type-caption cursor-pointer rounded-full border-0 px-4 font-semibold"
            style={{
              height: "var(--capsule-height)",
              backgroundColor: "var(--accent-orange)",
              color: "var(--surface)",
            }}
          >
            {snap.running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="type-caption cursor-pointer rounded-full border-0 px-3"
            style={{
              height: "var(--capsule-height)",
              backgroundColor: "var(--surface-button)",
              color: "var(--text-primary)",
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onReset}
            className="type-caption cursor-pointer rounded-full border-0 px-3"
            style={{
              height: "var(--capsule-height)",
              backgroundColor: "var(--surface-button)",
              color: "var(--text-secondary)",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Right ring */}
      <div
        className="relative flex h-24 w-24 shrink-0 items-center justify-center"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true">
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
            stroke="var(--accent-orange)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 41 41)"
          />
        </svg>
        <span
          className="type-caption absolute font-medium"
          style={{ color: "var(--accent-orange)" }}
        >
          {snap.running ? "Live" : "Ready"}
        </span>
      </div>
    </div>
  );
}

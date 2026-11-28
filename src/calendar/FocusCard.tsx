import { useState } from "react";
import { PauseIcon, PlayIcon, ShieldIcon } from "../design/icons";
import { COLOR_TOKENS } from "../design/tokens";
import { DigitRoll } from "../home/components/DigitRoll";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { FocusFlowState, PomodoroSnapshot } from "../lib/ipc";

export interface FocusCardProps {
  pomodoro: PomodoroSnapshot;
  focusFlow?: FocusFlowState | null;
  boundTaskTitle: string | null;
  socialBlockedArmed: boolean;
  dragOverFocus?: boolean;
  pausedForPrayer?: boolean;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  onToggleFocus: () => void;
  onSkipFocus?: () => void;
  onRespondPrayerPrompt?: (pause: boolean) => void;
  onDismissFreeFocusLog?: () => void;
  onLogFreeFocusTask?: (title: string) => void;
  onDragOverFocusChange?: (over: boolean) => void;
  onDropTaskOnFocus?: (taskId: number | null) => void;
}

export function FocusCard({
  pomodoro,
  focusFlow,
  boundTaskTitle,
  socialBlockedArmed,
  dragOverFocus,
  pausedForPrayer,
  language,
  banglaDigits,
  reduceMotion,
  onToggleFocus,
  onSkipFocus,
  onRespondPrayerPrompt,
  onDismissFreeFocusLog,
  onLogFreeFocusTask,
  onDragOverFocusChange,
  onDropTaskOnFocus,
}: FocusCardProps) {
  const msg = getMessages(language);
  const [freeTitle, setFreeTitle] = useState("");
  const effectivePausedPrayer = pausedForPrayer || Boolean(focusFlow?.pausedForPrayer);
  const effectiveTaskTitle = focusFlow?.boundTaskTitle ?? boundTaskTitle;
  const prayerPrompt = focusFlow?.prayerPrompt ?? null;
  const freePrompt = focusFlow?.freeFocusLogPrompt ?? null;
  const mins = Math.floor(pomodoro.remaining_secs / 60);
  const secs = pomodoro.remaining_secs % 60;
  const timeText = formatDigits(
    `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
    banglaDigits,
  );
  const total = Math.max(1, pomodoro.total_secs);
  const pct = Math.max(0, Math.min(1, pomodoro.remaining_secs / total));
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);
  const currentRound = Math.min(pomodoro.cycles_before_long, pomodoro.cycle_index + 1);
  const roundLabel = formatDigits(
    msg.calendarHub.roundOf
      .replace("{{current}}", String(currentRound))
      .replace("{{total}}", String(pomodoro.cycles_before_long)),
    banglaDigits,
  );

  return (
    <section
      data-testid="cal-focus-card"
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverFocusChange?.(true);
      }}
      onDragLeave={() => onDragOverFocusChange?.(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragOverFocusChange?.(false);
        const raw = e.dataTransfer?.getData("text/lumen-task-id");
        const parsedId = raw ? Number(raw) : null;
        onDropTaskOnFocus?.(Number.isFinite(parsedId) ? parsedId : null);
      }}
      className="cal-glass-card flex h-[149px] w-[200px] flex-col justify-between px-[14px] py-[12px]"
      style={{
        borderColor: dragOverFocus ? COLOR_TOKENS.calToday : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-1.5">
        <h3
          className="m-0 text-[13px] font-semibold tracking-tight"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {msg.calendarHub.focusTitle}
        </h3>

        {socialBlockedArmed && (
          <span
            data-testid="cal-social-blocked-chip"
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: COLOR_TOKENS.calSocialBg,
              border: `1px solid ${COLOR_TOKENS.calSocialBorder}`,
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            <span style={{ color: COLOR_TOKENS.calDeadline }}>
              <ShieldIcon size={10} />
            </span>
            <span className="truncate">{msg.calendarHub.socialBlocked}</span>
          </span>
        )}
      </div>

      {prayerPrompt ? (
        <div
          data-testid="cal-focus-prayer-prompt"
          className="flex flex-col gap-1.5 rounded-xl px-2 py-1.5"
          style={{
            backgroundColor: COLOR_TOKENS.calSocialBg,
            border: `1px solid ${COLOR_TOKENS.calReminder}`,
          }}
        >
          <span className="text-[11px] font-semibold" style={{ color: COLOR_TOKENS.textPrimary }}>
            {msg.calendarHub.prayerPromptAsk.replace("{{prayer}}", prayerPrompt.prayerName)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="cal-prayer-pause-btn"
              onClick={() => onRespondPrayerPrompt?.(true)}
              className="flex-1 cursor-pointer rounded-full py-0.5 text-[10.5px] font-semibold"
              style={{
                backgroundColor: COLOR_TOKENS.calCtaBg,
                color: COLOR_TOKENS.calCtaText,
              }}
            >
              {msg.calendarHub.pauseBtn}
            </button>
            <button
              type="button"
              data-testid="cal-prayer-continue-btn"
              onClick={() => onRespondPrayerPrompt?.(false)}
              className="flex-1 cursor-pointer rounded-full py-0.5 text-[10.5px] font-medium"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              {msg.calendarHub.continueBtn}
            </button>
          </div>
        </div>
      ) : freePrompt ? (
        <div
          data-testid="cal-free-focus-log-prompt"
          className="flex flex-col gap-1 rounded-xl px-2 py-1"
          style={{
            backgroundColor: COLOR_TOKENS.calPillBg,
            border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
          }}
        >
          <span
            className="truncate text-[10.5px] font-medium"
            style={{ color: COLOR_TOKENS.textPrimary }}
          >
            {msg.calendarHub.freeFocusPromptTitle}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              data-testid="cal-free-focus-input"
              value={freeTitle}
              onChange={(e) => setFreeTitle(e.target.value)}
              placeholder={freePrompt.suggestedTitle}
              className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[10px] outline-none"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            />
            <button
              type="button"
              data-testid="cal-free-focus-save-btn"
              onClick={() => {
                onLogFreeFocusTask?.(freeTitle.trim() || freePrompt.suggestedTitle);
                setFreeTitle("");
              }}
              className="cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: COLOR_TOKENS.calCtaBg,
                color: COLOR_TOKENS.calCtaText,
              }}
            >
              {msg.calendarHub.logAsTaskBtn}
            </button>
            <button
              type="button"
              data-testid="cal-free-focus-dismiss-btn"
              onClick={() => onDismissFreeFocusLog?.()}
              className="cursor-pointer border-0 bg-transparent px-1 text-[10px]"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              ×
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
            <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true">
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke={COLOR_TOKENS.calRingTrack}
                strokeWidth="4.5"
              />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke={COLOR_TOKENS.calToday}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 32 32)"
              />
            </svg>
            <span
              className="absolute text-[13.5px] font-semibold leading-none tabular-nums"
              style={{ color: COLOR_TOKENS.textPrimary }}
            >
              <DigitRoll value={timeText} reduceMotion={reduceMotion} />
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className="truncate text-[12px] font-semibold"
              style={{ color: COLOR_TOKENS.textPrimary }}
            >
              {effectivePausedPrayer
                ? msg.calendarHub.pausedForPrayer
                : (effectiveTaskTitle ?? msg.calendarHub.freeFocus)}
            </span>
            <span
              className="truncate text-[11px] font-normal tabular-nums"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {pomodoro.running && focusFlow?.lumiCompanionMode === "body_double_focus"
                ? `${roundLabel} · ${msg.calendarHub.lumiBodyDouble}`
                : roundLabel}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="cal-focus-cta"
          onClick={onToggleFocus}
          className="flex h-[28px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[11.5px] font-semibold transition-transform active:scale-[0.98]"
          style={{
            backgroundColor: COLOR_TOKENS.calCtaBg,
            color: COLOR_TOKENS.calCtaText,
          }}
        >
          {pomodoro.running ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
          <span>{pomodoro.running ? msg.calendarHub.pauseFocus : msg.calendarHub.startFocus}</span>
        </button>
        {pomodoro.running && onSkipFocus && (
          <button
            type="button"
            data-testid="cal-focus-skip"
            onClick={onSkipFocus}
            className="flex h-[28px] cursor-pointer items-center rounded-full px-2.5 text-[10.5px] font-medium"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
              color: COLOR_TOKENS.textSecondary,
            }}
          >
            {msg.calendarHub.skipBtn}
          </button>
        )}
      </div>
    </section>
  );
}

import type { KeyboardEvent } from "react";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages } from "../../i18n";
import { formatDigits, interpolateMsg } from "../../i18n/digits";
import type { CalendarEvent, PrayerSchedule, ReminderItem, TaskItem } from "../../lib/ipc";
import { formatNextCountdown, resolveNextCountdown } from "../hooks/useDayArcGeometry";
import { DigitRoll } from "./DigitRoll";

export interface NextCardProps {
  calendarEvents: CalendarEvent[];
  tasks: TaskItem[];
  reminders?: ReminderItem[];
  schedule: PrayerSchedule | null;
  nowDate: Date;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  onOpenAgenda: () => void;
}

export function NextCard({
  calendarEvents,
  tasks,
  reminders = [],
  schedule,
  nowDate,
  language,
  banglaDigits,
  reduceMotion,
  onOpenAgenda,
}: NextCardProps) {
  const msg = getMessages(language);
  const summary = resolveNextCountdown(
    calendarEvents,
    tasks,
    schedule,
    nowDate,
    language,
    msg.home.next.allClear,
    reminders,
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onOpenAgenda();
    }
  };

  return (
    <div
      data-testid="home-next-card"
      role="button"
      tabIndex={0}
      aria-label={`${msg.home.next.label} ${summary.title}`}
      onClick={onOpenAgenda}
      onKeyDown={handleKeyDown}
      className={`home-glass-card flex h-[94px] cursor-pointer flex-col justify-between overflow-hidden px-[12px] py-[10px] text-left ${
        reduceMotion ? "" : "transition-transform duration-100 active:scale-[0.96]"
      }`}
    >
      <div className="type-home-meta flex items-center gap-1.5 truncate">
        <span
          className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: summary.statusColor }}
        />
        <span className="truncate" style={{ color: COLOR_TOKENS.textSecondary }}>
          {msg.home.next.label} · <span className="text-white/90">{summary.title}</span>
        </span>
      </div>

      <div className="mt-auto">
        <div className="type-home-stat-lg whitespace-nowrap text-white">
          {summary.isAllClear || summary.minsUntil === null ? (
            <span>{msg.home.next.allClear}</span>
          ) : (
            <DigitRoll
              value={formatNextCountdown(summary.minsUntil, msg.home.next)}
              banglaDigits={banglaDigits}
              reduceMotion={reduceMotion}
            />
          )}
        </div>

        <div
          className="type-home-micro mt-0.5 truncate"
          style={{ color: COLOR_TOKENS.textSecondary }}
        >
          {summary.isAllClear
            ? msg.home.next.openAgenda
            : formatDigits(
                interpolateMsg(msg.home.next.tasksLeft, { count: summary.tasksLeft }),
                banglaDigits,
              )}
        </div>
      </div>
    </div>
  );
}

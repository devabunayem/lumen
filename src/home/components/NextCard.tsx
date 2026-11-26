import type { KeyboardEvent } from "react";
import { motion } from "motion/react";
import { MOTION_PRESETS } from "../../design/motion";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages } from "../../i18n";
import { formatDigits, interpolateMsg } from "../../i18n/digits";
import type { CalendarEvent, PrayerSchedule, TaskItem } from "../../lib/ipc";
import { resolveNextCountdown } from "../hooks/useDayArcGeometry";
import { DigitRoll } from "./DigitRoll";

export interface NextCardProps {
  calendarEvents: CalendarEvent[];
  tasks: TaskItem[];
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
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onOpenAgenda();
    }
  };

  return (
    <motion.div
      layoutId={reduceMotion ? undefined : "home-card-next"}
      data-testid="home-next-card"
      role="button"
      tabIndex={0}
      aria-label={`${msg.home.next.label} ${summary.title}`}
      onClick={onOpenAgenda}
      onKeyDown={handleKeyDown}
      whileTap={
        reduceMotion ? undefined : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
      }
      className="home-glass-card flex h-[116px] cursor-pointer flex-col justify-between px-[14px] py-[12px] text-left"
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
        <div className="type-home-stat-lg text-white">
          {summary.isAllClear || summary.minsUntil === null ? (
            <span>{msg.home.next.allClear}</span>
          ) : (
            <DigitRoll
              value={`${summary.minsUntil} ${msg.home.next.min}`}
              banglaDigits={banglaDigits}
              reduceMotion={reduceMotion}
            />
          )}
        </div>

        <div
          className="type-home-micro mt-1 truncate"
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
    </motion.div>
  );
}

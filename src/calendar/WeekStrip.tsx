import { ChevronLeftIcon, ChevronRightIcon } from "../design/icons";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { CalendarHubEvent, CalendarReminder, CalendarTask } from "../lib/ipc";
import { getWeekdayLabels, toDateKey } from "./calendarMarks";

export interface WeekStripProps {
  selectedDateKey: string;
  nowDate: Date;
  firstDayOfWeek: 0 | 6;
  tasks: CalendarTask[];
  events: CalendarHubEvent[];
  reminders: CalendarReminder[];
  language: "en" | "bn";
  banglaDigits: boolean;
  onSelectDay: (dateKey: string) => void;
  onJumpToday: () => void;
  onSelectEvent?: (ev: CalendarHubEvent) => void;
}

interface WeekColumnItem {
  id: string;
  title: string;
  color: string;
  eventRef?: CalendarHubEvent;
}

export function WeekStrip({
  selectedDateKey,
  nowDate,
  firstDayOfWeek,
  tasks,
  events,
  reminders,
  language,
  banglaDigits,
  onSelectDay,
  onJumpToday,
  onSelectEvent,
}: WeekStripProps) {
  const msg = getMessages(language);
  const [y, m, d] = selectedDateKey.split("-").map(Number);
  const selDate = new Date(y, (m || 1) - 1, d || 1);
  const offset = (selDate.getDay() - firstDayOfWeek + 7) % 7;
  const weekStart = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate() - offset);
  const todayKey = toDateKey(nowDate);
  const weekdays = getWeekdayLabels(firstDayOfWeek, language);

  const weekDays = Array.from({ length: 7 }, (_, idx) => {
    const dt = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + idx);
    const key = toDateKey(dt);
    const items: WeekColumnItem[] = [];

    for (const ev of events) {
      if (ev.start.slice(0, 10) === key) {
        items.push({
          id: `e-${ev.id}`,
          title: ev.title,
          color: ev.color || COLOR_TOKENS.calEvent,
          eventRef: ev,
        });
      }
    }
    for (const t of tasks) {
      if (!t.doneAt && t.dueDate === key) {
        items.push({
          id: `t-${t.id}`,
          title: t.title,
          color: t.isDeadline ? COLOR_TOKENS.calDeadline : COLOR_TOKENS.calTask,
        });
      }
    }
    for (const rem of reminders) {
      if (
        rem.active &&
        (rem.kind === "daily" || rem.kind === "prayer" || rem.at?.slice(0, 10) === key)
      ) {
        items.push({
          id: `r-${rem.id}`,
          title: rem.title,
          color: rem.kind === "prayer" ? COLOR_TOKENS.calPrayer : COLOR_TOKENS.calReminder,
        });
      }
    }

    return { dt, key, label: weekdays[idx], items };
  });

  const shiftWeek = (deltaDays: number) => {
    const next = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate() + deltaDays);
    onSelectDay(toDateKey(next));
  };

  const titleRange = formatDigits(
    `${weekDays[0].dt.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric" })} – ${weekDays[6].dt.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", { month: "short", day: "numeric" })}`,
    banglaDigits,
  );

  return (
    <section
      data-testid="cal-week-strip"
      className="cal-glass-card flex h-[308px] w-[308px] flex-col justify-between px-[12px] py-[12px]"
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2
          className="m-0 text-[13.5px] font-semibold tracking-tight"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {titleRange}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onJumpToday}
            className="flex h-[24px] cursor-pointer items-center rounded-full px-2.5 text-[11px] font-medium"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            {msg.calendarHub.today}
          </button>
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => shiftWeek(-7)}
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            <ChevronLeftIcon size={12} />
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => shiftWeek(7)}
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            <ChevronRightIcon size={12} />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={titleRange} className="mt-2 grid flex-1 grid-cols-7 gap-1">
        {weekDays.map((col) => {
          const isSelected = col.key === selectedDateKey;
          const isToday = col.key === todayKey;
          const visibleItems = col.items.slice(0, 3);
          const extra = Math.max(0, col.items.length - 3);
          return (
            <div
              key={col.key}
              role="gridcell"
              aria-selected={isSelected}
              onClick={() => onSelectDay(col.key)}
              className="flex cursor-pointer flex-col items-center rounded-xl px-0.5 py-1.5 transition-colors"
              style={{
                backgroundColor: isSelected ? COLOR_TOKENS.calPillBg : "transparent",
                border: isSelected
                  ? `1.5px solid ${COLOR_TOKENS.calSelectedRing}`
                  : "1.5px solid transparent",
              }}
            >
              <span
                className="text-[10px] font-medium"
                style={{ color: COLOR_TOKENS.textSecondary }}
              >
                {col.label}
              </span>
              <span
                className="mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
                style={{
                  backgroundColor: isToday ? COLOR_TOKENS.calToday : "transparent",
                  color: isToday ? COLOR_TOKENS.calTodayText : COLOR_TOKENS.textPrimary,
                }}
              >
                {formatDigits(String(col.dt.getDate()), banglaDigits)}
              </span>

              <div className="mt-2 flex w-full flex-col gap-1">
                {visibleItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (it.eventRef && onSelectEvent) onSelectEvent(it.eventRef);
                      else onSelectDay(col.key);
                    }}
                    title={it.title}
                    className="w-full cursor-pointer truncate rounded px-1 py-0.5 text-left text-[9px] font-medium text-white"
                    style={{
                      backgroundColor: COLOR_TOKENS.calGlassBg,
                      borderLeft: `2px solid ${it.color}`,
                    }}
                  >
                    {it.title}
                  </button>
                ))}
                {extra > 0 && (
                  <span
                    className="text-center text-[9px] font-medium tabular-nums"
                    style={{ color: COLOR_TOKENS.textSecondary }}
                  >
                    +{formatDigits(String(extra), banglaDigits)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

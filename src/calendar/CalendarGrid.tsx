import {
  BellTickMark,
  ChevronLeftIcon,
  ChevronRightIcon,
  DiamondMark,
  HollowDotMark,
  SolidDotMark,
} from "../design/icons";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import { DayCell } from "./DayCell";
import {
  buildMonthGrid,
  formatDayAriaLabel,
  getWeekdayLabels,
  resolveCellMarks,
} from "./calendarMarks";
import type { DayMarkSummary } from "../lib/ipc";

export interface CalendarGridProps {
  viewYear: number;
  viewMonth: number; // 1-12
  nowDate: Date;
  selectedDateKey: string;
  firstDayOfWeek: 0 | 6;
  colorBlindMarks: boolean;
  dragOverDateKey?: string | null;
  dayMarksMap: Map<string, DayMarkSummary>;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  onSelectDay: (dateKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToday: () => void;
  onDragEnterDay?: (dateKey: string) => void;
  onDragLeaveDay?: (dateKey: string) => void;
  onDropTaskOnDay?: (taskId: number | null, dateKey: string) => void;
}

export function CalendarGrid({
  viewYear,
  viewMonth,
  nowDate,
  selectedDateKey,
  firstDayOfWeek,
  colorBlindMarks,
  dragOverDateKey,
  dayMarksMap,
  language,
  banglaDigits,
  reduceMotion,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onJumpToday,
  onDragEnterDay,
  onDragLeaveDay,
  onDropTaskOnDay,
}: CalendarGridProps) {
  const msg = getMessages(language);
  const monthDate = new Date(viewYear, viewMonth - 1, 1);
  const monthTitle = formatDigits(
    monthDate.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", {
      month: "long",
      year: "numeric",
    }),
    banglaDigits,
  );
  const weekdays = getWeekdayLabels(firstDayOfWeek, language);
  const weeks = buildMonthGrid(viewYear, viewMonth, nowDate, firstDayOfWeek);
  const compactRow = weeks.length >= 6;

  const handleKeyNavigate = (e: React.KeyboardEvent<HTMLButtonElement>, currentDate: Date) => {
    const keyDeltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const deltaDays = keyDeltas[e.key];
    if (deltaDays === undefined) return;

    e.preventDefault();
    e.stopPropagation();
    const next = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + deltaDays,
    );
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, "0");
    const d = String(next.getDate()).padStart(2, "0");
    onSelectDay(`${y}-${m}-${d}`);
  };

  return (
    <section
      data-testid="calendar-grid-card"
      aria-label={monthTitle}
      className="cal-glass-card flex h-[308px] w-[308px] flex-col justify-between px-[14px] py-[12px]"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          data-testid="cal-month-title"
          className="m-0 text-[14px] font-semibold tracking-tight"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {monthTitle}
        </h2>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            data-testid="cal-today-btn"
            onClick={onJumpToday}
            className="flex h-[32px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent px-0.5"
          >
            <span
              className="flex h-[24px] items-center rounded-full px-2.5 text-[11px] font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              {msg.calendarHub.today}
            </span>
          </button>

          <button
            type="button"
            data-testid="cal-prev-month"
            aria-label={msg.calendarHub.prevMonth}
            onClick={onPrevMonth}
            className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
          >
            <span
              className="flex h-[24px] w-[24px] items-center justify-center rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              <ChevronLeftIcon size={12} />
            </span>
          </button>

          <button
            type="button"
            data-testid="cal-next-month"
            aria-label={msg.calendarHub.nextMonth}
            onClick={onNextMonth}
            className="flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
          >
            <span
              className="flex h-[24px] w-[24px] items-center justify-center rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              <ChevronRightIcon size={12} />
            </span>
          </button>
        </div>
      </div>

      <div className="mt-1 flex flex-1 flex-col justify-between">
        <div className="grid grid-cols-7 text-center">
          {weekdays.map((wd, idx) => (
            <div
              key={`${wd}-${idx}`}
              className="py-0.5 text-[10.5px] font-medium"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {wd}
            </div>
          ))}
        </div>

        <div role="grid" aria-label={monthTitle} className="flex flex-col justify-evenly">
          {weeks.map((week, wIdx) => (
            <div key={`w-${wIdx}`} role="row" className="grid grid-cols-7">
              {week.map((cell) => {
                const marks = resolveCellMarks(dayMarksMap.get(cell.dateKey));
                return (
                  <DayCell
                    key={cell.dateKey}
                    cell={cell}
                    marks={marks}
                    selected={selectedDateKey === cell.dateKey}
                    compactRow={compactRow}
                    dragOver={dragOverDateKey === cell.dateKey}
                    colorBlindMarks={colorBlindMarks}
                    banglaDigits={banglaDigits}
                    reduceMotion={reduceMotion}
                    ariaLabel={formatDayAriaLabel(cell, marks, language)}
                    onSelect={onSelectDay}
                    onKeyNavigate={handleKeyNavigate}
                    onDragEnterDay={onDragEnterDay}
                    onDragLeaveDay={onDragLeaveDay}
                    onDropTaskOnDay={onDropTaskOnDay}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div
        data-testid="cal-legend-row"
        className="mt-1 flex items-center justify-center gap-3 text-[10.5px]"
        style={{ color: COLOR_TOKENS.textSecondary }}
      >
        <span className="flex items-center gap-1">
          {colorBlindMarks ? (
            <span style={{ color: COLOR_TOKENS.calTask }}>
              <HollowDotMark size={7} />
            </span>
          ) : (
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ backgroundColor: COLOR_TOKENS.calTask }}
            />
          )}
          <span>{msg.calendarHub.legendTask}</span>
        </span>
        <span className="flex items-center gap-1">
          {colorBlindMarks ? (
            <span style={{ color: COLOR_TOKENS.calEvent }}>
              <SolidDotMark size={7} />
            </span>
          ) : (
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ backgroundColor: COLOR_TOKENS.calEvent }}
            />
          )}
          <span>{msg.calendarHub.legendEvent}</span>
        </span>
        <span className="flex items-center gap-1">
          {colorBlindMarks ? (
            <span style={{ color: COLOR_TOKENS.calReminder }}>
              <BellTickMark size={8} />
            </span>
          ) : (
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ backgroundColor: COLOR_TOKENS.calReminder }}
            />
          )}
          <span>{msg.calendarHub.legendReminder}</span>
        </span>
        <span className="flex items-center gap-1">
          {colorBlindMarks ? (
            <span style={{ color: COLOR_TOKENS.calDeadline }}>
              <DiamondMark size={7} />
            </span>
          ) : (
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ backgroundColor: COLOR_TOKENS.calDeadline }}
            />
          )}
          <span>{msg.calendarHub.legendDeadline}</span>
        </span>
      </div>
    </section>
  );
}

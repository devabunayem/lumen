import { motion } from "motion/react";
import { BellTickMark, DiamondMark, HollowDotMark, SolidDotMark } from "../design/icons";
import { MOTION_PRESETS } from "../design/motion";
import { COLOR_TOKENS } from "../design/tokens";
import { formatDigits } from "../i18n/digits";
import type { CalendarMarkKind, CellMarkRender, GridDayCell } from "./calendarMarks";

export interface DayCellProps {
  cell: GridDayCell;
  marks: CellMarkRender;
  selected: boolean;
  compactRow: boolean;
  dragOver: boolean;
  colorBlindMarks: boolean;
  banglaDigits: boolean;
  reduceMotion: boolean;
  ariaLabel: string;
  onSelect: (dateKey: string) => void;
  onKeyNavigate: (e: React.KeyboardEvent<HTMLButtonElement>, date: Date) => void;
  onDragEnterDay?: (dateKey: string) => void;
  onDragLeaveDay?: (dateKey: string) => void;
  onDropTaskOnDay?: (taskId: number | null, dateKey: string) => void;
}

const MARK_COLOR_MAP: Record<CalendarMarkKind, string> = {
  task: COLOR_TOKENS.calTask,
  event: COLOR_TOKENS.calEvent,
  reminder: COLOR_TOKENS.calReminder,
  deadline: COLOR_TOKENS.calDeadline,
};

function renderMarkGlyph(kind: CalendarMarkKind, colorBlindMarks: boolean, keyIdx: number) {
  const color = MARK_COLOR_MAP[kind];
  if (colorBlindMarks) {
    if (kind === "task") {
      return (
        <span key={`${kind}-${keyIdx}`} style={{ color }}>
          <HollowDotMark size={6} />
        </span>
      );
    }
    if (kind === "reminder") {
      return (
        <span key={`${kind}-${keyIdx}`} style={{ color }}>
          <BellTickMark size={7} />
        </span>
      );
    }
    if (kind === "deadline") {
      return (
        <span key={`${kind}-${keyIdx}`} style={{ color }}>
          <DiamondMark size={6} />
        </span>
      );
    }
    return (
      <span key={`${kind}-${keyIdx}`} style={{ color }}>
        <SolidDotMark size={6} />
      </span>
    );
  }
  return (
    <span
      key={`${kind}-${keyIdx}`}
      className="block h-[5px] w-[5px] rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

export function DayCell({
  cell,
  marks,
  selected,
  compactRow,
  dragOver,
  colorBlindMarks,
  banglaDigits,
  reduceMotion,
  ariaLabel,
  onSelect,
  onKeyNavigate,
  onDragEnterDay,
  onDragLeaveDay,
  onDropTaskOnDay,
}: DayCellProps) {
  const dayText = formatDigits(String(cell.dayOfMonth), banglaDigits);
  const showMarks = cell.inCurrentMonth && marks.slots.length > 0;
  const mutedDay = !cell.inCurrentMonth || (cell.isPast && !cell.isToday && !selected);

  return (
    <div
      role="gridcell"
      aria-selected={selected}
      onDragOver={(e) => {
        e.preventDefault();
        onDragEnterDay?.(cell.dateKey);
      }}
      onDragLeave={() => onDragLeaveDay?.(cell.dateKey)}
      onDrop={(e) => {
        e.preventDefault();
        const raw = e.dataTransfer?.getData("text/lumen-task-id");
        const parsedId = raw ? Number(raw) : null;
        onDropTaskOnDay?.(Number.isFinite(parsedId) ? parsedId : null, cell.dateKey);
      }}
      className={`flex items-center justify-center ${compactRow ? "h-[34px]" : "h-[38px]"}`}
    >
      <motion.button
        type="button"
        data-testid={`cal-day-${cell.dateKey}`}
        aria-label={ariaLabel}
        tabIndex={selected ? 0 : -1}
        onClick={() => onSelect(cell.dateKey)}
        onKeyDown={(e) => onKeyNavigate(e, cell.date)}
        whileTap={
          reduceMotion ? undefined : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
        }
        className={`relative flex w-[34px] cursor-pointer flex-col items-center justify-center rounded-xl border-0 bg-transparent p-0 transition-colors focus-visible:outline-none ${
          compactRow ? "h-[32px]" : "h-[35px]"
        } ${selected && cell.isToday ? "lumen-today-ring-pulse" : ""}`}
        style={{
          opacity: mutedDay ? 0.5 : 1,
          border: dragOver
            ? `1.5px solid ${COLOR_TOKENS.calToday}`
            : selected
              ? `1.5px solid ${COLOR_TOKENS.calSelectedRing}`
              : "1.5px solid transparent",
          backgroundColor: selected ? COLOR_TOKENS.calGlassBg : "transparent",
        }}
      >
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11.5px] leading-none tabular-nums"
          style={{
            backgroundColor: cell.isToday ? COLOR_TOKENS.calToday : "transparent",
            color: cell.isToday ? COLOR_TOKENS.calTodayText : COLOR_TOKENS.textPrimary,
            fontWeight: cell.isToday || selected ? 600 : 500,
          }}
        >
          {dayText}
        </span>

        <span
          aria-hidden="true"
          className="mt-[2px] flex h-[6px] items-center justify-center gap-[3px]"
        >
          {showMarks && (
            <>
              {marks.slots.map((slot, idx) => renderMarkGlyph(slot.kind, colorBlindMarks, idx))}
              {marks.showOverflowPlus && (
                <span
                  data-testid={`cal-day-plus-${cell.dateKey}`}
                  className="text-[8.5px] font-bold leading-none"
                  style={{ color: COLOR_TOKENS.textSecondary }}
                >
                  +
                </span>
              )}
            </>
          )}
        </span>
      </motion.button>
    </div>
  );
}

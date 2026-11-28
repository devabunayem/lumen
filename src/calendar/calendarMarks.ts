import type { CalendarHubEvent, CalendarReminder, CalendarTask, DayMarkSummary } from "../lib/ipc";

export type CalendarMarkKind = "task" | "event" | "reminder" | "deadline";

export interface GridDayCell {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

export interface RenderedMarkSlot {
  kind: CalendarMarkKind;
  count: number;
}

export interface CellMarkRender {
  slots: RenderedMarkSlot[];
  showOverflowPlus: boolean;
  totalCount: number;
  summary: DayMarkSummary;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekdayLabels(firstDayOfWeek: 0 | 6, language: "en" | "bn"): string[] {
  const en = ["S", "M", "T", "W", "T", "F", "S"];
  const bn = ["র", "সো", "ম", "বু", "বৃ", "শু", "শ"];
  const base = language === "bn" ? bn : en;
  if (firstDayOfWeek === 6) {
    return [base[6], ...base.slice(0, 6)];
  }
  return base;
}

/**
 * Generates 5 or 6 week rows (35 or 42 cells) for `year`/`month` (1-indexed month).
 */
export function buildMonthGrid(
  year: number,
  month: number,
  nowDate: Date,
  firstDayOfWeek: 0 | 6 = 0,
): GridDayCell[][] {
  const todayKey = toDateKey(nowDate);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  const startDow = firstDay.getDay(); // 0=Sun..6=Sat
  const leadingEmpty = (startDow - firstDayOfWeek + 7) % 7;
  const totalCells = leadingEmpty + daysInMonth;
  const rowCount = totalCells > 35 ? 6 : 5;
  const cellTotal = rowCount * 7;

  const gridStart = new Date(year, month - 1, 1 - leadingEmpty);
  const todayMidnight = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();

  const rows: GridDayCell[][] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const week: GridDayCell[] = [];
    for (let c = 0; c < 7; c += 1) {
      const idx = r * 7 + c;
      if (idx >= cellTotal) break;
      const cellDate = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + idx,
      );
      const dateKey = toDateKey(cellDate);
      const inCurrentMonth = cellDate.getMonth() === month - 1 && cellDate.getFullYear() === year;
      const cellMidnight = cellDate.getTime();
      week.push({
        date: cellDate,
        dateKey,
        dayOfMonth: cellDate.getDate(),
        inCurrentMonth,
        isToday: dateKey === todayKey,
        isPast: cellMidnight < todayMidnight,
      });
    }
    rows.push(week);
  }
  return rows;
}

/**
 * Merges server DayMarkSummary records with client-side fallback counts if needed.
 */
export function buildDayMarkIndex(
  dayMarks: readonly DayMarkSummary[],
  tasks?: readonly CalendarTask[],
  events?: readonly CalendarHubEvent[],
  reminders?: readonly CalendarReminder[],
): Map<string, DayMarkSummary> {
  const map = new Map<string, DayMarkSummary>();
  for (const m of dayMarks) {
    map.set(m.dateKey, m);
  }
  if (map.size === 0 && (tasks?.length || events?.length || reminders?.length)) {
    const ensure = (key: string): DayMarkSummary => {
      let cur = map.get(key);
      if (!cur) {
        cur = { dateKey: key, taskCount: 0, eventCount: 0, reminderCount: 0, deadlineCount: 0 };
        map.set(key, cur);
      }
      return cur;
    };
    for (const t of tasks ?? []) {
      if (!t.doneAt && t.dueDate && t.dueDate.length >= 10) {
        const entry = ensure(t.dueDate.slice(0, 10));
        if (t.isDeadline) entry.deadlineCount += 1;
        else entry.taskCount += 1;
      }
    }
    for (const ev of events ?? []) {
      if (ev.start.length >= 10) {
        ensure(ev.start.slice(0, 10)).eventCount += 1;
      }
    }
    for (const rem of reminders ?? []) {
      if (rem.active && rem.at && rem.at.length >= 10) {
        ensure(rem.at.slice(0, 10)).reminderCount += 1;
      }
    }
  }
  return map;
}

/**
 * Computes up to 3 visible category marks for a day; if total items > 3, third slot becomes `+`.
 */
export function resolveCellMarks(summary: DayMarkSummary | undefined): CellMarkRender {
  const s: DayMarkSummary = summary ?? {
    dateKey: "",
    taskCount: 0,
    eventCount: 0,
    reminderCount: 0,
    deadlineCount: 0,
  };
  const allNonZero: RenderedMarkSlot[] = [];
  if (s.taskCount > 0) allNonZero.push({ kind: "task", count: s.taskCount });
  if (s.eventCount > 0) allNonZero.push({ kind: "event", count: s.eventCount });
  if (s.reminderCount > 0) allNonZero.push({ kind: "reminder", count: s.reminderCount });
  if (s.deadlineCount > 0) allNonZero.push({ kind: "deadline", count: s.deadlineCount });

  const totalCount = s.taskCount + s.eventCount + s.reminderCount + s.deadlineCount;
  if (totalCount > 3) {
    return {
      slots: allNonZero.slice(0, 2),
      showOverflowPlus: true,
      totalCount,
      summary: s,
    };
  }
  const dots: RenderedMarkSlot[] = [];
  const pushMany = (kind: CalendarMarkKind, count: number) => {
    for (let i = 0; i < count && dots.length < 3; i += 1) {
      dots.push({ kind, count: 1 });
    }
  };
  pushMany("task", s.taskCount);
  pushMany("event", s.eventCount);
  pushMany("reminder", s.reminderCount);
  pushMany("deadline", s.deadlineCount);

  return {
    slots: dots,
    showOverflowPlus: false,
    totalCount,
    summary: s,
  };
}

export function formatDayAriaLabel(
  cell: GridDayCell,
  mark: CellMarkRender,
  language: "en" | "bn",
): string {
  const dateStr = cell.date.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", {
    day: "numeric",
    month: "long",
  });
  if (mark.totalCount === 0) {
    return dateStr;
  }
  const parts: string[] = [];
  const { taskCount, eventCount, reminderCount, deadlineCount } = mark.summary;
  if (language === "bn") {
    if (taskCount > 0) parts.push(`${taskCount}টি কাজ`);
    if (eventCount > 0) parts.push(`${eventCount}টি ইভেন্ট`);
    if (reminderCount > 0) parts.push(`${reminderCount}টি রিমাইন্ডার`);
    if (deadlineCount > 0) parts.push(`${deadlineCount}টি ডেডলাইন`);
    return `${dateStr}, ${mark.totalCount}টি আইটেম: ${parts.join(", ")}`;
  }
  if (taskCount > 0) parts.push(`${taskCount} ${taskCount === 1 ? "task" : "tasks"}`);
  if (eventCount > 0) parts.push(`${eventCount} ${eventCount === 1 ? "event" : "events"}`);
  if (reminderCount > 0) {
    parts.push(`${reminderCount} ${reminderCount === 1 ? "reminder" : "reminders"}`);
  }
  if (deadlineCount > 0) {
    parts.push(`${deadlineCount} ${deadlineCount === 1 ? "deadline" : "deadlines"}`);
  }
  return `${dateStr}, ${mark.totalCount} ${mark.totalCount === 1 ? "item" : "items"}: ${parts.join(", ")}`;
}

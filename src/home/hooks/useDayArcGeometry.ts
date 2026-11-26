import { useMemo } from "react";
import type { CalendarEvent, PrayerSchedule, TaskItem } from "../../lib/ipc";

export type ArcZoomMode = "day" | "next3h";

export type ArcEventCategory = "focus" | "meeting" | "call" | "deadline";

export interface ArcPoint {
  x: number;
  y: number;
  u: number;
}

export interface ArcPrayerMarker {
  id: string;
  label: string;
  timeLabel: string;
  minuteOfDay: number;
  x: number;
  y: number;
  u: number;
  passed: boolean;
  isNext: boolean;
  isSpecialRamadan?: boolean;
  inView: boolean;
}

export interface ArcEventBar {
  id: string;
  title: string;
  startMin: number;
  durationMin: number;
  x: number;
  width: number;
  y: number;
  category: ArcEventCategory;
  lane: number;
}

export interface DayArcGeometry {
  startMin: number;
  endMin: number;
  nowMin: number;
  isNightMode: boolean;
  nowPoint: ArcPoint;
  fullArcPath: string;
  progressArcPath: string;
  markers: ArcPrayerMarker[];
  ramadanMarkers: ArcPrayerMarker[];
  events: ArcEventBar[];
}

export const ARC_SVG_W = 728;
export const ARC_SVG_H = 150;
export const ARC_X_START = 20;
export const ARC_X_END = 708;
export const ARC_X_SPAN = 688;
export const ARC_HORIZON_Y = 96;
export const ARC_CTRL_X = 364;
export const ARC_CTRL_Y = -68;
export const FULL_ARC_PATH = "M 20 96 Q 364 -68 708 96";

/**
 * Evaluates the exact Day Arc quadratic Bezier y coordinate at normalized ratio u in [0, 1]
 * or at SVG x coordinate in [20, 708]:
 *   u = (x - 20) / 688
 *   y = 96 - 328 * u * (1 - u)
 */
export function evaluateArcAtU(u: number): ArcPoint {
  const clampedU = Math.max(0, Math.min(1, u));
  const x = ARC_X_START + clampedU * ARC_X_SPAN;
  const y = ARC_HORIZON_Y - 328 * clampedU * (1 - clampedU);
  return { x, y, u: clampedU };
}

/**
 * Evaluates the quadratic Bezier point at SVG x coordinate.
 */
export function evaluateArcAtX(x: number): ArcPoint {
  return evaluateArcAtU((x - ARC_X_START) / ARC_X_SPAN);
}

/**
 * Maps a minute-of-day value onto [startMin, endMin] -> SVG point.
 */
export function mapTimeToArcPoint(minute: number, startMin: number, endMin: number): ArcPoint {
  const span = Math.max(1, endMin - startMin);
  const u = (minute - startMin) / span;
  return evaluateArcAtU(u);
}

/**
 * Exact de Casteljau quadratic Bezier sub-curve from u=0 to u=t on M 20 96 Q 364 -68 708 96.
 */
export function buildDeCasteljauProgressPath(tRatio: number): string {
  const t = Math.max(0, Math.min(1, tRatio));
  if (t <= 0) {
    return `M ${ARC_X_START} ${ARC_HORIZON_Y} Q ${ARC_X_START} ${ARC_HORIZON_Y} ${ARC_X_START} ${ARC_HORIZON_Y}`;
  }
  const q1x = (1 - t) * ARC_X_START + t * ARC_CTRL_X;
  const q1y = (1 - t) * ARC_HORIZON_Y + t * ARC_CTRL_Y;
  const q2x = (1 - t) * (1 - t) * ARC_X_START + 2 * (1 - t) * t * ARC_CTRL_X + t * t * ARC_X_END;
  const q2y =
    (1 - t) * (1 - t) * ARC_HORIZON_Y + 2 * (1 - t) * t * ARC_CTRL_Y + t * t * ARC_HORIZON_Y;

  return `M ${ARC_X_START} ${ARC_HORIZON_Y} Q ${q1x.toFixed(2)} ${q1y.toFixed(2)} ${q2x.toFixed(2)} ${q2y.toFixed(2)}`;
}

export function classifyEventCategory(title: string): ArcEventCategory {
  const lower = title.toLowerCase();
  if (
    lower.includes("focus") ||
    lower.includes("deep") ||
    lower.includes("code") ||
    lower.includes("study")
  ) {
    return "focus";
  }
  if (
    lower.includes("deadline") ||
    lower.includes("due") ||
    lower.includes("urgent") ||
    lower.includes("submit")
  ) {
    return "deadline";
  }
  if (lower.includes("call") || lower.includes("phone") || lower.includes("client")) {
    return "call";
  }
  return "meeting";
}

export function parseMinuteOfDayFromIsoOrTime(
  raw: string | null | undefined,
  nowDate: Date,
): number | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (hhmm) {
    return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const sameDay =
    parsed.getFullYear() === nowDate.getFullYear() &&
    parsed.getMonth() === nowDate.getMonth() &&
    parsed.getDate() === nowDate.getDate();
  if (!sameDay) {
    return null;
  }
  return parsed.getHours() * 60 + parsed.getMinutes();
}

export function formatMinutes12h(minuteOfDay: number, includeSuffix = false): string {
  const wrapped = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return includeSuffix
    ? `${h12}:${String(m).padStart(2, "0")} ${suffix}`
    : `${h12}:${String(m).padStart(2, "0")}`;
}

export interface ComputeDayArcInput {
  schedule: PrayerSchedule | null;
  calendarEvents: CalendarEvent[];
  tasks: TaskItem[];
  nowDate: Date;
  zoomMode: ArcZoomMode;
  language: "en" | "bn";
  overrideNightMode?: boolean;
  overrideFriday?: boolean;
  overrideRamadan?: boolean;
  overrideNowMin?: number;
}

export function computeDayArcGeometry(input: ComputeDayArcInput): DayArcGeometry {
  const { schedule, calendarEvents, tasks, nowDate, zoomMode, language } = input;
  const fallbackSlots = [
    {
      id: "fajr",
      name_en: "Fajr",
      name_bn: "ফজর",
      minute_of_day: 302,
      time_12h: "5:02 AM",
      passed: true,
    },
    {
      id: "dhuhr",
      name_en: "Dhuhr",
      name_bn: "যোহর",
      minute_of_day: 708,
      time_12h: "11:48 AM",
      passed: true,
    },
    {
      id: "asr",
      name_en: "Asr",
      name_bn: "আসর",
      minute_of_day: 940,
      time_12h: "3:40 PM",
      passed: true,
    },
    {
      id: "maghrib",
      name_en: "Maghrib",
      name_bn: "মাগরিব",
      minute_of_day: 1031,
      time_12h: "5:11 PM",
      passed: false,
    },
    {
      id: "isha",
      name_en: "Isha",
      name_bn: "এশা",
      minute_of_day: 1115,
      time_12h: "6:35 PM",
      passed: false,
    },
  ];

  const baseSlots = (schedule?.slots?.length ? schedule.slots : fallbackSlots).map((slot) => {
    const isJumuah = (input.overrideFriday ?? schedule?.is_friday) && slot.id === "dhuhr";
    return {
      ...slot,
      label:
        language === "bn" ? (isJumuah ? "জুমা" : slot.name_bn) : isJumuah ? "Jumu'ah" : slot.name_en,
    };
  });

  const fajrMin = baseSlots[0]?.minute_of_day ?? 302;
  const maghribMin = baseSlots[3]?.minute_of_day ?? 1031;
  const ishaMin = baseSlots[4]?.minute_of_day ?? 1115;

  const localNowMin =
    input.overrideNowMin ?? schedule?.now_min ?? nowDate.getHours() * 60 + nowDate.getMinutes();

  const isNightMode =
    input.overrideNightMode ??
    schedule?.is_night_mode ??
    (localNowMin >= ishaMin || localNowMin < fajrMin);

  const nightStartMin =
    schedule?.night_start_min ?? (localNowMin >= ishaMin ? ishaMin : ishaMin - 1440);
  const nightEndMin =
    schedule?.night_end_min ?? (localNowMin >= ishaMin ? fajrMin + 1440 : fajrMin);

  let startMin = isNightMode ? nightStartMin : fajrMin - 30;
  let endMin = isNightMode ? nightEndMin : ishaMin + 55;

  if (zoomMode === "next3h") {
    startMin = localNowMin - 20;
    endMin = localNowMin + 180;
  }

  const nowPoint = mapTimeToArcPoint(localNowMin, startMin, endMin);
  const progressArcPath = buildDeCasteljauProgressPath(nowPoint.u);

  const nextSlotId = (() => {
    if (isNightMode) {
      return "fajr";
    }
    const found = baseSlots.find((s) => s.minute_of_day > localNowMin);
    return found ? found.id : "fajr";
  })();

  const rawMarkers = isNightMode
    ? [
        {
          id: "isha",
          label: language === "bn" ? "এশা" : "Isha",
          minuteOfDay: nightStartMin,
          timeLabel: formatMinutes12h(nightStartMin),
          passed: true,
          isNext: false,
        },
        {
          id: "fajr",
          label: language === "bn" ? "ফজর" : "Fajr",
          minuteOfDay: nightEndMin,
          timeLabel: formatMinutes12h(nightEndMin),
          passed: false,
          isNext: true,
        },
      ]
    : baseSlots.map((slot) => ({
        id: slot.id,
        label: slot.label,
        minuteOfDay: slot.minute_of_day,
        timeLabel: slot.time_12h.replace(/\s*(AM|PM)$/i, ""),
        passed: slot.minute_of_day <= localNowMin,
        isNext: slot.id === nextSlotId,
      }));

  const markers: ArcPrayerMarker[] = rawMarkers.map((m) => {
    const pt = mapTimeToArcPoint(m.minuteOfDay, startMin, endMin);
    const inView = m.minuteOfDay >= startMin - 5 && m.minuteOfDay <= endMin + 5;
    return {
      ...m,
      x: pt.x,
      y: pt.y,
      u: pt.u,
      inView,
    };
  });

  const isRamadan = input.overrideRamadan ?? schedule?.is_ramadan ?? false;
  const ramadanMarkers: ArcPrayerMarker[] = [];
  if (isRamadan) {
    const sehriMin = schedule?.sehri_min ?? fajrMin;
    const iftarMin = schedule?.iftar_min ?? maghribMin;
    const sehriTargetMin = isNightMode && localNowMin >= ishaMin ? sehriMin + 1440 : sehriMin;
    const sPt = mapTimeToArcPoint(sehriTargetMin, startMin, endMin);
    ramadanMarkers.push({
      id: "sehri",
      label: language === "bn" ? "সেহরি" : "Sehri",
      timeLabel: formatMinutes12h(sehriTargetMin),
      minuteOfDay: sehriTargetMin,
      x: sPt.x,
      y: sPt.y,
      u: sPt.u,
      passed: localNowMin >= sehriTargetMin,
      isNext: localNowMin < sehriTargetMin,
      isSpecialRamadan: true,
      inView: sehriTargetMin >= startMin && sehriTargetMin <= endMin,
    });
    if (!isNightMode) {
      const iPt = mapTimeToArcPoint(iftarMin, startMin, endMin);
      ramadanMarkers.push({
        id: "iftar",
        label: language === "bn" ? "ইফতার" : "Iftar",
        timeLabel: formatMinutes12h(iftarMin),
        minuteOfDay: iftarMin,
        x: iPt.x,
        y: iPt.y,
        u: iPt.u,
        passed: localNowMin >= iftarMin,
        isNext: localNowMin >= sehriMin && localNowMin < iftarMin,
        isSpecialRamadan: true,
        inView: iftarMin >= startMin && iftarMin <= endMin,
      });
    }
  }

  // Combine calendar events + due tasks into horizontal pill lane bars under horizon (y=101..107, max 6 visible).
  const rawEvents: Array<{
    id: string;
    title: string;
    startMin: number;
    durationMin: number;
    category: ArcEventCategory;
  }> = [];
  for (const ev of calendarEvents) {
    const m = parseMinuteOfDayFromIsoOrTime(ev.start_at, nowDate);
    if (m !== null) {
      rawEvents.push({
        id: `cal-${ev.id}`,
        title: ev.title,
        startMin: m,
        durationMin: 45,
        category: classifyEventCategory(ev.title),
      });
    }
  }
  for (const task of tasks) {
    if (task.done || !task.due_at) {
      continue;
    }
    const m = parseMinuteOfDayFromIsoOrTime(task.due_at, nowDate);
    if (m !== null) {
      rawEvents.push({
        id: `task-${task.id}`,
        title: task.title,
        startMin: m,
        durationMin: 30,
        category: classifyEventCategory(task.title),
      });
    }
  }

  rawEvents.sort((a, b) => a.startMin - b.startMin);
  const axisSpan = Math.max(1, endMin - startMin);
  const visibleCandidates = rawEvents
    .filter((ev) => ev.startMin + ev.durationMin >= startMin && ev.startMin <= endMin)
    .slice(0, 6);

  const laneEndX: number[] = [];
  const events: ArcEventBar[] = [];
  for (const ev of visibleCandidates) {
    const rawX1 = ARC_X_START + ((ev.startMin - startMin) / axisSpan) * ARC_X_SPAN;
    const rawX2 = ARC_X_START + ((ev.startMin + ev.durationMin - startMin) / axisSpan) * ARC_X_SPAN;
    const x1 = Math.max(ARC_X_START, Math.min(ARC_X_END - 16, rawX1));
    const width = Math.max(20, Math.min(ARC_X_END - x1, rawX2 - rawX1));
    let lane = 0;
    while (lane < laneEndX.length && x1 < laneEndX[lane] + 4) {
      lane += 1;
    }
    laneEndX[lane] = x1 + width;
    events.push({
      id: ev.id,
      title: ev.title,
      startMin: ev.startMin,
      durationMin: ev.durationMin,
      x: x1,
      width,
      y: 101 + lane * 8,
      category: ev.category,
      lane,
    });
  }

  return {
    startMin,
    endMin,
    nowMin: localNowMin,
    isNightMode,
    nowPoint,
    fullArcPath: FULL_ARC_PATH,
    progressArcPath,
    markers,
    ramadanMarkers,
    events,
  };
}

/**
 * Resolves hover inspection at SVG X coordinate for scrub cursor & tooltip.
 */
export function inspectArcAtSvgX(
  svgX: number,
  geometry: DayArcGeometry,
  nothingScheduledLabel: string,
): {
  x: number;
  minuteOfDay: number;
  quarterBucket: number;
  timeText: string;
  detailText: string;
} {
  const clampedX = Math.max(ARC_X_START, Math.min(ARC_X_END, svgX));
  const u = (clampedX - ARC_X_START) / ARC_X_SPAN;
  const minuteOfDay = Math.round(geometry.startMin + u * (geometry.endMin - geometry.startMin));
  const quarterBucket = Math.floor(minuteOfDay / 15);
  const timeText = formatMinutes12h(minuteOfDay, true);

  const nearPrayer = geometry.markers.find((m) => Math.abs(m.minuteOfDay - minuteOfDay) <= 18);
  const nearEvent = geometry.events.find(
    (ev) => clampedX >= ev.x - 6 && clampedX <= ev.x + ev.width + 6,
  );
  const detailText = nearPrayer
    ? `${nearPrayer.label} (${nearPrayer.timeLabel})`
    : nearEvent
      ? nearEvent.title
      : nothingScheduledLabel;

  return {
    x: clampedX,
    minuteOfDay,
    quarterBucket,
    timeText,
    detailText,
  };
}

export interface NextCountdownSummary {
  title: string;
  minsUntil: number | null;
  statusColor: string;
  tasksLeft: number;
  isAllClear: boolean;
}

/**
 * Pure countdown resolver from calendar events / pending tasks / fallback prayer.
 */
export function resolveNextCountdown(
  calendarEvents: CalendarEvent[],
  tasks: TaskItem[],
  schedule: PrayerSchedule | null,
  nowDate: Date,
  language: "en" | "bn",
  allClearLabel: string,
): NextCountdownSummary {
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const tasksLeft = tasks.filter((t) => !t.done).length;

  const upcoming: Array<{ title: string; mins: number }> = [];
  for (const ev of calendarEvents) {
    const startMin = parseMinuteOfDayFromIsoOrTime(ev.start_at, nowDate);
    if (startMin !== null && startMin >= nowMin - 5) {
      upcoming.push({ title: ev.title, mins: Math.max(0, startMin - nowMin) });
    }
  }
  for (const task of tasks) {
    if (task.done || !task.due_at) {
      continue;
    }
    const dueMin = parseMinuteOfDayFromIsoOrTime(task.due_at, nowDate);
    if (dueMin !== null && dueMin >= nowMin - 5) {
      upcoming.push({ title: task.title, mins: Math.max(0, dueMin - nowMin) });
    }
  }

  upcoming.sort((a, b) => a.mins - b.mins);
  const first = upcoming[0];

  if (first) {
    const statusColor =
      first.mins < 2
        ? "var(--accent-red)"
        : first.mins < 10
          ? "var(--accent-orange)"
          : "var(--accent-green)";
    return {
      title: first.title,
      minsUntil: first.mins,
      statusColor,
      tasksLeft,
      isAllClear: false,
    };
  }

  if (schedule) {
    const mins = schedule.next_diff_min ?? 30;
    return {
      title: language === "bn" ? schedule.next_name_bn : schedule.next_name_en,
      minsUntil: mins,
      statusColor: mins < 10 ? "var(--accent-orange)" : "var(--accent-green)",
      tasksLeft,
      isAllClear: false,
    };
  }

  return {
    title: allClearLabel,
    minsUntil: null,
    statusColor: "var(--accent-green)",
    tasksLeft: 0,
    isAllClear: true,
  };
}

export function useDayArcGeometry(input: ComputeDayArcInput): DayArcGeometry {
  const {
    schedule,
    calendarEvents,
    tasks,
    nowDate,
    zoomMode,
    language,
    overrideNightMode,
    overrideFriday,
    overrideRamadan,
    overrideNowMin,
  } = input;

  const year = nowDate.getFullYear();
  const month = nowDate.getMonth();
  const day = nowDate.getDate();
  const hours = nowDate.getHours();
  const minutes = nowDate.getMinutes();

  return useMemo(() => {
    const roundedDate = new Date(year, month, day, hours, minutes, 0);
    return computeDayArcGeometry({
      schedule,
      calendarEvents,
      tasks,
      nowDate: roundedDate,
      zoomMode,
      language,
      overrideNightMode,
      overrideFriday,
      overrideRamadan,
      overrideNowMin,
    });
  }, [
    schedule,
    calendarEvents,
    tasks,
    year,
    month,
    day,
    hours,
    minutes,
    zoomMode,
    language,
    overrideNightMode,
    overrideFriday,
    overrideRamadan,
    overrideNowMin,
  ]);
}

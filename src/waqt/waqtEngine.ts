import type {
  CalendarEvent,
  PomodoroSnapshot,
  PrayerSchedule,
  TaskItem,
  WaqtBlockItem,
  WaqtBlockView,
  WaqtGhostAnchor,
  WaqtPlanAssignment,
  WaqtSuggestion,
  WaqtTimelineState,
  WaqtTomorrowBlock,
} from "../lib/ipc";
import type { WaqtRhythmAnchor } from "../settings";

export const WAQT_RAIL_W = 612;
export const WAQT_RAIL_H = 34;
export const WAQT_SEGMENT_W = 114;
export const WAQT_SEGMENT_GAP = 10.5;

export function parseHHMM(raw: string, fallbackMin: number): number {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    return fallbackMin;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return fallbackMin;
  }
  return h * 60 + min;
}

export function parseClockMinutes(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const iso = new Date(trimmed);
  if (trimmed.includes("T") && !Number.isNaN(iso.getTime())) {
    return iso.getHours() * 60 + iso.getMinutes();
  }
  const match = trimmed.toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) {
    return null;
  }
  let h = Number(match[1]);
  const m = Number(match[2]);
  const meridiem = match[3];
  if (meridiem === "PM" && h < 12) {
    h += 12;
  } else if (meridiem === "AM" && h === 12) {
    h = 0;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function formatMinClock12(minOfDay: number): string {
  const wrapped = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")}`;
}

export function formatDurationCompact(mins: number): string {
  const clamped = Math.max(0, Math.round(mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h`;
  }
  return `${m}m`;
}

export function snapScrubMinutes(minute: number, minBound: number, maxBound: number): number {
  const snapped = Math.round(minute / 5) * 5;
  return Math.max(minBound, Math.min(maxBound, snapped));
}

export interface ParsedQuickAddInput {
  title: string;
  estimateMin: number;
  startAt: string | null;
}

/**
 * Parses quick-add text such as `"design review 25"`, `"sync 45m"`, `"deep work 1h"`,
 * or `"call @3pm 20"` into clean title, clamped estimate (5..240), and optional time.
 */
export function parseQuickAddTaskInput(raw: string): ParsedQuickAddInput {
  let working = raw.trim();
  let startAt: string | null = null;
  let estimateMin = 25;

  const atTimeMatch = working.match(/\s+@(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (atTimeMatch) {
    const token = atTimeMatch[1].trim().toLowerCase();
    const hm = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (hm) {
      let h = Number(hm[1]);
      const m = hm[2] ? Number(hm[2]) : 0;
      const ap = hm[3]?.toLowerCase();
      if (ap === "pm" && h < 12) h += 12;
      else if (ap === "am" && h === 12) h = 0;
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        startAt = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }
    }
    working = working.replace(atTimeMatch[0], " ").trim();
  }

  const trailingHours = working.match(/\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs)$/i);
  const trailingMins = working.match(/\s+(\d{1,3})\s*(?:m|min|mins)?$/i);
  if (trailingHours) {
    const parsed = Math.round(Number(trailingHours[1]) * 60);
    if (parsed >= 5 && parsed <= 240) {
      estimateMin = parsed;
      working = working.slice(0, working.length - trailingHours[0].length).trim();
    }
  } else if (trailingMins) {
    const parsed = Number(trailingMins[1]);
    if (parsed >= 5 && parsed <= 240) {
      estimateMin = parsed;
      working = working.slice(0, working.length - trailingMins[0].length).trim();
    }
  }

  return {
    title: working || raw.trim(),
    estimateMin,
    startAt,
  };
}

export function resolveKindCssVar(kind: string): string {
  switch (kind) {
    case "meeting":
      return "var(--waqt-meeting)";
    case "habit":
    case "water":
    case "walk":
    case "stretch":
    case "eye":
      return "var(--waqt-habit)";
    case "deadline":
      return "var(--waqt-deadline)";
    default:
      return "var(--waqt-task)";
  }
}

export interface CapacitySlice {
  id: number | string;
  pct: number;
  colorVar: string;
}

export function buildSegmentedCapacitySlices(block: WaqtBlockView): CapacitySlice[] {
  const denom = Math.max(
    15,
    block.is_current ? block.remaining_min : block.end_min - block.start_min,
  );
  if (block.capacity_status === "overbooked") {
    return [{ id: "overbooked", pct: 100, colorVar: "var(--waqt-deadline)" }];
  }
  if (block.items.length === 0) {
    return [];
  }
  if (block.capacity_status === "tight") {
    return [
      {
        id: "tight",
        pct: Math.min(100, Math.max(8, block.fill_ratio_pct)),
        colorVar: "var(--waqt-habit)",
      },
    ];
  }
  return block.items.map((item) => {
    const need = item.fixed ? Math.max(5, item.estimate_min) : Math.max(5, item.estimate_min) + 5;
    const rawPct = (need / denom) * 100;
    return {
      id: item.id,
      pct: Math.max(4, Math.min(100, Math.round(rawPct))),
      colorVar: resolveKindCssVar(item.kind),
    };
  });
}

export function computeOverflowMoveAssignments(
  block: WaqtBlockView,
  nextBlock: WaqtBlockView | undefined,
): Array<{ taskId: number; title: string; prevBlockId: string | null; nextBlockId: string }> {
  if (!nextBlock || block.capacity_status !== "overbooked") {
    return [];
  }
  let excess = Math.max(0, -block.free_capacity_min);
  const candidates = [...block.items].reverse().filter((i) => !i.fixed && !i.done && i.id > 0);
  const moves: Array<{
    taskId: number;
    title: string;
    prevBlockId: string | null;
    nextBlockId: string;
  }> = [];
  for (const item of candidates) {
    if (excess <= 0) {
      break;
    }
    moves.push({
      taskId: item.id,
      title: item.title,
      prevBlockId: block.id,
      nextBlockId: nextBlock.id,
    });
    excess -= Math.max(5, item.estimate_min) + 5;
  }
  return moves;
}

export function computeSunX(
  displayMin: number,
  blocks: WaqtBlockView[],
  fallbackStartMin: number,
  fallbackEndMin: number,
): number {
  if (blocks.length === 0) {
    const span = Math.max(1, fallbackEndMin - fallbackStartMin);
    const t = Math.max(0, Math.min(1, (displayMin - fallbackStartMin) / span));
    return t * WAQT_RAIL_W;
  }
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const segStartX = i * (WAQT_SEGMENT_W + WAQT_SEGMENT_GAP);
    if (displayMin <= b.start_min && i === 0) {
      return segStartX;
    }
    if (displayMin >= b.start_min && displayMin <= b.end_min) {
      const frac = (displayMin - b.start_min) / Math.max(1, b.end_min - b.start_min);
      return segStartX + Math.max(0, Math.min(1, frac)) * WAQT_SEGMENT_W;
    }
    if (i < blocks.length - 1 && displayMin > b.end_min && displayMin < blocks[i + 1].start_min) {
      return segStartX + WAQT_SEGMENT_W;
    }
  }
  return (blocks.length - 1) * (WAQT_SEGMENT_W + WAQT_SEGMENT_GAP) + WAQT_SEGMENT_W;
}

export function scrubXToMinutes(
  offsetX: number,
  blocks: WaqtBlockView[],
  fallbackStartMin: number,
  fallbackEndMin: number,
): number {
  if (blocks.length === 0) {
    const frac = Math.max(0, Math.min(1, offsetX / WAQT_RAIL_W));
    return snapScrubMinutes(
      fallbackStartMin + frac * (fallbackEndMin - fallbackStartMin),
      fallbackStartMin,
      fallbackEndMin,
    );
  }
  const clampedX = Math.max(0, Math.min(WAQT_RAIL_W, offsetX));
  const stride = WAQT_SEGMENT_W + WAQT_SEGMENT_GAP;
  const idx = Math.max(0, Math.min(blocks.length - 1, Math.floor(clampedX / stride)));
  const b = blocks[idx];
  const localX = Math.max(0, Math.min(WAQT_SEGMENT_W, clampedX - idx * stride));
  const frac = localX / WAQT_SEGMENT_W;
  return snapScrubMinutes(
    b.start_min + frac * (b.end_min - b.start_min),
    blocks[0].start_min,
    blocks[blocks.length - 1].end_min,
  );
}

/**
 * Pure frontend mirror of `lumen_storage::waqt::compute_waqt_timeline`
 * used when `waqtState` has not arrived from Rust yet (e.g. Vitest or browser preview).
 */
export function buildClientWaqtFallback(params: {
  nowDate: Date;
  schedule: PrayerSchedule | null;
  tasks: TaskItem[];
  calendarEvents: CalendarEvent[];
  pomodoro: PomodoroSnapshot;
  waterTodayMl: number;
  waterGoalMl?: number;
  bedtimeHHMM: string;
  ramadanTaraweeh: boolean;
  locationConfigured: boolean;
  customBlockNames: Record<string, string>;
  quietMode?: boolean;
  rhythmAnchors?: WaqtRhythmAnchor[];
  dismissedSuggestions?: string[];
  recentSuggestionTexts?: string[];
}): WaqtTimelineState {
  const {
    nowDate,
    schedule,
    tasks,
    calendarEvents,
    pomodoro,
    waterTodayMl,
    waterGoalMl = 1500,
    bedtimeHHMM,
    ramadanTaraweeh,
    locationConfigured,
    customBlockNames,
    quietMode = false,
    rhythmAnchors = [],
    dismissedSuggestions = [],
    recentSuggestionTexts = [],
  } = params;

  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const isFriday = schedule?.is_friday ?? nowDate.getDay() === 5;
  const isRamadan = schedule?.is_ramadan ?? false;
  const slots =
    locationConfigured && schedule && schedule.slots.length >= 5
      ? schedule.slots
      : [
          { id: "fajr", name_en: "Fajr", minute_of_day: 6 * 60 },
          { id: "dhuhr", name_en: "Dhuhr", minute_of_day: 12 * 60 },
          { id: "asr", name_en: "Asr", minute_of_day: 16 * 60 },
          { id: "maghrib", name_en: "Maghrib", minute_of_day: 18 * 60 },
          { id: "isha", name_en: "Isha", minute_of_day: 20 * 60 },
        ];

  const fajrMin = slots[0].minute_of_day;
  const dhuhrMin = slots[1].minute_of_day;
  const asrMin = slots[2].minute_of_day;
  const maghribMin = slots[3].minute_of_day;
  const ishaMin = slots[4].minute_of_day;
  const isAfterIsha = nowMin >= ishaMin;

  const rawBed = parseHHMM(bedtimeHHMM, 23 * 60 + 30);
  const nightEnd = rawBed <= ishaMin ? Math.max(ishaMin + 60, rawBed + 24 * 60) : rawBed;

  const defs = [
    {
      id: "fajr",
      defaultName: "Morning",
      prayerLabel: `Fajr ${formatMinClock12(fajrMin)}`,
      startMin: fajrMin,
      endMin: dhuhrMin,
    },
    {
      id: "dhuhr",
      defaultName: isFriday ? "Jumu'ah" : "Midday",
      prayerLabel: `${isFriday ? "Jumu'ah" : "Dhuhr"} ${formatMinClock12(dhuhrMin)}`,
      startMin: dhuhrMin,
      endMin: asrMin,
    },
    {
      id: "asr",
      defaultName: "Afternoon",
      prayerLabel: `Asr ${formatMinClock12(asrMin)}`,
      startMin: asrMin,
      endMin: maghribMin,
    },
    {
      id: "maghrib",
      defaultName: "Evening",
      prayerLabel: `Maghrib ${formatMinClock12(maghribMin)}`,
      startMin: maghribMin,
      endMin: ishaMin,
    },
    {
      id: "isha",
      defaultName: isRamadan && ramadanTaraweeh ? "Taraweeh" : "Night",
      prayerLabel: `Isha ${formatMinClock12(ishaMin)}`,
      startMin: ishaMin,
      endMin: nightEnd,
    },
  ];

  const inferId = (min: number) => {
    const match = defs.find((d) => min >= d.startMin && min < d.endMin);
    if (match) return match.id;
    return min < defs[0].startMin ? defs[0].id : defs[defs.length - 1].id;
  };

  const mapItems: Record<string, WaqtBlockItem[]> = {};
  const unplanned: TaskItem[] = [];
  const tomorrowTasks: WaqtBlockItem[] = [];
  let activeTasks = 0;
  let doneTasks = 0;

  for (const t of tasks) {
    if (t.block_id?.startsWith("tomorrow:")) {
      const targetDayBlk = t.block_id.slice("tomorrow:".length);
      tomorrowTasks.push({
        id: t.id,
        title: t.title,
        kind: t.kind ?? "task",
        source: t.source ?? "local",
        estimate_min: Math.max(5, t.estimate_min ?? 25),
        done: t.done,
        done_at: t.done_at ?? null,
        fixed: Boolean(t.fixed),
        start_at: targetDayBlk,
        slot_start_min: fajrMin,
        slot_end_min: fajrMin + Math.max(5, t.estimate_min ?? 25),
        client: t.client ?? null,
        calendar_event_id: t.calendar_event_id ?? null,
        sort_order: t.sort_order ?? t.id,
      });
      continue;
    }

    if (t.done) doneTasks += 1;
    else activeTasks += 1;

    const startMin = parseClockMinutes(t.start_at);
    const bid = t.block_id ?? (startMin !== null ? inferId(startMin) : null);
    if (!bid) {
      unplanned.push(t);
      continue;
    }
    const blkStart = defs.find((d) => d.id === bid)?.startMin ?? fajrMin;
    const est = Math.max(5, t.estimate_min ?? 25);
    mapItems[bid] ??= [];
    mapItems[bid].push({
      id: t.id,
      title: t.title,
      kind: t.kind ?? "task",
      source: t.source ?? "local",
      estimate_min: est,
      done: t.done,
      done_at: t.done_at ?? null,
      fixed: Boolean(t.fixed),
      start_at: t.start_at ?? null,
      slot_start_min: startMin ?? blkStart,
      slot_end_min: (startMin ?? blkStart) + est,
      client: t.client ?? null,
      calendar_event_id: t.calendar_event_id ?? null,
      sort_order: t.sort_order ?? t.id,
    });
  }

  for (const ev of calendarEvents) {
    if (tasks.some((t) => t.calendar_event_id === ev.id)) continue;
    const sMin = parseClockMinutes(ev.start_at) ?? dhuhrMin;
    const bid = inferId(sMin);
    mapItems[bid] ??= [];
    mapItems[bid].push({
      id: -ev.id,
      title: ev.title,
      kind: "meeting",
      source: "calendar",
      estimate_min: 30,
      done: nowMin >= sMin + 30,
      done_at: null,
      fixed: true,
      start_at: ev.start_at,
      slot_start_min: sMin,
      slot_end_min: sMin + 30,
      client: null,
      calendar_event_id: ev.id,
      sort_order: sMin,
    });
  }

  let activeBlockId = "isha";
  let currentIdx = defs.length - 1;

  const blocks: WaqtBlockView[] = defs.map((d, idx) => {
    const isCurrent =
      (nowMin >= d.startMin && nowMin < d.endMin) ||
      (idx === 0 && nowMin < d.startMin) ||
      (idx === defs.length - 1 && nowMin >= d.startMin);
    if (isCurrent) {
      activeBlockId = d.id;
      currentIdx = idx;
    }
    const isPast = nowMin >= d.endMin && idx < defs.length - 1;
    const duration = Math.max(1, d.endMin - d.startMin);
    const remainingMin = Math.max(0, d.endMin - nowMin);
    const items = (mapItems[d.id] ?? []).sort(
      (a, b) => Number(b.fixed) - Number(a.fixed) || a.sort_order - b.sort_order || a.id - b.id,
    );
    const used = items.reduce(
      (acc, it) => acc + Math.max(5, it.estimate_min) + (it.fixed ? 0 : 5),
      0,
    );
    const effWindow = isCurrent ? Math.max(15, remainingMin) : duration;
    const freeCap = effWindow - used;
    const status = freeCap < 0 ? "overbooked" : freeCap < 15 ? "tight" : "free";
    const fillPct = Math.max(0, Math.min(100, Math.round((used / Math.max(1, effWindow)) * 100)));
    const lengthHint = freeCap >= 90 ? "deep_work" : freeCap >= 30 ? "quick_tasks" : "short_break";

    const statusText = isPast
      ? pomodoro.daily_focus_minutes > 0 && idx === 0
        ? `Done · focus ${formatDurationCompact(pomodoro.daily_focus_minutes)}`
        : "Done · Prayer ✓"
      : status === "overbooked"
        ? "No room"
        : status === "tight"
          ? "Almost full"
          : isCurrent
            ? `${formatDurationCompact(remainingMin)} left`
            : items.length === 0
              ? `Free ${formatDurationCompact(freeCap)}`
              : `${formatDurationCompact(freeCap)} free`;

    const customName = customBlockNames[d.id]?.trim();
    const blockRhythm: WaqtGhostAnchor[] = rhythmAnchors
      .filter((a) => a.enabled && a.blockId === d.id)
      .filter((a) => !items.some((it) => it.title.toLowerCase() === a.title.toLowerCase()))
      .map((a) => ({
        id: a.id,
        title: a.title,
        kind: a.kind,
        estimate_min: Math.max(5, a.estimateMin),
        block_id: a.blockId,
        progress_label: a.kind === "water" ? `${waterTodayMl}/${waterGoalMl} ml` : null,
        is_user_template: a.isUserTemplate,
      }));

    return {
      id: d.id,
      default_name: d.defaultName,
      name: customName || d.defaultName,
      prayer_label: d.prayerLabel,
      start_min: d.startMin,
      end_min: d.endMin,
      range_label:
        d.id === "isha"
          ? `${formatMinClock12(d.startMin)} – bed`
          : `${formatMinClock12(d.startMin)} – ${formatMinClock12(d.endMin)}`,
      is_past: isPast,
      is_current: isCurrent,
      fill_ratio_pct: fillPct,
      remaining_min: remainingMin,
      free_capacity_min: freeCap,
      used_capacity_min: used,
      capacity_status: status,
      length_hint_kind: lengthHint,
      focus_minutes: 0,
      logged_focus_min: isPast ? 40 : 0,
      logged_prayer_done: isPast,
      status_text: statusText,
      items,
      suggestion: null,
      rhythm_anchors: blockRhythm,
    };
  });

  // Deterministic suggestions on current & next block only (when quietMode == false)
  if (!quietMode) {
    const dismissedSet = new Set(dismissedSuggestions);
    const recentSet = new Set(recentSuggestionTexts.map((s) => s.toLowerCase()));
    const usedTasks = new Set<number>();
    const usedTexts = new Set<string>();
    const todayYmd = nowDate.toISOString().slice(0, 10);

    for (const idx of [currentIdx, currentIdx + 1]) {
      const blk = blocks[idx];
      if (!blk || dismissedSet.has(`block:${blk.id}`)) continue;
      const cands: WaqtSuggestion[] = [];
      for (const t of unplanned.filter((u) => !u.done)) {
        if (t.due_at?.startsWith(todayYmd)) {
          cands.push({
            id: `due:${blk.id}:${t.id}`,
            text: `${t.title} · ${t.estimate_min ?? 25}m`,
            source: "due_today",
            kind: t.kind ?? "task",
            estimate_min: t.estimate_min ?? 25,
            task_id: t.id,
            block_id: blk.id,
          });
        }
      }
      const hasCal = blk.items.some((i) => i.source === "calendar");
      if (hasCal || blk.free_capacity_min >= 30) {
        const gapOptions: Array<[string, number, string, string]> =
          blk.free_capacity_min >= 90
            ? [
                ["Deep work · 60m", 60, "deep_work", "task"],
                ["Focus sprint · 45m", 45, "focus_sprint", "task"],
                ["Plan milestone · 30m", 30, "milestone", "task"],
              ]
            : blk.free_capacity_min >= 30
              ? [
                  ["Quick tasks · 20m", 20, "quick_tasks", "task"],
                  ["Inbox sweep · 15m", 15, "inbox_sweep", "task"],
                ]
              : [
                  ["Break / walk · 10m", 10, "short_break", "habit"],
                  ["Screen rest · 5m", 5, "screen_rest", "habit"],
                ];
        for (const [text, est, slug, kind] of gapOptions) {
          cands.push({
            id: `gap:${blk.id}:${slug}`,
            text,
            source: "calendar_gap",
            kind,
            estimate_min: est,
            task_id: null,
            block_id: blk.id,
          });
        }
      }
      for (const t of unplanned.filter((u) => !u.done)) {
        if ((t.estimate_min ?? 25) + 5 <= blk.free_capacity_min) {
          cands.push({
            id: `inbox:${blk.id}:${t.id}`,
            text: `${t.title} · ${t.estimate_min ?? 25}m`,
            source: "inbox",
            kind: t.kind ?? "task",
            estimate_min: t.estimate_min ?? 25,
            task_id: t.id,
            block_id: blk.id,
          });
        }
      }
      for (const r of blk.rhythm_anchors) {
        cands.push({
          id: `rhythm:${blk.id}:${r.id}`,
          text: r.title,
          source: "rhythm",
          kind: r.kind,
          estimate_min: r.estimate_min,
          task_id: null,
          block_id: blk.id,
        });
      }
      for (const cand of cands) {
        const lower = cand.text.toLowerCase();
        if (dismissedSet.has(cand.id) || recentSet.has(lower) || usedTexts.has(lower)) continue;
        if (cand.task_id !== null && usedTasks.has(cand.task_id)) continue;
        if (cand.task_id !== null) usedTasks.add(cand.task_id);
        usedTexts.add(lower);
        blk.suggestion = cand;
        break;
      }
    }
  }

  // Plan my day deterministic preview
  const remFree = blocks
    .map((b, idx) => ({ idx, b, rem: b.free_capacity_min }))
    .filter((entry) => !entry.b.is_past);
  const planPreview: WaqtPlanAssignment[] = [];
  for (const t of unplanned.filter((u) => !u.done)) {
    const est = Math.max(5, t.estimate_min ?? 25);
    const need = est + 5;
    let best: (typeof remFree)[number] | null = null;
    let bestWaste = Number.POSITIVE_INFINITY;
    for (const slot of remFree) {
      if (slot.rem >= need && slot.rem - need < bestWaste) {
        bestWaste = slot.rem - need;
        best = slot;
      }
    }
    if (best) {
      best.rem -= need;
      planPreview.push({
        task_id: t.id,
        task_title: t.title,
        prev_block_id: t.block_id ?? null,
        target_block_id: best.b.id,
        target_block_name: best.b.name,
        estimate_min: est,
      });
    }
  }

  const orderedUndone = blocks
    .filter((b) => !b.is_past)
    .flatMap((b) => b.items)
    .filter((i) => !i.done && i.id > 0);

  const totalPlanned = blocks
    .filter((b) => !b.is_past)
    .reduce((acc, b) => acc + b.used_capacity_min, 0);
  const totalFree = blocks
    .filter((b) => !b.is_past)
    .reduce((acc, b) => acc + Math.max(0, b.free_capacity_min), 0);
  const totalDeficit = blocks
    .filter((b) => !b.is_past && b.free_capacity_min < 0)
    .reduce((acc, b) => acc + -b.free_capacity_min, 0);
  const dayIsOverbooked = totalDeficit > 0 && totalDeficit >= totalFree;

  const nextAnchor = slots.find((s) => s.minute_of_day > nowMin) ?? slots[0];
  const nextInMin =
    nextAnchor.minute_of_day > nowMin
      ? nextAnchor.minute_of_day - nowMin
      : nextAnchor.minute_of_day + 1440 - nowMin;

  const sunPct = Math.max(
    0,
    Math.min(100, Math.round(((nowMin - fajrMin) / Math.max(1, nightEnd - fajrMin)) * 100)),
  );

  const tomorrowBlocks: WaqtTomorrowBlock[] = blocks.map((b) => ({
    id: b.id,
    name: b.name,
    range_label: b.range_label,
    task_count: tomorrowTasks.filter((t) => t.start_at === b.id).length,
  }));

  return {
    date_label: nowDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    now_min: nowMin,
    rail_start_min: fajrMin,
    rail_end_min: nightEnd,
    sun_progress_pct: sunPct,
    is_friday: isFriday,
    is_ramadan: isRamadan,
    is_after_isha: isAfterIsha,
    all_tasks_done:
      activeTasks === 0 && (doneTasks > 0 || blocks.some((b) => b.items.some((i) => i.done))),
    sehri_min: schedule?.sehri_min ?? fajrMin,
    iftar_min: schedule?.iftar_min ?? maghribMin,
    location_configured: locationConfigured,
    active_block_id: activeBlockId,
    next_prayer_name: nextAnchor.name_en,
    next_prayer_in_min: nextInMin,
    current_focus_task_id: orderedUndone[0]?.id ?? null,
    focus_next_task_id: orderedUndone[1]?.id ?? null,
    focus_next_task_title: orderedUndone[1]?.title ?? null,
    yesterday_rollover_count: 0,
    total_focus_min: pomodoro.daily_focus_minutes,
    total_planned_min: totalPlanned,
    total_free_min: totalFree,
    day_is_overbooked: dayIsOverbooked,
    prayers_done_count: slots.filter((s) => s.minute_of_day <= nowMin).length,
    water_today_ml: waterTodayMl,
    water_goal_ml: waterGoalMl,
    focus_bars:
      pomodoro.daily_focus_minutes > 0
        ? [28, 64, 48, 86, 40, 22, 68, 92, 54, 46]
        : [12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
    blocks,
    unplanned,
    tomorrow_blocks: tomorrowBlocks,
    tomorrow_tasks: tomorrowTasks,
    plan_my_day_preview: planPreview,
    activity_log: [],
  };
}

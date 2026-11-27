import type {
  ActivityLogItem,
  CalendarEvent,
  PomodoroSnapshot,
  PrayerSchedule,
  TaskItem,
  WaqtBlockItem,
  WaqtBlockView,
  WaqtTimelineState,
} from "../lib/ipc";

export function parseHhmmMinutes(hhmm: string | undefined, fallbackMin: number): number {
  if (!hhmm) return fallbackMin;
  const parts = hhmm.trim().split(":");
  if (parts.length !== 2) return fallbackMin;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallbackMin;
  }
  return Math.floor(h) * 60 + Math.floor(m);
}

export function formatMinClock12(minOfDay: number, withSuffix = false): string {
  const wrapped = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const base = `${h12}:${String(m).padStart(2, "0")}`;
  return withSuffix ? `${base} ${h24 >= 12 ? "PM" : "AM"}` : base;
}

export function formatShortDuration(totalMin: number): string {
  const safe = Math.max(0, Math.round(totalMin));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/**
 * Pure client-side Waqt timeline derivation (used seamlessly when running in Vite / Vitest mock mode
 * and for real-time 5-min scrub / 5s Replay Day projections without mutating SQLite).
 */
export function buildFallbackWaqtState(input: {
  nowDate: Date;
  schedule: PrayerSchedule | null;
  tasks: TaskItem[];
  calendarEvents: CalendarEvent[];
  pomodoro: PomodoroSnapshot | null;
  waterTodayMl: number;
  customBlockNames?: Record<string, string>;
  bedtimeHHMM?: string;
  ramadanTaraweeh?: boolean;
  locationConfigured?: boolean;
  currentFocusTaskId?: number | null;
  activityLog?: ActivityLogItem[];
}): WaqtTimelineState {
  const {
    nowDate,
    schedule,
    tasks,
    calendarEvents,
    pomodoro,
    waterTodayMl,
    customBlockNames = {},
    bedtimeHHMM = "23:30",
    ramadanTaraweeh = false,
    locationConfigured = true,
    currentFocusTaskId = null,
    activityLog = [],
  } = input;

  const nowMinRaw = nowDate.getHours() * 60 + nowDate.getMinutes();
  const dateLabel = nowDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const isFriday = schedule?.is_friday ?? nowDate.getDay() === 5;
  const isRamadan = schedule?.is_ramadan ?? false;

  const fallbackSlots = [
    { id: "fajr", label: "Fajr", minute: 304 },
    { id: "dhuhr", label: isFriday ? "Jumu'ah" : "Dhuhr", minute: 710 },
    { id: "asr", label: "Asr", minute: 940 },
    { id: "maghrib", label: "Maghrib", minute: 1036 },
    { id: "isha", label: "Isha", minute: 1115 },
  ];

  const slots =
    locationConfigured && schedule && schedule.slots.length >= 5
      ? schedule.slots.slice(0, 5).map((s) => ({
          id: s.id,
          label: s.name_en,
          minute: s.minute_of_day,
        }))
      : fallbackSlots;

  const fajrMin = slots[0].minute;
  const dhuhrMin = slots[1].minute;
  const asrMin = slots[2].minute;
  const maghribMin = slots[3].minute;
  const ishaMin = slots[4].minute;

  let bedtimeMin = parseHhmmMinutes(bedtimeHHMM, 23 * 60 + 30);
  if (bedtimeMin <= ishaMin) bedtimeMin += 1440;

  const specs: Array<{
    id: string;
    defaultName: string;
    prayerLabel: string;
    start: number;
    end: number;
  }> = [
    {
      id: "fajr",
      defaultName: "Morning",
      prayerLabel: `Fajr ${formatMinClock12(fajrMin)}`,
      start: fajrMin,
      end: dhuhrMin,
    },
    {
      id: "dhuhr",
      defaultName: isFriday ? "Jumu'ah" : "Midday",
      prayerLabel: `${slots[1].label} ${formatMinClock12(dhuhrMin)}`,
      start: dhuhrMin,
      end: asrMin,
    },
    {
      id: "asr",
      defaultName: "Afternoon",
      prayerLabel: `Asr ${formatMinClock12(asrMin)}`,
      start: asrMin,
      end: maghribMin,
    },
    {
      id: "maghrib",
      defaultName: "Evening",
      prayerLabel: `Maghrib ${formatMinClock12(maghribMin)}`,
      start: maghribMin,
      end: ishaMin,
    },
  ];

  const taraweehStart = ishaMin + 25;
  if (isRamadan && ramadanTaraweeh && bedtimeMin > taraweehStart + 30) {
    specs.push({
      id: "isha",
      defaultName: "Night",
      prayerLabel: `Isha ${formatMinClock12(ishaMin)}`,
      start: ishaMin,
      end: taraweehStart,
    });
    specs.push({
      id: "taraweeh",
      defaultName: "Taraweeh",
      prayerLabel: `Taraweeh ${formatMinClock12(taraweehStart)}`,
      start: taraweehStart,
      end: bedtimeMin,
    });
  } else {
    specs.push({
      id: "isha",
      defaultName: "Night",
      prayerLabel: `Isha ${formatMinClock12(ishaMin)}`,
      start: ishaMin,
      end: bedtimeMin,
    });
  }

  const railStartMin = fajrMin;
  const railEndMin = Math.max(bedtimeMin, ishaMin + 60);
  const railSpan = Math.max(60, railEndMin - railStartMin);
  const effectiveNow = nowMinRaw < fajrMin ? nowMinRaw + 1440 : nowMinRaw;

  const activeSpec = specs.find((s) => effectiveNow >= s.start && effectiveNow < s.end) ?? specs[0];

  const blocks: WaqtBlockView[] = specs.map((spec, idx) => {
    const duration = Math.max(15, spec.end - spec.start);
    const isPast = effectiveNow >= spec.end;
    const isCurrent = spec.id === activeSpec.id && !isPast && effectiveNow >= spec.start;
    const remainingMin = isPast ? 0 : isCurrent ? Math.max(0, spec.end - effectiveNow) : duration;
    const fillPct = isPast
      ? 100
      : isCurrent
        ? Math.min(100, Math.max(2, Math.round(((effectiveNow - spec.start) * 100) / duration)))
        : 0;

    const assigned = tasks.filter((t) => t.block_id === spec.id);
    const items: WaqtBlockItem[] = [];

    for (const ev of calendarEvents) {
      const dt = new Date(ev.start_at);
      if (Number.isNaN(dt.getTime())) continue;
      let evMin = dt.getHours() * 60 + dt.getMinutes();
      if (evMin < fajrMin) evMin += 1440;
      if (evMin >= spec.start && evMin < spec.end) {
        items.push({
          id: -ev.id,
          title: ev.title,
          kind: "meeting",
          source: "calendar",
          estimate_min: 30,
          done: evMin + 30 <= effectiveNow,
          done_at: null,
          fixed: true,
          start_at: formatMinClock12(evMin),
          slot_start_min: evMin,
          slot_end_min: evMin + 30,
          client: null,
          calendar_event_id: ev.id,
          sort_order: evMin,
        });
      }
    }

    let cursor = Math.max(spec.start, isCurrent ? effectiveNow : spec.start);
    for (const t of assigned) {
      const est = Math.min(240, Math.max(5, t.estimate_min ?? 25));
      const fixedMin = t.fixed && t.start_at ? parseHhmmMinutes(t.start_at, cursor) : null;
      const startM = fixedMin !== null ? (fixedMin < fajrMin ? fixedMin + 1440 : fixedMin) : cursor;
      items.push({
        id: t.id,
        title: t.title,
        kind: t.kind ?? "task",
        source: t.source ?? "local",
        estimate_min: est,
        done: t.done,
        done_at: t.done_at ?? null,
        fixed: Boolean(t.fixed),
        start_at: t.start_at ?? null,
        slot_start_min: startM,
        slot_end_min: startM + est,
        client: t.client ?? null,
        calendar_event_id: t.calendar_event_id ?? null,
        sort_order: t.sort_order ?? t.id,
      });
      if (!t.fixed) {
        cursor = startM + est + 5;
      }
    }

    items.sort((a, b) => Number(a.done) - Number(b.done) || a.slot_start_min - b.slot_start_min);

    const usedCap = items
      .filter((i) => !i.done)
      .reduce((acc, i) => acc + i.estimate_min + (i.fixed ? 0 : 5), 0);
    const freeCap = duration - usedCap;
    const capacityStatus = freeCap < 0 ? "overbooked" : freeCap < 15 ? "tight" : "free";

    const nextPrayerLabel = specs[idx + 1]?.prayerLabel.split(" ")[0] ?? "end";
    const statusText = isPast
      ? "Done"
      : capacityStatus === "overbooked"
        ? `No room before ${nextPrayerLabel}`
        : isCurrent
          ? `${formatShortDuration(remainingMin)} left`
          : items.length === 0
            ? "Open"
            : `${formatShortDuration(freeCap)} free`;

    const rangeLabel =
      idx === specs.length - 1
        ? `${formatMinClock12(spec.start)} – bed`
        : `${formatMinClock12(spec.start)} – ${formatMinClock12(spec.end)}`;

    return {
      id: spec.id,
      default_name: spec.defaultName,
      name: customBlockNames[spec.id]?.trim() || spec.defaultName,
      prayer_label: spec.prayerLabel,
      start_min: spec.start,
      end_min: spec.end,
      range_label: rangeLabel,
      is_past: isPast,
      is_current: isCurrent,
      fill_ratio_pct: fillPct,
      remaining_min: remainingMin,
      free_capacity_min: freeCap,
      used_capacity_min: usedCap,
      capacity_status: capacityStatus,
      focus_minutes: 0,
      status_text: statusText,
      items,
    };
  });

  const focusBars: number[] = [];
  for (let idx = 0; idx < 10; idx += 1) {
    const activeIdx = Math.min(
      9,
      Math.max(0, Math.floor(((effectiveNow - railStartMin) * 10) / railSpan)),
    );
    if (idx > activeIdx) {
      focusBars.push(0);
      continue;
    }
    const binStart = railStartMin + (idx * railSpan) / 10;
    const binEnd = railStartMin + ((idx + 1) * railSpan) / 10;
    let sum = 0;
    for (const log of activityLog) {
      if (log.kind !== "focus") continue;
      const st = new Date(log.start_at);
      if (Number.isNaN(st.getTime())) continue;
      let m = st.getHours() * 60 + st.getMinutes();
      if (m < fajrMin) m += 1440;
      if (m >= binStart && m < binEnd) {
        sum += 20;
      }
    }
    focusBars.push(sum);
  }

  const totalFocusMin = pomodoro?.daily_focus_minutes ?? 0;
  const loggedBarsSum = focusBars.reduce((acc, v) => acc + v, 0);
  if (totalFocusMin > 0 && loggedBarsSum === 0) {
    const curBin = Math.min(
      9,
      Math.max(0, Math.floor(((effectiveNow - railStartMin) * 10) / railSpan)),
    );
    focusBars[curBin] = totalFocusMin;
  }

  const nextSlot = slots.find((s) => s.minute > nowMinRaw) ?? slots[0];
  const nextDiff =
    nextSlot.minute >= nowMinRaw ? nextSlot.minute - nowMinRaw : nextSlot.minute + 1440 - nowMinRaw;

  return {
    date_label: dateLabel,
    now_min: effectiveNow,
    rail_start_min: railStartMin,
    rail_end_min: railEndMin,
    sun_progress_pct: Math.min(
      100,
      Math.max(0, Math.round(((effectiveNow - railStartMin) * 100) / railSpan)),
    ),
    is_friday: isFriday,
    is_ramadan: isRamadan,
    sehri_min: schedule?.sehri_min ?? fajrMin,
    iftar_min: schedule?.iftar_min ?? maghribMin,
    location_configured: locationConfigured,
    active_block_id: activeSpec.id,
    next_prayer_name: nextSlot.label,
    next_prayer_in_min: nextDiff,
    current_focus_task_id: currentFocusTaskId,
    yesterday_rollover_count: 0,
    total_focus_min: totalFocusMin,
    prayers_done_count: slots.filter((s) => s.minute <= nowMinRaw).length,
    water_today_ml: waterTodayMl,
    focus_bars: focusBars,
    blocks,
    unplanned: tasks.filter((t) => !t.block_id && !t.done),
    activity_log: activityLog,
  };
}

/**
 * Projects an existing `WaqtTimelineState` onto a scrubbed or replayed minute of the day,
 * showing block past/current/future states & tooltip summary in real time.
 */
export function projectWaqtAtMinute(
  base: WaqtTimelineState,
  targetMin: number,
): { state: WaqtTimelineState; tooltipDetail: string } {
  const clamped = Math.max(base.rail_start_min, Math.min(base.rail_end_min, targetMin));
  const railSpan = Math.max(60, base.rail_end_min - base.rail_start_min);

  const projectedBlocks = base.blocks.map((block) => {
    const duration = Math.max(15, block.end_min - block.start_min);
    const isPast = clamped >= block.end_min;
    const isCurrent = clamped >= block.start_min && clamped < block.end_min;
    const remainingMin = isPast ? 0 : isCurrent ? Math.max(0, block.end_min - clamped) : duration;
    const fillPct = isPast
      ? 100
      : isCurrent
        ? Math.min(100, Math.max(2, Math.round(((clamped - block.start_min) * 100) / duration)))
        : 0;

    const projectedItems = block.items.map((item) => {
      const doneAtTime = item.done_at
        ? (() => {
            const dt = new Date(item.done_at);
            if (Number.isNaN(dt.getTime())) return item.done;
            let m = dt.getHours() * 60 + dt.getMinutes();
            if (m < base.rail_start_min) m += 1440;
            return m <= clamped;
          })()
        : isPast
          ? item.done
          : item.done && item.slot_end_min <= clamped;
      return {
        ...item,
        done: doneAtTime,
      };
    });

    return {
      ...block,
      is_past: isPast,
      is_current: isCurrent,
      fill_ratio_pct: fillPct,
      remaining_min: remainingMin,
      items: projectedItems,
    };
  });

  const activeBlock =
    projectedBlocks.find((b) => b.is_current) ??
    projectedBlocks[projectedBlocks.length - 1] ??
    projectedBlocks[0];

  const matchingLog = base.activity_log.find((log) => {
    const st = new Date(log.start_at);
    if (Number.isNaN(st.getTime())) return false;
    let sMin = st.getHours() * 60 + st.getMinutes();
    if (sMin < base.rail_start_min) sMin += 1440;
    const endDt = log.end_at ? new Date(log.end_at) : null;
    let eMin =
      endDt && !Number.isNaN(endDt.getTime())
        ? endDt.getHours() * 60 + endDt.getMinutes()
        : sMin + 25;
    if (eMin < base.rail_start_min) eMin += 1440;
    return clamped >= sMin && clamped <= eMin;
  });

  const activeSlotItem = activeBlock?.items.find(
    (it) => clamped >= it.slot_start_min && clamped <= it.slot_end_min,
  );

  const tooltipDetail = matchingLog
    ? `${matchingLog.kind === "focus" ? "Focus" : matchingLog.kind}: ${matchingLog.note || activeBlock?.name || "Block"}`
    : activeSlotItem
      ? `${activeSlotItem.kind === "meeting" ? "Event" : "Plan"}: ${activeSlotItem.title}`
      : activeBlock
        ? `${activeBlock.name} block`
        : "Timeline";

  return {
    state: {
      ...base,
      now_min: clamped,
      sun_progress_pct: Math.min(
        100,
        Math.max(0, Math.round(((clamped - base.rail_start_min) * 100) / railSpan)),
      ),
      active_block_id: activeBlock?.id ?? base.active_block_id,
      blocks: projectedBlocks,
    },
    tooltipDetail,
  };
}

/**
 * Renders a completely offline, local "Day Wrapped" PNG summary card via HTML Canvas
 * (zero network requests, zero unrequested telemetry).
 */
export async function generateLocalDayWrappedPng(summary: {
  dateLabel: string;
  focusMin: number;
  tasksDone: number;
  prayersCount: number;
  waterMl: number;
}): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 340;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const indigo = ctx.createRadialGradient(90, 310, 10, 90, 310, 260);
  indigo.addColorStop(0, "rgba(94, 92, 230, 0.48)");
  indigo.addColorStop(1, "rgba(94, 92, 230, 0)");
  ctx.fillStyle = indigo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const green = ctx.createRadialGradient(560, 310, 10, 560, 310, 220);
  green.addColorStop(0, "rgba(48, 209, 88, 0.25)");
  green.addColorStop(1, "rgba(48, 209, 88, 0)");
  ctx.fillStyle = green;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const amber = ctx.createRadialGradient(320, 10, 10, 320, 10, 220);
  amber.addColorStop(0, "rgba(255, 176, 32, 0.22)");
  amber.addColorStop(1, "rgba(255, 176, 32, 0)");
  ctx.fillStyle = amber;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 22px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillText("Lumen · Day Wrapped", 34, 52);

  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "400 14px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillText(summary.dateLabel, 34, 76);

  const stats = [
    { label: "Deep Focus", val: formatShortDuration(summary.focusMin), color: "#ffb020" },
    { label: "Tasks Done", val: String(summary.tasksDone), color: "#5e5ce6" },
    { label: "Prayers", val: `${summary.prayersCount}/5`, color: "#30d158" },
    { label: "Hydration", val: `${summary.waterMl} ml`, color: "#5ac8fa" },
  ];

  stats.forEach((st, idx) => {
    const x = 34 + idx * 146;
    const y = 122;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, 134, 146, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = st.color;
    ctx.font = "600 26px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillText(st.val, x + 16, y + 72);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 13px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillText(st.label, x + 16, y + 104);
  });

  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.font = "400 12px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillText("Local-only · Zero telemetry", 34, 308);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

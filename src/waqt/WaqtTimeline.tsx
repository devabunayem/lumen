import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { WaqtBodyDoubleLumi, type WaqtBodyDoubleState } from "../app/LumenMascot";
import { CheckIcon, LockIcon, PlayIcon, SettingsIcon, ShareIcon } from "../design/icons";
import { getMotionTransition, MOTION_PRESETS } from "../design/motion";
import { playUiSound } from "../design/sounds";
import { COLOR_TOKENS } from "../design/tokens";
import type { AppLanguage } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type {
  CalendarEvent,
  PomodoroSnapshot,
  PrayerSchedule,
  TaskItem,
  WaqtBlockItem,
  WaqtTimelineState,
} from "../lib/ipc";
import type { WaqtPrayerPauseMode } from "../settings";
import {
  buildFallbackWaqtState,
  formatMinClock12,
  formatShortDuration,
  generateLocalDayWrappedPng,
  projectWaqtAtMinute,
} from "./waqtEngine";

export interface WaqtTimelineProps {
  waqtState: WaqtTimelineState | null;
  nowDate: Date;
  schedule: PrayerSchedule | null;
  tasks: TaskItem[];
  calendarEvents: CalendarEvent[];
  pomodoro: PomodoroSnapshot;
  waterTodayMl: number;
  language?: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  isVisible: boolean;
  locationConfigured: boolean;
  bedtimeHHMM: string;
  prayerPauseMode: WaqtPrayerPauseMode;
  ramadanTaraweeh: boolean;
  hintDismissed: boolean;
  customBlockNames: Record<string, string>;
  pagesCount: number;
  activePageIndex: number;
  onSelectPage: (idx: number) => void;
  onOpenSettings: () => void;
  onAssignTask: (taskId: number, blockId: string | null, sortOrder?: number) => void;
  onToggleTask: (taskId: number) => void;
  onAddTask: (title: string, blockId: string | null, estimateMin?: number) => void;
  onDeleteTask: (taskId: number) => void;
  onRestoreTask: (task: { title: string; blockId: string | null; estimateMin: number }) => void;
  onChangeEstimate: (taskId: number, estimateMin: number) => void;
  onMoveOverflow: (fromBlockId: string) => void;
  onRenameBlock: (blockId: string, name: string) => void;
  onRolloverYesterday: (accept: boolean) => void;
  onStartFocusFlow: (taskId?: number | null) => void;
  onToggleFocusPause: () => void;
  onResetFocus: () => void;
  onDismissHint: () => void;
  onLogActivity: (kind: string, refId?: string | null, note?: string | null) => void;
}

const RAIL_W = 612;
const RAIL_H = 34;
const SEG_GAP = 8;
const ESTIMATE_OPTIONS = [5, 10, 15, 25, 45, 60] as const;

function kindDotColor(kind: string, done: boolean): string {
  if (done) return COLOR_TOKENS.accentGreen;
  switch (kind) {
    case "meeting":
      return COLOR_TOKENS.waqtMeeting;
    case "habit":
      return COLOR_TOKENS.waqtHabit;
    case "deadline":
      return COLOR_TOKENS.waqtDeadline;
    default:
      return COLOR_TOKENS.waqtTask;
  }
}

export function WaqtTimeline({
  waqtState,
  nowDate,
  schedule,
  tasks,
  calendarEvents,
  pomodoro,
  waterTodayMl,
  language = "en",
  banglaDigits,
  reduceMotion,
  reduceTransparency,
  isVisible,
  locationConfigured,
  bedtimeHHMM,
  prayerPauseMode,
  ramadanTaraweeh,
  hintDismissed,
  customBlockNames,
  pagesCount,
  activePageIndex,
  onSelectPage,
  onOpenSettings,
  onAssignTask,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onRestoreTask,
  onChangeEstimate,
  onMoveOverflow,
  onRenameBlock,
  onRolloverYesterday,
  onStartFocusFlow,
  onToggleFocusPause,
  onResetFocus,
  onDismissHint,
  onLogActivity,
}: WaqtTimelineProps) {
  const isBn = language === "bn";
  const railRef = useRef<SVGSVGElement | null>(null);
  const draggingSunRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  const [scrubMin, setScrubMin] = useState<number | null>(null);
  const [scrubPinned, setScrubPinned] = useState(false);
  const [localHintGone, setLocalHintGone] = useState(hintDismissed);
  const [hoverBlockId, setHoverBlockId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [moveMenuTask, setMoveMenuTask] = useState<WaqtBlockItem | null>(null);
  const [estimateTask, setEstimateTask] = useState<WaqtBlockItem | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState("");
  const [addingUnplanned, setAddingUnplanned] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [undoItem, setUndoItem] = useState<{
    title: string;
    blockId: string | null;
    estimateMin: number;
  } | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayMin, setReplayMin] = useState<number | null>(null);
  const [replaySummaryOpen, setReplaySummaryOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [looksUp, setLooksUp] = useState(false);
  const [justCelebrated, setJustCelebrated] = useState(false);
  const [askedPrayerId, setAskedPrayerId] = useState<string | null>(null);
  const autoPausedPrayerRef = useRef<string | null>(null);

  const fallbackState = useMemo(
    () =>
      buildFallbackWaqtState({
        nowDate,
        schedule,
        tasks,
        calendarEvents,
        pomodoro,
        waterTodayMl,
        customBlockNames,
        bedtimeHHMM,
        ramadanTaraweeh,
        locationConfigured,
      }),
    [
      nowDate,
      schedule,
      tasks,
      calendarEvents,
      pomodoro,
      waterTodayMl,
      customBlockNames,
      bedtimeHHMM,
      ramadanTaraweeh,
      locationConfigured,
    ],
  );

  const baseState = waqtState ?? fallbackState;
  const activeTimeMin = replayMin ?? scrubMin;

  const { state: viewState, tooltipDetail } = useMemo(() => {
    if (activeTimeMin !== null) {
      return projectWaqtAtMinute(baseState, activeTimeMin);
    }
    return { state: baseState, tooltipDetail: "" };
  }, [baseState, activeTimeMin]);

  // Body-double idle look-up timer (after 2 min of no interaction while running focus)
  useEffect(() => {
    if (!isVisible) return;
    const resetIdle = () => {
      setLooksUp(false);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (pomodoro.running) setLooksUp(true);
      }, 120_000);
    };
    resetIdle();
    return () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    };
  }, [isVisible, pomodoro.running]);

  // 5-second ease-in-out Replay Day animation, skippable with Esc
  useEffect(() => {
    if (!replaying) return;
    const firstLogMin = (() => {
      const first = baseState.activity_log[0];
      if (!first) return baseState.rail_start_min;
      const dt = new Date(first.start_at);
      if (Number.isNaN(dt.getTime())) return baseState.rail_start_min;
      let m = dt.getHours() * 60 + dt.getMinutes();
      if (m < baseState.rail_start_min) m += 1440;
      return Math.max(baseState.rail_start_min, Math.min(baseState.now_min, m));
    })();
    const startMs = performance.now();
    const durationMs = reduceMotion ? 400 : 5000;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startMs) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const m = firstLogMin + (baseState.now_min - firstLogMin) * eased;
      setReplayMin(Math.round(m));
      if (t < 1) {
        raf = window.requestAnimationFrame(tick);
      } else {
        setReplaying(false);
        setReplayMin(null);
        setReplaySummaryOpen(true);
      }
    };
    raf = window.requestAnimationFrame(tick);

    const onEsc = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape") {
        setReplaying(false);
        setReplayMin(null);
        setReplaySummaryOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEsc);
    };
  }, [
    replaying,
    baseState.now_min,
    baseState.rail_start_min,
    baseState.activity_log,
    reduceMotion,
  ]);

  // Auto-pause or Ask prompt when prayer arrives during active Focus session
  const prayerArrivedBanner = useMemo(() => {
    if (!pomodoro.running || pomodoro.phase !== "focus") return null;
    if (viewState.next_prayer_in_min <= 1 && askedPrayerId !== viewState.next_prayer_name) {
      if (prayerPauseMode === "ask") {
        return { mode: "ask" as const, prayer: viewState.next_prayer_name };
      }
    }
    return null;
  }, [
    pomodoro.running,
    pomodoro.phase,
    viewState.next_prayer_in_min,
    viewState.next_prayer_name,
    askedPrayerId,
    prayerPauseMode,
  ]);

  useEffect(() => {
    if (
      pomodoro.running &&
      pomodoro.phase === "focus" &&
      prayerPauseMode === "auto_pause" &&
      viewState.next_prayer_in_min <= 1 &&
      autoPausedPrayerRef.current !== viewState.next_prayer_name
    ) {
      autoPausedPrayerRef.current = viewState.next_prayer_name;
      onToggleFocusPause();
      onLogActivity("prayer", viewState.next_prayer_name.toLowerCase(), "Auto-paused focus");
    }
  }, [
    pomodoro.running,
    pomodoro.phase,
    prayerPauseMode,
    viewState.next_prayer_in_min,
    viewState.next_prayer_name,
    onToggleFocusPause,
    onLogActivity,
  ]);

  // Map rail x <-> minute snapped to 5 minutes
  const minuteToRailX = (minVal: number): number => {
    const blocks = viewState.blocks;
    const count = Math.max(1, blocks.length);
    const segW = (RAIL_W - SEG_GAP * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      const b = blocks[i];
      const segStart = i * (segW + SEG_GAP);
      if (minVal <= b.start_min && i === 0) return segStart;
      if (minVal >= b.start_min && minVal <= b.end_min) {
        const u = (minVal - b.start_min) / Math.max(1, b.end_min - b.start_min);
        return segStart + u * segW;
      }
    }
    return RAIL_W;
  };

  const clientXToSnappedMin = (clientX: number): number => {
    const svg = railRef.current;
    if (!svg) return baseState.now_min;
    const rect = svg.getBoundingClientRect();
    const rx = Math.max(
      0,
      Math.min(RAIL_W, ((clientX - rect.left) / Math.max(1, rect.width)) * RAIL_W),
    );
    const blocks = viewState.blocks;
    const count = Math.max(1, blocks.length);
    const segW = (RAIL_W - SEG_GAP * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      const segStart = i * (segW + SEG_GAP);
      const segEnd = segStart + segW;
      if (rx <= segEnd || i === count - 1) {
        const u = Math.max(0, Math.min(1, (rx - segStart) / segW));
        const rawMin = blocks[i].start_min + u * (blocks[i].end_min - blocks[i].start_min);
        return Math.round(rawMin / 5) * 5;
      }
    }
    return baseState.now_min;
  };

  const dismissHintOnce = () => {
    if (!localHintGone) {
      setLocalHintGone(true);
      onDismissHint();
    }
  };

  const handleSunPointerDown = (e: PointerEvent<SVGCircleElement | SVGSVGElement>) => {
    e.stopPropagation();
    draggingSunRef.current = true;
    dismissHintOnce();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setScrubMin(clientXToSnappedMin(e.clientX));
  };

  const handleSunPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingSunRef.current) return;
    setScrubMin(clientXToSnappedMin(e.clientX));
  };

  const handleSunPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!draggingSunRef.current) return;
    draggingSunRef.current = false;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore if capture already released
    }
    if (!scrubPinned) {
      setScrubMin(null);
    }
  };

  const handleRailKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      dismissHintOnce();
      const step = e.key === "ArrowRight" ? 5 : -5;
      const cur = scrubMin ?? baseState.now_min;
      setScrubMin(Math.max(baseState.rail_start_min, Math.min(baseState.rail_end_min, cur + step)));
    } else if (e.key === "Escape") {
      setScrubPinned(false);
      setScrubMin(null);
    }
  };

  const activeFocusTask = useMemo(() => {
    if (viewState.current_focus_task_id) {
      for (const b of viewState.blocks) {
        const hit = b.items.find((i) => i.id === viewState.current_focus_task_id);
        if (hit) return hit;
      }
    }
    const activeBlock = viewState.blocks.find((b) => b.is_current);
    return (
      activeBlock?.items.find((i) => !i.done && i.id > 0) ??
      viewState.blocks.flatMap((b) => b.items).find((i) => !i.done && i.id > 0) ??
      null
    );
  }, [viewState]);

  const bodyDoubleState: WaqtBodyDoubleState = useMemo(() => {
    if (justCelebrated) return "celebrate";
    if (pomodoro.phase !== "focus" && pomodoro.running) return "break";
    if (looksUp) return "looks_up";
    if (pomodoro.running) return "focus";
    return "idle_working";
  }, [justCelebrated, pomodoro.phase, pomodoro.running, looksUp]);

  const handleToggleDone = (item: WaqtBlockItem) => {
    if (item.id <= 0) return;
    void playUiSound("task_done");
    if (!item.done) {
      setJustCelebrated(true);
      window.setTimeout(() => setJustCelebrated(false), 1800);
    }
    onToggleTask(item.id);
  };

  const triggerSwipeDelete = (item: WaqtBlockItem, blockId: string) => {
    if (item.id <= 0) return;
    onDeleteTask(item.id);
    setUndoItem({ title: item.title, blockId, estimateMin: item.estimate_min });
    window.setTimeout(() => {
      setUndoItem((cur) => (cur?.title === item.title ? null : cur));
    }, 5000);
  };

  const handleDropOnBlock = (e: DragEvent<HTMLElement>, targetBlockId: string | null) => {
    e.preventDefault();
    setHoverBlockId(null);
    const idRaw = e.dataTransfer.getData("text/lumen-task-id");
    const taskId = Number(idRaw) || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId || taskId <= 0) return;
    void playUiSound("toggle_on");
    onAssignTask(taskId, targetBlockId);
  };

  const handleShareDayWrapped = async () => {
    const tasksDone = viewState.blocks.reduce(
      (acc, b) => acc + b.items.filter((i) => i.done).length,
      0,
    );
    const blob = await generateLocalDayWrappedPng({
      dateLabel: viewState.date_label,
      focusMin: viewState.total_focus_min,
      tasksDone,
      prayersCount: viewState.prayers_done_count,
      waterMl: viewState.water_today_ml,
    });
    if (!blob) return;
    try {
      if (navigator.clipboard && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setShareStatus(isBn ? "ক্লিপবোর্ডে কপি হয়েছে" : "Copied card to clipboard");
        return;
      }
    } catch {
      // fall through to local file download
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lumen-day-wrapped.png";
    a.click();
    URL.revokeObjectURL(url);
    setShareStatus(isBn ? "লোকাল PNG সেভ হয়েছে" : "Saved Day Wrapped PNG");
  };

  const sunX = minuteToRailX(viewState.now_min);
  const currentBlock = viewState.blocks.find((b) => b.is_current);
  const blockWrapUpSoon =
    pomodoro.running &&
    currentBlock &&
    currentBlock.remaining_min > 0 &&
    currentBlock.remaining_min <= 10;

  const focusTimerLabel = `${String(Math.floor(pomodoro.remaining_secs / 60)).padStart(2, "0")}:${String(
    pomodoro.remaining_secs % 60,
  ).padStart(2, "0")}`;

  const maxSpark = Math.max(15, ...viewState.focus_bars);
  const pageDotIndices = Array.from({ length: Math.max(1, pagesCount) }, (_, idx) => idx);

  return (
    <motion.div
      data-testid="waqt-timeline-page"
      data-reduce-motion={reduceMotion ? "true" : "false"}
      data-reduce-transparency={reduceTransparency ? "true" : "false"}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(8px)", scale: 0.96 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      transition={getMotionTransition("waqtBlurEnter", reduceMotion)}
      className="relative flex h-full w-full flex-col justify-between overflow-hidden px-[14px] pt-[10px] pb-[6px] select-none"
    >
      {/* Ambient edge glows matching visual reference */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -bottom-16 -left-16 h-[190px] w-[240px] rounded-full blur-2xl"
          style={{ background: COLOR_TOKENS.waqtGlowIndigo }}
        />
        <div
          className="absolute -right-12 -bottom-16 h-[170px] w-[210px] rounded-full blur-2xl"
          style={{ background: COLOR_TOKENS.waqtGlowGreen }}
        />
        <div
          className="absolute -top-16 left-1/3 h-[120px] w-[260px] rounded-full blur-2xl"
          style={{ background: COLOR_TOKENS.waqtGlowAmber }}
        />
      </div>

      {/* 1. Header (24px) */}
      <header className="relative z-20 flex h-[24px] items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="m-0 text-[13px] font-semibold tracking-tight text-white">
            {isBn ? "ওয়াক্ত টাইমলাইন" : "Waqt Timeline"}
          </h2>
          <span
            className="text-[11px] font-medium tabular-nums"
            style={{ color: COLOR_TOKENS.arcTimeMuted }}
          >
            {formatDigits(viewState.date_label, banglaDigits)}
          </span>
        </div>

        {/* Center contextual banner or dismissible scrub hint */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {undoItem ? (
            <button
              type="button"
              data-testid="waqt-undo-delete"
              onClick={() => {
                onRestoreTask(undoItem);
                setUndoItem(null);
              }}
              className="home-glass-chip text-[10.5px] font-medium text-white px-2.5 py-0.5"
            >
              {isBn ? "মুছে ফেলা হয়েছে · ফিরিয়ে আনুন" : `Deleted "${undoItem.title}" · Undo`}
            </button>
          ) : prayerArrivedBanner?.mode === "ask" ? (
            <div
              data-testid="waqt-prayer-pause-prompt"
              className="home-glass-chip flex items-center gap-1.5 px-2.5 py-0.5 text-[10.5px] text-white"
            >
              <span>
                {isBn
                  ? `${prayerArrivedBanner.prayer}-এর জন্য ফোকাস থামাবেন?`
                  : `Pause focus for ${prayerArrivedBanner.prayer}?`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAskedPrayerId(prayerArrivedBanner.prayer);
                  onToggleFocusPause();
                  onLogActivity(
                    "prayer",
                    prayerArrivedBanner.prayer.toLowerCase(),
                    "Paused for prayer",
                  );
                }}
                className="font-semibold"
                style={{ color: COLOR_TOKENS.arcProgress }}
              >
                {isBn ? "হ্যাঁ" : "Pause"}
              </button>
              <button
                type="button"
                onClick={() => setAskedPrayerId(prayerArrivedBanner.prayer)}
                style={{ color: COLOR_TOKENS.textSecondary }}
              >
                {isBn ? "না" : "Skip"}
              </button>
            </div>
          ) : blockWrapUpSoon ? (
            <span
              className="home-glass-chip px-2.5 py-0.5 text-[10.5px] font-medium"
              style={{ color: COLOR_TOKENS.arcProgress }}
            >
              {viewState.next_prayer_name} in{" "}
              {formatDigits(currentBlock.remaining_min, banglaDigits)}m: wrap up
            </span>
          ) : viewState.yesterday_rollover_count > 0 ? (
            <div
              data-testid="waqt-rollover-prompt"
              className="home-glass-chip flex items-center gap-1.5 px-2.5 py-0.5 text-[10.5px] text-white"
            >
              <span>
                {isBn
                  ? `গতকালের ${viewState.yesterday_rollover_count}টি কাজ আজকে আনবেন?`
                  : `Move ${viewState.yesterday_rollover_count} tasks to today?`}
              </span>
              <button
                type="button"
                onClick={() => onRolloverYesterday(true)}
                className="font-semibold"
                style={{ color: COLOR_TOKENS.accentGreen }}
              >
                {isBn ? "হ্যাঁ" : "Move"}
              </button>
              <button
                type="button"
                onClick={() => onRolloverYesterday(false)}
                style={{ color: COLOR_TOKENS.textSecondary }}
              >
                ×
              </button>
            </div>
          ) : !viewState.location_configured ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="home-glass-chip px-2.5 py-0.5 text-[10.5px]"
              style={{ color: COLOR_TOKENS.arcProgress }}
            >
              {isBn ? "নামাজের ব্লকের জন্য শহর সেট করুন" : "Set your city for prayer blocks"}
            </button>
          ) : !localHintGone ? (
            <span
              data-testid="waqt-scrub-hint"
              className="truncate text-[10.5px]"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {isBn
                ? "সূর্য টেনে সময় দেখুন · কাজ ব্লকে টেনে নিন"
                : "Drag the sun to scrub · tasks snap into blocks"}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {scrubMin !== null && (
            <button
              type="button"
              data-testid="waqt-pin-scrub"
              aria-label={scrubPinned ? "Unpin scrubbed time" : "Pin scrubbed time"}
              onClick={() => {
                if (scrubPinned) {
                  setScrubPinned(false);
                  setScrubMin(null);
                } else {
                  setScrubPinned(true);
                }
              }}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
              style={{
                background: scrubPinned ? COLOR_TOKENS.arcProgress : COLOR_TOKENS.chipGlassBg,
                color: scrubPinned ? "#000000" : COLOR_TOKENS.textPrimary,
              }}
            >
              <LockIcon size={10} />
            </button>
          )}
          <button
            type="button"
            data-testid="waqt-replay-btn"
            onClick={() => {
              if (replaying) {
                setReplaying(false);
                setReplayMin(null);
              } else {
                setReplaySummaryOpen(false);
                setShareStatus(null);
                setReplaying(true);
              }
            }}
            className="inline-flex h-[22px] items-center gap-1 rounded-full bg-white px-2.5 text-[10.5px] font-semibold text-black transition-transform active:scale-95"
          >
            <PlayIcon size={9} />
            <span>{replaying ? (isBn ? "থামান" : "Skip") : isBn ? "রিপ্লে" : "Replay day"}</span>
          </button>
          <button
            type="button"
            aria-label={isBn ? "সেটিংস খুলুন" : "Open settings"}
            onClick={onOpenSettings}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <SettingsIcon size={13} />
          </button>
        </div>
      </header>

      {/* 2. 5-Segment Waqt Progress Rail + Draggable Sun */}
      <div className="relative z-20 h-[34px] w-full">
        {activeTimeMin !== null && (
          <div
            data-testid="waqt-scrub-tooltip"
            className="pointer-events-none absolute -top-5 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-md tabular-nums"
            style={{
              left: `${Math.max(14, Math.min(86, (sunX / RAIL_W) * 100))}%`,
              background: COLOR_TOKENS.arcTooltipBg,
              border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
            }}
          >
            {formatDigits(formatMinClock12(activeTimeMin, true), banglaDigits)} · {tooltipDetail}
          </div>
        )}

        <svg
          ref={railRef}
          viewBox={`0 0 ${RAIL_W} ${RAIL_H}`}
          tabIndex={0}
          role="slider"
          aria-label="Waqt timeline scrub"
          aria-valuemin={viewState.rail_start_min}
          aria-valuemax={viewState.rail_end_min}
          aria-valuenow={viewState.now_min}
          data-testid="waqt-rail"
          onPointerDown={handleSunPointerDown}
          onPointerMove={handleSunPointerMove}
          onPointerUp={handleSunPointerUp}
          onKeyDown={handleRailKeyDown}
          className="h-[34px] w-full cursor-pointer overflow-visible outline-none"
        >
          {viewState.blocks.map((block, idx) => {
            const count = viewState.blocks.length;
            const segW = (RAIL_W - SEG_GAP * (count - 1)) / count;
            const x = idx * (segW + SEG_GAP);
            const activeW = block.is_past
              ? segW
              : block.is_current
                ? Math.max(4, (segW * block.fill_ratio_pct) / 100)
                : 0;
            return (
              <g key={block.id}>
                <rect
                  x={x}
                  y={9}
                  width={segW}
                  height={5}
                  rx={2.5}
                  fill="rgba(255, 255, 255, 0.2)"
                />
                {activeW > 0 && (
                  <motion.rect
                    x={x}
                    y={9}
                    height={5}
                    rx={2.5}
                    fill={COLOR_TOKENS.arcProgress}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: activeW }}
                    transition={getMotionTransition("waqtRailDraw", reduceMotion)}
                  />
                )}
                <text
                  x={x}
                  y={28}
                  fontSize={10.5}
                  fontWeight={block.is_current ? 600 : 400}
                  fill={block.is_current ? COLOR_TOKENS.arcProgress : COLOR_TOKENS.arcTimeMuted}
                  className="cursor-pointer tabular-nums"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    dismissHintOnce();
                    setScrubMin(block.start_min);
                    setScrubPinned(true);
                  }}
                >
                  {formatDigits(block.prayer_label, banglaDigits)}
                </text>
              </g>
            );
          })}

          {/* Ramadan Sehri & Iftar rail markers */}
          {viewState.is_ramadan && (
            <>
              <circle
                cx={minuteToRailX(viewState.sehri_min)}
                cy={11.5}
                r={2.5}
                fill={COLOR_TOKENS.arcSun}
              />
              <circle
                cx={minuteToRailX(viewState.iftar_min)}
                cy={11.5}
                r={2.5}
                fill={COLOR_TOKENS.arcSun}
              />
            </>
          )}

          {/* Draggable Sun Head */}
          <motion.g
            data-testid="waqt-rail-sun"
            initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={MOTION_PRESETS.bouncy}
          >
            <circle cx={sunX} cy={11.5} r={11.5} fill={COLOR_TOKENS.arcSunHalo} />
            <circle
              cx={sunX}
              cy={11.5}
              r={5.5}
              fill={COLOR_TOKENS.arcSun}
              onPointerDown={handleSunPointerDown}
              className="cursor-grab active:cursor-grabbing"
            />
          </motion.g>
        </svg>
      </div>

      {/* 3. Five Waqt Block Cards (grid-cols-5, compact fits 3 tasks + bar + status) */}
      <div
        className="relative z-20 grid h-[116px] gap-[8px]"
        style={{ gridTemplateColumns: `repeat(${viewState.blocks.length}, minmax(0, 1fr))` }}
      >
        {viewState.blocks.map((block) => {
          const isHovered = hoverBlockId === block.id;
          const visibleItems = block.items.slice(0, 3);
          const overflowCount = Math.max(0, block.items.length - 3);
          const taskRatio =
            block.end_min - block.start_min > 0
              ? Math.min(
                  100,
                  Math.max(
                    block.items.length > 0 ? 12 : 0,
                    Math.round(
                      (block.used_capacity_min * 100) /
                        Math.max(30, block.end_min - block.start_min),
                    ),
                  ),
                )
              : 0;

          return (
            <section
              key={block.id}
              data-testid={`waqt-block-${block.id}`}
              data-current={block.is_current ? "true" : "false"}
              data-past={block.is_past ? "true" : "false"}
              onDragOver={(e) => {
                e.preventDefault();
                if (hoverBlockId !== block.id) setHoverBlockId(block.id);
              }}
              onDragLeave={() => {
                if (hoverBlockId === block.id) setHoverBlockId(null);
              }}
              onDrop={(e) => handleDropOnBlock(e, block.id)}
              className={`home-glass-card relative flex flex-col justify-between overflow-hidden px-[8px] py-[7px] transition-all duration-150 ${
                block.is_past && !block.is_current ? "opacity-[0.68]" : "opacity-100"
              }`}
              style={{
                borderRadius: "var(--waqt-card-radius)",
                borderColor: isHovered
                  ? COLOR_TOKENS.arcProgress
                  : block.is_current
                    ? COLOR_TOKENS.waqtAmberBorder
                    : undefined,
                boxShadow: block.is_current
                  ? `0 0 22px ${COLOR_TOKENS.waqtAmberGlow}`
                  : isHovered
                    ? `0 0 14px ${COLOR_TOKENS.arcSunHalo}`
                    : undefined,
              }}
            >
              {/* Block Card Header */}
              <div>
                <div className="flex items-center justify-between gap-1">
                  {editingBlockId === block.id ? (
                    <input
                      autoFocus
                      value={editingBlockName}
                      onChange={(e) => setEditingBlockName(e.target.value)}
                      onBlur={() => {
                        onRenameBlock(block.id, editingBlockName);
                        setEditingBlockId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameBlock(block.id, editingBlockName);
                          setEditingBlockId(null);
                        } else if (e.key === "Escape") {
                          setEditingBlockId(null);
                        }
                      }}
                      className="w-full rounded bg-white/10 px-1 text-[11px] font-semibold text-white outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      title={isBn ? "নাম বদলাতে ক্লিক করুন" : "Click to rename block"}
                      onClick={() => {
                        setEditingBlockId(block.id);
                        setEditingBlockName(block.name);
                      }}
                      className="truncate text-left text-[11.5px] font-semibold leading-tight text-white hover:underline"
                    >
                      {block.name}
                    </button>
                  )}

                  {block.is_current && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold"
                      style={{
                        border: `1px solid ${COLOR_TOKENS.waqtAmberBorder}`,
                        color: COLOR_TOKENS.arcProgress,
                      }}
                    >
                      {isBn ? "এখন" : "now"}
                    </span>
                  )}
                </div>
                <div
                  className="mt-[1px] text-[9.5px] leading-tight tabular-nums"
                  style={{ color: COLOR_TOKENS.arcTimeMuted }}
                >
                  {formatDigits(block.range_label, banglaDigits)}
                </div>
              </div>

              {/* Up to 3 Task Rows */}
              <div className="my-auto flex flex-col gap-[3px] py-[2px]">
                {visibleItems.map((item) => {
                  const isSelected = selectedTaskId === item.id;
                  const timeLabel = item.start_at
                    ? item.start_at
                    : item.fixed
                      ? formatMinClock12(item.slot_start_min)
                      : `${item.estimate_min}m`;
                  return (
                    <div
                      key={`${item.source}-${item.id}`}
                      draggable={item.id > 0}
                      tabIndex={item.id > 0 ? 0 : -1}
                      data-testid={`waqt-task-${item.id}`}
                      onDragStart={(e) => {
                        setDraggedTaskId(item.id);
                        e.dataTransfer.setData("text/lumen-task-id", String(item.id));
                      }}
                      onDragEnd={() => setDraggedTaskId(null)}
                      onPointerDown={(e) => {
                        setSelectedTaskId(item.id);
                        touchStartXRef.current = e.clientX;
                        if (item.id > 0) {
                          longPressTimerRef.current = window.setTimeout(() => {
                            setEstimateTask(item);
                          }, 480);
                        }
                      }}
                      onPointerUp={(e) => {
                        if (longPressTimerRef.current !== null) {
                          window.clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                        if (
                          touchStartXRef.current !== null &&
                          e.clientX - touchStartXRef.current < -52
                        ) {
                          triggerSwipeDelete(item, block.id);
                        }
                        touchStartXRef.current = null;
                      }}
                      onContextMenu={(e) => {
                        if (item.id <= 0) return;
                        e.preventDefault();
                        setEstimateTask(item);
                      }}
                      onKeyDown={(e) => {
                        if (item.id <= 0) return;
                        if (e.key.toLowerCase() === "m") {
                          e.preventDefault();
                          setMoveMenuTask(item);
                        } else if (e.key === "Delete" || e.key === "Backspace") {
                          e.preventDefault();
                          triggerSwipeDelete(item, block.id);
                        }
                      }}
                      className={`group flex cursor-grab items-center justify-between gap-1 rounded px-0.5 py-[1px] text-[10px] outline-none ${
                        isSelected ? "bg-white/10" : "hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Toggle ${item.title}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleToggleDone(item);
                          }}
                          className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full"
                        >
                          {item.done ? (
                            <span style={{ color: COLOR_TOKENS.accentGreen }}>
                              <CheckIcon size={9} />
                            </span>
                          ) : (
                            <span
                              className="h-[5px] w-[5px] rounded-full"
                              style={{ backgroundColor: kindDotColor(item.kind, false) }}
                            />
                          )}
                        </button>
                        <span
                          className={`truncate ${item.done ? "line-through opacity-65" : "text-white"}`}
                        >
                          {item.title}
                        </span>
                      </div>
                      <span
                        className="shrink-0 text-[9.5px] tabular-nums"
                        style={{ color: COLOR_TOKENS.textSecondary }}
                      >
                        {formatDigits(timeLabel, banglaDigits)}
                      </span>
                    </div>
                  );
                })}
                {overflowCount > 0 && (
                  <div
                    className="pl-3.5 text-[9.5px] font-medium"
                    style={{ color: COLOR_TOKENS.textSecondary }}
                  >
                    +{formatDigits(overflowCount, banglaDigits)}
                  </div>
                )}
              </div>

              {/* Capacity Bar + Status Footer */}
              <div>
                <div className="h-[3.5px] w-full overflow-hidden rounded-full bg-white/12">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${Math.max(block.items.length > 0 ? 8 : 0, taskRatio)}%` }}
                    transition={getMotionTransition("progressSpring", reduceMotion)}
                    style={{
                      backgroundColor:
                        block.capacity_status === "overbooked"
                          ? COLOR_TOKENS.waqtDeadline
                          : block.is_current
                            ? COLOR_TOKENS.arcProgress
                            : COLOR_TOKENS.waqtTask,
                    }}
                  />
                </div>
                <div className="mt-[3px] flex items-center justify-between gap-1">
                  <span
                    className="truncate text-[9.5px] font-medium tabular-nums"
                    style={{
                      color:
                        block.capacity_status === "overbooked"
                          ? COLOR_TOKENS.waqtDeadline
                          : block.is_current
                            ? COLOR_TOKENS.arcProgress
                            : COLOR_TOKENS.textSecondary,
                    }}
                  >
                    {formatDigits(block.status_text, banglaDigits)}
                  </span>
                  {block.capacity_status === "overbooked" && (
                    <button
                      type="button"
                      data-testid={`waqt-move-overflow-${block.id}`}
                      onClick={() => {
                        void playUiSound("toggle_on");
                        onMoveOverflow(block.id);
                      }}
                      className="shrink-0 rounded px-1 text-[9px] font-semibold text-white hover:underline"
                      style={{ backgroundColor: "rgba(255, 69, 58, 0.25)" }}
                    >
                      {isBn ? "সরান" : "Move"}
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* 4. Bottom Row (3 cards: 1.28fr Focus / 1fr Replay / 1fr Unplanned) */}
      <div className="relative z-20 grid h-[92px] grid-cols-[1.28fr_1fr_1fr] gap-[8px]">
        {/* (a) Focus Card with Lumi Body-Double */}
        <div
          data-testid="waqt-focus-card"
          className="home-glass-card flex items-center gap-2.5 overflow-hidden px-3 py-2"
          style={{ borderRadius: "var(--waqt-card-radius)" }}
        >
          <WaqtBodyDoubleLumi
            state={bodyDoubleState}
            isVisible={isVisible}
            reduceMotion={reduceMotion}
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold leading-tight text-white">
                {activeFocusTask?.title ?? (isBn ? "ফোকাস সেশন" : "Deep Focus")}
              </div>
              <div
                className="truncate text-[10px] leading-tight"
                style={{ color: COLOR_TOKENS.textSecondary }}
              >
                {looksUp
                  ? isBn
                    ? "লুমি জিজ্ঞেস করছে: এখনও কাজ করছেন?"
                    : "Lumi: Still here?"
                  : pomodoro.running
                    ? isBn
                      ? "লুমি সাথে ফোকাস করছে · সোশ্যাল ব্লকড"
                      : "Lumi focuses with you · blocked: social"
                    : isBn
                      ? "লুমি আপনার পাশে ফোকাস করবে"
                      : "Lumi focuses with you · blocked: social"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="waqt-start-focus-btn"
                onClick={() => {
                  void playUiSound("toggle_on");
                  if (pomodoro.running) {
                    onToggleFocusPause();
                  } else {
                    onStartFocusFlow(activeFocusTask?.id ?? null);
                  }
                }}
                className="inline-flex h-[24px] items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-black transition-transform active:scale-95"
              >
                <PlayIcon size={9} />
                <span className="tabular-nums">
                  {pomodoro.running
                    ? `${isBn ? "বিরতি" : "Pause"} ${formatDigits(focusTimerLabel, banglaDigits)}`
                    : `${isBn ? "শুরু" : "Start"} ${formatDigits(focusTimerLabel, banglaDigits)}`}
                </span>
              </button>
              {pomodoro.running && (
                <button
                  type="button"
                  onClick={() => {
                    setJustCelebrated(true);
                    window.setTimeout(() => setJustCelebrated(false), 1800);
                    onResetFocus();
                  }}
                  className="home-glass-chip h-[24px] px-2 text-[10px] text-white"
                >
                  {isBn ? "শেষ" : "End"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* (b) Replay Card: 10-bar sparkline + Focus & Prayers summary */}
        <button
          type="button"
          data-testid="waqt-replay-card"
          onClick={() => {
            setReplaySummaryOpen(false);
            setReplaying(true);
          }}
          className="home-glass-card flex flex-col justify-between px-3 py-2 text-left transition-transform active:scale-[0.99]"
          style={{ borderRadius: "var(--waqt-card-radius)" }}
        >
          <div className="text-[11px] font-medium" style={{ color: COLOR_TOKENS.textSecondary }}>
            {isBn ? "দিনের রিপ্লে" : "Replay my day"}
          </div>
          <div className="flex h-[32px] items-end gap-[5px] px-1">
            {viewState.focus_bars.map((val, idx) => {
              const hPct =
                val > 0 ? Math.min(100, Math.max(20, Math.round((val / maxSpark) * 100))) : 14;
              const isLatestActive =
                val > 0 && idx === viewState.focus_bars.findLastIndex((v) => v > 0);
              return (
                <motion.div
                  key={idx}
                  className="w-[6px] rounded-full"
                  animate={{ height: `${hPct}%` }}
                  transition={getMotionTransition("progressSpring", reduceMotion)}
                  style={{
                    backgroundColor:
                      val === 0
                        ? "rgba(255,255,255,0.12)"
                        : isLatestActive
                          ? COLOR_TOKENS.arcProgress
                          : COLOR_TOKENS.waqtTask,
                  }}
                />
              );
            })}
          </div>
          <div className="truncate text-[10.5px] font-medium text-white tabular-nums">
            {isBn
              ? `ফোকাস ${formatDigits(formatShortDuration(viewState.total_focus_min), banglaDigits)} · নামাজ ${formatDigits(`${viewState.prayers_done_count}/5`, banglaDigits)}`
              : `Focus ${formatShortDuration(viewState.total_focus_min)} · Prayers ${viewState.prayers_done_count}/5`}
          </div>
        </button>

        {/* (c) Unplanned Card: draggable chips + dashed drop zone */}
        <div
          data-testid="waqt-unplanned-card"
          onDragOver={(e) => {
            e.preventDefault();
            if (hoverBlockId !== "unplanned") setHoverBlockId("unplanned");
          }}
          onDragLeave={() => {
            if (hoverBlockId === "unplanned") setHoverBlockId(null);
          }}
          onDrop={(e) => handleDropOnBlock(e, null)}
          className="home-glass-card flex flex-col justify-between px-2.5 py-2"
          style={{
            borderRadius: "var(--waqt-card-radius)",
            borderColor: hoverBlockId === "unplanned" ? COLOR_TOKENS.arcProgress : undefined,
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10.5px] font-medium"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {isBn ? "অনির্ধারিত · ব্লকে টানুন" : "Unplanned · drag to a block"}
            </span>
            <button
              type="button"
              aria-label={isBn ? "নতুন কাজ যোগ করুন" : "Add unplanned task"}
              onClick={() => setAddingUnplanned((v) => !v)}
              className="rounded px-1 text-[11px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              +
            </button>
          </div>

          {addingUnplanned ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newTaskTitle.trim();
                if (trimmed) {
                  onAddTask(trimmed, null, 25);
                  setNewTaskTitle("");
                }
                setAddingUnplanned(false);
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={isBn ? "কাজের নাম..." : "Task title..."}
                className="w-full rounded bg-white/10 px-1.5 py-0.5 text-[10.5px] text-white outline-none"
              />
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-1 overflow-hidden">
              {viewState.unplanned.slice(0, 2).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  draggable
                  data-testid={`waqt-unplanned-${t.id}`}
                  onDragStart={(e) => {
                    setDraggedTaskId(t.id);
                    e.dataTransfer.setData("text/lumen-task-id", String(t.id));
                  }}
                  onDragEnd={() => setDraggedTaskId(null)}
                  onClick={() =>
                    setMoveMenuTask({
                      id: t.id,
                      title: t.title,
                      kind: t.kind ?? "task",
                      source: "local",
                      estimate_min: t.estimate_min ?? 25,
                      done: t.done,
                      done_at: null,
                      fixed: false,
                      start_at: null,
                      slot_start_min: 0,
                      slot_end_min: 25,
                      client: null,
                      calendar_event_id: null,
                      sort_order: 0,
                    })
                  }
                  className="home-glass-chip max-w-[82px] cursor-grab truncate px-2 py-[2px] text-[10px] text-white active:cursor-grabbing"
                >
                  {t.title}
                </button>
              ))}
              {viewState.unplanned.length > 2 && (
                <span className="text-[9.5px]" style={{ color: COLOR_TOKENS.textSecondary }}>
                  +{formatDigits(viewState.unplanned.length - 2, banglaDigits)}
                </span>
              )}
            </div>
          )}

          <div
            className="flex h-[20px] items-center justify-center rounded-[8px] border border-dashed text-[10px]"
            style={{
              borderColor:
                hoverBlockId === "unplanned"
                  ? COLOR_TOKENS.arcProgress
                  : "rgba(255, 255, 255, 0.16)",
              color: COLOR_TOKENS.textSecondary,
            }}
          >
            {isBn ? "এখানে ছাড়ুন" : "Drop here"}
          </div>
        </div>
      </div>

      {/* Bottom Page Indicator Dots (matches Home) */}
      <div className="relative z-20 flex h-[10px] items-center justify-center gap-1.5">
        {pageDotIndices.map((idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Page ${idx + 1}`}
            onClick={() => onSelectPage(idx)}
            className="h-[5px] rounded-full transition-all"
            style={{
              width: idx === activePageIndex ? 14 : 5,
              backgroundColor:
                idx === activePageIndex ? COLOR_TOKENS.textPrimary : COLOR_TOKENS.pageDotInactive,
            }}
          />
        ))}
      </div>

      {/* Estimate Wheel Modal (Long-press / Right-click task) */}
      <AnimatePresence>
        {estimateTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => setEstimateTask(null)}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="home-glass-card flex flex-col gap-2 rounded-2xl p-3 shadow-2xl"
              style={{ background: COLOR_TOKENS.arcTooltipBg }}
            >
              <div className="text-[11px] font-semibold text-white">
                {isBn ? `সময় নির্ধারণ: ${estimateTask.title}` : `Estimate · ${estimateTask.title}`}
              </div>
              <div className="flex items-center gap-1.5">
                {ESTIMATE_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      onChangeEstimate(estimateTask.id, mins);
                      setEstimateTask(null);
                    }}
                    className="home-glass-chip px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white"
                    style={{
                      borderColor:
                        estimateTask.estimate_min === mins ? COLOR_TOKENS.arcProgress : undefined,
                      color:
                        estimateTask.estimate_min === mins
                          ? COLOR_TOKENS.arcProgress
                          : COLOR_TOKENS.textPrimary,
                    }}
                  >
                    {formatDigits(mins, banglaDigits)}m
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard `M` / Click Unplanned Chip -> Move to Waqt Block Menu */}
      <AnimatePresence>
        {moveMenuTask && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => setMoveMenuTask(null)}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div
              data-testid="waqt-move-menu"
              onClick={(e) => e.stopPropagation()}
              className="home-glass-card flex flex-col gap-2 rounded-2xl p-3 shadow-2xl"
              style={{ background: COLOR_TOKENS.arcTooltipBg }}
            >
              <div className="text-[11px] font-semibold text-white">
                {isBn
                  ? `ব্লক বেছে নিন · ${moveMenuTask.title}`
                  : `Move "${moveMenuTask.title}" to block`}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {viewState.blocks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onAssignTask(moveMenuTask.id, b.id);
                      setMoveMenuTask(null);
                    }}
                    className="home-glass-chip px-2.5 py-1 text-[11px] text-white"
                  >
                    {b.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onAssignTask(moveMenuTask.id, null);
                    setMoveMenuTask(null);
                  }}
                  className="home-glass-chip px-2.5 py-1 text-[11px]"
                  style={{ color: COLOR_TOKENS.textSecondary }}
                >
                  {isBn ? "অনির্ধারিত" : "Unplanned"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-up "Day Wrapped" Summary & Offline Share Card */}
      <AnimatePresence>
        {replaySummaryOpen && (
          <motion.div
            data-testid="waqt-day-wrapped"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            className="absolute inset-x-4 bottom-4 z-40 flex items-center justify-between gap-3 rounded-2xl p-3 shadow-2xl"
            style={{
              background: COLOR_TOKENS.arcTooltipBg,
              border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
            }}
          >
            <div>
              <div className="text-[12px] font-semibold text-white">
                {isBn ? "আজকের সারসংক্ষেপ · Day Wrapped" : `Day Wrapped · ${viewState.date_label}`}
              </div>
              <div
                className="mt-0.5 text-[10.5px] tabular-nums"
                style={{ color: COLOR_TOKENS.textSecondary }}
              >
                Focus {formatShortDuration(viewState.total_focus_min)} · Tasks done{" "}
                {viewState.blocks.reduce((a, b) => a + b.items.filter((i) => i.done).length, 0)} ·
                Prayers {viewState.prayers_done_count}/5 · Water {viewState.water_today_ml} ml
              </div>
              {shareStatus && (
                <div className="mt-0.5 text-[10px]" style={{ color: COLOR_TOKENS.accentGreen }}>
                  {shareStatus}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="waqt-share-wrapped"
                onClick={() => void handleShareDayWrapped()}
                className="inline-flex h-[24px] items-center gap-1 rounded-full bg-white px-2.5 text-[10.5px] font-semibold text-black"
              >
                <ShareIcon size={11} />
                <span>{isBn ? "শেয়ার" : "Share"}</span>
              </button>
              <button
                type="button"
                onClick={() => setReplaySummaryOpen(false)}
                className="home-glass-chip h-[24px] px-2 text-[10.5px] text-white"
              >
                {isBn ? "বন্ধ" : "Close"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

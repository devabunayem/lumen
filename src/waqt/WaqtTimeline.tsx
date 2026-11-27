import { AnimatePresence, motion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WaqtBodyDoubleLumi } from "../app/LumenMascot";
import {
  CheckIcon,
  CloseIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  ShareIcon,
} from "../design/icons";
import { MOTION_PRESETS } from "../design/motion";
import { playUiSound } from "../design/sounds";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import { formatDigits, interpolateMsg } from "../i18n/digits";
import type {
  CalendarEvent,
  PomodoroSnapshot,
  PrayerSchedule,
  TaskItem,
  WaqtBlockItem,
  WaqtBlockView,
  WaqtSuggestion,
  WaqtTimelineState,
} from "../lib/ipc";
import type { WaqtPrayerPauseMode, WaqtRhythmAnchor } from "../settings";
import {
  buildClientWaqtFallback,
  buildSegmentedCapacitySlices,
  computeOverflowMoveAssignments,
  computeSunX,
  formatDurationCompact,
  formatMinClock12,
  parseQuickAddTaskInput,
  resolveKindCssVar,
  scrubXToMinutes,
  WAQT_RAIL_H,
  WAQT_RAIL_W,
  WAQT_SEGMENT_GAP,
  WAQT_SEGMENT_W,
} from "./waqtEngine";

let celebratedAllDoneInSession = false;
let autoCelebrationShownCount = 0;

export interface WaqtTimelineProps {
  waqtState: WaqtTimelineState | null;
  loading?: boolean;
  error?: string | null;
  nowDate: Date;
  schedule: PrayerSchedule | null;
  tasks: TaskItem[];
  calendarEvents: CalendarEvent[];
  pomodoro: PomodoroSnapshot;
  waterTodayMl: number;
  waterGoalMl?: number;
  language?: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  isVisible: boolean;
  locationConfigured: boolean;
  bedtimeHHMM: string;
  prayerPauseMode: WaqtPrayerPauseMode;
  ramadanTaraweeh: boolean;
  hintDismissed: boolean;
  quietMode?: boolean;
  firstRunDismissed?: boolean;
  rhythmAnchors?: WaqtRhythmAnchor[];
  customBlockNames: Record<string, string>;
  pagesCount: number;
  activePageIndex: number;
  onSelectPage: (idx: number) => void;
  onOpenSettings: () => void;
  onRetry?: () => void;
  onAssignTask: (taskId: number, blockId: string | null, sortOrder?: number) => void;
  onAssignBatch?: (assignments: Array<[number, string | null]>) => void;
  onToggleTask: (taskId: number) => void;
  onAddTask: (
    title: string,
    blockId: string | null,
    estimateMin?: number,
    startAt?: string | null,
  ) => void;
  onDeleteTask: (taskId: number) => void;
  onRestoreTask: (input: { title: string; blockId: string | null; estimateMin: number }) => void;
  onChangeEstimate: (taskId: number, estimateMin: number) => void;
  onMoveOverflow: (fromBlockId: string, nextBlockId?: string) => void;
  onRenameBlock: (blockId: string, name: string) => void;
  onRolloverYesterday: (accept: boolean) => void;
  onStartFocusFlow: (taskId?: number | null) => void;
  onToggleFocusPause: () => void;
  onResetFocus: () => void;
  onDismissHint: () => void;
  onDismissFirstRun?: () => void;
  onAcceptSuggestion?: (suggestion: WaqtSuggestion) => void;
  onDismissSuggestion?: (suggestion: WaqtSuggestion) => void;
  onLogActivity: (kind: string, refId?: string | null, note?: string | null) => void;
}

function getKindDotColor(kind: string): string {
  return resolveKindCssVar(kind);
}

function formatTimerClock(secs: number): string {
  const safe = Math.max(0, Math.round(secs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WaqtTimeline({
  waqtState,
  loading = false,
  error = null,
  nowDate,
  schedule,
  tasks,
  calendarEvents,
  pomodoro,
  waterTodayMl,
  waterGoalMl = 1500,
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
  quietMode = false,
  firstRunDismissed = true,
  rhythmAnchors = [],
  customBlockNames,
  onOpenSettings,
  onRetry,
  onAssignTask,
  onAssignBatch,
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
  onDismissHint,
  onDismissFirstRun,
  onAcceptSuggestion,
  onDismissSuggestion,
  onLogActivity,
}: WaqtTimelineProps) {
  const msg = getMessages(language);
  const fmt = useCallback((v: string) => formatDigits(v, banglaDigits), [banglaDigits]);

  const [scrubMin, setScrubMin] = useState<number | null>(null);
  const [draggingScrub, setDraggingScrub] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [hoverBlockId, setHoverBlockId] = useState<string | null>(null);
  const [localHintDismissed, setLocalHintDismissed] = useState(hintDismissed);
  const [cityBannerDismissed, setCityBannerDismissed] = useState(false);
  const [rolloverHandled, setRolloverHandled] = useState(false);
  const [localFirstRunDismissed, setLocalFirstRunDismissed] = useState(firstRunDismissed);

  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [quickAddTarget, setQuickAddTarget] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [moveMenuItemId, setMoveMenuItemId] = useState<number | null>(null);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<number, number>>({});

  const [planPreviewOpen, setPlanPreviewOpen] = useState(false);
  const [batchUndoToast, setBatchUndoToast] = useState<{
    label: string;
    undoAssignments: Array<[number, string | null]>;
  } | null>(null);
  const [deletedUndo, setDeletedUndo] = useState<{
    title: string;
    blockId: string | null;
    estimateMin: number;
  } | null>(null);

  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayStepMin, setReplayStepMin] = useState<number | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [prayerAskOpen, setPrayerAskOpen] = useState(false);
  const [freeFocusPromptOpen, setFreeFocusPromptOpen] = useState(false);
  const [localDismissedIds, setLocalDismissedIds] = useState<string[]>([]);
  const [celebratingNow, setCelebratingNow] = useState(false);

  const railRef = useRef<SVGSVGElement | null>(null);
  const swipeStartRef = useRef<{ id: number; x: number } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const prevPomodoroRunningRef = useRef<boolean>(pomodoro.running);
  const prevPomodoroChimeRef = useRef<number>(pomodoro.chime_tick);
  const prevAllDoneRef = useRef<boolean>(false);

  // Sync setting prop into local dismiss states cleanly via microtask when needed
  useEffect(() => {
    if (firstRunDismissed && !localFirstRunDismissed) {
      const t = window.setTimeout(() => setLocalFirstRunDismissed(true), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [firstRunDismissed, localFirstRunDismissed]);

  const effectiveState: WaqtTimelineState = useMemo(() => {
    if (waqtState) {
      if (localDismissedIds.length === 0) {
        return waqtState;
      }
      return {
        ...waqtState,
        blocks: waqtState.blocks.map((b) =>
          b.suggestion && localDismissedIds.includes(b.suggestion.id)
            ? { ...b, suggestion: null }
            : b,
        ),
      };
    }
    return buildClientWaqtFallback({
      nowDate,
      schedule,
      tasks,
      calendarEvents,
      pomodoro,
      waterTodayMl,
      waterGoalMl,
      bedtimeHHMM,
      ramadanTaraweeh,
      locationConfigured,
      customBlockNames,
      quietMode,
      rhythmAnchors,
      dismissedSuggestions: localDismissedIds,
    });
  }, [
    waqtState,
    nowDate,
    schedule,
    tasks,
    calendarEvents,
    pomodoro,
    waterTodayMl,
    waterGoalMl,
    bedtimeHHMM,
    ramadanTaraweeh,
    locationConfigured,
    customBlockNames,
    quietMode,
    rhythmAnchors,
    localDismissedIds,
  ]);

  const displayMin = replayPlaying
    ? (replayStepMin ?? effectiveState.now_min)
    : (scrubMin ?? effectiveState.now_min);

  const currentBlock =
    effectiveState.blocks.find((b) => b.is_current) ?? effectiveState.blocks[0] ?? null;

  const activeBlockItems = effectiveState.blocks
    .filter((b) => !b.is_past)
    .flatMap((b) => b.items)
    .filter((i) => !i.done && i.id > 0);

  const boundTask: WaqtBlockItem | null =
    activeBlockItems.find((i) => i.id === effectiveState.current_focus_task_id) ??
    activeBlockItems[0] ??
    null;

  const hasAnyItemsToday =
    effectiveState.blocks.some((b) => b.items.length > 0) || effectiveState.unplanned.length > 0;
  const hasCalendarOnly = !hasAnyItemsToday
    ? false
    : activeBlockItems.length === 0 &&
      !effectiveState.all_tasks_done &&
      effectiveState.blocks.some((b) => b.items.some((i) => i.source === "calendar"));
  const isZeroTasksState =
    effectiveState.blocks.every((b) => b.items.length === 0) &&
    effectiveState.unplanned.length === 0;
  const isSingleTaskState = activeBlockItems.length === 1 && !effectiveState.all_tasks_done;

  // One-time celebration on S8 all_tasks_done (never re-triggers on reopen)
  useEffect(() => {
    const isNowDone = effectiveState.all_tasks_done;
    if (isNowDone && !prevAllDoneRef.current && !celebratedAllDoneInSession) {
      celebratedAllDoneInSession = true;
      autoCelebrationShownCount += 1;
      const t1 = window.setTimeout(() => setCelebratingNow(true), 0);
      const t2 = window.setTimeout(() => setCelebratingNow(false), 3200);
      prevAllDoneRef.current = isNowDone;
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    prevAllDoneRef.current = isNowDone;
    return undefined;
  }, [effectiveState.all_tasks_done]);

  // Prayer pause ask mode near prayer arrival
  useEffect(() => {
    if (
      pomodoro.running &&
      prayerPauseMode === "ask" &&
      effectiveState.next_prayer_in_min >= 0 &&
      effectiveState.next_prayer_in_min <= 1
    ) {
      const t = window.setTimeout(() => setPrayerAskOpen(true), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [pomodoro.running, prayerPauseMode, effectiveState.next_prayer_in_min]);

  // Free focus completion prompt ("Log this as a task?") when Pomodoro stops on chime without bound task
  useEffect(() => {
    const stoppedByFinish =
      prevPomodoroRunningRef.current &&
      !pomodoro.running &&
      pomodoro.chime_tick !== prevPomodoroChimeRef.current &&
      !boundTask;
    prevPomodoroRunningRef.current = pomodoro.running;
    prevPomodoroChimeRef.current = pomodoro.chime_tick;
    if (stoppedByFinish) {
      const t = window.setTimeout(() => setFreeFocusPromptOpen(true), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [pomodoro.running, pomodoro.chime_tick, boundTask]);

  const openQuickAdd = useCallback(
    (targetBlockId: string | null, triggerEl?: HTMLElement | null) => {
      returnFocusRef.current = triggerEl ?? (document.activeElement as HTMLElement | null) ?? null;
      setQuickAddTarget(targetBlockId);
      setQuickAddValue("");
      window.requestAnimationFrame(() => quickAddInputRef.current?.focus());
    },
    [],
  );

  const closeQuickAdd = useCallback(() => {
    setQuickAddTarget(null);
    setQuickAddValue("");
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const submitQuickAdd = useCallback(() => {
    const parsed = parseQuickAddTaskInput(quickAddValue);
    if (!parsed.title) {
      closeQuickAdd();
      return;
    }
    playUiSound("toggle_on");
    onAddTask(parsed.title, quickAddTarget, parsed.estimateMin, parsed.startAt);
    closeQuickAdd();
  }, [quickAddValue, quickAddTarget, onAddTask, closeQuickAdd]);

  // Keyboard shortcuts: Ctrl+N quick add, Escape exits expanded sheet / quick add / replay
  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openQuickAdd(currentBlock?.id ?? "dhuhr", document.activeElement as HTMLElement | null);
        return;
      }
      if (e.key === "Escape") {
        if (quickAddTarget !== null) {
          e.preventDefault();
          closeQuickAdd();
        } else if (expandedBlockId !== null) {
          e.preventDefault();
          setExpandedBlockId(null);
          window.requestAnimationFrame(() => returnFocusRef.current?.focus());
        } else if (planPreviewOpen) {
          e.preventDefault();
          setPlanPreviewOpen(false);
        } else if (moveMenuItemId !== null) {
          e.preventDefault();
          setMoveMenuItemId(null);
        } else if (replayPlaying) {
          e.preventDefault();
          setReplayPlaying(false);
          setReplayStepMin(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isVisible,
    currentBlock?.id,
    quickAddTarget,
    expandedBlockId,
    planPreviewOpen,
    moveMenuItemId,
    replayPlaying,
    openQuickAdd,
    closeQuickAdd,
  ]);

  // 5-second Replay Day loop
  useEffect(() => {
    if (!replayPlaying) return;
    const startMin = effectiveState.rail_start_min;
    const endMin = Math.max(startMin + 60, effectiveState.now_min);
    const durationMs = 5000;
    const t0 = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - t0;
      const frac = Math.min(1, elapsed / durationMs);
      setReplayStepMin(Math.round(startMin + frac * (endMin - startMin)));
      if (frac < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setReplayPlaying(false);
        setReplayStepMin(null);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [replayPlaying, effectiveState.rail_start_min, effectiveState.now_min]);

  const scheduleUndoClear = useCallback(() => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setDeletedUndo(null);
      setBatchUndoToast(null);
    }, 5000);
  }, []);

  const handleSoftDelete = useCallback(
    (item: WaqtBlockItem, blockId: string) => {
      if (item.id <= 0 || item.source === "calendar") return;
      playUiSound("toggle_on");
      setDeletedUndo({
        title: item.title,
        blockId,
        estimateMin: item.estimate_min,
      });
      onDeleteTask(item.id);
      scheduleUndoClear();
    },
    [onDeleteTask, scheduleUndoClear],
  );

  const handleAcceptSuggestion = useCallback(
    (sug: WaqtSuggestion) => {
      playUiSound("toggle_on");
      setLocalDismissedIds((prev) => (prev.includes(sug.id) ? prev : [...prev, sug.id]));
      if (onAcceptSuggestion) {
        onAcceptSuggestion(sug);
        return;
      }
      if (sug.task_id !== null) {
        onAssignTask(sug.task_id, sug.block_id);
      } else {
        const clean = sug.text.split(" · ")[0]?.trim() || sug.text;
        onAddTask(clean, sug.block_id, sug.estimate_min, null);
      }
    },
    [onAcceptSuggestion, onAssignTask, onAddTask],
  );

  const handleDismissSuggestion = useCallback(
    (sug: WaqtSuggestion) => {
      playUiSound("arc_scrub_tick");
      setLocalDismissedIds((prev) => {
        const next = [...prev];
        if (!next.includes(sug.id)) next.push(sug.id);
        const blockMarker = `block:${sug.block_id}`;
        if (!next.includes(blockMarker)) next.push(blockMarker);
        return next;
      });
      onDismissSuggestion?.(sug);
    },
    [onDismissSuggestion],
  );

  const handleApplyPlanPreview = useCallback(() => {
    const plan = effectiveState.plan_my_day_preview;
    if (plan.length === 0) {
      setPlanPreviewOpen(false);
      return;
    }
    playUiSound("toggle_on");
    const forward: Array<[number, string | null]> = plan.map((p) => [p.task_id, p.target_block_id]);
    const reverse: Array<[number, string | null]> = plan.map((p) => [p.task_id, p.prev_block_id]);
    if (onAssignBatch) {
      onAssignBatch(forward);
    } else {
      for (const [tid, bid] of forward) {
        onAssignTask(tid, bid);
      }
    }
    setPlanPreviewOpen(false);
    setBatchUndoToast({
      label: interpolateMsg(msg.waqt.planPreviewTitle, { count: plan.length }).replace("?", ""),
      undoAssignments: reverse,
    });
    scheduleUndoClear();
  }, [
    effectiveState.plan_my_day_preview,
    onAssignBatch,
    onAssignTask,
    msg.waqt.planPreviewTitle,
    scheduleUndoClear,
  ]);

  const handleMoveOverflowBlock = useCallback(
    (block: WaqtBlockView, nextBlock: WaqtBlockView | undefined) => {
      if (!nextBlock) return;
      playUiSound("toggle_on");
      const moves = computeOverflowMoveAssignments(block, nextBlock);
      if (moves.length > 0 && onAssignBatch) {
        onAssignBatch(moves.map((m) => [m.taskId, m.nextBlockId]));
        setBatchUndoToast({
          label: interpolateMsg(msg.waqt.moveToNext, {
            count: moves.length,
            block: nextBlock.name,
          }),
          undoAssignments: moves.map((m) => [m.taskId, m.prevBlockId]),
        });
        scheduleUndoClear();
      } else {
        onMoveOverflow(block.id, nextBlock.id);
      }
    },
    [onAssignBatch, onMoveOverflow, msg.waqt.moveToNext, scheduleUndoClear],
  );

  const handleUndoBatch = useCallback(() => {
    if (!batchUndoToast) return;
    playUiSound("arc_scrub_tick");
    if (onAssignBatch) {
      onAssignBatch(batchUndoToast.undoAssignments);
    } else {
      for (const [tid, bid] of batchUndoToast.undoAssignments) {
        onAssignTask(tid, bid);
      }
    }
    setBatchUndoToast(null);
  }, [batchUndoToast, onAssignBatch, onAssignTask]);

  const handleScrubPointer = useCallback(
    (clientX: number) => {
      const svg = railRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = WAQT_RAIL_W / Math.max(1, rect.width);
      const localX = (clientX - rect.left) * scaleX;
      const nextMin = scrubXToMinutes(
        localX,
        effectiveState.blocks,
        effectiveState.rail_start_min,
        effectiveState.rail_end_min,
      );
      setScrubMin(nextMin);
      if (!localHintDismissed) {
        setLocalHintDismissed(true);
        onDismissHint();
      }
    },
    [
      effectiveState.blocks,
      effectiveState.rail_start_min,
      effectiveState.rail_end_min,
      localHintDismissed,
      onDismissHint,
    ],
  );

  const handleExportWrapped = useCallback(() => {
    playUiSound("toggle_on");
    const canvas = document.createElement("canvas");
    canvas.width = 760;
    canvas.height = 376;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createRadialGradient(120, 320, 20, 120, 320, 320);
    grad.addColorStop(0, "rgba(94, 92, 230, 0.45)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 22px Inter, system-ui, sans-serif";
    ctx.fillText("Lumen · Waqt Day Replay", 32, 48);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "400 15px Inter, system-ui, sans-serif";
    ctx.fillText(
      `${effectiveState.date_label} · Focus ${formatDurationCompact(effectiveState.total_focus_min)} · Prayers ${effectiveState.prayers_done_count}/5`,
      32,
      78,
    );
    effectiveState.blocks.forEach((b, idx) => {
      const x = 32 + idx * 142;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, 112, 130, 180);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      ctx.fillText(b.name, x + 12, 138);
      ctx.fillStyle = "#ffb020";
      ctx.font = "400 12px Inter, system-ui, sans-serif";
      ctx.fillText(b.status_text, x + 12, 274);
    });
    const url = canvas.toDataURL("image/png");
    setExportedUrl(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-waqt-${effectiveState.date_label.replace(/\s+/g, "-")}.png`;
    a.click();
    window.setTimeout(() => setExportedUrl(null), 3500);
  }, [effectiveState]);

  const sunX = computeSunX(
    displayMin,
    effectiveState.blocks,
    effectiveState.rail_start_min,
    effectiveState.rail_end_min,
  );
  const sehriX = computeSunX(
    effectiveState.sehri_min,
    effectiveState.blocks,
    effectiveState.rail_start_min,
    effectiveState.rail_end_min,
  );
  const iftarX = computeSunX(
    effectiveState.iftar_min,
    effectiveState.blocks,
    effectiveState.rail_start_min,
    effectiveState.rail_end_min,
  );

  // S15 Loading shimmer skeleton (strict 640x312 footprint, no spinner)
  if (loading && !waqtState && tasks.length === 0) {
    return (
      <div
        data-testid="waqt-loading-skeleton"
        aria-busy="true"
        aria-label={msg.waqt.loadingLabel}
        className="flex h-full w-full flex-col justify-between px-[14px] pt-[8px] pb-[6px]"
      >
        <div className="flex h-[24px] items-center justify-between gap-3">
          <div className="lumen-skeleton-shimmer h-4 w-36 rounded-full bg-white/10" />
          <div className="lumen-skeleton-shimmer h-3 w-40 rounded-full bg-white/10" />
          <div className="lumen-skeleton-shimmer h-5 w-24 rounded-full bg-white/10" />
        </div>
        <div className="lumen-skeleton-shimmer my-1 h-[22px] w-full rounded-full bg-white/10" />
        <div className="grid flex-1 grid-cols-5 gap-[10px] py-1">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="lumen-skeleton-shimmer rounded-[var(--waqt-card-radius)] border border-white/10 bg-white/[0.06]"
            />
          ))}
        </div>
        <div className="grid h-[86px] grid-cols-[1.25fr_1fr_1fr] gap-[10px]">
          <div className="lumen-skeleton-shimmer rounded-[var(--waqt-card-radius)] border border-white/10 bg-white/[0.06]" />
          <div className="lumen-skeleton-shimmer rounded-[var(--waqt-card-radius)] border border-white/10 bg-white/[0.06]" />
          <div className="lumen-skeleton-shimmer rounded-[var(--waqt-card-radius)] border border-white/10 bg-white/[0.06]" />
        </div>
      </div>
    );
  }

  // S16 Error state when data failed and no snapshot is present
  if (error && !waqtState && tasks.length === 0) {
    return (
      <div
        data-testid="waqt-error-state"
        role="alert"
        className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center"
      >
        <span className="text-[13px] font-semibold text-white">{msg.waqt.errorTitle}</span>
        <span className="max-w-[380px] truncate text-[11px] text-white/65">{error}</span>
        {onRetry && (
          <button
            type="button"
            data-testid="waqt-retry-button"
            onClick={onRetry}
            className="mt-1 rounded-full bg-white px-3.5 py-1 text-[11px] font-semibold text-black hover:bg-white/90"
          >
            {msg.waqt.retry}
          </button>
        )}
      </div>
    );
  }

  const glassSurfaceClass = reduceTransparency
    ? "bg-[#121216] border border-white/15"
    : "bg-white/[0.07] border border-white/[0.11] backdrop-blur-[14px]";

  // Header contextual micro-hint (priority sorted cleanly)
  const renderCenterBanner = () => {
    if (error) {
      return (
        <div
          data-testid="waqt-inline-error"
          className="flex items-center gap-1.5 rounded-full border border-[var(--waqt-deadline)]/40 bg-[var(--waqt-deadline)]/15 px-2 py-0.5 text-[10px] text-white"
        >
          <span className="truncate">{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-white/20 px-1.5 font-semibold"
            >
              {msg.waqt.retry}
            </button>
          )}
        </div>
      );
    }
    if (effectiveState.day_is_overbooked) {
      return (
        <div
          data-testid="waqt-day-full-banner"
          className="flex items-center gap-1.5 rounded-full border border-[var(--waqt-deadline)]/45 bg-[var(--waqt-deadline)]/15 px-2 py-0.5 text-[10px] font-medium text-white"
        >
          <span>
            {fmt(
              interpolateMsg(msg.waqt.dayFullBanner, {
                planned: formatDurationCompact(effectiveState.total_planned_min),
                free: formatDurationCompact(effectiveState.total_free_min),
              }),
            )}
          </span>
        </div>
      );
    }
    if (!effectiveState.location_configured && !cityBannerDismissed) {
      return (
        <div
          data-testid="waqt-city-banner"
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/85"
        >
          <span>{msg.waqt.cityBanner}</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-full bg-[var(--waqt-habit)]/25 px-1.5 font-semibold text-[var(--waqt-habit)]"
          >
            {msg.waqt.cityAction}
          </button>
          <button
            type="button"
            aria-label={msg.waqt.dismiss}
            onClick={() => setCityBannerDismissed(true)}
            className="text-white/50 hover:text-white"
          >
            ×
          </button>
        </div>
      );
    }
    if (effectiveState.yesterday_rollover_count > 0 && !rolloverHandled) {
      return (
        <div
          data-testid="waqt-rollover-prompt"
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/90"
        >
          <span>
            {fmt(
              interpolateMsg(msg.waqt.rolloverPrompt, {
                count: effectiveState.yesterday_rollover_count,
              }),
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setRolloverHandled(true);
              onRolloverYesterday(true);
            }}
            className="rounded-full bg-white px-1.5 font-semibold text-black"
          >
            {msg.waqt.move}
          </button>
          <button
            type="button"
            onClick={() => {
              setRolloverHandled(true);
              onRolloverYesterday(false);
            }}
            className="text-white/60 hover:text-white"
          >
            {msg.waqt.leave}
          </button>
        </div>
      );
    }
    if (scrubMin !== null) {
      return (
        <button
          type="button"
          data-testid="waqt-scrub-tooltip"
          onClick={() => setScrubMin(null)}
          className="rounded-full bg-[var(--accent-orange)]/15 px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/25"
        >
          {fmt(`Viewing ${formatMinClock12(scrubMin)} · Reset`)}
        </button>
      );
    }
    if (isZeroTasksState && currentBlock) {
      return (
        <span data-testid="waqt-empty-hint" className="truncate text-[10.5px] text-white/60">
          {interpolateMsg(msg.waqt.pickOneFor, { block: currentBlock.name })}
        </span>
      );
    }
    if (!localHintDismissed) {
      return (
        <span data-testid="waqt-scrub-hint" className="truncate text-[10px] text-white/55">
          {msg.waqt.hint}
        </span>
      );
    }
    return null;
  };

  // Derive Focus card strings & Lumi mood
  const focusHeadline = effectiveState.all_tasks_done
    ? msg.waqt.allDoneFocus
    : boundTask
      ? boundTask.title
      : hasCalendarOnly
        ? interpolateMsg(msg.waqt.useGapBefore, { prayer: effectiveState.next_prayer_name })
        : msg.waqt.freeFocusTitle;

  const focusSubline = (() => {
    if (quietMode) {
      return pomodoro.running
        ? formatTimerClock(pomodoro.remaining_secs)
        : boundTask
          ? `Lumi · ${boundTask.estimate_min}m`
          : msg.waqt.freeFocusSubtitle;
    }
    if (effectiveState.all_tasks_done) {
      return msg.waqt.allDoneLumi;
    }
    if (isSingleTaskState) {
      return msg.waqt.oneThingLumi;
    }
    if (effectiveState.focus_next_task_title) {
      return interpolateMsg(msg.waqt.thenNext, { title: effectiveState.focus_next_task_title });
    }
    if (pomodoro.running) {
      return `Focus · ${formatTimerClock(pomodoro.remaining_secs)}`;
    }
    return boundTask ? `Lumi focuses with you · blocked: social` : msg.waqt.freeFocusSubtitle;
  })();

  const lumiMood = celebratingNow
    ? "celebrate"
    : pomodoro.running
      ? "focus"
      : prayerAskOpen
        ? "looks_up"
        : "idle_working";

  const focusBarsEmpty = effectiveState.total_focus_min === 0;

  return (
    <motion.div
      data-testid="waqt-timeline-page"
      data-celebration-count={autoCelebrationShownCount}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0.01 } : MOTION_PRESETS.waqtBlurEnter}
      className="relative flex h-full w-full flex-col justify-between overflow-hidden px-[14px] pt-[8px] pb-[6px] select-none"
    >
      {/* Subtle corner ambient glow matching Waqt palette tokens */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 h-24 w-64 -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: COLOR_TOKENS.waqtGlowAmber }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-48 rounded-full blur-2xl"
        style={{ background: COLOR_TOKENS.waqtGlowIndigo }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-10 h-28 w-44 rounded-full blur-2xl"
        style={{ background: COLOR_TOKENS.waqtGlowGreen }}
      />

      {/* 1. HEADER */}
      <header className="relative z-10 flex h-[24px] shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <h1 className="text-[13px] font-semibold tracking-tight text-white">{msg.waqt.title}</h1>
          <span
            data-testid="waqt-date-label"
            className="text-[10.5px] font-medium tabular-nums"
            style={{ color: COLOR_TOKENS.textSecondary }}
          >
            {fmt(effectiveState.date_label)}
          </span>
          {effectiveState.is_ramadan && (
            <span
              data-testid="waqt-ramadan-badge"
              className="rounded-full bg-[var(--waqt-habit)]/20 px-1.5 py-[1px] text-[9px] font-semibold text-[var(--waqt-habit)]"
            >
              {fmt(
                `Sehri ${formatMinClock12(effectiveState.sehri_min)} · Iftar ${formatMinClock12(effectiveState.iftar_min)}`,
              )}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-1">
          {renderCenterBanner()}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {effectiveState.plan_my_day_preview.length > 0 && !planPreviewOpen && (
            <button
              type="button"
              data-testid="waqt-plan-my-day-btn"
              onClick={() => {
                playUiSound("arc_scrub_tick");
                setPlanPreviewOpen(true);
              }}
              className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/20"
            >
              {msg.waqt.planMyDay}
            </button>
          )}
          {prayerAskOpen && (
            <button
              type="button"
              onClick={() => {
                onToggleFocusPause();
                onLogActivity("prayer", effectiveState.next_prayer_name, "Paused for prayer");
                setPrayerAskOpen(false);
              }}
              className="rounded-full bg-[var(--waqt-habit)] px-2 py-0.5 text-[10px] font-semibold text-black"
            >
              {fmt(`Pause for ${effectiveState.next_prayer_name}`)}
            </button>
          )}
          <button
            type="button"
            data-testid="waqt-quick-add-header-btn"
            aria-label="Quick add task (Ctrl+N)"
            onClick={(e) => openQuickAdd(currentBlock?.id ?? "dhuhr", e.currentTarget)}
            className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/20"
            title="Ctrl+N"
          >
            <PlusIcon size={11} />
          </button>
          <button
            type="button"
            data-testid="waqt-replay-button"
            onClick={() => {
              playUiSound("toggle_on");
              setScrubMin(null);
              setReplayPlaying((p) => !p);
            }}
            className="flex h-[20px] items-center gap-1 rounded-full bg-white px-2 text-[10px] font-semibold text-black hover:bg-white/90"
          >
            <PlayIcon size={9} />
            <span>{replayPlaying ? "Stop" : msg.waqt.replayDay}</span>
          </button>
          <button
            type="button"
            aria-label={msg.home.toggles.settings}
            onClick={onOpenSettings}
            className="flex h-[20px] w-[20px] items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white"
          >
            <SettingsIcon size={12} />
          </button>
        </div>
      </header>

      {/* 2. PRAYER RAIL & DRAGGABLE SUN */}
      <div className="relative z-10 shrink-0">
        <svg
          ref={railRef}
          data-testid="waqt-rail"
          role="slider"
          tabIndex={0}
          aria-label="Scrub day timeline"
          aria-valuemin={effectiveState.rail_start_min}
          aria-valuemax={effectiveState.rail_end_min}
          aria-valuenow={displayMin}
          viewBox={`0 0 ${WAQT_RAIL_W} ${WAQT_RAIL_H}`}
          className="h-[31px] w-full cursor-ew-resize overflow-visible outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          onPointerDown={(e) => {
            setDraggingScrub(true);
            handleScrubPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (draggingScrub) handleScrubPointer(e.clientX);
          }}
          onPointerUp={() => setDraggingScrub(false)}
          onPointerLeave={() => setDraggingScrub(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              setScrubMin(Math.min(effectiveState.rail_end_min, displayMin + 5));
              if (!localHintDismissed) {
                setLocalHintDismissed(true);
                onDismissHint();
              }
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              setScrubMin(Math.max(effectiveState.rail_start_min, displayMin - 5));
              if (!localHintDismissed) {
                setLocalHintDismissed(true);
                onDismissHint();
              }
            }
          }}
        >
          {effectiveState.blocks.map((blk, idx) => {
            const x = idx * (WAQT_SEGMENT_W + WAQT_SEGMENT_GAP);
            const segPast = displayMin >= blk.end_min && idx < effectiveState.blocks.length - 1;
            const segCurrent = displayMin >= blk.start_min && displayMin < blk.end_min;
            const segFrac = segCurrent
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    (displayMin - blk.start_min) / Math.max(1, blk.end_min - blk.start_min),
                  ),
                )
              : segPast
                ? 1
                : 0;
            const isNextHighlight = blk.prayer_label
              .toLowerCase()
              .startsWith(effectiveState.next_prayer_name.toLowerCase());

            return (
              <g key={blk.id}>
                <rect
                  x={x}
                  y={6}
                  width={WAQT_SEGMENT_W}
                  height={4}
                  rx={2}
                  fill="rgba(255,255,255,0.2)"
                />
                {segFrac > 0 && (
                  <rect
                    x={x}
                    y={6}
                    width={WAQT_SEGMENT_W * segFrac}
                    height={4}
                    rx={2}
                    fill="#ffb020"
                  />
                )}
                <text
                  x={x}
                  y={25}
                  fontSize={9.5}
                  fontWeight={isNextHighlight ? 600 : 400}
                  fill={isNextHighlight ? "#ffb020" : "rgba(255,255,255,0.68)"}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(blk.prayer_label)}
                </text>
              </g>
            );
          })}

          {effectiveState.is_ramadan && (
            <g data-testid="waqt-ramadan-markers">
              <circle cx={sehriX} cy={8} r={3} fill="var(--accent-blue)" />
              <circle cx={iftarX} cy={8} r={3} fill="var(--waqt-habit)" />
            </g>
          )}

          {/* Sun halo + core */}
          <g>
            <circle cx={sunX} cy={8} r={10} fill="rgba(255, 176, 32, 0.28)" />
            <circle cx={sunX} cy={8} r={5} fill="#ffd060" />
          </g>
        </svg>
      </div>

      {/* 3. FIVE WAQT BLOCKS GRID (strict single row locked to remaining height, never overlaps bottom row) */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-5 grid-rows-[minmax(0,1fr)] gap-[8px] overflow-hidden py-[2px]">
        {effectiveState.blocks.map((blk, idx) => {
          const nextBlock = effectiveState.blocks[idx + 1];
          const isDropTarget = hoverBlockId === blk.id;
          const isOverbooked = blk.capacity_status === "overbooked";
          const visibleItems = blk.items.slice(0, 3);
          const extraCount = Math.max(0, blk.items.length - 3);
          const slices = buildSegmentedCapacitySlices(blk);
          const hasBlockWork = blk.items.length > 0;

          return (
            <section
              key={blk.id}
              data-testid={`waqt-block-${blk.id}`}
              data-current={blk.is_current ? "true" : undefined}
              role="region"
              aria-label={`${blk.name}, ${blk.range_label}, ${blk.items.length} items, ${blk.status_text}`}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverBlockId(blk.id);
              }}
              onDragLeave={() => setHoverBlockId((cur) => (cur === blk.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                setHoverBlockId(null);
                if (dragTaskId !== null) {
                  playUiSound("toggle_on");
                  onAssignTask(dragTaskId, blk.id);
                  setDragTaskId(null);
                }
              }}
              style={{
                borderRadius: "var(--waqt-card-radius)",
                opacity: blk.is_past && !isDropTarget ? 0.68 : 1,
                borderColor: blk.is_current
                  ? COLOR_TOKENS.waqtAmberBorder
                  : isDropTarget
                    ? "var(--accent-blue)"
                    : undefined,
                boxShadow: blk.is_current ? `0 0 18px ${COLOR_TOKENS.waqtAmberGlow}` : undefined,
              }}
              className={`group relative flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden px-[8px] py-[5px] ${glassSurfaceClass}`}
            >
              {/* Block header */}
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  {editingBlockId === blk.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => {
                        onRenameBlock(blk.id, editingName);
                        setEditingBlockId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameBlock(blk.id, editingName);
                          setEditingBlockId(null);
                        } else if (e.key === "Escape") {
                          setEditingBlockId(null);
                        }
                      }}
                      className="w-full rounded bg-black/50 px-1 text-[11px] font-semibold text-white outline-none ring-1 ring-white/30"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlockId(blk.id);
                        setEditingName(blk.name);
                      }}
                      className="block w-full truncate text-left text-[11px] font-semibold leading-tight text-white hover:underline"
                      title="Click to rename block"
                    >
                      {blk.name}
                    </button>
                  )}
                  <div className="truncate whitespace-nowrap text-[9px] leading-tight tabular-nums text-white/55">
                    {fmt(blk.range_label)}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {blk.is_current && (
                    <span className="rounded-full border border-[var(--waqt-amber-border)] bg-[var(--waqt-amber-glow)] px-1.5 py-[0.5px] text-[8.5px] font-semibold text-[#ffb020]">
                      now
                    </span>
                  )}
                  {!blk.is_past && (
                    <button
                      type="button"
                      data-testid={`waqt-block-add-${blk.id}`}
                      aria-label={`Add task to ${blk.name}`}
                      onClick={(e) => openQuickAdd(blk.id, e.currentTarget)}
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/10 text-white/75 opacity-80 hover:bg-white/25 group-hover:opacity-100"
                    >
                      <PlusIcon size={8} />
                    </button>
                  )}
                </div>
              </div>

              {/* Block body: tasks / past log / rhythm anchors / deterministic suggestion / + Add one thing */}
              <div className="my-[2px] flex min-h-0 flex-1 flex-col justify-start gap-[2px] overflow-hidden">
                {visibleItems.map((item) => {
                  const isCal = item.source === "calendar" || item.id < 0;
                  const swiped = swipeOffsets[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      draggable={!isCal}
                      onDragStart={() => setDragTaskId(item.id)}
                      onDragEnd={() => {
                        setDragTaskId(null);
                        setHoverBlockId(null);
                      }}
                      onWheel={(e) => {
                        if (isCal) return;
                        e.stopPropagation();
                        const delta = e.deltaY < 0 ? 5 : -5;
                        const nextEst = Math.max(5, Math.min(240, item.estimate_min + delta));
                        onChangeEstimate(item.id, nextEst);
                      }}
                      onPointerDown={(e) => {
                        swipeStartRef.current = { id: item.id, x: e.clientX };
                      }}
                      onPointerMove={(e) => {
                        if (swipeStartRef.current?.id !== item.id) return;
                        const dx = Math.min(0, Math.max(-44, e.clientX - swipeStartRef.current.x));
                        setSwipeOffsets((cur) => ({ ...cur, [item.id]: dx }));
                      }}
                      onPointerUp={() => {
                        if (swipeStartRef.current?.id === item.id) {
                          if ((swipeOffsets[item.id] ?? 0) <= -30) {
                            handleSoftDelete(item, blk.id);
                          }
                          setSwipeOffsets((cur) => ({ ...cur, [item.id]: 0 }));
                          swipeStartRef.current = null;
                        }
                      }}
                      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
                        if (e.key.toLowerCase() === "m" && !isCal) {
                          e.preventDefault();
                          setMoveMenuItemId((cur) => (cur === item.id ? null : item.id));
                        }
                      }}
                      tabIndex={0}
                      style={{ transform: swiped ? `translateX(${swiped}px)` : undefined }}
                      className="relative flex items-center justify-between gap-1 rounded px-0.5 text-[10px] leading-tight text-white/90 hover:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-white/30"
                    >
                      <button
                        type="button"
                        disabled={isCal}
                        aria-label={`Toggle ${item.title}`}
                        onClick={() => {
                          if (!isCal) {
                            playUiSound("toggle_on");
                            onToggleTask(item.id);
                          }
                        }}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left"
                      >
                        {item.done || blk.is_past ? (
                          <CheckIcon size={9} className="shrink-0 text-[var(--waqt-meeting)]" />
                        ) : (
                          <span
                            className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
                            style={{ backgroundColor: getKindDotColor(item.kind) }}
                          />
                        )}
                        <span
                          className={`truncate ${item.done ? "text-white/45 line-through" : ""}`}
                        >
                          {item.title}
                        </span>
                      </button>
                      <span className="shrink-0 text-[9px] tabular-nums text-white/50">
                        {item.start_at ? fmt(item.start_at) : fmt(`${item.estimate_min}m`)}
                      </span>

                      {moveMenuItemId === item.id && (
                        <div className="absolute top-4 left-0 z-30 flex gap-0.5 rounded-md border border-white/20 bg-black/95 p-1 shadow-lg">
                          {effectiveState.blocks.map((target) => (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => {
                                onAssignTask(item.id, target.id);
                                setMoveMenuItemId(null);
                              }}
                              className="rounded px-1 py-0.5 text-[9px] text-white hover:bg-white/20"
                            >
                              {target.name.slice(0, 3)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {extraCount > 0 && (
                  <button
                    type="button"
                    data-testid={`waqt-block-expand-${blk.id}`}
                    onClick={(e) => {
                      returnFocusRef.current = e.currentTarget;
                      playUiSound("arc_scrub_tick");
                      setExpandedBlockId(blk.id);
                    }}
                    className="w-fit rounded-full bg-white/10 px-1.5 text-[9px] font-medium text-white/75 hover:bg-white/20"
                  >
                    {fmt(`+${extraCount}`)}
                  </button>
                )}

                {/* Past block logged facts (never blank) */}
                {blk.is_past && !hasBlockWork && (
                  <div
                    data-testid={`waqt-past-summary-${blk.id}`}
                    className="mt-0.5 text-[9.5px] text-white/60"
                  >
                    {blk.logged_focus_min > 0
                      ? fmt(`Focus ${formatDurationCompact(blk.logged_focus_min)} · Prayer ✓`)
                      : "Prayer ✓"}
                  </div>
                )}

                {/* Sparse / zero-task layers: Rhythm anchors + deterministic suggestion (<=1) + Add one thing */}
                {!blk.is_past && blk.items.length < 3 && (
                  <>
                    {blk.rhythm_anchors.slice(0, 1).map((anchor) => (
                      <button
                        key={anchor.id}
                        type="button"
                        data-testid={`waqt-rhythm-${blk.id}`}
                        onClick={() => {
                          playUiSound("toggle_on");
                          onAddTask(anchor.title, blk.id, anchor.estimate_min, null);
                        }}
                        className="flex w-full items-center justify-between gap-1 rounded px-1 py-[1px] text-left text-[9.5px] text-white/60 hover:bg-white/10 hover:text-white/90"
                        title={anchor.is_user_template ? msg.waqt.userAnchorLabel : anchor.title}
                      >
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <span
                            className="h-[4px] w-[4px] shrink-0 rounded-full"
                            style={{ backgroundColor: getKindDotColor(anchor.kind) }}
                          />
                          <span className="truncate">{anchor.title}</span>
                        </span>
                        {anchor.progress_label && (
                          <span className="shrink-0 text-[8.5px] tabular-nums text-white/45">
                            {fmt(anchor.progress_label)}
                          </span>
                        )}
                      </button>
                    ))}

                    {blk.suggestion && (
                      <motion.div
                        key={blk.suggestion.id}
                        data-testid={`waqt-suggestion-${blk.id}`}
                        initial={reduceMotion ? false : { opacity: 0.4, scale: 0.96 }}
                        animate={{ opacity: 0.62, scale: 1 }}
                        whileHover={reduceMotion ? undefined : { opacity: 0.95, scale: 1.01 }}
                        transition={reduceMotion ? { duration: 0.01 } : MOTION_PRESETS.bouncy}
                        style={{ borderColor: COLOR_TOKENS.waqtGhostBorder }}
                        className="flex items-center justify-between gap-1 rounded-[7px] border-[1.5px] border-dashed px-1.5 py-[1.5px] text-[9.5px] text-white/85"
                      >
                        <button
                          type="button"
                          onClick={() => handleAcceptSuggestion(blk.suggestion!)}
                          aria-label={`Add suggestion ${blk.suggestion.text}`}
                          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
                        >
                          <PlusIcon size={8} className="shrink-0 text-white/75" />
                          <span className="truncate">{blk.suggestion.text}</span>
                        </button>
                        <button
                          type="button"
                          data-testid={`waqt-dismiss-sug-${blk.id}`}
                          aria-label={`Dismiss suggestion ${blk.suggestion.text}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissSuggestion(blk.suggestion!);
                          }}
                          className="shrink-0 text-[10px] leading-none text-white/45 hover:text-white"
                        >
                          ×
                        </button>
                      </motion.div>
                    )}

                    {!hasBlockWork && !blk.suggestion && blk.is_current && (
                      <button
                        type="button"
                        data-testid="waqt-add-one-thing"
                        onClick={(e) => openQuickAdd(blk.id, e.currentTarget)}
                        style={{ borderColor: COLOR_TOKENS.waqtGhostBorder }}
                        className="flex w-full items-center gap-1 rounded-[7px] border-[1.5px] border-dashed px-1.5 py-[2px] text-[9.5px] text-white/70 opacity-75 hover:opacity-100"
                      >
                        <PlusIcon size={8} />
                        <span className="truncate">{msg.waqt.addOneThing}</span>
                      </button>
                    )}

                    {!hasBlockWork && !blk.suggestion && (
                      <span
                        data-testid={`waqt-length-hint-${blk.id}`}
                        className="mt-auto truncate text-[9px] text-white/45"
                      >
                        {blk.length_hint_kind === "deep_work"
                          ? msg.waqt.lengthHints.deep_work
                          : blk.length_hint_kind === "short_break"
                            ? msg.waqt.lengthHints.short_break
                            : msg.waqt.lengthHints.quick_tasks}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Capacity bar + status footer */}
              <div className="shrink-0 pt-0.5">
                <div
                  data-testid={`waqt-capacity-bar-${blk.id}`}
                  className="flex h-[3.5px] w-full gap-[1.5px] overflow-hidden rounded-full bg-white/15"
                >
                  {slices.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        width: `${s.pct}%`,
                        backgroundColor: s.colorVar,
                      }}
                      className="h-full rounded-full"
                    />
                  ))}
                </div>
                <div className="mt-[2px] flex items-center justify-between gap-1 text-[9.5px] leading-tight">
                  <span
                    className="truncate font-medium tabular-nums"
                    style={{
                      color: isOverbooked
                        ? COLOR_TOKENS.waqtDeadline
                        : blk.capacity_status === "tight"
                          ? COLOR_TOKENS.waqtHabit
                          : blk.is_current
                            ? "#ffb020"
                            : "rgba(255,255,255,0.68)",
                    }}
                  >
                    {isOverbooked && nextBlock
                      ? interpolateMsg(msg.waqt.noRoomBefore, {
                          prayer: nextBlock.prayer_label.split(" ")[0],
                        })
                      : blk.capacity_status === "tight"
                        ? msg.waqt.almostFull
                        : fmt(blk.status_text)}
                  </span>
                  {isOverbooked && nextBlock && (
                    <button
                      type="button"
                      data-testid={`waqt-move-overflow-${blk.id}`}
                      title={fmt(
                        interpolateMsg(msg.waqt.moveToNext, {
                          count: computeOverflowMoveAssignments(blk, nextBlock).length || 1,
                          block: nextBlock.name,
                        }),
                      )}
                      onClick={() => handleMoveOverflowBlock(blk, nextBlock)}
                      className="max-w-[58px] shrink-0 truncate rounded bg-[var(--waqt-deadline)]/25 px-1 py-[0.5px] text-[8.5px] font-semibold text-white hover:bg-[var(--waqt-deadline)]/40"
                    >
                      {fmt(`→ ${nextBlock.name}`)}
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* 4. BOTTOM ROW: (a) Focus Flow + Lumi, (b) Replay / Tomorrow, (c) Unplanned */}
      <div className="relative z-10 grid h-[82px] shrink-0 grid-cols-[1.25fr_1fr_1fr] gap-[10px]">
        {/* (a) Focus Card */}
        <div
          data-testid="waqt-focus-card"
          style={{ borderRadius: "var(--waqt-card-radius)" }}
          className={`flex items-center gap-2 overflow-hidden px-2.5 py-1.5 ${glassSurfaceClass}`}
        >
          <div className="shrink-0">
            <WaqtBodyDoubleLumi
              state={lumiMood}
              isVisible={isVisible}
              reduceMotion={reduceMotion}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="truncate text-[12px] font-semibold leading-tight text-white">
              {focusHeadline}
            </div>
            <div className="truncate text-[9.5px] text-white/65">{focusSubline}</div>
            {freeFocusPromptOpen ? (
              <div
                className="mt-1 flex items-center gap-1"
                data-testid="waqt-free-focus-log-prompt"
              >
                <span className="truncate text-[9.5px] text-white/85">
                  {msg.waqt.logFreeFocusPrompt}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onAddTask("Focus session", currentBlock?.id ?? "dhuhr", 25, null);
                    setFreeFocusPromptOpen(false);
                  }}
                  className="rounded-full bg-white px-2 py-[1px] text-[9.5px] font-semibold text-black"
                >
                  {msg.waqt.logFreeFocusYes}
                </button>
                <button
                  type="button"
                  onClick={() => setFreeFocusPromptOpen(false)}
                  className="text-[9.5px] text-white/60 hover:text-white"
                >
                  {msg.waqt.logFreeFocusNo}
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="waqt-start-focus-btn"
                  onClick={() => {
                    playUiSound("toggle_on");
                    if (pomodoro.running) {
                      onToggleFocusPause();
                    } else {
                      onStartFocusFlow(boundTask?.id ?? null);
                    }
                  }}
                  className="flex h-[22px] items-center gap-1 rounded-full bg-white px-2.5 text-[10.5px] font-semibold text-black hover:bg-white/90"
                >
                  {pomodoro.running ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
                  <span className="tabular-nums">
                    {pomodoro.running
                      ? fmt(`Pause ${formatTimerClock(pomodoro.remaining_secs)}`)
                      : fmt(`Start ${formatTimerClock(pomodoro.total_secs)}`)}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* (b) Replay Card / After-Isha Tomorrow Preview */}
        <div
          data-testid="waqt-replay-card"
          style={{ borderRadius: "var(--waqt-card-radius)" }}
          className={`flex flex-col justify-between overflow-hidden px-2.5 py-1.5 ${glassSurfaceClass}`}
        >
          {effectiveState.is_after_isha && !replayPlaying ? (
            <div
              data-testid="waqt-tomorrow-preview"
              className="flex h-full flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-white">
                  {msg.waqt.tomorrowTitle}
                </span>
                <button
                  type="button"
                  data-testid="waqt-plan-tomorrow-btn"
                  onClick={(e) => openQuickAdd("tomorrow:fajr", e.currentTarget)}
                  className="rounded-full bg-white/15 px-2 py-[0.5px] text-[9.5px] font-semibold text-white hover:bg-white/25"
                >
                  {msg.waqt.planTomorrow}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {effectiveState.tomorrow_blocks.map((tb) => (
                  <div
                    key={tb.id}
                    className="rounded bg-white/[0.06] px-1 py-[1px] text-center text-[8.5px] text-white/75"
                  >
                    <div className="truncate">{tb.name.slice(0, 4)}</div>
                    <div className="tabular-nums text-white/50">{fmt(String(tb.task_count))}</div>
                  </div>
                ))}
              </div>
              <div className="truncate text-[9.5px] tabular-nums text-white/65">
                {fmt(
                  interpolateMsg(msg.waqt.todaySummary, {
                    done: effectiveState.blocks.flatMap((b) => b.items).filter((i) => i.done)
                      .length,
                    focus: formatDurationCompact(effectiveState.total_focus_min),
                  }),
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-medium text-white/80">
                  {focusBarsEmpty ? msg.waqt.replayEmptyTitle : msg.waqt.replayTitle}
                </span>
                <button
                  type="button"
                  aria-label="Export Day Wrapped PNG"
                  onClick={handleExportWrapped}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <ShareIcon size={10} />
                </button>
              </div>
              <div className="flex h-[28px] items-end gap-[4px]">
                {effectiveState.focus_bars.map((val, idx) =>
                  focusBarsEmpty ? (
                    <div
                      key={idx}
                      data-testid="waqt-spark-dotted"
                      className="h-[6px] flex-1 rounded-full border border-dashed border-white/25"
                    />
                  ) : (
                    <div
                      key={idx}
                      style={{
                        height: `${Math.max(18, Math.min(100, val))}%`,
                        backgroundColor:
                          idx === effectiveState.focus_bars.length - 1
                            ? "var(--waqt-habit)"
                            : "var(--waqt-task)",
                      }}
                      className="flex-1 rounded-full opacity-90"
                    />
                  ),
                )}
              </div>
              <div className="truncate text-[9.5px] tabular-nums text-white/65">
                {exportedUrl
                  ? "Saved PNG summary"
                  : focusBarsEmpty
                    ? msg.waqt.replayEmptySubtitle
                    : fmt(
                        `Focus ${formatDurationCompact(effectiveState.total_focus_min)} · Prayers ${effectiveState.prayers_done_count}/5`,
                      )}
              </div>
            </>
          )}
        </div>

        {/* (c) Unplanned Card */}
        <div
          data-testid="waqt-unplanned-card"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragTaskId !== null) {
              playUiSound("toggle_on");
              onAssignTask(dragTaskId, null);
              setDragTaskId(null);
            }
          }}
          style={{ borderRadius: "var(--waqt-card-radius)" }}
          className={`flex flex-col justify-between overflow-hidden px-2.5 py-1.5 ${glassSurfaceClass}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[10.5px] font-medium text-white/80">
              {msg.waqt.unplannedTitle}
            </span>
            <span className="text-[9.5px] tabular-nums text-white/45">
              {fmt(String(effectiveState.unplanned.length))}
            </span>
          </div>

          {effectiveState.unplanned.length === 0 ? (
            <button
              type="button"
              data-testid="waqt-unplanned-empty"
              onClick={(e) => openQuickAdd(null, e.currentTarget)}
              style={{ borderColor: COLOR_TOKENS.waqtGhostBorder }}
              className="flex flex-1 items-center justify-center rounded-xl border border-dashed px-2 text-center text-[10px] text-white/55 hover:border-white/40 hover:text-white/85"
            >
              {msg.waqt.unplannedEmpty}
            </button>
          ) : (
            <>
              <div className="relative flex flex-wrap gap-1 overflow-visible">
                {effectiveState.unplanned.slice(0, 3).map((t) => (
                  <div key={t.id} className="relative">
                    <button
                      type="button"
                      data-testid={`waqt-unplanned-${t.id}`}
                      draggable
                      onDragStart={() => setDragTaskId(t.id)}
                      onClick={() => setMoveMenuItemId((cur) => (cur === t.id ? null : t.id))}
                      className="max-w-[96px] cursor-grab truncate rounded-full border border-white/15 bg-white/10 px-2 py-[1px] text-[9.5px] text-white/90 hover:bg-white/20"
                    >
                      {t.title}
                    </button>
                    {moveMenuItemId === t.id && (
                      <div
                        data-testid="waqt-move-menu"
                        className="absolute bottom-5 left-0 z-30 flex gap-0.5 rounded-md border border-white/20 bg-black/95 p-1 shadow-lg"
                      >
                        {effectiveState.blocks.map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => {
                              onAssignTask(t.id, target.id);
                              setMoveMenuItemId(null);
                            }}
                            className="rounded px-1.5 py-0.5 text-[9px] text-white hover:bg-white/20"
                          >
                            {target.name.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={(e) => openQuickAdd(null, e.currentTarget)}
                style={{ borderColor: COLOR_TOKENS.waqtGhostBorder }}
                className="flex h-[20px] items-center justify-center rounded-full border border-dashed text-[9.5px] text-white/55 hover:border-white/40 hover:text-white/85"
              >
                {msg.waqt.dropHere}
              </button>
            </>
          )}
        </div>
      </div>

      {/* OVERLAYS INSIDE 640x312 BOUNDARY */}

      {/* S11 First-run 3-step tip card (dismissible, never blocks interactions) */}
      {!localFirstRunDismissed && (
        <div
          data-testid="waqt-first-run-tip"
          className="absolute right-3 bottom-[94px] z-20 flex items-center gap-2 rounded-xl border border-white/20 bg-black/90 px-2.5 py-1.5 text-[9.5px] text-white shadow-xl"
        >
          <span className="font-semibold text-[#ffb020]">{msg.waqt.firstRunTitle}:</span>
          <span className="text-white/80">
            {msg.waqt.firstRunStep1} · {msg.waqt.firstRunStep2} · {msg.waqt.firstRunStep3}
          </span>
          <button
            type="button"
            data-testid="waqt-dismiss-first-run"
            onClick={() => {
              setLocalFirstRunDismissed(true);
              onDismissFirstRun?.();
            }}
            className="rounded-full bg-white/15 px-1.5 py-[1px] font-semibold text-white hover:bg-white/25"
          >
            {msg.waqt.dismiss}
          </button>
        </div>
      )}

      {/* Plan my day Preview Bar */}
      {planPreviewOpen && effectiveState.plan_my_day_preview.length > 0 && (
        <div
          data-testid="waqt-plan-preview-bar"
          className="absolute top-[34px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/95 px-3 py-1 text-[10.5px] text-white shadow-2xl"
        >
          <span>
            {fmt(
              interpolateMsg(msg.waqt.planPreviewTitle, {
                count: effectiveState.plan_my_day_preview.length,
              }),
            )}
          </span>
          <button
            type="button"
            data-testid="waqt-plan-accept-btn"
            onClick={handleApplyPlanPreview}
            className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black"
          >
            {msg.waqt.accept}
          </button>
          <button
            type="button"
            onClick={() => setPlanPreviewOpen(false)}
            className="text-white/60 hover:text-white"
          >
            <CloseIcon size={10} />
          </button>
        </div>
      )}

      {/* 5s Undo Toast for Plan my day / Overflow Move / Soft Delete */}
      {(batchUndoToast || deletedUndo) && (
        <div
          data-testid="waqt-undo-toast"
          className="absolute bottom-[94px] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/95 px-3 py-1 text-[10px] text-white shadow-2xl"
        >
          <span>{batchUndoToast ? batchUndoToast.label : `Deleted "${deletedUndo?.title}"`}</span>
          <button
            type="button"
            data-testid="waqt-undo-btn"
            onClick={() => {
              if (batchUndoToast) {
                handleUndoBatch();
              } else if (deletedUndo) {
                onRestoreTask(deletedUndo);
                setDeletedUndo(null);
              }
            }}
            className="rounded-full bg-white px-2 py-[1px] font-semibold text-black"
          >
            {msg.waqt.undo}
          </button>
        </div>
      )}

      {/* S17 Quick Add Bar */}
      {quickAddTarget !== undefined && quickAddTarget !== null && (
        <form
          data-testid="waqt-quick-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitQuickAdd();
          }}
          className="absolute top-[34px] left-1/2 z-30 flex w-[380px] -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/25 bg-black/95 px-3 py-1 shadow-2xl"
        >
          <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-[1px] text-[9.5px] font-semibold text-[#ffb020]">
            {quickAddTarget.startsWith("tomorrow:")
              ? msg.waqt.tomorrowTitle
              : (effectiveState.blocks.find((b) => b.id === quickAddTarget)?.name ?? "Task")}
          </span>
          <input
            ref={quickAddInputRef}
            data-testid="waqt-quick-add-input"
            value={quickAddValue}
            onChange={(e) => setQuickAddValue(e.target.value)}
            placeholder={msg.waqt.quickAddPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-white placeholder:text-white/40 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-white px-2 py-[1px] text-[10px] font-semibold text-black"
          >
            Add
          </button>
          <button
            type="button"
            aria-label={msg.waqt.closeSheet}
            onClick={closeQuickAdd}
            className="text-white/60 hover:text-white"
          >
            <CloseIcon size={11} />
          </button>
        </form>
      )}

      {/* S5 4+ Task In-place Block Sheet Morph */}
      {reduceMotion ? (
        expandedBlockId ? (
          <ExpandedBlockSheet
            block={effectiveState.blocks.find((b) => b.id === expandedBlockId) ?? null}
            reduceMotion={reduceMotion}
            closeLabel={msg.waqt.closeSheet}
            fmt={fmt}
            onClose={() => {
              setExpandedBlockId(null);
              window.requestAnimationFrame(() => returnFocusRef.current?.focus());
            }}
            onToggleTask={onToggleTask}
            onAddToBlock={(bid) => {
              setExpandedBlockId(null);
              openQuickAdd(bid);
            }}
          />
        ) : null
      ) : (
        <AnimatePresence>
          {expandedBlockId && (
            <ExpandedBlockSheet
              block={effectiveState.blocks.find((b) => b.id === expandedBlockId) ?? null}
              reduceMotion={reduceMotion}
              closeLabel={msg.waqt.closeSheet}
              fmt={fmt}
              onClose={() => {
                setExpandedBlockId(null);
                window.requestAnimationFrame(() => returnFocusRef.current?.focus());
              }}
              onToggleTask={onToggleTask}
              onAddToBlock={(bid) => {
                setExpandedBlockId(null);
                openQuickAdd(bid);
              }}
            />
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

interface ExpandedBlockSheetProps {
  block: WaqtBlockView | null;
  reduceMotion: boolean;
  closeLabel: string;
  fmt: (s: string) => string;
  onClose: () => void;
  onToggleTask: (taskId: number) => void;
  onAddToBlock: (blockId: string) => void;
}

function ExpandedBlockSheet({
  block,
  reduceMotion,
  closeLabel,
  fmt,
  onClose,
  onToggleTask,
  onAddToBlock,
}: ExpandedBlockSheetProps) {
  if (!block) return null;
  return (
    <motion.div
      data-testid={`waqt-block-sheet-${block.id}`}
      role="dialog"
      aria-modal="true"
      aria-label={block.name}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={reduceMotion ? { duration: 0.01 } : MOTION_PRESETS.smooth}
      className="absolute inset-x-[14px] top-[64px] bottom-[92px] z-40 flex flex-col justify-between rounded-[var(--waqt-card-radius)] border border-white/25 bg-[#0d0e12]/95 p-3 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold text-white">{block.name}</span>
          <span className="text-[10.5px] tabular-nums text-white/60">
            {fmt(block.range_label)} · {fmt(block.status_text)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddToBlock(block.id)}
            className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-white/20"
          >
            <PlusIcon size={9} /> Add
          </button>
          <button
            type="button"
            data-testid="waqt-sheet-close"
            onClick={onClose}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-white/25"
          >
            {closeLabel}
          </button>
        </div>
      </div>

      <div className="my-1.5 flex-1 space-y-1 overflow-y-auto pr-1">
        {block.items.map((item) => {
          const isCal = item.source === "calendar" || item.id < 0;
          return (
            <button
              key={item.id}
              type="button"
              disabled={isCal}
              onClick={() => !isCal && onToggleTask(item.id)}
              className="flex w-full items-center justify-between rounded-lg bg-white/[0.05] px-2 py-1 text-left text-[11px] text-white hover:bg-white/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.done ? (
                  <CheckIcon size={10} className="shrink-0 text-[var(--waqt-meeting)]" />
                ) : (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getKindDotColor(item.kind) }}
                  />
                )}
                <span className={item.done ? "text-white/45 line-through" : ""}>{item.title}</span>
              </span>
              <span className="tabular-nums text-[10px] text-white/55">
                {item.start_at ? fmt(item.start_at) : fmt(`${item.estimate_min}m`)}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

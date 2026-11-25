import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PinIcon, SettingsIcon } from "../design/icons";
import { CONTENT_STAGGER, getMotionTransition } from "../design/motion";
import { BASE_GEOMETRY, type ShapeStyle } from "../design/tokens";
import { type AppLanguage, getMessages } from "../i18n";
import {
  getMediaState,
  type HudEvent,
  isTauriRuntime,
  type LoadedPlugin,
  type LyricLine,
  mediaGetLyrics,
  type MediaStateSnapshot,
  type NotificationPopup,
  openSettingsWindow,
  pluginsList,
  pomodoroGetState,
  pomodoroReset,
  pomodoroSkip,
  type PomodoroSnapshot,
  pomodoroToggle,
  type PrayerCityPreset,
  prayerGetSchedule,
  prayerListCities,
  type PrayerSchedule,
  prayerSetCity,
  seekMedia,
  selectMediaSession,
  sendMediaCommand,
  setIslandSurfaceMode,
  setSystemVolume,
  shelfAdd,
  shelfClear,
  type ShelfItem,
  shelfList,
  shelfOpen,
  shelfRemove,
  subscribeFullscreenChange,
  subscribeHudEvent,
  subscribeMediaUpdated,
  subscribeNotificationPopup,
  subscribePomodoroTick,
  subscribeTrayToggleExpand,
  subscribeTrayToggleHide,
  syncPillBounds,
  type TaskItem,
  tasksAdd,
  tasksDelete,
  tasksList,
  tasksToggle,
  waterGetSummary,
  waterLog,
  type WaterSummary,
  waterUndo,
} from "../lib/ipc";
import { DEFAULT_SETTINGS } from "../settings";
import { LiveWaveform } from "../widgets/music/LiveWaveform";
import { MusicWidget } from "../widgets/music/MusicWidget";
import { PluginHostWidget } from "../widgets/plugins/PluginHostWidget";
import { PomodoroWidget } from "../widgets/pomodoro/PomodoroWidget";
import { PrayerWidget } from "../widgets/prayer/PrayerWidget";
import {
  BUILTIN_WIDGET_IDS,
  type IslandPageMeta,
  resolveOrderedWidgetIds,
} from "../widgets/registry";
import { ShelfWidget } from "../widgets/shelf/ShelfWidget";
import { TodoWidget } from "../widgets/todo/TodoWidget";
import { WaterWidget } from "../widgets/water/WaterWidget";
import { HudOverlay } from "./HudOverlay";
import { LumenMascot } from "./LumenMascot";
import { NotificationToast } from "./NotificationToast";
import { useIslandStore } from "./stateMachine";

export interface IslandShellProps {
  shapeStyle?: ShapeStyle;
  scaleFactor?: number;
  hideInFullscreen?: boolean;
  minimalNotch?: boolean;
  hoverToOpen?: boolean;
  hoverReturnSeconds?: number;
  mascotEnabled?: boolean;
  showHeaderClockSetting?: boolean;
  language?: AppLanguage;
  reducedMotionOverride?: boolean;
  pageOrder?: string[];
  hiddenPages?: string[];
  initialWaterGoalMl?: number;
  mediaExclusions?: string[];
  onShapeChange?: (next: ShapeStyle) => void;
  onOpenSettings?: () => void;
}

function formatClockParts(now: Date): { dateText: string; timeText: string } {
  const dateText = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeText = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return { dateText, timeText };
}

function formatShortTimer(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60);
  const s = Math.max(0, secs) % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function isTypingInContainer(container: HTMLElement | null): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active || (container && !container.contains(active))) {
    return false;
  }
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
}

function hasScrollableAncestor(target: EventTarget | null, stopAt: HTMLElement | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== stopAt) {
    const style = window.getComputedStyle(node);
    const scrollableY = style.overflowY === "auto" || style.overflowY === "scroll";
    if (scrollableY && node.scrollHeight > node.clientHeight + 2) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function IslandShell({
  shapeStyle = "notch",
  scaleFactor = 1,
  hideInFullscreen = true,
  minimalNotch = false,
  hoverToOpen = true,
  hoverReturnSeconds = 5,
  mascotEnabled = true,
  showHeaderClockSetting = true,
  language = "en",
  reducedMotionOverride = false,
  pageOrder = DEFAULT_SETTINGS.pageOrder,
  hiddenPages = DEFAULT_SETTINGS.hiddenPages,
  initialWaterGoalMl = 1500,
  mediaExclusions = [],
  onShapeChange,
  onOpenSettings,
}: IslandShellProps) {
  const { state, dispatch } = useIslandStore();
  const osReducedMotion = useReducedMotion() ?? false;
  const prefersReducedMotion = osReducedMotion || reducedMotionOverride;
  const msg = getMessages(language);

  const [clock, setClock] = useState(() => formatClockParts(new Date()));
  const [clockDateOverride, setClockDateOverride] = useState<boolean | null>(null);
  const showHeaderClock = clockDateOverride ?? showHeaderClockSetting;
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const [media, setMedia] = useState<MediaStateSnapshot | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsLines, setLyricsLines] = useState<LyricLine[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [waterGoalOverride, setWaterGoalOverride] = useState<number | null>(null);
  const waterGoalMl = waterGoalOverride ?? initialWaterGoalMl;
  const [waterSummary, setWaterSummary] = useState<WaterSummary | null>(null);
  const [waterReminders, setWaterReminders] = useState(true);
  const [prayerSchedule, setPrayerSchedule] = useState<PrayerSchedule | null>(null);
  const [prayerCities, setPrayerCities] = useState<PrayerCityPreset[]>([]);
  const [prayerLangOverride, setPrayerLangOverride] = useState<"en" | "bn" | null>(null);
  const prayerLang = prayerLangOverride ?? language;
  const [pomodoro, setPomodoro] = useState<PomodoroSnapshot | null>(null);
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [activeHud, setActiveHud] = useState<HudEvent | null>(null);
  const [activeNotification, setActiveNotification] = useState<NotificationPopup | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [slimReturnActive, setSlimReturnActive] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const hudTimerRef = useRef<number | null>(null);
  const isHoveredRef = useRef(false);
  const isPinnedRef = useRef(false);
  const expandedAtRef = useRef(0);
  const lastSurfaceBucketRef = useRef<string>("collapsed");
  const hoverOpenTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const returnNormalTimerRef = useRef<number | null>(null);
  const lastWheelAtRef = useRef(0);

  const clearHoverTimers = useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (returnNormalTimerRef.current !== null) {
      window.clearTimeout(returnNormalTimerRef.current);
      returnNormalTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearHoverTimers, [clearHoverTimers]);

  const scheduleAutoClose = useCallback(
    (graceMs = 350) => {
      if (!hoverToOpen || isPinnedRef.current || isHoveredRef.current) {
        return;
      }
      if (isTypingInContainer(pillRef.current)) {
        return;
      }
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
      leaveTimerRef.current = window.setTimeout(() => {
        leaveTimerRef.current = null;
        if (isHoveredRef.current || isPinnedRef.current || isTypingInContainer(pillRef.current)) {
          return;
        }
        setSlimReturnActive(true);
        dispatch({ type: "HOVER_COLLAPSE_SLIM" });
        if (returnNormalTimerRef.current !== null) {
          window.clearTimeout(returnNormalTimerRef.current);
        }
        const delayMs = Math.max(1, hoverReturnSeconds) * 1000;
        returnNormalTimerRef.current = window.setTimeout(() => {
          returnNormalTimerRef.current = null;
          setSlimReturnActive(false);
          dispatch({ type: "RESTORE_NORMAL" });
        }, delayMs);
      }, graceMs);
    },
    [dispatch, hoverReturnSeconds, hoverToOpen],
  );

  const pages = useMemo<IslandPageMeta[]>(() => {
    const catalog = new Map<string, IslandPageMeta>([
      [
        "music",
        {
          id: "music",
          titleLead: msg.pages.musicLead,
          titleAccent: msg.pages.musicAccent,
          accentVar: media?.active?.accent_hex || "var(--accent-blue)",
        },
      ],
      [
        "todo",
        {
          id: "todo",
          titleLead: msg.pages.todoLead,
          titleAccent: msg.pages.todoAccent,
          accentVar: "var(--accent-green)",
        },
      ],
      [
        "water",
        {
          id: "water",
          titleLead: msg.pages.waterLead,
          titleAccent: msg.pages.waterAccent,
          accentVar: "var(--accent-blue)",
        },
      ],
      [
        "prayer",
        {
          id: "prayer",
          titleLead: msg.pages.prayerLead,
          titleAccent: msg.pages.prayerAccent,
          accentVar: "var(--accent-cyan)",
        },
      ],
      [
        "pomodoro",
        {
          id: "pomodoro",
          titleLead: msg.pages.pomodoroLead,
          titleAccent: msg.pages.pomodoroAccent,
          accentVar: "var(--accent-orange)",
        },
      ],
      [
        "shelf",
        {
          id: "shelf",
          titleLead: msg.pages.shelfLead,
          titleAccent: msg.pages.shelfAccent,
          accentVar: "var(--accent-purple)",
        },
      ],
    ]);

    for (const plugin of plugins) {
      catalog.set(plugin.manifest.id, {
        id: plugin.manifest.id,
        titleLead: plugin.manifest.name,
        titleAccent: msg.pages.pluginAccent,
        accentVar: "var(--accent-cyan)",
        plugin,
      });
    }

    const orderedIds = resolveOrderedWidgetIds(
      BUILTIN_WIDGET_IDS,
      plugins.map((p) => p.manifest.id),
      pageOrder,
      hiddenPages,
    );

    return orderedIds
      .map((id) => catalog.get(id))
      .filter((item): item is IslandPageMeta => Boolean(item));
  }, [media?.active?.accent_hex, msg.pages, pageOrder, hiddenPages, plugins]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(formatClockParts(new Date()));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void tasksList().then(setTasks);
    void waterGetSummary(waterGoalMl, 4).then((w) => w && setWaterSummary(w));
    void prayerListCities().then(setPrayerCities);
    void prayerGetSchedule().then((p) => p && setPrayerSchedule(p));
    void pomodoroGetState().then((p) => p && setPomodoro(p));
    void shelfList().then(setShelfItems);
    void pluginsList().then(setPlugins);

    const prayerTimer = window.setInterval(() => {
      void prayerGetSchedule().then((p) => p && setPrayerSchedule(p));
    }, 30_000);
    return () => window.clearInterval(prayerTimer);
  }, [waterGoalMl]);

  useEffect(() => {
    const active = media?.active;
    if (!active?.title) {
      return;
    }
    void mediaGetLyrics(active.artist, active.title).then(setLyricsLines);
  }, [media?.active]);

  useEffect(() => {
    let unlistenFs: (() => void) | undefined;
    let unlistenExpand: (() => void) | undefined;
    let unlistenHide: (() => void) | undefined;
    let unlistenMedia: (() => void) | undefined;
    let unlistenPom: (() => void) | undefined;
    let unlistenHud: (() => void) | undefined;
    let unlistenNotify: (() => void) | undefined;

    const handleMediaSnapshot = (snapshot: MediaStateSnapshot | null) => {
      if (!snapshot) {
        return;
      }
      setMedia(snapshot);
      const activeTitle = snapshot.active?.title ?? "";
      const activeApp = snapshot.active?.app_id ?? "";
      const excluded = mediaExclusions.some((item) => {
        const q = item.trim().toLowerCase();
        return (
          q.length > 0 &&
          (activeApp.toLowerCase().includes(q) || activeTitle.toLowerCase().includes(q))
        );
      });
      const isPlaying = Boolean(snapshot.active?.is_playing) && !excluded;
      dispatch({ type: "MEDIA_CHANGE", active: isPlaying });
    };

    void getMediaState().then(handleMediaSnapshot);

    void subscribeMediaUpdated(handleMediaSnapshot).then((fn) => {
      unlistenMedia = fn;
    });
    void subscribePomodoroTick((snap) => {
      setPomodoro(snap);
      dispatch({ type: "TIMER_TICK", active: snap.running });
    }).then((fn) => {
      unlistenPom = fn;
    });
    void subscribeHudEvent((hud) => {
      setActiveNotification(null);
      setActiveHud(hud);
      dispatch({ type: "NOTIFICATION" });
      if (hudTimerRef.current !== null) {
        window.clearTimeout(hudTimerRef.current);
      }
      hudTimerRef.current = window.setTimeout(() => {
        setActiveHud(null);
        dispatch({ type: "HUD_DISMISS" });
      }, 1800);
    }).then((fn) => {
      unlistenHud = fn;
    });
    void subscribeNotificationPopup((popup) => {
      setActiveHud(null);
      setActiveNotification(popup);
      dispatch({ type: "NOTIFICATION" });
      if (hudTimerRef.current !== null) {
        window.clearTimeout(hudTimerRef.current);
      }
      hudTimerRef.current = window.setTimeout(() => {
        setActiveNotification(null);
        dispatch({ type: "HUD_DISMISS" });
      }, 4000);
    }).then((fn) => {
      unlistenNotify = fn;
    });
    void subscribeFullscreenChange((active) => {
      dispatch({ type: "FULLSCREEN_CHANGE", active });
    }).then((fn) => {
      unlistenFs = fn;
    });
    void subscribeTrayToggleExpand(() => {
      dispatch({ type: "HOTKEY_TOGGLE_EXPAND" });
    }).then((fn) => {
      unlistenExpand = fn;
    });
    void subscribeTrayToggleHide(() => {
      dispatch({ type: "HOTKEY_TOGGLE_HIDE" });
    }).then((fn) => {
      unlistenHide = fn;
    });

    return () => {
      unlistenFs?.();
      unlistenExpand?.();
      unlistenHide?.();
      unlistenMedia?.();
      unlistenPom?.();
      unlistenHud?.();
      unlistenNotify?.();
    };
  }, [dispatch, mediaExclusions]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearHoverTimers();
        isPinnedRef.current = false;
        setIsPinned(false);
        setSlimReturnActive(false);
        dispatch({ type: "ESCAPE" });
      } else if (state === "expanded" && event.key === "ArrowRight") {
        setActivePageIndex((idx) => (idx + 1) % pages.length);
      } else if (state === "expanded" && event.key === "ArrowLeft") {
        setActivePageIndex((idx) => (idx - 1 + pages.length) % pages.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, state, pages.length, clearHoverTimers]);

  const effectiveState = state === "idle" && minimalNotch ? "minimal" : state;
  const isSlimQuiet = effectiveState === "minimal" && slimReturnActive;

  const dimensions = useMemo(() => {
    if (isSlimQuiet) {
      return BASE_GEOMETRY.slim;
    }
    switch (effectiveState) {
      case "minimal":
        return BASE_GEOMETRY.minimal;
      case "live":
        return { width: 244, height: 34 };
      case "expanded":
        return BASE_GEOMETRY.expanded;
      case "hud":
        return BASE_GEOMETRY.hud;
      default:
        return BASE_GEOMETRY.collapsed;
    }
  }, [effectiveState, isSlimQuiet]);

  const width = Math.round(dimensions.width * scaleFactor);
  const height = Math.round(dimensions.height * scaleFactor);
  const expandedW = Math.round(BASE_GEOMETRY.expanded.width * scaleFactor);
  const expandedH = Math.round(BASE_GEOMETRY.expanded.height * scaleFactor);
  const isFloatingPill = shapeStyle === "pill";
  const topOffset = isFloatingPill ? Math.round(BASE_GEOMETRY.pillFloatOffset * scaleFactor) : 0;

  useEffect(() => {
    void syncPillBounds({
      width,
      height,
      topOffset,
      visible: state !== "hidden",
      hideInFullscreen,
    });

    const surfaceBucket =
      state === "expanded"
        ? "expanded"
        : state === "hud"
          ? "hud"
          : state === "hidden"
            ? "hidden"
            : "collapsed";

    if (lastSurfaceBucketRef.current === surfaceBucket) {
      return;
    }
    lastSurfaceBucketRef.current = surfaceBucket;

    if (surfaceBucket === "expanded") {
      void setIslandSurfaceMode(true, false, false);
      return;
    }
    if (surfaceBucket === "hud") {
      void setIslandSurfaceMode(false, false, true);
      return;
    }

    const delayMs = surfaceBucket === "hidden" ? 280 : 380;
    const timer = window.setTimeout(() => {
      void setIslandSurfaceMode(false, surfaceBucket === "hidden", false);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [width, height, topOffset, state, hideInFullscreen]);

  const safePageIndex = Math.min(activePageIndex, Math.max(0, pages.length - 1));
  const activePage = pages[safePageIndex] ?? pages[0];
  const isExpanded = effectiveState === "expanded";
  const isHidden = effectiveState === "hidden";
  const isHud = effectiveState === "hud" && activeHud !== null;
  const isNotify = effectiveState === "hud" && activeNotification !== null;
  const liveTrack = media?.active ?? null;
  const mediaAccent = liveTrack?.accent_hex || "var(--accent-blue)";
  const celebratingMascot = Boolean(
    waterSummary?.goal_reached || (pomodoro && pomodoro.chime_tick > 0 && !pomodoro.running),
  );
  const activeLyricsLines = useMemo(
    () => (liveTrack?.title ? lyricsLines : []),
    [liveTrack?.title, lyricsLines],
  );
  const activeLyric = useMemo(() => {
    if (!liveTrack || activeLyricsLines.length === 0) {
      return null;
    }
    const idx = activeLyricsLines.reduce(
      (acc, l, i) => (l.time_ms <= liveTrack.position_ms ? i : acc),
      -1,
    );
    return idx >= 0 ? (activeLyricsLines[idx]?.text ?? null) : null;
  }, [liveTrack, activeLyricsLines]);

  const sizeTransition = isHidden
    ? getMotionTransition("hideFullscreen", prefersReducedMotion)
    : isExpanded
      ? getMotionTransition("expand", prefersReducedMotion)
      : getMotionTransition("collapse", prefersReducedMotion);

  const nextShape: ShapeStyle = isFloatingPill ? "notch" : "pill";
  const surfaceBorderRadius = isFloatingPill
    ? `${Math.min(28, Math.round(height / 2))}px`
    : isSlimQuiet
      ? "0px 0px 8px 8px"
      : isExpanded
        ? "0px 0px 28px 28px"
        : "0px 0px 16px 16px";

  return (
    <div
      className="pointer-events-none flex h-full w-full items-start justify-center"
      style={{ paddingTop: `${topOffset}px` }}
    >
      <motion.div
        ref={pillRef}
        role="region"
        aria-label="Lumen Dynamic Island"
        aria-hidden={isHidden}
        data-testid="lumen-island-pill"
        data-state={effectiveState}
        data-slim={isSlimQuiet ? "true" : "false"}
        data-shape={shapeStyle}
        data-target-width={width}
        data-target-height={height}
        tabIndex={isHidden ? -1 : 0}
        onKeyDown={(event) => {
          if (!isExpanded && !isHidden && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            clearHoverTimers();
            setSlimReturnActive(false);
            dispatch({ type: "CLICK" });
          }
        }}
        onBlurCapture={() => {
          window.setTimeout(() => {
            if (isExpanded && !isHoveredRef.current && !isTypingInContainer(pillRef.current)) {
              scheduleAutoClose();
            }
          }, 0);
        }}
        onWheel={(event) => {
          if (!isExpanded || pages.length <= 1) {
            return;
          }
          if (hasScrollableAncestor(event.target, pillRef.current)) {
            return;
          }
          const now = Date.now();
          if (now - lastWheelAtRef.current < 220) {
            return;
          }
          if (Math.abs(event.deltaY) < 4 && Math.abs(event.deltaX) < 4) {
            return;
          }
          lastWheelAtRef.current = now;
          const dir =
            Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
          setActivePageIndex((idx) =>
            dir > 0 ? (idx + 1) % pages.length : (idx - 1 + pages.length) % pages.length,
          );
        }}
        className={`relative select-none ${isHidden ? "pointer-events-none" : "pointer-events-auto cursor-pointer"}`}
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--hairline)",
          borderStyle: "solid",
          borderWidth: "1px",
          borderTopWidth: isFloatingPill ? "1px" : "0px",
          boxShadow: "0 10px 28px rgba(0, 0, 0, 0.42)",
          transformOrigin: "top center",
        }}
        initial={false}
        animate={{
          width,
          height,
          borderRadius: surfaceBorderRadius,
          opacity: isHidden ? 0 : 1,
          scaleY: isHidden ? 0.25 : 1,
        }}
        transition={sizeTransition}
        onDragEnter={(event) => {
          event.preventDefault();
          clearHoverTimers();
          setSlimReturnActive(false);
          const shelfIdx = pages.findIndex((p) => p.id === "shelf");
          if (shelfIdx >= 0) {
            setActivePageIndex(shelfIdx);
          }
          dispatch({ type: "DRAG_ENTER" });
        }}
        onMouseEnter={() => {
          isHoveredRef.current = true;
          setIsHeaderHovered(true);
          clearHoverTimers();
          setSlimReturnActive(false);
          if (!isExpanded && !isHidden && !isHud && !isNotify && hoverToOpen) {
            hoverOpenTimerRef.current = window.setTimeout(() => {
              hoverOpenTimerRef.current = null;
              if (!isHoveredRef.current) {
                return;
              }
              expandedAtRef.current = Date.now();
              dispatch({ type: "HOVER_EXPAND" });
            }, 60);
          }
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
          setIsHeaderHovered(false);
          if (hoverOpenTimerRef.current !== null) {
            window.clearTimeout(hoverOpenTimerRef.current);
            hoverOpenTimerRef.current = null;
          }
          if (isExpanded) {
            const recentlyExpanded = Date.now() - expandedAtRef.current < 180;
            scheduleAutoClose(recentlyExpanded ? 420 : 350);
          }
        }}
        onClick={() => {
          if (!isExpanded && !isHidden) {
            clearHoverTimers();
            setSlimReturnActive(false);
            dispatch({ type: "CLICK" });
          }
        }}
      >
        {!isFloatingPill && (
          <>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
              className="pointer-events-none absolute top-0 -left-[9px]"
            >
              <path d="M 10 0 L 0 0 C 5.5 0 10 4.5 10 10 Z" fill="var(--surface)" />
            </svg>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
              className="pointer-events-none absolute top-0 -right-[9px]"
            >
              <path d="M 0 0 L 10 0 C 4.5 0 0 4.5 0 10 Z" fill="var(--surface)" />
            </svg>
          </>
        )}

        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
          <AnimatePresence initial={false}>
            {isNotify && activeNotification ? (
              <motion.div
                key="notification-overlay"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full"
              >
                <NotificationToast
                  notification={activeNotification}
                  onDismiss={() => {
                    setActiveNotification(null);
                    dispatch({ type: "HUD_DISMISS" });
                  }}
                />
              </motion.div>
            ) : isHud && activeHud ? (
              <motion.div
                key="hud-overlay"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full"
              >
                <HudOverlay hud={activeHud} />
              </motion.div>
            ) : !isExpanded ? (
              <motion.div
                key="collapsed-pill"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: CONTENT_STAGGER.collapseFadeMs / 1000 },
                }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className={`absolute inset-0 flex h-full w-full items-center whitespace-nowrap ${isSlimQuiet ? "justify-center px-2" : "justify-between px-5"}`}
              >
                {isSlimQuiet ? (
                  <div
                    data-testid="lumen-slim-indicator"
                    className="flex h-full w-full items-center justify-center"
                  >
                    <span
                      aria-hidden="true"
                      className="h-[3px] w-7 rounded-full"
                      style={{
                        backgroundColor: liveTrack?.is_playing
                          ? mediaAccent
                          : pomodoro?.running
                            ? "var(--accent-orange)"
                            : "var(--text-tertiary)",
                      }}
                    />
                  </div>
                ) : pomodoro?.running ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: "var(--accent-orange)" }}
                      />
                      <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
                        {msg.pill.focus}
                      </span>
                    </div>
                    <span
                      className="type-header-clock tabular-nums"
                      style={{ color: "var(--accent-orange)" }}
                    >
                      {formatShortTimer(pomodoro.remaining_secs)}
                    </span>
                  </>
                ) : liveTrack ? (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      {liveTrack.album_art_data_url ? (
                        <img
                          src={liveTrack.album_art_data_url}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded-md object-cover"
                        />
                      ) : mascotEnabled ? (
                        <LumenMascot
                          enabled
                          musicPlaying={liveTrack.is_playing}
                          celebrating={celebratingMascot}
                          accentColor={mediaAccent}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: mediaAccent }}
                        />
                      )}
                      <span
                        className="type-caption max-w-[125px] truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {activeLyric ?? liveTrack.title}
                      </span>
                    </div>
                    <LiveWaveform playing={liveTrack.is_playing} accentColor={mediaAccent} />
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {mascotEnabled ? (
                        <LumenMascot
                          enabled
                          celebrating={celebratingMascot}
                          accentColor="var(--accent-blue)"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: "var(--accent-blue)" }}
                        />
                      )}
                      {effectiveState !== "minimal" && (
                        <span
                          className="type-caption tracking-wide"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {msg.appName}
                        </span>
                      )}
                    </div>

                    <span
                      className="type-header-clock tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {clock.timeText}
                    </span>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="expanded-island"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: {
                    delay: prefersReducedMotion ? 0 : CONTENT_STAGGER.expandDelayMs / 1000,
                    duration: 0.16,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  transition: { duration: CONTENT_STAGGER.collapseFadeMs / 1000 },
                }}
                className="absolute top-0 flex flex-col justify-between"
                style={{
                  left: "50%",
                  x: "-50%",
                  width: `${expandedW}px`,
                  height: `${expandedH}px`,
                  padding: "var(--island-padding)",
                  paddingLeft: isFloatingPill ? "var(--island-padding)" : "28px",
                  paddingRight: isFloatingPill ? "var(--island-padding)" : "28px",
                  gap: "var(--island-gap)",
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h1 className="type-title m-0 flex items-center gap-1.5">
                    <span style={{ color: "var(--text-primary)" }}>{activePage.titleLead}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{activePage.titleAccent}</span>
                  </h1>

                  <button
                    type="button"
                    onClick={() => setClockDateOverride(!showHeaderClock)}
                    className="type-header-clock cursor-pointer border-0 bg-transparent p-0 tabular-nums"
                    style={{ color: "var(--text-secondary)" }}
                    title="Toggle date and time"
                  >
                    {showHeaderClock ? (
                      <>
                        {clock.dateText}{" "}
                        <strong style={{ color: "var(--text-primary)" }}>{clock.timeText}</strong>
                      </>
                    ) : (
                      <span>{clock.timeText}</span>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onShapeChange?.(nextShape)}
                      className="type-caption cursor-pointer rounded-full border-0 px-3 font-semibold"
                      style={{
                        height: "28px",
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {isFloatingPill ? msg.pill.shapeNotch : msg.pill.shapePill}
                    </button>

                    <button
                      type="button"
                      aria-label={isPinned ? msg.pill.unpin : msg.pill.pin}
                      aria-pressed={isPinned}
                      onClick={() => {
                        const next = !isPinned;
                        isPinnedRef.current = next;
                        setIsPinned(next);
                        if (next && leaveTimerRef.current !== null) {
                          window.clearTimeout(leaveTimerRef.current);
                          leaveTimerRef.current = null;
                        }
                      }}
                      className="type-caption flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: isPinned
                          ? "var(--accent-orange)"
                          : "var(--surface-button)",
                        color: isPinned ? "#000000" : "var(--text-primary)",
                      }}
                    >
                      <PinIcon size={13} />
                    </button>

                    <button
                      type="button"
                      aria-label={msg.pill.openSettings}
                      onClick={() => {
                        if (onOpenSettings) {
                          onOpenSettings();
                        } else {
                          void openSettingsWindow();
                        }
                      }}
                      className="type-caption flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <SettingsIcon size={13} />
                    </button>

                    <button
                      type="button"
                      aria-label={msg.pill.collapse}
                      onClick={() => {
                        clearHoverTimers();
                        isPinnedRef.current = false;
                        setIsPinned(false);
                        setSlimReturnActive(false);
                        dispatch({ type: "CLICK" });
                      }}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-raised)",
                        border: "1px solid var(--hairline)",
                      }}
                    >
                      {liveTrack?.is_playing ? (
                        <LiveWaveform playing accentColor={mediaAccent} />
                      ) : (
                        <span
                          className="block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: activePage.accentVar }}
                        />
                      )}
                    </button>
                  </div>
                </div>

                <div className="relative flex min-h-0 flex-1 items-center">
                  {isHeaderHovered && (
                    <button
                      type="button"
                      aria-label={msg.pill.prevPage}
                      onClick={() =>
                        setActivePageIndex((idx) => (idx - 1 + pages.length) % pages.length)
                      }
                      className="type-caption absolute -left-4 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <ChevronLeftIcon size={13} />
                    </button>
                  )}

                  {activePage.id === "music" && (
                    <MusicWidget
                      media={media}
                      lyricsOpen={lyricsOpen}
                      lyricsLines={activeLyricsLines}
                      onToggleLyrics={() => setLyricsOpen((v) => !v)}
                      onCommand={(cmd) => {
                        void sendMediaCommand(cmd).then((next) => next && setMedia(next));
                      }}
                      onSeek={(pos) => {
                        void seekMedia(pos).then((next) => next && setMedia(next));
                      }}
                      onVolumeChange={(vol) => {
                        void setSystemVolume(vol).then((next) => next && setMedia(next));
                      }}
                      onSelectSession={(appId) => {
                        void selectMediaSession(appId).then((next) => next && setMedia(next));
                      }}
                    />
                  )}

                  {activePage.id === "todo" && (
                    <TodoWidget
                      tasks={tasks}
                      onAdd={(title, dueAt) => {
                        void tasksAdd(title, dueAt).then((updated) => {
                          if (updated.length > 0 || isTauriRuntime()) {
                            setTasks(updated);
                          } else {
                            setTasks((prev) => [
                              {
                                id: Date.now(),
                                title,
                                done: false,
                                due_at: dueAt ?? null,
                                created_at: new Date().toISOString(),
                              },
                              ...prev,
                            ]);
                          }
                        });
                      }}
                      onToggle={(id) => {
                        void tasksToggle(id).then((updated) => {
                          if (isTauriRuntime()) {
                            setTasks(updated);
                          } else {
                            setTasks((prev) =>
                              prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
                            );
                          }
                        });
                      }}
                      onDelete={(id) => {
                        void tasksDelete(id).then((updated) => {
                          if (isTauriRuntime()) {
                            setTasks(updated);
                          } else {
                            setTasks((prev) => prev.filter((t) => t.id !== id));
                          }
                        });
                      }}
                    />
                  )}

                  {activePage.id === "water" && (
                    <WaterWidget
                      summary={waterSummary}
                      servingMl={250}
                      remindersEnabled={waterReminders}
                      onDrink={(ml) => {
                        void waterLog(ml, waterGoalMl, 4).then((w) => {
                          if (w) {
                            setWaterSummary(w);
                          } else {
                            const nextTotal = (waterSummary?.today_ml ?? 0) + ml;
                            const pct = (nextTotal / waterGoalMl) * 100;
                            setWaterSummary({
                              today_ml: nextTotal,
                              goal_ml: waterGoalMl,
                              percentage: pct,
                              goal_reached: pct >= 100,
                              last_entry_id: Date.now(),
                              weekly: [],
                            });
                          }
                        });
                      }}
                      onUndo={(entryId) => {
                        void waterUndo(entryId, waterGoalMl, 4).then(
                          (w) => w && setWaterSummary(w),
                        );
                      }}
                      onToggleReminders={() => setWaterReminders((v) => !v)}
                      onChangeGoal={(goal) => {
                        setWaterGoalOverride(goal);
                        void waterGetSummary(goal, 4).then((w) => w && setWaterSummary(w));
                      }}
                    />
                  )}

                  {activePage.id === "prayer" && (
                    <PrayerWidget
                      schedule={prayerSchedule}
                      cities={prayerCities}
                      language={prayerLang}
                      onSelectCity={(cityId) => {
                        void prayerSetCity(cityId).then((s) => s && setPrayerSchedule(s));
                      }}
                      onToggleLanguage={() =>
                        setPrayerLangOverride((l) => ((l ?? language) === "en" ? "bn" : "en"))
                      }
                    />
                  )}

                  {activePage.id === "pomodoro" && (
                    <PomodoroWidget
                      pomodoro={pomodoro}
                      onToggle={() => {
                        void pomodoroToggle().then((p) => p && setPomodoro(p));
                      }}
                      onSkip={() => {
                        void pomodoroSkip().then((p) => p && setPomodoro(p));
                      }}
                      onReset={() => {
                        void pomodoroReset().then((p) => p && setPomodoro(p));
                      }}
                    />
                  )}

                  {activePage.id === "shelf" && (
                    <ShelfWidget
                      items={shelfItems}
                      onAdd={(kind, val) => {
                        void shelfAdd(kind, val).then((items) => {
                          if (isTauriRuntime()) {
                            setShelfItems(items);
                          } else {
                            setShelfItems((prev) => [
                              {
                                id: Date.now(),
                                kind,
                                path_or_text: val,
                                display_name: val.slice(0, 40),
                                available: true,
                                added_at: new Date().toISOString(),
                              },
                              ...prev,
                            ]);
                          }
                        });
                      }}
                      onOpen={(target) => {
                        void shelfOpen(target);
                      }}
                      onRemove={(id) => {
                        void shelfRemove(id).then((items) => {
                          if (isTauriRuntime()) {
                            setShelfItems(items);
                          } else {
                            setShelfItems((prev) => prev.filter((i) => i.id !== id));
                          }
                        });
                      }}
                      onClear={() => {
                        void shelfClear().then(() => setShelfItems([]));
                      }}
                    />
                  )}

                  {activePage.plugin && <PluginHostWidget plugin={activePage.plugin} />}

                  {isHeaderHovered && (
                    <button
                      type="button"
                      aria-label={msg.pill.nextPage}
                      onClick={() => setActivePageIndex((idx) => (idx + 1) % pages.length)}
                      className="type-caption absolute -right-4 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <ChevronRightIcon size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5">
                  {pages.map((page, index) => {
                    const active = index === safePageIndex;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        aria-label={`Page ${index + 1}`}
                        onClick={() => setActivePageIndex(index)}
                        className="h-1.5 cursor-pointer rounded-full border-0 p-0 transition-[width,background-color] duration-200"
                        style={{
                          width: active ? "18px" : "6px",
                          backgroundColor: active ? activePage.accentVar : "var(--text-tertiary)",
                        }}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

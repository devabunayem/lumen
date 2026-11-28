import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarIcon,
  ChevronUpIcon,
  DropletIcon,
  GridIcon,
  InboxIcon,
  PinIcon,
  SettingsIcon,
  BoltIcon,
} from "../design/icons";
import { CONTENT_STAGGER, getMotionTransition } from "../design/motion";
import {
  evaluateLumiSilence,
  INITIAL_LUMI_SPEECH_STATE,
  Lumi,
  type LumiAccessory,
  type LumiEventKind,
  type LumiMood as NativeLumiMood,
  pickLumiSpeechLine,
  resolveLumiEventMood,
} from "../design/lumi";
import { playUiSound, type UiSoundName } from "../design/sounds";
import { BASE_GEOMETRY, measureNotificationDimensions, type ShapeStyle } from "../design/tokens";
import { CalendarHubPage } from "../calendar/CalendarHubPage";
import { HomePage } from "../home/HomePage";
import { type AppLanguage, getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import {
  calendarHubAddReminder,
  calendarHubAddTask,
  calendarHubCompleteReminder,
  calendarHubConnectIcs,
  calendarHubConnectOAuth,
  calendarHubDeleteAllData,
  calendarHubDeleteTask,
  calendarHubDisconnectSource,
  calendarHubDismissMissed,
  calendarHubFocusDismissFreeLog,
  calendarHubFocusGetState,
  calendarHubFocusLogFreeTask,
  calendarHubFocusRespondPrayer,
  calendarHubGetSnapshot,
  type CalendarHubSnapshot,
  calendarHubMoveTaskDue,
  calendarHubOpenExternalUrl,
  calendarHubRestoreTask,
  calendarHubSetFocusTask,
  calendarHubSnoozeReminder,
  calendarHubSyncNow,
  calendarHubToggleTask,
  type CalendarTask,
  type CalendarEvent,
  clipboardCopyLatest,
  clipboardGetLatest,
  type ClipboardChipSnapshot,
  type DevPulseSnapshot,
  type FocusFlowState,
  getMediaState,
  homeSetVisible,
  type HudEvent,
  isTauriRuntime,
  ledgerGet,
  ledgerToggle,
  type LoadedPlugin,
  type MediaStateSnapshot,
  type NotificationPopup,
  type OpenMeteoWeather,
  openSettingsWindow,
  pluginsList,
  pomodoroGetState,
  pomodoroSkip,
  type PomodoroSnapshot,
  pomodoroToggle,
  type PrayerCityPreset,
  prayerGetSchedule,
  prayerListCities,
  type PrayerSchedule,
  prayerSetCity,
  type ReminderAlertPayload,
  type ReminderItem,
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
  subscribeAudioPeak,
  subscribeCalendarHubUpdated,
  subscribeCalendarReminderAlert,
  subscribeClipboardUpdated,
  subscribeDevPulseUpdated,
  subscribeFocusFlowUpdated,
  subscribeFullscreenChange,
  subscribeHudEvent,
  subscribeMediaUpdated,
  subscribeNotificationPopup,
  subscribePomodoroTick,
  subscribePrayerUpdated,
  subscribeTrayToggleExpand,
  subscribeTrayToggleHide,
  syncPillBounds,
  systemBatteryStatus,
  systemGetMicMuted,
  systemLaunchScreenRecording,
  systemLaunchSnippingScreenshot,
  systemLockWorkstation,
  systemPrivacyIndicators,
  systemQuickTogglesState,
  systemToggleCamera,
  systemToggleMicMute,
  systemToggleSilentMode,
  tasbihGet,
  tasbihIncrement,
  tasbihReset,
  type TasbihState,
  type TaskItem,
  type TimeLedgerState,
  waterGetSummary,
  waterLog,
  type WaterSummary,
  waterUndo,
  weatherGetCurrent,
} from "../lib/ipc";
import { DEFAULT_SETTINGS, type ActionGlowMode } from "../settings";
import { LiveWaveform } from "../widgets/music/LiveWaveform";
import { ControlPanelWidget } from "../widgets/control/ControlPanelWidget";
import { PluginHostWidget } from "../widgets/plugins/PluginHostWidget";
import {
  BUILTIN_WIDGET_IDS,
  type IslandPageMeta,
  resolveOrderedWidgetIds,
} from "../widgets/registry";
import { ShelfWidget } from "../widgets/shelf/ShelfWidget";
import { WaterWidget } from "../widgets/water/WaterWidget";
import { ActionGlowLayer, type LumiMood } from "./ActionGlowLayer";
import { HudOverlay } from "./HudOverlay";
import { LumenMascot } from "./LumenMascot";
import { NotificationToast } from "./NotificationToast";
import { NowPlayingBanner, type NowPlayingBannerItem } from "./NowPlayingBanner";
import { ReminderAlertOverlay } from "./ReminderAlertOverlay";
import { useIslandStore } from "./stateMachine";

export interface IslandShellProps {
  shapeStyle?: ShapeStyle;
  scaleFactor?: number;
  hideInFullscreen?: boolean;
  minimalNotch?: boolean;
  hoverToOpen?: boolean;
  hoverReturnSeconds?: number;
  mascotEnabled?: boolean;
  lumiTalkLess?: boolean;
  lumiSoundsEnabled?: boolean;
  lumiAccessories?: LumiAccessory[];
  actionGlowMode?: ActionGlowMode;
  showHeaderClockSetting?: boolean;
  language?: AppLanguage;
  reducedMotionOverride?: boolean;
  reduceTransparency?: boolean;
  glowEnabled?: boolean;
  parallaxEnabled?: boolean;
  banglaDigits?: boolean;
  locationOptIn?: boolean;
  chipFocusEnabled?: boolean;
  chipLedgerEnabled?: boolean;
  chipClipboardEnabled?: boolean;
  chipDevPulseEnabled?: boolean;
  reminderSnoozeMinutes?: number;
  reminderDefaultLeadMinutes?: number;
  restingShowClock?: boolean;
  restingShowWaveform?: boolean;
  restingShowSensorDots?: boolean;
  restingShowBatteryRing?: boolean;
  nowPlayingBannerEnabled?: boolean;
  nowPlayingBannerSeconds?: number;
  notificationDurationSeconds?: number;
  pageOrder?: string[];
  hiddenPages?: string[];
  initialWaterGoalMl?: number;
  mediaExclusions?: string[];
  calendarFirstDayOfWeek?: 0 | 6;
  calendarColorBlindMarks?: boolean;
  calendarSocialBlockArmed?: boolean;
  calendarGoogleClientId?: string;
  calendarMicrosoftClientId?: string;
  calendarWritebackTasks?: boolean;
  onUpdateCalendarSettings?: (patch: {
    calendarGoogleClientId?: string;
    calendarMicrosoftClientId?: string;
    calendarWritebackTasks?: boolean;
  }) => void;
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
  lumiTalkLess = DEFAULT_SETTINGS.lumiTalkLess,
  lumiSoundsEnabled = DEFAULT_SETTINGS.lumiSoundsEnabled,
  lumiAccessories = DEFAULT_SETTINGS.lumiAccessories,
  actionGlowMode = "action",
  showHeaderClockSetting = true,
  language = "en",
  reducedMotionOverride = false,
  reduceTransparency = false,
  glowEnabled = true,
  parallaxEnabled = true,
  banglaDigits = false,
  locationOptIn = true,
  chipFocusEnabled = true,
  chipLedgerEnabled = true,
  chipClipboardEnabled = true,
  chipDevPulseEnabled = true,
  reminderSnoozeMinutes = 3,
  restingShowClock = true,
  restingShowWaveform = true,
  restingShowSensorDots = true,
  restingShowBatteryRing = true,
  nowPlayingBannerEnabled = true,
  nowPlayingBannerSeconds = 4,
  notificationDurationSeconds = 8,
  pageOrder = DEFAULT_SETTINGS.pageOrder,
  hiddenPages = DEFAULT_SETTINGS.hiddenPages,
  initialWaterGoalMl = 1500,
  mediaExclusions = DEFAULT_SETTINGS.mediaExclusions,
  calendarFirstDayOfWeek = DEFAULT_SETTINGS.calendarFirstDayOfWeek,
  calendarColorBlindMarks = DEFAULT_SETTINGS.calendarColorBlindMarks,
  calendarSocialBlockArmed = DEFAULT_SETTINGS.calendarSocialBlockArmed,
  calendarGoogleClientId = DEFAULT_SETTINGS.calendarGoogleClientId,
  calendarMicrosoftClientId = DEFAULT_SETTINGS.calendarMicrosoftClientId,
  calendarWritebackTasks = DEFAULT_SETTINGS.calendarWritebackTasks,
  onUpdateCalendarSettings,
  onShapeChange,
  onOpenSettings,
}: IslandShellProps) {
  const { state, dispatch } = useIslandStore();
  const osReducedMotion = useReducedMotion() ?? false;
  const prefersReducedMotion = osReducedMotion || reducedMotionOverride;
  const msg = getMessages(language);

  const [nowDate, setNowDate] = useState(() => new Date());
  const clock = useMemo(() => formatClockParts(nowDate), [nowDate]);
  const [clockDateOverride, setClockDateOverride] = useState<boolean | null>(null);
  const showHeaderClock = clockDateOverride ?? showHeaderClockSetting;
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [openedViaHomeCard, setOpenedViaHomeCard] = useState(false);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [pageGalleryOpen, setPageGalleryOpen] = useState(false);
  const [dockHovered, setDockHovered] = useState(false);
  const isBn = language === "bn";

  const [media, setMedia] = useState<MediaStateSnapshot | null>(null);
  const [audioPeak, setAudioPeak] = useState(0);
  const [lastPlayedTrack, setLastPlayedTrack] = useState<{ title: string; artist: string } | null>(
    null,
  );
  const [calendarHubSnapshot, setCalendarHubSnapshot] = useState<CalendarHubSnapshot | null>(null);
  const [calendarHubLoading, setCalendarHubLoading] = useState(() => isTauriRuntime());
  const [calSyncing, setCalSyncing] = useState(false);
  const [focusFlow, setFocusFlow] = useState<FocusFlowState | null>(null);
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }));
  const lastDeletedCalendarTaskRef = useRef<CalendarTask | null>(null);
  const calendarCursorRef = useRef(calendarMonthCursor);
  useEffect(() => {
    calendarCursorRef.current = calendarMonthCursor;
  }, [calendarMonthCursor]);

  const homeTasks = useMemo<TaskItem[]>(
    () =>
      (calendarHubSnapshot?.tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        done: Boolean(t.doneAt),
        due_at: t.dueDate ? (t.dueTime ? `${t.dueDate}T${t.dueTime}:00` : t.dueDate) : null,
        created_at: t.createdAt,
        estimate_min: t.estimateMin ?? 25,
        done_at: t.doneAt,
        client: t.client,
        kind: t.isDeadline ? "deadline" : "task",
      })),
    [calendarHubSnapshot?.tasks],
  );

  const homeEvents = useMemo<CalendarEvent[]>(
    () =>
      (calendarHubSnapshot?.events ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        start_at: e.start,
        created_at: e.start,
      })),
    [calendarHubSnapshot?.events],
  );

  const homeReminders = useMemo<ReminderItem[]>(
    () =>
      (calendarHubSnapshot?.reminders ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        target_at: r.nextTriggerAt ?? r.at ?? r.createdAt,
        lead_minutes: 0,
        lead_dismissed: true,
        snooze_until: null,
        exact_fired: false,
        completed: !r.active,
        created_at: r.createdAt,
      })),
    [calendarHubSnapshot?.reminders],
  );
  const [waterGoalOverride, setWaterGoalOverride] = useState<number | null>(null);
  const waterGoalMl = waterGoalOverride ?? initialWaterGoalMl;
  const [waterSummary, setWaterSummary] = useState<WaterSummary | null>(null);
  const [waterReminders, setWaterReminders] = useState(true);
  const [prayerSchedule, setPrayerSchedule] = useState<PrayerSchedule | null>(null);
  const [prayerCities, setPrayerCities] = useState<PrayerCityPreset[]>([]);
  const [pomodoro, setPomodoro] = useState<PomodoroSnapshot | null>(null);
  const [weather, setWeather] = useState<OpenMeteoWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tasbih, setTasbih] = useState<TasbihState>({ count: 33, target: 33 });
  const [ledger, setLedger] = useState<TimeLedgerState | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardChipSnapshot | null>(null);
  const [devPulse, setDevPulse] = useState<DevPulseSnapshot | null>(null);
  const [focusOn, setFocusOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [silentModeOn, setSilentModeOn] = useState(false);
  const [batteryState, setBatteryState] = useState<[number, boolean] | null>(null);
  const [isFirstOpenOfDay, setIsFirstOpenOfDay] = useState(false);
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [activeHud, setActiveHud] = useState<HudEvent | null>(null);
  const [activeNotification, setActiveNotification] = useState<NotificationPopup | null>(null);
  const [notifyExpanded, setNotifyExpanded] = useState(false);
  const [activeNowPlaying, setActiveNowPlaying] = useState<NowPlayingBannerItem | null>(null);
  const [activeReminderAlert, setActiveReminderAlert] = useState<ReminderAlertPayload | null>(null);
  const [activeLumiAction, setActiveLumiAction] = useState<{
    id: number;
    mood: LumiMood;
    nativeMood: NativeLumiMood;
    bubbleText: string | null;
    accentHex?: string;
  } | null>(null);
  const [lumiBeat, setLumiBeat] = useState(0);
  const lumiTimerRef = useRef<number | null>(null);
  const lumiSpeechRef = useRef(INITIAL_LUMI_SPEECH_STATE);
  const lastBeatAtRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lowBatteryAlertedRef = useRef(false);
  const prevChargingRef = useRef<boolean | null>(null);
  const prevChimeTickRef = useRef<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [slimReturnActive, setSlimReturnActive] = useState(false);
  const [privacyDevices, setPrivacyDevices] = useState<[boolean, boolean]>([false, false]);
  const prevExpandedRef = useRef(false);
  const prevPlayingKeyRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const activeInterruptRef = useRef(false);
  const nowPlayingCfgRef = useRef({
    enabled: nowPlayingBannerEnabled,
    seconds: nowPlayingBannerSeconds,
  });
  const notifyDurationRef = useRef(notificationDurationSeconds);
  const silentModeRef = useRef(false);
  useEffect(() => {
    silentModeRef.current = silentModeOn;
  }, [silentModeOn]);

  const lumiSilenceContext = useMemo(
    () => ({
      mascotEnabled,
      talkLess: lumiTalkLess,
      soundsEnabled: lumiSoundsEnabled && !silentModeOn,
      inCallOrMic: privacyDevices[1],
      isFullscreen: state === "hidden",
      focusActive: Boolean(focusOn || (pomodoro?.running && pomodoro.phase === "focus")),
      isPrayerWindow: Boolean(
        prayerSchedule &&
        !prayerSchedule.next_is_tomorrow &&
        typeof prayerSchedule.next_diff_min === "number" &&
        prayerSchedule.next_diff_min >= 0 &&
        prayerSchedule.next_diff_min <= 2,
      ),
      isQuietHours: Boolean(prayerSchedule?.is_night_mode),
    }),
    [
      mascotEnabled,
      lumiTalkLess,
      lumiSoundsEnabled,
      silentModeOn,
      privacyDevices,
      state,
      focusOn,
      pomodoro,
      prayerSchedule,
    ],
  );
  const lumiSilenceDecision = useMemo(
    () => evaluateLumiSilence(lumiSilenceContext),
    [lumiSilenceContext],
  );
  const lumiSilenceContextRef = useRef(lumiSilenceContext);
  useEffect(() => {
    lumiSilenceContextRef.current = lumiSilenceContext;
  }, [lumiSilenceContext]);

  const triggerLumiEvent = useCallback(
    (
      eventKind: LumiEventKind,
      options?: {
        legacyMood?: LumiMood;
        nativeMood?: NativeLumiMood;
        durationMs?: number;
        accentHex?: string;
        playChirp?: Extract<UiSoundName, "lumi_hello" | "lumi_happy">;
      },
    ) => {
      const ctx = lumiSilenceContextRef.current;
      const silence = evaluateLumiSilence(ctx);
      if (!ctx.mascotEnabled) {
        return;
      }
      const durationMs = options?.durationMs ?? 2500;
      const resolvedNativeMood =
        silence.forceMood ?? options?.nativeMood ?? resolveLumiEventMood(eventKind);
      const legacyMood: LumiMood =
        options?.legacyMood ??
        (eventKind === "startup"
          ? "wave"
          : eventKind === "taskDone" || eventKind === "streakMilestone"
            ? "celebrate"
            : eventKind === "water"
              ? "confirm"
              : eventKind === "music"
                ? "music"
                : "idle");
      const picked = pickLumiSpeechLine(
        eventKind,
        language,
        lumiSpeechRef.current,
        Date.now(),
        ctx,
      );
      lumiSpeechRef.current = picked.nextState;
      if (silence.allowSounds && options?.playChirp) {
        void playUiSound(options.playChirp);
      }
      if (lumiTimerRef.current !== null) {
        window.clearTimeout(lumiTimerRef.current);
      }
      setActiveLumiAction({
        id: Date.now(),
        mood: legacyMood,
        nativeMood: resolvedNativeMood,
        bubbleText: picked.line,
        accentHex: options?.accentHex,
      });
      lumiTimerRef.current = window.setTimeout(() => {
        lumiTimerRef.current = null;
        setActiveLumiAction(null);
      }, durationMs);
    },
    [language],
  );
  const triggerLumiEventRef = useRef(triggerLumiEvent);
  useEffect(() => {
    triggerLumiEventRef.current = triggerLumiEvent;
  }, [triggerLumiEvent]);

  const triggerLumiReaction = useCallback(
    (mood: LumiMood, durationMs = 2400, accentHex?: string) => {
      const ctx = lumiSilenceContextRef.current;
      const silence = evaluateLumiSilence(ctx);
      if (!ctx.mascotEnabled) {
        return;
      }
      const mappedNative: NativeLumiMood =
        silence.forceMood ??
        (mood === "wave"
          ? "hello"
          : mood === "celebrate"
            ? "celebrate"
            : mood === "confirm" || mood === "music"
              ? "happy"
              : mood === "sleep"
                ? "sleepy"
                : mood === "peek"
                  ? "curious"
                  : "idle");
      if (lumiTimerRef.current !== null) {
        window.clearTimeout(lumiTimerRef.current);
      }
      setActiveLumiAction({
        id: Date.now(),
        mood,
        nativeMood: mappedNative,
        bubbleText: null,
        accentHex,
      });
      lumiTimerRef.current = window.setTimeout(() => {
        lumiTimerRef.current = null;
        setActiveLumiAction(null);
      }, durationMs);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (lumiTimerRef.current !== null) {
        window.clearTimeout(lumiTimerRef.current);
      }
    };
  }, []);

  // Greet once smoothly after real desktop launch with wave + optional chirp
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    const timer = window.setTimeout(() => {
      triggerLumiEvent("startup", {
        legacyMood: "wave",
        durationMs: 2600,
        playChirp: "lumi_hello",
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [triggerLumiEvent]);

  // React to charger plug-in, low battery alerts, and Pomodoro completion milestones
  useEffect(() => {
    const charging = batteryState ? batteryState[1] : null;
    const pct = batteryState ? batteryState[0] : null;
    let t: number | null = null;
    if (charging !== null) {
      if (prevChargingRef.current === false && charging) {
        lowBatteryAlertedRef.current = false;
        t = window.setTimeout(() => {
          triggerLumiEvent("streakMilestone", {
            legacyMood: "celebrate",
            nativeMood: "celebrate",
            durationMs: 2500,
            playChirp: "lumi_happy",
          });
        }, 0);
      } else if (!charging && pct !== null && pct <= 20 && !lowBatteryAlertedRef.current) {
        lowBatteryAlertedRef.current = true;
        t = window.setTimeout(() => {
          triggerLumiEvent("lowBattery", {
            legacyMood: "idle",
            nativeMood: "worried",
            durationMs: 2800,
          });
        }, 0);
      } else if (pct !== null && pct > 25) {
        lowBatteryAlertedRef.current = false;
      }
      prevChargingRef.current = charging;
    }
    return () => {
      if (t !== null) window.clearTimeout(t);
    };
  }, [batteryState, triggerLumiEvent]);

  useEffect(() => {
    const chimeTick = pomodoro?.chime_tick ?? null;
    let t: number | null = null;
    if (chimeTick !== null) {
      if (prevChimeTickRef.current !== null && chimeTick > prevChimeTickRef.current) {
        t = window.setTimeout(() => {
          triggerLumiEvent("taskDone", {
            legacyMood: "celebrate",
            nativeMood: "celebrate",
            durationMs: 2800,
            playChirp: "lumi_happy",
          });
        }, 0);
      }
      prevChimeTickRef.current = chimeTick;
    }
    return () => {
      if (t !== null) window.clearTimeout(t);
    };
  }, [pomodoro?.chime_tick, triggerLumiEvent]);

  useEffect(() => {
    stateRef.current = state;
    activeInterruptRef.current = Boolean(activeNotification || activeReminderAlert);
    nowPlayingCfgRef.current = {
      enabled: nowPlayingBannerEnabled,
      seconds: nowPlayingBannerSeconds,
    };
    notifyDurationRef.current = notificationDurationSeconds;
  }, [
    state,
    activeNotification,
    activeReminderAlert,
    nowPlayingBannerEnabled,
    nowPlayingBannerSeconds,
    notificationDurationSeconds,
  ]);

  useEffect(() => {
    let active = true;
    const poll = () => {
      void systemPrivacyIndicators().then((res) => active && setPrivacyDevices(res));
      void systemBatteryStatus().then((b) => active && b && setBatteryState(b));
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const hudTimerRef = useRef<number | null>(null);
  const isHoveredRef = useRef(false);
  const isPinnedRef = useRef(false);
  const editingLockRef = useRef(false);
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
      if (!hoverToOpen || isPinnedRef.current || isHoveredRef.current || editingLockRef.current) {
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
        if (
          isHoveredRef.current ||
          isPinnedRef.current ||
          editingLockRef.current ||
          isTypingInContainer(pillRef.current)
        ) {
          return;
        }
        if (hoverReturnSeconds <= 0) {
          setSlimReturnActive(false);
          dispatch({ type: "RESTORE_NORMAL" });
          return;
        }
        setSlimReturnActive(true);
        dispatch({ type: "HOVER_COLLAPSE_SLIM" });
        if (returnNormalTimerRef.current !== null) {
          window.clearTimeout(returnNormalTimerRef.current);
        }
        const delayMs = hoverReturnSeconds * 1000;
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
        "calendar_hub",
        {
          id: "calendar_hub",
          titleLead: msg.pages.calendarHubLead,
          titleAccent: msg.pages.calendarHubAccent,
          accentVar: "var(--accent-focus)",
        },
      ],
      [
        "control",
        {
          id: "control",
          titleLead: msg.pages.controlLead,
          titleAccent: msg.pages.controlAccent,
          accentVar: "var(--accent-blue)",
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

    const homePageMeta: IslandPageMeta = {
      id: "home",
      titleLead: msg.pages.homeLead,
      titleAccent: msg.pages.homeAccent,
      accentVar: "var(--accent-blue)",
    };

    return [
      homePageMeta,
      ...orderedIds
        .map((id) => catalog.get(id))
        .filter((item): item is IslandPageMeta => Boolean(item)),
    ];
  }, [msg.pages, pageOrder, hiddenPages, plugins]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowDate(new Date());
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void waterGetSummary(waterGoalMl, 4).then((w) => w && setWaterSummary(w));
    void prayerListCities().then(setPrayerCities);
    void prayerGetSchedule().then((p) => p && setPrayerSchedule(p));
    void pomodoroGetState().then((p) => p && setPomodoro(p));
    void calendarHubFocusGetState().then((f) => f && setFocusFlow(f));
    void shelfList().then(setShelfItems);
    void pluginsList().then(setPlugins);
    void tasbihGet().then((ts) => ts && setTasbih(ts));
    void ledgerGet().then((l) => l && setLedger(l));
    void clipboardGetLatest().then((c) => c && setClipboard(c));
    void systemBatteryStatus().then((b) => b && setBatteryState(b));
    void systemQuickTogglesState().then((qt) => {
      if (qt) {
        setFocusOn(qt.focus);
        setMicMuted(qt.micMuted);
        setCameraEnabled(qt.cameraEnabled);
        setSilentModeOn(qt.silentMode);
      }
    });
    void systemGetMicMuted().then((muted) => setMicMuted(muted));
    void calendarHubGetSnapshot(calendarMonthCursor.year, calendarMonthCursor.month)
      .then((snap) => {
        if (snap) setCalendarHubSnapshot(snap);
        setCalendarHubLoading(false);
      })
      .catch(() => {
        setCalendarHubLoading(false);
      });
  }, [waterGoalMl, calendarMonthCursor.year, calendarMonthCursor.month]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setWeatherLoading(true);
        }
        return weatherGetCurrent();
      })
      .then((w) => {
        if (!cancelled && w) {
          setWeather(w);
        }
        return prayerGetSchedule();
      })
      .then((sched) => {
        if (!cancelled && sched) {
          setPrayerSchedule(sched);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locationOptIn]);

  useEffect(() => {
    let unlistenFs: (() => void) | undefined;
    let unlistenExpand: (() => void) | undefined;
    let unlistenHide: (() => void) | undefined;
    let unlistenMedia: (() => void) | undefined;
    let unlistenPeak: (() => void) | undefined;
    let unlistenPom: (() => void) | undefined;
    let unlistenHud: (() => void) | undefined;
    let unlistenNotify: (() => void) | undefined;
    let unlistenDevPulse: (() => void) | undefined;
    let unlistenClip: (() => void) | undefined;
    let unlistenPrayer: (() => void) | undefined;
    let unlistenFocusFlow: (() => void) | undefined;
    let unlistenCalReminderAlert: (() => void) | undefined;
    let unlistenCalHubUpdated: (() => void) | undefined;

    const handleMediaSnapshot = (snapshot: MediaStateSnapshot | null) => {
      if (!snapshot) {
        return;
      }
      setMedia(snapshot);
      if (snapshot.active?.title) {
        setLastPlayedTrack({
          title: snapshot.active.title,
          artist: snapshot.active.artist || snapshot.active.app_id,
        });
      }
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
      isPlayingRef.current = isPlaying;
      const trackKey =
        isPlaying && snapshot.active?.title
          ? `${snapshot.active.app_id}::${snapshot.active.title}::${snapshot.active.artist}`
          : null;
      if (trackKey && trackKey !== prevPlayingKeyRef.current) {
        prevPlayingKeyRef.current = trackKey;
        if (
          nowPlayingCfgRef.current.enabled &&
          stateRef.current !== "expanded" &&
          !activeInterruptRef.current &&
          snapshot.active
        ) {
          setActiveNowPlaying({
            title: snapshot.active.title,
            artist: snapshot.active.artist || snapshot.active.app_id,
            appName: snapshot.active.app_id,
            albumArtDataUrl: snapshot.active.album_art_data_url ?? null,
            accentHex: snapshot.active.accent_hex || "var(--accent-blue)",
          });
          dispatch({ type: "NOTIFICATION" });
          if (hudTimerRef.current !== null) {
            window.clearTimeout(hudTimerRef.current);
          }
          const bannerMs = Math.max(1500, nowPlayingCfgRef.current.seconds * 1000);
          hudTimerRef.current = window.setTimeout(() => {
            hudTimerRef.current = null;
            setActiveNowPlaying(null);
            dispatch({ type: "HUD_DISMISS" });
          }, bannerMs);
        }
      } else if (trackKey && trackKey === prevPlayingKeyRef.current && snapshot.active) {
        // Hydrate late-arriving YouTube/Chrome artwork onto an already-visible Now Playing banner.
        const nextArt = snapshot.active.album_art_data_url ?? null;
        const nextAccent = snapshot.active.accent_hex || "var(--accent-blue)";
        setActiveNowPlaying((cur) =>
          cur && (cur.albumArtDataUrl !== nextArt || cur.accentHex !== nextAccent)
            ? { ...cur, albumArtDataUrl: nextArt, accentHex: nextAccent }
            : cur,
        );
      } else if (!isPlaying) {
        prevPlayingKeyRef.current = null;
        setAudioPeak(0);
      }
      dispatch({ type: "MEDIA_CHANGE", active: isPlaying });
    };

    void getMediaState().then(handleMediaSnapshot);

    void subscribeMediaUpdated(handleMediaSnapshot).then((fn) => {
      unlistenMedia = fn;
    });
    void subscribeAudioPeak((peak) => {
      setAudioPeak(peak);
      if (isPlayingRef.current && peak > 0.35) {
        const now = Date.now();
        if (now - lastBeatAtRef.current >= 340) {
          lastBeatAtRef.current = now;
          setLumiBeat((b) => b + 1);
        }
      }
    }).then((fn) => {
      unlistenPeak = fn;
    });
    void subscribePomodoroTick((snap) => {
      setPomodoro(snap);
      if (snap.running && snap.phase === "focus") {
        setFocusOn(true);
      }
      dispatch({ type: "TIMER_TICK", active: snap.running });
    }).then((fn) => {
      unlistenPom = fn;
    });
    void subscribeHudEvent((hud) => {
      if (hud.kind === "battery" && typeof hud.value_pct === "number") {
        setBatteryState([hud.value_pct, hud.active]);
      }
      setActiveNotification(null);
      setNotifyExpanded(false);
      setActiveNowPlaying(null);
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
      if (silentModeRef.current) {
        return;
      }
      setActiveHud(null);
      setActiveNowPlaying(null);
      setActiveReminderAlert(null);
      setNotifyExpanded(false);
      setActiveNotification(popup);
      dispatch({ type: "NOTIFICATION" });
      if (hudTimerRef.current !== null) {
        window.clearTimeout(hudTimerRef.current);
      }
      const baseMs = Math.max(3000, notifyDurationRef.current * 1000);
      const durationMs = popup.body.length > 100 ? Math.max(baseMs, baseMs + 2500) : baseMs;
      hudTimerRef.current = window.setTimeout(() => {
        setActiveNotification(null);
        setNotifyExpanded(false);
        dispatch({ type: "HUD_DISMISS" });
      }, durationMs);
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
    void subscribeDevPulseUpdated((pulse) => setDevPulse(pulse)).then((fn) => {
      unlistenDevPulse = fn;
    });
    void subscribeClipboardUpdated((clip) => setClipboard(clip)).then((fn) => {
      unlistenClip = fn;
    });
    void subscribePrayerUpdated((sched) => setPrayerSchedule(sched)).then((fn) => {
      unlistenPrayer = fn;
    });
    void subscribeFocusFlowUpdated((f) => setFocusFlow(f)).then((fn) => {
      unlistenFocusFlow = fn;
    });
    void subscribeCalendarReminderAlert((calAlert) => {
      setActiveHud(null);
      setActiveNowPlaying(null);
      setActiveNotification(null);
      setNotifyExpanded(false);
      setActiveReminderAlert({
        reminder: {
          id: calAlert.reminder.id,
          title: calAlert.reminder.title,
          target_at:
            calAlert.reminder.nextTriggerAt ?? calAlert.reminder.at ?? new Date().toISOString(),
          lead_minutes: 0,
          lead_dismissed: true,
          snooze_until: null,
          exact_fired: true,
          completed: false,
          created_at: calAlert.reminder.createdAt,
        },
        stage: "calendar_hub",
        is_exact_due: true,
      });
      dispatch({ type: "NOTIFICATION" });
      if (hudTimerRef.current !== null) {
        window.clearTimeout(hudTimerRef.current);
      }
      hudTimerRef.current = window.setTimeout(() => {
        setActiveReminderAlert(null);
        dispatch({ type: "HUD_DISMISS" });
      }, 45_000);
    }).then((fn) => {
      unlistenCalReminderAlert = fn;
    });
    void subscribeCalendarHubUpdated(() => {
      const { year, month } = calendarCursorRef.current;
      void calendarHubGetSnapshot(year, month).then((snap) => snap && setCalendarHubSnapshot(snap));
    }).then((fn) => {
      unlistenCalHubUpdated = fn;
    });

    return () => {
      unlistenFs?.();
      unlistenExpand?.();
      unlistenHide?.();
      unlistenMedia?.();
      unlistenPeak?.();
      unlistenPom?.();
      unlistenHud?.();
      unlistenNotify?.();
      unlistenDevPulse?.();
      unlistenClip?.();
      unlistenPrayer?.();
      unlistenFocusFlow?.();
      unlistenCalReminderAlert?.();
      unlistenCalHubUpdated?.();
    };
  }, [dispatch, mediaExclusions]);

  const safePageIndex = Math.min(activePageIndex, Math.max(0, pages.length - 1));
  const activePage = pages[safePageIndex] ?? pages[0];
  const isHomePage = activePage.id === "home";
  const isCalendarHubPage = activePage.id === "calendar_hub";
  const isHomeSizedPage = isHomePage;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearHoverTimers();
        if (state === "expanded" && openedViaHomeCard && activePage.id !== "home") {
          setOpenedViaHomeCard(false);
          setSlideDirection(-1);
          setActivePageIndex(0);
          return;
        }
        setOpenedViaHomeCard(false);
        editingLockRef.current = false;
        isPinnedRef.current = false;
        setIsPinned(false);
        setSlimReturnActive(false);
        dispatch({ type: "ESCAPE" });
      } else if (state === "expanded" && event.key === "ArrowRight") {
        const ae = document.activeElement as HTMLElement | null;
        if (
          ae &&
          ae.closest(
            '[data-testid="day-arc-section"], [data-testid="calendar-grid-card"], input, textarea',
          )
        ) {
          return;
        }
        setOpenedViaHomeCard(false);
        setSlideDirection(1);
        setActivePageIndex((idx) => (idx + 1) % pages.length);
      } else if (state === "expanded" && event.key === "ArrowLeft") {
        const ae = document.activeElement as HTMLElement | null;
        if (
          ae &&
          ae.closest(
            '[data-testid="day-arc-section"], [data-testid="calendar-grid-card"], input, textarea',
          )
        ) {
          return;
        }
        setOpenedViaHomeCard(false);
        setSlideDirection(-1);
        setActivePageIndex((idx) => (idx - 1 + pages.length) % pages.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, state, pages.length, clearHoverTimers, openedViaHomeCard, activePage.id]);

  const effectiveState = state === "idle" && minimalNotch ? "minimal" : state;
  const isSlimQuiet = effectiveState === "minimal" && slimReturnActive;
  const isExpanded = effectiveState === "expanded";
  const isHidden = effectiveState === "hidden";

  useEffect(() => {
    let active = true;
    if (isExpanded && !prevExpandedRef.current) {
      void playUiSound("open");
      void Promise.resolve().then(() => {
        if (!active) {
          return;
        }
        try {
          const todayKey = new Date().toISOString().slice(0, 10);
          const lastKey = window.localStorage.getItem("lumen_last_open_day");
          if (lastKey !== todayKey) {
            setIsFirstOpenOfDay(true);
            window.localStorage.setItem("lumen_last_open_day", todayKey);
          } else {
            setIsFirstOpenOfDay(false);
          }
        } catch {
          // ignore storage restrictions
        }
      });
    } else if (!isExpanded && prevExpandedRef.current) {
      void playUiSound("close");
    }
    prevExpandedRef.current = isExpanded;
    return () => {
      active = false;
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded || !isHomePage || !ledger?.running) {
      return;
    }
    const t = window.setInterval(() => {
      setLedger((cur) => (cur ? { ...cur, elapsed_secs: cur.elapsed_secs + 1 } : cur));
    }, 1000);
    return () => window.clearInterval(t);
  }, [isExpanded, isHomePage, ledger?.running]);

  const dimensions = useMemo(() => {
    if (isSlimQuiet) {
      return BASE_GEOMETRY.slim;
    }
    switch (effectiveState) {
      case "minimal":
        return BASE_GEOMETRY.minimal;
      case "live":
        return BASE_GEOMETRY.collapsed;
      case "expanded":
        return isCalendarHubPage
          ? BASE_GEOMETRY.calendarHubExpanded
          : isHomeSizedPage
            ? BASE_GEOMETRY.homeExpanded
            : BASE_GEOMETRY.expanded;
      case "hud":
        if (activeReminderAlert !== null) {
          return BASE_GEOMETRY.reminder;
        }
        if (activeNotification !== null) {
          return measureNotificationDimensions(activeNotification, notifyExpanded);
        }
        if (activeNowPlaying !== null) {
          return BASE_GEOMETRY.nowPlaying;
        }
        return BASE_GEOMETRY.hud;
      default:
        return BASE_GEOMETRY.collapsed;
    }
  }, [
    effectiveState,
    isSlimQuiet,
    isCalendarHubPage,
    isHomeSizedPage,
    activeReminderAlert,
    activeNotification,
    notifyExpanded,
    activeNowPlaying,
  ]);

  const width = Math.round(dimensions.width * scaleFactor);
  const height = Math.round(dimensions.height * scaleFactor);
  const isFloatingPill = shapeStyle === "pill";
  const topOffset = isFloatingPill ? Math.round(BASE_GEOMETRY.pillFloatOffset * scaleFactor) : 0;
  const homeVisibleNow = isExpanded && (isHomeSizedPage || isCalendarHubPage) && !isHidden;
  const isBannerHud =
    effectiveState === "hud" &&
    (activeReminderAlert !== null || activeNotification !== null || activeNowPlaying !== null);

  useEffect(() => {
    void homeSetVisible(homeVisibleNow);
    void syncPillBounds({
      width,
      height,
      topOffset,
      visible: state !== "hidden",
      hideInFullscreen,
      cornerRadius: isFloatingPill
        ? isExpanded
          ? (isCalendarHubPage
              ? BASE_GEOMETRY.calendarHubBottomRadius
              : isHomeSizedPage
                ? BASE_GEOMETRY.homeBottomRadius
                : 28) * scaleFactor
          : isBannerHud
            ? (activeNowPlaying !== null && activeNotification === null ? 22 : 24) * scaleFactor
            : Math.round(height / 2)
        : isExpanded
          ? (isCalendarHubPage
              ? BASE_GEOMETRY.calendarHubBottomRadius
              : isHomeSizedPage
                ? BASE_GEOMETRY.homeBottomRadius
                : 24) * scaleFactor
          : isBannerHud
            ? (activeNowPlaying !== null && activeNotification === null ? 22 : 24) * scaleFactor
            : Math.round(height / 2),
      homeVisible: homeVisibleNow,
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
  }, [
    width,
    height,
    topOffset,
    state,
    hideInFullscreen,
    scaleFactor,
    isFloatingPill,
    isExpanded,
    isCalendarHubPage,
    isHomeSizedPage,
    homeVisibleNow,
    activeReminderAlert,
    activeNotification,
    activeNowPlaying,
    isBannerHud,
    effectiveState,
  ]);
  const isReminderAlert = effectiveState === "hud" && activeReminderAlert !== null;
  const isHud = effectiveState === "hud" && activeHud !== null;
  const isNotify = effectiveState === "hud" && activeNotification !== null;
  const isNowPlaying = effectiveState === "hud" && activeNowPlaying !== null;
  const liveTrack = media?.active ?? null;
  const mediaAccent = liveTrack?.accent_hex || "var(--accent-blue)";

  const sizeTransition = isHidden
    ? getMotionTransition("hideFullscreen", prefersReducedMotion)
    : isExpanded
      ? getMotionTransition("expand", prefersReducedMotion)
      : getMotionTransition("collapse", prefersReducedMotion);

  const nextShape: ShapeStyle = isFloatingPill ? "notch" : "pill";
  const surfaceBorderRadius = isFloatingPill
    ? `${Math.min(
        isExpanded
          ? isCalendarHubPage
            ? BASE_GEOMETRY.calendarHubBottomRadius
            : isHomeSizedPage
              ? BASE_GEOMETRY.homeBottomRadius
              : 28
          : isBannerHud
            ? isNowPlaying && !isNotify
              ? 22
              : 24
            : Math.round(height / 2),
        Math.round(height / 2),
      )}px`
    : isSlimQuiet
      ? "0px 0px 8px 8px"
      : isExpanded
        ? isCalendarHubPage
          ? `0px 0px ${Math.round(BASE_GEOMETRY.calendarHubBottomRadius * scaleFactor)}px ${Math.round(BASE_GEOMETRY.calendarHubBottomRadius * scaleFactor)}px`
          : isHomeSizedPage
            ? `0px 0px ${Math.round(BASE_GEOMETRY.homeBottomRadius * scaleFactor)}px ${Math.round(BASE_GEOMETRY.homeBottomRadius * scaleFactor)}px`
            : "0px 0px 24px 24px"
        : isBannerHud
          ? isNowPlaying && !isNotify
            ? "0px 0px 22px 22px"
            : "0px 0px 24px 24px"
          : "0px 0px 15px 15px";

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
          const step = dir > 0 ? 1 : -1;
          setSlideDirection(step);
          setActivePageIndex((idx) => (idx + step + pages.length) % pages.length);
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
          clearHoverTimers();
          setSlimReturnActive(false);
          if ((isNotify || isNowPlaying) && hudTimerRef.current !== null) {
            window.clearTimeout(hudTimerRef.current);
            hudTimerRef.current = null;
          }
          if (
            !isExpanded &&
            !isHidden &&
            !isHud &&
            !isNotify &&
            !isNowPlaying &&
            !isReminderAlert &&
            hoverToOpen
          ) {
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
          if (hoverOpenTimerRef.current !== null) {
            window.clearTimeout(hoverOpenTimerRef.current);
            hoverOpenTimerRef.current = null;
          }
          if (isNotify && !notifyExpanded && hudTimerRef.current === null) {
            hudTimerRef.current = window.setTimeout(() => {
              hudTimerRef.current = null;
              setActiveNotification(null);
              setNotifyExpanded(false);
              dispatch({ type: "HUD_DISMISS" });
            }, 3500);
          } else if (isNowPlaying && hudTimerRef.current === null) {
            hudTimerRef.current = window.setTimeout(() => {
              hudTimerRef.current = null;
              setActiveNowPlaying(null);
              dispatch({ type: "HUD_DISMISS" });
            }, 2000);
          }
          if (isExpanded) {
            const recentlyExpanded = Date.now() - expandedAtRef.current < 180;
            scheduleAutoClose(recentlyExpanded ? 420 : 350);
          }
        }}
        onClick={() => {
          if (
            !isExpanded &&
            !isHidden &&
            !isHud &&
            !isNotify &&
            !isNowPlaying &&
            !isReminderAlert
          ) {
            clearHoverTimers();
            setSlimReturnActive(false);
            dispatch({ type: "CLICK" });
          }
        }}
      >
        {!isFloatingPill && (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="pointer-events-none absolute top-0 -left-[15px]"
            >
              <path d="M 16 0 L 0 0 C 8.8 0 16 7.2 16 16 Z" fill="var(--surface)" />
            </svg>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="pointer-events-none absolute top-0 -right-[15px]"
            >
              <path d="M 0 0 L 16 0 C 7.2 0 0 7.2 0 16 Z" fill="var(--surface)" />
            </svg>
          </>
        )}

        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
          <ActionGlowLayer
            mode={actionGlowMode}
            active={Boolean(
              activeLumiAction ||
              activeNotification ||
              activeNowPlaying ||
              activeReminderAlert ||
              liveTrack?.is_playing,
            )}
            mood={
              activeLumiAction?.mood ??
              (activeNotification || activeReminderAlert
                ? "confirm"
                : activeNowPlaying || liveTrack?.is_playing || liveTrack
                  ? "music"
                  : focusOn || pomodoro?.running
                    ? "sleep"
                    : "idle")
            }
            accentHex={
              activeLumiAction?.accentHex ?? activeNowPlaying?.accentHex ?? liveTrack?.accent_hex
            }
            expanded={isExpanded}
            paused={Boolean(
              liveTrack &&
              !liveTrack.is_playing &&
              !activeLumiAction &&
              !activeNotification &&
              !activeReminderAlert,
            )}
            audioPeak={liveTrack?.is_playing ? audioPeak : 0}
          />
          {isExpanded && activeReminderAlert && (
            <div
              className="absolute inset-x-0 top-0 z-50 h-[108px] border-b border-white/10"
              style={{ backgroundColor: "rgba(10, 10, 12, 0.96)" }}
            >
              <ReminderAlertOverlay
                alert={activeReminderAlert}
                snoozeMinutes={
                  activeReminderAlert.stage === "calendar_hub" ? 10 : reminderSnoozeMinutes
                }
                language={language}
                onStop={(id) => {
                  if (hudTimerRef.current !== null) {
                    window.clearTimeout(hudTimerRef.current);
                    hudTimerRef.current = null;
                  }
                  void calendarHubCompleteReminder(id);
                  setActiveReminderAlert(null);
                }}
                onSnooze={(id) => {
                  if (hudTimerRef.current !== null) {
                    window.clearTimeout(hudTimerRef.current);
                    hudTimerRef.current = null;
                  }
                  void calendarHubSnoozeReminder(id, 10);
                  setActiveReminderAlert(null);
                }}
              />
            </div>
          )}
          <AnimatePresence initial={false}>
            {isReminderAlert && activeReminderAlert ? (
              <motion.div
                key="reminder-alert-overlay"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full"
              >
                <ReminderAlertOverlay
                  alert={activeReminderAlert}
                  snoozeMinutes={
                    activeReminderAlert.stage === "calendar_hub" ? 10 : reminderSnoozeMinutes
                  }
                  language={language}
                  onStop={(id) => {
                    if (hudTimerRef.current !== null) {
                      window.clearTimeout(hudTimerRef.current);
                      hudTimerRef.current = null;
                    }
                    void calendarHubCompleteReminder(id);
                    setActiveReminderAlert(null);
                    dispatch({ type: "HUD_DISMISS" });
                  }}
                  onSnooze={(id) => {
                    if (hudTimerRef.current !== null) {
                      window.clearTimeout(hudTimerRef.current);
                      hudTimerRef.current = null;
                    }
                    void calendarHubSnoozeReminder(id, 10);
                    setActiveReminderAlert(null);
                    dispatch({ type: "HUD_DISMISS" });
                  }}
                />
              </motion.div>
            ) : isNotify && activeNotification ? (
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
                  language={language}
                  expanded={notifyExpanded}
                  onToggleExpand={(next) => {
                    setNotifyExpanded(next);
                    if (hudTimerRef.current !== null) {
                      window.clearTimeout(hudTimerRef.current);
                      hudTimerRef.current = null;
                    }
                    if (!next && !isHoveredRef.current) {
                      hudTimerRef.current = window.setTimeout(() => {
                        hudTimerRef.current = null;
                        setActiveNotification(null);
                        setNotifyExpanded(false);
                        dispatch({ type: "HUD_DISMISS" });
                      }, 4500);
                    }
                  }}
                  onDismiss={() => {
                    if (hudTimerRef.current !== null) {
                      window.clearTimeout(hudTimerRef.current);
                      hudTimerRef.current = null;
                    }
                    setActiveNotification(null);
                    setNotifyExpanded(false);
                    dispatch({ type: "HUD_DISMISS" });
                  }}
                />
              </motion.div>
            ) : isNowPlaying && activeNowPlaying ? (
              <motion.div
                key="now-playing-banner-overlay"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full"
              >
                <NowPlayingBanner
                  item={activeNowPlaying}
                  language={language}
                  onOpenPlayer={() => {
                    if (hudTimerRef.current !== null) {
                      window.clearTimeout(hudTimerRef.current);
                      hudTimerRef.current = null;
                    }
                    setActiveNowPlaying(null);
                    setActivePageIndex(0);
                    dispatch({ type: "HOVER_EXPAND" });
                  }}
                  onDismiss={() => {
                    if (hudTimerRef.current !== null) {
                      window.clearTimeout(hudTimerRef.current);
                      hudTimerRef.current = null;
                    }
                    setActiveNowPlaying(null);
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
                className={`absolute inset-0 h-full w-full whitespace-nowrap ${
                  isSlimQuiet
                    ? "flex items-center justify-center px-2"
                    : "grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-3"
                }`}
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
                ) : activeLumiAction && mascotEnabled ? (
                  <div className="col-span-3 flex h-full w-full items-center justify-center">
                    <LumenMascot
                      enabled
                      size="hero"
                      mood={activeLumiAction.mood}
                      nativeMood={lumiSilenceDecision.forceMood ?? activeLumiAction.nativeMood}
                      bubbleText={
                        lumiSilenceDecision.allowBubbles ? activeLumiAction.bubbleText : null
                      }
                      beat={liveTrack?.is_playing ? lumiBeat : 0}
                      active={!isHidden && !isSlimQuiet && !isExpanded}
                      canLook={!isHidden && !isSlimQuiet}
                      reducedMotion={prefersReducedMotion}
                      nowDate={nowDate}
                      accessories={lumiAccessories}
                      accentColor={activeLumiAction.accentHex ?? mediaAccent}
                    />
                  </div>
                ) : (
                  <>
                    {/* Left status dots: Lumi (18px resting), Camera (green), Mic (orange), Charging/Low Battery ring, Focus */}
                    <div
                      data-testid="resting-left-indicators"
                      className="flex min-w-0 items-center justify-start gap-1.5"
                    >
                      {mascotEnabled && (
                        <Lumi
                          size={18}
                          mood={
                            lumiSilenceDecision.forceMood ??
                            (focusOn || (pomodoro?.running && pomodoro.phase === "focus")
                              ? "focus"
                              : liveTrack?.is_playing
                                ? "happy"
                                : "idle")
                          }
                          glowHue={
                            lumiSilenceDecision.forceMood === "calm"
                              ? "prayer"
                              : focusOn || pomodoro?.running
                                ? "focus"
                                : undefined
                          }
                          beat={liveTrack?.is_playing ? lumiBeat : 0}
                          active={!isHidden && !isSlimQuiet && !isExpanded && !activeLumiAction}
                          canLook={!isHidden && !isSlimQuiet}
                          reducedMotion={prefersReducedMotion}
                          nowDate={nowDate}
                          accessories={lumiAccessories}
                        />
                      )}
                      {restingShowSensorDots && privacyDevices[0] && (
                        <span
                          title={isBn ? "ক্যামেরা চালু" : "Camera active"}
                          data-testid="resting-camera-dot"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: "var(--accent-green)",
                            boxShadow: "0 0 6px var(--accent-green)",
                          }}
                        />
                      )}
                      {restingShowSensorDots && privacyDevices[1] && (
                        <span
                          title={isBn ? "মাইক্রোফোন চালু" : "Microphone active"}
                          data-testid="resting-mic-dot"
                          className="h-2 w-2 shrink-0 rounded-full animate-pulse"
                          style={{
                            backgroundColor: "var(--accent-orange)",
                            boxShadow: "0 0 6px var(--accent-orange)",
                          }}
                        />
                      )}
                      {restingShowBatteryRing &&
                        batteryState &&
                        (batteryState[1] || batteryState[0] <= 20) && (
                          <span
                            data-testid="resting-battery-ring"
                            title={
                              batteryState[1]
                                ? `${isBn ? "চার্জ হচ্ছে" : "Charging"} · ${batteryState[0]}%`
                                : `${isBn ? "ব্যাটারি কম" : "Low battery"} · ${batteryState[0]}%`
                            }
                            className="inline-flex shrink-0 items-center gap-1"
                          >
                            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                              <circle
                                cx="9"
                                cy="9"
                                r="7"
                                fill="none"
                                stroke="rgba(255,255,255,0.16)"
                                strokeWidth="2"
                              />
                              <circle
                                cx="9"
                                cy="9"
                                r="7"
                                fill="none"
                                stroke={
                                  batteryState[1] ? "var(--accent-green)" : "var(--accent-red)"
                                }
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 7}
                                strokeDashoffset={
                                  2 * Math.PI * 7 * (1 - Math.min(100, batteryState[0]) / 100)
                                }
                                transform="rotate(-90 9 9)"
                              />
                              {batteryState[1] && (
                                <path
                                  d="M9.6 5.2L6.8 9.6h2.2l-.6 3.2 2.8-4.4H9l.6-3.2z"
                                  fill="var(--accent-green)"
                                />
                              )}
                            </svg>
                            {effectiveState !== "minimal" && (
                              <span
                                className="text-[9.5px] font-semibold tabular-nums leading-none"
                                style={{
                                  color: batteryState[1]
                                    ? "var(--accent-green)"
                                    : "var(--accent-red)",
                                }}
                              >
                                {formatDigits(batteryState[0], banglaDigits)}%
                              </span>
                            )}
                          </span>
                        )}
                      {pomodoro?.running && (
                        <span
                          title={isBn ? "ফোকাস চালু" : "Focus session active"}
                          data-testid="resting-focus-dot"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: "var(--accent-focus)" }}
                        />
                      )}
                    </div>

                    {/* Dead-center Clock (always centered vertically & horizontally) */}
                    <div
                      data-testid="resting-center-clock"
                      className="flex items-center justify-center"
                    >
                      {restingShowClock && (
                        <span
                          className={`font-semibold tracking-tight tabular-nums leading-none ${
                            effectiveState === "minimal" ? "text-[11.5px]" : "text-[13.5px]"
                          }`}
                          style={{ color: "var(--text-primary)" }}
                        >
                          {formatDigits(clock.timeText, banglaDigits)}
                        </span>
                      )}
                    </div>

                    {/* Right cluster: Music wave (animates when playing, calm when paused/idle) */}
                    <div
                      data-testid="resting-right-waveform"
                      className="flex min-w-0 items-center justify-end"
                    >
                      {restingShowWaveform && (
                        <LiveWaveform
                          playing={Boolean(liveTrack?.is_playing)}
                          accentColor={liveTrack?.is_playing ? mediaAccent : "var(--text-tertiary)"}
                          audioPeak={liveTrack?.is_playing ? audioPeak : 0}
                        />
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="expanded-stage"
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.96 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: getMotionTransition("homeContentEnter", prefersReducedMotion),
                }}
                exit={{
                  opacity: 0,
                  scale: prefersReducedMotion ? 1 : 0.96,
                  transition: { duration: CONTENT_STAGGER.collapseFadeMs / 1000 },
                }}
                className="absolute inset-0 h-full w-full overflow-hidden"
              >
                <AnimatePresence custom={slideDirection} initial={false} mode="popLayout">
                  {isHomePage ? (
                    <motion.div
                      key="page-home"
                      custom={slideDirection}
                      variants={{
                        enter: (direction: number) => ({
                          x: prefersReducedMotion ? 0 : direction > 0 ? 72 : -72,
                          opacity: 0,
                          scale: prefersReducedMotion ? 1 : 0.985,
                        }),
                        center: {
                          x: 0,
                          opacity: 1,
                          scale: 1,
                          transition: getMotionTransition("pageSwitch", prefersReducedMotion),
                        },
                        exit: (direction: number) => ({
                          x: prefersReducedMotion ? 0 : direction > 0 ? -72 : 72,
                          opacity: 0,
                          scale: prefersReducedMotion ? 1 : 0.985,
                          transition: {
                            duration: prefersReducedMotion ? 0.08 : 0.16,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="absolute inset-0 flex items-start justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div
                        className="origin-top shrink-0"
                        style={{
                          width: `${BASE_GEOMETRY.homeExpanded.width}px`,
                          height: `${BASE_GEOMETRY.homeExpanded.height}px`,
                          transform: scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined,
                        }}
                      >
                        <HomePage
                          nowDate={nowDate}
                          schedule={prayerSchedule}
                          prayerCities={prayerCities}
                          onSelectPrayerCity={(cityId) => {
                            void prayerSetCity(cityId).then((s) => s && setPrayerSchedule(s));
                          }}
                          media={
                            media ?? {
                              active: null,
                              sessions: [],
                              volume_percent: 50,
                              muted: false,
                            }
                          }
                          lastPlayedTrack={lastPlayedTrack}
                          calendarEvents={homeEvents}
                          tasks={homeTasks}
                          reminders={homeReminders}
                          water={
                            waterSummary ?? {
                              today_ml: 0,
                              goal_ml: waterGoalMl,
                              percentage: 0,
                              goal_reached: false,
                              last_entry_id: null,
                              weekly: [],
                            }
                          }
                          pomodoro={
                            pomodoro ?? {
                              phase: "focus",
                              remaining_secs: 25 * 60,
                              total_secs: 25 * 60,
                              running: false,
                              cycle_index: 0,
                              cycles_before_long: 4,
                              daily_focus_minutes: 0,
                              chime_tick: 0,
                            }
                          }
                          weather={weather}
                          weatherLoading={weatherLoading}
                          tasbih={tasbih}
                          ledger={ledger}
                          clipboard={clipboard}
                          devPulse={devPulse}
                          toggles={{
                            focus: Boolean(
                              focusOn || (pomodoro?.running && pomodoro.phase === "focus"),
                            ),
                            micMuted,
                            cameraEnabled,
                            silentMode: silentModeOn,
                          }}
                          batteryPct={batteryState ? batteryState[0] : null}
                          isCharging={batteryState ? batteryState[1] : false}
                          language={language}
                          banglaDigits={banglaDigits}
                          reduceMotion={prefersReducedMotion}
                          reduceTransparency={reduceTransparency}
                          glowEnabled={glowEnabled}
                          parallaxEnabled={parallaxEnabled}
                          chipsConfig={{
                            focus: chipFocusEnabled,
                            ledger: chipLedgerEnabled,
                            clipboard: chipClipboardEnabled,
                            devPulse: chipDevPulseEnabled,
                          }}
                          pagesCount={pages.length}
                          activePageIndex={safePageIndex}
                          isVisible={homeVisibleNow}
                          isFirstOpenOfDay={isFirstOpenOfDay}
                          onNavigateWidget={(targetId) => {
                            const targetIndex = pages.findIndex((p) => p.id === targetId);
                            if (targetIndex >= 0) {
                              setOpenedViaHomeCard(true);
                              setSlideDirection(1);
                              setActivePageIndex(targetIndex);
                            }
                          }}
                          onSelectPage={(idx) => {
                            setOpenedViaHomeCard(false);
                            setSlideDirection(idx >= safePageIndex ? 1 : -1);
                            setActivePageIndex(idx);
                          }}
                          onOpenSettings={() => {
                            if (onOpenSettings) {
                              onOpenSettings();
                            } else {
                              void openSettingsWindow();
                            }
                          }}
                          onLaunchScreenshot={() => {
                            triggerLumiReaction("confirm", 1800);
                            return systemLaunchSnippingScreenshot();
                          }}
                          onLaunchScreenRecord={() => {
                            triggerLumiReaction("confirm", 1800);
                            return systemLaunchScreenRecording();
                          }}
                          onToggleFocus={() => {
                            const currentlyFocused = Boolean(
                              focusOn || (pomodoro?.running && pomodoro.phase === "focus"),
                            );
                            const nextFocus = !currentlyFocused;
                            setFocusOn(nextFocus);
                            triggerLumiReaction(nextFocus ? "sleep" : "celebrate", 2000);
                            const shouldTogglePomodoro = Boolean(pomodoro?.running) !== nextFocus;
                            if (shouldTogglePomodoro) {
                              void pomodoroToggle().then((p) => p && setPomodoro(p));
                            }
                          }}
                          onToggleMic={() => {
                            setMicMuted((m) => !m);
                            triggerLumiReaction("confirm", 1800);
                            void systemToggleMicMute().then((m) => setMicMuted(m));
                          }}
                          onToggleCamera={async () => {
                            const next = await systemToggleCamera();
                            setCameraEnabled(next);
                            triggerLumiReaction("confirm", 1800);
                            return next;
                          }}
                          onLockWorkstation={() => void systemLockWorkstation()}
                          onToggleSilentMode={() => {
                            const next = !silentModeOn;
                            setSilentModeOn(next);
                            triggerLumiReaction(next ? "sleep" : "confirm", 1800);
                            void systemToggleSilentMode(next).then((s) => setSilentModeOn(s));
                          }}
                          onIncrementTasbih={() => {
                            setTasbih((cur) => ({ ...cur, count: cur.count + 1 }));
                            triggerLumiReaction("celebrate", 2000);
                            void tasbihIncrement().then((ts) => ts && setTasbih(ts));
                          }}
                          onResetTasbih={() => {
                            setTasbih((cur) => ({ ...cur, count: 0 }));
                            void tasbihReset().then((ts) => ts && setTasbih(ts));
                          }}
                          onMediaPlayPause={() =>
                            void sendMediaCommand("play_pause").then((n) => n && setMedia(n))
                          }
                          onMediaPrev={() =>
                            void sendMediaCommand("previous").then((n) => n && setMedia(n))
                          }
                          onMediaNext={() =>
                            void sendMediaCommand("next").then((n) => n && setMedia(n))
                          }
                          onMediaSeek={(pos) => void seekMedia(pos).then((n) => n && setMedia(n))}
                          onMediaMuteToggle={() =>
                            void sendMediaCommand("toggle_mute").then((n) => n && setMedia(n))
                          }
                          onMediaVolumeDelta={(pct) =>
                            void setSystemVolume(pct).then((n) => n && setMedia(n))
                          }
                          onMediaSelectSession={(appId) =>
                            void selectMediaSession(appId).then((n) => n && setMedia(n))
                          }
                          onLogWater={(ml) => {
                            triggerLumiEvent("water", {
                              legacyMood: "celebrate",
                              durationMs: 2200,
                              playChirp: "lumi_happy",
                            });
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
                          onToggleFocusTimer={() => {
                            triggerLumiReaction("sleep", 2200);
                            void pomodoroToggle().then((p) => p && setPomodoro(p));
                          }}
                          onToggleLedger={() => {
                            triggerLumiReaction("confirm", 1800);
                            void ledgerToggle().then((l) => l && setLedger(l));
                          }}
                          onCopyClipboard={async () => {
                            triggerLumiReaction("confirm", 2000);
                            const next = await clipboardCopyLatest();
                            setClipboard(next);
                          }}
                          onToggleShape={() => onShapeChange?.(nextShape)}
                        />
                      </div>
                    </motion.div>
                  ) : isCalendarHubPage ? (
                    <motion.div
                      key="page-calendar_hub"
                      custom={slideDirection}
                      variants={{
                        enter: (direction: number) => ({
                          x: prefersReducedMotion ? 0 : direction > 0 ? 72 : -72,
                          opacity: 0,
                          scale: prefersReducedMotion ? 1 : 0.985,
                        }),
                        center: {
                          x: 0,
                          opacity: 1,
                          scale: 1,
                          transition: getMotionTransition("pageSwitch", prefersReducedMotion),
                        },
                        exit: (direction: number) => ({
                          x: prefersReducedMotion ? 0 : direction > 0 ? -72 : 72,
                          opacity: 0,
                          scale: prefersReducedMotion ? 1 : 0.985,
                          transition: {
                            duration: prefersReducedMotion ? 0.08 : 0.16,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="absolute inset-0 flex items-start justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div
                        className="origin-top shrink-0"
                        style={{
                          width: `${BASE_GEOMETRY.calendarHubExpanded.width}px`,
                          height: `${BASE_GEOMETRY.calendarHubExpanded.height}px`,
                          transform: scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined,
                        }}
                      >
                        <CalendarHubPage
                          snapshot={calendarHubSnapshot}
                          loading={calendarHubLoading}
                          nowDate={nowDate}
                          pomodoro={
                            pomodoro ?? {
                              phase: "focus",
                              remaining_secs: 25 * 60,
                              total_secs: 25 * 60,
                              running: false,
                              cycle_index: 0,
                              cycles_before_long: 4,
                              daily_focus_minutes: 0,
                              chime_tick: 0,
                            }
                          }
                          focusFlow={focusFlow}
                          firstDayOfWeek={calendarFirstDayOfWeek}
                          colorBlindMarks={calendarColorBlindMarks}
                          socialBlockedArmed={calendarSocialBlockArmed}
                          googleClientId={calendarGoogleClientId}
                          microsoftClientId={calendarMicrosoftClientId}
                          writebackTasks={calendarWritebackTasks}
                          syncing={calSyncing}
                          language={language}
                          banglaDigits={banglaDigits}
                          reduceMotion={prefersReducedMotion}
                          reduceTransparency={reduceTransparency}
                          glowEnabled={glowEnabled}
                          onOpenSettings={() => {
                            if (onOpenSettings) {
                              onOpenSettings();
                            } else {
                              void openSettingsWindow();
                            }
                          }}
                          onToggleTask={(taskId) => {
                            setCalendarHubSnapshot((cur) => {
                              if (!cur) return cur;
                              return {
                                ...cur,
                                tasks: cur.tasks.map((t) =>
                                  t.id === taskId
                                    ? { ...t, doneAt: t.doneAt ? null : new Date().toISOString() }
                                    : t,
                                ),
                              };
                            });
                            void calendarHubToggleTask(taskId);
                          }}
                          onCreateTask={async (parsed) => {
                            const created = await calendarHubAddTask({
                              title: parsed.title,
                              dueDate: parsed.dueDate,
                              dueTime: parsed.dueTime,
                              isDeadline: parsed.isDeadline,
                            });
                            if (created) {
                              setCalendarHubSnapshot((cur) =>
                                cur ? { ...cur, tasks: [...cur.tasks, created] } : cur,
                              );
                            }
                          }}
                          onDeleteTask={(taskId) => {
                            const found =
                              calendarHubSnapshot?.tasks.find((t) => t.id === taskId) ?? null;
                            lastDeletedCalendarTaskRef.current = found;
                            setCalendarHubSnapshot((cur) =>
                              cur
                                ? { ...cur, tasks: cur.tasks.filter((t) => t.id !== taskId) }
                                : cur,
                            );
                            void calendarHubDeleteTask(taskId);
                          }}
                          onRestoreLastDeleted={() => {
                            const saved = lastDeletedCalendarTaskRef.current;
                            if (!saved) return;
                            lastDeletedCalendarTaskRef.current = null;
                            setCalendarHubSnapshot((cur) =>
                              cur ? { ...cur, tasks: [...cur.tasks, saved] } : cur,
                            );
                            void calendarHubRestoreTask(saved);
                          }}
                          onMoveTaskDue={(taskId, dueDate) => {
                            setCalendarHubSnapshot((cur) =>
                              cur
                                ? {
                                    ...cur,
                                    tasks: cur.tasks.map((t) =>
                                      t.id === taskId ? { ...t, dueDate } : t,
                                    ),
                                  }
                                : cur,
                            );
                            void calendarHubMoveTaskDue(taskId, dueDate);
                          }}
                          onSetFocusTask={(taskId) => {
                            setCalendarHubSnapshot((cur) =>
                              cur ? { ...cur, focusTaskId: taskId } : cur,
                            );
                            void calendarHubSetFocusTask(taskId);
                          }}
                          onCreateReminder={async (parsed) => {
                            const created = await calendarHubAddReminder({
                              title: parsed.title,
                              kind: parsed.reminderKind,
                              at: parsed.at,
                              repeatRule: parsed.repeatRule,
                              prayerAnchor: parsed.prayerAnchor,
                              importance: parsed.importance,
                            });
                            if (created) {
                              setCalendarHubSnapshot((cur) =>
                                cur ? { ...cur, reminders: [...cur.reminders, created] } : cur,
                              );
                            }
                          }}
                          onCompleteReminder={(id) => {
                            setCalendarHubSnapshot((cur) =>
                              cur
                                ? {
                                    ...cur,
                                    reminders: cur.reminders.map((r) =>
                                      r.id === id ? { ...r, missed: false } : r,
                                    ),
                                  }
                                : cur,
                            );
                            void calendarHubCompleteReminder(id);
                          }}
                          onDismissMissed={() => {
                            setCalendarHubSnapshot((cur) =>
                              cur
                                ? {
                                    ...cur,
                                    reminders: cur.reminders.map((r) => ({ ...r, missed: false })),
                                  }
                                : cur,
                            );
                            void calendarHubDismissMissed();
                          }}
                          onToggleFocus={() => {
                            void pomodoroToggle().then((p) => {
                              if (p) setPomodoro(p);
                              void calendarHubFocusGetState().then((f) => f && setFocusFlow(f));
                            });
                          }}
                          onSkipFocus={() => {
                            void pomodoroSkip().then((p) => {
                              if (p) setPomodoro(p);
                              void calendarHubFocusGetState().then((f) => f && setFocusFlow(f));
                            });
                          }}
                          onRespondPrayerPrompt={(pause) => {
                            void calendarHubFocusRespondPrayer(pause).then(
                              (f) => f && setFocusFlow(f),
                            );
                          }}
                          onDismissFreeFocusLog={() => {
                            void calendarHubFocusDismissFreeLog().then((f) => f && setFocusFlow(f));
                          }}
                          onLogFreeFocusTask={async (title) => {
                            await calendarHubFocusLogFreeTask(title);
                            const { year, month } = calendarCursorRef.current;
                            const snap = await calendarHubGetSnapshot(year, month);
                            if (snap) setCalendarHubSnapshot(snap);
                            const f = await calendarHubFocusGetState();
                            if (f) setFocusFlow(f);
                          }}
                          onSyncNow={async () => {
                            setCalSyncing(true);
                            try {
                              await calendarHubSyncNow();
                              const { year, month } = calendarCursorRef.current;
                              const snap = await calendarHubGetSnapshot(year, month);
                              if (snap) setCalendarHubSnapshot(snap);
                            } finally {
                              setCalSyncing(false);
                            }
                          }}
                          onConnectIcs={async (label, url) => {
                            setCalSyncing(true);
                            try {
                              await calendarHubConnectIcs(label, url);
                              const { year, month } = calendarCursorRef.current;
                              const snap = await calendarHubGetSnapshot(year, month);
                              if (snap) setCalendarHubSnapshot(snap);
                            } finally {
                              setCalSyncing(false);
                            }
                          }}
                          onConnectOAuth={async (provider, clientId, writeScope) => {
                            setCalSyncing(true);
                            try {
                              await calendarHubConnectOAuth(provider, clientId, writeScope);
                              const { year, month } = calendarCursorRef.current;
                              const snap = await calendarHubGetSnapshot(year, month);
                              if (snap) setCalendarHubSnapshot(snap);
                            } finally {
                              setCalSyncing(false);
                            }
                          }}
                          onDisconnectSource={async (sourceId) => {
                            await calendarHubDisconnectSource(sourceId);
                            const { year, month } = calendarCursorRef.current;
                            const snap = await calendarHubGetSnapshot(year, month);
                            if (snap) setCalendarHubSnapshot(snap);
                          }}
                          onDeleteAllData={async () => {
                            await calendarHubDeleteAllData();
                            const { year, month } = calendarCursorRef.current;
                            const snap = await calendarHubGetSnapshot(year, month);
                            if (snap) setCalendarHubSnapshot(snap);
                          }}
                          onToggleWriteback={(enabled) => {
                            onUpdateCalendarSettings?.({ calendarWritebackTasks: enabled });
                          }}
                          onJoinMeeting={(url) => {
                            void calendarHubOpenExternalUrl(url);
                          }}
                          onOpenEventExternal={(ev) => {
                            void calendarHubOpenExternalUrl(
                              ev.meetingUrl ?? "https://calendar.google.com",
                            );
                          }}
                          onMonthChange={(year, month) => setCalendarMonthCursor({ year, month })}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="page-secondary"
                      custom={slideDirection}
                      variants={{
                        enter: (direction: number) => ({
                          x: prefersReducedMotion ? 0 : direction > 0 ? 72 : -72,
                          opacity: 0,
                          scale: prefersReducedMotion ? 1 : 0.985,
                        }),
                        center: {
                          x: 0,
                          opacity: 1,
                          scale: 1,
                          transition: getMotionTransition("pageSwitch", prefersReducedMotion),
                        },
                        exit: (direction: number) => ({
                          x: prefersReducedMotion ? 0 : direction > 0 ? -72 : 72,
                          opacity: 0,
                          scale: prefersReducedMotion ? 1 : 0.985,
                          transition: {
                            duration: prefersReducedMotion ? 0.08 : 0.16,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="absolute inset-0 flex items-start justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div
                        className="group relative flex flex-col justify-between"
                        style={{
                          width: `${Math.round(BASE_GEOMETRY.expanded.width * scaleFactor)}px`,
                          height: `${Math.round(BASE_GEOMETRY.expanded.height * scaleFactor)}px`,
                          padding: "var(--island-padding)",
                          paddingLeft: isFloatingPill ? "var(--island-padding)" : "14px",
                          paddingRight: isFloatingPill ? "var(--island-padding)" : "14px",
                          gap: "var(--island-gap)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <h1 className="type-title m-0 flex min-w-0 items-center gap-1 truncate text-[13px]">
                            <span className="truncate" style={{ color: "var(--text-primary)" }}>
                              {activePage.titleLead}
                            </span>
                            <span className="truncate" style={{ color: activePage.accentVar }}>
                              {activePage.titleAccent}
                            </span>
                          </h1>

                          <button
                            type="button"
                            onClick={() => setClockDateOverride(!showHeaderClock)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              onShapeChange?.(nextShape);
                            }}
                            className="type-header-clock min-w-0 shrink cursor-pointer truncate rounded-full border-0 bg-transparent px-1.5 py-0.5 text-[11px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                            style={{ color: "var(--text-title-accent)" }}
                            title={
                              isBn ? "তারিখ/সময় পরিবর্তন (রাইট-ক্লিকে শেপ)" : "Toggle date & time"
                            }
                          >
                            {showHeaderClock ? (
                              <>
                                {clock.dateText.replace(/,\s*\d{4}$/, "")}{" "}
                                <strong style={{ color: "var(--text-primary)" }}>
                                  {clock.timeText}
                                </strong>
                              </>
                            ) : (
                              <span>{clock.timeText}</span>
                            )}
                          </button>

                          <div className="flex items-center justify-self-end gap-1">
                            <div
                              className={`flex items-center gap-1 transition-opacity duration-150 ${
                                activePage.id === "control"
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                              }`}
                            >
                              <button
                                type="button"
                                aria-label={isPinned ? msg.pill.unpin : msg.pill.pin}
                                title={isPinned ? msg.pill.unpin : msg.pill.pin}
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
                                className={`type-caption flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${
                                  isPinned ? "" : "bg-transparent hover:bg-[var(--surface-button)]"
                                }`}
                                style={{
                                  backgroundColor: isPinned ? "var(--accent-orange)" : undefined,
                                  color: isPinned ? "#000000" : "var(--text-secondary)",
                                }}
                              >
                                <PinIcon size={13} />
                              </button>

                              <button
                                type="button"
                                aria-label={msg.pill.openSettings}
                                title={msg.pill.openSettings}
                                onClick={() => {
                                  if (onOpenSettings) {
                                    onOpenSettings();
                                  } else {
                                    void openSettingsWindow();
                                  }
                                }}
                                className="type-caption flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-all hover:bg-[var(--surface-button)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                                style={{
                                  color: "var(--text-secondary)",
                                }}
                              >
                                <SettingsIcon size={13} />
                              </button>
                            </div>

                            <button
                              type="button"
                              aria-label={msg.pill.collapse}
                              title={msg.pill.collapse}
                              onClick={() => {
                                clearHoverTimers();
                                editingLockRef.current = false;
                                isPinnedRef.current = false;
                                setIsPinned(false);
                                setSlimReturnActive(false);
                                setPageGalleryOpen(false);
                                dispatch({ type: "CLICK" });
                              }}
                              className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-all hover:bg-[var(--surface-button)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${
                                activePage.id === "control"
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                              }`}
                              style={{
                                color: "var(--text-secondary)",
                              }}
                            >
                              {liveTrack?.is_playing ? (
                                <LiveWaveform playing accentColor={mediaAccent} />
                              ) : (
                                <ChevronUpIcon size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="relative flex min-h-0 flex-1 items-center overflow-hidden">
                          <AnimatePresence custom={slideDirection} initial={false} mode="popLayout">
                            <motion.div
                              key={activePage.id}
                              custom={slideDirection}
                              variants={{
                                enter: (direction: number) => ({
                                  x: prefersReducedMotion ? 0 : direction > 0 ? 60 : -60,
                                  opacity: 0,
                                  scale: 0.98,
                                }),
                                center: {
                                  x: 0,
                                  opacity: 1,
                                  scale: 1,
                                },
                                exit: (direction: number) => ({
                                  x: prefersReducedMotion ? 0 : direction > 0 ? -60 : 60,
                                  opacity: 0,
                                  scale: 0.98,
                                }),
                              }}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              transition={getMotionTransition("pageSwitch", prefersReducedMotion)}
                              className="flex h-full w-full items-center"
                            >
                              {activePage.id === "control" && (
                                <ControlPanelWidget
                                  media={media}
                                  pomodoro={pomodoro}
                                  waterGoalMl={initialWaterGoalMl}
                                  cameraActive={privacyDevices[0]}
                                  micActive={privacyDevices[1]}
                                  language={language}
                                  onPomodoroChange={(nextPom) => setPomodoro(nextPom)}
                                  onNavigatePage={(targetId) => {
                                    const targetIndex = pages.findIndex((p) => p.id === targetId);
                                    if (targetIndex >= 0) {
                                      setPageGalleryOpen(false);
                                      setSlideDirection(targetIndex >= safePageIndex ? 1 : -1);
                                      setActivePageIndex(targetIndex);
                                    }
                                  }}
                                />
                              )}

                              {activePage.id === "water" && (
                                <div className="h-full w-full">
                                  <WaterWidget
                                    summary={waterSummary}
                                    servingMl={250}
                                    remindersEnabled={waterReminders}
                                    onDrink={(ml) => {
                                      triggerLumiEvent("water", {
                                        legacyMood: "celebrate",
                                        durationMs: 2200,
                                        playChirp: "lumi_happy",
                                      });
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
                                      void waterGetSummary(goal, 4).then(
                                        (w) => w && setWaterSummary(w),
                                      );
                                    }}
                                  />
                                </div>
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
                            </motion.div>
                          </AnimatePresence>

                          {pageGalleryOpen && (
                            <div
                              role="region"
                              aria-label={isBn ? "সব পেজ গ্যালারি" : "All Pages Gallery"}
                              className="absolute inset-0 z-30 grid grid-cols-4 gap-1.5 p-0.5"
                              style={{ backgroundColor: "var(--surface)" }}
                            >
                              {pages.map((page, index) => {
                                const active = index === safePageIndex;
                                return (
                                  <button
                                    key={page.id}
                                    type="button"
                                    onClick={() => {
                                      setSlideDirection(index >= safePageIndex ? 1 : -1);
                                      setActivePageIndex(index);
                                      setPageGalleryOpen(false);
                                    }}
                                    className="flex cursor-pointer items-center gap-1.5 overflow-hidden border-0 px-2.5 py-1.5 text-left transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                                    style={{
                                      backgroundColor: active
                                        ? "var(--surface-button)"
                                        : "var(--surface-raised)",
                                      borderRadius: "12px",
                                      border: active
                                        ? `1px solid ${page.accentVar}`
                                        : "1px solid var(--hairline)",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: page.accentVar }}
                                    />
                                    <span className="type-caption truncate font-medium">
                                      {page.titleLead}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div
                          onMouseEnter={() => setDockHovered(true)}
                          onMouseLeave={() => setDockHovered(false)}
                          className="relative flex min-h-[24px] items-center justify-center px-6"
                        >
                          {dockHovered ? (
                            <motion.div
                              key="shortcut-dock"
                              initial={{ opacity: 0, y: 4, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={
                                prefersReducedMotion
                                  ? { duration: 0.08 }
                                  : { type: "spring", stiffness: 480, damping: 30 }
                              }
                              role="navigation"
                              aria-label={isBn ? "কুইক পেজ শর্টকাট" : "Quick page shortcuts"}
                              className="flex items-center gap-1 rounded-full px-2.5 py-1 shadow-lg"
                              style={{
                                backgroundColor: "var(--surface-raised)",
                                border: "1px solid var(--hairline-top)",
                              }}
                            >
                              {pages.map((page, index) => {
                                const active = index === safePageIndex && !pageGalleryOpen;
                                const icon =
                                  page.id === "calendar_hub" ? (
                                    <CalendarIcon size={13} />
                                  ) : page.id === "control" ? (
                                    <GridIcon size={13} />
                                  ) : page.id === "water" ? (
                                    <DropletIcon size={13} />
                                  ) : page.id === "shelf" ? (
                                    <InboxIcon size={13} />
                                  ) : (
                                    <BoltIcon size={13} />
                                  );
                                return (
                                  <button
                                    key={page.id}
                                    type="button"
                                    aria-label={`${page.titleLead} ${page.titleAccent}`.trim()}
                                    title={`${page.titleLead} ${page.titleAccent}`.trim()}
                                    onClick={() => {
                                      setPageGalleryOpen(false);
                                      setSlideDirection(index >= safePageIndex ? 1 : -1);
                                      setActivePageIndex(index);
                                    }}
                                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                                    style={{
                                      backgroundColor: active
                                        ? "rgba(255,255,255,0.08)"
                                        : "transparent",
                                      color: active ? page.accentVar : "var(--text-secondary)",
                                    }}
                                  >
                                    {icon}
                                  </button>
                                );
                              })}
                              <span className="mx-0.5 h-3.5 w-px bg-white/15" aria-hidden="true" />
                              <button
                                type="button"
                                aria-label={msg.pill.openSettings}
                                title={msg.pill.openSettings}
                                onClick={() => {
                                  if (onOpenSettings) {
                                    onOpenSettings();
                                  } else {
                                    void openSettingsWindow();
                                  }
                                }}
                                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-transform hover:scale-110 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                <SettingsIcon size={13} />
                              </button>
                            </motion.div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              {(pages.length <= 6
                                ? pages.map((page, index) => ({ page, index }))
                                : (() => {
                                    const maxDots = 5;
                                    const start = Math.min(
                                      Math.max(0, safePageIndex - 2),
                                      Math.max(0, pages.length - maxDots),
                                    );
                                    return pages
                                      .slice(start, start + maxDots)
                                      .map((page, offset) => ({ page, index: start + offset }));
                                  })()
                              ).map(({ page, index }) => {
                                const active = index === safePageIndex && !pageGalleryOpen;
                                return (
                                  <button
                                    key={page.id}
                                    type="button"
                                    aria-label={`Page ${index + 1}`}
                                    onClick={() => {
                                      setSlideDirection(index >= safePageIndex ? 1 : -1);
                                      setPageGalleryOpen(false);
                                      setActivePageIndex(index);
                                    }}
                                    className="h-1.5 cursor-pointer rounded-full border-0 p-0 transition-[width,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                                    style={{
                                      width: active ? "18px" : "6px",
                                      backgroundColor: active
                                        ? activePage.accentVar
                                        : "var(--text-tertiary)",
                                    }}
                                  />
                                );
                              })}
                              {pages.length > 6 && (
                                <button
                                  type="button"
                                  aria-label={isBn ? "সব পেজ দেখুন" : "All pages"}
                                  title={isBn ? "সব পেজ দেখুন" : "All pages"}
                                  aria-expanded={pageGalleryOpen}
                                  onClick={() => setPageGalleryOpen((v) => !v)}
                                  className="flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded border-0 p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                                  style={{
                                    backgroundColor: "transparent",
                                    color: pageGalleryOpen
                                      ? "var(--text-primary)"
                                      : "var(--text-secondary)",
                                  }}
                                >
                                  <GridIcon size={10} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          {isExpanded &&
            activeLumiAction?.bubbleText &&
            mascotEnabled &&
            lumiSilenceDecision.allowBubbles && (
              <div
                role="status"
                aria-live="polite"
                data-testid="lumi-speech-bubble"
                className="pointer-events-none absolute right-3 bottom-2 z-40 max-w-[180px] truncate rounded-full px-2.5 py-0.5 text-[10.5px] font-medium"
                style={{
                  backgroundColor: "var(--surface-raised)",
                  border: "1px solid var(--hairline)",
                  color: "var(--text-primary)",
                }}
              >
                {activeLumiAction.bubbleText}
              </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}

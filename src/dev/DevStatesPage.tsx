import { useState } from "react";
import { CalendarHubPage, type CalendarHubPageProps } from "../calendar/CalendarHubPage";
import { BASE_GEOMETRY } from "../design/tokens";
import { HomePage, type HomePageProps } from "../home/HomePage";
import type {
  CalendarHubSnapshot,
  ClipboardHistoryItem,
  PrayerSchedule,
  ShelfItem,
  SystemTelemetrySnapshot,
} from "../lib/ipc";
import { SystemShelfPage, type SystemShelfPageProps } from "../systemShelf/SystemShelfPage";

function makeBaseSchedule(overrides: Partial<PrayerSchedule> = {}): PrayerSchedule {
  return {
    city_name: "Khulna",
    next_name_en: "Maghrib",
    next_name_bn: "মাগরিব",
    next_time_12h: "5:11 PM",
    next_is_tomorrow: false,
    next_diff_min: 30,
    countdown_text: "in 30 min",
    progress_pct: 66,
    sun_arc_ratio: 0.84,
    now_min: 16 * 60 + 41,
    is_friday: false,
    is_ramadan: false,
    is_night_mode: false,
    sehri_min: 5 * 60 + 2,
    iftar_min: 17 * 60 + 11,
    night_start_min: 18 * 60 + 35,
    night_end_min: 24 * 60 + 5 * 60 + 2,
    tomorrow_fajr_min: 5 * 60 + 2,
    hijri_date: "15 Jumada II 1448 AH",
    sehri_iftar_label: "",
    slots: [
      {
        id: "fajr",
        name_en: "Fajr",
        name_bn: "ফজর",
        time_12h: "5:02 AM",
        minute_of_day: 302,
        arc_ratio: 0,
        passed: true,
      },
      {
        id: "dhuhr",
        name_en: "Dhuhr",
        name_bn: "যোহর",
        time_12h: "11:48 AM",
        minute_of_day: 708,
        arc_ratio: 0.5,
        passed: true,
      },
      {
        id: "asr",
        name_en: "Asr",
        name_bn: "আসর",
        time_12h: "3:40 PM",
        minute_of_day: 940,
        arc_ratio: 0.78,
        passed: true,
      },
      {
        id: "maghrib",
        name_en: "Maghrib",
        name_bn: "মাগরিব",
        time_12h: "5:11 PM",
        minute_of_day: 1031,
        arc_ratio: 0.9,
        passed: false,
      },
      {
        id: "isha",
        name_en: "Isha",
        name_bn: "এশা",
        time_12h: "6:35 PM",
        minute_of_day: 1115,
        arc_ratio: 1,
        passed: false,
      },
    ],
    ...overrides,
  };
}

function makeBaseProps(): HomePageProps {
  const refNow = new Date(2026, 10, 26, 16, 41, 0);
  return {
    nowDate: refNow,
    schedule: makeBaseSchedule(),
    media: {
      active: {
        app_id: "Spotify.exe",
        title: "Evening drive",
        artist: "Artist name",
        album_title: "Dusk Sessions",
        is_playing: true,
        position_ms: 92_000,
        duration_ms: 260_000,
        album_art_data_url: null,
        accent_hex: "#d6336c",
      },
      sessions: [],
      volume_percent: 48,
      muted: false,
    },
    lastPlayedTrack: { title: "Evening drive", artist: "Artist name" },
    calendarEvents: [
      { id: 1, title: "Deep focus block", start_at: "14:30", created_at: "" },
      { id: 2, title: "Standup", start_at: "16:53", created_at: "" },
      { id: 3, title: "Client call", start_at: "18:30", created_at: "" },
    ],
    tasks: [
      { id: 1, title: "Review PR", done: false, due_at: null, created_at: "" },
      { id: 2, title: "Send invoice", done: false, due_at: null, created_at: "" },
      { id: 3, title: "Ship build", done: false, due_at: null, created_at: "" },
    ],
    water: {
      today_ml: 500,
      goal_ml: 1500,
      percentage: 33.3,
      goal_reached: false,
      last_entry_id: 1,
      weekly: [],
    },
    pomodoro: {
      phase: "focus",
      remaining_secs: 25 * 60,
      total_secs: 25 * 60,
      running: false,
      cycle_index: 0,
      cycles_before_long: 4,
      daily_focus_minutes: 50,
      chime_tick: 0,
    },
    weather: {
      tempC: 29,
      weatherCode: 61,
      condition: "rain",
      precipNote: "rain in 25 min",
      city: "Khulna",
      fetchedAt: "2026-11-26T16:30:00Z",
      offline: false,
    },
    weatherLoading: false,
    weatherError: null,
    locationNotSet: false,
    tasbih: { count: 33, target: 33 },
    ledger: {
      id: 1,
      client_name: "Client A",
      elapsed_secs: 5050,
      running: false,
      started_at: null,
      updated_at: "",
    },
    clipboard: {
      displayText: "OTP 482 •••",
      sensitive: true,
      rawHash: "abc",
      hasContent: true,
    },
    devPulse: {
      ports: [3000],
      primaryPort: 3000,
      up: true,
    },
    toggles: {
      focus: true,
      micMuted: false,
      cameraEnabled: true,
      silentMode: false,
    },
    batteryPct: 82,
    isCharging: false,
    language: "en",
    banglaDigits: false,
    reduceMotion: true,
    reduceTransparency: false,
    glowEnabled: true,
    parallaxEnabled: false,
    chipsConfig: {
      focus: true,
      ledger: true,
      clipboard: true,
      devPulse: true,
    },
    pagesCount: 3,
    activePageIndex: 0,
    isVisible: true,
    isFirstOpenOfDay: false,
    onNavigateWidget: () => {},
    onSelectPage: () => {},
    onOpenSettings: () => {},
    onLaunchScreenshot: () => {},
    onLaunchScreenRecord: () => {},
    onToggleFocus: () => {},
    onToggleMic: () => {},
    onToggleCamera: async () => true,
    onLockWorkstation: () => {},
    onToggleSilentMode: () => {},
    onIncrementTasbih: () => {},
    onResetTasbih: () => {},
    onMediaPlayPause: () => {},
    onMediaPrev: () => {},
    onMediaNext: () => {},
    onMediaMuteToggle: () => {},
    onMediaVolumeDelta: () => {},
    onLogWater: () => {},
    onToggleFocusTimer: () => {},
    onToggleLedger: () => {},
    onCopyClipboard: async () => {},
  };
}

interface StateSpec {
  id: string;
  label: string;
  scale?: number;
  className?: string;
  props: HomePageProps;
}

function buildAll20States(): StateSpec[] {
  const b = makeBaseProps();
  return [
    { id: "default", label: "1. Default (Reference match 100%)", props: { ...b } },
    { id: "hover", label: "2. Hover (Interactive controls)", props: { ...b } },
    {
      id: "pressed",
      label: "3. Pressed state",
      className: "ring-2 ring-white/25",
      props: { ...b },
    },
    { id: "focus-visible", label: "4. Focus-visible ring", props: { ...b } },
    {
      id: "first-open-of-day",
      label: "5. First open of day (Sun travel)",
      props: { ...b, isFirstOpenOfDay: true, reduceMotion: false },
    },
    {
      id: "night-arc",
      label: "6. Night arc (Isha -> next Fajr moon)",
      props: {
        ...b,
        nowDate: new Date(2026, 10, 26, 22, 15, 0),
        schedule: makeBaseSchedule({
          is_night_mode: true,
          next_name_en: "Fajr",
          next_name_bn: "ফজর",
          next_time_12h: "5:02 AM",
          next_diff_min: 407,
          countdown_text: "in 6 h 47 min",
          now_min: 22 * 60 + 15,
        }),
        overrideNightMode: true,
        overrideNowMin: 22 * 60 + 15,
      },
    },
    {
      id: "friday-jumuah",
      label: "7. Friday / Jumu'ah",
      props: {
        ...b,
        nowDate: new Date(2026, 10, 27, 10, 40, 0),
        schedule: makeBaseSchedule({
          is_friday: true,
          next_name_en: "Jumu'ah",
          next_name_bn: "জুমা",
          next_time_12h: "11:48 AM",
          next_diff_min: 68,
          countdown_text: "in 1 h 8 min",
          now_min: 10 * 60 + 40,
        }),
        overrideFriday: true,
        overrideNowMin: 10 * 60 + 40,
      },
    },
    {
      id: "ramadan",
      label: "8. Ramadan (Sehri + Iftar)",
      props: {
        ...b,
        schedule: makeBaseSchedule({
          is_ramadan: true,
          sehri_iftar_label: "Iftar in 30 min",
        }),
        overrideRamadan: true,
      },
    },
    {
      id: "no-music",
      label: "9. No music (Nothing playing + Open Spotify)",
      props: {
        ...b,
        media: { active: null, sessions: [], volume_percent: 48, muted: false },
      },
    },
    {
      id: "no-calendar-tasks",
      label: "10. No calendar / tasks",
      props: { ...b, calendarEvents: [], tasks: [] },
    },
    {
      id: "location-not-set",
      label: "11. Location not set (manual city works)",
      props: {
        ...b,
        locationNotSet: true,
        weather: {
          tempC: 28,
          weatherCode: 0,
          condition: "clear",
          precipNote: null,
          city: "Dhaka",
          fetchedAt: "2026-11-26T16:30:00Z",
          offline: false,
        },
        schedule: makeBaseSchedule({ city_name: "Dhaka" }),
      },
    },
    {
      id: "loading-skeleton",
      label: "12. Loading skeleton (shimmer)",
      props: { ...b, weatherLoading: true, weather: null },
    },
    {
      id: "offline-weather",
      label: "13. Offline weather",
      props: {
        ...b,
        weather: {
          tempC: 27,
          weatherCode: 2,
          condition: "cloudy",
          precipNote: null,
          city: "Khulna",
          fetchedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
          offline: true,
        },
      },
    },
    {
      id: "error",
      label: "14. Error (weather / radio)",
      props: { ...b, weatherError: "Weather retry failed" },
    },
    {
      id: "privacy-masked",
      label: "15. Privacy-masked (OTP + Focus)",
      props: {
        ...b,
        clipboard: {
          displayText: "OTP 482 •••",
          sensitive: true,
          rawHash: "secret",
          hasContent: true,
        },
      },
    },
    {
      id: "focus-session",
      label: "16. Focus session (dimmed 30% + indigo)",
      props: {
        ...b,
        toggles: { ...b.toggles, focus: true },
        pomodoro: { ...b.pomodoro, running: true, phase: "focus" },
      },
    },
    {
      id: "reduce-motion",
      label: "17. Reduce motion (120ms fades)",
      props: { ...b, reduceMotion: true },
    },
    {
      id: "reduce-transparency",
      label: "18. Reduce transparency (solid glass fallback)",
      props: { ...b, reduceTransparency: true },
    },
    {
      id: "scale-150",
      label: "19. 150% scale (960x468)",
      scale: 1.5,
      props: { ...b },
    },
    {
      id: "bangla-locale",
      label: "20. Bangla locale + Bangla digits",
      props: {
        ...b,
        language: "bn",
        banglaDigits: true,
      },
    },
  ];
}

interface CalendarHubStateEntry {
  id: string;
  label: string;
  scale?: number;
  dir?: "ltr" | "rtl";
  props: CalendarHubPageProps;
}

function buildCalendarHubPhase1States(): CalendarHubStateEntry[] {
  const refNow = new Date(2026, 10, 26, 16, 0, 0);
  const baseSnapshot: CalendarHubSnapshot = {
    year: 2026,
    month: 11,
    dayMarks: [
      { dateKey: "2026-11-02", taskCount: 1, eventCount: 0, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-03", taskCount: 0, eventCount: 1, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-05", taskCount: 0, eventCount: 0, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-09", taskCount: 1, eventCount: 1, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-10", taskCount: 0, eventCount: 0, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-12", taskCount: 1, eventCount: 0, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-14", taskCount: 0, eventCount: 1, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-16", taskCount: 0, eventCount: 1, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-17", taskCount: 1, eventCount: 0, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-19", taskCount: 0, eventCount: 0, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-23", taskCount: 1, eventCount: 1, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-26", taskCount: 1, eventCount: 1, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-27", taskCount: 0, eventCount: 1, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-28", taskCount: 2, eventCount: 0, reminderCount: 0, deadlineCount: 1 },
      { dateKey: "2026-11-29", taskCount: 2, eventCount: 1, reminderCount: 1, deadlineCount: 1 },
      { dateKey: "2026-11-30", taskCount: 1, eventCount: 0, reminderCount: 0, deadlineCount: 0 },
    ],
    tasks: [
      {
        id: 1,
        title: "Invoice",
        dueDate: "2026-11-26",
        dueTime: "9:00",
        estimateMin: 15,
        doneAt: "2026-11-26T09:05:00Z",
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
      {
        id: 2,
        title: "Design review",
        dueDate: "2026-11-26",
        dueTime: "2:30",
        estimateMin: 25,
        doneAt: null,
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
      {
        id: 3,
        title: "Reply mail",
        dueDate: "2026-11-26",
        dueTime: null,
        estimateMin: 15,
        doneAt: null,
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
      {
        id: 4,
        title: "Review PRs",
        dueDate: "2026-11-26",
        dueTime: null,
        estimateMin: 25,
        doneAt: null,
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
    ],
    events: [
      {
        id: 1,
        sourceId: "google-1",
        title: "Team standup",
        start: "2026-11-26T16:12:00",
        end: "2026-11-26T16:42:00",
        allDay: false,
        color: "#30d158",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        location: "Google Meet",
        readOnly: true,
      },
      {
        id: 2,
        sourceId: "google-1",
        title: "Client call",
        start: "2026-11-26T18:30:00",
        end: "2026-11-26T19:00:00",
        allDay: false,
        color: "#7a78ff",
        meetingUrl: null,
        location: null,
        readOnly: true,
      },
      {
        id: 3,
        sourceId: "google-1",
        title: "Sprint review",
        start: "2026-11-27T10:00:00",
        end: "2026-11-27T11:00:00",
        allDay: false,
        color: "#30d158",
        meetingUrl: null,
        location: null,
        readOnly: true,
      },
    ],
    reminders: [
      {
        id: 1,
        title: "Call supplier",
        kind: "once",
        at: "2026-11-26T17:00:00",
        repeatRule: "5:00 PM · once",
        prayerAnchor: null,
        snoozeCount: 0,
        active: true,
        importance: "normal",
        missed: false,
        createdAt: "",
      },
      {
        id: 2,
        title: "Read 10 pages",
        kind: "daily",
        at: "2026-11-26T21:00:00",
        repeatRule: "Daily · 9:00 PM",
        prayerAnchor: null,
        snoozeCount: 0,
        active: true,
        importance: "normal",
        missed: false,
        createdAt: "",
      },
      {
        id: 3,
        title: "Review notes",
        kind: "prayer",
        at: "2026-11-26T17:01:00",
        repeatRule: null,
        prayerAnchor: { prayer: "Maghrib", offsetMin: 10, relation: "before" },
        snoozeCount: 0,
        active: true,
        importance: "normal",
        missed: false,
        createdAt: "",
      },
    ],
    sources: [
      {
        id: "google-1",
        provider: "google",
        accountLabel: "Google",
        icsUrl: null,
        lastSyncedAt: "2026-11-26T15:58:00Z",
        lastError: null,
        connected: true,
      },
    ],
    recentFocusSessions: [],
  };

  const baseProps: CalendarHubPageProps = {
    snapshot: baseSnapshot,
    nowDate: refNow,
    pomodoro: {
      phase: "focus",
      remaining_secs: 25 * 60,
      total_secs: 25 * 60,
      running: false,
      cycle_index: 0,
      cycles_before_long: 4,
      daily_focus_minutes: 50,
      chime_tick: 0,
    },
    firstDayOfWeek: 0,
    colorBlindMarks: false,
    socialBlockedArmed: true,
    language: "en",
    banglaDigits: false,
    reduceMotion: true,
    reduceTransparency: false,
    glowEnabled: true,
    onOpenSettings: () => {},
    onToggleTask: () => {},
    onToggleFocus: () => {},
  };

  return [
    { id: "default", label: "Calendar Hub · Default (640×312)", props: baseProps },
    {
      id: "color-blind",
      label: "Color-blind friendly marks",
      props: { ...baseProps, colorBlindMarks: true },
    },
    {
      id: "local-empty",
      label: "Local calendar · Empty cards",
      props: {
        ...baseProps,
        syncStatusOverride: "local",
        snapshot: {
          ...baseSnapshot,
          dayMarks: [],
          tasks: [],
          events: [],
          reminders: [],
          sources: [
            {
              id: "local",
              provider: "local",
              accountLabel: "Local calendar",
              icsUrl: null,
              lastSyncedAt: null,
              lastError: null,
              connected: true,
            },
          ],
        },
      },
    },
    {
      id: "overdue-missed",
      label: "Overdue task · Missed reminder · Sync error",
      props: {
        ...baseProps,
        syncStatusOverride: "error",
        snapshot: {
          ...baseSnapshot,
          tasks: [
            {
              ...baseSnapshot.tasks[1],
              dueDate: "2026-11-24",
              dueTime: "Nov 24",
              isDeadline: true,
            },
            ...baseSnapshot.tasks.slice(2),
          ],
          reminders: [
            { ...baseSnapshot.reminders[0], missed: true },
            ...baseSnapshot.reminders.slice(1),
          ],
        },
      },
    },
    {
      id: "syncing",
      label: "Syncing shimmer chip",
      props: { ...baseProps, syncStatusOverride: "syncing" },
    },
    {
      id: "offline-cache",
      label: "Offline cache timestamp",
      props: { ...baseProps, syncStatusOverride: "offline" },
    },
    {
      id: "loading",
      label: "Loading skeleton (no spinner)",
      props: { ...baseProps, loading: true },
    },
    {
      id: "reduce-transparency",
      label: "Reduce transparency solid cards",
      props: { ...baseProps, reduceTransparency: true },
    },
    {
      id: "scale-150",
      label: "150% DPI Scale (960×468)",
      scale: 1.5,
      props: baseProps,
    },
    {
      id: "bangla-locale",
      label: "Bangla locale · Saturday first · Bangla digits",
      props: {
        ...baseProps,
        language: "bn",
        banglaDigits: true,
        firstDayOfWeek: 6,
      },
    },
    {
      id: "week-view",
      label: "Week View · 7-column strip morph",
      props: { ...baseProps, viewModeOverride: "week" },
    },
    {
      id: "day-filtered",
      label: "Selected day filter + Back to today",
      props: { ...baseProps, selectedDateKeyOverride: "2026-11-27" },
    },
    {
      id: "event-sheet",
      label: "Event detail sheet + Join",
      props: { ...baseProps, initialSelectedEvent: baseSnapshot.events[0] },
    },
    {
      id: "missed-list",
      label: "Missed reminders drawer",
      props: {
        ...baseProps,
        initialShowMissed: true,
        snapshot: {
          ...baseSnapshot,
          reminders: [
            { ...baseSnapshot.reminders[0], missed: true },
            { ...baseSnapshot.reminders[1], missed: true },
            baseSnapshot.reminders[2],
          ],
        },
      },
    },
    {
      id: "drag-over-day",
      label: "Drag-over day amber highlight",
      props: { ...baseProps, dragOverDateKeyOverride: "2026-11-28" },
    },
    {
      id: "drag-over-focus",
      label: "Drag-over Focus amber highlight",
      props: { ...baseProps, dragOverFocusOverride: true },
    },
    {
      id: "sync-sheet",
      label: "Calendar Sync sheet (ICS / Google PKCE / Outlook delta / Delete all)",
      props: { ...baseProps, initialShowSyncSheet: true },
    },
    {
      id: "disconnected",
      label: "Disconnected / Connect calendar CTA",
      props: { ...baseProps, syncStatusOverride: "disconnected" },
    },
    {
      id: "focus-running",
      label: "Focus running · Body-double Lumi + Skip",
      props: {
        ...baseProps,
        pomodoro: { ...baseProps.pomodoro, running: true, remaining_secs: 1120 },
        focusFlow: {
          config: {
            focusMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            rounds: 4,
            socialBlockedArmed: true,
            syncDnd: true,
            syncTimeLedger: true,
            prayerArrivalMode: "ask",
          },
          boundTaskId: 2,
          boundTaskTitle: "Design review",
          pausedForPrayer: null,
          prayerPrompt: null,
          freeFocusLogPrompt: null,
          lumiCompanionMode: "body_double_focus",
          socialBlockActive: true,
          dndActive: true,
          timeLedgerActive: true,
        },
      },
    },
    {
      id: "focus-prayer-ask",
      label: "Focus prayer arrival prompt (Ask default)",
      props: {
        ...baseProps,
        pomodoro: { ...baseProps.pomodoro, running: true, remaining_secs: 900 },
        focusFlow: {
          config: {
            focusMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            rounds: 4,
            socialBlockedArmed: true,
            syncDnd: true,
            syncTimeLedger: true,
            prayerArrivalMode: "ask",
          },
          boundTaskId: 2,
          boundTaskTitle: "Design review",
          pausedForPrayer: null,
          prayerPrompt: { prayerKey: "2026-11-26:Maghrib", prayerName: "Maghrib" },
          freeFocusLogPrompt: null,
          lumiCompanionMode: "body_double_focus",
          socialBlockActive: true,
          dndActive: true,
          timeLedgerActive: true,
        },
      },
    },
    {
      id: "focus-free-done",
      label: "Free focus complete · Log this as a task?",
      props: {
        ...baseProps,
        focusFlow: {
          config: {
            focusMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            rounds: 4,
            socialBlockedArmed: true,
            syncDnd: true,
            syncTimeLedger: true,
            prayerArrivalMode: "ask",
          },
          boundTaskId: null,
          boundTaskTitle: null,
          pausedForPrayer: null,
          prayerPrompt: null,
          freeFocusLogPrompt: {
            durationMin: 25,
            completedAt: "2026-11-26T16:30:00Z",
            suggestedTitle: "Focus session (25m)",
          },
          lumiCompanionMode: "celebrate_focus",
          socialBlockActive: false,
          dndActive: false,
          timeLedgerActive: false,
        },
      },
    },
    {
      id: "rtl-preview",
      label: "RTL mirroring safe shell preview",
      dir: "rtl",
      props: baseProps,
    },
  ];
}

function buildSystemShelfStates(): Array<{
  id: string;
  label: string;
  dir?: "rtl" | "ltr";
  scale?: number;
  props: SystemShelfPageProps;
}> {
  const sampleShelf: ShelfItem[] = [
    {
      id: 1,
      kind: "file",
      path_or_text: "C:/Users/Lumen/Documents/Q4-Architecture-Spec.pdf",
      display_name: "Q4-Architecture-Spec.pdf",
      available: true,
      added_at: "2026-11-28T10:15:00Z",
    },
    {
      id: 2,
      kind: "link",
      path_or_text: "https://github.com/lumen-island/lumen/pulls",
      display_name: "github.com/lumen-island/pulls",
      available: true,
      added_at: "2026-11-28T09:50:00Z",
    },
    {
      id: 3,
      kind: "file",
      path_or_text: "D:/Exports/Demo-Missing-Clip.mp4",
      display_name: "Demo-Missing-Clip.mp4",
      available: false,
      added_at: "2026-11-28T08:30:00Z",
    },
  ];

  const sampleTelemetry: SystemTelemetrySnapshot = {
    cpuPercent: 34.2,
    cpuCores: 16,
    ramPercent: 58,
    ramUsedGb: 18.4,
    ramTotalGb: 32,
    gpuPercent: 28.5,
    gpuName: "NVIDIA GeForce RTX 4070",
    vramUsedGb: 3.4,
    vramTotalGb: 8,
    netDownBps: 14_800_000,
    netUpBps: 2_350_000,
    netSessionRxBytes: 2_480_000_000,
    netSessionTxBytes: 420_000_000,
    netOnline: true,
    netInterfaceName: "Wi-Fi 6",
  };

  const sampleClipboard: ClipboardHistoryItem[] = [
    {
      id: 101,
      kind: "code",
      preview: "cargo test --manifest-path src-tauri/Cargo.toml --workspace",
      rawHash: "hash-101",
      sensitive: false,
      pinned: true,
      copiedAt: "2026-11-28T10:20:00Z",
    },
    {
      id: 102,
      kind: "link",
      preview: "https://tauri.app/develop/calling-rust/",
      rawHash: "hash-102",
      sensitive: false,
      pinned: false,
      copiedAt: "2026-11-28T10:12:00Z",
    },
    {
      id: 103,
      kind: "color",
      preview: "#32ade6",
      rawHash: "hash-103",
      sensitive: false,
      pinned: false,
      copiedAt: "2026-11-28T09:58:00Z",
    },
  ];

  const baseProps: SystemShelfPageProps = {
    nowDate: new Date(2026, 10, 28, 10, 25),
    shelfItems: sampleShelf,
    telemetry: sampleTelemetry,
    telemetryLoading: false,
    cpuHistory: [22, 26, 25, 31, 38, 35, 29, 34.2],
    gpuHistory: [12, 16, 18, 24, 30, 27, 25, 28.5],
    netDownHistory: [4_000_000, 7_200_000, 11_000_000, 9_500_000, 14_800_000],
    clipboardItems: sampleClipboard,
    dragOverShelf: false,
    isPinned: false,
    language: "en",
    banglaDigits: false,
    reduceMotion: false,
    reduceTransparency: false,
    glowEnabled: true,
    onTogglePin: () => {},
    onOpenSettings: () => {},
    onShelfAdd: () => {},
    onShelfPickFiles: () => {},
    onShelfOpen: () => {},
    onShelfCopy: () => {},
    onShelfRemove: () => {},
    onShelfClear: () => {},
    onCopyClip: () => {},
    onToggleClipPin: () => {},
    onDeleteClip: () => {},
    onClearClipboard: () => {},
  };

  return [
    {
      id: "default",
      label: "1. System & Shelf — Default (640x312 @ 100%)",
      props: baseProps,
    },
    {
      id: "empty",
      label: "2. Empty Shelf & Empty Clipboard",
      props: {
        ...baseProps,
        shelfItems: [],
        clipboardItems: [],
      },
    },
    {
      id: "high-load",
      label: "3. High CPU & GPU Load (Amber Alert Glow)",
      props: {
        ...baseProps,
        isPinned: true,
        telemetry: {
          ...sampleTelemetry,
          cpuPercent: 93.4,
          ramPercent: 93,
          ramUsedGb: 29.8,
          gpuPercent: 96.1,
          vramUsedGb: 7.7,
          netDownBps: 84_500_000,
          netUpBps: 19_200_000,
        },
        cpuHistory: [55, 68, 79, 86, 91, 93.4],
        gpuHistory: [48, 70, 84, 92, 95, 96.1],
      },
    },
    {
      id: "secret-clipboard",
      label: "4. Secret Clipboard Entry Masked (30s Wipe) + Drag Over",
      props: {
        ...baseProps,
        dragOverShelf: true,
        clipboardItems: [
          {
            id: 201,
            kind: "secret",
            preview: "sk-proj-••••9f4a",
            rawHash: "hash-201",
            sensitive: true,
            pinned: false,
            copiedAt: "2026-11-28T10:24:45Z",
          },
          ...sampleClipboard,
        ],
      },
    },
    {
      id: "offline",
      label: "5. Offline Network + Telemetry Unavailable GPU",
      props: {
        ...baseProps,
        gpuHistory: [],
        netDownHistory: [],
        telemetry: {
          ...sampleTelemetry,
          gpuPercent: null,
          gpuName: null,
          vramUsedGb: null,
          vramTotalGb: null,
          netDownBps: 0,
          netUpBps: 0,
          netOnline: false,
          netInterfaceName: null,
        },
      },
    },
    {
      id: "reduce-transparency",
      label: "6. Reduce Transparency + Reduce Motion",
      props: {
        ...baseProps,
        reduceMotion: true,
        reduceTransparency: true,
        glowEnabled: false,
      },
    },
    {
      id: "bangla-locale",
      label: "7. Bangla UI & Bangla Numerals",
      props: {
        ...baseProps,
        language: "bn",
        banglaDigits: true,
      },
    },
    {
      id: "scale-150",
      label: "8. High-DPI Notch Scale 150% (960x468)",
      scale: 1.5,
      props: baseProps,
    },
  ];
}

export function DevStatesPage() {
  const [galleryTab, setGalleryTab] = useState<"home" | "calendar_hub" | "system_shelf">(
    "system_shelf",
  );
  const homeStates = buildAll20States();
  const calendarHubStates = buildCalendarHubPhase1States();
  const systemShelfStates = buildSystemShelfStates();
  const [selectedId, setSelectedId] = useState<string>("all");
  const visibleHome =
    selectedId === "all" ? homeStates : homeStates.filter((s) => s.id === selectedId);
  const visibleCalendarHub =
    selectedId === "all" ? calendarHubStates : calendarHubStates.filter((s) => s.id === selectedId);
  const visibleSystemShelf =
    selectedId === "all" ? systemShelfStates : systemShelfStates.filter((s) => s.id === selectedId);

  return (
    <div
      data-testid="dev-states-page"
      className="min-h-screen w-full overflow-y-auto bg-[#0b0c10] p-6 text-white"
      style={{ overflowY: "auto", userSelect: "text" }}
    >
      <div className="mx-auto max-w-[1260px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Lumen UI States Gallery</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="dev-tab-system-shelf"
                onClick={() => {
                  setGalleryTab("system_shelf");
                  setSelectedId("all");
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  galleryTab === "system_shelf"
                    ? "bg-[#32ade6] text-black"
                    : "bg-white/10 text-white/75"
                }`}
              >
                System &amp; Shelf (8 States)
              </button>
              <button
                type="button"
                onClick={() => {
                  setGalleryTab("calendar_hub");
                  setSelectedId("all");
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  galleryTab === "calendar_hub"
                    ? "bg-[#5e5ce6] text-white"
                    : "bg-white/10 text-white/75"
                }`}
              >
                Calendar Hub (All States)
              </button>
              <button
                type="button"
                onClick={() => {
                  setGalleryTab("home");
                  setSelectedId("all");
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  galleryTab === "home" ? "bg-[#0a84ff] text-white" : "bg-white/10 text-white/75"
                }`}
              >
                Home (20 States)
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedId("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                selectedId === "all" ? "bg-[#0a84ff] text-white" : "bg-white/10 text-white/75"
              }`}
            >
              All
            </button>
            {(galleryTab === "system_shelf"
              ? systemShelfStates
              : galleryTab === "calendar_hub"
                ? calendarHubStates
                : homeStates
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedId(st.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  selectedId === st.id ? "bg-[#0a84ff] text-white" : "bg-white/10 text-white/75"
                }`}
              >
                {st.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-10">
          {galleryTab === "system_shelf"
            ? visibleSystemShelf.map((st) => {
                const scale = st.scale ?? 1;
                const w = Math.round(BASE_GEOMETRY.systemShelfExpanded.width * scale);
                const h = Math.round(BASE_GEOMETRY.systemShelfExpanded.height * scale);
                return (
                  <section
                    key={st.id}
                    data-testid={`dev-sys-shelf-state-${st.id}`}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs text-white/75">
                      <span className="font-semibold">{st.label}</span>
                      <span className="tabular-nums text-white/50">
                        {w}×{h} px
                      </span>
                    </div>
                    <div
                      dir={st.dir}
                      className="relative overflow-hidden bg-black"
                      style={{
                        width: `${w}px`,
                        height: `${h}px`,
                        borderRadius: `0px 0px ${Math.round(BASE_GEOMETRY.systemShelfBottomRadius * scale)}px ${Math.round(BASE_GEOMETRY.systemShelfBottomRadius * scale)}px`,
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderTop: "0px",
                      }}
                    >
                      <div
                        className="origin-top-left"
                        style={{
                          width: `${BASE_GEOMETRY.systemShelfExpanded.width}px`,
                          height: `${BASE_GEOMETRY.systemShelfExpanded.height}px`,
                          transform: scale !== 1 ? `scale(${scale})` : undefined,
                        }}
                      >
                        <SystemShelfPage {...st.props} />
                      </div>
                    </div>
                  </section>
                );
              })
            : galleryTab === "calendar_hub"
              ? visibleCalendarHub.map((st) => {
                  const scale = st.scale ?? 1;
                  const w = Math.round(BASE_GEOMETRY.calendarHubExpanded.width * scale);
                  const h = Math.round(BASE_GEOMETRY.calendarHubExpanded.height * scale);
                  return (
                    <section
                      key={st.id}
                      data-testid={`dev-cal-hub-state-${st.id}`}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between text-xs text-white/75">
                        <span className="font-semibold">{st.label}</span>
                        <span className="tabular-nums text-white/50">
                          {w}×{h} px
                        </span>
                      </div>
                      <div
                        dir={st.dir}
                        className="relative overflow-hidden bg-black"
                        style={{
                          width: `${w}px`,
                          height: `${h}px`,
                          borderRadius: `0px 0px ${Math.round(BASE_GEOMETRY.calendarHubBottomRadius * scale)}px ${Math.round(BASE_GEOMETRY.calendarHubBottomRadius * scale)}px`,
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderTop: "0px",
                        }}
                      >
                        <div
                          className="origin-top-left"
                          style={{
                            width: `${BASE_GEOMETRY.calendarHubExpanded.width}px`,
                            height: `${BASE_GEOMETRY.calendarHubExpanded.height}px`,
                            transform: scale !== 1 ? `scale(${scale})` : undefined,
                          }}
                        >
                          <CalendarHubPage {...st.props} />
                        </div>
                      </div>
                    </section>
                  );
                })
              : visibleHome.map((st) => {
                  const scale = st.scale ?? 1;
                  const w = Math.round(BASE_GEOMETRY.homeExpanded.width * scale);
                  const h = Math.round(BASE_GEOMETRY.homeExpanded.height * scale);

                  return (
                    <section
                      key={st.id}
                      data-testid={`dev-state-${st.id}`}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between text-xs text-white/75">
                        <span className="font-semibold">{st.label}</span>
                        <span className="tabular-nums text-white/50">
                          {w}×{h} px
                        </span>
                      </div>
                      <div
                        className={`relative overflow-hidden bg-black ${st.className ?? ""}`}
                        style={{
                          width: `${w}px`,
                          height: `${h}px`,
                          borderRadius: `0px 0px ${Math.round(BASE_GEOMETRY.homeBottomRadius * scale)}px ${Math.round(BASE_GEOMETRY.homeBottomRadius * scale)}px`,
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderTop: "0px",
                        }}
                      >
                        <div
                          className="origin-top-left"
                          style={{
                            width: `${BASE_GEOMETRY.homeExpanded.width}px`,
                            height: `${BASE_GEOMETRY.homeExpanded.height}px`,
                            transform: scale !== 1 ? `scale(${scale})` : undefined,
                          }}
                        >
                          <HomePage {...st.props} />
                        </div>
                      </div>
                    </section>
                  );
                })}
        </div>
      </div>
    </div>
  );
}

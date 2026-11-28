import { useState } from "react";
import { BASE_GEOMETRY } from "../design/tokens";
import { HomePage, type HomePageProps } from "../home/HomePage";
import type { PrayerSchedule, WaqtTimelineState } from "../lib/ipc";
import { DEFAULT_WAQT_RHYTHM_ANCHORS } from "../settings";
import { WaqtTimeline, type WaqtTimelineProps } from "../waqt/WaqtTimeline";

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

interface WaqtStateSpec {
  id: string;
  label: string;
  props: WaqtTimelineProps;
}

function makeBaseWaqtProps(): WaqtTimelineProps {
  const noop = () => {};
  return {
    waqtState: null,
    loading: false,
    error: null,
    nowDate: new Date(2026, 10, 26, 13, 30, 0),
    schedule: makeBaseSchedule({
      next_name_en: "Asr",
      next_name_bn: "আসর",
      next_time_12h: "3:40 PM",
      now_min: 13 * 60 + 30,
    }),
    tasks: [],
    calendarEvents: [],
    pomodoro: {
      phase: "focus",
      remaining_secs: 25 * 60,
      total_secs: 25 * 60,
      running: false,
      cycle_index: 0,
      cycles_before_long: 4,
      daily_focus_minutes: 0,
      chime_tick: 0,
    },
    waterTodayMl: 500,
    waterGoalMl: 1500,
    language: "en",
    banglaDigits: false,
    reduceMotion: true,
    reduceTransparency: false,
    isVisible: true,
    locationConfigured: true,
    bedtimeHHMM: "23:30",
    prayerPauseMode: "ask",
    ramadanTaraweeh: false,
    hintDismissed: false,
    quietMode: false,
    firstRunDismissed: true,
    rhythmAnchors: DEFAULT_WAQT_RHYTHM_ANCHORS,
    customBlockNames: {},
    pagesCount: 9,
    activePageIndex: 1,
    onSelectPage: noop,
    onOpenSettings: noop,
    onRetry: noop,
    onAssignTask: noop,
    onToggleTask: noop,
    onAddTask: noop,
    onDeleteTask: noop,
    onRestoreTask: noop,
    onChangeEstimate: noop,
    onMoveOverflow: noop,
    onRenameBlock: noop,
    onRolloverYesterday: noop,
    onStartFocusFlow: noop,
    onToggleFocusPause: noop,
    onResetFocus: noop,
    onDismissHint: noop,
    onLogActivity: noop,
  };
}

function buildWaqt18States(): WaqtStateSpec[] {
  const b = makeBaseWaqtProps();
  const t = (
    id: number,
    title: string,
    estimate_min: number,
    block_id: string | null,
    done = false,
  ) => ({
    id,
    title,
    done,
    due_at: null,
    created_at: "2026-11-26T08:00:00Z",
    estimate_min,
    block_id,
    kind: "task",
  });
  const baseOverride = (over: Partial<WaqtTimelineState>): WaqtTimelineState => ({
    date_label: "Thu 26 Nov",
    now_min: 13 * 60 + 30,
    rail_start_min: 302,
    rail_end_min: 23 * 60 + 30,
    sun_progress_pct: 48,
    is_friday: false,
    is_ramadan: false,
    is_after_isha: false,
    all_tasks_done: false,
    sehri_min: 302,
    iftar_min: 1031,
    location_configured: true,
    active_block_id: "dhuhr",
    next_prayer_name: "Asr",
    next_prayer_in_min: 130,
    current_focus_task_id: null,
    focus_next_task_id: null,
    focus_next_task_title: null,
    yesterday_rollover_count: 0,
    total_focus_min: 0,
    total_planned_min: 0,
    total_free_min: 480,
    day_is_overbooked: false,
    prayers_done_count: 2,
    water_today_ml: 500,
    water_goal_ml: 1500,
    focus_bars: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
    blocks: [],
    unplanned: [],
    tomorrow_blocks: [],
    tomorrow_tasks: [],
    plan_my_day_preview: [],
    activity_log: [],
    ...over,
  });

  return [
    { id: "S0", label: "S0 · Fresh / Empty day (0 tasks, 0 events)", props: { ...b } },
    {
      id: "S1",
      label: "S1 · Calendar only (green events + gap prompt)",
      props: {
        ...b,
        calendarEvents: [{ id: 1, title: "Design sync", start_at: "14:00", created_at: "" }],
      },
    },
    {
      id: "S2",
      label: "S2 · One task (bound Focus + encouraging Lumi)",
      props: { ...b, tasks: [t(1, "Draft proposal", 45, "dhuhr")] },
    },
    {
      id: "S3",
      label: "S3 · Two tasks (segmented capacity + then: next)",
      props: {
        ...b,
        tasks: [t(1, "Draft proposal", 40, "dhuhr"), t(2, "Review PR", 30, "dhuhr")],
      },
    },
    {
      id: "S4",
      label: "S4 · Three tasks in Midday",
      props: {
        ...b,
        tasks: [
          t(1, "Design review", 30, "dhuhr"),
          t(2, "Reply mail", 15, "dhuhr"),
          t(3, "Spec check", 20, "dhuhr"),
        ],
      },
    },
    {
      id: "S5",
      label: "S5 · 4+ tasks in Midday (+N expandable sheet)",
      props: {
        ...b,
        tasks: [
          t(1, "Design review", 25, "dhuhr"),
          t(2, "Reply mail", 15, "dhuhr"),
          t(3, "Spec check", 20, "dhuhr"),
          t(4, "QA pass", 20, "dhuhr"),
        ],
      },
    },
    {
      id: "S6",
      label: "S6 · Tight capacity (<15m free -> Almost full)",
      props: {
        ...b,
        nowDate: new Date(2026, 10, 26, 14, 15, 0),
        tasks: [t(1, "Deep sprint", 70, "dhuhr")],
      },
    },
    {
      id: "S7",
      label: "S7 · Overbooked (red bar, Day Full banner, 1-tap Move)",
      props: {
        ...b,
        nowDate: new Date(2026, 10, 26, 15, 10, 0),
        tasks: [t(1, "Heavy audit", 60, "dhuhr"), t(2, "Extra prep", 45, "dhuhr")],
      },
    },
    {
      id: "S8",
      label: "S8 · All done (green checks + celebrate Lumi)",
      props: {
        ...b,
        pomodoro: { ...b.pomodoro, daily_focus_minutes: 95 },
        tasks: [t(1, "Morning standup", 25, "fajr", true), t(2, "Ship feature", 45, "dhuhr", true)],
      },
    },
    {
      id: "S9",
      label: "S9 · After Isha / Night (Tomorrow preview + Today summary)",
      props: {
        ...b,
        nowDate: new Date(2026, 10, 26, 21, 15, 0),
        pomodoro: { ...b.pomodoro, daily_focus_minutes: 130 },
        tasks: [
          t(1, "Finished deck", 40, "asr", true),
          t(2, "Tomorrow kick-off", 30, "tomorrow:fajr"),
        ],
      },
    },
    {
      id: "S10",
      label: "S10 · No city set (fallback hours + city banner)",
      props: { ...b, locationConfigured: false },
    },
    {
      id: "S11",
      label: "S11 · First run (dismissible 3-step tip + sample task)",
      props: {
        ...b,
        firstRunDismissed: false,
        tasks: [t(99, "Sample: Try 25m focus", 25, "dhuhr")],
      },
    },
    {
      id: "S12",
      label: "S12 · Friday (Dhuhr block becomes Jumu'ah)",
      props: {
        ...b,
        nowDate: new Date(2026, 10, 27, 13, 30, 0),
        schedule: makeBaseSchedule({ is_friday: true }),
      },
    },
    {
      id: "S13",
      label: "S13 · Ramadan (Sehri & Iftar markers + Taraweeh)",
      props: {
        ...b,
        ramadanTaraweeh: true,
        schedule: makeBaseSchedule({ is_ramadan: true }),
      },
    },
    {
      id: "S14",
      label: "S14 · Day rollover prompt at Fajr",
      props: {
        ...b,
        waqtState: baseOverride({ yesterday_rollover_count: 2 }),
      },
    },
    {
      id: "S15",
      label: "S15 · Loading shimmer skeleton",
      props: { ...b, loading: true },
    },
    {
      id: "S16",
      label: "S16 · Error with Retry",
      props: { ...b, error: "Could not read local planner store" },
    },
    {
      id: "S17",
      label: "S17 · Quiet mode + Unplanned Plan My Day ready",
      props: {
        ...b,
        quietMode: true,
        tasks: [t(1, "Call client", 20, null), t(2, "Draft invoice", 45, null)],
      },
    },
  ];
}

export function DevStatesPage() {
  const [galleryTab, setGalleryTab] = useState<"home" | "waqt">("home");
  const homeStates = buildAll20States();
  const waqtStates = buildWaqt18States();
  const [selectedId, setSelectedId] = useState<string>("all");
  const visibleHome =
    selectedId === "all" ? homeStates : homeStates.filter((s) => s.id === selectedId);
  const visibleWaqt =
    selectedId === "all" ? waqtStates : waqtStates.filter((s) => s.id === selectedId);

  return (
    <div
      data-testid="dev-states-page"
      className="min-h-screen w-full overflow-y-auto bg-[#0b0c10] p-6 text-white"
      style={{ overflowY: "auto", userSelect: "text" }}
    >
      <div className="mx-auto max-w-[1260px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Lumen UI States Gallery (640×312)</h1>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setGalleryTab("waqt");
                  setSelectedId("all");
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  galleryTab === "waqt" ? "bg-[#ffb020] text-black" : "bg-white/10 text-white/75"
                }`}
              >
                Waqt Timeline (S0–S17)
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
            {(galleryTab === "waqt" ? waqtStates : homeStates).map((st) => (
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
          {galleryTab === "waqt"
            ? visibleWaqt.map((st) => (
                <section
                  key={st.id}
                  data-testid={`dev-waqt-state-${st.id}`}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between text-xs text-white/75">
                    <span className="font-semibold">{st.label}</span>
                    <span className="tabular-nums text-white/50">
                      {BASE_GEOMETRY.homeExpanded.width}×{BASE_GEOMETRY.homeExpanded.height} px
                    </span>
                  </div>
                  <div
                    className="relative overflow-hidden bg-black"
                    style={{
                      width: `${BASE_GEOMETRY.homeExpanded.width}px`,
                      height: `${BASE_GEOMETRY.homeExpanded.height}px`,
                      borderRadius: `0px 0px ${BASE_GEOMETRY.homeBottomRadius}px ${BASE_GEOMETRY.homeBottomRadius}px`,
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderTop: "0px",
                    }}
                  >
                    <WaqtTimeline {...st.props} />
                  </div>
                </section>
              ))
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

import { useState } from "react";
import { BASE_GEOMETRY } from "../design/tokens";
import { HomePage, type HomePageProps } from "../home/HomePage";
import type { PrayerSchedule } from "../lib/ipc";

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
      wifi: true,
      bluetooth: true,
      focus: true,
      micMuted: false,
      keepAwake: false,
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
    onToggleWifi: async () => true,
    onToggleBluetooth: async () => true,
    onToggleFocus: () => {},
    onToggleMic: () => {},
    onToggleKeepAwake: () => {},
    onLockWorkstation: () => {},
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
      label: "9. No music (Nothing playing + Play)",
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

export function DevStatesPage() {
  const states = buildAll20States();
  const [selectedId, setSelectedId] = useState<string>("all");
  const visibleStates = selectedId === "all" ? states : states.filter((s) => s.id === selectedId);

  return (
    <div
      data-testid="dev-states-page"
      className="min-h-screen w-full overflow-y-auto bg-[#0b0c10] p-6 text-white"
      style={{ overflowY: "auto", userSelect: "text" }}
    >
      <div className="mx-auto max-w-[1260px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Lumen Home — 20 UI States Gallery</h1>
            <p className="text-xs text-white/60">
              Visual review matrix at 100% (640×312) and 150% (960×468).
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedId("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                selectedId === "all" ? "bg-[#0a84ff] text-white" : "bg-white/10 text-white/75"
              }`}
            >
              All 20 States
            </button>
            {states.map((st) => (
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
          {visibleStates.map((st) => {
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

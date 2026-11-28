import { useState } from "react";
import type {
  CalendarEvent,
  ClipboardChipSnapshot,
  DevPulseSnapshot,
  MediaStateSnapshot,
  OpenMeteoWeather,
  PomodoroSnapshot,
  PrayerCityPreset,
  PrayerSchedule,
  ReminderItem,
  TasbihState,
  TaskItem,
  TimeLedgerState,
  WaterSummary,
} from "../lib/ipc";
import { ChipRow } from "./components/ChipRow";
import { DayArc } from "./components/DayArc";
import { GlowLayer } from "./components/GlowLayer";
import { MusicCard } from "./components/MusicCard";
import { NextCard } from "./components/NextCard";
import { TogglesRow, type TogglesState } from "./components/TogglesRow";
import { WaterCard } from "./components/WaterCard";
import { useAmbientPalette } from "./hooks/useAmbientPalette";
import { useDayArcGeometry, type ArcZoomMode } from "./hooks/useDayArcGeometry";

export type { HomeChipsConfig } from "./components/ChipRow";
export type { TogglesState } from "./components/TogglesRow";

export interface HomePageProps {
  nowDate: Date;
  schedule: PrayerSchedule | null;
  prayerCities?: PrayerCityPreset[];
  media: MediaStateSnapshot;
  lastPlayedTrack?: { title: string; artist: string } | null;
  calendarEvents: CalendarEvent[];
  tasks: TaskItem[];
  reminders?: ReminderItem[];
  water: WaterSummary;
  pomodoro: PomodoroSnapshot;
  weather: OpenMeteoWeather | null;
  weatherLoading?: boolean;
  weatherError?: string | null;
  locationNotSet?: boolean;
  tasbih: TasbihState;
  ledger: TimeLedgerState | null;
  clipboard: ClipboardChipSnapshot | null;
  devPulse: DevPulseSnapshot | null;
  toggles: TogglesState;
  batteryPct: number | null;
  isCharging: boolean;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  glowEnabled: boolean;
  parallaxEnabled: boolean;
  chipsConfig: {
    focus: boolean;
    ledger: boolean;
    clipboard: boolean;
    devPulse: boolean;
  };
  pagesCount: number;
  activePageIndex: number;
  isVisible: boolean;
  isFirstOpenOfDay: boolean;
  overrideNightMode?: boolean;
  overrideFriday?: boolean;
  overrideRamadan?: boolean;
  overrideNowMin?: number;
  onNavigateWidget: (widgetId: string) => void;
  onSelectPage: (index: number) => void;
  onOpenSettings: () => void;
  onLaunchScreenshot: () => Promise<void> | void;
  onLaunchScreenRecord: () => Promise<void> | void;
  onToggleFocus: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => Promise<boolean> | void;
  onLockWorkstation: () => void;
  onToggleSilentMode: () => void;
  onIncrementTasbih: () => void;
  onResetTasbih: () => void;
  onSelectPrayerCity?: (cityId: string) => void;
  onMediaPlayPause: () => void;
  onMediaPrev: () => void;
  onMediaNext: () => void;
  onMediaSeek?: (positionMs: number) => void;
  onMediaMuteToggle: () => void;
  onMediaVolumeDelta: (pct: number) => void;
  onMediaSelectSession?: (appId: string) => void;
  onLogWater: (ml: number) => void;
  onToggleFocusTimer: () => void;
  onToggleLedger: () => void;
  onCopyClipboard: () => Promise<void>;
  onToggleShape?: () => void;
}

export function HomePage(props: HomePageProps) {
  const [zoomMode, setZoomMode] = useState<ArcZoomMode>("day");

  const geometry = useDayArcGeometry({
    schedule: props.schedule,
    calendarEvents: props.calendarEvents,
    tasks: props.tasks,
    nowDate: props.nowDate,
    zoomMode,
    language: props.language,
    overrideNightMode: props.overrideNightMode,
    overrideFriday: props.overrideFriday,
    overrideRamadan: props.overrideRamadan,
    overrideNowMin: props.overrideNowMin,
  });

  const fajrMin = props.schedule?.slots[0]?.minute_of_day ?? 302;
  const dhuhrMin = props.schedule?.slots[1]?.minute_of_day ?? 708;
  const asrMin = props.schedule?.slots[2]?.minute_of_day ?? 940;

  const palette = useAmbientPalette({
    nowMin: geometry.nowMin,
    isNightMode: geometry.isNightMode,
    fajrMin,
    dhuhrMin,
    asrMin,
    albumAccentHex: props.media.active?.accent_hex,
    hasActiveMusic: Boolean(props.media.active),
    isFocusSession: props.pomodoro.running && props.pomodoro.phase === "focus",
    batteryPct: props.batteryPct,
    isCharging: props.isCharging,
    glowEnabled: props.glowEnabled,
    reduceTransparency: props.reduceTransparency,
  });

  return (
    <div
      data-testid="home-page"
      data-reduce-motion={props.reduceMotion ? "true" : "false"}
      data-reduce-transparency={props.reduceTransparency ? "true" : "false"}
      className="relative flex h-full w-full flex-col justify-start overflow-hidden px-[14px] pt-[12px] pb-[14px]"
    >
      <GlowLayer
        palette={palette}
        reduceMotion={props.reduceMotion}
        isVisible={props.isVisible}
        parallaxOffset={{ x: 0, y: 0 }}
      />

      {/* 1. Header Row (height 28) */}
      <TogglesRow
        nowDate={props.nowDate}
        language={props.language}
        banglaDigits={props.banglaDigits}
        toggles={props.toggles}
        reduceMotion={props.reduceMotion}
        onLaunchScreenshot={props.onLaunchScreenshot}
        onLaunchScreenRecord={props.onLaunchScreenRecord}
        onToggleFocus={props.onToggleFocus}
        onToggleMic={props.onToggleMic}
        onToggleCamera={props.onToggleCamera}
        onLockWorkstation={props.onLockWorkstation}
        onToggleSilentMode={props.onToggleSilentMode}
        onOpenSettings={props.onOpenSettings}
        onToggleShape={props.onToggleShape}
      />

      {/* 2. Day Arc Block (height 126, margin-top 4) */}
      <DayArc
        geometry={geometry}
        schedule={props.schedule}
        cities={props.prayerCities}
        weather={props.weather}
        weatherLoading={props.weatherLoading}
        weatherError={props.weatherError}
        locationNotSet={props.locationNotSet}
        tasbih={props.tasbih}
        zoomMode={zoomMode}
        language={props.language}
        banglaDigits={props.banglaDigits}
        reduceMotion={props.reduceMotion}
        isFirstOpenOfDay={props.isFirstOpenOfDay}
        isVisible={props.isVisible}
        onToggleZoom={() => setZoomMode((z) => (z === "day" ? "next3h" : "day"))}
        onSelectCity={props.onSelectPrayerCity}
        onOpenAgenda={() => props.onNavigateWidget("calendar")}
        onIncrementTasbih={props.onIncrementTasbih}
        onResetTasbih={props.onResetTasbih}
      />

      {/* 3. Bento Glass Card Row (1.7fr / 1fr / 1fr, fixed height 94) */}
      <div className="relative z-10 mt-[6px] grid h-[94px] grid-cols-[1.7fr_1fr_1fr] gap-[8px]">
        <MusicCard
          media={props.media}
          lastPlayedTrack={props.lastPlayedTrack}
          language={props.language}
          banglaDigits={props.banglaDigits}
          reduceMotion={props.reduceMotion}
          onPlayPause={props.onMediaPlayPause}
          onPrev={props.onMediaPrev}
          onNext={props.onMediaNext}
          onSeek={props.onMediaSeek}
          onMuteToggle={props.onMediaMuteToggle}
          onVolumeDelta={props.onMediaVolumeDelta}
          onSelectSession={props.onMediaSelectSession}
        />

        <NextCard
          calendarEvents={props.calendarEvents}
          tasks={props.tasks}
          reminders={props.reminders}
          schedule={props.schedule}
          nowDate={props.nowDate}
          language={props.language}
          banglaDigits={props.banglaDigits}
          reduceMotion={props.reduceMotion}
          onOpenAgenda={() => props.onNavigateWidget("reminders")}
        />

        <WaterCard
          water={props.water}
          language={props.language}
          banglaDigits={props.banglaDigits}
          reduceMotion={props.reduceMotion}
          onLogWater={props.onLogWater}
          onOpenWaterPage={() => props.onNavigateWidget("water")}
        />
      </div>

      {/* 4. Chip Row (height 22, margin-top 6) */}
      <ChipRow
        pomodoro={props.pomodoro}
        ledger={props.ledger}
        clipboard={props.clipboard}
        devPulse={props.devPulse}
        chipsConfig={props.chipsConfig}
        pagesCount={props.pagesCount}
        activePageIndex={props.activePageIndex}
        language={props.language}
        banglaDigits={props.banglaDigits}
        reduceMotion={props.reduceMotion}
        onToggleFocusTimer={props.onToggleFocusTimer}
        onToggleLedger={props.onToggleLedger}
        onCopyClipboard={props.onCopyClipboard}
        onOpenPomodoro={() => props.onNavigateWidget("pomodoro")}
        onSelectPage={props.onSelectPage}
      />
    </div>
  );
}

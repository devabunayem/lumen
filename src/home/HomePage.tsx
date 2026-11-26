import { Suspense, lazy, useMemo, useState, type MouseEvent } from "react";
import { motion } from "motion/react";
import { CONTENT_STAGGER, MOTION_PRESETS } from "../design/motion";
import type {
  CalendarEvent,
  ClipboardChipSnapshot,
  DevPulseSnapshot,
  MediaStateSnapshot,
  OpenMeteoWeather,
  PomodoroSnapshot,
  PrayerSchedule,
  TasbihState,
  TaskItem,
  TimeLedgerState,
  WaterSummary,
} from "../lib/ipc";
import { GlowLayer } from "./components/GlowLayer";
import { TogglesRow, type TogglesState } from "./components/TogglesRow";
import { useAmbientPalette } from "./hooks/useAmbientPalette";
import { useDayArcGeometry, type ArcZoomMode } from "./hooks/useDayArcGeometry";

const DayArc = lazy(() => import("./components/DayArc").then((m) => ({ default: m.DayArc })));
const MusicCard = lazy(() =>
  import("./components/MusicCard").then((m) => ({ default: m.MusicCard })),
);
const NextCard = lazy(() => import("./components/NextCard").then((m) => ({ default: m.NextCard })));
const WaterCard = lazy(() =>
  import("./components/WaterCard").then((m) => ({ default: m.WaterCard })),
);
const ChipRow = lazy(() => import("./components/ChipRow").then((m) => ({ default: m.ChipRow })));

export type { HomeChipsConfig } from "./components/ChipRow";
export type { TogglesState } from "./components/TogglesRow";

export interface HomePageProps {
  nowDate: Date;
  schedule: PrayerSchedule | null;
  media: MediaStateSnapshot;
  lastPlayedTrack?: { title: string; artist: string } | null;
  calendarEvents: CalendarEvent[];
  tasks: TaskItem[];
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
  onToggleWifi: () => Promise<boolean>;
  onToggleBluetooth: () => Promise<boolean>;
  onToggleFocus: () => void;
  onToggleMic: () => void;
  onToggleKeepAwake: () => void;
  onLockWorkstation: () => void;
  onIncrementTasbih: () => void;
  onResetTasbih: () => void;
  onMediaPlayPause: () => void;
  onMediaPrev: () => void;
  onMediaNext: () => void;
  onMediaMuteToggle: () => void;
  onMediaVolumeDelta: (pct: number) => void;
  onLogWater: (ml: number) => void;
  onToggleFocusTimer: () => void;
  onToggleLedger: () => void;
  onCopyClipboard: () => Promise<void>;
  onToggleShape?: () => void;
}

function CardRowSkeleton() {
  return (
    <div className="mt-[6px] grid grid-cols-[1.7fr_1fr_1fr] gap-[8px]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="home-glass-card lumen-skeleton-shimmer h-[116px]" />
      ))}
    </div>
  );
}

export function HomePage(props: HomePageProps) {
  const [zoomMode, setZoomMode] = useState<ArcZoomMode>("day");
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });

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

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!props.parallaxEnabled || !props.isVisible || props.reduceMotion) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setParallaxOffset({
      x: Math.max(-12, Math.min(12, nx * 24)),
      y: Math.max(-12, Math.min(12, ny * 24)),
    });
  };

  const handleMouseLeave = () => {
    setParallaxOffset({ x: 0, y: 0 });
  };

  const cardTransition = useMemo(
    () => (index: number) =>
      props.reduceMotion
        ? MOTION_PRESETS.reducedMotionFade
        : {
            ...MOTION_PRESETS.snappy,
            delay: (CONTENT_STAGGER.expandDelayMs + index * CONTENT_STAGGER.expandStaggerMs) / 1000,
          },
    [props.reduceMotion],
  );

  return (
    <div
      data-testid="home-page"
      data-reduce-motion={props.reduceMotion ? "true" : "false"}
      data-reduce-transparency={props.reduceTransparency ? "true" : "false"}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex h-full w-full flex-col justify-between overflow-hidden p-[16px]"
    >
      <GlowLayer
        palette={palette}
        reduceMotion={props.reduceMotion}
        isVisible={props.isVisible}
        parallaxOffset={parallaxOffset}
      />

      {/* 1. Header Row (height 30) */}
      <TogglesRow
        nowDate={props.nowDate}
        language={props.language}
        banglaDigits={props.banglaDigits}
        toggles={props.toggles}
        reduceMotion={props.reduceMotion}
        onToggleWifi={props.onToggleWifi}
        onToggleBluetooth={props.onToggleBluetooth}
        onToggleFocus={props.onToggleFocus}
        onToggleMic={props.onToggleMic}
        onToggleKeepAwake={props.onToggleKeepAwake}
        onLockWorkstation={props.onLockWorkstation}
        onOpenSettings={props.onOpenSettings}
        onToggleShape={props.onToggleShape}
      />

      {/* 2. Day Arc Block (height 150, margin-top 6) */}
      <Suspense
        fallback={<div className="lumen-skeleton-shimmer mt-[6px] h-[150px] w-full rounded-2xl" />}
      >
        <DayArc
          geometry={geometry}
          schedule={props.schedule}
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
          onOpenPrayer={() => props.onNavigateWidget("prayer")}
          onOpenAgenda={() => props.onNavigateWidget("calendar")}
          onIncrementTasbih={props.onIncrementTasbih}
          onResetTasbih={props.onResetTasbih}
        />
      </Suspense>

      {/* 3. Bento Glass Card Row (1.7fr / 1fr / 1fr, each 116 high) */}
      <Suspense fallback={<CardRowSkeleton />}>
        <div className="relative z-10 mt-[6px] grid grid-cols-[1.7fr_1fr_1fr] gap-[8px]">
          <motion.div
            initial={props.reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={cardTransition(0)}
          >
            <MusicCard
              media={props.media}
              lastPlayedTrack={props.lastPlayedTrack}
              language={props.language}
              banglaDigits={props.banglaDigits}
              reduceMotion={props.reduceMotion}
              onOpenMusicPage={() => props.onNavigateWidget("music")}
              onPlayPause={props.onMediaPlayPause}
              onPrev={props.onMediaPrev}
              onNext={props.onMediaNext}
              onMuteToggle={props.onMediaMuteToggle}
              onVolumeDelta={props.onMediaVolumeDelta}
            />
          </motion.div>

          <motion.div
            initial={props.reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={cardTransition(1)}
          >
            <NextCard
              calendarEvents={props.calendarEvents}
              tasks={props.tasks}
              schedule={props.schedule}
              nowDate={props.nowDate}
              language={props.language}
              banglaDigits={props.banglaDigits}
              reduceMotion={props.reduceMotion}
              onOpenAgenda={() => props.onNavigateWidget("calendar")}
            />
          </motion.div>

          <motion.div
            initial={props.reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={cardTransition(2)}
          >
            <WaterCard
              water={props.water}
              language={props.language}
              banglaDigits={props.banglaDigits}
              reduceMotion={props.reduceMotion}
              onLogWater={props.onLogWater}
              onOpenWaterPage={() => props.onNavigateWidget("water")}
            />
          </motion.div>
        </div>
      </Suspense>

      {/* 4. Chip Row (margin-top 10) */}
      <Suspense fallback={<div className="mt-[10px] h-[26px]" />}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={cardTransition(3)}
        >
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
        </motion.div>
      </Suspense>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  CloudIcon,
  CloudRainIcon,
  CompassIcon,
  MoonStarGlyph,
  MoonStarIcon,
  SunGlyph,
  SunIcon,
} from "../../design/icons";
import { CONTENT_STAGGER } from "../../design/motion";
import { playUiSound } from "../../design/sounds";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages } from "../../i18n";
import { formatDigits, formatPrayerLabel, interpolateMsg } from "../../i18n/digits";
import type {
  OpenMeteoWeather,
  PrayerCityPreset,
  PrayerSchedule,
  TasbihState,
} from "../../lib/ipc";
import {
  ARC_HORIZON_Y,
  ARC_SVG_H,
  ARC_SVG_W,
  buildDeCasteljauProgressPath,
  evaluateArcAtU,
  inspectArcAtSvgX,
  type ArcZoomMode,
  type DayArcGeometry,
} from "../hooks/useDayArcGeometry";

const KAABA_LAT_DEG = 21.4225;
const KAABA_LON_DEG = 39.8262;

function computeQiblaBearing(latDeg: number, lonDeg: number): { deg: number; cardinal: string } {
  const phi1 = (latDeg * Math.PI) / 180;
  const phi2 = (KAABA_LAT_DEG * Math.PI) / 180;
  const dLambda = ((KAABA_LON_DEG - lonDeg) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  const deg = ((Math.round(brng) % 360) + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return { deg, cardinal: dirs[Math.round(deg / 45) % 8] ?? "W" };
}

export interface DayArcProps {
  geometry: DayArcGeometry;
  schedule: PrayerSchedule | null;
  cities?: PrayerCityPreset[];
  weather: OpenMeteoWeather | null;
  weatherLoading?: boolean;
  weatherError?: string | null;
  locationNotSet?: boolean;
  tasbih: TasbihState;
  zoomMode: ArcZoomMode;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  isFirstOpenOfDay: boolean;
  isVisible: boolean;
  onToggleZoom: () => void;
  onSelectCity?: (cityId: string) => void;
  onOpenPrayer?: () => void;
  onOpenAgenda: () => void;
  onIncrementTasbih: () => void;
  onResetTasbih: () => void;
}

const EVENT_COLORS = {
  focus: COLOR_TOKENS.accentFocus,
  meeting: COLOR_TOKENS.accentGreen,
  call: COLOR_TOKENS.accentOrange,
  deadline: COLOR_TOKENS.accentRed,
} as const;

function formatRelativeAge(fetchedAtIso: string, banglaDigits: boolean): string {
  const ts = Date.parse(fetchedAtIso);
  if (Number.isNaN(ts)) {
    return formatDigits("2 h", banglaDigits);
  }
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60_000));
  if (mins >= 60) {
    return `${formatDigits(Math.round(mins / 60), banglaDigits)} h`;
  }
  return `${formatDigits(mins, banglaDigits)} min`;
}

export function DayArc({
  geometry,
  schedule,
  cities = [],
  weather,
  weatherLoading = false,
  weatherError = null,
  locationNotSet = false,
  tasbih,
  zoomMode,
  language,
  banglaDigits,
  reduceMotion,
  isFirstOpenOfDay,
  isVisible,
  onToggleZoom,
  onSelectCity,
  onOpenPrayer,
  onOpenAgenda,
  onIncrementTasbih,
  onResetTasbih,
}: DayArcProps) {
  const msg = getMessages(language);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastBucketRef = useRef<number | null>(null);
  const markerButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [hoverInfo, setHoverInfo] = useState<ReturnType<typeof inspectArcAtSvgX> | null>(null);
  const [qiblaOpen, setQiblaOpen] = useState(false);
  const [allSlotsOpen, setAllSlotsOpen] = useState(false);
  const [animU, setAnimU] = useState<number | null>(() =>
    isVisible && !reduceMotion && isFirstOpenOfDay ? 0 : null,
  );

  const qiblaInfo = useMemo(() => {
    const cityMatch = cities.find(
      (c) =>
        schedule &&
        (c.name_en.toLowerCase() === schedule.city_name.toLowerCase() ||
          c.name_bn === schedule.city_name),
    );
    const lat = schedule?.latitude ?? cityMatch?.latitude ?? 23.8103;
    const lon = schedule?.longitude ?? cityMatch?.longitude ?? 90.4125;
    return computeQiblaBearing(lat, lon);
  }, [cities, schedule]);

  useEffect(() => {
    if (!isVisible || reduceMotion || !isFirstOpenOfDay) {
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const durationMs = CONTENT_STAGGER.firstOpenSunDurationSec * 1000;
    const targetU = geometry.nowPoint.u;

    const step = (now: number) => {
      const elapsed = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setAnimU(elapsed < 1 ? targetU * eased : null);
      if (elapsed < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isFirstOpenOfDay, isVisible, reduceMotion, geometry.nowPoint.u]);

  const travelU =
    isVisible && !reduceMotion && isFirstOpenOfDay && animU !== null ? animU : geometry.nowPoint.u;
  const activeNowPoint = evaluateArcAtU(travelU);
  const animatedProgressPath = buildDeCasteljauProgressPath(travelU);

  const nextPrayerName = formatPrayerLabel(
    schedule?.next_name_en ?? (geometry.isNightMode ? "Fajr" : "Maghrib"),
    schedule?.next_name_bn,
    language,
  );
  const nextTimeText = formatDigits(schedule?.next_time_12h ?? "5:11 PM", banglaDigits);
  const nextCountdown = formatDigits(schedule?.countdown_text ?? "in 30 min", banglaDigits);

  const visibleMarkers = geometry.markers.filter((m) => m.inView);
  const fullSummary = interpolateMsg(msg.home.arc.summary, {
    prayer: nextPrayerName,
    time: nextTimeText,
    countdown: nextCountdown,
    events: geometry.events.length,
  });

  const handleSvgMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const svgX = ((event.clientX - rect.left) / rect.width) * ARC_SVG_W;
    const info = inspectArcAtSvgX(svgX, geometry, msg.home.arc.nothingHere);
    if (lastBucketRef.current !== null && lastBucketRef.current !== info.quarterBucket) {
      void playUiSound("arc_scrub_tick");
    }
    lastBucketRef.current = info.quarterBucket;
    setHoverInfo(info);
  };

  const handleSvgMouseLeave = () => {
    lastBucketRef.current = null;
    setHoverInfo(null);
  };

  const handleMarkerKeyDown = (index: number, e: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = markerButtonsRef.current.filter((el): el is HTMLButtonElement => Boolean(el));
    if (e.key === "ArrowRight") {
      e.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  const progressColor = geometry.isNightMode
    ? COLOR_TOKENS.arcMoonProgress
    : COLOR_TOKENS.arcProgress;
  const progressGlow = geometry.isNightMode
    ? COLOR_TOKENS.arcMoonGlow
    : COLOR_TOKENS.arcProgressGlow;
  const isDawnOrDusk =
    !geometry.isNightMode && (geometry.nowPoint.u < 0.14 || geometry.nowPoint.u > 0.84);
  const haloColor = geometry.isNightMode ? COLOR_TOKENS.arcMoonHalo : COLOR_TOKENS.arcSunHalo;

  const conditionTextMap: Record<string, string> = {
    clear: msg.home.arc.clear,
    cloudy: msg.home.arc.cloudy,
    rain: msg.home.arc.rain,
    storm: msg.home.arc.storm,
  };

  const renderWeatherRight = () => {
    if (weatherLoading) {
      return (
        <div className="flex flex-col items-end gap-1.5" data-testid="weather-skeleton">
          <div className="lumen-skeleton-shimmer h-[21px] w-[52px] rounded-lg" />
          <div className="lumen-skeleton-shimmer h-[11px] w-[100px] rounded-md" />
        </div>
      );
    }
    const temp = weather ? `${Math.round(weather.tempC)}°` : "29°";
    const cityLabel = schedule?.city_name ?? weather?.city ?? "Khulna";
    const subline = weatherError
      ? weatherError
      : weather?.offline
        ? `${cityLabel} · ${interpolateMsg(msg.home.arc.updatedAgo, { age: formatRelativeAge(weather.fetchedAt, banglaDigits) })}`
        : weather?.precipNote
          ? `${cityLabel} · ${weather.precipNote}`
          : locationNotSet
            ? `${cityLabel} · ${msg.home.arc.locationUnset}`
            : `${cityLabel} · ${conditionTextMap[weather?.condition ?? "clear"] ?? msg.home.arc.clear}`;

    const showRainNow =
      (weather?.condition === "rain" || weather?.condition === "storm") &&
      !weather?.precipNote?.toLowerCase().includes("rain in");
    const weatherIcon = showRainNow ? (
      <CloudRainIcon size={18} />
    ) : weather?.condition === "cloudy" ? (
      <CloudIcon size={18} />
    ) : geometry.isNightMode ? (
      <MoonStarIcon size={18} twinkle={isVisible && !reduceMotion} />
    ) : (
      <SunIcon size={18} warmDusk={isDawnOrDusk} />
    );

    const activeCityId =
      cities.find(
        (c) => c.name_en.toLowerCase() === cityLabel.toLowerCase() || c.name_bn === cityLabel,
      )?.id ?? "";

    return (
      <div className="flex flex-col items-end text-right">
        <div className="type-home-hero flex items-center gap-1.5 text-white">
          <span style={{ color: COLOR_TOKENS.textSecondary }}>{weatherIcon}</span>
          <span>{formatDigits(temp, banglaDigits)}</span>
        </div>
        <div
          className="type-home-micro relative mt-0.5 max-w-[132px] truncate"
          style={{ color: COLOR_TOKENS.arcTimeMuted }}
        >
          <span>{formatDigits(subline, banglaDigits)}</span>
          {onSelectCity && cities.length > 1 && (
            <select
              aria-label={language === "bn" ? "শহর পরিবর্তন করুন" : "Switch prayer city"}
              value={activeCityId}
              onChange={(e) => onSelectCity(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {language === "bn" ? c.name_bn : c.name_en}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  let interactiveIdx = 0;

  return (
    <section
      role="img"
      aria-label={fullSummary}
      data-testid="day-arc-section"
      data-night={geometry.isNightMode ? "true" : "false"}
      data-zoom={zoomMode}
      className="relative z-10 mt-[4px] h-[126px] w-full select-none"
    >
      {/* Hidden accessible list alternative */}
      <ul className="sr-only">
        <li>
          {nextPrayerName}: {nextTimeText} ({nextCountdown})
        </li>
        {visibleMarkers.map((m) => (
          <li key={m.id}>
            {m.label} at {m.timeLabel}
          </li>
        ))}
        {geometry.events.map((ev) => (
          <li key={ev.id}>{ev.title}</li>
        ))}
      </ul>

      {/* Left corner hero block */}
      <div className="pointer-events-auto absolute top-0 left-0 z-20 w-[184px]">
        <div className="flex items-baseline gap-1.5">
          <div
            className="type-home-hero truncate leading-tight text-white"
            data-testid="hero-next-prayer"
          >
            {nextPrayerName}
          </div>
          {schedule?.next_is_tomorrow && (
            <span className="text-[10px]" style={{ color: COLOR_TOKENS.arcTimeMuted }}>
              {language === "bn" ? "আগামীকাল" : "Tomorrow"}
            </span>
          )}
        </div>
        <div
          className="type-home-micro mt-0.5 leading-none"
          style={{ color: COLOR_TOKENS.arcTimeMuted }}
        >
          {nextTimeText} · {nextCountdown}
        </div>
        {schedule && (
          <div
            className="mt-1 h-[2px] w-[108px] overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.12)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(4, schedule.progress_pct))}%`,
                backgroundColor: COLOR_TOKENS.arcProgress,
              }}
            />
          </div>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              if (e.shiftKey) {
                onResetTasbih();
              } else {
                void playUiSound("toggle_on");
                onIncrementTasbih();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onResetTasbih();
            }}
            aria-label={`${msg.home.arc.tasbih} ${tasbih.count}`}
            className={`home-glass-chip type-home-micro inline-flex h-[20px] items-center gap-1 px-2 text-white ${
              reduceMotion ? "" : "transition-transform duration-100 active:scale-95"
            }`}
            data-testid="tasbih-chip"
          >
            <span>{msg.home.arc.tasbih}</span>
            <span className="font-semibold tabular-nums">
              {formatDigits(tasbih.count, banglaDigits)}
            </span>
          </button>
          <button
            type="button"
            data-testid="home-qibla-btn"
            aria-pressed={qiblaOpen}
            onClick={() => setQiblaOpen((v) => !v)}
            className={`home-glass-chip type-home-micro inline-flex h-[20px] items-center gap-1 px-2 ${
              reduceMotion ? "" : "transition-transform duration-100 active:scale-95"
            }`}
            style={{
              color: qiblaOpen ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.textPrimary,
              borderColor: qiblaOpen ? COLOR_TOKENS.accentGreen : undefined,
            }}
          >
            <CompassIcon size={10} />
            <span className="tabular-nums">
              {qiblaOpen
                ? formatDigits(`${qiblaInfo.deg}° ${qiblaInfo.cardinal}`, banglaDigits)
                : language === "bn"
                  ? "কিবলা"
                  : "Qibla"}
            </span>
          </button>
          {schedule?.is_ramadan && schedule.sehri_iftar_label && (
            <span
              data-testid="ramadan-badge"
              className="type-home-micro rounded-full px-2 py-0.5 font-medium"
              style={{
                background: "rgba(255, 176, 32, 0.14)",
                color: COLOR_TOKENS.arcSun,
              }}
            >
              {formatDigits(schedule.sehri_iftar_label, banglaDigits)}
            </span>
          )}
        </div>
      </div>

      {/* Right corner weather block */}
      <div className="pointer-events-auto absolute top-0 right-0 z-20 w-[132px]">
        {renderWeatherRight()}
      </div>

      {/* Main 728x150 Day Arc SVG scaled cleanly inside 126px band */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${ARC_SVG_W} ${ARC_SVG_H}`}
        className="h-[126px] w-full overflow-visible"
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={handleSvgMouseLeave}
        aria-hidden="true"
      >
        {/* Horizon */}
        <line
          x1={20}
          y1={ARC_HORIZON_Y}
          x2={708}
          y2={ARC_HORIZON_Y}
          stroke={COLOR_TOKENS.arcHorizon}
          strokeWidth={1}
        />

        {/* Full arc track */}
        <path
          d={geometry.fullArcPath}
          fill="none"
          stroke={COLOR_TOKENS.arcTrack}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Glow progress curve */}
        <path
          d={animatedProgressPath}
          fill="none"
          stroke={progressGlow}
          strokeWidth={9}
          strokeLinecap="round"
        />

        {/* Crisp progress curve */}
        <path
          d={animatedProgressPath}
          fill="none"
          stroke={progressColor}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Dotted vertical guide lines + labels */}
        {visibleMarkers.map((m) => (
          <g key={m.id}>
            <line
              x1={m.x}
              y1={m.y + 5}
              x2={m.x}
              y2={110}
              stroke={COLOR_TOKENS.arcGuide}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            {m.passed ? (
              <g data-testid={`arc-passed-${m.id}`}>
                <circle cx={m.x} cy={m.y} r={5} fill={COLOR_TOKENS.accentGreen} />
                <path
                  d={`M ${(m.x - 2.2).toFixed(1)} ${(m.y + 0.1).toFixed(1)} L ${(m.x - 0.5).toFixed(1)} ${(m.y + 1.9).toFixed(1)} L ${(m.x + 2.5).toFixed(1)} ${(m.y - 1.7).toFixed(1)}`}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : (
              <circle
                cx={m.x}
                cy={m.y}
                r={m.isNext ? 5.5 : 4}
                fill="#000000"
                stroke={m.isNext ? progressColor : COLOR_TOKENS.arcMarkerRing}
                strokeWidth={m.isNext ? 2 : 1.5}
              />
            )}
            <text
              x={m.x}
              y={124}
              textAnchor="middle"
              fontSize={11}
              fontWeight={m.isNext ? 600 : 400}
              fill={m.isNext ? progressColor : "rgba(255, 255, 255, 0.72)"}
            >
              {m.label}
            </text>
            <text
              x={m.x}
              y={138}
              textAnchor="middle"
              fontSize={11}
              fill={COLOR_TOKENS.arcTimeMuted}
              className="tabular-nums"
            >
              {formatDigits(m.timeLabel, banglaDigits)}
            </text>
          </g>
        ))}

        {/* Event lane bars under the horizon */}
        {geometry.events.map((ev) => (
          <rect
            key={ev.id}
            x={ev.x}
            y={ev.y}
            width={ev.width}
            height={6}
            rx={3}
            fill={EVENT_COLORS[ev.category]}
          />
        ))}

        {/* Ramadan Sehri / Iftar subtle horizon indicators */}
        {geometry.ramadanMarkers
          .filter((rm) => rm.inView)
          .map((rm) => (
            <g key={rm.id}>
              <circle
                cx={rm.x}
                cy={ARC_HORIZON_Y}
                r={3.5}
                fill={COLOR_TOKENS.arcSun}
                stroke="#000000"
                strokeWidth={1}
              />
            </g>
          ))}

        {/* Sun / Moon "Now" celestial glyph */}
        <g data-testid={geometry.isNightMode ? "arc-moon-glyph" : "arc-sun-glyph"}>
          <circle
            cx={activeNowPoint.x}
            cy={activeNowPoint.y}
            r={16}
            fill={haloColor}
            className={isVisible && !reduceMotion ? "lumen-halo-breath" : undefined}
          />
          <g
            transform={`translate(${(activeNowPoint.x - 10).toFixed(2)}, ${(activeNowPoint.y - 10).toFixed(2)}) scale(${(20 / 24).toFixed(4)})`}
          >
            {geometry.isNightMode ? (
              <MoonStarGlyph twinkle={isVisible && !reduceMotion} />
            ) : (
              <SunGlyph warmDusk={isDawnOrDusk} animated={isVisible && !reduceMotion} />
            )}
          </g>
        </g>

        {/* Pointer scrub hairline cursor */}
        {hoverInfo && (
          <line
            x1={hoverInfo.x}
            y1={12}
            x2={hoverInfo.x}
            y2={108}
            stroke="rgba(255, 255, 255, 0.36)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Real keyboard-focusable >= 32px interactive buttons for prayer markers */}
      {visibleMarkers.map((m) => {
        const currentIdx = interactiveIdx++;
        return (
          <button
            key={`btn-${m.id}`}
            ref={(el) => {
              markerButtonsRef.current[currentIdx] = el;
            }}
            type="button"
            aria-label={`${m.label} ${m.timeLabel}`}
            onClick={() => {
              setAllSlotsOpen((v) => !v);
              onOpenPrayer?.();
            }}
            onKeyDown={(e) => handleMarkerKeyDown(currentIdx, e)}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
            style={{
              left: `${(m.x / ARC_SVG_W) * 100}%`,
              top: `${(m.y / ARC_SVG_H) * 100}%`,
              width: 32,
              height: 32,
            }}
          />
        );
      })}

      {/* Sun/Moon zoom toggle button (>= 32px target) */}
      {(() => {
        const sunIdx = interactiveIdx++;
        return (
          <button
            ref={(el) => {
              markerButtonsRef.current[sunIdx] = el;
            }}
            type="button"
            data-testid="sun-zoom-toggle"
            aria-label={zoomMode === "day" ? msg.home.arc.zoom3h : msg.home.arc.zoomDay}
            onClick={() => {
              void playUiSound("toggle_on");
              onToggleZoom();
            }}
            onKeyDown={(e) => handleMarkerKeyDown(sunIdx, e)}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
            style={{
              left: `${(activeNowPoint.x / ARC_SVG_W) * 100}%`,
              top: `${(activeNowPoint.y / ARC_SVG_H) * 100}%`,
              width: 32,
              height: 32,
            }}
          />
        );
      })()}

      {/* Event lane clickable targets */}
      {geometry.events.map((ev) => {
        const evIdx = interactiveIdx++;
        return (
          <button
            key={`ev-btn-${ev.id}`}
            ref={(el) => {
              markerButtonsRef.current[evIdx] = el;
            }}
            type="button"
            aria-label={ev.title}
            title={ev.title}
            onClick={onOpenAgenda}
            onKeyDown={(e) => handleMarkerKeyDown(evIdx, e)}
            className="absolute z-20 -translate-y-1/2 rounded bg-transparent"
            style={{
              left: `${(ev.x / ARC_SVG_W) * 100}%`,
              top: `${((ev.y + 3) / ARC_SVG_H) * 100}%`,
              width: Math.max(32, (ev.width / ARC_SVG_W) * 100),
              height: 20,
            }}
          />
        );
      })}

      {/* All 5 prayers inline strip when any prayer marker is clicked */}
      {allSlotsOpen && schedule && schedule.slots.length > 0 && (
        <div
          data-testid="home-prayer-popover"
          onClick={() => setAllSlotsOpen(false)}
          className="absolute top-0 left-1/2 z-30 grid -translate-x-1/2 cursor-pointer grid-cols-5 gap-2.5 rounded-2xl px-3 py-1.5 shadow-lg"
          style={{
            background: COLOR_TOKENS.arcTooltipBg,
            border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
          }}
        >
          {schedule.slots.map((slot) => {
            const isNext = slot.name_en === schedule.next_name_en;
            return (
              <div key={slot.id} className="flex flex-col items-center text-center leading-tight">
                <span
                  className="text-[10px] font-semibold"
                  style={{
                    color: isNext
                      ? COLOR_TOKENS.arcProgress
                      : slot.passed
                        ? COLOR_TOKENS.accentGreen
                        : COLOR_TOKENS.textSecondary,
                  }}
                >
                  {language === "bn" ? slot.name_bn : slot.name_en}
                </span>
                <span
                  className="text-[9.5px] tabular-nums"
                  style={{ color: COLOR_TOKENS.textPrimary }}
                >
                  {formatDigits(slot.time_12h.replace(/\s*(AM|PM)$/i, ""), banglaDigits)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Scrub tooltip */}
      {hoverInfo && (
        <div
          role="status"
          data-testid="arc-scrub-tooltip"
          className="type-home-micro pointer-events-none absolute -top-2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-0.5 text-white"
          style={{
            left: `${Math.max(12, Math.min(88, (hoverInfo.x / ARC_SVG_W) * 100))}%`,
            background: COLOR_TOKENS.arcTooltipBg,
            border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
          }}
        >
          {formatDigits(hoverInfo.timeText, banglaDigits)} · {hoverInfo.detailText}
        </div>
      )}
    </section>
  );
}

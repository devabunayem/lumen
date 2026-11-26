import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { CompassIcon, MoonStarIcon, TasbihIcon } from "../../design/icons";
import { getMotionTransition } from "../../design/motion";
import { COLOR_TOKENS } from "../../design/tokens";
import type { PrayerCityPreset, PrayerSchedule, TasbihState } from "../../lib/ipc";

export interface PrayerWidgetProps {
  schedule: PrayerSchedule | null;
  cities?: PrayerCityPreset[];
  language: "en" | "bn";
  tasbih?: TasbihState;
  onSelectCity?: (cityId: string) => void;
  onToggleLanguage?: () => void;
  onIncrementTasbih?: () => void;
  onResetTasbih?: () => void;
}

const KAABA_LAT_DEG = 21.4225;
const KAABA_LON_DEG = 39.8262;

function computeQiblaBearingDeg(latDeg: number, lonDeg: number): number {
  const phi1 = (latDeg * Math.PI) / 180;
  const phi2 = (KAABA_LAT_DEG * Math.PI) / 180;
  const dLambda = ((KAABA_LON_DEG - lonDeg) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return ((Math.round(brng) % 360) + 360) % 360;
}

function compassDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8] ?? "W";
}

function parabolicPoint(u: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, u));
  // Matches M 18 58 Q 160 -26 302 58
  const p0x = 18;
  const p1x = 160;
  const p2x = 302;
  const p0y = 58;
  const p1y = -26;
  const p2y = 58;
  const omt = 1 - t;
  return {
    x: omt * omt * p0x + 2 * omt * t * p1x + t * t * p2x,
    y: omt * omt * p0y + 2 * omt * t * p1y + t * t * p2y,
  };
}

function parabolicSubCurve(endU: number): string {
  const t = Math.min(1, Math.max(0.01, endU));
  const p0 = { x: 18, y: 58 };
  const p1 = { x: 160, y: -26 };
  const q0x = p0.x + t * (p1.x - p0.x);
  const q0y = p0.y + t * (p1.y - p0.y);
  const end = parabolicPoint(t);
  return `M ${p0.x} ${p0.y} Q ${q0x.toFixed(1)} ${q0y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function compactClock(time12h: string): string {
  return time12h.replace(/\s*(AM|PM)$/i, "").trim();
}

export function PrayerWidget({
  schedule,
  cities = [],
  language,
  tasbih,
  onSelectCity,
  onIncrementTasbih,
  onResetTasbih,
}: PrayerWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [localTasbih, setLocalTasbih] = useState(33);
  const [qiblaOpen, setQiblaOpen] = useState(false);

  const qiblaInfo = useMemo(() => {
    const cityMatch = cities.find(
      (c) =>
        schedule &&
        (c.name_en.toLowerCase() === schedule.city_name.toLowerCase() ||
          c.name_bn === schedule.city_name),
    );
    const lat = cityMatch?.latitude ?? 23.8103;
    const lon = cityMatch?.longitude ?? 90.4125;
    const deg = computeQiblaBearingDeg(lat, lon);
    return { deg, cardinal: compassDirection(deg) };
  }, [cities, schedule]);

  if (!schedule) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <span className="type-caption" style={{ color: COLOR_TOKENS.textSecondary }}>
          Calculating offline prayer times
        </span>
      </div>
    );
  }

  const nextName = language === "bn" ? schedule.next_name_bn : schedule.next_name_en;
  const tasbihCount = tasbih ? tasbih.count : localTasbih;
  const sunPt = parabolicPoint(schedule.sun_arc_ratio);
  const progressArcD = parabolicSubCurve(schedule.sun_arc_ratio);

  const activeSlot =
    schedule.slots.find((s) => s.id === hoveredSlotId) ??
    schedule.slots.find((s) => s.name_en === schedule.next_name_en) ??
    schedule.slots[0];

  const handleCycleCity = () => {
    if (!onSelectCity || cities.length <= 1) {
      return;
    }
    const idx = cities.findIndex(
      (c) =>
        c.name_en.toLowerCase() === schedule.city_name.toLowerCase() ||
        c.name_bn === schedule.city_name,
    );
    const next = cities[(idx + 1 + cities.length) % cities.length];
    if (next) {
      onSelectCity(next.id);
    }
  };

  return (
    <div className="relative flex h-full w-full items-stretch justify-between gap-4 overflow-hidden px-1">
      {/* Dual-tone ambient glow matching emerald Prayer corner + amber solar arc */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 z-0"
        style={{
          background:
            "radial-gradient(240px 140px at 14% 72%, rgba(48, 209, 88, 0.14), transparent 72%), radial-gradient(260px 150px at 84% 18%, rgba(255, 176, 32, 0.18), transparent 72%)",
        }}
      />

      {/* Left Column: Prayer Header, Big Title, Amber Time, Progress, Tasbih & Qibla */}
      <div className="relative z-10 flex w-[170px] shrink-0 flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center justify-between gap-1.5">
            <span
              className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color: COLOR_TOKENS.accentGreen }}
            >
              <MoonStarIcon size={11} />
              <span>{language === "bn" ? "নামাজ" : "Prayer"}</span>
            </span>
            <button
              type="button"
              onClick={handleCycleCity}
              title={cities.length > 1 ? "Switch city" : schedule.city_name}
              className="cursor-pointer truncate rounded-full border-0 bg-transparent px-1 py-0 text-[10px] font-medium"
              style={{ color: COLOR_TOKENS.textTertiary }}
            >
              {schedule.city_name}
            </button>
          </div>

          <div
            className="mt-0.5 truncate text-[22px] font-bold leading-none tracking-tight"
            style={{ color: COLOR_TOKENS.textPrimary }}
          >
            {nextName}
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-[12.5px] font-semibold tabular-nums leading-none"
              style={{ color: COLOR_TOKENS.arcProgress }}
            >
              {schedule.next_time_12h}
            </span>
            {schedule.next_is_tomorrow && (
              <span className="text-[10px]" style={{ color: COLOR_TOKENS.textTertiary }}>
                {language === "bn" ? "আগামীকাল" : "Tomorrow"}
              </span>
            )}
          </div>

          <div
            className="mt-0.5 truncate text-[11px] tabular-nums"
            style={{ color: COLOR_TOKENS.textSecondary }}
          >
            {qiblaOpen
              ? `${language === "bn" ? "কিবলা" : "Qibla"} · ${qiblaInfo.deg}° ${qiblaInfo.cardinal}`
              : schedule.countdown_text}
          </div>
        </div>

        {/* Amber Progress Bar */}
        <div
          className="h-[4px] w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.14)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: COLOR_TOKENS.arcProgress }}
            initial={false}
            animate={{ width: `${Math.min(100, Math.max(4, schedule.progress_pct))}%` }}
            transition={getMotionTransition("progressSpring", prefersReducedMotion)}
          />
        </div>

        {/* Bottom Quick Action Pills: Tasbih + Qibla */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="prayer-tasbih-btn"
            onClick={() => {
              if (onIncrementTasbih) {
                onIncrementTasbih();
              } else {
                setLocalTasbih((c) => c + 1);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (onResetTasbih) {
                onResetTasbih();
              } else {
                setLocalTasbih(0);
              }
            }}
            title={
              language === "bn"
                ? "তাসবিহ গণনা (রাইট-ক্লিকে রিসেট)"
                : "Tap to count Tasbih (right-click reset)"
            }
            className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-transform active:scale-95"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            <TasbihIcon size={12} />
            <span className="tabular-nums">
              {language === "bn" ? "তাসবিহ" : "Tasbih"} {tasbihCount}
            </span>
          </button>

          <button
            type="button"
            data-testid="prayer-qibla-btn"
            aria-pressed={qiblaOpen}
            onClick={() => setQiblaOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors active:scale-95"
            style={{
              backgroundColor: qiblaOpen ? "rgba(48, 209, 88, 0.16)" : "rgba(255, 255, 255, 0.06)",
              border: qiblaOpen
                ? "1px solid rgba(48, 209, 88, 0.45)"
                : "1px solid rgba(255, 255, 255, 0.12)",
              color: qiblaOpen ? COLOR_TOKENS.accentGreen : COLOR_TOKENS.textPrimary,
            }}
          >
            <CompassIcon size={11} />
            <span>{language === "bn" ? "কিবলা" : "Qibla"}</span>
          </button>
        </div>
      </div>

      {/* Right Column: Glowing Parabolic Sun Arc + Dashed Markers + Checkmark Prayer Strip */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="relative w-full">
          <svg
            viewBox="0 0 320 64"
            className="h-[64px] w-full overflow-visible"
            aria-label="Prayer sun-arc timeline"
          >
            {/* Horizon line */}
            <line
              x1="14"
              y1="58"
              x2="306"
              y2="58"
              stroke={COLOR_TOKENS.arcHorizon}
              strokeWidth="1"
            />
            {/* Full parabolic track */}
            <path
              d="M 18 58 Q 160 -26 302 58"
              fill="none"
              stroke={COLOR_TOKENS.arcTrack}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            {/* Progress arc outer glow + core amber curve */}
            <path
              d={progressArcD}
              fill="none"
              stroke={COLOR_TOKENS.arcProgressGlow}
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d={progressArcD}
              fill="none"
              stroke={COLOR_TOKENS.arcProgress}
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* Prayer markers with dashed drop lines */}
            {schedule.slots.map((slot) => {
              const pt = parabolicPoint(slot.arc_ratio);
              const isNext = slot.name_en === schedule.next_name_en;
              return (
                <g key={slot.id}>
                  <line
                    x1={pt.x}
                    y1={pt.y + 3}
                    x2={pt.x}
                    y2="58"
                    stroke="rgba(255, 255, 255, 0.16)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  {slot.passed ? (
                    <circle cx={pt.x} cy={pt.y} r="3" fill={COLOR_TOKENS.textPrimary} />
                  ) : isNext ? (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.2"
                      fill="#000000"
                      stroke={COLOR_TOKENS.arcProgress}
                      strokeWidth="2"
                    />
                  ) : (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="3.2"
                      fill="#000000"
                      stroke={COLOR_TOKENS.arcMarkerRing}
                      strokeWidth="1.4"
                    />
                  )}
                </g>
              );
            })}

            {/* Current Solar Orb */}
            <circle cx={sunPt.x} cy={sunPt.y} r="9" fill={COLOR_TOKENS.arcSunHalo} />
            <circle cx={sunPt.x} cy={sunPt.y} r="4.5" fill={COLOR_TOKENS.arcSun} />
          </svg>
        </div>

        {/* 5 Prayer Slots Strip with Green Checkmarks & Rings */}
        <div className="grid grid-cols-5 items-start gap-1 text-center">
          {schedule.slots.map((slot) => {
            const isNext = slot.name_en === schedule.next_name_en;
            const isHovered = hoveredSlotId === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                onMouseEnter={() => setHoveredSlotId(slot.id)}
                onMouseLeave={() => setHoveredSlotId(null)}
                onFocus={() => setHoveredSlotId(slot.id)}
                onBlur={() => setHoveredSlotId(null)}
                className="flex cursor-pointer flex-col items-center gap-0.5 border-0 bg-transparent p-0 transition-opacity hover:opacity-100"
                title={`${language === "bn" ? slot.name_bn : slot.name_en}: ${slot.time_12h}`}
              >
                <span
                  className="text-[10.5px] font-semibold leading-tight"
                  style={{
                    color:
                      isNext || isHovered
                        ? COLOR_TOKENS.arcProgress
                        : slot.passed
                          ? COLOR_TOKENS.textSecondary
                          : COLOR_TOKENS.textSecondary,
                  }}
                >
                  {language === "bn" ? slot.name_bn : slot.name_en}
                </span>
                <span
                  className="text-[10px] tabular-nums leading-tight"
                  style={{
                    color:
                      isNext || isHovered ? COLOR_TOKENS.arcProgress : COLOR_TOKENS.textTertiary,
                  }}
                >
                  {compactClock(slot.time_12h)}
                </span>
                <span className="mt-0.5 flex h-3.5 w-3.5 items-center justify-center">
                  {slot.passed ? (
                    <span
                      className="flex h-3 w-3 items-center justify-center rounded-full"
                      style={{ backgroundColor: COLOR_TOKENS.accentGreen }}
                    >
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                          d="M2.5 6.2L5 8.7L9.5 3.5"
                          stroke="#000000"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : isNext ? (
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        border: `1.8px solid ${COLOR_TOKENS.arcProgress}`,
                        backgroundColor: "transparent",
                      }}
                    />
                  ) : (
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        border: "1.5px solid rgba(255, 255, 255, 0.28)",
                        backgroundColor: "transparent",
                      }}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Accessible active slot readout */}
        {activeSlot && (
          <div className="sr-only">
            {language === "bn" ? activeSlot.name_bn : activeSlot.name_en} · {activeSlot.time_12h}
          </div>
        )}
      </div>
    </div>
  );
}

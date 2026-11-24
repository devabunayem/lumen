import { motion, useReducedMotion } from "motion/react";
import { getMotionTransition } from "../../design/motion";
import type { PrayerCityPreset, PrayerSchedule } from "../../lib/ipc";

export interface PrayerWidgetProps {
  schedule: PrayerSchedule | null;
  cities: PrayerCityPreset[];
  language: "en" | "bn";
  onSelectCity: (cityId: string) => void;
  onToggleLanguage: () => void;
}

export function PrayerWidget({
  schedule,
  cities,
  language,
  onSelectCity,
  onToggleLanguage,
}: PrayerWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  if (!schedule) {
    return (
      <div
        className="flex h-full w-full items-center justify-center px-4"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
          Calculating offline prayer times...
        </span>
      </div>
    );
  }

  const nextName = language === "bn" ? schedule.next_name_bn : schedule.next_name_en;
  const sunAngle = Math.PI * (1 - schedule.sun_arc_ratio);
  const arcCx = 110;
  const arcCy = 74;
  const arcR = 64;
  const sunX = arcCx + arcR * Math.cos(sunAngle);
  const sunY = arcCy - arcR * Math.sin(sunAngle);

  return (
    <div className="flex h-full w-full items-stretch justify-between gap-3">
      {/* Left block: Next, today/tomorrow, large prayer name, countdown, progress bar (FR-PR-3) */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="type-caption font-semibold" style={{ color: "var(--accent-cyan)" }}>
              Next · {schedule.next_is_tomorrow ? "tomorrow" : "today"}
            </span>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="type-caption cursor-pointer rounded-full border-0 px-2 py-0.5"
              style={{
                backgroundColor: "var(--surface-button)",
                color: "var(--text-secondary)",
              }}
            >
              {language === "bn" ? "বাংলা" : "EN"}
            </button>
          </div>

          {cities.length > 0 && (
            <select
              aria-label="Select prayer city"
              value={
                cities.find((c) => c.name_en === schedule.city_name)?.id ?? cities[0]?.id ?? "dhaka"
              }
              onChange={(e) => onSelectCity(e.target.value)}
              className="type-caption cursor-pointer rounded-full border-0 px-2 py-0.5"
              style={{
                backgroundColor: "var(--surface-button)",
                color: "var(--text-primary)",
              }}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {language === "bn" ? c.name_bn : c.name_en}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="type-title text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {nextName}
          </span>
          <span className="type-body tabular-nums" style={{ color: "var(--accent-cyan)" }}>
            {schedule.next_time_12h}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="type-caption tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {schedule.countdown_text}
          </span>
          <span className="type-caption truncate" style={{ color: "var(--text-tertiary)" }}>
            {schedule.sehri_iftar_label}
          </span>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--surface-button)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--accent-cyan)" }}
            initial={false}
            animate={{ width: `${schedule.progress_pct}%` }}
            transition={getMotionTransition("progressSpring", prefersReducedMotion)}
          />
        </div>
      </div>

      {/* Right block: Sun-arc chart with 5 prayer markers and glowing sun (FR-PR-3) */}
      <div
        className="flex w-[225px] shrink-0 flex-col items-center justify-between px-2 py-1.5"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        <svg width="210" height="84" viewBox="0 0 220 86" aria-label="Prayer sun-arc timeline">
          <path
            d={`M ${arcCx - arcR} ${arcCy} A ${arcR} ${arcR} 0 0 1 ${arcCx + arcR} ${arcCy}`}
            fill="none"
            stroke="var(--surface-button)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {schedule.slots.map((slot) => {
            const angle = Math.PI * (1 - slot.arc_ratio);
            const mx = arcCx + arcR * Math.cos(angle);
            const my = arcCy - arcR * Math.sin(angle);
            return (
              <circle
                key={slot.id}
                cx={mx}
                cy={my}
                r="3.2"
                fill={slot.passed ? "var(--accent-cyan)" : "var(--text-tertiary)"}
              />
            );
          })}
          {/* Glowing sun at current time */}
          <circle cx={sunX} cy={sunY} r="7" fill="var(--accent-cyan)" opacity="0.28" />
          <circle cx={sunX} cy={sunY} r="4" fill="var(--text-primary)" />
        </svg>

        <div className="flex w-full items-center justify-between px-1">
          {schedule.slots.map((slot) => (
            <span
              key={slot.id}
              className="text-[10px] font-medium"
              style={{
                color: slot.passed ? "var(--accent-cyan)" : "var(--text-secondary)",
              }}
            >
              {(language === "bn" ? slot.name_bn : slot.name_en).slice(0, 3)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

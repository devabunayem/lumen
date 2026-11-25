import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { getMotionTransition } from "../../design/motion";
import type { PrayerCityPreset, PrayerSchedule } from "../../lib/ipc";

export interface PrayerWidgetProps {
  schedule: PrayerSchedule | null;
  cities?: PrayerCityPreset[];
  language: "en" | "bn";
  onSelectCity?: (cityId: string) => void;
  onToggleLanguage?: () => void;
}

export function PrayerWidget({ schedule, language }: PrayerWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  if (!schedule) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
          Calculating offline prayer times
        </span>
      </div>
    );
  }

  const nextName = language === "bn" ? schedule.next_name_bn : schedule.next_name_en;
  const sunAngle = Math.PI * (1 - schedule.sun_arc_ratio);
  const arcCx = 110;
  const arcCy = 70;
  const arcR = 60;
  const sunX = arcCx + arcR * Math.cos(sunAngle);
  const sunY = arcCy - arcR * Math.sin(sunAngle);

  const activeSlot =
    schedule.slots.find((s) => s.id === hoveredSlotId) ??
    schedule.slots.find((s) => s.name_en === schedule.next_name_en) ??
    schedule.slots[0];

  return (
    <div className="flex h-full w-full items-stretch justify-between gap-3 overflow-hidden pb-1.5">
      {/* Left block: Next, large prayer name, countdown, progress bar */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-center justify-between gap-2">
          <span className="type-caption font-semibold" style={{ color: "var(--accent-cyan)" }}>
            {schedule.next_is_tomorrow ? "Next · Tomorrow" : "Next"}
          </span>
          <span className="type-caption truncate" style={{ color: "var(--text-tertiary)" }}>
            {schedule.city_name}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span
            className="type-title text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
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
          {schedule.sehri_iftar_label ? (
            <span className="type-caption truncate" style={{ color: "var(--text-tertiary)" }}>
              {schedule.sehri_iftar_label}
            </span>
          ) : null}
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

      {/* Right block: Free-floating sun-arc chart (no box/border) + full names + active/hover time */}
      <div className="flex w-[132px] shrink-0 flex-col items-center justify-between px-0.5">
        <svg width="124" height="44" viewBox="0 0 220 80" aria-label="Prayer sun-arc timeline">
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
          <circle cx={sunX} cy={sunY} r="7" fill="var(--accent-cyan)" opacity="0.28" />
          <circle cx={sunX} cy={sunY} r="4" fill="var(--text-primary)" />
        </svg>

        <div className="flex w-full items-center justify-between gap-0.5">
          {schedule.slots.map((slot) => {
            const isHighlighted = hoveredSlotId
              ? slot.id === hoveredSlotId
              : slot.name_en === schedule.next_name_en;
            return (
              <button
                key={slot.id}
                type="button"
                onMouseEnter={() => setHoveredSlotId(slot.id)}
                onMouseLeave={() => setHoveredSlotId(null)}
                onFocus={() => setHoveredSlotId(slot.id)}
                onBlur={() => setHoveredSlotId(null)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[9px] font-medium transition-colors"
                style={{
                  color: isHighlighted
                    ? "var(--text-primary)"
                    : slot.passed
                      ? "var(--accent-cyan)"
                      : "var(--text-secondary)",
                }}
                title={`${language === "bn" ? slot.name_bn : slot.name_en}: ${slot.time_12h}`}
              >
                {language === "bn" ? slot.name_bn : slot.name_en}
              </button>
            );
          })}
        </div>

        {activeSlot && (
          <div className="text-[10px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {language === "bn" ? activeSlot.name_bn : activeSlot.name_en} · {activeSlot.time_12h}
          </div>
        )}
      </div>
    </div>
  );
}

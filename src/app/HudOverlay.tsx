import { motion, useReducedMotion } from "motion/react";
import { getMotionTransition } from "../design/motion";
import type { HudEvent } from "../lib/ipc";

export interface HudOverlayProps {
  hud: HudEvent;
}

function hudIcon(kind: string): string {
  switch (kind) {
    case "volume":
      return "🔊";
    case "mute":
      return "🔇";
    case "caps_lock":
      return "🔠";
    case "battery":
      return "🔋";
    case "brightness":
      return "☀️";
    default:
      return "⚡";
  }
}

export function HudOverlay({ hud }: HudOverlayProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const pct = hud.value_pct ?? (hud.active ? 100 : 0);

  return (
    <div className="flex h-full w-full items-center justify-between gap-3 px-4">
      <div className="flex items-center gap-2.5">
        <span className="text-base" aria-hidden="true">
          {hudIcon(hud.kind)}
        </span>
        <span className="type-body" style={{ color: "var(--text-primary)" }}>
          {hud.label}
        </span>
      </div>

      {hud.value_pct !== null ? (
        <div
          className="h-2 w-28 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--surface-button)" }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: hud.kind === "mute" ? "var(--accent-red)" : "var(--text-primary)",
            }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={getMotionTransition("progressSpring", prefersReducedMotion)}
          />
        </div>
      ) : (
        <span
          className="type-caption rounded-full px-2.5 py-0.5 font-semibold"
          style={{
            backgroundColor: hud.active ? "var(--accent-blue)" : "var(--surface-button)",
            color: "var(--text-primary)",
          }}
        >
          {hud.active ? "ON" : "OFF"}
        </span>
      )}
    </div>
  );
}

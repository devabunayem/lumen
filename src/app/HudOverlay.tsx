import { motion, useReducedMotion } from "motion/react";
import {
  BatteryIcon,
  BoltIcon,
  CapsIcon,
  SunIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "../design/icons";
import { getMotionTransition } from "../design/motion";
import type { HudEvent } from "../lib/ipc";

export interface HudOverlayProps {
  hud: HudEvent;
}

function renderHudIcon(kind: string) {
  switch (kind) {
    case "volume":
      return <VolumeOnIcon size={15} />;
    case "mute":
      return <VolumeOffIcon size={15} />;
    case "caps_lock":
      return <CapsIcon size={15} />;
    case "battery":
      return <BatteryIcon size={15} />;
    case "brightness":
      return <SunIcon size={15} />;
    default:
      return <BoltIcon size={15} />;
  }
}

export function HudOverlay({ hud }: HudOverlayProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const pct = hud.value_pct ?? (hud.active ? 100 : 0);

  return (
    <div className="flex h-full w-full items-center justify-between gap-3 px-4">
      <div className="flex items-center gap-2.5">
        <span style={{ color: "var(--text-secondary)" }}>{renderHudIcon(hud.kind)}</span>
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
          className="type-caption rounded-full px-2.5 py-0.5 font-medium"
          style={{
            backgroundColor: hud.active ? "var(--accent-blue)" : "var(--surface-button)",
            color: "var(--text-primary)",
          }}
        >
          {hud.active ? "On" : "Off"}
        </span>
      )}
    </div>
  );
}

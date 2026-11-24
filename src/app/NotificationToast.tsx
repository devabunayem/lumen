import { motion, useReducedMotion } from "motion/react";
import { getMotionTransition } from "../design/motion";
import type { NotificationPopup } from "../lib/ipc";

export interface NotificationToastProps {
  notification: NotificationPopup;
  onDismiss: () => void;
}

/**
 * Privacy-first notification pill popup with elastic swipe-to-dismiss (FR-NT-1, Section 3.6).
 */
export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      drag={prefersReducedMotion ? false : "x"}
      dragConstraints={{ left: -120, right: 120 }}
      dragElastic={0.45}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 55) {
          onDismiss();
        }
      }}
      onClick={onDismiss}
      transition={getMotionTransition("collapse", prefersReducedMotion)}
      className="flex h-full w-full cursor-pointer items-center justify-between gap-2.5 px-4"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold"
        style={{
          backgroundColor: "var(--surface-button)",
          color: "var(--accent-blue)",
        }}
      >
        {notification.app_name.slice(0, 1).toUpperCase() || "N"}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="type-caption font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {notification.title}
        </div>
        <div className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
          {notification.body}
        </div>
      </div>

      <span className="type-caption shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {notification.app_name}
      </span>
    </motion.div>
  );
}

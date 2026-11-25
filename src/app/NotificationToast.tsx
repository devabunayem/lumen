import { motion, useReducedMotion } from "motion/react";
import { BellIcon, CalendarIcon, MusicNoteIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import type { NotificationPopup } from "../lib/ipc";

export interface NotificationToastProps {
  notification: NotificationPopup;
  onDismiss: () => void;
}

interface AppIconStyle {
  accent: string;
  render: () => React.ReactNode;
}

function resolveAppIcon(appName: string): AppIconStyle {
  const name = appName.toLowerCase();

  if (
    name.includes("whatsapp") ||
    name.includes("telegram") ||
    name.includes("discord") ||
    name.includes("slack") ||
    name.includes("teams") ||
    name.includes("messenger") ||
    name.includes("signal") ||
    name.includes("message")
  ) {
    const accent =
      name.includes("whatsapp") || name.includes("signal")
        ? "var(--accent-green)"
        : name.includes("discord") || name.includes("teams")
          ? "var(--accent-purple)"
          : "var(--accent-cyan)";
    return {
      accent,
      render: () => (
        <svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    };
  }

  if (
    name.includes("mail") ||
    name.includes("outlook") ||
    name.includes("gmail") ||
    name.includes("thunderbird")
  ) {
    return {
      accent: "var(--accent-blue)",
      render: () => (
        <svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      ),
    };
  }

  if (
    name.includes("chrome") ||
    name.includes("edge") ||
    name.includes("firefox") ||
    name.includes("brave") ||
    name.includes("browser")
  ) {
    return {
      accent: "var(--accent-cyan)",
      render: () => (
        <svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    };
  }

  if (name.includes("spotify") || name.includes("music") || name.includes("youtube")) {
    return {
      accent: "var(--accent-red)",
      render: () => <MusicNoteIcon size={15} />,
    };
  }

  if (name.includes("calendar") || name.includes("meet") || name.includes("zoom")) {
    return {
      accent: "var(--accent-orange)",
      render: () => <CalendarIcon size={15} />,
    };
  }

  if (name.includes("lumen") || name.includes("system") || name.includes("windows")) {
    return {
      accent: "var(--accent-blue)",
      render: () => <BellIcon size={15} />,
    };
  }

  return {
    accent: "var(--accent-blue)",
    render: () => (
      <span className="text-xs font-bold leading-none">
        {appName.slice(0, 1).toUpperCase() || "N"}
      </span>
    ),
  };
}

/**
 * Privacy-first notification pill popup with app icon badge & elastic swipe-to-dismiss (FR-NT-1).
 */
export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const iconStyle = resolveAppIcon(notification.app_name);

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
        data-testid="notification-app-icon"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "var(--surface-button)",
          border: "1px solid var(--hairline-top)",
          color: iconStyle.accent,
        }}
      >
        {iconStyle.render()}
        {notification.body.includes("••••") && (
          <span
            aria-label="Protected preview"
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: "var(--accent-orange)",
              border: "1.5px solid var(--surface)",
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="type-caption truncate font-semibold"
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

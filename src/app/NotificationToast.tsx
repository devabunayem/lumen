import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { BellIcon, CalendarIcon, MusicNoteIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import type { NotificationPopup } from "../lib/ipc";

export interface NotificationToastProps {
  notification: NotificationPopup;
  language?: "en" | "bn";
  expanded?: boolean;
  onToggleExpand?: (next: boolean) => void;
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
export function NotificationToast({
  notification,
  language = "en",
  expanded = false,
  onToggleExpand,
  onDismiss,
}: NotificationToastProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [failedId, setFailedId] = useState<number | null>(null);
  const iconStyle = resolveAppIcon(notification.app_name);
  const showRealLogo = Boolean(notification.app_icon_data_url) && failedId !== notification.id;
  const isBn = language === "bn";
  const isLongPreview =
    notification.body.length > 150 ||
    notification.title.length > 75 ||
    notification.body.split("\n").length > 3;

  return (
    <motion.div
      drag={prefersReducedMotion || expanded ? false : "x"}
      dragConstraints={{ left: -120, right: 120 }}
      dragElastic={0.45}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 55) {
          onDismiss();
        }
      }}
      onClick={() => {
        if (!expanded) {
          onDismiss();
        }
      }}
      transition={getMotionTransition("collapse", prefersReducedMotion)}
      className={`flex h-full w-full items-start gap-3 px-4 py-3 ${expanded ? "" : "cursor-pointer"}`}
    >
      <div
        data-testid="notification-app-icon"
        className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{
          backgroundColor: showRealLogo ? "rgba(255,255,255,0.06)" : "var(--surface-button)",
          border: "1px solid var(--hairline-top)",
          color: iconStyle.accent,
        }}
      >
        {showRealLogo && notification.app_icon_data_url ? (
          <img
            src={notification.app_icon_data_url}
            alt={notification.app_name}
            onError={() => setFailedId(notification.id)}
            className="h-6 w-6 rounded-md object-contain"
          />
        ) : (
          iconStyle.render()
        )}
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`text-[13px] font-semibold leading-snug break-words ${
              !expanded && isLongPreview ? "line-clamp-2" : ""
            }`}
            style={{ color: "var(--text-primary)" }}
          >
            {notification.title}
          </div>
          <span
            className="type-caption shrink-0 pt-0.5 font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            {notification.app_name}
          </span>
        </div>

        {notification.body && (
          <div
            data-testid="notification-body"
            className={`mt-1 text-[12px] leading-[1.38] whitespace-pre-wrap break-words ${
              expanded
                ? "max-h-[170px] overflow-y-auto pr-1"
                : isLongPreview
                  ? "line-clamp-3 overflow-hidden"
                  : ""
            }`}
            style={{ color: "var(--text-secondary)" }}
          >
            {notification.body}
          </div>
        )}

        {isLongPreview && (
          <div className="mt-1.5 flex items-center justify-end gap-2">
            {expanded && (
              <button
                type="button"
                data-testid="notification-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: "var(--surface-button)",
                  color: "var(--text-secondary)",
                }}
              >
                {isBn ? "বন্ধ" : "Dismiss"}
              </button>
            )}
            <button
              type="button"
              data-testid="notification-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.(!expanded);
              }}
              className="cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "rgba(10, 132, 255, 0.18)",
                color: "var(--accent-blue)",
              }}
            >
              {expanded ? (isBn ? "সংক্ষিপ্ত" : "Show less") : isBn ? "আরও দেখুন" : "More"}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

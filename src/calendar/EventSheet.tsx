import { useEffect } from "react";
import { motion } from "motion/react";
import { CalendarIcon, CloseIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import { COLOR_TOKENS } from "../design/tokens";
import { formatDigits } from "../i18n/digits";
import type { CalendarHubEvent } from "../lib/ipc";

export interface EventSheetProps {
  event: CalendarHubEvent;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  onJoin?: (url: string) => void;
  onOpenCalendar?: (ev: CalendarHubEvent) => void;
  onClose: () => void;
}

export function EventSheet({
  event,
  language,
  banglaDigits,
  reduceMotion,
  onJoin,
  onOpenCalendar,
  onClose,
}: EventSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const startDt = new Date(event.start);
  const endDt = new Date(event.end);
  const timeRange = !Number.isNaN(startDt.getTime())
    ? formatDigits(
        `${startDt.toLocaleDateString(language === "bn" ? "bn-BD" : "en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })} · ${startDt.toLocaleTimeString(language === "bn" ? "bn-BD" : "en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}${
          !Number.isNaN(endDt.getTime())
            ? ` – ${endDt.toLocaleTimeString(language === "bn" ? "bn-BD" : "en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}`
            : ""
        }`,
        banglaDigits,
      )
    : event.start;

  return (
    <motion.div
      data-testid="cal-event-sheet"
      role="dialog"
      aria-label={event.title}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      transition={getMotionTransition("snappy", reduceMotion)}
      className="cal-glass-card flex h-[258px] w-[256px] flex-col justify-between p-[12px]"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="mt-1 h-[24px] w-[3px] shrink-0 rounded-full"
              style={{ backgroundColor: event.color || COLOR_TOKENS.calEvent }}
            />
            <div className="min-w-0">
              <div
                className="flex items-center gap-1 text-[10px]"
                style={{ color: COLOR_TOKENS.textSecondary }}
              >
                <CalendarIcon size={10} />
                <span>
                  {event.sourceId === "local"
                    ? language === "bn"
                      ? "লোকাল"
                      : "Local"
                    : event.sourceId}
                </span>
              </div>
              <h3
                className="mt-0.5 text-[13.5px] font-semibold leading-snug"
                style={{ color: COLOR_TOKENS.textPrimary }}
              >
                {event.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            data-testid="cal-event-sheet-close"
            aria-label="Close"
            onClick={onClose}
            className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              color: COLOR_TOKENS.textSecondary,
            }}
          >
            <CloseIcon size={11} />
          </button>
        </div>

        <div className="mt-3 space-y-2 text-[11px]" style={{ color: COLOR_TOKENS.textSecondary }}>
          <div className="tabular-nums text-white/90">{timeRange}</div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <span>{event.location}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {event.meetingUrl && (
          <button
            type="button"
            data-testid="cal-event-sheet-join"
            onClick={() => onJoin?.(event.meetingUrl!)}
            className="flex h-[28px] flex-1 cursor-pointer items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: COLOR_TOKENS.calCtaBg,
              color: COLOR_TOKENS.calCtaText,
            }}
          >
            {language === "bn" ? "মিটিংয়ে জয়েন" : "Join meeting"}
          </button>
        )}
        <button
          type="button"
          data-testid="cal-event-sheet-open"
          onClick={() => onOpenCalendar?.(event)}
          className="flex h-[28px] flex-1 cursor-pointer items-center justify-center rounded-full text-[11px] font-medium"
          style={{
            backgroundColor: COLOR_TOKENS.calPillBg,
            border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
            color: COLOR_TOKENS.textPrimary,
          }}
        >
          {language === "bn" ? "ক্যালেন্ডারে খুলুন" : "Open in calendar"}
        </button>
      </div>
    </motion.div>
  );
}

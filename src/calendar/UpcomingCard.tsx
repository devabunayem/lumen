import { COLOR_TOKENS } from "../design/tokens";
import { DigitRoll } from "../home/components/DigitRoll";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { CalendarHubEvent } from "../lib/ipc";

export interface UpcomingCardProps {
  events: CalendarHubEvent[];
  nowDate: Date;
  isDayFiltered: boolean;
  hasSyncedCalendar: boolean;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  onJoinMeeting?: (url: string) => void;
  onSelectEvent?: (event: CalendarHubEvent) => void;
}

function formatEventTimeShort(
  startIso: string,
  nowDate: Date,
  tomorrowPrefix: string,
  language: "en" | "bn",
  banglaDigits: boolean,
): string {
  const dt = new Date(startIso);
  if (Number.isNaN(dt.getTime())) {
    return formatDigits(startIso.slice(11, 16), banglaDigits);
  }
  const isTomorrow =
    dt.getDate() !== nowDate.getDate() ||
    dt.getMonth() !== nowDate.getMonth() ||
    dt.getFullYear() !== nowDate.getFullYear();
  const timeStr = dt.toLocaleTimeString(language === "bn" ? "bn-BD" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: !isTomorrow,
  });
  return formatDigits(isTomorrow ? `${tomorrowPrefix} ${timeStr}` : timeStr, banglaDigits);
}

function formatHeroCountdown(
  startIso: string,
  nowDate: Date,
  language: "en" | "bn",
  banglaDigits: boolean,
): string {
  const dt = new Date(startIso);
  if (Number.isNaN(dt.getTime())) {
    return formatDigits("12 min", banglaDigits);
  }
  const diffMin = Math.max(1, Math.round((dt.getTime() - nowDate.getTime()) / 60000));
  if (diffMin < 60) {
    return formatDigits(language === "bn" ? `${diffMin} মি.` : `${diffMin} min`, banglaDigits);
  }
  const hrs = Math.floor(diffMin / 60);
  const rem = diffMin % 60;
  return formatDigits(rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`, banglaDigits);
}

export function UpcomingCard({
  events,
  nowDate,
  isDayFiltered,
  hasSyncedCalendar,
  language,
  banglaDigits,
  reduceMotion,
  onJoinMeeting,
  onSelectEvent,
}: UpcomingCardProps) {
  const msg = getMessages(language);
  const hero = events[0] ?? null;
  const secondary = events.slice(1, 3);

  return (
    <section
      data-testid="cal-upcoming-card"
      className="cal-glass-card flex h-[149px] w-[200px] flex-col justify-between px-[14px] py-[12px]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="m-0 text-[13px] font-semibold tracking-tight"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {isDayFiltered ? msg.calendarHub.eventsTitle : msg.calendarHub.upcomingTitle}
        </h3>

        <span className="truncate text-[10.5px]" style={{ color: COLOR_TOKENS.textSecondary }}>
          {msg.calendarHub.fromCalendar}
        </span>
      </div>

      {!hero ? (
        <div
          data-testid="cal-upcoming-empty"
          className="flex flex-1 flex-col items-center justify-center gap-1 text-center"
        >
          <span className="text-[11.5px] font-medium" style={{ color: COLOR_TOKENS.textSecondary }}>
            {msg.calendarHub.emptyEvents}
          </span>
          {!hasSyncedCalendar && (
            <span
              className="text-[10px] leading-tight"
              style={{ color: COLOR_TOKENS.textTertiary }}
            >
              {msg.calendarHub.emptyLocalHint}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1.5 flex flex-1 flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSelectEvent?.(hero)}
              className="flex min-w-0 flex-1 cursor-pointer items-stretch gap-2 border-0 bg-transparent p-0 text-left"
            >
              <span
                className="w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: hero.color || COLOR_TOKENS.calEvent }}
              />
              <div className="flex min-w-0 flex-col justify-center">
                <span
                  className="truncate text-[11.5px] font-semibold"
                  style={{ color: COLOR_TOKENS.textPrimary }}
                >
                  {hero.title}
                </span>
                <div
                  className="text-[20px] font-semibold leading-tight tracking-tight tabular-nums"
                  style={{ color: COLOR_TOKENS.textPrimary }}
                >
                  <DigitRoll
                    value={formatHeroCountdown(hero.start, nowDate, language, banglaDigits)}
                    reduceMotion={reduceMotion}
                  />
                </div>
              </div>
            </button>

            {hero.meetingUrl && (
              <button
                type="button"
                data-testid="cal-join-btn"
                onClick={() => onJoinMeeting?.(hero.meetingUrl!)}
                className="flex h-[24px] shrink-0 cursor-pointer items-center rounded-full px-3 text-[11px] font-semibold transition-transform active:scale-95"
                style={{
                  backgroundColor: COLOR_TOKENS.calCtaBg,
                  color: COLOR_TOKENS.calCtaText,
                }}
              >
                {msg.calendarHub.join}
              </button>
            )}
          </div>

          {secondary.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-[3px] p-0">
              {secondary.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent?.(ev)}
                    className="flex w-full cursor-pointer items-center justify-between gap-1.5 border-0 bg-transparent p-0 text-left text-[11px]"
                  >
                    <span
                      className="truncate font-medium"
                      style={{ color: COLOR_TOKENS.textSecondary }}
                    >
                      {ev.title}
                    </span>
                    <span
                      className="shrink-0 text-[10.5px] tabular-nums"
                      style={{ color: COLOR_TOKENS.textSecondary }}
                    >
                      {formatEventTimeShort(
                        ev.start,
                        nowDate,
                        msg.calendarHub.tomorrowPrefix,
                        language,
                        banglaDigits,
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

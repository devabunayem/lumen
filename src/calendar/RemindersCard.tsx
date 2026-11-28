import { useState } from "react";
import { BellIcon, CheckIcon, CrescentIcon, PlusIcon, RepeatIcon } from "../design/icons";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { CalendarReminder, ParsedQuickAdd } from "../lib/ipc";
import { QuickAdd } from "./QuickAdd";

export interface RemindersCardProps {
  reminders: CalendarReminder[];
  nowDate: Date;
  selectedDateKey: string;
  quickAddOpen?: boolean;
  initialShowMissed?: boolean;
  language: "en" | "bn";
  banglaDigits: boolean;
  onOpenQuickAdd?: () => void;
  onCloseQuickAdd?: () => void;
  onCreateReminder?: (parsed: ParsedQuickAdd) => Promise<void> | void;
  onCompleteReminder?: (id: number) => void;
  onDismissMissed?: () => void;
}

function formatReminderSubtext(
  rem: CalendarReminder,
  language: "en" | "bn",
  banglaDigits: boolean,
): string {
  const msg = getMessages(language);
  if (rem.prayerAnchor) {
    const tmpl =
      rem.prayerAnchor.relation === "after"
        ? msg.calendarHub.afterPrayer
        : msg.calendarHub.beforePrayer;
    return formatDigits(
      tmpl
        .replace("{{min}}", String(rem.prayerAnchor.offsetMin))
        .replace("{{prayer}}", rem.prayerAnchor.prayer),
      banglaDigits,
    );
  }
  if (rem.repeatRule) {
    return formatDigits(rem.repeatRule, banglaDigits);
  }
  if (rem.at) {
    const dt = new Date(rem.at);
    if (!Number.isNaN(dt.getTime())) {
      const t = dt.toLocaleTimeString(language === "bn" ? "bn-BD" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return formatDigits(`${t} · ${msg.calendarHub.once}`, banglaDigits);
    }
  }
  return msg.calendarHub.once;
}

export function RemindersCard({
  reminders,
  nowDate,
  selectedDateKey,
  quickAddOpen = false,
  initialShowMissed = false,
  language,
  banglaDigits,
  onOpenQuickAdd,
  onCloseQuickAdd,
  onCreateReminder,
  onCompleteReminder,
  onDismissMissed,
}: RemindersCardProps) {
  const msg = getMessages(language);
  const [showMissedDrawer, setShowMissedDrawer] = useState(initialShowMissed);
  const missedList = reminders.filter((r) => r.missed && r.active);
  const visible = reminders.filter((r) => r.active).slice(0, quickAddOpen ? 2 : 3);

  return (
    <section
      data-testid="cal-reminders-card"
      className="cal-glass-card relative flex h-[125px] w-[170px] flex-col px-[11px] py-[8px]"
    >
      <div className="flex items-center justify-between gap-1">
        <h3
          className="m-0 text-[12px] font-semibold tracking-tight"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {msg.calendarHub.remindersTitle}
        </h3>

        <div className="flex items-center gap-1">
          {missedList.length > 0 && (
            <button
              type="button"
              data-testid="cal-missed-pill"
              onClick={() => setShowMissedDrawer((v) => !v)}
              className="flex h-[18px] cursor-pointer items-center rounded-full px-1.5 text-[9.5px] font-semibold"
              style={{
                backgroundColor: COLOR_TOKENS.calSocialBg,
                border: `1px solid ${COLOR_TOKENS.calSocialBorder}`,
                color: COLOR_TOKENS.calDeadline,
              }}
            >
              {formatDigits(
                language === "bn" ? `${missedList.length} মিসড` : `${missedList.length} missed`,
                banglaDigits,
              )}
            </button>
          )}

          <button
            type="button"
            data-testid="cal-reminders-add-btn"
            aria-label={msg.calendarHub.addReminder}
            onClick={onOpenQuickAdd}
            className="-m-1 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
          >
            <span
              className="flex h-[20px] w-[20px] items-center justify-center rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              <PlusIcon size={10} />
            </span>
          </button>
        </div>
      </div>

      {showMissedDrawer && missedList.length > 0 ? (
        <div data-testid="cal-missed-drawer" className="mt-1 flex flex-1 flex-col justify-between">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {missedList.slice(0, 2).map((rem) => (
              <li key={rem.id} className="flex items-center justify-between gap-1.5 text-[10px]">
                <span className="truncate font-medium" style={{ color: COLOR_TOKENS.calDeadline }}>
                  {rem.title}
                </span>
                <button
                  type="button"
                  onClick={() => onCompleteReminder?.(rem.id)}
                  className="flex h-[18px] shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 text-[9.5px] font-medium"
                  style={{
                    backgroundColor: COLOR_TOKENS.calPillBg,
                    color: COLOR_TOKENS.calEvent,
                  }}
                >
                  <CheckIcon size={8} />
                  <span>{language === "bn" ? "হয়েছে" : "Done"}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="cal-dismiss-missed-btn"
            onClick={() => {
              onDismissMissed?.();
              setShowMissedDrawer(false);
            }}
            className="w-full cursor-pointer rounded-full py-0.5 text-[9.5px] font-medium"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              color: COLOR_TOKENS.textSecondary,
            }}
          >
            {language === "bn" ? "সব মুছুন" : "Dismiss missed"}
          </button>
        </div>
      ) : (
        <>
          {quickAddOpen && (
            <QuickAdd
              mode="reminder"
              nowDate={nowDate}
              selectedDateKey={selectedDateKey}
              language={language}
              placeholder={
                language === "bn"
                  ? "রিমাইন্ডার (যেমন: 10m before Maghrib)"
                  : "Reminder (e.g. Call 5pm)"
              }
              onSave={async (parsed) => {
                await onCreateReminder?.(parsed);
                onCloseQuickAdd?.();
              }}
              onCancel={() => onCloseQuickAdd?.()}
            />
          )}

          {visible.length === 0 && !quickAddOpen ? (
            <div
              data-testid="cal-reminders-empty"
              className="flex flex-1 items-center justify-center text-center text-[10.5px]"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {msg.calendarHub.emptyReminders}
            </div>
          ) : (
            <ul className="mt-1 flex list-none flex-col gap-[4px] p-0">
              {visible.map((rem) => {
                const isPrayer = rem.kind === "prayer";
                const isRecurring =
                  rem.kind === "daily" || rem.kind === "weekly" || rem.kind === "monthly";

                return (
                  <li key={rem.id} className="flex items-start gap-1.5">
                    <span
                      className="mt-[1px] flex h-[14px] w-[14px] shrink-0 items-center justify-center"
                      style={{
                        color: isPrayer ? COLOR_TOKENS.calPrayer : COLOR_TOKENS.calReminder,
                      }}
                    >
                      {isPrayer ? (
                        <CrescentIcon size={11} />
                      ) : isRecurring ? (
                        <RepeatIcon size={11} />
                      ) : (
                        <BellIcon size={11} />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col leading-[1.15]">
                      <span
                        className="truncate text-[10.5px] font-semibold"
                        style={{
                          color: rem.missed ? COLOR_TOKENS.calDeadline : COLOR_TOKENS.textPrimary,
                        }}
                      >
                        {rem.title}
                      </span>
                      <span
                        className="truncate text-[9px] font-normal"
                        style={{ color: COLOR_TOKENS.textSecondary }}
                      >
                        {formatReminderSubtext(rem, language, banglaDigits)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

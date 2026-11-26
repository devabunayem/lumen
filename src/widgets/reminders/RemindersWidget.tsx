import { useState, type FormEvent } from "react";
import { BellIcon } from "../../design/icons";
import { requestKeyboardFocus, type ReminderItem } from "../../lib/ipc";

export interface RemindersWidgetProps {
  reminders: ReminderItem[];
  defaultLeadMinutes: number;
  snoozeMinutes: number;
  language: "en" | "bn";
  onAdd: (title: string, targetAtIso: string, leadMinutes: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onMarkDone: (id: number) => Promise<void>;
  onInputFocusChange?: (focused: boolean) => void;
}

const LEAD_PRESETS = [0, 5, 10, 15, 30] as const;

function defaultTimeValue(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatReminderTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) {
    return iso;
  }
  const d = new Date(ts);
  const h24 = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins} ${suffix}`;
}

export function RemindersWidget({
  reminders,
  defaultLeadMinutes,
  snoozeMinutes,
  language,
  onAdd,
  onDelete,
  onMarkDone,
  onInputFocusChange,
}: RemindersWidgetProps) {
  const isBn = language === "bn";
  const [adding, setAdding] = useState(reminders.length === 0);
  const [title, setTitle] = useState("");
  const [dayMode, setDayMode] = useState<"today" | "tomorrow">("today");
  const [timeStr, setTimeStr] = useState(defaultTimeValue);
  const [leadMinutes, setLeadMinutes] = useState<number>(defaultLeadMinutes);

  const activeReminders = reminders.filter((r) => !r.completed);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    const base = new Date();
    if (dayMode === "tomorrow") {
      base.setDate(base.getDate() + 1);
    }
    const [hh, mm] = timeStr.split(":").map((n) => Number.parseInt(n, 10) || 0);
    const target = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0);
    await onAdd(trimmed, target.toISOString(), leadMinutes);
    setTitle("");
    setAdding(false);
    onInputFocusChange?.(false);
    void requestKeyboardFocus(false);
  };

  return (
    <div
      data-testid="reminders-widget"
      className="flex h-full w-full flex-col justify-between gap-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
            {activeReminders.length > 0
              ? `${activeReminders.length} ${isBn ? "টি সক্রিয় রিমাইন্ডার" : activeReminders.length === 1 ? "active reminder" : "active reminders"}`
              : isBn
                ? "কোনো রিমাইন্ডার নেই"
                : "No scheduled reminders"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            · {isBn ? `স্নুজ ${snoozeMinutes}মি` : `Snooze ${snoozeMinutes}m`}
          </span>
        </div>
        <button
          type="button"
          data-testid="reminder-toggle-add"
          onClick={() => setAdding((v) => !v)}
          className="type-caption cursor-pointer rounded-full border-0 px-2.5 py-1 font-semibold"
          style={{
            backgroundColor: "var(--surface-button)",
            color: "var(--accent-red)",
          }}
        >
          {adding ? (isBn ? "তালিকা" : "List") : isBn ? "+ রিমাইন্ডার" : "+ Reminder"}
        </button>
      </div>

      {adding ? (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-1 flex-col justify-between gap-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              aria-label={isBn ? "রিমাইন্ডার শিরোনাম" : "Reminder title"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => {
                onInputFocusChange?.(true);
                void requestKeyboardFocus(true);
              }}
              onBlur={() => {
                onInputFocusChange?.(false);
                void requestKeyboardFocus(false);
              }}
              placeholder={isBn ? "যেমন: রাত ৮টায় মিটিং..." : "e.g., Night 8 PM client meeting..."}
              className="type-caption min-w-0 flex-1 rounded-full border-0 px-3 py-1.5 outline-none"
              style={{
                backgroundColor: "var(--surface-raised)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={() => setDayMode((d) => (d === "today" ? "tomorrow" : "today"))}
              className="type-caption cursor-pointer rounded-full border-0 px-2.5 py-1.5 font-medium"
              style={{
                backgroundColor: "var(--surface-raised)",
                color: "var(--text-secondary)",
              }}
            >
              {dayMode === "today" ? (isBn ? "আজ" : "Today") : isBn ? "আগামীকাল" : "Tomorrow"}
            </button>
            <input
              type="time"
              aria-label={isBn ? "কাজের সময়" : "Target time"}
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              onFocus={() => {
                onInputFocusChange?.(true);
                void requestKeyboardFocus(true);
              }}
              onBlur={() => {
                onInputFocusChange?.(false);
                void requestKeyboardFocus(false);
              }}
              className="type-caption rounded-full border-0 px-2.5 py-1.5 tabular-nums outline-none"
              style={{
                backgroundColor: "var(--surface-raised)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {isBn ? "আগে জানাবে:" : "Remind:"}
              </span>
              {LEAD_PRESETS.map((mins) => {
                const selected = leadMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setLeadMinutes(mins)}
                    className="cursor-pointer rounded-full border-0 px-2 py-0.5 text-[11px] font-medium transition-colors"
                    style={{
                      backgroundColor: selected ? "var(--accent-orange)" : "var(--surface-raised)",
                      color: selected ? "#000000" : "var(--text-secondary)",
                    }}
                  >
                    {mins === 0 ? (isBn ? "ঠিক সময়ে" : "At time") : `${mins}m`}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              data-testid="reminder-submit-btn"
              className="type-caption cursor-pointer rounded-full border-0 px-3.5 py-1 font-semibold"
              style={{
                backgroundColor: "var(--accent-red)",
                color: "#ffffff",
              }}
            >
              {isBn ? "সেট করুন" : "Set"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {activeReminders.length === 0 ? (
            <div
              className="flex flex-1 items-center justify-center rounded-xl text-xs"
              style={{
                backgroundColor: "var(--surface-raised)",
                color: "var(--text-secondary)",
              }}
            >
              {isBn
                ? "রিমাইন্ডার সেট করতে '+ রিমাইন্ডার' চাপুন"
                : "Click '+ Reminder' to schedule an alert with lead time & alarm"}
            </div>
          ) : (
            activeReminders.slice(0, 3).map((rem) => (
              <div
                key={rem.id}
                className="flex items-center justify-between px-3 py-1.5"
                style={{
                  backgroundColor: "var(--surface-raised)",
                  borderRadius: "var(--card-radius)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span style={{ color: "var(--accent-red)" }}>
                    <BellIcon size={12} />
                  </span>
                  <span
                    className="type-caption truncate font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {rem.title}
                  </span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    · {formatReminderTime(rem.target_at)}
                  </span>
                  {rem.snooze_until ? (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: "rgba(255, 159, 10, 0.16)",
                        color: "var(--accent-orange)",
                      }}
                    >
                      {isBn ? "স্নুজড" : `Snoozed ${formatReminderTime(rem.snooze_until)}`}
                    </span>
                  ) : rem.lead_minutes > 0 ? (
                    <span className="text-[10px]" style={{ color: "var(--accent-orange)" }}>
                      {rem.lead_minutes}m before
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onMarkDone(rem.id)}
                    className="cursor-pointer rounded border-0 bg-transparent text-[11px] font-medium hover:underline"
                    style={{ color: "var(--accent-green)" }}
                    title={isBn ? "সম্পন্ন" : "Mark done"}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(rem.id)}
                    className="cursor-pointer rounded border-0 bg-transparent text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label={`Delete ${rem.title}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

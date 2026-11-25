import { useEffect, useState } from "react";
import { CalendarIcon } from "../../design/icons";
import { calendarAdd, calendarDelete, type CalendarEvent, calendarList } from "../../lib/ipc";

export interface CalendarWidgetProps {
  language: "en" | "bn";
  onInputFocusChange?: (focused: boolean) => void;
}

function formatEventCountdown(startAt: string, nowMs: number, language: "en" | "bn"): string {
  const target = Date.parse(startAt);
  if (Number.isNaN(target)) {
    return startAt;
  }
  const diffMin = Math.round((target - nowMs) / 60_000);
  if (diffMin <= 0 && diffMin >= -30) {
    return language === "bn" ? "এখনই" : "Now";
  }
  if (diffMin < -30) {
    return language === "bn" ? "শেষ" : "Ended";
  }
  if (diffMin < 60) {
    return language === "bn" ? `${diffMin}মি পর` : `in ${diffMin}m`;
  }
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return language === "bn" ? `${hrs}ঘ ${mins}মি` : `in ${hrs}h ${mins}m`;
}

export function CalendarWidget({ language, onInputFocusChange }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [timeStr, setTimeStr] = useState("16:00");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isBn = language === "bn";

  useEffect(() => {
    void calendarList().then(setEvents);
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    const today = new Date();
    const [hh, mm] = timeStr.split(":").map((n) => Number.parseInt(n, 10) || 0);
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0);
    const iso = startDate.toISOString();
    const updated = await calendarAdd(trimmed, iso);
    if (updated.length > 0) {
      setEvents(updated);
    } else {
      setEvents((prev) => [
        ...prev,
        { id: Date.now(), title: trimmed, start_at: iso, created_at: new Date().toISOString() },
      ]);
    }
    setTitle("");
    setAdding(false);
    onInputFocusChange?.(false);
  };

  const handleDelete = async (id: number) => {
    const updated = await calendarDelete(id);
    if (updated.length > 0 || events.length === 1) {
      setEvents(updated.length > 0 ? updated : events.filter((ev) => ev.id !== id));
    }
  };

  return (
    <div
      data-testid="calendar-widget"
      className="flex h-full w-full flex-col justify-between gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
          {events.length > 0
            ? `${events.length} ${isBn ? "টি ইভেন্ট" : events.length === 1 ? "event" : "events"}`
            : isBn
              ? "আজ কোনো ইভেন্ট নেই"
              : "No upcoming events"}
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="type-caption cursor-pointer rounded-full border-0 px-2.5 py-1 font-semibold"
          style={{
            backgroundColor: "var(--surface-button)",
            color: "var(--accent-orange)",
          }}
        >
          {adding ? (isBn ? "বাতিল" : "Cancel") : isBn ? "+ ইভেন্ট" : "+ Event"}
        </button>
      </div>

      {adding ? (
        <form onSubmit={(e) => void handleAdd(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => onInputFocusChange?.(true)}
            onBlur={() => onInputFocusChange?.(false)}
            placeholder={isBn ? "মিটিং বা কাজের নাম..." : "Meeting or event title..."}
            className="type-caption min-w-0 flex-1 rounded-full border-0 px-3 py-1.5 outline-none"
            style={{
              backgroundColor: "var(--surface-raised)",
              color: "var(--text-primary)",
            }}
          />
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            onFocus={() => onInputFocusChange?.(true)}
            onBlur={() => onInputFocusChange?.(false)}
            className="type-caption rounded-full border-0 px-2.5 py-1.5 outline-none"
            style={{
              backgroundColor: "var(--surface-raised)",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            className="type-caption cursor-pointer rounded-full border-0 px-3 py-1.5 font-semibold"
            style={{
              backgroundColor: "var(--accent-orange)",
              color: "#000000",
            }}
          >
            {isBn ? "যোগ" : "Add"}
          </button>
        </form>
      ) : (
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {events.slice(0, 3).map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between px-3 py-1.5"
              style={{
                backgroundColor: "var(--surface-raised)",
                borderRadius: "var(--card-radius)",
                border: "1px solid var(--hairline)",
              }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span style={{ color: "var(--accent-orange)" }}>
                  <CalendarIcon size={13} />
                </span>
                <span className="type-caption truncate font-medium">{ev.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="type-caption tabular-nums font-semibold"
                  style={{ color: "var(--accent-orange)" }}
                >
                  {formatEventCountdown(ev.start_at, nowMs, language)}
                </span>
                <button
                  type="button"
                  aria-label="Delete event"
                  onClick={() => void handleDelete(ev.id)}
                  className="type-caption cursor-pointer border-0 bg-transparent p-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

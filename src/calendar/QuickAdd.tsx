import { useEffect, useState } from "react";
import { CloseIcon } from "../design/icons";
import { COLOR_TOKENS } from "../design/tokens";
import { calendarHubParseQuickAdd, isTauriRuntime, type ParsedQuickAdd } from "../lib/ipc";
import { parseQuickAddLocal } from "./quickAddParser";

export interface QuickAddProps {
  mode: "task" | "reminder";
  nowDate: Date;
  selectedDateKey: string;
  language: "en" | "bn";
  placeholder: string;
  onSave: (parsed: ParsedQuickAdd) => Promise<void> | void;
  onCancel: () => void;
}

export function QuickAdd({
  mode,
  nowDate,
  selectedDateKey,
  language,
  placeholder,
  onSave,
  onCancel,
}: QuickAddProps) {
  const [text, setText] = useState("");
  const localPreview = parseQuickAddLocal(text, nowDate, mode);
  const [rustParsed, setRustParsed] = useState<ParsedQuickAdd | null>(null);

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed || !isTauriRuntime()) {
      return;
    }
    let active = true;
    const t = window.setTimeout(() => {
      void calendarHubParseQuickAdd(trimmed, mode).then((res) => {
        if (active && res) setRustParsed(res);
      });
    }, 60);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [text, mode]);

  const parsed: ParsedQuickAdd = text.trim()
    ? isTauriRuntime() && rustParsed
      ? rustParsed
      : localPreview
    : localPreview;

  // Apply explicit day selection when parser fell back to "Today" default without explicit relative keyword
  const resolvedParsed: ParsedQuickAdd =
    parsed.dueDate === parseQuickAddLocal("", nowDate, mode).dueDate &&
    !/\b(today|ajke|aj|tomorrow|tmrw|kal)\b/i.test(text)
      ? {
          ...parsed,
          dueDate: selectedDateKey,
          at:
            parsed.at && parsed.reminderKind !== "prayer"
              ? `${selectedDateKey}${parsed.at.slice(10)}`
              : parsed.at,
        }
      : parsed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSave(resolvedParsed);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <form
      data-testid={`cal-quick-add-${mode}`}
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-1 flex flex-col gap-0.5"
    >
      <div
        className="flex h-[22px] items-center gap-1 rounded-md px-1.5"
        style={{
          backgroundColor: COLOR_TOKENS.calPillBg,
          border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
        }}
      >
        <input
          type="text"
          autoFocus
          data-testid={`cal-quick-add-input-${mode}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-white outline-none placeholder:text-white/40"
        />
        <button
          type="button"
          aria-label={language === "bn" ? "বাতিল" : "Cancel"}
          onClick={onCancel}
          className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-white/60 hover:text-white"
        >
          <CloseIcon size={10} />
        </button>
      </div>

      {text.trim().length > 0 && (
        <div className="flex items-center justify-between gap-1 text-[10px]">
          <span
            data-testid={`cal-quick-add-chip-${mode}`}
            className="truncate rounded-full px-2 py-0.5 font-medium"
            style={{
              backgroundColor:
                resolvedParsed.reminderKind === "prayer"
                  ? "rgba(47, 214, 184, 0.16)"
                  : resolvedParsed.isDeadline || resolvedParsed.importance === "urgent"
                    ? "rgba(255, 69, 58, 0.16)"
                    : COLOR_TOKENS.calPillBg,
              color:
                resolvedParsed.reminderKind === "prayer"
                  ? COLOR_TOKENS.calPrayer
                  : resolvedParsed.isDeadline || resolvedParsed.importance === "urgent"
                    ? COLOR_TOKENS.calDeadline
                    : COLOR_TOKENS.textSecondary,
            }}
          >
            {resolvedParsed.chipLabel}
          </span>
          <span style={{ color: COLOR_TOKENS.textTertiary }}>Enter ↵</span>
        </div>
      )}
    </form>
  );
}

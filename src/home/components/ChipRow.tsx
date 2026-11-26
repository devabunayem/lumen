import { useState } from "react";
import { ClipboardIcon, ClockLedgerIcon, PlayIcon } from "../../design/icons";
import { playUiSound } from "../../design/sounds";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages, type AppLanguage } from "../../i18n";
import { formatDigits } from "../../i18n/digits";
import type {
  ClipboardChipSnapshot,
  DevPulseSnapshot,
  PomodoroSnapshot,
  TimeLedgerState,
} from "../../lib/ipc";

export interface HomeChipsConfig {
  focus: boolean;
  ledger: boolean;
  clipboard: boolean;
  devPulse: boolean;
}

export interface ChipRowProps {
  pomodoro: PomodoroSnapshot;
  ledger: TimeLedgerState | null;
  clipboard: ClipboardChipSnapshot | null;
  devPulse: DevPulseSnapshot | null;
  chipsConfig: HomeChipsConfig;
  pagesCount: number;
  activePageIndex: number;
  language?: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  onToggleFocusTimer: () => void;
  onToggleLedger: () => void;
  onCopyClipboard: () => Promise<void>;
  onOpenPomodoro: () => void;
  onSelectPage: (idx: number) => void;
}

function formatHms(totalSecs: number, banglaDigits: boolean): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return formatDigits(
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    banglaDigits,
  );
}

function formatMmSs(totalSecs: number, banglaDigits: boolean): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return formatDigits(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, banglaDigits);
}

export function ChipRow({
  pomodoro,
  ledger,
  clipboard,
  devPulse,
  chipsConfig,
  pagesCount,
  activePageIndex,
  language = "en",
  banglaDigits,
  reduceMotion,
  onToggleFocusTimer,
  onToggleLedger,
  onCopyClipboard,
  onOpenPomodoro,
  onSelectPage,
}: ChipRowProps) {
  const msg = getMessages(language);
  const [copiedFlash, setCopiedFlash] = useState(false);

  const handleCopy = async () => {
    await onCopyClipboard();
    void playUiSound("task_done");
    setCopiedFlash(true);
    window.setTimeout(() => setCopiedFlash(false), 1200);
  };

  const chipInteractionClass = reduceMotion
    ? ""
    : "transition-transform duration-100 active:scale-95";
  const totalPages = Math.max(1, pagesCount);
  const dotIndices =
    totalPages <= 6
      ? Array.from({ length: totalPages }, (_, i) => i)
      : (() => {
          const maxDots = 5;
          const start = Math.min(
            Math.max(0, activePageIndex - 2),
            Math.max(0, totalPages - maxDots),
          );
          return Array.from({ length: maxDots }, (_, offset) => start + offset);
        })();

  return (
    <footer className="relative z-10 mt-[6px] flex h-[22px] w-full items-center justify-between gap-2 overflow-hidden">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap">
        {chipsConfig.focus && (
          <button
            type="button"
            data-testid="chip-focus"
            onClick={() => {
              void playUiSound(pomodoro.running ? "toggle_off" : "toggle_on");
              onToggleFocusTimer();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onOpenPomodoro();
            }}
            className={`home-glass-chip type-home-micro inline-flex h-[22px] shrink-0 items-center gap-1.5 px-2.5 font-medium ${chipInteractionClass}`}
            style={{ color: COLOR_TOKENS.accentOrange }}
          >
            <PlayIcon size={9} />
            <span className="tabular-nums">
              {msg.home.chips.focus}{" "}
              <span className="inline-block w-[36px] text-center tabular-nums">
                {formatMmSs(pomodoro.remaining_secs, banglaDigits)}
              </span>
            </span>
          </button>
        )}

        {chipsConfig.ledger && (
          <button
            type="button"
            data-testid="chip-ledger"
            onClick={() => {
              void playUiSound(ledger?.running ? "toggle_off" : "toggle_on");
              onToggleLedger();
            }}
            className={`home-glass-chip type-home-micro inline-flex h-[22px] shrink-0 items-center gap-1.5 px-2.5 text-white/90 ${chipInteractionClass}`}
          >
            <ClockLedgerIcon size={11} className="shrink-0 text-white/70" />
            <span className="flex items-center gap-1 tabular-nums">
              <span className="max-w-[74px] truncate">{ledger?.client_name ?? "Client A"}</span>
              <span className="inline-block w-[50px] text-right tabular-nums">
                {formatHms(ledger?.elapsed_secs ?? 5050, banglaDigits)}
              </span>
            </span>
          </button>
        )}

        {chipsConfig.clipboard && clipboard?.hasContent && (
          <button
            type="button"
            data-testid="chip-clipboard"
            onClick={() => void handleCopy()}
            className={`home-glass-chip type-home-micro inline-flex h-[22px] shrink-0 items-center gap-1.5 px-2.5 text-white/90 ${chipInteractionClass}`}
          >
            <ClipboardIcon size={11} className="shrink-0 text-white/70" />
            <span className="max-w-[110px] truncate tabular-nums">
              {copiedFlash ? msg.home.chips.copied : clipboard.displayText}
            </span>
          </button>
        )}

        {chipsConfig.devPulse && devPulse?.up && devPulse.primaryPort && (
          <span
            data-testid="chip-dev-pulse"
            className="home-glass-chip type-home-micro inline-flex h-[22px] shrink-0 items-center gap-1.5 px-2.5 text-white/90"
          >
            <span
              className="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
              style={{ background: COLOR_TOKENS.accentGreen }}
            />
            <span className="tabular-nums">
              localhost:{formatDigits(devPulse.primaryPort, banglaDigits)}
            </span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5" aria-label="Island pages">
        {dotIndices.map((idx) => {
          const isActive = idx === activePageIndex;
          return (
            <button
              key={idx}
              type="button"
              aria-label={`Page ${idx + 1}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectPage(idx)}
              className="flex h-[20px] shrink-0 items-center justify-center px-0.5"
            >
              <span
                className="block h-[5px] rounded-full transition-[width,background-color] duration-200"
                style={{
                  width: isActive ? 18 : 5,
                  background: isActive ? COLOR_TOKENS.accentBlue : COLOR_TOKENS.pageDotInactive,
                }}
              />
            </button>
          );
        })}
      </div>
    </footer>
  );
}

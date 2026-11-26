import { useState } from "react";
import { motion } from "motion/react";
import { ClipboardIcon, ClockLedgerIcon, PlayIcon } from "../../design/icons";
import { MOTION_PRESETS } from "../../design/motion";
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

  return (
    <footer className="relative z-10 mt-[10px] flex h-[26px] w-full items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
        {chipsConfig.focus && (
          <motion.button
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
            whileTap={
              reduceMotion ? undefined : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
            }
            className="home-glass-chip type-home-micro inline-flex h-[24px] shrink-0 items-center gap-1.5 px-2.5 font-medium"
            style={{ color: COLOR_TOKENS.accentOrange }}
          >
            <PlayIcon size={9} />
            <span className="tabular-nums">
              {msg.home.chips.focus} {formatMmSs(pomodoro.remaining_secs, banglaDigits)}
            </span>
          </motion.button>
        )}

        {chipsConfig.ledger && (
          <motion.button
            type="button"
            data-testid="chip-ledger"
            onClick={() => {
              void playUiSound(ledger?.running ? "toggle_off" : "toggle_on");
              onToggleLedger();
            }}
            whileTap={
              reduceMotion ? undefined : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
            }
            className="home-glass-chip type-home-micro inline-flex h-[24px] shrink-0 items-center gap-1.5 px-2.5 text-white/90"
          >
            <ClockLedgerIcon size={11} className="text-white/70" />
            <span className="tabular-nums">
              {ledger?.client_name ?? "Client A"}{" "}
              {formatHms(ledger?.elapsed_secs ?? 5050, banglaDigits)}
            </span>
          </motion.button>
        )}

        {chipsConfig.clipboard && clipboard?.hasContent && (
          <motion.button
            type="button"
            data-testid="chip-clipboard"
            onClick={() => void handleCopy()}
            whileTap={
              reduceMotion ? undefined : { scale: 0.96, transition: MOTION_PRESETS.pressFeedback }
            }
            className="home-glass-chip type-home-micro inline-flex h-[24px] shrink-0 items-center gap-1.5 px-2.5 text-white/90"
          >
            <ClipboardIcon size={11} className="text-white/70" />
            <span className="tabular-nums">
              {copiedFlash ? msg.home.chips.copied : clipboard.displayText}
            </span>
          </motion.button>
        )}

        {chipsConfig.devPulse && devPulse?.up && devPulse.primaryPort && (
          <span
            data-testid="chip-dev-pulse"
            className="home-glass-chip type-home-micro inline-flex h-[24px] shrink-0 items-center gap-1.5 px-2.5 text-white/90"
          >
            <span
              className="inline-block h-[6px] w-[6px] rounded-full"
              style={{ background: COLOR_TOKENS.accentGreen }}
            />
            <span className="tabular-nums">
              localhost:{formatDigits(devPulse.primaryPort, banglaDigits)}
            </span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5" aria-label="Island pages">
        {Array.from({ length: Math.max(1, pagesCount) }).map((_, idx) => {
          const isActive = idx === activePageIndex;
          return (
            <button
              key={idx}
              type="button"
              aria-label={`Page ${idx + 1}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelectPage(idx)}
              className="flex h-[20px] items-center justify-center px-0.5"
            >
              <span
                className="block h-[5px] rounded-full transition-all duration-200"
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

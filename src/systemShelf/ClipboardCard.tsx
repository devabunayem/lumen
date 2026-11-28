import { useState } from "react";
import {
  CheckIcon,
  ClipboardIcon,
  CloseIcon,
  LinkIcon,
  LockIcon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  ScanTextIcon,
  TrashIcon,
} from "../design/icons";
import { playUiSound } from "../design/sounds";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages, type AppLanguage } from "../i18n";
import { formatDigits, interpolateMsg } from "../i18n/digits";
import { CLIPBOARD_MAX_UNPINNED, type ClipboardHistoryItem } from "../lib/ipc";
import { ScrollOverflowList } from "./ScrollOverflowList";

export interface ClipboardCardProps {
  items: ClipboardHistoryItem[];
  capturePaused?: boolean;
  nowDate: Date;
  language: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  onCopyItem: (id: number) => Promise<void> | void;
  onTogglePin: (id: number) => Promise<void> | void;
  onDeleteItem: (id: number) => void;
  onClearHistory: () => void;
  onToggleCapturePaused?: () => void;
}

function formatRelativeAge(
  isoString: string,
  nowDate: Date,
  banglaDigits: boolean,
  nowLabel: string,
): string {
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) {
    return "";
  }
  const diffSec = Math.max(0, Math.floor((nowDate.getTime() - ts) / 1000));
  if (diffSec < 45) return nowLabel;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${formatDigits(mins, banglaDigits)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${formatDigits(hrs, banglaDigits)}h`;
  const days = Math.floor(hrs / 24);
  return `${formatDigits(days, banglaDigits)}d`;
}

export function ClipboardCard({
  items,
  capturePaused = false,
  nowDate,
  language,
  banglaDigits,
  reduceMotion,
  onCopyItem,
  onTogglePin,
  onDeleteItem,
  onClearHistory,
  onToggleCapturePaused,
}: ClipboardCardProps) {
  const msg = getMessages(language);
  const cMsg = msg.systemShelf.clipboard;
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const unpinnedCount = items.filter((item) => !item.pinned && !item.sensitive).length;
  const pinnedCount = items.filter((item) => item.pinned).length;

  const handleCopy = async (id: number) => {
    await onCopyItem(id);
    void playUiSound("task_done");
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 1200);
  };

  const handleTogglePin = async (id: number) => {
    try {
      await onTogglePin(id);
      setPinError(null);
    } catch {
      setPinError(cMsg.pinLimitReached);
      window.setTimeout(() => setPinError(null), 2600);
    }
  };

  return (
    <section
      data-testid="sys-clipboard-card"
      className="cal-glass-card flex h-[258px] w-[180px] flex-col gap-[6px] overflow-hidden p-[10px]"
    >
      {/* Header */}
      <div className="flex h-[20px] shrink-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="whitespace-nowrap text-[11.5px] font-semibold leading-none"
            style={{ color: COLOR_TOKENS.textPrimary }}
          >
            {cMsg.title}
          </span>
          <span
            data-testid="sys-clip-cap-badge"
            title={interpolateMsg(cMsg.capTooltip, {
              unpinned: formatDigits(unpinnedCount, banglaDigits),
              max: formatDigits(CLIPBOARD_MAX_UNPINNED, banglaDigits),
              pinned: formatDigits(pinnedCount, banglaDigits),
            })}
            className="rounded-full px-1.5 py-[2px] text-[9.5px] font-medium leading-none tabular-nums"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              color:
                unpinnedCount >= CLIPBOARD_MAX_UNPINNED - 3
                  ? COLOR_TOKENS.accentOrange
                  : COLOR_TOKENS.textSecondary,
            }}
          >
            {formatDigits(unpinnedCount, banglaDigits)}/
            {formatDigits(CLIPBOARD_MAX_UNPINNED, banglaDigits)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onToggleCapturePaused && (
            <button
              type="button"
              data-testid="sys-clipboard-pause-btn"
              aria-label={capturePaused ? cMsg.resumeCapture : cMsg.pauseCapture}
              title={capturePaused ? cMsg.resumeCapture : cMsg.pauseCapture}
              aria-pressed={capturePaused}
              onClick={onToggleCapturePaused}
              className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 transition-colors hover:bg-white/15"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                color: capturePaused ? COLOR_TOKENS.accentOrange : COLOR_TOKENS.textSecondary,
              }}
            >
              {capturePaused ? <PlayIcon size={9} /> : <PauseIcon size={9} />}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              data-testid="sys-clipboard-clear-btn"
              aria-label={cMsg.clear}
              title={cMsg.clear}
              onClick={onClearHistory}
              className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 transition-colors hover:bg-white/10"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                color: COLOR_TOKENS.textSecondary,
              }}
            >
              <TrashIcon size={10} />
            </button>
          )}
        </div>
      </div>

      {capturePaused && (
        <button
          type="button"
          data-testid="sys-clipboard-paused-banner"
          onClick={onToggleCapturePaused}
          className="flex h-[20px] shrink-0 cursor-pointer items-center justify-between rounded-[8px] px-2 text-[9.5px] font-medium"
          style={{
            backgroundColor: COLOR_TOKENS.sysSubcardBg,
            border: `1px solid ${COLOR_TOKENS.calSocialBorder}`,
            color: COLOR_TOKENS.accentOrange,
          }}
        >
          <span className="truncate">{cMsg.pausedBanner}</span>
          <PlayIcon size={9} />
        </button>
      )}

      {pinError && (
        <div
          data-testid="sys-clipboard-pin-limit-banner"
          role="status"
          className="flex h-[20px] shrink-0 items-center justify-center rounded-[8px] px-2 text-[9.5px] font-medium"
          style={{
            backgroundColor: COLOR_TOKENS.sysSubcardBg,
            border: `1px solid ${COLOR_TOKENS.calSocialBorder}`,
            color: COLOR_TOKENS.accentOrange,
          }}
        >
          <span className="truncate">{pinError}</span>
        </div>
      )}

      {/* History Rows */}
      <ScrollOverflowList
        itemCount={items.length}
        reduceMotion={reduceMotion}
        scrollLabel={cMsg.scrollMore}
        scrollBtnTestId="sys-clip-scroll-btn"
        emptyNode={
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            <span style={{ color: COLOR_TOKENS.textTertiary }}>
              <ClipboardIcon size={18} />
            </span>
            <span
              className="text-[10.5px] leading-snug"
              style={{ color: COLOR_TOKENS.textTertiary }}
            >
              {cMsg.emptyHint}
            </span>
          </div>
        }
      >
        {items.map((item) => {
          const isCopied = copiedId === item.id;
          const age = formatRelativeAge(item.copiedAt, nowDate, banglaDigits, cMsg.justNow);
          const secretMeta = item.expiresInSecs
            ? `${formatDigits(item.expiresInSecs, banglaDigits)}s`
            : age;

          return (
            <div
              key={item.id}
              data-testid={`sys-clip-item-${item.id}`}
              className={`group flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-[11px] px-2 py-1 ${
                reduceMotion ? "" : "transition-colors duration-100"
              } hover:bg-white/[0.08]`}
              style={{
                backgroundColor: COLOR_TOKENS.sysSubcardBg,
                border: item.sensitive
                  ? `1px solid ${COLOR_TOKENS.calSocialBorder}`
                  : item.pinned
                    ? `1px solid rgba(255, 159, 10, 0.3)`
                    : `1px solid ${COLOR_TOKENS.sysSubcardBorder}`,
              }}
            >
              <button
                type="button"
                onClick={() => void handleCopy(item.id)}
                title={item.sensitive ? cMsg.secretHint : item.preview}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-1.5 border-0 bg-transparent p-0 text-left"
              >
                {item.kind === "color" ? (
                  <span
                    aria-hidden="true"
                    className="mt-[2px] h-[16px] w-[16px] shrink-0 rounded-[5px] border border-white/25"
                    style={{ backgroundColor: item.preview }}
                  />
                ) : (
                  <span
                    className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px]"
                    style={{
                      backgroundColor: COLOR_TOKENS.calPillBg,
                      color: item.sensitive
                        ? COLOR_TOKENS.accentOrange
                        : item.kind === "link"
                          ? COLOR_TOKENS.accentCyan
                          : item.kind === "code"
                            ? COLOR_TOKENS.accentPurple
                            : COLOR_TOKENS.textSecondary,
                    }}
                  >
                    {item.sensitive ? (
                      <LockIcon size={10} />
                    ) : item.kind === "link" ? (
                      <LinkIcon size={10} />
                    ) : item.kind === "code" ? (
                      <ScanTextIcon size={10} />
                    ) : (
                      <ClipboardIcon size={10} />
                    )}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate font-medium leading-snug ${
                      item.sensitive || item.kind === "code"
                        ? "font-mono text-[10px]"
                        : "text-[10.5px]"
                    }`}
                    style={{ color: COLOR_TOKENS.textPrimary }}
                  >
                    {item.preview}
                  </div>
                  <div
                    className="flex items-center gap-1 text-[9px] leading-tight tabular-nums"
                    style={{
                      color: isCopied
                        ? COLOR_TOKENS.accentGreen
                        : item.sensitive
                          ? COLOR_TOKENS.accentOrange
                          : COLOR_TOKENS.textTertiary,
                    }}
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon size={9} />
                        <span>{msg.home.chips.copied}</span>
                      </>
                    ) : (
                      <>
                        <span>{item.sensitive ? cMsg.secretTag : item.kind}</span>
                        {(item.sensitive ? secretMeta : age) && (
                          <span>· {item.sensitive ? secretMeta : age}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </button>

              <div
                className={`shrink-0 items-center gap-0.5 ${
                  item.pinned ? "flex" : "hidden group-hover:flex group-focus-within:flex"
                }`}
              >
                {!item.sensitive && (
                  <button
                    type="button"
                    aria-label={item.pinned ? cMsg.unpin : cMsg.pin}
                    title={item.pinned ? cMsg.unpin : cMsg.pin}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleTogglePin(item.id);
                    }}
                    className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:bg-white/10"
                    style={{
                      color: item.pinned ? COLOR_TOKENS.accentOrange : COLOR_TOKENS.textSecondary,
                    }}
                  >
                    <PinIcon size={10} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={cMsg.deleteItem}
                  title={cMsg.deleteItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem(item.id);
                  }}
                  className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/55 hover:bg-white/10 hover:text-white"
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </ScrollOverflowList>
    </section>
  );
}

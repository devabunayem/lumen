import { PinIcon, SettingsIcon } from "../design/icons";
import { BASE_GEOMETRY, COLOR_TOKENS } from "../design/tokens";
import { getMessages, type AppLanguage } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { ClipboardHistoryItem, ShelfItem, SystemTelemetrySnapshot } from "../lib/ipc";
import { ClipboardCard } from "./ClipboardCard";
import { FileShelfCard } from "./FileShelfCard";
import { SystemMonitorCard } from "./SystemMonitorCard";

export interface SystemShelfPageProps {
  nowDate: Date;
  shelfItems: ShelfItem[];
  telemetry: SystemTelemetrySnapshot | null;
  telemetryLoading?: boolean;
  cpuHistory: number[];
  gpuHistory: number[];
  netDownHistory: number[];
  clipboardItems: ClipboardHistoryItem[];
  dragOverShelf?: boolean;
  isPinned?: boolean;
  language: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  glowEnabled?: boolean;
  onTogglePin?: () => void;
  onOpenSettings: () => void;
  onShelfAdd: (kind: string, pathOrText: string) => void;
  onShelfPickFiles: () => void;
  onShelfOpen: (target: string) => void;
  onShelfCopy?: (target: string) => void;
  onShelfRemove: (id: number) => void;
  onShelfClear: () => void;
  onCopyClip: (id: number) => Promise<void> | void;
  onToggleClipPin: (id: number) => void;
  onDeleteClip: (id: number) => void;
  onClearClipboard: () => void;
}

export function SystemShelfPage({
  nowDate,
  shelfItems,
  telemetry,
  telemetryLoading = false,
  cpuHistory,
  gpuHistory,
  netDownHistory,
  clipboardItems,
  dragOverShelf = false,
  isPinned = false,
  language,
  banglaDigits,
  reduceMotion,
  reduceTransparency,
  glowEnabled = true,
  onTogglePin,
  onOpenSettings,
  onShelfAdd,
  onShelfPickFiles,
  onShelfOpen,
  onShelfCopy,
  onShelfRemove,
  onShelfClear,
  onCopyClip,
  onToggleClipPin,
  onDeleteClip,
  onClearClipboard,
}: SystemShelfPageProps) {
  const msg = getMessages(language);
  const sMsg = msg.systemShelf;

  const highLoad =
    (telemetry?.cpuPercent ?? 0) >= 85 ||
    (telemetry?.gpuPercent !== null &&
      telemetry?.gpuPercent !== undefined &&
      telemetry.gpuPercent >= 90);

  return (
    <div
      data-testid="system-shelf-page"
      data-reduce-motion={reduceMotion ? "true" : "false"}
      data-reduce-transparency={reduceTransparency ? "true" : "false"}
      className="relative flex flex-col justify-between overflow-hidden px-[14px] pt-[12px] pb-[14px]"
      style={{
        width: `${BASE_GEOMETRY.systemShelfExpanded.width}px`,
        height: `${BASE_GEOMETRY.systemShelfExpanded.height}px`,
        backgroundColor: COLOR_TOKENS.surface,
      }}
    >
      {glowEnabled && !reduceTransparency && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -bottom-16 -left-14 h-[200px] w-[230px] rounded-full opacity-80 blur-3xl"
            style={{ backgroundColor: COLOR_TOKENS.sysGlowPurple }}
          />
          <div
            className="absolute -top-12 left-1/2 h-[120px] w-[260px] -translate-x-1/2 rounded-full opacity-85 blur-3xl"
            style={{
              backgroundColor: highLoad ? COLOR_TOKENS.sysGlowWarn : COLOR_TOKENS.sysGlowCyan,
            }}
          />
          <div
            className="absolute -right-12 -bottom-14 h-[190px] w-[220px] rounded-full opacity-85 blur-3xl"
            style={{ backgroundColor: COLOR_TOKENS.sysGlowGreen }}
          />
        </div>
      )}

      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <header className="grid h-[26px] w-full grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1
              className="m-0 truncate text-[13px] font-semibold tracking-tight"
              style={{ color: COLOR_TOKENS.textPrimary }}
            >
              {sMsg.title}
            </h1>
            <span
              className="truncate text-[10.5px] font-normal tabular-nums"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {formatDigits(shelfItems.length, banglaDigits)}{" "}
              {shelfItems.length === 1 ? sMsg.fileLabel : sMsg.filesLabel} ·{" "}
              {formatDigits(clipboardItems.length, banglaDigits)}{" "}
              {clipboardItems.length === 1 ? sMsg.clipLabel : sMsg.clipsLabel}
            </span>
          </div>

          <div
            className="flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium tabular-nums"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
              color: COLOR_TOKENS.textSecondary,
            }}
          >
            <span
              className="h-[5px] w-[5px] rounded-full"
              style={{
                backgroundColor: telemetry?.netOnline
                  ? highLoad
                    ? COLOR_TOKENS.accentOrange
                    : COLOR_TOKENS.accentGreen
                  : COLOR_TOKENS.accentRed,
              }}
            />
            <span>
              {telemetry?.netOnline ? sMsg.telemetry.online : sMsg.telemetry.offline} · CPU{" "}
              {formatDigits(Math.round(telemetry?.cpuPercent ?? 0), banglaDigits)}%
            </span>
          </div>

          <div className="flex items-center justify-end gap-1">
            {onTogglePin && (
              <button
                type="button"
                aria-label={isPinned ? msg.pill.unpin : msg.pill.pin}
                title={isPinned ? msg.pill.unpin : msg.pill.pin}
                aria-pressed={isPinned}
                onClick={onTogglePin}
                className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border-0 transition-colors"
                style={{
                  backgroundColor: isPinned ? COLOR_TOKENS.accentOrange : "transparent",
                  color: isPinned ? "#000000" : COLOR_TOKENS.textSecondary,
                }}
              >
                <PinIcon size={12} />
              </button>
            )}
            <button
              type="button"
              data-testid="sys-settings-btn"
              aria-label={msg.pill.openSettings}
              title={msg.pill.openSettings}
              onClick={onOpenSettings}
              className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-opacity hover:opacity-90"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        </header>

        {/* 3-Column Bento Grid: File Shelf | CPU, GPU, Internet Use | Clipboard */}
        <div className="grid h-[258px] w-[612px] grid-cols-[180px_236px_180px] gap-[8px]">
          <FileShelfCard
            items={shelfItems}
            dragOver={dragOverShelf}
            language={language}
            banglaDigits={banglaDigits}
            reduceMotion={reduceMotion}
            onAdd={onShelfAdd}
            onPickFiles={onShelfPickFiles}
            onOpen={onShelfOpen}
            onCopyTarget={onShelfCopy}
            onRemove={onShelfRemove}
            onClear={onShelfClear}
          />

          <SystemMonitorCard
            telemetry={telemetry}
            cpuHistory={cpuHistory}
            gpuHistory={gpuHistory}
            netDownHistory={netDownHistory}
            loading={telemetryLoading}
            language={language}
            banglaDigits={banglaDigits}
            reduceMotion={reduceMotion}
          />

          <ClipboardCard
            items={clipboardItems}
            nowDate={nowDate}
            language={language}
            banglaDigits={banglaDigits}
            reduceMotion={reduceMotion}
            onCopyItem={onCopyClip}
            onTogglePin={onToggleClipPin}
            onDeleteItem={onDeleteClip}
            onClearHistory={onClearClipboard}
          />
        </div>
      </div>
    </div>
  );
}

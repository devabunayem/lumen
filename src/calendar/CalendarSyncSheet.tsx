import { useState } from "react";
import { motion } from "motion/react";
import { CloseIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import type { CalendarSource } from "../lib/ipc";

export interface CalendarSyncSheetProps {
  sources: CalendarSource[];
  syncing: boolean;
  googleClientId: string;
  microsoftClientId: string;
  writebackTasks: boolean;
  language: "en" | "bn";
  reduceMotion: boolean;
  onSyncNow: () => Promise<void> | void;
  onConnectIcs: (label: string, url: string) => Promise<void> | void;
  onConnectOAuth: (
    provider: "google" | "microsoft",
    clientId: string,
    writeScope: boolean,
  ) => Promise<void> | void;
  onDisconnectSource: (sourceId: string) => Promise<void> | void;
  onDeleteAllData: () => Promise<void> | void;
  onToggleWriteback: (enabled: boolean) => void;
  onClose: () => void;
}

export function CalendarSyncSheet({
  sources,
  syncing,
  googleClientId,
  microsoftClientId,
  writebackTasks,
  language,
  reduceMotion,
  onSyncNow,
  onConnectIcs,
  onConnectOAuth,
  onDisconnectSource,
  onDeleteAllData,
  onToggleWriteback,
  onClose,
}: CalendarSyncSheetProps) {
  const msg = getMessages(language);
  const [icsLabel, setIcsLabel] = useState("");
  const [icsUrl, setIcsUrl] = useState("");
  const [gClientId, setGClientId] = useState(googleClientId);
  const [mClientId, setMClientId] = useState(microsoftClientId);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const runAction = async (key: string, fn: () => Promise<void> | void) => {
    setLocalError(null);
    setBusyAction(key);
    try {
      await fn();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <motion.section
      data-testid="cal-sync-sheet"
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={getMotionTransition("smooth", reduceMotion)}
      className="cal-glass-card flex h-[258px] w-[256px] flex-col justify-between overflow-y-auto px-[11px] py-[9px]"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3
            className="m-0 text-[13px] font-semibold tracking-tight"
            style={{ color: COLOR_TOKENS.textPrimary }}
          >
            {msg.calendarHub.syncSheetTitle}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="cal-sync-refresh-btn"
              disabled={syncing || busyAction !== null}
              onClick={() => void runAction("sync", onSyncNow)}
              className="flex h-[22px] cursor-pointer items-center rounded-full px-2.5 text-[10.5px] font-medium disabled:opacity-50"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              {syncing ? msg.calendarHub.syncing : msg.calendarHub.refreshNow}
            </button>
            <button
              type="button"
              data-testid="cal-sync-close"
              aria-label={msg.common.close}
              onClick={onClose}
              className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border-0"
              style={{
                backgroundColor: COLOR_TOKENS.surfaceButton,
                color: COLOR_TOKENS.textSecondary,
              }}
            >
              <CloseIcon size={10} />
            </button>
          </div>
        </div>

        {localError && (
          <div
            data-testid="cal-sync-error-banner"
            className="rounded-lg px-2 py-1 text-[10.5px]"
            style={{
              backgroundColor: COLOR_TOKENS.calSocialBg,
              border: `1px solid ${COLOR_TOKENS.calSocialBorder}`,
              color: COLOR_TOKENS.calDeadline,
            }}
          >
            {localError}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {sources.map((src) => (
            <div
              key={src.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px]"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${
                  src.lastError ? COLOR_TOKENS.calReminder : COLOR_TOKENS.calPillBorder
                }`,
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium" style={{ color: COLOR_TOKENS.textPrimary }}>
                  {src.accountLabel}
                </div>
                <div
                  className="truncate text-[9.5px]"
                  style={{ color: COLOR_TOKENS.textSecondary }}
                >
                  {src.lastError
                    ? src.lastError
                    : src.lastSyncedAt
                      ? `${msg.calendarHub.syncedPrefix} · ${src.lastSyncedAt.slice(11, 16)}`
                      : msg.calendarHub.offlineReady}
                </div>
              </div>
              {src.provider !== "local" && (
                <button
                  type="button"
                  data-testid={`cal-disconnect-${src.id}`}
                  onClick={() => void runAction(`dc-${src.id}`, () => onDisconnectSource(src.id))}
                  className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-0.5 text-[10px] font-medium"
                  style={{ color: COLOR_TOKENS.calDeadline }}
                >
                  {msg.calendarHub.disconnect}
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          className="flex flex-col gap-1 rounded-lg px-2 py-1.5"
          style={{
            backgroundColor: COLOR_TOKENS.calPillBg,
            border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
          }}
        >
          <span className="text-[10.5px] font-semibold" style={{ color: COLOR_TOKENS.textPrimary }}>
            {msg.calendarHub.icsFeedLabel}
          </span>
          <div className="flex gap-1">
            <input
              type="text"
              value={icsLabel}
              onChange={(e) => setIcsLabel(e.target.value)}
              placeholder={msg.calendarHub.icsLabelPlaceholder}
              className="w-[74px] rounded px-1.5 py-0.5 text-[10.5px] outline-none"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            />
            <input
              type="url"
              data-testid="cal-ics-url-input"
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
              placeholder="https://... .ics / webcal://"
              className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[10.5px] outline-none"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            />
            <button
              type="button"
              data-testid="cal-connect-ics-btn"
              disabled={!icsUrl.trim() || busyAction !== null}
              onClick={() =>
                void runAction("ics", async () => {
                  await onConnectIcs(icsLabel, icsUrl);
                  setIcsLabel("");
                  setIcsUrl("");
                })
              }
              className="cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold disabled:opacity-45"
              style={{
                backgroundColor: COLOR_TOKENS.calCtaBg,
                color: COLOR_TOKENS.calCtaText,
              }}
            >
              {msg.calendarHub.add}
            </button>
          </div>
        </div>

        <div
          className="flex flex-col gap-1.5 rounded-lg px-2 py-1.5"
          style={{
            backgroundColor: COLOR_TOKENS.calPillBg,
            border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10.5px] font-semibold"
              style={{ color: COLOR_TOKENS.textPrimary }}
            >
              Google & Outlook (PKCE)
            </span>
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[9.5px] underline"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {msg.calendarHub.byoClientIdGuide}
            </button>
          </div>
          {showGuide && (
            <p
              className="m-0 text-[9.5px] leading-snug"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {msg.calendarHub.byoClientIdHelp}
            </p>
          )}
          <div className="flex gap-1">
            <input
              type="text"
              data-testid="cal-google-cid-input"
              value={gClientId}
              onChange={(e) => setGClientId(e.target.value)}
              placeholder="Google Client ID"
              className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[10px] outline-none"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            />
            <button
              type="button"
              data-testid="cal-connect-google-btn"
              disabled={!gClientId.trim() || busyAction !== null}
              onClick={() =>
                void runAction("google", () => onConnectOAuth("google", gClientId, writebackTasks))
              }
              className="cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold disabled:opacity-45"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              Google
            </button>
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              data-testid="cal-ms-cid-input"
              value={mClientId}
              onChange={(e) => setMClientId(e.target.value)}
              placeholder="Microsoft Client ID"
              className="min-w-0 flex-1 rounded px-1.5 py-0.5 text-[10px] outline-none"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            />
            <button
              type="button"
              data-testid="cal-connect-ms-btn"
              disabled={!mClientId.trim() || busyAction !== null}
              onClick={() =>
                void runAction("ms", () => onConnectOAuth("microsoft", mClientId, writebackTasks))
              }
              className="cursor-pointer rounded px-2 py-0.5 text-[10px] font-semibold disabled:opacity-45"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              Outlook
            </button>
          </div>
          <label
            className="flex cursor-pointer items-center gap-1.5 text-[10px]"
            style={{ color: COLOR_TOKENS.textSecondary }}
          >
            <input
              type="checkbox"
              checked={writebackTasks}
              onChange={(e) => onToggleWriteback(e.target.checked)}
            />
            <span>{msg.calendarHub.writebackTasksLabel}</span>
          </label>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between pt-1">
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="cal-delete-all-confirm"
              onClick={() =>
                void runAction("delete-all", async () => {
                  await onDeleteAllData();
                  setConfirmClear(false);
                })
              }
              className="cursor-pointer rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: COLOR_TOKENS.calDeadline,
                color: COLOR_TOKENS.calCtaText,
              }}
            >
              {msg.calendarHub.confirmDeleteAll}
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="cursor-pointer border-0 bg-transparent text-[10px]"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {msg.common.cancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="cal-delete-all-btn"
            onClick={() => setConfirmClear(true)}
            className="cursor-pointer border-0 bg-transparent p-0 text-[10px] font-medium"
            style={{ color: COLOR_TOKENS.calDeadline }}
          >
            {msg.calendarHub.deleteAllCalendarData}
          </button>
        )}
      </div>
    </motion.section>
  );
}

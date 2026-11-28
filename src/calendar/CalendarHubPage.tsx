import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { SettingsIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import { playUiSound } from "../design/sounds";
import { BASE_GEOMETRY, COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type {
  CalendarHubEvent,
  CalendarHubSnapshot,
  FocusFlowState,
  ParsedQuickAdd,
  PomodoroSnapshot,
} from "../lib/ipc";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarSyncSheet } from "./CalendarSyncSheet";
import { EventSheet } from "./EventSheet";
import { FocusCard } from "./FocusCard";
import { RemindersCard } from "./RemindersCard";
import { TodoCard } from "./TodoCard";
import { UpcomingCard } from "./UpcomingCard";
import { WeekStrip } from "./WeekStrip";
import { buildDayMarkIndex, toDateKey } from "./calendarMarks";

export type CalendarSyncStatus =
  "local" | "synced" | "syncing" | "error" | "offline" | "disconnected";

export interface CalendarHubPageProps {
  snapshot: CalendarHubSnapshot | null;
  loading?: boolean;
  nowDate: Date;
  pomodoro: PomodoroSnapshot;
  focusFlow?: FocusFlowState | null;
  firstDayOfWeek: 0 | 6;
  colorBlindMarks: boolean;
  socialBlockedArmed: boolean;
  googleClientId?: string;
  microsoftClientId?: string;
  writebackTasks?: boolean;
  syncing?: boolean;
  syncStatusOverride?: CalendarSyncStatus;
  selectedDateKeyOverride?: string;
  viewModeOverride?: "month" | "week";
  initialSelectedEvent?: CalendarHubEvent | null;
  initialShowMissed?: boolean;
  initialShowSyncSheet?: boolean;
  dragOverDateKeyOverride?: string | null;
  dragOverFocusOverride?: boolean;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  glowEnabled?: boolean;
  onOpenSettings: () => void;
  onToggleTask: (taskId: number) => void;
  onCreateTask?: (parsed: ParsedQuickAdd) => Promise<void> | void;
  onDeleteTask?: (taskId: number) => void;
  onRestoreLastDeleted?: () => void;
  onMoveTaskDue?: (taskId: number, dueDate: string) => void;
  onSetFocusTask?: (taskId: number | null) => void;
  onCreateReminder?: (parsed: ParsedQuickAdd) => Promise<void> | void;
  onCompleteReminder?: (id: number) => void;
  onDismissMissed?: () => void;
  onToggleFocus: () => void;
  onSkipFocus?: () => void;
  onRespondPrayerPrompt?: (pause: boolean) => void;
  onDismissFreeFocusLog?: () => void;
  onLogFreeFocusTask?: (title: string) => void;
  onSyncNow?: () => Promise<void> | void;
  onConnectIcs?: (label: string, url: string) => Promise<void> | void;
  onConnectOAuth?: (
    provider: "google" | "microsoft",
    clientId: string,
    writeScope: boolean,
  ) => Promise<void> | void;
  onDisconnectSource?: (sourceId: string) => Promise<void> | void;
  onDeleteAllData?: () => Promise<void> | void;
  onToggleWriteback?: (enabled: boolean) => void;
  onJoinMeeting?: (url: string) => void;
  onOpenEventExternal?: (ev: CalendarHubEvent) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function CalendarHubPage({
  snapshot,
  loading = false,
  nowDate,
  pomodoro,
  focusFlow = null,
  firstDayOfWeek,
  colorBlindMarks,
  socialBlockedArmed,
  googleClientId = "",
  microsoftClientId = "",
  writebackTasks = false,
  syncing = false,
  syncStatusOverride,
  selectedDateKeyOverride,
  viewModeOverride,
  initialSelectedEvent = null,
  initialShowMissed = false,
  initialShowSyncSheet = false,
  dragOverDateKeyOverride,
  dragOverFocusOverride = false,
  language,
  banglaDigits,
  reduceMotion,
  reduceTransparency,
  glowEnabled = true,
  onOpenSettings,
  onToggleTask,
  onCreateTask,
  onDeleteTask,
  onRestoreLastDeleted,
  onMoveTaskDue,
  onSetFocusTask,
  onCreateReminder,
  onCompleteReminder,
  onDismissMissed,
  onToggleFocus,
  onSkipFocus,
  onRespondPrayerPrompt,
  onDismissFreeFocusLog,
  onLogFreeFocusTask,
  onSyncNow,
  onConnectIcs,
  onConnectOAuth,
  onDisconnectSource,
  onDeleteAllData,
  onToggleWriteback,
  onJoinMeeting,
  onOpenEventExternal,
  onMonthChange,
}: CalendarHubPageProps) {
  const msg = getMessages(language);
  const todayKey = toDateKey(nowDate);
  const [viewMode, setViewMode] = useState<"month" | "week">(viewModeOverride ?? "month");
  const [viewYear, setViewYear] = useState(snapshot?.year ?? nowDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(snapshot?.month ?? nowDate.getMonth() + 1);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    selectedDateKeyOverride ?? todayKey,
  );
  const [todoQuickAddOpen, setTodoQuickAddOpen] = useState(false);
  const [reminderQuickAddOpen, setReminderQuickAddOpen] = useState(false);
  const [syncSheetOpen, setSyncSheetOpen] = useState(initialShowSyncSheet);
  const [activeEventSheet, setActiveEventSheet] = useState<CalendarHubEvent | null>(
    initialSelectedEvent,
  );
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [dragOverFocus, setDragOverFocus] = useState(false);
  const draggedTaskIdRef = useRef<number | null>(null);
  const [undoBanner, setUndoBanner] = useState<{
    label: string;
    onUndo: () => void;
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const showUndo = (label: string, onUndo: () => void) => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoBanner({ label, onUndo });
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      setUndoBanner(null);
    }, 5000);
  };

  const dayMarksMap = useMemo(
    () =>
      buildDayMarkIndex(
        snapshot?.dayMarks ?? [],
        snapshot?.tasks,
        snapshot?.events,
        snapshot?.reminders,
      ),
    [snapshot],
  );

  const primarySource = snapshot?.sources.find((s) => s.provider !== "local" && s.connected);
  const resolvedSyncStatus: CalendarSyncStatus =
    syncStatusOverride ??
    (primarySource ? (primarySource.lastError ? "error" : "synced") : "local");

  const headerDateText = formatDigits(
    nowDate
      .toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .replace(",", ""),
    banglaDigits,
  );

  const syncChipLabel = (() => {
    if (resolvedSyncStatus === "syncing") return msg.calendarHub.syncing;
    if (resolvedSyncStatus === "error") return msg.calendarHub.syncError;
    if (resolvedSyncStatus === "offline") {
      return msg.calendarHub.updatedAgo.replace("{{age}}", banglaDigits ? "২ ঘ." : "2 h");
    }
    if (resolvedSyncStatus === "synced" && primarySource) {
      return `${msg.calendarHub.syncedPrefix} · ${primarySource.accountLabel}`;
    }
    if (resolvedSyncStatus === "disconnected") return msg.calendarHub.connectCalendar;
    return msg.calendarHub.localCalendar;
  })();

  const syncDotColor =
    resolvedSyncStatus === "error"
      ? COLOR_TOKENS.calReminder
      : resolvedSyncStatus === "synced"
        ? COLOR_TOKENS.calEvent
        : COLOR_TOKENS.textSecondary;

  const isSelectedToday = selectedDateKey === todayKey;
  const allTasks = snapshot?.tasks ?? [];
  const allEvents = snapshot?.events ?? [];
  const allReminders = snapshot?.reminders ?? [];

  // Day filter when selected != today; today shows active today/upcoming overview
  const filteredTasks = isSelectedToday
    ? allTasks
    : allTasks.filter((t) => t.dueDate === selectedDateKey);
  const filteredEvents = isSelectedToday
    ? allEvents
    : allEvents.filter((ev) => ev.start.slice(0, 10) === selectedDateKey);
  const filteredReminders = isSelectedToday
    ? allReminders
    : allReminders.filter(
        (r) =>
          r.kind === "daily" ||
          r.kind === "prayer" ||
          (r.at ? r.at.slice(0, 10) === selectedDateKey : false),
      );

  const boundTask =
    (snapshot?.focusTaskId ? allTasks.find((t) => t.id === snapshot.focusTaskId) : undefined) ??
    allTasks.find((t) => !t.doneAt) ??
    null;

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    const y = next.getFullYear();
    const m = next.getMonth() + 1;
    setViewYear(y);
    setViewMonth(m);
    onMonthChange?.(y, m);
  };

  const handleSelectDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const [yy, mm] = dateKey.split("-").map(Number);
    if (yy && mm && (yy !== viewYear || mm !== viewMonth)) {
      setViewYear(yy);
      setViewMonth(mm);
      onMonthChange?.(yy, mm);
    }
    void playUiSound("day_select");
  };

  const handleJumpToday = () => {
    const y = nowDate.getFullYear();
    const m = nowDate.getMonth() + 1;
    setViewYear(y);
    setViewMonth(m);
    setSelectedDateKey(todayKey);
    onMonthChange?.(y, m);
  };

  const handleToggleWithUndo = (taskId: number) => {
    const target = allTasks.find((t) => t.id === taskId);
    onToggleTask(taskId);
    if (target && !target.doneAt) {
      showUndo(language === "bn" ? `"${target.title}" সম্পন্ন` : `Done · ${target.title}`, () =>
        onToggleTask(taskId),
      );
    }
  };

  const handleDeleteWithUndo = (taskId: number) => {
    const target = allTasks.find((t) => t.id === taskId);
    onDeleteTask?.(taskId);
    if (target && onRestoreLastDeleted) {
      showUndo(
        language === "bn" ? `"${target.title}" মুছে ফেলা হয়েছে` : `Removed · ${target.title}`,
        onRestoreLastDeleted,
      );
    }
  };

  const sideCrossfade = getMotionTransition("calendarDayCrossfade", reduceMotion);

  return (
    <div
      data-testid="calendar-hub-page"
      data-reduce-transparency={reduceTransparency ? "true" : "false"}
      data-reduce-motion={reduceMotion ? "true" : "false"}
      dir="ltr"
      className="relative flex flex-col justify-between overflow-hidden px-[14px] py-[10px]"
      style={{
        width: `${BASE_GEOMETRY.calendarHubExpanded.width}px`,
        height: `${BASE_GEOMETRY.calendarHubExpanded.height}px`,
        backgroundColor: COLOR_TOKENS.surface,
      }}
    >
      {glowEnabled && !reduceTransparency && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -bottom-16 -left-16 h-[210px] w-[240px] rounded-full opacity-80 blur-3xl"
            style={{ backgroundColor: COLOR_TOKENS.calGlowIndigo }}
          />
          <div
            className="absolute -right-12 -bottom-14 h-[190px] w-[220px] rounded-full opacity-90 blur-3xl"
            style={{ backgroundColor: COLOR_TOKENS.calGlowGreen }}
          />
          <div
            className="absolute -top-12 left-1/2 h-[120px] w-[260px] -translate-x-1/2 rounded-full opacity-90 blur-3xl"
            style={{ backgroundColor: COLOR_TOKENS.calGlowAmber }}
          />
        </div>
      )}

      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <header className="grid h-[26px] w-full grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-1.5">
            <h1
              className="m-0 text-[13px] font-semibold tracking-tight"
              style={{ color: COLOR_TOKENS.textPrimary }}
            >
              {msg.calendarHub.title}
            </h1>
            <span
              className="text-[10.5px] font-normal tabular-nums"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {headerDateText}
            </span>
            {!isSelectedToday && (
              <button
                type="button"
                data-testid="cal-back-to-today"
                onClick={handleJumpToday}
                className="flex h-[18px] cursor-pointer items-center rounded-full px-1.5 text-[9.5px] font-medium"
                style={{
                  backgroundColor: COLOR_TOKENS.calPillBg,
                  border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                  color: COLOR_TOKENS.textPrimary,
                }}
              >
                {msg.calendarHub.backToToday}
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label={msg.calendarHub.title}
            className="flex h-[24px] items-center rounded-full p-[2px]"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
            }}
          >
            {(["month", "week"] as const).map((tab) => {
              const active = viewMode === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`cal-view-${tab}`}
                  onClick={() => setViewMode(tab)}
                  className="relative flex h-[18px] cursor-pointer items-center rounded-full px-3 text-[10.5px] font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? COLOR_TOKENS.calCtaBg : "transparent",
                    color: active ? COLOR_TOKENS.calCtaText : COLOR_TOKENS.textSecondary,
                  }}
                >
                  {tab === "month" ? msg.calendarHub.month : msg.calendarHub.week}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              data-testid="cal-sync-chip"
              onClick={() => setSyncSheetOpen((v) => !v)}
              className={`flex h-[24px] cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-medium ${
                resolvedSyncStatus === "syncing" || syncing ? "lumen-skeleton-shimmer" : ""
              }`}
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border:
                  resolvedSyncStatus === "error"
                    ? `1px solid ${COLOR_TOKENS.calReminder}`
                    : `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color:
                  resolvedSyncStatus === "error"
                    ? COLOR_TOKENS.calReminder
                    : COLOR_TOKENS.textPrimary,
              }}
            >
              <span
                className="h-[5px] w-[5px] rounded-full"
                style={{ backgroundColor: syncDotColor }}
              />
              <span className="truncate">{syncChipLabel}</span>
            </button>

            <button
              type="button"
              data-testid="cal-settings-btn"
              aria-label={msg.calendarHub.settings}
              onClick={onOpenSettings}
              className="flex h-[24px] w-[24px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-opacity hover:opacity-90"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        </header>

        {loading ? (
          <div
            data-testid="cal-loading-skeleton"
            className="grid h-[258px] w-[612px] grid-cols-[170px_256px_170px] gap-[8px]"
          >
            <div className="flex flex-col gap-[8px]">
              <div className="cal-glass-card lumen-skeleton-shimmer h-[125px] w-[170px]" />
              <div className="cal-glass-card lumen-skeleton-shimmer h-[125px] w-[170px]" />
            </div>
            <div className="cal-glass-card lumen-skeleton-shimmer h-[258px] w-[256px]" />
            <div className="flex flex-col gap-[8px]">
              <div className="cal-glass-card lumen-skeleton-shimmer h-[125px] w-[170px]" />
              <div className="cal-glass-card lumen-skeleton-shimmer h-[125px] w-[170px]" />
            </div>
          </div>
        ) : (
          <div className="relative grid h-[258px] w-[612px] grid-cols-[170px_256px_170px] gap-[8px]">
            <motion.div
              key={`left-${selectedDateKey}`}
              initial={{ opacity: reduceMotion ? 1 : 0.72 }}
              animate={{ opacity: 1 }}
              transition={sideCrossfade}
              className="flex flex-col gap-[8px]"
            >
              <TodoCard
                tasks={filteredTasks}
                nowDate={nowDate}
                todayDateKey={todayKey}
                selectedDateKey={selectedDateKey}
                quickAddOpen={todoQuickAddOpen}
                language={language}
                banglaDigits={banglaDigits}
                reduceMotion={reduceMotion}
                onToggleTask={handleToggleWithUndo}
                onDeleteTask={handleDeleteWithUndo}
                onMoveTaskDue={(id, due) => onMoveTaskDue?.(id, due)}
                onSetFocusTask={(id) => onSetFocusTask?.(id)}
                onOpenQuickAdd={() => setTodoQuickAddOpen(true)}
                onCloseQuickAdd={() => setTodoQuickAddOpen(false)}
                onCreateTask={onCreateTask}
                onDragStartTask={(id) => {
                  draggedTaskIdRef.current = id;
                }}
                onDragEndTask={() => {
                  draggedTaskIdRef.current = null;
                  setDragOverDateKey(null);
                  setDragOverFocus(false);
                }}
              />
              <UpcomingCard
                events={filteredEvents}
                nowDate={nowDate}
                isDayFiltered={!isSelectedToday}
                hasSyncedCalendar={Boolean(primarySource)}
                language={language}
                banglaDigits={banglaDigits}
                reduceMotion={reduceMotion}
                onJoinMeeting={onJoinMeeting}
                onSelectEvent={(ev) => setActiveEventSheet(ev)}
              />
            </motion.div>

            {syncSheetOpen ? (
              <CalendarSyncSheet
                key="sync-sheet"
                sources={snapshot?.sources ?? []}
                syncing={syncing || resolvedSyncStatus === "syncing"}
                googleClientId={googleClientId}
                microsoftClientId={microsoftClientId}
                writebackTasks={writebackTasks}
                language={language}
                reduceMotion={reduceMotion}
                onSyncNow={() => onSyncNow?.()}
                onConnectIcs={(lbl, url) => onConnectIcs?.(lbl, url)}
                onConnectOAuth={(prov, cid, wr) => onConnectOAuth?.(prov, cid, wr)}
                onDisconnectSource={(sid) => onDisconnectSource?.(sid)}
                onDeleteAllData={() => onDeleteAllData?.()}
                onToggleWriteback={(val) => onToggleWriteback?.(val)}
                onClose={() => setSyncSheetOpen(false)}
              />
            ) : activeEventSheet ? (
              <EventSheet
                key={`sheet-${activeEventSheet.id}`}
                event={activeEventSheet}
                language={language}
                banglaDigits={banglaDigits}
                reduceMotion={reduceMotion}
                onJoin={onJoinMeeting}
                onOpenCalendar={onOpenEventExternal}
                onClose={() => setActiveEventSheet(null)}
              />
            ) : viewMode === "week" ? (
              <motion.div
                key="week-view"
                initial={{ opacity: reduceMotion ? 1 : 0.85, scale: reduceMotion ? 1 : 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={getMotionTransition("smooth", reduceMotion)}
              >
                <WeekStrip
                  selectedDateKey={selectedDateKey}
                  nowDate={nowDate}
                  firstDayOfWeek={firstDayOfWeek}
                  tasks={allTasks}
                  events={allEvents}
                  reminders={allReminders}
                  language={language}
                  banglaDigits={banglaDigits}
                  onSelectDay={handleSelectDay}
                  onJumpToday={handleJumpToday}
                  onSelectEvent={(ev) => setActiveEventSheet(ev)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="month-view"
                initial={{ opacity: reduceMotion ? 1 : 0.85, scale: reduceMotion ? 1 : 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={getMotionTransition("smooth", reduceMotion)}
              >
                <CalendarGrid
                  viewYear={viewYear}
                  viewMonth={viewMonth}
                  nowDate={nowDate}
                  selectedDateKey={selectedDateKey}
                  firstDayOfWeek={firstDayOfWeek}
                  colorBlindMarks={colorBlindMarks}
                  dragOverDateKey={dragOverDateKeyOverride ?? dragOverDateKey}
                  dayMarksMap={dayMarksMap}
                  language={language}
                  banglaDigits={banglaDigits}
                  reduceMotion={reduceMotion}
                  onSelectDay={handleSelectDay}
                  onPrevMonth={() => shiftMonth(-1)}
                  onNextMonth={() => shiftMonth(1)}
                  onJumpToday={handleJumpToday}
                  onDragEnterDay={(dk) => setDragOverDateKey(dk)}
                  onDragLeaveDay={(dk) => setDragOverDateKey((cur) => (cur === dk ? null : cur))}
                  onDropTaskOnDay={(taskId, dk) => {
                    const resolvedId = taskId ?? draggedTaskIdRef.current;
                    setDragOverDateKey(null);
                    draggedTaskIdRef.current = null;
                    if (resolvedId != null) {
                      void playUiSound("drop_on_day");
                      onMoveTaskDue?.(resolvedId, dk);
                    }
                  }}
                />
              </motion.div>
            )}

            <motion.div
              key={`right-${selectedDateKey}`}
              initial={{ opacity: reduceMotion ? 1 : 0.72 }}
              animate={{ opacity: 1 }}
              transition={sideCrossfade}
              className="flex flex-col gap-[8px]"
            >
              <RemindersCard
                reminders={filteredReminders}
                nowDate={nowDate}
                selectedDateKey={selectedDateKey}
                quickAddOpen={reminderQuickAddOpen}
                initialShowMissed={initialShowMissed}
                language={language}
                banglaDigits={banglaDigits}
                onOpenQuickAdd={() => setReminderQuickAddOpen(true)}
                onCloseQuickAdd={() => setReminderQuickAddOpen(false)}
                onCreateReminder={onCreateReminder}
                onCompleteReminder={onCompleteReminder}
                onDismissMissed={onDismissMissed}
              />
              <FocusCard
                pomodoro={pomodoro}
                focusFlow={focusFlow}
                boundTaskTitle={boundTask?.title ?? null}
                socialBlockedArmed={socialBlockedArmed}
                dragOverFocus={dragOverFocusOverride || dragOverFocus}
                language={language}
                banglaDigits={banglaDigits}
                reduceMotion={reduceMotion}
                onToggleFocus={onToggleFocus}
                onSkipFocus={onSkipFocus}
                onRespondPrayerPrompt={onRespondPrayerPrompt}
                onDismissFreeFocusLog={onDismissFreeFocusLog}
                onLogFreeFocusTask={onLogFreeFocusTask}
                onDragOverFocusChange={(over) => setDragOverFocus(over)}
                onDropTaskOnFocus={(taskId) => {
                  const resolvedId = taskId ?? draggedTaskIdRef.current;
                  setDragOverFocus(false);
                  draggedTaskIdRef.current = null;
                  if (resolvedId != null) {
                    void playUiSound("drop_on_day");
                    onSetFocusTask?.(resolvedId);
                  }
                }}
              />
            </motion.div>

            {undoBanner && (
              <div
                data-testid="cal-undo-toast"
                role="status"
                className="absolute bottom-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-3.5 py-1 text-[11px] font-medium shadow-lg"
                style={{
                  backgroundColor: COLOR_TOKENS.arcTooltipBg,
                  border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                  color: COLOR_TOKENS.textPrimary,
                }}
              >
                <span className="truncate">{undoBanner.label}</span>
                <button
                  type="button"
                  data-testid="cal-undo-btn"
                  onClick={() => {
                    undoBanner.onUndo();
                    setUndoBanner(null);
                  }}
                  className="cursor-pointer border-0 bg-transparent p-0 font-semibold"
                  style={{ color: COLOR_TOKENS.calToday }}
                >
                  {language === "bn" ? "আনডু" : "Undo"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

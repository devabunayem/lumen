import { useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckIcon, PlusIcon } from "../design/icons";
import { MOTION_PRESETS } from "../design/motion";
import { playUiSound } from "../design/sounds";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages } from "../i18n";
import { formatDigits } from "../i18n/digits";
import type { CalendarTask, ParsedQuickAdd } from "../lib/ipc";
import { QuickAdd } from "./QuickAdd";

export interface TodoCardProps {
  tasks: CalendarTask[];
  nowDate: Date;
  todayDateKey: string;
  selectedDateKey: string;
  quickAddOpen?: boolean;
  language: "en" | "bn";
  banglaDigits: boolean;
  reduceMotion: boolean;
  onToggleTask: (taskId: number) => void;
  onDeleteTask?: (taskId: number) => void;
  onMoveTaskDue?: (taskId: number, dueDate: string) => void;
  onSetFocusTask?: (taskId: number) => void;
  onOpenQuickAdd?: () => void;
  onCloseQuickAdd?: () => void;
  onCreateTask?: (parsed: ParsedQuickAdd) => Promise<void> | void;
  onDragStartTask?: (taskId: number) => void;
  onDragEndTask?: () => void;
}

export function TodoCard({
  tasks,
  nowDate,
  todayDateKey,
  selectedDateKey,
  quickAddOpen = false,
  language,
  banglaDigits,
  reduceMotion,
  onToggleTask,
  onDeleteTask,
  onMoveTaskDue,
  onSetFocusTask,
  onOpenQuickAdd,
  onCloseQuickAdd,
  onCreateTask,
  onDragStartTask,
  onDragEndTask,
}: TodoCardProps) {
  const msg = getMessages(language);
  const [moveMenuTaskId, setMoveMenuTaskId] = useState<number | null>(null);
  const swipeStartXRef = useRef<{ id: number; x: number } | null>(null);
  const pendingCount = tasks.filter((t) => !t.doneAt).length;
  const visible = tasks.slice(0, quickAddOpen ? 3 : 4);
  const overflow = Math.max(0, tasks.length - visible.length);

  const tomorrowDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1);
  const tomorrowKey = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;

  return (
    <section
      data-testid="cal-todo-card"
      className="cal-glass-card relative flex h-[149px] w-[200px] flex-col px-[14px] py-[12px]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="m-0 text-[13px] font-semibold tracking-tight"
          style={{ color: COLOR_TOKENS.textPrimary }}
        >
          {msg.calendarHub.todoTitle}
        </h3>

        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-normal tabular-nums"
            style={{ color: COLOR_TOKENS.textSecondary }}
          >
            {formatDigits(
              msg.calendarHub.leftCount.replace("{{count}}", String(pendingCount)),
              banglaDigits,
            )}
          </span>

          <button
            type="button"
            data-testid="cal-todo-add-btn"
            aria-label={msg.calendarHub.addTodo}
            onClick={onOpenQuickAdd}
            className="-m-1 flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
          >
            <span
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full transition-opacity hover:opacity-90"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              <PlusIcon size={11} />
            </span>
          </button>
        </div>
      </div>

      {quickAddOpen && (
        <QuickAdd
          mode="task"
          nowDate={nowDate}
          selectedDateKey={selectedDateKey}
          language={language}
          placeholder={language === "bn" ? "কাজ লিখুন (উদা: kal 9 tay)" : "Task (e.g. Review 5pm)"}
          onSave={async (parsed) => {
            await onCreateTask?.(parsed);
            onCloseQuickAdd?.();
          }}
          onCancel={() => onCloseQuickAdd?.()}
        />
      )}

      {visible.length === 0 && !quickAddOpen ? (
        <div
          data-testid="cal-todo-empty"
          className="flex flex-1 items-center justify-center text-center text-[11px]"
          style={{ color: COLOR_TOKENS.textSecondary }}
        >
          {msg.calendarHub.emptyTodo}
        </div>
      ) : (
        <div className="mt-1.5 flex flex-1 flex-col justify-between">
          <ul className="m-0 flex list-none flex-col gap-[5px] p-0">
            {visible.map((task) => {
              const isDone = Boolean(task.doneAt);
              const isOverdue = Boolean(!isDone && task.dueDate && task.dueDate < todayDateKey);
              const dueLabel = task.dueTime
                ? formatDigits(task.dueTime, banglaDigits)
                : task.dueDate === todayDateKey
                  ? msg.calendarHub.today
                  : task.dueDate
                    ? formatDigits(task.dueDate.slice(5), banglaDigits)
                    : "";

              return (
                <li
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer?.setData("text/lumen-task-id", String(task.id));
                    onDragStartTask?.(task.id);
                  }}
                  onDragEnd={() => onDragEndTask?.()}
                  onPointerDown={(e) => {
                    swipeStartXRef.current = { id: task.id, x: e.clientX };
                  }}
                  onPointerUp={(e) => {
                    if (
                      swipeStartXRef.current &&
                      swipeStartXRef.current.id === task.id &&
                      e.clientX - swipeStartXRef.current.x < -36
                    ) {
                      onDeleteTask?.(task.id);
                    }
                    swipeStartXRef.current = null;
                  }}
                  className="relative flex items-center justify-between gap-2 text-[11.5px]"
                >
                  <button
                    type="button"
                    data-testid={`cal-task-row-${task.id}`}
                    onClick={() => {
                      if (!isDone) {
                        void playUiSound("task_done");
                      } else {
                        void playUiSound("toggle_off");
                      }
                      onToggleTask(task.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "m" || e.key === "M") {
                        e.preventDefault();
                        e.stopPropagation();
                        setMoveMenuTaskId((cur) => (cur === task.id ? null : task.id));
                      } else if (e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        onDeleteTask?.(task.id);
                      } else if (e.key === "Escape" && moveMenuTaskId === task.id) {
                        e.preventDefault();
                        setMoveMenuTaskId(null);
                      }
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
                  >
                    <motion.span
                      initial={false}
                      animate={{ scale: isDone && !reduceMotion ? [0.85, 1.12, 1] : 1 }}
                      transition={MOTION_PRESETS.snappy}
                      className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full transition-colors"
                      style={{
                        backgroundColor: isDone ? COLOR_TOKENS.calEvent : "transparent",
                        border: isDone
                          ? `1px solid ${COLOR_TOKENS.calEvent}`
                          : `1px solid ${COLOR_TOKENS.hairlineStrong}`,
                        color: COLOR_TOKENS.calTodayText,
                      }}
                    >
                      {isDone && <CheckIcon size={8} />}
                    </motion.span>
                    <span
                      className="truncate font-medium"
                      style={{
                        color: isDone ? COLOR_TOKENS.textSecondary : COLOR_TOKENS.textPrimary,
                        opacity: isDone ? 0.65 : 1,
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {task.title}
                    </span>
                  </button>

                  {dueLabel && (
                    <span
                      className="shrink-0 text-[10.5px] font-normal tabular-nums"
                      style={{
                        color: isOverdue ? COLOR_TOKENS.calDeadline : COLOR_TOKENS.textSecondary,
                      }}
                    >
                      {dueLabel}
                    </span>
                  )}

                  {moveMenuTaskId === task.id && (
                    <div
                      data-testid={`cal-move-menu-${task.id}`}
                      role="menu"
                      className="absolute top-5 left-0 z-40 flex flex-wrap gap-1 rounded-xl p-1.5 shadow-lg"
                      style={{
                        backgroundColor: COLOR_TOKENS.arcTooltipBg,
                        border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onMoveTaskDue?.(task.id, todayDateKey);
                          setMoveMenuTaskId(null);
                        }}
                        className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium text-white hover:bg-white/15"
                      >
                        {msg.calendarHub.today}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onMoveTaskDue?.(task.id, tomorrowKey);
                          setMoveMenuTaskId(null);
                        }}
                        className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium text-white hover:bg-white/15"
                      >
                        {msg.calendarHub.tomorrowPrefix}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSetFocusTask?.(task.id);
                          setMoveMenuTaskId(null);
                        }}
                        className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: COLOR_TOKENS.calSocialBg,
                          color: COLOR_TOKENS.calToday,
                        }}
                      >
                        → {msg.calendarHub.focusTitle}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {overflow > 0 && (
            <div
              className="text-right text-[10px] font-medium tabular-nums"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              +{formatDigits(String(overflow), banglaDigits)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { CalendarIcon } from "../../design/icons";
import { getMotionTransition } from "../../design/motion";
import { requestKeyboardFocus, type TaskItem } from "../../lib/ipc";

export interface TodoWidgetProps {
  tasks: TaskItem[];
  onAdd: (title: string, dueAt?: string | null) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export function TodoWidget({ tasks, onAdd, onToggle, onDelete }: TodoWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  const hasDueTasks = tasks.some((t) => !t.done && Boolean(t.due_at));

  const submitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    onAdd(trimmed, null);
    setDraft("");
    setAdding(false);
    void requestKeyboardFocus(false);
  };

  return (
    <div className="flex h-full w-full items-stretch gap-3 overflow-hidden px-0.5">
      {/* Left summary block matching reference screenshot */}
      <div className="flex w-[45%] flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div
              className="text-[28px] font-bold leading-none tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {doneCount}/{totalCount}
            </div>
            <div className="type-caption mt-1" style={{ color: "var(--text-secondary)" }}>
              Task Done Today
            </div>
          </div>

          <div
            aria-label={hasDueTasks ? "Tasks due" : "Calendar"}
            className="relative flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: "var(--surface-raised)",
              border: "1px solid var(--hairline)",
              color: "var(--text-secondary)",
            }}
          >
            <CalendarIcon size={13} />
            <span
              className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full"
              style={{
                backgroundColor: hasDueTasks ? "var(--accent-blue)" : "var(--accent-blue)",
              }}
            />
          </div>
        </div>

        {adding ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              aria-label="New task title"
              placeholder="New task"
              value={draft}
              onFocus={() => void requestKeyboardFocus(true)}
              onBlur={() => void requestKeyboardFocus(false)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  submitDraft();
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setAdding(false);
                  void requestKeyboardFocus(false);
                }
              }}
              className="type-caption min-w-0 flex-1 rounded-full border-0 px-3 outline-none"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "var(--surface-raised)",
                color: "var(--text-primary)",
                border: "1px solid var(--hairline)",
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="type-caption flex cursor-pointer items-center gap-1 rounded-full border-0 px-2.5 font-medium"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "var(--surface-button)",
                color: "var(--text-primary)",
              }}
            >
              <span
                aria-hidden="true"
                className="text-[13px] leading-none"
                style={{ color: "var(--text-secondary)" }}
              >
                ⊕
              </span>
              <span>Add Task</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="type-caption flex cursor-pointer items-center gap-1 rounded-full border-0 px-2.5 font-medium"
              style={{
                height: "var(--capsule-height)",
                backgroundColor: "var(--surface-button)",
                color: "var(--text-primary)",
              }}
            >
              <span
                aria-hidden="true"
                className="text-[11px] leading-none"
                style={{ color: "var(--text-secondary)" }}
              >
                ✎
              </span>
              <span>{editing ? "Done" : "Edit Task"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Right scrollable dark rounded card matching reference */}
      <div
        className="flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        {tasks.length === 0 ? (
          <div className="flex h-full items-center">
            <input
              type="text"
              aria-label="Quick add task"
              placeholder="Add a task... (Enter)"
              value={draft}
              onFocus={() => void requestKeyboardFocus(true)}
              onBlur={() => void requestKeyboardFocus(false)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  submitDraft();
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setDraft("");
                  void requestKeyboardFocus(false);
                }
              }}
              className="type-caption w-full border-0 bg-transparent outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-2 py-0.5">
              <button
                type="button"
                aria-label={`Toggle ${task.title}`}
                onClick={() => onToggle(task.id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
              >
                <motion.span
                  initial={false}
                  animate={{ scale: task.done ? 1 : 0.92 }}
                  transition={getMotionTransition("expand", prefersReducedMotion)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: task.done ? "var(--accent-green)" : "transparent",
                    border: task.done
                      ? "1px solid var(--accent-green)"
                      : "1px solid var(--text-tertiary)",
                    color: "var(--surface)",
                  }}
                >
                  {task.done && <span className="text-[10px] font-bold">✓</span>}
                </motion.span>
                <span
                  className="type-caption truncate"
                  style={{
                    color: task.done ? "var(--text-tertiary)" : "var(--text-primary)",
                    textDecoration: task.done ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </span>
              </button>

              {task.due_at && !editing && (
                <span
                  className="shrink-0 text-[11px] tabular-nums"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {task.due_at}
                </span>
              )}

              {editing && (
                <button
                  type="button"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => onDelete(task.id)}
                  className="type-caption cursor-pointer rounded-full border-0 px-2 py-0.5"
                  style={{
                    backgroundColor: "var(--surface-button)",
                    color: "var(--accent-red)",
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

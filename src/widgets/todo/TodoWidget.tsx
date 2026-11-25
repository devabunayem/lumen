import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
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
  const isEmpty = totalCount === 0;

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
    <div className="flex h-full w-full items-stretch gap-3 overflow-hidden">
      {/* Left summary block */}
      <div className="flex w-[42%] flex-col justify-between">
        {isEmpty ? (
          <div>
            <div className="type-title font-semibold" style={{ color: "var(--accent-green)" }}>
              All clear
            </div>
            <div className="type-caption mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Nothing on your list
            </div>
          </div>
        ) : (
          <div>
            <div className="type-display tabular-nums" style={{ color: "var(--text-primary)" }}>
              {doneCount}/{totalCount}
            </div>
            <div className="type-caption mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Task Done Today
            </div>
          </div>
        )}

        {!isEmpty &&
          (adding ? (
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="type-caption cursor-pointer rounded-full border-0 px-3.5 font-semibold"
                style={{
                  height: "var(--capsule-height)",
                  backgroundColor: "var(--accent-green)",
                  color: "var(--surface)",
                }}
              >
                Add Task
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="type-caption cursor-pointer rounded-full border-0 px-3 font-semibold"
                style={{
                  height: "var(--capsule-height)",
                  backgroundColor: "var(--surface-button)",
                  color: "var(--text-primary)",
                }}
              >
                {editing ? "Done" : "Edit Task"}
              </button>
            </div>
          ))}
      </div>

      {/* Right minimal list or inline quick-add (no heavy card box) */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 overflow-y-auto px-1">
        {isEmpty ? (
          <div className="flex w-full items-center">
            <input
              type="text"
              aria-label="New task title"
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
              className="type-caption w-full rounded-full border-0 px-3.5 outline-none transition-colors focus:ring-1 focus:ring-white/30"
              style={{
                height: "34px",
                backgroundColor: "rgba(48, 209, 88, 0.1)",
                color: "var(--text-primary)",
                border: "1px solid rgba(48, 209, 88, 0.28)",
              }}
            />
          </div>
        ) : (
          tasks.slice(0, 4).map((task) => (
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
                    backgroundColor: task.done ? "var(--accent-green)" : "rgba(48, 209, 88, 0.14)",
                    border: task.done
                      ? "1px solid var(--accent-green)"
                      : "1px solid rgba(48, 209, 88, 0.45)",
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
                  style={{ color: "var(--accent-green)" }}
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

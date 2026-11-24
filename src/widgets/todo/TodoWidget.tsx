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
    <div className="flex h-full w-full items-stretch gap-3">
      {/* Left summary block (FR-TD-1, FR-TD-2) */}
      <div className="flex w-[44%] flex-col justify-between py-0.5">
        <div className="flex items-start justify-between">
          <div>
            <div className="type-display tabular-nums" style={{ color: "var(--text-primary)" }}>
              {doneCount}/{totalCount}
            </div>
            <div className="type-caption mt-0.5" style={{ color: "var(--text-secondary)" }}>
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
            <span className="type-caption">📅</span>
            {hasDueTasks && (
              <span
                className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full"
                style={{ backgroundColor: "var(--accent-green)" }}
              />
            )}
          </div>
        </div>

        {adding ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              aria-label="New task title"
              placeholder="Add task & press Enter..."
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
        )}
      </div>

      {/* Right scrollable task card (FR-TD-3) */}
      <div
        className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        {tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="type-caption" style={{ color: "var(--text-tertiary)" }}>
              No tasks yet — click Add Task
            </span>
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
                      : "1.5px solid var(--text-tertiary)",
                    color: "var(--surface)",
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  {task.done ? "✓" : ""}
                </motion.span>
                <span
                  className="type-caption truncate"
                  style={{
                    color: task.done ? "var(--text-tertiary)" : "var(--text-primary)",
                    textDecoration: task.done ? "line-through" : "none",
                  }}
                  title={task.title}
                >
                  {task.title}
                </span>
              </button>
              {editing && (
                <button
                  type="button"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => onDelete(task.id)}
                  className="type-caption cursor-pointer rounded-full border-0 px-2"
                  style={{
                    backgroundColor: "var(--surface-button)",
                    color: "var(--accent-red)",
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

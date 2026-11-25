import { useState } from "react";
import { FileIcon, LinkIcon, NoteIcon } from "../../design/icons";
import { requestKeyboardFocus, type ShelfItem } from "../../lib/ipc";

export interface ShelfWidgetProps {
  items: ShelfItem[];
  onAdd: (kind: string, pathOrText: string) => void;
  onOpen: (target: string) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}

export function ShelfWidget({ items, onAdd, onOpen, onRemove, onClear }: ShelfWidgetProps) {
  const [draft, setDraft] = useState("");

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      const filePath = (file as File & { path?: string }).path || file.name;
      if (filePath) {
        onAdd("file", filePath);
      }
    }
    const text = event.dataTransfer.getData("text/plain").trim();
    if (files.length === 0 && text) {
      const kind = text.startsWith("http://") || text.startsWith("https://") ? "link" : "text";
      onAdd(kind, text);
    }
  };

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }
    const kind = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? "link" : "text";
    onAdd(kind, trimmed);
    setDraft("");
    void requestKeyboardFocus(false);
  };

  if (items.length === 0) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed px-4 py-2"
        style={{
          borderColor: "rgba(255, 255, 255, 0.16)",
          backgroundColor: "transparent",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v10" />
          <path d="m8 9 4 4 4-4" />
          <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        </svg>
        <span className="type-body font-medium" style={{ color: "var(--text-primary)" }}>
          Drop files here
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          Drag out anytime · click to open or copy
        </span>

        <input
          type="text"
          aria-label="Drop or paste link or note"
          placeholder="Or paste link / note..."
          value={draft}
          onFocus={() => void requestKeyboardFocus(true)}
          onBlur={() => void requestKeyboardFocus(false)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              handleSubmit();
            }
          }}
          className="absolute inset-x-4 bottom-1 h-5 rounded-full border-0 bg-transparent text-center text-[11px] opacity-0 outline-none focus:bg-white/5 focus:opacity-100"
          style={{ color: "var(--text-primary)" }}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex h-full w-full flex-col justify-between gap-1.5 overflow-hidden rounded-2xl border border-dashed px-3 py-1.5"
      style={{
        borderColor: "rgba(255, 255, 255, 0.14)",
        backgroundColor: "transparent",
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="Drop or paste link or note"
          placeholder="Drop files or paste a link"
          value={draft}
          onFocus={() => void requestKeyboardFocus(true)}
          onBlur={() => void requestKeyboardFocus(false)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              handleSubmit();
            }
          }}
          className="type-caption min-w-0 flex-1 rounded-full border-0 px-3 py-1 outline-none"
          style={{
            backgroundColor: "var(--surface-button)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          onClick={onClear}
          className="type-caption cursor-pointer rounded-full border-0 px-3 py-1"
          style={{
            backgroundColor: "var(--surface-button)",
            color: "var(--text-secondary)",
          }}
        >
          Clear
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable={item.available}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", item.path_or_text);
            }}
            onClick={() => item.available && onOpen(item.path_or_text)}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemove(item.id);
            }}
            title={`${item.path_or_text} (right-click to remove)`}
            className="type-caption flex max-w-[160px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 py-1"
            style={{
              backgroundColor: "var(--surface-button)",
              color: item.available ? "var(--text-primary)" : "var(--text-tertiary)",
              opacity: item.available ? 1 : 0.65,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              {item.kind === "link" ? (
                <LinkIcon size={12} />
              ) : item.kind === "file" ? (
                <FileIcon size={12} />
              ) : (
                <NoteIcon size={12} />
              )}
            </span>
            <span className="truncate">{item.display_name}</span>
            {!item.available && (
              <span style={{ color: "var(--accent-red)" }} title="Missing file">
                !
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
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

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex h-full w-full flex-col justify-between gap-2 px-3 py-2"
      style={{
        backgroundColor: "var(--surface-raised)",
        borderRadius: "var(--card-radius)",
        border: "1px dashed var(--hairline-strong)",
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="Drop or paste link or note"
          placeholder="Drop files here or paste URL / note..."
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
        {items.length > 0 && (
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
        )}
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 overflow-x-auto">
        {items.length === 0 ? (
          <span className="type-caption mx-auto" style={{ color: "var(--text-tertiary)" }}>
            Shelf empty — drag files, folders, links, or notes onto the pill
          </span>
        ) : (
          items.map((item) => (
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
              <span>{item.kind === "link" ? "🔗" : item.kind === "file" ? "📄" : "📝"}</span>
              <span className="truncate">{item.display_name}</span>
              {!item.available && (
                <span style={{ color: "var(--accent-red)" }} title="Missing file">
                  !
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

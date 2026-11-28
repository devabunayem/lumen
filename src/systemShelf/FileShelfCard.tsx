import { useState, type DragEvent } from "react";
import {
  CloseIcon,
  CopyIcon,
  FileIcon,
  LinkIcon,
  NoteIcon,
  PlusIcon,
  TrashIcon,
  UploadDropIcon,
} from "../design/icons";
import { playUiSound } from "../design/sounds";
import { COLOR_TOKENS } from "../design/tokens";
import { getMessages, type AppLanguage } from "../i18n";
import { formatDigits, interpolateMsg } from "../i18n/digits";
import { SHELF_MAX_ITEMS, requestKeyboardFocus, type ShelfItem } from "../lib/ipc";
import { ScrollOverflowList } from "./ScrollOverflowList";

export interface FileShelfCardProps {
  items: ShelfItem[];
  dragOver?: boolean;
  language: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  onAdd: (kind: string, pathOrText: string) => void;
  onPickFiles: () => void;
  onOpen: (target: string) => void;
  onCopyTarget?: (target: string) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}

export function FileShelfCard({
  items,
  dragOver = false,
  language,
  banglaDigits,
  reduceMotion,
  onAdd,
  onPickFiles,
  onOpen,
  onCopyTarget,
  onRemove,
  onClear,
}: FileShelfCardProps) {
  const msg = getMessages(language);
  const sMsg = msg.systemShelf.shelf;
  const [draft, setDraft] = useState("");
  const [localDragOver, setLocalDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [resetScrollKey, setResetScrollKey] = useState(0);
  const highlighted = dragOver || localDragOver;

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setLocalDragOver(false);

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
    if (files.length > 0 || text) {
      setResetScrollKey((k) => k + 1);
      void playUiSound("task_done");
    }
  };

  const handleSubmit = () => {
    const trimmed = draft.trim().slice(0, 4096);
    if (!trimmed) {
      return;
    }
    const kind = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? "link" : "text";
    onAdd(kind, trimmed);
    setResetScrollKey((k) => k + 1);
    void playUiSound("task_done");
    setDraft("");
    void requestKeyboardFocus(false);
  };

  return (
    <section
      data-testid="sys-file-shelf-card"
      onDragOver={(e) => {
        e.preventDefault();
        setLocalDragOver(true);
      }}
      onDragLeave={() => setLocalDragOver(false)}
      onDrop={handleDrop}
      className="cal-glass-card flex h-[258px] w-[180px] flex-col gap-[7px] overflow-hidden p-[10px]"
    >
      {/* Header */}
      <div className="flex h-[20px] shrink-0 items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="whitespace-nowrap text-[11.5px] font-semibold leading-none"
            style={{ color: COLOR_TOKENS.textPrimary }}
          >
            {sMsg.title}
          </span>
          <span
            data-testid="sys-shelf-cap-badge"
            title={interpolateMsg(sMsg.capTooltip, {
              count: formatDigits(items.length, banglaDigits),
              max: formatDigits(SHELF_MAX_ITEMS, banglaDigits),
            })}
            className="rounded-full px-1.5 py-[2px] text-[9.5px] font-medium leading-none tabular-nums"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              color:
                items.length >= SHELF_MAX_ITEMS - 5
                  ? COLOR_TOKENS.accentOrange
                  : COLOR_TOKENS.textSecondary,
            }}
          >
            {formatDigits(items.length, banglaDigits)}/{formatDigits(SHELF_MAX_ITEMS, banglaDigits)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {items.length > 0 && (
            <button
              type="button"
              data-testid="sys-shelf-clear-btn"
              aria-label={sMsg.clear}
              title={sMsg.clear}
              onClick={onClear}
              className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 transition-colors hover:bg-white/10"
              style={{
                backgroundColor: COLOR_TOKENS.calPillBg,
                color: COLOR_TOKENS.textSecondary,
              }}
            >
              <TrashIcon size={10} />
            </button>
          )}
          <button
            type="button"
            data-testid="sys-shelf-browse-btn"
            aria-label={sMsg.browse}
            title={sMsg.browse}
            onClick={onPickFiles}
            className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 transition-colors hover:bg-white/15"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            <PlusIcon size={11} />
          </button>
        </div>
      </div>

      {/* Rectangular Drop & Quick-Paste Box matching wireframe sketch */}
      <div
        data-testid="sys-shelf-dropzone"
        className={`flex shrink-0 flex-col gap-1.5 rounded-[12px] p-[7px] ${
          reduceMotion ? "" : "transition-colors duration-150"
        }`}
        style={{
          backgroundColor: highlighted
            ? COLOR_TOKENS.sysDropzoneActiveBg
            : COLOR_TOKENS.sysDropzoneBg,
          border: highlighted
            ? `1px dashed ${COLOR_TOKENS.accentBlue}`
            : `1px dashed ${COLOR_TOKENS.sysDropzoneBorder}`,
        }}
      >
        <button
          type="button"
          onClick={onPickFiles}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent py-0.5 text-center"
        >
          <span
            style={{
              color: highlighted ? COLOR_TOKENS.accentBlue : COLOR_TOKENS.accentPurple,
            }}
          >
            <UploadDropIcon size={13} />
          </span>
          <span className="text-[10.5px] font-medium" style={{ color: COLOR_TOKENS.textPrimary }}>
            {highlighted ? sMsg.dropActive : sMsg.dropHint}
          </span>
        </button>

        <input
          type="text"
          aria-label={sMsg.inputPlaceholder}
          placeholder={sMsg.inputPlaceholder}
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
          className="h-[22px] w-full rounded-[8px] border-0 px-2 text-[10px] outline-none placeholder:text-white/35"
          style={{
            backgroundColor: COLOR_TOKENS.sysTrackBg,
            color: COLOR_TOKENS.textPrimary,
          }}
        />
      </div>

      {/* Shelf Items List */}
      <ScrollOverflowList
        itemCount={items.length}
        resetScrollKey={resetScrollKey}
        reduceMotion={reduceMotion}
        scrollLabel={sMsg.scrollMore}
        scrollBtnTestId="sys-shelf-scroll-btn"
        emptyNode={
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <span
              className="text-[10.5px] leading-snug"
              style={{ color: COLOR_TOKENS.textTertiary }}
            >
              {sMsg.emptyHint}
            </span>
          </div>
        }
      >
        {items.map((item) => {
          const iconColor =
            item.kind === "link"
              ? COLOR_TOKENS.accentCyan
              : item.kind === "file" || item.kind === "folder"
                ? COLOR_TOKENS.accentPurple
                : COLOR_TOKENS.accentOrange;
          const kindLabel =
            item.kind === "link"
              ? sMsg.kindLink
              : item.kind === "file" || item.kind === "folder"
                ? sMsg.kindFile
                : sMsg.kindNote;

          return (
            <div
              key={item.id}
              data-testid={`sys-shelf-item-${item.id}`}
              draggable={item.available}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", item.path_or_text);
              }}
              className="group flex h-[34px] shrink-0 items-center gap-1.5 rounded-[11px] px-2 transition-colors hover:bg-white/[0.08]"
              style={{
                backgroundColor: COLOR_TOKENS.sysSubcardBg,
                border: `1px solid ${COLOR_TOKENS.sysSubcardBorder}`,
                opacity: item.available ? 1 : 0.6,
              }}
            >
              <button
                type="button"
                onClick={() => item.available && onOpen(item.path_or_text)}
                title={item.available ? item.path_or_text : sMsg.missingFile}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left"
              >
                <span
                  className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[7px]"
                  style={{
                    backgroundColor: COLOR_TOKENS.calPillBg,
                    color: iconColor,
                  }}
                >
                  {item.kind === "link" ? (
                    <LinkIcon size={11} />
                  ) : item.kind === "file" || item.kind === "folder" ? (
                    <FileIcon size={11} />
                  ) : (
                    <NoteIcon size={11} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[10.5px] font-medium leading-tight"
                    style={{ color: COLOR_TOKENS.textPrimary }}
                  >
                    {item.display_name}
                  </div>
                  <div
                    className="truncate text-[9px] leading-tight"
                    style={{
                      color: item.available ? COLOR_TOKENS.textTertiary : COLOR_TOKENS.accentRed,
                    }}
                  >
                    {copiedId === item.id
                      ? msg.home.chips.copied
                      : item.available
                        ? kindLabel
                        : sMsg.missingFile}
                  </div>
                </div>
              </button>

              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
                {onCopyTarget && (
                  <button
                    type="button"
                    aria-label={sMsg.copyPath}
                    title={sMsg.copyPath}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyTarget(item.path_or_text);
                      setCopiedId(item.id);
                      window.setTimeout(() => {
                        setCopiedId((cur) => (cur === item.id ? null : cur));
                      }, 1100);
                    }}
                    className="flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <CopyIcon size={10} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`${sMsg.remove} ${item.display_name}`}
                  title={sMsg.remove}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
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

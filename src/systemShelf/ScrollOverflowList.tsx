import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { COLOR_TOKENS } from "../design/tokens";

export interface ScrollOverflowListProps {
  itemCount: number;
  resetScrollKey?: number;
  reduceMotion: boolean;
  scrollLabel: string;
  scrollBtnTestId?: string;
  emptyNode: ReactNode;
  children: ReactNode;
}

/** Scrollable vertical list with thin hover thumb, bottom fade mask, and tap-to-scroll pill. */
export function ScrollOverflowList({
  itemCount,
  resetScrollKey,
  reduceMotion,
  scrollLabel,
  scrollBtnTestId,
  emptyNode,
  children,
}: ScrollOverflowListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  const syncOverflow = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      setMoreBelow(false);
      return;
    }
    const hasMore =
      el.scrollHeight > el.clientHeight + 3 && el.scrollTop + el.clientHeight < el.scrollHeight - 6;
    setMoreBelow(hasMore);
  }, []);

  useEffect(() => {
    if (resetScrollKey !== undefined && listRef.current) {
      listRef.current.scrollTop = 0;
    }
    syncOverflow();
  }, [resetScrollKey, syncOverflow]);

  useEffect(() => {
    syncOverflow();
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => syncOverflow());
    observer.observe(el);
    return () => observer.disconnect();
  }, [itemCount, syncOverflow]);

  const handleScrollStep = () => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    if (typeof el.scrollBy === "function") {
      el.scrollBy({ top: 84, behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      el.scrollTop += 84;
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        onScroll={syncOverflow}
        className="sys-scroll-list flex min-h-0 flex-1 flex-col gap-[5px] overflow-y-auto pr-0.5"
      >
        {itemCount === 0 ? emptyNode : children}
      </div>

      {moreBelow && (
        <div className="sys-scroll-fade pointer-events-none absolute inset-x-0 bottom-0 flex h-[24px] items-end justify-center pb-0.5">
          <button
            type="button"
            data-testid={scrollBtnTestId}
            aria-label={scrollLabel}
            onClick={(e) => {
              e.stopPropagation();
              handleScrollStep();
            }}
            className="pointer-events-auto flex h-[15px] cursor-pointer items-center rounded-full border-0 px-2 text-[8.5px] font-medium leading-none transition-opacity hover:opacity-100"
            style={{
              backgroundColor: COLOR_TOKENS.calPillBg,
              border: `1px solid ${COLOR_TOKENS.calPillBorder}`,
              color: COLOR_TOKENS.textSecondary,
            }}
          >
            ↓ {scrollLabel}
          </button>
        </div>
      )}
    </div>
  );
}

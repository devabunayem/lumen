import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import { CONTENT_STAGGER, getMotionTransition } from "../design/motion";
import { generateNotchPath, generatePillPath } from "../design/shapes";
import { BASE_GEOMETRY, type ShapeStyle } from "../design/tokens";
import { subscribeFullscreenChange, syncPillBounds } from "../lib/ipc";
import { useIslandStore } from "./stateMachine";

export interface IslandShellProps {
  shapeStyle?: ShapeStyle;
  scaleFactor?: number;
  hideInFullscreen?: boolean;
  onShapeChange?: (next: ShapeStyle) => void;
}

interface PreviewPage {
  id: string;
  titleLead: string;
  titleAccent: string;
  accentVar: string;
  headline: string;
  subline: string;
  metricValue: string;
  metricLabel: string;
}

const PHASE1_PREVIEW_PAGES: readonly PreviewPage[] = [
  {
    id: "overview",
    titleLead: "Lumen",
    titleAccent: "Island",
    accentVar: "var(--accent-blue)",
    headline: "Window engine active",
    subline: "Click-through hit-testing, no focus stealing & fullscreen auto-hide.",
    metricValue: "10 Hz",
    metricLabel: "Idle Hit-Test",
  },
  {
    id: "motion",
    titleLead: "Spring",
    titleAccent: "Motion",
    accentVar: "var(--accent-green)",
    headline: "Interruptible squircle morph",
    subline: "Switch between Notch and Floating Pill anytime with 450 ms spring physics.",
    metricValue: "60+",
    metricLabel: "FPS Target",
  },
  {
    id: "roadmap",
    titleLead: "Phase",
    titleAccent: "Ready",
    accentVar: "var(--accent-orange)",
    headline: "Next: Music & SMTC",
    subline: "Core island shell, state machine & Windows bounds sync verified.",
    metricValue: "7",
    metricLabel: "Island States",
  },
];

function formatClockParts(now: Date): { dateText: string; timeText: string } {
  const dateText = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeText = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return { dateText, timeText };
}

export function IslandShell({
  shapeStyle = "notch",
  scaleFactor = 1,
  hideInFullscreen = true,
  onShapeChange,
}: IslandShellProps) {
  const { state, dispatch } = useIslandStore();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const clipId = useId();
  const [clock, setClock] = useState(() => formatClockParts(new Date()));
  const [showHeaderClock, setShowHeaderClock] = useState(true);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(formatClockParts(new Date()));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void subscribeFullscreenChange((active) => {
      dispatch({ type: "FULLSCREEN_CHANGE", active });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch({ type: "ESCAPE" });
      } else if (state === "expanded" && event.key === "ArrowRight") {
        setActivePageIndex((idx) => (idx + 1) % PHASE1_PREVIEW_PAGES.length);
      } else if (state === "expanded" && event.key === "ArrowLeft") {
        setActivePageIndex(
          (idx) => (idx - 1 + PHASE1_PREVIEW_PAGES.length) % PHASE1_PREVIEW_PAGES.length,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, state]);

  const dimensions = useMemo(() => {
    switch (state) {
      case "minimal":
        return BASE_GEOMETRY.minimal;
      case "peek":
        return { width: 236, height: 36 };
      case "expanded":
        return BASE_GEOMETRY.expanded;
      case "hud":
        return BASE_GEOMETRY.hud;
      default:
        return BASE_GEOMETRY.collapsed;
    }
  }, [state]);

  const width = Math.round(dimensions.width * scaleFactor);
  const height = Math.round(dimensions.height * scaleFactor);
  const isFloatingPill = shapeStyle === "pill";
  const topOffset = isFloatingPill ? Math.round(BASE_GEOMETRY.pillFloatOffset * scaleFactor) : 0;

  useEffect(() => {
    void syncPillBounds({
      width,
      height,
      topOffset,
      visible: state !== "hidden",
      hideInFullscreen,
    });
  }, [width, height, topOffset, state, hideInFullscreen]);

  const shapePath = useMemo(() => {
    if (isFloatingPill) {
      return generatePillPath({ width, height });
    }
    return generateNotchPath({
      width,
      height,
      earWidth: state === "expanded" ? 20 : 12,
      bottomRadius: state === "expanded" ? BASE_GEOMETRY.notchBottomRadius : 16,
    });
  }, [isFloatingPill, width, height, state]);

  const activePage = PHASE1_PREVIEW_PAGES[activePageIndex] ?? PHASE1_PREVIEW_PAGES[0];
  const isExpanded = state === "expanded";
  const isHidden = state === "hidden";

  const sizeTransition = isHidden
    ? getMotionTransition("hideFullscreen", prefersReducedMotion)
    : isExpanded
      ? getMotionTransition("expand", prefersReducedMotion)
      : getMotionTransition("collapse", prefersReducedMotion);

  const nextShape: ShapeStyle = isFloatingPill ? "notch" : "pill";

  return (
    <div
      className="pointer-events-none flex h-full w-full items-start justify-center"
      style={{ paddingTop: `${topOffset}px` }}
    >
      <motion.div
        role="region"
        aria-label="Lumen Dynamic Island"
        aria-hidden={isHidden}
        data-testid="lumen-island-pill"
        data-state={state}
        data-shape={shapeStyle}
        data-target-width={width}
        data-target-height={height}
        className={`relative select-none ${isHidden ? "pointer-events-none" : "pointer-events-auto cursor-pointer"}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          filter: "drop-shadow(0 12px 24px rgba(0, 0, 0, 0.5))",
        }}
        initial={false}
        animate={{
          width,
          height,
          opacity: isHidden ? 0 : 1,
          scaleY: isHidden ? 0.25 : 1,
        }}
        whileHover={
          !isExpanded && !isHidden && !prefersReducedMotion
            ? { scale: 1.04, transition: getMotionTransition("pillHover", prefersReducedMotion) }
            : undefined
        }
        transition={sizeTransition}
        onMouseEnter={() => {
          setIsHeaderHovered(true);
          dispatch({ type: "HOVER" });
        }}
        onMouseLeave={() => {
          setIsHeaderHovered(false);
          dispatch({ type: "LEAVE" });
        }}
        onClick={() => {
          if (!isExpanded && !isHidden) {
            dispatch({ type: "CLICK" });
          }
        }}
      >
        {/* Pure black SVG continuous-curvature body + 1 px top highlight */}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <defs>
            <clipPath id={clipId}>
              <motion.path
                d={shapePath}
                initial={false}
                animate={{ d: shapePath }}
                transition={getMotionTransition("shapeMorph", prefersReducedMotion)}
              />
            </clipPath>
          </defs>
          <motion.path
            d={shapePath}
            fill="var(--surface)"
            stroke="var(--hairline)"
            strokeWidth={1}
            initial={false}
            animate={{ d: shapePath }}
            transition={getMotionTransition("shapeMorph", prefersReducedMotion)}
          />
        </svg>

        {/* Top 1 px inner hairline highlight (SRS Section 3.7) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-0 h-px"
          style={{ backgroundColor: "var(--hairline-top)" }}
        />

        {/* Inner clipped content */}
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ clipPath: `url(#${clipId})` }}
        >
          <AnimatePresence initial={false}>
            {!isExpanded ? (
              <motion.div
                key="collapsed-pill"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: { duration: CONTENT_STAGGER.collapseFadeMs / 1000 },
                }}
                transition={{ duration: 0.14 }}
                className="flex h-full w-full items-center justify-between px-5"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: "var(--accent-blue)" }}
                  />
                  <span
                    className="type-caption tracking-wide"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {state === "peek" ? "Click to open" : "Lumen"}
                  </span>
                </div>

                <span
                  className="type-header-clock tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {clock.timeText}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="expanded-island"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: {
                    delay: prefersReducedMotion ? 0 : CONTENT_STAGGER.expandDelayMs / 1000,
                    duration: 0.18,
                  },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: CONTENT_STAGGER.collapseFadeMs / 1000 },
                }}
                className="flex h-full w-full flex-col justify-between"
                style={{
                  padding: "var(--island-padding)",
                  paddingLeft: isFloatingPill ? "var(--island-padding)" : "32px",
                  paddingRight: isFloatingPill ? "var(--island-padding)" : "32px",
                  gap: "var(--island-gap)",
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {/* Header layout (SRS Section 3.5) */}
                <div className="flex items-center justify-between">
                  <h1 className="type-title m-0 flex items-center gap-1.5">
                    <span style={{ color: "var(--text-primary)" }}>{activePage.titleLead}</span>
                    <span style={{ color: activePage.accentVar }}>{activePage.titleAccent}</span>
                  </h1>

                  <button
                    type="button"
                    onClick={() => setShowHeaderClock((v) => !v)}
                    className="type-header-clock cursor-pointer border-0 bg-transparent p-0 tabular-nums"
                    style={{ color: "var(--text-secondary)" }}
                    title="Toggle date and time"
                  >
                    {showHeaderClock ? (
                      <>
                        {clock.dateText}{" "}
                        <strong style={{ color: "var(--text-primary)" }}>{clock.timeText}</strong>
                      </>
                    ) : (
                      <span>{clock.timeText}</span>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onShapeChange?.(nextShape)}
                      className="type-caption cursor-pointer rounded-full border-0 px-3 font-semibold"
                      style={{
                        height: "28px",
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {isFloatingPill ? "Notch" : "Pill"}
                    </button>

                    <button
                      type="button"
                      aria-label="Collapse island"
                      onClick={() => dispatch({ type: "CLICK" })}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-raised)",
                        border: "1px solid var(--hairline)",
                      }}
                    >
                      <span
                        className="block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: activePage.accentVar }}
                      />
                    </button>
                  </div>
                </div>

                {/* Body card (SRS Section 3.1 & 3.4) */}
                <div className="relative flex flex-1 items-center">
                  {isHeaderHovered && (
                    <button
                      type="button"
                      aria-label="Previous page"
                      onClick={() =>
                        setActivePageIndex(
                          (idx) =>
                            (idx - 1 + PHASE1_PREVIEW_PAGES.length) % PHASE1_PREVIEW_PAGES.length,
                        )
                      }
                      className="type-caption absolute -left-4 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      ‹
                    </button>
                  )}

                  <div
                    className="flex h-full w-full items-center justify-between px-4 py-2.5"
                    style={{
                      backgroundColor: "var(--surface-raised)",
                      borderRadius: "var(--card-radius)",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    <div className="flex max-w-[70%] flex-col gap-0.5">
                      <span className="type-body" style={{ color: "var(--text-primary)" }}>
                        {activePage.headline}
                      </span>
                      <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
                        {activePage.subline}
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span
                        className="tabular-nums text-3xl font-bold leading-none"
                        style={{ color: activePage.accentVar }}
                      >
                        {activePage.metricValue}
                      </span>
                      <span className="type-caption mt-1" style={{ color: "var(--text-tertiary)" }}>
                        {activePage.metricLabel}
                      </span>
                    </div>
                  </div>

                  {isHeaderHovered && (
                    <button
                      type="button"
                      aria-label="Next page"
                      onClick={() =>
                        setActivePageIndex((idx) => (idx + 1) % PHASE1_PREVIEW_PAGES.length)
                      }
                      className="type-caption absolute -right-4 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0"
                      style={{
                        backgroundColor: "var(--surface-button)",
                        color: "var(--text-primary)",
                      }}
                    >
                      ›
                    </button>
                  )}
                </div>

                {/* Bottom centre page dots (active dot stretches into a capsule) */}
                <div className="flex items-center justify-center gap-1.5">
                  {PHASE1_PREVIEW_PAGES.map((page, index) => {
                    const active = index === activePageIndex;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        aria-label={`Page ${index + 1}`}
                        onClick={() => setActivePageIndex(index)}
                        className="h-1.5 cursor-pointer rounded-full border-0 p-0 transition-all"
                        style={{
                          width: active ? "18px" : "6px",
                          backgroundColor: active ? activePage.accentVar : "var(--text-tertiary)",
                        }}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

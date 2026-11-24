import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import { getMotionTransition } from "../design/motion";
import { generateNotchPath, generatePillPath } from "../design/shapes";
import { BASE_GEOMETRY, type ShapeStyle } from "../design/tokens";
import { useIslandStore } from "./stateMachine";

export interface IslandShellProps {
  shapeStyle?: ShapeStyle;
  scaleFactor?: number;
}

function formatClock(now: Date): string {
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function IslandShell({ shapeStyle = "notch", scaleFactor = 1 }: IslandShellProps) {
  const { state, dispatch } = useIslandStore();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const clipId = useId();
  const [clockText, setClockText] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockText(formatClock(new Date()));
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const dimensions = useMemo(() => {
    switch (state) {
      case "minimal":
        return BASE_GEOMETRY.minimal;
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

  const shapePath = useMemo(() => {
    if (shapeStyle === "pill") {
      return generatePillPath({ width, height });
    }
    return generateNotchPath({
      width,
      height,
      earWidth: state === "expanded" ? 20 : 12,
      bottomRadius: state === "expanded" ? BASE_GEOMETRY.notchBottomRadius : 16,
    });
  }, [shapeStyle, width, height, state]);

  if (state === "hidden") {
    return null;
  }

  const isFloatingPill = shapeStyle === "pill";
  const topOffset = isFloatingPill ? BASE_GEOMETRY.pillFloatOffset : 0;

  return (
    <div
      className="pointer-events-none flex h-full w-full items-start justify-center"
      style={{ paddingTop: `${topOffset}px` }}
    >
      <motion.div
        role="region"
        aria-label="Lumen Dynamic Island"
        data-testid="lumen-island-pill"
        data-state={state}
        data-shape={shapeStyle}
        data-target-width={width}
        data-target-height={height}
        className="pointer-events-auto relative cursor-pointer overflow-hidden"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: "var(--surface)",
          clipPath: `url(#${clipId})`,
          boxShadow: "var(--island-shadow)",
        }}
        initial={false}
        animate={{ width, height, opacity: 1 }}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
        transition={
          state === "expanded"
            ? getMotionTransition("expand", prefersReducedMotion)
            : getMotionTransition("collapse", prefersReducedMotion)
        }
        onMouseEnter={() => dispatch({ type: "HOVER" })}
        onMouseLeave={() => dispatch({ type: "LEAVE" })}
        onClick={() => dispatch({ type: "CLICK" })}
      >
        <svg width="0" height="0" aria-hidden="true" className="pointer-events-none absolute">
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={shapePath} />
            </clipPath>
          </defs>
        </svg>

        {/* 1 px top inner hairline highlight (SRS Section 3.7) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ backgroundColor: "var(--hairline-top)" }}
        />

        {/* Collapsed / Minimal / Expanded baseline content */}
        <div className="flex h-full w-full items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--accent-blue)" }}
            />
            <span className="type-caption tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Lumen
            </span>
          </div>

          <span className="type-header-clock tabular-nums" style={{ color: "var(--text-primary)" }}>
            {clockText}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

import { type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { LumiRig } from "./LumiRig";
import {
  claimLumiAnimationSlot,
  isAutoSleepyCondition,
  LUMI_BLINK_CLOSE_MS,
  LUMI_BLINK_OPEN_MS,
  LUMI_HOVER_PURR_MS,
  LUMI_MAX_NODS_PER_SEC,
  LUMI_TAP_HAPPY_MS,
  nextBlinkDelayMs,
  releaseLumiAnimationSlot,
  resolveMoodTransition,
  shouldDoubleBlink,
  type LumiDwellState,
} from "./lumiStateMachine";
import { resolveLumiLod, type LumiGlowHue, type LumiMood, type LumiProps } from "./types";

function resolveDefaultGlowHue(mood: LumiMood, explicit?: LumiGlowHue): LumiGlowHue {
  if (explicit) {
    return explicit;
  }
  switch (mood) {
    case "focus":
      return "focus";
    case "calm":
      return "prayer";
    case "sleepy":
      return "night";
    default:
      return "dusk";
  }
}

/**
 * Living Lumi mascot component ("Main" state machine wrapper) with:
 * - Mood priority arbitration (`calm > focus > worried > everything else`) & 1.5s min dwell
 * - Natural random blinking (4-7s, 90/120ms, 10% double blink; preserved under reducedMotion)
 * - Cursor pupil look-at (+-6px eased 180ms when open/hovered)
 * - Touch physics: click squish + 1s happy, 2s hover purr, double-click love, wake blink
 * - Automatic single-instance animation coordinator & beat nod cap (<= 3 nods/sec)
 */
export function Lumi({
  size = 56,
  mood = "idle",
  lookAt,
  lookX,
  lookY,
  canLook = true,
  active = true,
  allowMultiple = false,
  glow = true,
  glowHue,
  talking = false,
  beat = 0,
  tap = 0,
  reducedMotion = false,
  nowDate,
  idleMs = 0,
  accessories = [],
  onMoodResolved,
  className = "",
}: LumiProps) {
  const instanceId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [slotGranted, setSlotGranted] = useState(allowMultiple);

  // Determine effective ambient slot allocation (max 1 active island Lumi unless preview allowMultiple)
  useEffect(() => {
    if (!active) {
      const t = window.setTimeout(() => setSlotGranted(false), 0);
      return () => window.clearTimeout(t);
    }
    if (allowMultiple) {
      const t = window.setTimeout(() => setSlotGranted(true), 0);
      return () => window.clearTimeout(t);
    }
    const granted = claimLumiAnimationSlot(instanceId);
    const t = window.setTimeout(() => setSlotGranted(granted), 0);
    return () => {
      window.clearTimeout(t);
      releaseLumiAnimationSlot(instanceId);
    };
  }, [active, allowMultiple, instanceId]);

  const animateAmbient = active && slotGranted;

  // Interactive overrides (touch / hover-2s / dblclick / wake)
  const [touchOverride, setTouchOverride] = useState<LumiMood | null>(null);
  const [purring, setPurring] = useState(false);
  const [squishPulse, setSquishPulse] = useState(false);
  const [blinkClosed, setBlinkClosed] = useState(false);
  const [noddingBeat, setNoddingBeat] = useState(false);
  const [hoverLook, setHoverLook] = useState<{ x: number; y: number } | null>(null);
  const [wokenOverride, setWokenOverride] = useState(false);
  const [localHour, setLocalHour] = useState(() => (nowDate ?? new Date()).getHours());

  const touchTimerRef = useRef<number | null>(null);
  const wakeTimerRef = useRef<number | null>(null);
  const hoverPurrTimerRef = useRef<number | null>(null);
  const squishTimerRef = useRef<number | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const nodTimestampsRef = useRef<number[]>([]);
  const prevBeatRef = useRef(beat);
  const prevTapRef = useRef(tap);

  useEffect(() => {
    if (nowDate) {
      const t = window.setTimeout(() => setLocalHour(nowDate.getHours()), 0);
      return () => window.clearTimeout(t);
    }
    const timer = window.setInterval(() => {
      setLocalHour(new Date().getHours());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [nowDate]);

  const requestedMood: LumiMood = useMemo(() => {
    if (touchOverride) {
      return touchOverride;
    }
    const hourNow = nowDate ? nowDate.getHours() : localHour;
    const isAutoSleepy =
      mood === "idle" &&
      !wokenOverride &&
      isAutoSleepyCondition(idleMs, new Date(2026, 0, 1, hourNow, 0, 0));
    if (isAutoSleepy) {
      return "sleepy";
    }
    return mood;
  }, [touchOverride, nowDate, localHour, mood, wokenOverride, idleMs]);

  const [dwellState, setDwellState] = useState<LumiDwellState>(() => ({
    activeMood: requestedMood,
    pendingMood: null,
    enteredAtMs: Date.now(),
  }));

  // Priority + 1.5 s dwell arbitrator
  useEffect(() => {
    const t = window.setTimeout(() => {
      const nowMs = Date.now();
      setDwellState((prev) => {
        const allowTouchRelease =
          touchOverride === "love" ||
          (touchOverride === null && prev.activeMood === "happy" && mood === "idle");
        const res = resolveMoodTransition(prev, requestedMood, nowMs, allowTouchRelease);
        if (dwellTimerRef.current !== null) {
          window.clearTimeout(dwellTimerRef.current);
          dwellTimerRef.current = null;
        }
        if (res.waitMs > 0) {
          dwellTimerRef.current = window.setTimeout(() => {
            setDwellState((cur) =>
              cur.pendingMood
                ? {
                    activeMood: cur.pendingMood,
                    pendingMood: null,
                    enteredAtMs: Date.now(),
                  }
                : cur,
            );
          }, res.waitMs);
        }
        return res.nextState;
      });
    }, 0);
    return () => {
      window.clearTimeout(t);
    };
  }, [requestedMood, touchOverride, mood]);

  useEffect(() => {
    return () => {
      if (dwellTimerRef.current !== null) window.clearTimeout(dwellTimerRef.current);
      if (touchTimerRef.current !== null) window.clearTimeout(touchTimerRef.current);
      if (wakeTimerRef.current !== null) window.clearTimeout(wakeTimerRef.current);
      if (hoverPurrTimerRef.current !== null) window.clearTimeout(hoverPurrTimerRef.current);
      if (squishTimerRef.current !== null) window.clearTimeout(squishTimerRef.current);
    };
  }, []);

  useEffect(() => {
    onMoodResolved?.(dwellState.activeMood);
  }, [dwellState.activeMood, onMoodResolved]);

  const triggerSingleBlink = useCallback((allowDouble = true) => {
    setBlinkClosed(true);
    window.setTimeout(() => {
      setBlinkClosed(false);
      if (allowDouble && shouldDoubleBlink(Math.random())) {
        window.setTimeout(() => {
          setBlinkClosed(true);
          window.setTimeout(() => setBlinkClosed(false), LUMI_BLINK_CLOSE_MS);
        }, LUMI_BLINK_OPEN_MS);
      }
    }, LUMI_BLINK_CLOSE_MS);
  }, []);

  // Natural blink scheduler (runs even in reducedMotion per "static poses, blink only")
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let blinkTimeout: number | null = null;

    const scheduleNext = () => {
      const wait = nextBlinkDelayMs(Math.random());
      blinkTimeout = window.setTimeout(() => {
        if (cancelled) return;
        triggerSingleBlink(true);
        scheduleNext();
      }, wait);
    };
    scheduleNext();

    return () => {
      cancelled = true;
      if (blinkTimeout !== null) window.clearTimeout(blinkTimeout);
    };
  }, [active, triggerSingleBlink]);

  const handleWakeTap = useCallback(() => {
    if (dwellState.activeMood === "sleepy") {
      setWokenOverride(true);
      if (wakeTimerRef.current !== null) window.clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = window.setTimeout(() => setWokenOverride(false), 60_000);
      triggerSingleBlink(false);
    }
    if (!reducedMotion) {
      setSquishPulse(true);
      if (squishTimerRef.current !== null) window.clearTimeout(squishTimerRef.current);
      squishTimerRef.current = window.setTimeout(() => setSquishPulse(false), 260);
    }
    setTouchOverride("happy");
    setDwellState(
      (prev) =>
        resolveMoodTransition(
          prev,
          "happy",
          Date.now(),
          prev.activeMood !== "calm" && prev.activeMood !== "focus",
        ).nextState,
    );
    if (touchTimerRef.current !== null) window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => {
      setTouchOverride((cur) => (cur === "happy" ? null : cur));
      setDwellState((prev) =>
        prev.activeMood === "happy"
          ? resolveMoodTransition(prev, mood, Date.now(), true).nextState
          : prev,
      );
    }, LUMI_TAP_HAPPY_MS);
  }, [dwellState.activeMood, mood, reducedMotion, triggerSingleBlink]);

  // External `tap` trigger prop
  useEffect(() => {
    if (tap !== prevTapRef.current) {
      prevTapRef.current = tap;
      const t = window.setTimeout(() => handleWakeTap(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [tap, handleWakeTap]);

  // External `beat` trigger prop (capped at <= 3 nods per second)
  useEffect(() => {
    if (beat === prevBeatRef.current) return;
    prevBeatRef.current = beat;
    if (!animateAmbient || reducedMotion) return;

    const now = Date.now();
    nodTimestampsRef.current = nodTimestampsRef.current.filter((ts) => now - ts < 1000);
    if (nodTimestampsRef.current.length >= LUMI_MAX_NODS_PER_SEC) {
      return;
    }
    nodTimestampsRef.current.push(now);

    const t1 = window.setTimeout(() => setNoddingBeat(true), 0);
    const t2 = window.setTimeout(() => setNoddingBeat(false), 120);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [beat, animateAmbient, reducedMotion]);

  const handlePointerEnter = () => {
    if (hoverPurrTimerRef.current !== null) window.clearTimeout(hoverPurrTimerRef.current);
    hoverPurrTimerRef.current = window.setTimeout(() => {
      setPurring(true);
    }, LUMI_HOVER_PURR_MS);
  };

  const handlePointerMove = (e: MouseEvent<HTMLSpanElement>) => {
    if (!canLook || reducedMotion || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    setHoverLook({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };

  const handlePointerLeave = () => {
    if (hoverPurrTimerRef.current !== null) {
      window.clearTimeout(hoverPurrTimerRef.current);
      hoverPurrTimerRef.current = null;
    }
    setPurring(false);
    setHoverLook(null);
  };

  const handleDoubleClick = () => {
    if (touchTimerRef.current !== null) window.clearTimeout(touchTimerRef.current);
    setTouchOverride("love");
    setDwellState(
      (prev) =>
        resolveMoodTransition(
          prev,
          "love",
          Date.now(),
          prev.activeMood !== "calm" && prev.activeMood !== "focus",
        ).nextState,
    );
    touchTimerRef.current = window.setTimeout(() => {
      setTouchOverride((cur) => (cur === "love" ? null : cur));
      setDwellState((prev) =>
        prev.activeMood === "love"
          ? resolveMoodTransition(prev, mood, Date.now(), true).nextState
          : prev,
      );
    }, 2400);
  };

  const resolvedLook =
    !canLook || reducedMotion
      ? { x: 0, y: 0 }
      : (hoverLook ??
        (lookX !== undefined || lookY !== undefined
          ? { x: lookX ?? 0, y: lookY ?? 0 }
          : (lookAt ?? { x: 0, y: 0 })));

  const showGlow = glow !== false;
  const resolvedGlowHue = resolveDefaultGlowHue(
    dwellState.activeMood,
    typeof glow === "string" ? glow : glowHue,
  );
  const lod = resolveLumiLod(size);

  return (
    <span
      ref={rootRef}
      data-testid="lumi-character"
      data-size={size}
      data-lod={lod}
      data-mood={dwellState.activeMood}
      data-pending-mood={dwellState.pendingMood ?? ""}
      data-purring={purring ? "true" : "false"}
      data-blink={blinkClosed ? "closed" : "open"}
      data-glow-hue={showGlow ? resolvedGlowHue : "off"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-hidden="true"
      onClick={handleWakeTap}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handlePointerEnter}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      className={`relative inline-flex shrink-0 cursor-pointer items-center justify-center select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <LumiRig
        size={size}
        mood={dwellState.activeMood}
        glowHue={resolvedGlowHue}
        showGlow={showGlow}
        talking={talking}
        lookAt={resolvedLook}
        accessories={accessories}
        blinkClosed={blinkClosed}
        purring={purring}
        animateAmbient={animateAmbient}
        reducedMotion={reducedMotion}
        noddingBeat={noddingBeat}
        squishPulse={squishPulse}
      />
    </span>
  );
}

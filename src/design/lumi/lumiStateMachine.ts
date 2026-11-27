import type { LumiMood } from "./types";

export const LUMI_MIN_DWELL_MS = 1500;
export const LUMI_IDLE_SLEEPY_MS = 10 * 60 * 1000;
export const LUMI_NIGHT_HOUR = 22;
export const LUMI_BLINK_MIN_MS = 4000;
export const LUMI_BLINK_MAX_MS = 7000;
export const LUMI_BLINK_CLOSE_MS = 90;
export const LUMI_BLINK_OPEN_MS = 120;
export const LUMI_HOVER_PURR_MS = 2000;
export const LUMI_TAP_HAPPY_MS = 1000;
export const LUMI_MAX_NODS_PER_SEC = 3;

export interface LumiDwellState {
  activeMood: LumiMood;
  pendingMood: LumiMood | null;
  enteredAtMs: number;
}

export interface LumiDwellResolution {
  nextState: LumiDwellState;
  waitMs: number;
}

/**
 * Mood arbitration priority per spec: `calm > focus > worried > everything else`.
 */
export function getMoodPriority(mood: LumiMood): number {
  switch (mood) {
    case "calm":
      return 3;
    case "focus":
      return 2;
    case "worried":
      return 1;
    default:
      return 0;
  }
}

/**
 * Resolves a requested mood transition honoring priority preemption and `1.5 s` minimum dwell.
 */
export function resolveMoodTransition(
  current: LumiDwellState,
  requested: LumiMood,
  nowMs: number,
  immediate = false,
): LumiDwellResolution {
  if (requested === current.activeMood) {
    return {
      nextState: { ...current, pendingMood: null },
      waitMs: 0,
    };
  }

  const curPrio = getMoodPriority(current.activeMood);
  const reqPrio = getMoodPriority(requested);
  const elapsed = Math.max(0, nowMs - current.enteredAtMs);

  // Higher priority, resting "idle" baseline, or direct touch feedback transitions immediately;
  // otherwise honor >= 1.5 s dwell
  if (
    immediate ||
    current.activeMood === "idle" ||
    reqPrio > curPrio ||
    elapsed >= LUMI_MIN_DWELL_MS
  ) {
    return {
      nextState: {
        activeMood: requested,
        pendingMood: null,
        enteredAtMs: nowMs,
      },
      waitMs: 0,
    };
  }

  // Queue lower/equal priority transition until minimum dwell finishes
  return {
    nextState: {
      activeMood: current.activeMood,
      pendingMood: requested,
      enteredAtMs: current.enteredAtMs,
    },
    waitMs: LUMI_MIN_DWELL_MS - elapsed,
  };
}

export function isAutoSleepyCondition(idleMs: number, nowDate: Date): boolean {
  return idleMs >= LUMI_IDLE_SLEEPY_MS || nowDate.getHours() >= LUMI_NIGHT_HOUR;
}

export function nextBlinkDelayMs(randomVal: number): number {
  const clamped = Math.max(0, Math.min(1, randomVal));
  return LUMI_BLINK_MIN_MS + Math.round(clamped * (LUMI_BLINK_MAX_MS - LUMI_BLINK_MIN_MS));
}

export function shouldDoubleBlink(randomVal: number): boolean {
  return randomVal >= 0 && randomVal < 0.1;
}

let activeSlotOwner: string | null = null;

export function claimLumiAnimationSlot(instanceId: string): boolean {
  if (activeSlotOwner === null || activeSlotOwner === instanceId) {
    activeSlotOwner = instanceId;
    return true;
  }
  return false;
}

export function releaseLumiAnimationSlot(instanceId: string): void {
  if (activeSlotOwner === instanceId) {
    activeSlotOwner = null;
  }
}

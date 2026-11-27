import { getMessages } from "../../i18n";
import type { LumiMood } from "./types";

export const LUMI_SPEECH_HISTORY_LIMIT = 10;
export const LUMI_MAX_WORDS_PER_BUBBLE = 8;
export const LUMI_TIP_COOLDOWN_MS = 60 * 60 * 1000;

export type LumiEventKind =
  | "startup"
  | "music"
  | "water"
  | "taskDone"
  | "streakMilestone"
  | "missedStreak"
  | "lowBattery"
  | "error"
  | "tip";

export interface LumiSilenceContext {
  mascotEnabled: boolean;
  talkLess: boolean;
  soundsEnabled: boolean;
  inCallOrMic: boolean;
  isFullscreen: boolean;
  focusActive: boolean;
  isPrayerWindow: boolean;
  isQuietHours: boolean;
}

export interface LumiSilenceDecision {
  silent: boolean;
  forceMood: LumiMood | null;
  allowBubbles: boolean;
  allowSounds: boolean;
}

export interface LumiSpeechState {
  recentLines: string[];
  lastTipAtMs: number | null;
}

export const INITIAL_LUMI_SPEECH_STATE: LumiSpeechState = {
  recentLines: [],
  lastTipAtMs: null,
};

/**
 * Enforces strict silence rules across calls/mic, fullscreen apps, Focus sessions,
 * prayer windows, and quiet hours.
 */
export function evaluateLumiSilence(ctx: LumiSilenceContext): LumiSilenceDecision {
  if (!ctx.mascotEnabled) {
    return { silent: true, forceMood: null, allowBubbles: false, allowSounds: false };
  }
  const mustBeSilent =
    ctx.inCallOrMic ||
    ctx.isFullscreen ||
    ctx.focusActive ||
    ctx.isPrayerWindow ||
    ctx.isQuietHours;

  if (mustBeSilent) {
    return {
      silent: true,
      forceMood: "calm",
      allowBubbles: false,
      allowSounds: false,
    };
  }

  return {
    silent: false,
    forceMood: null,
    allowBubbles: true,
    allowSounds: ctx.soundsEnabled,
  };
}

/**
 * Maps real application events into Lumi mood reactions.
 */
export function resolveLumiEventMood(eventKind: LumiEventKind): LumiMood {
  switch (eventKind) {
    case "startup":
      return "hello";
    case "music":
    case "water":
      return "happy";
    case "taskDone":
      return "celebrate";
    case "streakMilestone":
      return "love";
    case "missedStreak":
      return "calm";
    case "lowBattery":
      return "worried";
    case "error":
      return "oops";
    case "tip":
    default:
      return "curious";
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const TALK_LESS_ALLOWED_EVENTS = new Set<LumiEventKind>([
  "water",
  "streakMilestone",
  "lowBattery",
  "error",
]);

/**
 * Selects a bilingual friendly speech line (<= 8 words), never repeating within 10 occurrences,
 * capping tips to 1 per hour, and staying silent under calls/focus/prayer/quiet/talkLess.
 */
export function pickLumiSpeechLine(
  eventKind: LumiEventKind,
  language: "en" | "bn",
  state: LumiSpeechState,
  nowMs: number,
  ctx: LumiSilenceContext,
): { line: string | null; nextState: LumiSpeechState } {
  const silence = evaluateLumiSilence(ctx);
  if (!silence.allowBubbles) {
    return { line: null, nextState: state };
  }
  if (ctx.talkLess && !TALK_LESS_ALLOWED_EVENTS.has(eventKind)) {
    return { line: null, nextState: state };
  }
  if (
    eventKind === "tip" &&
    state.lastTipAtMs !== null &&
    nowMs - state.lastTipAtMs < LUMI_TIP_COOLDOWN_MS
  ) {
    return { line: null, nextState: state };
  }

  const msg = getMessages(language);
  const rawPool = msg.lumi.lines[eventKind] ?? [];
  const validPool = rawPool.filter((line) => countWords(line) <= LUMI_MAX_WORDS_PER_BUBBLE);
  if (validPool.length === 0) {
    return { line: null, nextState: state };
  }

  const recentSet = new Set(state.recentLines.slice(-LUMI_SPEECH_HISTORY_LIMIT));
  const unseen = validPool.filter((candidate) => !recentSet.has(candidate));
  const lastSpoken = state.recentLines[state.recentLines.length - 1];
  const chosen =
    unseen[0] ?? validPool.find((candidate) => candidate !== lastSpoken) ?? validPool[0];

  const nextRecent = [...state.recentLines, chosen].slice(-LUMI_SPEECH_HISTORY_LIMIT);
  return {
    line: chosen,
    nextState: {
      recentLines: nextRecent,
      lastTipAtMs: eventKind === "tip" ? nowMs : state.lastTipAtMs,
    },
  };
}

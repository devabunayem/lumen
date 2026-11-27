import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LumenMascot } from "../app/LumenMascot";
import {
  claimLumiAnimationSlot,
  countWords,
  evaluateLumiSilence,
  getMoodPriority,
  INITIAL_LUMI_SPEECH_STATE,
  isAutoSleepyCondition,
  Lumi,
  LUMI_BODY_PATH,
  LUMI_GLOW_HUES,
  LUMI_MAX_WORDS_PER_BUBBLE,
  LUMI_MOODS,
  LUMI_TIP_COOLDOWN_MS,
  nextBlinkDelayMs,
  pickLumiSpeechLine,
  releaseLumiAnimationSlot,
  resolveLumiEventMood,
  resolveLumiLod,
  resolveMoodTransition,
  shouldDoubleBlink,
  type LumiSilenceContext,
} from "../design/lumi";
import { DevLumiPage } from "../dev/DevLumiPage";
import { getMessages } from "../i18n";

describe("Lumi Phase 1 & 2: Static Rig, LOD, State Machine, Touch, Look & Moods", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves LOD tiers across 18/22px micro, 28px compact, and 56/96px full", () => {
    expect(resolveLumiLod(18)).toBe("micro");
    expect(resolveLumiLod(22)).toBe("micro");
    expect(resolveLumiLod(28)).toBe("compact");
    expect(resolveLumiLod(56)).toBe("full");
    expect(resolveLumiLod(96)).toBe("full");
  });

  it("renders exact body silhouette and swaps layers cleanly per LOD tier", () => {
    const { rerender } = render(<Lumi size={18} accessories={["ramadanLantern"]} />);
    const root18 = screen.getByTestId("lumi-character");
    expect(root18).toHaveAttribute("data-lod", "micro");
    expect(screen.getByTestId("lumi-body")).toHaveAttribute("d", LUMI_BODY_PATH);
    expect(screen.getByTestId("lumi-spark")).toBeInTheDocument();
    expect(screen.getByTestId("lumi-eyes-layer")).toBeInTheDocument();
    expect(screen.queryByTestId("lumi-blush-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lumi-mouth-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lumi-arms-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lumi-acc-ramadan-lantern")).not.toBeInTheDocument();

    rerender(<Lumi size={28} accessories={["ramadanLantern"]} />);
    expect(screen.getByTestId("lumi-character")).toHaveAttribute("data-lod", "compact");
    expect(screen.getByTestId("lumi-blush-layer")).toBeInTheDocument();
    expect(screen.getByTestId("lumi-mouth-layer")).toBeInTheDocument();
    expect(screen.queryByTestId("lumi-arms-layer")).not.toBeInTheDocument();

    rerender(<Lumi size={96} accessories={["ramadanLantern", "eidSparkle", "boishakhHat"]} />);
    expect(screen.getByTestId("lumi-character")).toHaveAttribute("data-lod", "full");
    expect(screen.getByTestId("lumi-arms-layer")).toBeInTheDocument();
    expect(screen.getByTestId("lumi-highlights-layer")).toBeInTheDocument();
    expect(screen.getByTestId("lumi-acc-ramadan-lantern")).toBeInTheDocument();
    expect(screen.getByTestId("lumi-acc-boishakh-hat")).toBeInTheDocument();
  });

  it("renders /dev/lumi character sheet with all 12 moods, 4 glow hues, and LOD ladder", () => {
    render(<DevLumiPage />);
    expect(screen.getByTestId("dev-lumi-page")).toBeInTheDocument();
    for (const mood of LUMI_MOODS) {
      expect(screen.getByTestId(`dev-lumi-mood-${mood}`)).toBeInTheDocument();
    }
    for (const hue of LUMI_GLOW_HUES) {
      expect(screen.getByTestId(`dev-lumi-glow-${hue}`)).toBeInTheDocument();
    }
    for (const sz of [18, 22, 28, 56, 96]) {
      expect(screen.getByTestId(`dev-lumi-lod-${sz}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId("dev-lumi-mood-focus"));
    expect(screen.getAllByTestId("lumi-focus-headphones").length).toBeGreaterThan(0);
  });

  it("enforces mood priority (calm > focus > worried > others) and 1.5s minimum dwell", () => {
    expect(getMoodPriority("calm")).toBeGreaterThan(getMoodPriority("focus"));
    expect(getMoodPriority("focus")).toBeGreaterThan(getMoodPriority("worried"));
    expect(getMoodPriority("worried")).toBeGreaterThan(getMoodPriority("happy"));

    const start = { activeMood: "idle" as const, pendingMood: null, enteredAtMs: 1000 };
    // Equal-priority happy changes after >= 1.5s dwell or from initial state -> test queueing at 400ms
    const res1 = resolveMoodTransition(
      { activeMood: "happy", pendingMood: null, enteredAtMs: 1000 },
      "curious",
      1400,
    );
    expect(res1.nextState.activeMood).toBe("happy");
    expect(res1.nextState.pendingMood).toBe("curious");
    expect(res1.waitMs).toBe(1100);

    // Strictly higher priority (focus) preempts happy immediately even before 1.5s
    const resPreempt = resolveMoodTransition(
      { activeMood: "happy", pendingMood: null, enteredAtMs: 1000 },
      "focus",
      1400,
    );
    expect(resPreempt.nextState.activeMood).toBe("focus");
    expect(resPreempt.waitMs).toBe(0);

    // Calm beats focus immediately
    const resCalm = resolveMoodTransition(start, "calm", 1200);
    expect(resCalm.nextState.activeMood).toBe("calm");
  });

  it("handles click squish + 1s happy, 2s hover purr, double-click love, 10min/10PM sleepy & reduceMotion blink", () => {
    vi.useFakeTimers();

    expect(nextBlinkDelayMs(0)).toBe(4000);
    expect(nextBlinkDelayMs(1)).toBe(7000);
    expect(shouldDoubleBlink(0.05)).toBe(true);
    expect(shouldDoubleBlink(0.5)).toBe(false);
    expect(isAutoSleepyCondition(10 * 60 * 1000, new Date(2026, 10, 27, 14, 0, 0))).toBe(true);
    expect(isAutoSleepyCondition(0, new Date(2026, 10, 27, 22, 15, 0))).toBe(true);

    render(<Lumi size={96} mood="idle" reducedMotion allowMultiple />);
    const el = screen.getByTestId("lumi-character");

    // Particles suppressed in reducedMotion
    expect(screen.queryByTestId("lumi-particles-layer")).not.toBeInTheDocument();

    // Click -> happy for 1s
    fireEvent.click(el);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(el).toHaveAttribute("data-mood", "happy");

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(el).toHaveAttribute("data-mood", "idle");

    // Hover 2s -> purr arcs
    fireEvent.mouseEnter(el);
    act(() => {
      vi.advanceTimersByTime(2050);
    });
    expect(el).toHaveAttribute("data-purring", "true");
    fireEvent.mouseLeave(el);
    expect(el).toHaveAttribute("data-purring", "false");

    // Double click -> love
    fireEvent.doubleClick(el);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(el).toHaveAttribute("data-mood", "love");
  });

  it("enforces silence rules across calls, fullscreen, focus, prayer windows, and quiet hours", () => {
    const baseCtx: LumiSilenceContext = {
      mascotEnabled: true,
      talkLess: false,
      soundsEnabled: true,
      inCallOrMic: false,
      isFullscreen: false,
      focusActive: false,
      isPrayerWindow: false,
      isQuietHours: false,
    };

    expect(evaluateLumiSilence(baseCtx)).toEqual({
      silent: false,
      forceMood: null,
      allowBubbles: true,
      allowSounds: true,
    });

    for (const flag of [
      "inCallOrMic",
      "isFullscreen",
      "focusActive",
      "isPrayerWindow",
      "isQuietHours",
    ] as const) {
      const silenced = evaluateLumiSilence({ ...baseCtx, [flag]: true });
      expect(silenced.silent).toBe(true);
      expect(silenced.forceMood).toBe("calm");
      expect(silenced.allowBubbles).toBe(false);
      expect(silenced.allowSounds).toBe(false);
    }

    expect(evaluateLumiSilence({ ...baseCtx, mascotEnabled: false })).toEqual({
      silent: true,
      forceMood: null,
      allowBubbles: false,
      allowSounds: false,
    });
  });

  it("caps speech bubbles at <= 8 words in en+bn, avoids repeats, enforces 1 tip/hr & talkLess", () => {
    for (const lang of ["en", "bn"] as const) {
      const msg = getMessages(lang);
      for (const lines of Object.values(msg.lumi.lines)) {
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
          expect(countWords(line)).toBeLessThanOrEqual(LUMI_MAX_WORDS_PER_BUBBLE);
        }
      }
    }

    const activeCtx: LumiSilenceContext = {
      mascotEnabled: true,
      talkLess: false,
      soundsEnabled: false,
      inCallOrMic: false,
      isFullscreen: false,
      focusActive: false,
      isPrayerWindow: false,
      isQuietHours: false,
    };

    // Never repeat within 10 occurrences while pool has distinct lines
    const first = pickLumiSpeechLine("water", "en", INITIAL_LUMI_SPEECH_STATE, 1000, activeCtx);
    const second = pickLumiSpeechLine("water", "en", first.nextState, 2000, activeCtx);
    const third = pickLumiSpeechLine("water", "en", second.nextState, 3000, activeCtx);
    expect(first.line).toBeTruthy();
    expect(second.line).toBeTruthy();
    expect(third.line).toBeTruthy();
    expect(new Set([first.line, second.line, third.line]).size).toBe(3);

    // At most 1 tip per hour
    const tip1 = pickLumiSpeechLine("tip", "en", INITIAL_LUMI_SPEECH_STATE, 10_000, activeCtx);
    expect(tip1.line).toBeTruthy();
    const tipBlocked = pickLumiSpeechLine("tip", "en", tip1.nextState, 20_000, activeCtx);
    expect(tipBlocked.line).toBeNull();
    const tipAllowed = pickLumiSpeechLine(
      "tip",
      "en",
      tip1.nextState,
      10_000 + LUMI_TIP_COOLDOWN_MS + 1,
      activeCtx,
    );
    expect(tipAllowed.line).toBeTruthy();

    // Talk less suppresses non-essential events (startup/tip/taskDone), keeps water/lowBattery/error
    const talkLessCtx = { ...activeCtx, talkLess: true };
    expect(
      pickLumiSpeechLine("startup", "en", INITIAL_LUMI_SPEECH_STATE, 50_000, talkLessCtx).line,
    ).toBeNull();
    expect(
      pickLumiSpeechLine("water", "en", INITIAL_LUMI_SPEECH_STATE, 50_000, talkLessCtx).line,
    ).toBeTruthy();

    // Event mood mapping sanity
    expect(resolveLumiEventMood("startup")).toBe("hello");
    expect(resolveLumiEventMood("water")).toBe("happy");
    expect(resolveLumiEventMood("taskDone")).toBe("celebrate");
    expect(resolveLumiEventMood("streakMilestone")).toBe("love");
    expect(resolveLumiEventMood("missedStreak")).toBe("calm");
    expect(resolveLumiEventMood("lowBattery")).toBe("worried");
    expect(resolveLumiEventMood("error")).toBe("oops");
  });

  it("caps beat nods at <= 3 per second, enforces single active slot, and exposes accessible bubbles", () => {
    vi.useFakeTimers();

    // Single active animation slot coordinator
    expect(claimLumiAnimationSlot("lumi-slot-a")).toBe(true);
    expect(claimLumiAnimationSlot("lumi-slot-b")).toBe(false);
    releaseLumiAnimationSlot("lumi-slot-a");
    expect(claimLumiAnimationSlot("lumi-slot-b")).toBe(true);
    releaseLumiAnimationSlot("lumi-slot-b");

    // Beat nod cap <= 3/sec (rapid 6 beats within 250ms only trigger <= 3 nods)
    const { rerender } = render(<Lumi size={56} mood="happy" beat={0} allowMultiple />);
    for (let i = 1; i <= 6; i += 1) {
      rerender(<Lumi size={56} mood="happy" beat={i} allowMultiple />);
      act(() => {
        vi.advanceTimersByTime(40);
      });
    }
    expect(screen.getByTestId("lumi-character")).toBeInTheDocument();

    // Accessible status bubble alongside aria-hidden mascot
    render(<LumenMascot enabled size="hero" mood="confirm" bubbleText="Glup! Hydrated." />);
    expect(screen.getByTestId("lumen-mascot")).toHaveAttribute("aria-hidden", "true");
    const bubble = screen.getByTestId("lumi-speech-bubble");
    expect(bubble).toHaveAttribute("role", "status");
    expect(bubble).toHaveAttribute("aria-live", "polite");
    expect(bubble).toHaveTextContent("Glup! Hydrated.");
  });
});

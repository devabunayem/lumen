import { beforeEach, describe, expect, it } from "vitest";
import {
  canTriggerRateLimitedSound,
  resetSoundRateLimiterForTests,
  shouldAllowUiSound,
  type SoundSilenceState,
} from "../design/sounds";
import {
  buildContrastSafeGlowRgba,
  contrastRatioAgainstWhite,
} from "../home/hooks/useAmbientPalette";
import { formatNextCountdown, resolveNextCountdown } from "../home/hooks/useDayArcGeometry";
import { formatDigits } from "../i18n/digits";

describe("Countdown rules, contrast guard, i18n digits & sound silence rules", () => {
  beforeEach(() => {
    resetSoundRateLimiterForTests();
  });

  it("assigns NextCard dot thresholds (>10 green, <10 orange, <2 red) and empty fallback", () => {
    const now = new Date(2026, 10, 26, 16, 41, 0);

    const greenEv = resolveNextCountdown(
      [{ id: 1, title: "Standup", start_at: "16:53", created_at: "" }],
      [],
      null,
      now,
      "en",
      "All clear",
    );
    expect(greenEv.minsUntil).toBe(12);
    expect(greenEv.statusColor).toBe("var(--accent-green)");

    const orangeEv = resolveNextCountdown(
      [{ id: 2, title: "Sync", start_at: "16:47", created_at: "" }],
      [],
      null,
      now,
      "en",
      "All clear",
    );
    expect(orangeEv.minsUntil).toBe(6);
    expect(orangeEv.statusColor).toBe("var(--accent-orange)");

    const redEv = resolveNextCountdown(
      [{ id: 3, title: "Call", start_at: "16:42", created_at: "" }],
      [],
      null,
      now,
      "en",
      "All clear",
    );
    expect(redEv.minsUntil).toBe(1);
    expect(redEv.statusColor).toBe("var(--accent-red)");

    const clear = resolveNextCountdown([], [], null, now, "en", "All clear");
    expect(clear.isAllClear).toBe(true);
    expect(clear.title).toBe("All clear");
  });

  it("enforces all sound silence conditions and 40 ms arc scrub tick rate limit", () => {
    const base: SoundSilenceState = {
      soundEnabled: true,
      soundInterface: true,
      soundReminders: true,
      inCallOrMicActive: false,
      isFullscreen: false,
      focusSessionActive: false,
      windowsMuted: false,
      quietHoursActive: false,
    };

    expect(shouldAllowUiSound("open", base)).toBe(true);
    expect(shouldAllowUiSound("open", { ...base, soundEnabled: false })).toBe(false);
    expect(shouldAllowUiSound("open", { ...base, inCallOrMicActive: true })).toBe(false);
    expect(shouldAllowUiSound("open", { ...base, isFullscreen: true })).toBe(false);
    expect(shouldAllowUiSound("open", { ...base, focusSessionActive: true })).toBe(false);
    expect(shouldAllowUiSound("open", { ...base, windowsMuted: true })).toBe(false);
    expect(shouldAllowUiSound("open", { ...base, quietHoursActive: true })).toBe(false);
    expect(shouldAllowUiSound("open", { ...base, soundInterface: false })).toBe(false);
    expect(shouldAllowUiSound("reminder_chime", { ...base, soundInterface: false })).toBe(true);
    expect(shouldAllowUiSound("reminder_chime", { ...base, soundReminders: false })).toBe(false);

    expect(canTriggerRateLimitedSound("arc_scrub_tick", 1000)).toBe(true);
    expect(canTriggerRateLimitedSound("arc_scrub_tick", 1020)).toBe(false);
    expect(canTriggerRateLimitedSound("arc_scrub_tick", 1045)).toBe(true);
  });

  it("keeps album glow contrast >= 4.5:1 against white text and converts Bangla numerals", () => {
    for (const hex of ["#ff0055", "#ffffff", "#ffd060", "#0a84ff", "#d6336c"]) {
      const rgba = buildContrastSafeGlowRgba(hex, 0.42, false);
      const match = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(rgba);
      expect(match).not.toBeNull();
      const alpha = Number(match![4]);
      const ratio = contrastRatioAgainstWhite({
        r: Math.round(Number(match![1]) * alpha),
        g: Math.round(Number(match![2]) * alpha),
        b: Math.round(Number(match![3]) * alpha),
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }

    expect(formatDigits("29° · 5:11 PM", true)).toBe("২৯° · ৫:১১ PM");
  });

  it("formats NextCard countdowns in minutes (<60) and hours+minutes (>=60)", () => {
    const units = { min: "min", hour: "h", minShort: "m" };
    expect(formatNextCountdown(45, units)).toBe("45 min");
    expect(formatNextCountdown(60, units)).toBe("1h");
    expect(formatNextCountdown(575, units)).toBe("9h 35m");
  });
});

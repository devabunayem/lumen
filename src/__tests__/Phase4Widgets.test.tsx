import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HudOverlay } from "../app/HudOverlay";
import { FocusCard } from "../calendar/FocusCard";
import { ShelfWidget } from "../widgets/shelf/ShelfWidget";

describe("Phase 4 Widgets (Focus Flow, Shelf, HUD)", () => {
  it("renders Focus countdown, Prayer Ask prompt, and Free Focus log task prompt", () => {
    const onToggle = vi.fn();
    const onSkip = vi.fn();
    const onRespondPrayer = vi.fn();
    const onLogFree = vi.fn();
    const { rerender } = render(
      <FocusCard
        pomodoro={{
          phase: "focus",
          remaining_secs: 1205,
          total_secs: 1500,
          running: true,
          cycle_index: 1,
          cycles_before_long: 4,
          daily_focus_minutes: 50,
          chime_tick: 0,
        }}
        boundTaskTitle="Design review"
        socialBlockedArmed
        language="en"
        banglaDigits={false}
        reduceMotion
        onToggleFocus={onToggle}
        onSkipFocus={onSkip}
      />,
    );
    expect(screen.getByText("20:05")).toBeInTheDocument();
    expect(screen.getByText("2 of 4")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cal-focus-cta"));
    expect(onToggle).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("cal-focus-skip"));
    expect(onSkip).toHaveBeenCalled();

    rerender(
      <FocusCard
        pomodoro={{
          phase: "focus",
          remaining_secs: 900,
          total_secs: 1500,
          running: true,
          cycle_index: 0,
          cycles_before_long: 4,
          daily_focus_minutes: 50,
          chime_tick: 0,
        }}
        focusFlow={{
          config: {
            focusMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            rounds: 4,
            socialBlockedArmed: true,
            syncDnd: true,
            syncTimeLedger: true,
            prayerArrivalMode: "ask",
          },
          boundTaskId: null,
          boundTaskTitle: null,
          pausedForPrayer: null,
          prayerPrompt: { prayerKey: "2026-11-26:Maghrib", prayerName: "Maghrib" },
          freeFocusLogPrompt: null,
          lumiCompanionMode: "body_double_focus",
          socialBlockActive: true,
          dndActive: true,
          timeLedgerActive: true,
        }}
        boundTaskTitle={null}
        socialBlockedArmed
        language="en"
        banglaDigits={false}
        reduceMotion
        onToggleFocus={onToggle}
        onRespondPrayerPrompt={onRespondPrayer}
      />,
    );
    fireEvent.click(screen.getByTestId("cal-prayer-pause-btn"));
    expect(onRespondPrayer).toHaveBeenCalledWith(true);

    rerender(
      <FocusCard
        pomodoro={{
          phase: "short_break",
          remaining_secs: 300,
          total_secs: 300,
          running: false,
          cycle_index: 1,
          cycles_before_long: 4,
          daily_focus_minutes: 75,
          chime_tick: 1,
        }}
        focusFlow={{
          config: {
            focusMin: 25,
            shortBreakMin: 5,
            longBreakMin: 15,
            rounds: 4,
            socialBlockedArmed: true,
            syncDnd: true,
            syncTimeLedger: true,
            prayerArrivalMode: "ask",
          },
          boundTaskId: null,
          boundTaskTitle: null,
          pausedForPrayer: null,
          prayerPrompt: null,
          freeFocusLogPrompt: {
            durationMin: 25,
            completedAt: "2026-11-26T16:00:00Z",
            suggestedTitle: "Deep architecture pass",
          },
          lumiCompanionMode: "celebrate_focus",
          socialBlockActive: false,
          dndActive: false,
          timeLedgerActive: false,
        }}
        boundTaskTitle={null}
        socialBlockedArmed
        language="en"
        banglaDigits={false}
        reduceMotion
        onToggleFocus={onToggle}
        onLogFreeFocusTask={onLogFree}
      />,
    );
    fireEvent.click(screen.getByTestId("cal-free-focus-save-btn"));
    expect(onLogFree).toHaveBeenCalledWith("Deep architecture pass");
  });

  it("renders Shelf items, marks missing files, and submits links", () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    render(
      <ShelfWidget
        items={[
          {
            id: 1,
            kind: "file",
            path_or_text: "C:\\notes.txt",
            display_name: "notes.txt",
            available: true,
            added_at: "",
          },
          {
            id: 2,
            kind: "file",
            path_or_text: "C:\\gone.txt",
            display_name: "gone.txt",
            available: false,
            added_at: "",
          },
        ]}
        onAdd={onAdd}
        onOpen={onOpen}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("notes.txt"));
    expect(onOpen).toHaveBeenCalledWith("C:\\notes.txt");
    expect(screen.getByTitle("Missing file")).toBeInTheDocument();

    const input = screen.getByLabelText("Drop or paste link or note");
    fireEvent.change(input, { target: { value: "https://github.com/devabunayem/lumen" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("link", "https://github.com/devabunayem/lumen");
  });

  it("renders transient HudOverlay with label and progress", () => {
    render(
      <HudOverlay
        hud={{
          kind: "volume",
          label: "Volume 72%",
          value_pct: 72,
          active: true,
        }}
      />,
    );
    expect(screen.getByText("Volume 72%")).toBeInTheDocument();
  });
});

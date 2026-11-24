import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HudOverlay } from "../app/HudOverlay";
import { PomodoroWidget } from "../widgets/pomodoro/PomodoroWidget";
import { ShelfWidget } from "../widgets/shelf/ShelfWidget";

describe("Phase 4 Widgets (Pomodoro, Shelf, HUD)", () => {
  it("renders Pomodoro countdown and triggers start/skip/reset", () => {
    const onToggle = vi.fn();
    const onSkip = vi.fn();
    render(
      <PomodoroWidget
        pomodoro={{
          phase: "focus",
          remaining_secs: 1205,
          total_secs: 1500,
          running: false,
          cycle_index: 1,
          cycles_before_long: 4,
          daily_focus_minutes: 50,
          chime_tick: 0,
        }}
        onToggle={onToggle}
        onSkip={onSkip}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("20:05")).toBeInTheDocument();
    expect(screen.getByText("50 min focused today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onToggle).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalled();
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

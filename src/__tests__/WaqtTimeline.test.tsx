import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IslandShell } from "../app/IslandShell";
import { INITIAL_ISLAND_CONTEXT, useIslandStore } from "../app/stateMachine";
import { BASE_GEOMETRY } from "../design/tokens";
import { DevStatesPage } from "../dev/DevStatesPage";
import type { PrayerSchedule, TaskItem } from "../lib/ipc";
import { WaqtTimeline } from "../waqt/WaqtTimeline";

const sampleSchedule: PrayerSchedule = {
  city_name: "Dhaka",
  next_name_en: "Asr",
  next_name_bn: "আসর",
  next_time_12h: "3:40 PM",
  next_is_tomorrow: false,
  countdown_text: "in 1 h 35 min",
  progress_pct: 58,
  sun_arc_ratio: 0.52,
  is_friday: false,
  is_ramadan: false,
  hijri_date: "16 Jumada II 1448 AH",
  sehri_iftar_label: "",
  slots: [
    {
      id: "fajr",
      name_en: "Fajr",
      name_bn: "ফজর",
      time_12h: "5:04 AM",
      minute_of_day: 304,
      arc_ratio: 0,
      passed: true,
    },
    {
      id: "dhuhr",
      name_en: "Dhuhr",
      name_bn: "যোহর",
      time_12h: "11:50 AM",
      minute_of_day: 710,
      arc_ratio: 0.42,
      passed: true,
    },
    {
      id: "asr",
      name_en: "Asr",
      name_bn: "আসর",
      time_12h: "3:40 PM",
      minute_of_day: 940,
      arc_ratio: 0.65,
      passed: false,
    },
    {
      id: "maghrib",
      name_en: "Maghrib",
      name_bn: "মাগরিব",
      time_12h: "5:16 PM",
      minute_of_day: 1036,
      arc_ratio: 0.84,
      passed: false,
    },
    {
      id: "isha",
      name_en: "Isha",
      name_bn: "এশা",
      time_12h: "6:35 PM",
      minute_of_day: 1115,
      arc_ratio: 1,
      passed: false,
    },
  ],
};

describe("Waqt Timeline Page (Page 2 after Home)", () => {
  it("opens as Page 2 right after Home at identical 640x312 island size", async () => {
    useIslandStore.setState({ ...INITIAL_ISLAND_CONTEXT, state: "expanded" });
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);

    // Starts on Home at 640x312
    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
    const pill = screen.getByTestId("lumen-island-pill");
    expect(pill).toHaveAttribute("data-target-width", String(BASE_GEOMETRY.homeExpanded.width));
    expect(pill).toHaveAttribute("data-target-height", String(BASE_GEOMETRY.homeExpanded.height));

    // Page dot #2 (index 1) navigates immediately to Waqt Timeline with exact same 640x312 bounds
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(await screen.findByTestId("waqt-timeline-page")).toBeInTheDocument();
    expect(pill).toHaveAttribute("data-target-width", String(BASE_GEOMETRY.homeExpanded.width));
    expect(pill).toHaveAttribute("data-target-height", String(BASE_GEOMETRY.homeExpanded.height));
  });

  it("renders 5 Waqt blocks, sun scrubbing, keyboard Move menu, and Focus Flow Start", () => {
    const onAssignTask = vi.fn();
    const onStartFocusFlow = vi.fn();
    const onDismissHint = vi.fn();
    const onToggleTask = vi.fn();

    const tasks: TaskItem[] = [
      {
        id: 11,
        title: "Design review",
        done: false,
        due_at: null,
        created_at: new Date().toISOString(),
        estimate_min: 45,
        block_id: "dhuhr",
        kind: "task",
      },
      {
        id: 12,
        title: "Call supplier",
        done: false,
        due_at: null,
        created_at: new Date().toISOString(),
        estimate_min: 15,
        block_id: null,
        kind: "task",
      },
    ];

    render(
      <WaqtTimeline
        waqtState={null}
        nowDate={new Date(2026, 10, 27, 14, 5, 0)}
        schedule={sampleSchedule}
        tasks={tasks}
        calendarEvents={[]}
        pomodoro={{
          phase: "focus",
          remaining_secs: 25 * 60,
          total_secs: 25 * 60,
          running: false,
          cycle_index: 0,
          cycles_before_long: 4,
          daily_focus_minutes: 130,
          chime_tick: 0,
        }}
        waterTodayMl={500}
        banglaDigits={false}
        reduceMotion
        reduceTransparency={false}
        isVisible
        locationConfigured
        bedtimeHHMM="23:30"
        prayerPauseMode="ask"
        ramadanTaraweeh={false}
        hintDismissed={false}
        customBlockNames={{}}
        pagesCount={9}
        activePageIndex={1}
        onSelectPage={vi.fn()}
        onOpenSettings={vi.fn()}
        onAssignTask={onAssignTask}
        onToggleTask={onToggleTask}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onRestoreTask={vi.fn()}
        onChangeEstimate={vi.fn()}
        onMoveOverflow={vi.fn()}
        onRenameBlock={vi.fn()}
        onRolloverYesterday={vi.fn()}
        onStartFocusFlow={onStartFocusFlow}
        onToggleFocusPause={vi.fn()}
        onResetFocus={vi.fn()}
        onDismissHint={onDismissHint}
        onLogActivity={vi.fn()}
      />,
    );

    expect(screen.getByTestId("waqt-block-fajr")).toBeInTheDocument();
    expect(screen.getByTestId("waqt-block-dhuhr")).toHaveAttribute("data-current", "true");
    expect(screen.getByTestId("waqt-block-asr")).toBeInTheDocument();
    expect(screen.getByTestId("waqt-block-maghrib")).toBeInTheDocument();
    expect(screen.getByTestId("waqt-block-isha")).toBeInTheDocument();
    expect(screen.getByTestId("waqt-lumi-body-double")).toHaveAttribute(
      "data-body-state",
      "idle_working",
    );

    // Keyboard scrub on rail dismisses hint and displays scrub tooltip
    expect(screen.getByTestId("waqt-scrub-hint")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("waqt-rail"), { key: "ArrowLeft" });
    expect(onDismissHint).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("waqt-scrub-hint")).not.toBeInTheDocument();
    expect(screen.getByTestId("waqt-scrub-tooltip")).toBeInTheDocument();

    // Unplanned chip opens Move menu -> assign to Asr block
    fireEvent.click(screen.getByTestId("waqt-unplanned-12"));
    const menu = screen.getByTestId("waqt-move-menu");
    fireEvent.click(menu.querySelector("button:nth-child(3)")!);
    expect(onAssignTask).toHaveBeenCalledWith(12, "asr");

    // Toggle task done
    fireEvent.click(screen.getByRole("button", { name: "Toggle Design review" }));
    expect(onToggleTask).toHaveBeenCalledWith(11);

    // Start Focus Flow on active task
    fireEvent.click(screen.getByTestId("waqt-start-focus-btn"));
    expect(onStartFocusFlow).toHaveBeenCalledWith(11);
  });

  it("handles S0 empty day cleanly: free focus, rhythm anchors, max-1 suggestion caps & dismissal", () => {
    const onDismissSuggestion = vi.fn();
    const onStartFocusFlow = vi.fn();

    render(
      <WaqtTimeline
        waqtState={null}
        nowDate={new Date(2026, 10, 27, 13, 0, 0)}
        schedule={sampleSchedule}
        tasks={[]}
        calendarEvents={[]}
        pomodoro={{
          phase: "focus",
          remaining_secs: 25 * 60,
          total_secs: 25 * 60,
          running: false,
          cycle_index: 0,
          cycles_before_long: 4,
          daily_focus_minutes: 0,
          chime_tick: 0,
        }}
        waterTodayMl={500}
        banglaDigits={false}
        reduceMotion
        reduceTransparency={false}
        isVisible
        locationConfigured
        bedtimeHHMM="23:30"
        prayerPauseMode="ask"
        ramadanTaraweeh={false}
        hintDismissed={false}
        customBlockNames={{}}
        pagesCount={9}
        activePageIndex={1}
        onSelectPage={vi.fn()}
        onOpenSettings={vi.fn()}
        onAssignTask={vi.fn()}
        onToggleTask={vi.fn()}
        onAddTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onRestoreTask={vi.fn()}
        onChangeEstimate={vi.fn()}
        onMoveOverflow={vi.fn()}
        onRenameBlock={vi.fn()}
        onRolloverYesterday={vi.fn()}
        onStartFocusFlow={onStartFocusFlow}
        onToggleFocusPause={vi.fn()}
        onResetFocus={vi.fn()}
        onDismissHint={vi.fn()}
        onDismissSuggestion={onDismissSuggestion}
        onLogActivity={vi.fn()}
      />,
    );

    expect(screen.getByTestId("waqt-empty-hint")).toHaveTextContent("Pick one thing for Midday");
    expect(screen.getByText("Free focus 25 min")).toBeInTheDocument();
    expect(screen.getByText("Your day builds here")).toBeInTheDocument();
    expect(screen.getAllByTestId("waqt-spark-dotted")).toHaveLength(10);
    expect(screen.getByTestId("waqt-unplanned-empty")).toBeInTheDocument();

    // Suggestions only appear in current (dhuhr) and next (asr), never later blocks
    expect(screen.getByTestId("waqt-suggestion-dhuhr")).toBeInTheDocument();
    expect(screen.getByTestId("waqt-suggestion-asr")).toBeInTheDocument();
    expect(screen.queryByTestId("waqt-suggestion-maghrib")).not.toBeInTheDocument();
    expect(screen.queryByTestId("waqt-suggestion-isha")).not.toBeInTheDocument();

    // Dismissing suggestion hides it and triggers persistence callback; "+ Add one thing" appears
    fireEvent.click(screen.getByTestId("waqt-dismiss-sug-dhuhr"));
    expect(onDismissSuggestion).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("waqt-suggestion-dhuhr")).not.toBeInTheDocument();
    expect(screen.getByTestId("waqt-add-one-thing")).toBeInTheDocument();

    // Free focus runs without requiring a bound task
    fireEvent.click(screen.getByTestId("waqt-start-focus-btn"));
    expect(onStartFocusFlow).toHaveBeenCalledWith(null);
  });

  it("supports S5 4+ task expanded sheet morph, S7 overbooked move, S9 night preview, S15 loading, S16 error, and S17 Ctrl+N quick add", () => {
    const onAddTask = vi.fn();
    const onAssignBatch = vi.fn();
    const onRetry = vi.fn();

    const fourTasks: TaskItem[] = [
      {
        id: 1,
        title: "Task 1",
        done: false,
        due_at: null,
        created_at: "",
        estimate_min: 30,
        block_id: "dhuhr",
        kind: "task",
      },
      {
        id: 2,
        title: "Task 2",
        done: false,
        due_at: null,
        created_at: "",
        estimate_min: 30,
        block_id: "dhuhr",
        kind: "task",
      },
      {
        id: 3,
        title: "Task 3",
        done: false,
        due_at: null,
        created_at: "",
        estimate_min: 30,
        block_id: "dhuhr",
        kind: "task",
      },
      {
        id: 4,
        title: "Task 4",
        done: false,
        due_at: null,
        created_at: "",
        estimate_min: 30,
        block_id: "dhuhr",
        kind: "task",
      },
      {
        id: 5,
        title: "Inbox task",
        done: false,
        due_at: null,
        created_at: "",
        estimate_min: 20,
        block_id: null,
        kind: "task",
      },
    ];

    const baseProps = {
      waqtState: null,
      nowDate: new Date(2026, 10, 27, 14, 30, 0), // 14:30 -> 70m left in dhuhr, 140m booked -> overbooked
      schedule: sampleSchedule,
      tasks: fourTasks,
      calendarEvents: [],
      pomodoro: {
        phase: "focus" as const,
        remaining_secs: 25 * 60,
        total_secs: 25 * 60,
        running: false,
        cycle_index: 0,
        cycles_before_long: 4,
        daily_focus_minutes: 60,
        chime_tick: 0,
      },
      waterTodayMl: 500,
      banglaDigits: false,
      reduceMotion: true,
      reduceTransparency: false,
      isVisible: true,
      locationConfigured: true,
      bedtimeHHMM: "23:30",
      prayerPauseMode: "ask" as const,
      ramadanTaraweeh: false,
      hintDismissed: true,
      customBlockNames: {},
      pagesCount: 9,
      activePageIndex: 1,
      onSelectPage: vi.fn(),
      onOpenSettings: vi.fn(),
      onAssignTask: vi.fn(),
      onAssignBatch,
      onToggleTask: vi.fn(),
      onAddTask,
      onDeleteTask: vi.fn(),
      onRestoreTask: vi.fn(),
      onChangeEstimate: vi.fn(),
      onMoveOverflow: vi.fn(),
      onRenameBlock: vi.fn(),
      onRolloverYesterday: vi.fn(),
      onStartFocusFlow: vi.fn(),
      onToggleFocusPause: vi.fn(),
      onResetFocus: vi.fn(),
      onDismissHint: vi.fn(),
      onLogActivity: vi.fn(),
    };

    const { rerender } = render(<WaqtTimeline {...baseProps} />);

    // Single-block overflow shows concise move control without falsely claiming the whole day is full
    expect(screen.queryByTestId("waqt-day-full-banner")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("waqt-move-overflow-dhuhr"));
    expect(onAssignBatch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("waqt-undo-toast")).toBeInTheDocument();

    // Plan my day Preview + Accept
    fireEvent.click(screen.getByTestId("waqt-plan-my-day-btn"));
    expect(screen.getByTestId("waqt-plan-preview-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("waqt-plan-accept-btn"));
    expect(onAssignBatch).toHaveBeenCalledTimes(2);

    // S7 True Day Full when total remaining surplus < deficit
    rerender(
      <WaqtTimeline
        {...baseProps}
        tasks={[
          ...fourTasks,
          {
            id: 6,
            title: "Late marathon",
            done: false,
            due_at: null,
            created_at: "",
            estimate_min: 520,
            block_id: "isha",
            kind: "task",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("waqt-day-full-banner")).toBeInTheDocument();
    rerender(<WaqtTimeline {...baseProps} />);

    // S5 4+ task expand + Escape close
    fireEvent.click(screen.getByTestId("waqt-block-expand-dhuhr"));
    expect(screen.getByTestId("waqt-block-sheet-dhuhr")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("waqt-block-sheet-dhuhr")).not.toBeInTheDocument();

    // S17 Ctrl+N quick add parser
    fireEvent.keyDown(window, { key: "n", ctrlKey: true });
    const input = screen.getByTestId("waqt-quick-add-input");
    fireEvent.change(input, { target: { value: "design review 25" } });
    fireEvent.submit(screen.getByTestId("waqt-quick-add-form"));
    expect(onAddTask).toHaveBeenCalledWith("design review", "dhuhr", 25, null);

    // S9 After Isha shows Tomorrow preview
    rerender(<WaqtTimeline {...baseProps} nowDate={new Date(2026, 10, 27, 21, 15, 0)} />);
    expect(screen.getByTestId("waqt-tomorrow-preview")).toBeInTheDocument();

    // S15 Loading skeleton & S16 Error Retry
    rerender(<WaqtTimeline {...baseProps} tasks={[]} loading />);
    expect(screen.getByTestId("waqt-loading-skeleton")).toBeInTheDocument();

    rerender(
      <WaqtTimeline {...baseProps} tasks={[]} loading={false} error="Offline" onRetry={onRetry} />,
    );
    expect(screen.getByTestId("waqt-error-state")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("waqt-retry-button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders all S0-S17 states in /dev/states Waqt Timeline gallery", () => {
    render(<DevStatesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Waqt Timeline (S0–S17)" }));
    for (let i = 0; i <= 17; i += 1) {
      expect(screen.getByTestId(`dev-waqt-state-S${i}`)).toBeInTheDocument();
    }
  });
});

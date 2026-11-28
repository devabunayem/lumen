import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayArc } from "../home/components/DayArc";
import { MusicCard } from "../home/components/MusicCard";
import { computeDayArcGeometry } from "../home/hooks/useDayArcGeometry";
import { TodoCard } from "../calendar/TodoCard";
import { WaterWidget } from "../widgets/water/WaterWidget";

describe("Phase 3 Core Widgets", () => {
  it("renders Calendar Hub TodoCard counter and adds/toggles tasks", () => {
    const onCreateTask = vi.fn();
    const onToggleTask = vi.fn();
    const onOpenQuickAdd = vi.fn();
    const { rerender } = render(
      <TodoCard
        tasks={[
          {
            id: 1,
            title: "Write tests",
            dueDate: "2026-11-26",
            dueTime: null,
            estimateMin: 15,
            doneAt: "2026-11-26T09:00:00Z",
            client: null,
            projectId: null,
            isDeadline: false,
            createdAt: "",
          },
          {
            id: 2,
            title: "Ship Phase 3",
            dueDate: "2026-11-26",
            dueTime: "20:00",
            estimateMin: 25,
            doneAt: null,
            client: null,
            projectId: null,
            isDeadline: false,
            createdAt: "",
          },
        ]}
        nowDate={new Date(2026, 10, 26, 16, 0, 0)}
        todayDateKey="2026-11-26"
        selectedDateKey="2026-11-26"
        language="en"
        banglaDigits={false}
        reduceMotion
        onToggleTask={onToggleTask}
        onOpenQuickAdd={onOpenQuickAdd}
        onCreateTask={onCreateTask}
      />,
    );
    expect(screen.getByText("1 left")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cal-todo-add-btn"));
    expect(onOpenQuickAdd).toHaveBeenCalled();

    rerender(
      <TodoCard
        tasks={[
          {
            id: 2,
            title: "Ship Phase 3",
            dueDate: "2026-11-26",
            dueTime: "20:00",
            estimateMin: 25,
            doneAt: null,
            client: null,
            projectId: null,
            isDeadline: false,
            createdAt: "",
          },
        ]}
        nowDate={new Date(2026, 10, 26, 16, 0, 0)}
        todayDateKey="2026-11-26"
        selectedDateKey="2026-11-26"
        quickAddOpen
        language="en"
        banglaDigits={false}
        reduceMotion
        onToggleTask={onToggleTask}
        onOpenQuickAdd={onOpenQuickAdd}
        onCreateTask={onCreateTask}
      />,
    );
    const input = screen.getByTestId("cal-quick-add-input-task");
    fireEvent.change(input, { target: { value: "Review PR" } });
    fireEvent.submit(screen.getByTestId("cal-quick-add-task"));
    expect(onCreateTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Review PR" }));

    fireEvent.click(screen.getByTestId("cal-task-row-2"));
    expect(onToggleTask).toHaveBeenCalledWith(2);
  });

  it("renders WaterWidget goal reached and triggers drink + undo", () => {
    const onDrink = vi.fn();
    const onUndo = vi.fn();
    render(
      <WaterWidget
        summary={{
          today_ml: 1750,
          goal_ml: 1500,
          percentage: 116.6,
          goal_reached: true,
          last_entry_id: 9,
          weekly: [],
        }}
        servingMl={250}
        remindersEnabled
        onDrink={onDrink}
        onUndo={onUndo}
        onToggleReminders={vi.fn()}
        onChangeGoal={vi.fn()}
      />,
    );
    expect(screen.getByText("Goal reached")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Drink +250 ml" }));
    expect(onDrink).toHaveBeenCalledWith(250);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledWith(9);
  });

  it("renders DayArc prayer checkmarks, 5-prayer popover, city switcher, and live Qibla bearing", () => {
    const onSelectCity = vi.fn();
    const nowDate = new Date(2026, 10, 26, 14, 10, 0);
    const baseSchedule = {
      city_name: "Dhaka",
      next_name_en: "Asr",
      next_name_bn: "আসর",
      next_time_12h: "4:15 PM",
      next_is_tomorrow: false,
      countdown_text: "in 2 h 10 min",
      progress_pct: 55,
      sun_arc_ratio: 0.62,
      hijri_date: "14 Jumada II 1448 AH",
      sehri_iftar_label: "Iftar in 3 h 5 min",
      slots: [
        {
          id: "fajr",
          name_en: "Fajr",
          name_bn: "ফজর",
          time_12h: "5:02 AM",
          minute_of_day: 302,
          arc_ratio: 0,
          passed: true,
        },
        {
          id: "dhuhr",
          name_en: "Dhuhr",
          name_bn: "যোহর",
          time_12h: "11:51 AM",
          minute_of_day: 711,
          arc_ratio: 0.45,
          passed: true,
        },
        {
          id: "asr",
          name_en: "Asr",
          name_bn: "আসর",
          time_12h: "4:15 PM",
          minute_of_day: 975,
          arc_ratio: 0.72,
          passed: false,
        },
        {
          id: "maghrib",
          name_en: "Maghrib",
          name_bn: "মাগরিব",
          time_12h: "5:12 PM",
          minute_of_day: 1032,
          arc_ratio: 0.85,
          passed: false,
        },
        {
          id: "isha",
          name_en: "Isha",
          name_bn: "এশা",
          time_12h: "6:32 PM",
          minute_of_day: 1112,
          arc_ratio: 1,
          passed: false,
        },
      ],
    };
    const cities = [
      {
        id: "dhaka",
        name_en: "Dhaka",
        name_bn: "ঢাকা",
        latitude: 23.81,
        longitude: 90.41,
        tz_offset_minutes: 360,
      },
      {
        id: "khulna",
        name_en: "Khulna",
        name_bn: "খুলনা",
        latitude: 22.84,
        longitude: 89.54,
        tz_offset_minutes: 360,
      },
    ];
    const geometry = computeDayArcGeometry({
      schedule: baseSchedule,
      calendarEvents: [],
      tasks: [],
      nowDate,
      zoomMode: "day",
      language: "bn",
    });

    const { rerender } = render(
      <DayArc
        geometry={geometry}
        schedule={baseSchedule}
        cities={cities}
        weather={null}
        tasbih={{ count: 33, target: 33 }}
        zoomMode="day"
        language="bn"
        banglaDigits={false}
        reduceMotion
        isFirstOpenOfDay={false}
        isVisible
        onToggleZoom={vi.fn()}
        onSelectCity={onSelectCity}
        onOpenAgenda={vi.fn()}
        onIncrementTasbih={vi.fn()}
        onResetTasbih={vi.fn()}
      />,
    );

    expect(screen.getByTestId("arc-passed-fajr")).toBeInTheDocument();
    expect(screen.getByTestId("arc-sun-glyph")).toBeInTheDocument();
    expect(screen.getByTestId("tasbih-chip")).toHaveTextContent("33");

    // Click Qibla chip -> shows Dhaka bearing 278° W
    fireEvent.click(screen.getByTestId("home-qibla-btn"));
    expect(screen.getByTestId("home-qibla-btn")).toHaveTextContent("278° W");

    // Click a prayer marker -> shows 5-prayer quick strip inline in Home
    fireEvent.click(screen.getByRole("button", { name: /আসর/ }));
    const popover = screen.getByTestId("home-prayer-popover");
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveTextContent("4:15");

    // Switch city directly from Home Weather/Arc city selector
    fireEvent.change(screen.getByRole("combobox", { name: "শহর পরিবর্তন করুন" }), {
      target: { value: "khulna" },
    });
    expect(onSelectCity).toHaveBeenCalledWith("khulna");

    // Auto-tracked custom coordinates override city fallback for Qibla compass bearing
    rerender(
      <DayArc
        geometry={geometry}
        schedule={{
          ...baseSchedule,
          city_name: "London",
          latitude: 51.5072,
          longitude: -0.1276,
        }}
        cities={[]}
        weather={null}
        tasbih={{ count: 33, target: 33 }}
        zoomMode="day"
        language="en"
        banglaDigits={false}
        reduceMotion
        isFirstOpenOfDay={false}
        isVisible
        onToggleZoom={vi.fn()}
        onSelectCity={onSelectCity}
        onOpenAgenda={vi.fn()}
        onIncrementTasbih={vi.fn()}
        onResetTasbih={vi.fn()}
      />,
    );
    expect(screen.getByTestId("home-qibla-btn")).toHaveTextContent("119° SE");
  });

  it("holds MusicCard during Next/Prev SMTC transitions without flashing empty and tracks side-flip direction", () => {
    vi.useFakeTimers();
    try {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const makeSnapshot = (title: string | null) => ({
        active: title
          ? {
              app_id: "chrome.exe",
              title,
              artist: "YouTube",
              album_title: "",
              is_playing: true,
              position_ms: 15_000,
              duration_ms: 210_000,
              album_art_data_url: null,
              accent_hex: "#FF6B2B",
            }
          : null,
        sessions: [],
        volume_percent: 65,
        muted: false,
      });

      const baseProps = {
        banglaDigits: false,
        reduceMotion: false,
        onPlayPause: vi.fn(),
        onPrev,
        onNext,
        onMuteToggle: vi.fn(),
        onVolumeDelta: vi.fn(),
      };

      const { rerender } = render(<MusicCard media={makeSnapshot("First Video")} {...baseProps} />);

      // Press Next -> temporary null SMTC drop should hold "First Video" with direction="next"
      fireEvent.click(screen.getByRole("button", { name: "Next track" }));
      expect(onNext).toHaveBeenCalledTimes(1);

      rerender(<MusicCard media={makeSnapshot(null)} {...baseProps} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.queryByTestId("music-empty-state")).not.toBeInTheDocument();
      expect(screen.getByText("First Video")).toBeInTheDocument();
      expect(screen.getByTestId("music-track-flip")).toHaveAttribute("data-flip-direction", "next");

      // Next video resolves directly -> shows "Second Video" flipping Next (right -> left)
      rerender(<MusicCard media={makeSnapshot("Second Video")} {...baseProps} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByText("Second Video")).toBeInTheDocument();
      expect(screen.getByTestId("music-track-flip")).toHaveAttribute("data-flip-direction", "next");

      // Press Previous -> temporary null drop still holds "Second Video" with direction="prev"
      fireEvent.click(screen.getByRole("button", { name: "Previous track" }));
      expect(onPrev).toHaveBeenCalledTimes(1);
      rerender(<MusicCard media={makeSnapshot(null)} {...baseProps} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.queryByTestId("music-empty-state")).not.toBeInTheDocument();
      expect(screen.getByTestId("music-track-flip")).toHaveAttribute("data-flip-direction", "prev");
    } finally {
      vi.useRealTimers();
    }
  });
});

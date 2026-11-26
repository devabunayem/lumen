import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DayArc } from "../home/components/DayArc";
import { computeDayArcGeometry } from "../home/hooks/useDayArcGeometry";
import { TodoWidget } from "../widgets/todo/TodoWidget";
import { WaterWidget } from "../widgets/water/WaterWidget";

describe("Phase 3 Core Widgets", () => {
  it("renders TodoWidget counter and adds/toggles tasks", () => {
    const onAdd = vi.fn();
    const onToggle = vi.fn();
    render(
      <TodoWidget
        tasks={[
          { id: 1, title: "Write tests", done: true, due_at: null, created_at: "" },
          { id: 2, title: "Ship Phase 3", done: false, due_at: "20:00", created_at: "" },
        ]}
        onAdd={onAdd}
        onToggle={onToggle}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Task Done Today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Task" }));
    const input = screen.getByLabelText("New task title");
    fireEvent.change(input, { target: { value: "Review PR" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("Review PR", null);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Ship Phase 3" }));
    expect(onToggle).toHaveBeenCalledWith(2);
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
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrayerWidget } from "../widgets/prayer/PrayerWidget";
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

  it("renders PrayerWidget sun-arc chart and Bangla names", () => {
    const onSelectCity = vi.fn();
    render(
      <PrayerWidget
        schedule={{
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
        }}
        cities={[
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
        ]}
        language="bn"
        onSelectCity={onSelectCity}
        onToggleLanguage={vi.fn()}
      />,
    );
    expect(screen.getAllByText("আসর").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Prayer sun-arc timeline")).toBeInTheDocument();
    expect(screen.getByText("Dhaka")).toBeInTheDocument();
    expect(screen.getByText("আসর · 4:15 PM")).toBeInTheDocument();
  });
});

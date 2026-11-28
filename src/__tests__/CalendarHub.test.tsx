import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarHubPage } from "../calendar/CalendarHubPage";
import {
  buildDayMarkIndex,
  buildMonthGrid,
  formatDayAriaLabel,
  getWeekdayLabels,
  resolveCellMarks,
} from "../calendar/calendarMarks";
import { parseQuickAddLocal } from "../calendar/quickAddParser";
import { BASE_GEOMETRY } from "../design/tokens";
import { DevStatesPage } from "../dev/DevStatesPage";
import type { CalendarHubSnapshot, PomodoroSnapshot } from "../lib/ipc";

const DEFAULT_POM: PomodoroSnapshot = {
  phase: "focus",
  remaining_secs: 25 * 60,
  total_secs: 25 * 60,
  running: false,
  cycle_index: 0,
  cycles_before_long: 4,
  daily_focus_minutes: 0,
  chime_tick: 0,
};

function makeSampleSnapshot(): CalendarHubSnapshot {
  return {
    year: 2026,
    month: 11,
    dayMarks: [
      { dateKey: "2026-11-26", taskCount: 1, eventCount: 1, reminderCount: 1, deadlineCount: 0 },
      { dateKey: "2026-11-27", taskCount: 1, eventCount: 1, reminderCount: 0, deadlineCount: 0 },
      { dateKey: "2026-11-29", taskCount: 2, eventCount: 1, reminderCount: 1, deadlineCount: 1 },
    ],
    tasks: [
      {
        id: 1,
        title: "Invoice",
        dueDate: "2026-11-26",
        dueTime: "9:00",
        estimateMin: 15,
        doneAt: "2026-11-26T09:05:00Z",
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
      {
        id: 2,
        title: "Design review",
        dueDate: "2026-11-26",
        dueTime: "2:30",
        estimateMin: 25,
        doneAt: null,
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
      {
        id: 3,
        title: "Sprint prep",
        dueDate: "2026-11-27",
        dueTime: "11:00 AM",
        estimateMin: 30,
        doneAt: null,
        client: null,
        projectId: null,
        isDeadline: false,
        createdAt: "",
      },
    ],
    events: [
      {
        id: 1,
        sourceId: "google-1",
        title: "Team standup",
        start: "2026-11-26T16:12:00",
        end: "2026-11-26T16:42:00",
        allDay: false,
        color: "#30d158",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        location: "Google Meet",
        readOnly: true,
      },
      {
        id: 2,
        sourceId: "google-1",
        title: "Sprint review",
        start: "2026-11-27T10:00:00",
        end: "2026-11-27T11:00:00",
        allDay: false,
        color: "#7a78ff",
        meetingUrl: null,
        location: "Room B",
        readOnly: true,
      },
    ],
    reminders: [
      {
        id: 1,
        title: "Review notes",
        kind: "prayer",
        at: "2026-11-26T17:01:00",
        repeatRule: null,
        prayerAnchor: { prayer: "Maghrib", offsetMin: 10, relation: "before" },
        snoozeCount: 0,
        active: true,
        importance: "normal",
        missed: false,
        createdAt: "",
      },
    ],
    sources: [
      {
        id: "google-1",
        provider: "google",
        accountLabel: "Google",
        icsUrl: null,
        lastSyncedAt: "2026-11-26T15:58:00Z",
        lastError: null,
        connected: true,
      },
    ],
    recentFocusSessions: [],
    focusTaskId: 2,
  };
}

describe("Calendar Hub Phases 1–2 (Layout, Marks, Parser, Filtering, Week, QuickAdd, Drag-Drop)", () => {
  it("computes 5/6 week grids, day marks with 4+ overflow plus, and accessible labels", () => {
    const nov2026 = buildMonthGrid(2026, 11, new Date(2026, 10, 26), 0);
    expect(nov2026.length).toBe(5);
    expect(getWeekdayLabels(6, "en")[0]).toBe("S");
    expect(getWeekdayLabels(6, "bn")[0]).toBe("শ");

    const map = buildDayMarkIndex(makeSampleSnapshot().dayMarks);
    const nov26Marks = resolveCellMarks(map.get("2026-11-26"));
    expect(nov26Marks.slots.length).toBe(3);
    expect(nov26Marks.showOverflowPlus).toBe(false);

    const nov29Marks = resolveCellMarks(map.get("2026-11-29"));
    expect(nov29Marks.slots.length).toBe(2);
    expect(nov29Marks.showOverflowPlus).toBe(true);

    const cell26 = nov2026.flat().find((c) => c.dateKey === "2026-11-26")!;
    const aria = formatDayAriaLabel(cell26, nov26Marks, "en");
    expect(aria).toContain("3 items");
    expect(aria).toContain("1 task");
    expect(aria).toContain("1 event");
    expect(aria).toContain("1 reminder");
  });

  it("parses English and Banglish quick-add phrases cleanly", () => {
    const now = new Date(2026, 10, 26, 16, 0, 0);
    const p1 = parseQuickAddLocal("call supplier 5pm", now, "task");
    expect(p1.title).toBe("call supplier");
    expect(p1.dueTime).toBe("5:00 PM");
    expect(p1.dueDate).toBe("2026-11-26");

    const p2 = parseQuickAddLocal("pay rent every month 1st", now, "reminder");
    expect(p2.title).toBe("pay rent");
    expect(p2.reminderKind).toBe("monthly");
    expect(p2.dueDate).toBe("2026-12-01");

    const p3 = parseQuickAddLocal("review notes 10 min before maghrib", now, "reminder");
    expect(p3.title).toBe("review notes");
    expect(p3.reminderKind).toBe("prayer");
    expect(p3.prayerAnchor).toEqual({ prayer: "Maghrib", offsetMin: 10, relation: "before" });

    const p4 = parseQuickAddLocal("kal shokale 9 tay", now, "task");
    expect(p4.dueDate).toBe("2026-11-27");
    expect(p4.dueTime).toBe("9:00 AM");
  });

  it("supports day filtering, Week view toggle, QuickAdd, EventSheet, Undo & Keyboard M move", () => {
    const snap = makeSampleSnapshot();
    const onToggleTask = vi.fn();
    const onCreateTask = vi.fn();
    const onMoveTaskDue = vi.fn();
    const onSetFocusTask = vi.fn();
    const onRestore = vi.fn();

    render(
      <CalendarHubPage
        snapshot={snap}
        nowDate={new Date(2026, 10, 26, 16, 0, 0)}
        pomodoro={DEFAULT_POM}
        firstDayOfWeek={0}
        colorBlindMarks={false}
        socialBlockedArmed
        language="en"
        banglaDigits={false}
        reduceMotion
        reduceTransparency={false}
        onOpenSettings={() => {}}
        onToggleTask={onToggleTask}
        onCreateTask={onCreateTask}
        onDeleteTask={() => {}}
        onRestoreLastDeleted={onRestore}
        onMoveTaskDue={onMoveTaskDue}
        onSetFocusTask={onSetFocusTask}
        onToggleFocus={() => {}}
      />,
    );

    const root = screen.getByTestId("calendar-hub-page");
    expect(root).toHaveStyle({
      width: `${BASE_GEOMETRY.calendarHubExpanded.width}px`,
      height: `${BASE_GEOMETRY.calendarHubExpanded.height}px`,
    });

    // Day filtering: select Nov 27 -> shows "Events", filters to Sprint prep & Sprint review, Back to today appears
    fireEvent.click(screen.getByTestId("cal-day-2026-11-27"));
    expect(screen.getByTestId("cal-back-to-today")).toBeInTheDocument();
    expect(screen.getByTestId("cal-upcoming-card")).toHaveTextContent("Events");
    expect(screen.getByTestId("cal-todo-card")).toHaveTextContent("Sprint prep");
    expect(screen.getByTestId("cal-upcoming-card")).toHaveTextContent("Sprint review");

    // Back to today restores Overview
    fireEvent.click(screen.getByTestId("cal-back-to-today"));
    expect(screen.queryByTestId("cal-back-to-today")).not.toBeInTheDocument();
    expect(screen.getByTestId("cal-upcoming-card")).toHaveTextContent("Team standup");

    // Quick-add Task opens, shows live parsed chip, submits with Enter
    fireEvent.click(screen.getByTestId("cal-todo-add-btn"));
    const qaInput = screen.getByTestId("cal-quick-add-input-task");
    fireEvent.change(qaInput, { target: { value: "Send deck kal shokale 9 tay" } });
    expect(screen.getByTestId("cal-quick-add-chip-task")).toHaveTextContent("Tomorrow · 9:00 AM");
    fireEvent.submit(screen.getByTestId("cal-quick-add-task"));
    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: "2026-11-27", dueTime: "9:00 AM" }),
    );

    // Toggle pending task #2 triggers Undo toast
    fireEvent.click(screen.getByTestId("cal-task-row-2"));
    expect(onToggleTask).toHaveBeenCalledWith(2);
    expect(screen.getByTestId("cal-undo-toast")).toBeInTheDocument();

    // Keyboard M move opens picker -> move to Focus
    fireEvent.keyDown(screen.getByTestId("cal-task-row-2"), { key: "m" });
    const moveMenu = screen.getByTestId("cal-move-menu-2");
    expect(moveMenu).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /Focus/ }));
    expect(onSetFocusTask).toHaveBeenCalledWith(2);

    // Event detail sheet opens & Esc closes
    fireEvent.click(screen.getByText("Team standup"));
    expect(screen.getByTestId("cal-event-sheet")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("cal-event-sheet")).not.toBeInTheDocument();

    // Month <-> Week toggle renders 7-column strip
    fireEvent.click(screen.getByTestId("cal-view-week"));
    expect(screen.getByTestId("cal-week-strip")).toBeInTheDocument();
  });

  it("renders all Phase 1 & 2 Calendar Hub states in /dev/states including 150% scale (1140x564)", () => {
    render(<DevStatesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar Hub (All States)" }));
    for (const id of [
      "default",
      "color-blind",
      "local-empty",
      "scale-150",
      "bangla-locale",
      "week-view",
      "day-filtered",
      "event-sheet",
      "missed-list",
      "drag-over-day",
      "drag-over-focus",
      "sync-sheet",
      "disconnected",
      "focus-running",
      "focus-prayer-ask",
      "focus-free-done",
      "rtl-preview",
    ]) {
      expect(screen.getByTestId(`dev-cal-hub-state-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("dev-cal-hub-state-scale-150")).toHaveTextContent("1140×564 px");
  });

  it("opens CalendarSyncSheet on sync chip click, connects ICS, disconnects, and confirms Delete All data", async () => {
    const onConnectIcs = vi.fn().mockResolvedValue(undefined);
    const onDisconnectSource = vi.fn().mockResolvedValue(undefined);
    const onDeleteAllData = vi.fn().mockResolvedValue(undefined);
    const onSyncNow = vi.fn().mockResolvedValue(undefined);

    render(
      <CalendarHubPage
        snapshot={{
          year: 2026,
          month: 11,
          dayMarks: [],
          tasks: [],
          events: [],
          reminders: [],
          sources: [
            {
              id: "local",
              provider: "local",
              accountLabel: "Local calendar",
              icsUrl: null,
              lastSyncedAt: null,
              lastError: null,
              connected: true,
            },
            {
              id: "ics:work",
              provider: "ics",
              accountLabel: "Work ICS",
              icsUrl: "https://example.com/cal.ics",
              lastSyncedAt: "2026-11-26T15:58:00Z",
              lastError: null,
              connected: true,
            },
          ],
          recentFocusSessions: [],
        }}
        nowDate={new Date(2026, 10, 26, 16, 0, 0)}
        pomodoro={{
          phase: "focus",
          remaining_secs: 1500,
          total_secs: 1500,
          running: false,
          cycle_index: 0,
          cycles_before_long: 4,
          daily_focus_minutes: 0,
          chime_tick: 0,
        }}
        firstDayOfWeek={0}
        colorBlindMarks={false}
        socialBlockedArmed
        language="en"
        banglaDigits={false}
        reduceMotion
        reduceTransparency={false}
        onOpenSettings={vi.fn()}
        onToggleTask={vi.fn()}
        onToggleFocus={vi.fn()}
        onSyncNow={onSyncNow}
        onConnectIcs={onConnectIcs}
        onDisconnectSource={onDisconnectSource}
        onDeleteAllData={onDeleteAllData}
      />,
    );

    fireEvent.click(screen.getByTestId("cal-sync-chip"));
    expect(screen.getByTestId("cal-sync-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cal-sync-refresh-btn"));
    await waitFor(() => expect(onSyncNow).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId("cal-ics-url-input"), {
      target: { value: "webcal://example.com/team.ics" },
    });
    const addIcsBtn = screen.getByTestId("cal-connect-ics-btn");
    await waitFor(() => expect(addIcsBtn).not.toBeDisabled());
    fireEvent.click(addIcsBtn);
    await waitFor(() =>
      expect(onConnectIcs).toHaveBeenCalledWith("", "webcal://example.com/team.ics"),
    );

    const dcBtn = screen.getByTestId("cal-disconnect-ics:work");
    await waitFor(() => expect(dcBtn).not.toBeDisabled());
    fireEvent.click(dcBtn);
    await waitFor(() => expect(onDisconnectSource).toHaveBeenCalledWith("ics:work"));

    fireEvent.click(screen.getByTestId("cal-delete-all-btn"));
    const delConfirmBtn = screen.getByTestId("cal-delete-all-confirm");
    await waitFor(() => expect(delConfirmBtn).not.toBeDisabled());
    fireEvent.click(delConfirmBtn);
    await waitFor(() => expect(onDeleteAllData).toHaveBeenCalled());
  });
});

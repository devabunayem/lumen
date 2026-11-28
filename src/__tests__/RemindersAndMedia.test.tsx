import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReminderAlertOverlay } from "../app/ReminderAlertOverlay";
import { MusicCard } from "../home/components/MusicCard";
import {
  addLocalReminder,
  loadLocalReminders,
  pollDueLocalReminders,
  purgeExpiredLocalReminders,
  stopLocalReminder,
} from "../lib/remindersLocal";
import { RemindersCard } from "../calendar/RemindersCard";

describe("Reminders Overlay, Widget & Real-Time Media Card", () => {
  it("renders medium reminder alert with Stop (OK) and configurable Snooze actions", () => {
    const onStop = vi.fn();
    const onSnooze = vi.fn();
    render(
      <ReminderAlertOverlay
        alert={{
          reminder: {
            id: 7,
            title: "Night Client Sync",
            target_at: "2026-11-26T20:00:00.000Z",
            lead_minutes: 10,
            lead_dismissed: true,
            snooze_until: null,
            exact_fired: false,
            completed: false,
            created_at: "2026-11-26T10:00:00.000Z",
          },
          stage: "lead",
          is_exact_due: false,
        }}
        snoozeMinutes={5}
        language="en"
        onStop={onStop}
        onSnooze={onSnooze}
      />,
    );

    expect(screen.getByTestId("reminder-alert-overlay")).toBeInTheDocument();
    expect(screen.getByText("In 10 min")).toBeInTheDocument();
    expect(screen.getByText("Night Client Sync")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reminder-snooze-btn"));
    expect(onSnooze).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByTestId("reminder-stop-btn"));
    expect(onStop).toHaveBeenCalledWith(7, "lead");
  });

  it("allows creating a prayer-anchored or timed reminder via Calendar Hub RemindersCard", async () => {
    const onCreateReminder = vi.fn().mockResolvedValue(undefined);
    render(
      <RemindersCard
        reminders={[]}
        nowDate={new Date(2026, 10, 26, 15, 0, 0)}
        selectedDateKey="2026-11-26"
        quickAddOpen
        language="en"
        banglaDigits={false}
        onCreateReminder={onCreateReminder}
        onCompleteReminder={vi.fn()}
      />,
    );

    const input = screen.getByTestId("cal-quick-add-input-reminder");
    fireEvent.change(input, {
      target: { value: "Review notes 10 min before Maghrib" },
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("cal-quick-add-reminder"));
    });

    expect(onCreateReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Review notes",
        reminderKind: "prayer",
        prayerAnchor: { prayer: "Maghrib", offsetMin: 10, relation: "before" },
      }),
    );
  });

  it("persists reminders in localStorage, honors exact-time fire, and auto-purges after 7 days", () => {
    window.localStorage.clear();
    const targetMs = Date.parse("2026-11-26T20:00:00.000Z");
    const list = addLocalReminder(
      [],
      "Client Call",
      "2026-11-26T20:00:00.000Z",
      10,
      targetMs - 30 * 60_000,
    );
    expect(loadLocalReminders(targetMs - 20 * 60_000)).toHaveLength(1);

    // 10m before -> lead fires; stopping lead keeps exact-time trigger armed
    const leadPoll = pollDueLocalReminders(list, targetMs - 10 * 60_000);
    expect(leadPoll.due).toHaveLength(1);
    expect(leadPoll.due[0].stage).toBe("lead");
    const afterLeadStop = stopLocalReminder(
      leadPoll.updated,
      list[0].id,
      "lead",
      targetMs - 9 * 60_000,
    );

    // Exact target -> MUST still fire
    const exactPoll = pollDueLocalReminders(afterLeadStop, targetMs);
    expect(exactPoll.due).toHaveLength(1);
    expect(exactPoll.due[0].stage).toBe("exact");

    // Retained at 6 days, auto-deleted at >= 7 days after expiry
    expect(purgeExpiredLocalReminders(exactPoll.updated, targetMs + 6 * 86_400_000)).toHaveLength(
      1,
    );
    expect(purgeExpiredLocalReminders(exactPoll.updated, targetMs + 7 * 86_400_000)).toHaveLength(
      0,
    );
  });

  it("advances Home MusicCard timeline smoothly in real time while playing", () => {
    vi.useFakeTimers();
    const onSeek = vi.fn();
    const onMuteToggle = vi.fn();
    const onVolumeDelta = vi.fn();
    const onSelectSession = vi.fn();
    const onPlayPause = vi.fn();

    const { rerender } = render(
      <MusicCard
        media={{
          active: {
            app_id: "chrome.exe",
            title: "Lo-Fi YouTube Stream",
            artist: "Google Chrome",
            album_title: "",
            is_playing: true,
            position_ms: 10_000,
            duration_ms: 120_000,
            album_art_data_url: null,
            accent_hex: "#FF453A",
          },
          sessions: [
            {
              app_id: "chrome.exe",
              title: "Lo-Fi YouTube Stream",
              artist: "Chrome",
              is_playing: true,
            },
            { app_id: "Spotify.exe", title: "Midnight Drive", artist: "Lumen", is_playing: false },
          ],
          volume_percent: 60,
          muted: false,
        }}
        banglaDigits={false}
        reduceMotion={false}
        onOpenMusicPage={vi.fn()}
        onPlayPause={onPlayPause}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onSeek={onSeek}
        onMuteToggle={onMuteToggle}
        onVolumeDelta={onVolumeDelta}
        onSelectSession={onSelectSession}
      />,
    );

    expect(screen.getByText("0:10")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("0:13")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Seek track position" }), {
      target: { value: "45000" },
    });
    expect(onSeek).toHaveBeenCalledWith(45000);

    fireEvent.change(screen.getByRole("combobox", { name: "Switch active media player" }), {
      target: { value: "Spotify.exe" },
    });
    expect(onSelectSession).toHaveBeenCalledWith("Spotify.exe");

    fireEvent.click(screen.getByRole("button", { name: "Mute system volume" }));
    expect(onMuteToggle).toHaveBeenCalled();

    fireEvent.change(screen.getByRole("slider", { name: "System volume" }), {
      target: { value: "80" },
    });
    expect(onVolumeDelta).toHaveBeenCalledWith(80);

    rerender(
      <MusicCard
        media={{
          active: null,
          sessions: [
            { app_id: "Spotify.exe", title: "Midnight Drive", artist: "Lumen", is_playing: false },
          ],
          volume_percent: 60,
          muted: false,
        }}
        banglaDigits={false}
        reduceMotion={false}
        onPlayPause={onPlayPause}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onMuteToggle={onMuteToggle}
        onVolumeDelta={onVolumeDelta}
        onSelectSession={onSelectSession}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(onSelectSession).toHaveBeenCalledWith("Spotify.exe");
    expect(onPlayPause).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReminderAlertOverlay } from "../app/ReminderAlertOverlay";
import { MusicCard } from "../home/components/MusicCard";
import { RemindersWidget } from "../widgets/reminders/RemindersWidget";

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

  it("allows creating a manual reminder with custom target time and advance lead minutes", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(
      <RemindersWidget
        reminders={[]}
        defaultLeadMinutes={10}
        snoozeMinutes={3}
        language="en"
        onAdd={onAdd}
        onDelete={vi.fn()}
        onMarkDone={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Reminder title"), {
      target: { value: "Deploy build" },
    });
    fireEvent.change(screen.getByLabelText("Target time"), {
      target: { value: "21:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "15m" }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("reminder-submit-btn"));
    });

    expect(onAdd).toHaveBeenCalledWith("Deploy build", expect.any(String), 15);
  });

  it("advances Home MusicCard timeline smoothly in real time while playing", () => {
    vi.useFakeTimers();
    render(
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
          sessions: [],
          volume_percent: 60,
          muted: false,
        }}
        banglaDigits={false}
        reduceMotion={false}
        onOpenMusicPage={vi.fn()}
        onPlayPause={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onMuteToggle={vi.fn()}
        onVolumeDelta={vi.fn()}
      />,
    );

    expect(screen.getByText("0:10")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("0:13")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DevStatesPage } from "../dev/DevStatesPage";
import { MusicCard } from "../home/components/MusicCard";
import type { ClipboardHistoryItem, ShelfItem, SystemTelemetrySnapshot } from "../lib/ipc";
import { SystemShelfPage } from "../systemShelf/SystemShelfPage";

function makeTelemetry(overrides: Partial<SystemTelemetrySnapshot> = {}): SystemTelemetrySnapshot {
  return {
    cpuPercent: 42,
    cpuCores: 16,
    ramPercent: 60,
    ramUsedGb: 19.2,
    ramTotalGb: 32,
    gpuPercent: 31,
    gpuName: "RTX 4070",
    vramUsedGb: 3.1,
    vramTotalGb: 8,
    netDownBps: 12_500_000,
    netUpBps: 1_800_000,
    netSessionRxBytes: 512_000_000,
    netSessionTxBytes: 98_000_000,
    netOnline: true,
    netInterfaceName: "Ethernet",
    ...overrides,
  };
}

describe("System & Shelf Page 3 + Universal MusicCard", () => {
  it("renders File Shelf, CPU/GPU/Net telemetry, and Clipboard history interactions", () => {
    const onShelfAdd = vi.fn();
    const onShelfPickFiles = vi.fn();
    const onShelfOpen = vi.fn();
    const onCopyClip = vi.fn();
    const onToggleClipPin = vi.fn();
    const onDeleteClip = vi.fn();
    const onTogglePin = vi.fn();

    const shelfItems: ShelfItem[] = [
      {
        id: 1,
        kind: "file",
        path_or_text: "C:/Docs/brief.pdf",
        display_name: "brief.pdf",
        available: true,
        added_at: "2026-11-28T10:00:00Z",
      },
    ];
    const clipboardItems: ClipboardHistoryItem[] = [
      {
        id: 11,
        kind: "secret",
        preview: "sk-••••••99",
        rawHash: "h11",
        sensitive: true,
        pinned: false,
        copiedAt: "2026-11-28T10:24:00Z",
      },
      {
        id: 12,
        kind: "link",
        preview: "https://github.com/lumen-island/lumen",
        rawHash: "h12",
        sensitive: false,
        pinned: true,
        copiedAt: "2026-11-28T10:15:00Z",
      },
    ];

    render(
      <SystemShelfPage
        nowDate={new Date(2026, 10, 28, 10, 25)}
        shelfItems={shelfItems}
        telemetry={makeTelemetry()}
        cpuHistory={[20, 35, 42]}
        gpuHistory={[15, 25, 31]}
        netDownHistory={[5_000_000, 12_500_000]}
        clipboardItems={clipboardItems}
        isPinned={false}
        language="en"
        banglaDigits={false}
        reduceMotion
        reduceTransparency={false}
        onTogglePin={onTogglePin}
        onOpenSettings={vi.fn()}
        onShelfAdd={onShelfAdd}
        onShelfPickFiles={onShelfPickFiles}
        onShelfOpen={onShelfOpen}
        onShelfRemove={vi.fn()}
        onShelfClear={vi.fn()}
        onCopyClip={onCopyClip}
        onToggleClipPin={onToggleClipPin}
        onDeleteClip={onDeleteClip}
        onClearClipboard={vi.fn()}
      />,
    );

    const page = screen.getByTestId("system-shelf-page");
    expect(page).toHaveStyle({ width: "640px", height: "312px" });
    expect(screen.getByTestId("sys-cpu-pct")).toHaveTextContent("42%");
    expect(screen.getByTestId("sys-ram-pill")).toHaveTextContent("19.2/32G");
    expect(screen.getByTestId("sys-shelf-cap-badge")).toHaveTextContent("1/50");
    expect(screen.getByTestId("sys-clip-cap-badge")).toHaveTextContent("0/30");

    fireEvent.click(screen.getByRole("button", { name: "Pin island open" }));
    expect(onTogglePin).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("sys-shelf-browse-btn"));
    expect(onShelfPickFiles).toHaveBeenCalled();

    fireEvent.click(screen.getByText("brief.pdf"));
    expect(onShelfOpen).toHaveBeenCalledWith("C:/Docs/brief.pdf");

    fireEvent.click(screen.getByText("https://github.com/lumen-island/lumen"));
    expect(onCopyClip).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByRole("button", { name: "Unpin clip" }));
    expect(onToggleClipPin).toHaveBeenCalledWith(12);

    const deleteBtns = screen.getAllByRole("button", { name: "Delete clip" });
    fireEvent.click(deleteBtns[0]);
    expect(onDeleteClip).toHaveBeenCalledWith(11);
  });

  it("renders Bangla digits cleanly when banglaDigits is enabled", () => {
    render(
      <SystemShelfPage
        nowDate={new Date(2026, 10, 28, 10, 25)}
        shelfItems={[]}
        telemetry={makeTelemetry({ cpuPercent: 75 })}
        cpuHistory={[75]}
        gpuHistory={[31]}
        netDownHistory={[12_500_000]}
        clipboardItems={[]}
        language="bn"
        banglaDigits
        reduceMotion
        reduceTransparency={false}
        onOpenSettings={vi.fn()}
        onShelfAdd={vi.fn()}
        onShelfPickFiles={vi.fn()}
        onShelfOpen={vi.fn()}
        onShelfRemove={vi.fn()}
        onShelfClear={vi.fn()}
        onCopyClip={vi.fn()}
        onToggleClipPin={vi.fn()}
        onDeleteClip={vi.fn()}
        onClearClipboard={vi.fn()}
      />,
    );

    expect(screen.getByTestId("sys-cpu-pct")).toHaveTextContent("৭৫%");
  });

  it("renders MusicCard live timeline indicator for non-seekable offline players while keeping controls active", () => {
    const onPlayPause = vi.fn();
    const onNext = vi.fn();
    render(
      <MusicCard
        media={{
          active: {
            app_id: "PotPlayerMini64.exe",
            title: "Lo-Fi Rain Study Mix.mp4",
            artist: "PotPlayer (Offline)",
            album_title: "",
            is_playing: true,
            position_ms: 0,
            duration_ms: 0,
            album_art_data_url: null,
            accent_hex: "#0a84ff",
            control_mode: "audio_window",
            can_seek: false,
          },
          sessions: [],
          volume_percent: 80,
          muted: false,
        }}
        banglaDigits={false}
        reduceMotion
        onPlayPause={onPlayPause}
        onPrev={vi.fn()}
        onNext={onNext}
        onMuteToggle={vi.fn()}
        onVolumeDelta={vi.fn()}
      />,
    );

    expect(screen.getByTestId("music-live-timeline")).toHaveTextContent("LIVE");
    expect(screen.queryByRole("slider", { name: /seek/i })).toBeNull();
    expect(screen.getByRole("slider", { name: "System volume" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPlayPause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    expect(onNext).toHaveBeenCalled();
  });

  it("enforces pin limit banner, pause/resume toggle, secret countdown, and dev state gallery", async () => {
    const onTogglePin = vi.fn().mockRejectedValue(new Error("Maximum 10 pinned items allowed"));
    const onTogglePause = vi.fn();

    render(
      <SystemShelfPage
        nowDate={new Date(2026, 10, 28, 10, 25)}
        shelfItems={[]}
        telemetry={makeTelemetry()}
        cpuHistory={[42]}
        gpuHistory={[31]}
        netDownHistory={[12_500_000]}
        clipboardItems={[
          {
            id: 11,
            kind: "secret",
            preview: "OTP 482 •••",
            rawHash: "h11",
            sensitive: true,
            pinned: false,
            copiedAt: "2026-11-28T10:24:36Z",
            expiresInSecs: 24,
          },
          {
            id: 12,
            kind: "text",
            preview: "Clip item 12",
            rawHash: "h12",
            sensitive: false,
            pinned: false,
            copiedAt: "2026-11-28T10:20:00Z",
          },
        ]}
        clipboardCapturePaused
        language="en"
        banglaDigits={false}
        reduceMotion
        reduceTransparency={false}
        onOpenSettings={vi.fn()}
        onShelfAdd={vi.fn()}
        onShelfPickFiles={vi.fn()}
        onShelfOpen={vi.fn()}
        onShelfRemove={vi.fn()}
        onShelfClear={vi.fn()}
        onCopyClip={vi.fn()}
        onToggleClipPin={onTogglePin}
        onDeleteClip={vi.fn()}
        onClearClipboard={vi.fn()}
        onToggleClipCapturePaused={onTogglePause}
      />,
    );

    expect(screen.getByTestId("sys-clip-item-11")).toHaveTextContent("24s");
    expect(screen.getByTestId("sys-clipboard-paused-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sys-clipboard-pause-btn"));
    expect(onTogglePause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pin clip" }));
    expect(await screen.findByTestId("sys-clipboard-pin-limit-banner")).toHaveTextContent(
      "Max 10 pinned items reached",
    );
  });

  it("renders all 9 System & Shelf states in DevStatesPage", () => {
    render(<DevStatesPage />);
    expect(screen.getByTestId("dev-tab-system-shelf")).toBeInTheDocument();
    expect(screen.getByTestId("dev-sys-shelf-state-default")).toBeInTheDocument();
    expect(screen.getByTestId("dev-sys-shelf-state-high-load")).toBeInTheDocument();
    expect(screen.getByTestId("dev-sys-shelf-state-secret-clipboard")).toBeInTheDocument();
    expect(screen.getByTestId("dev-sys-shelf-state-bangla-locale")).toBeInTheDocument();
    expect(screen.getByTestId("dev-sys-shelf-state-overflow-lists")).toBeInTheDocument();
  });
});

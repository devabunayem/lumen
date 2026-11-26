import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MediaStateSnapshot } from "../lib/ipc";
import { MusicWidget } from "../widgets/music/MusicWidget";

const SAMPLE_MEDIA: MediaStateSnapshot = {
  active: {
    app_id: "Spotify.exe",
    title: "Midnight Breeze",
    artist: "Dhaka Ensemble",
    album_title: "Monsoon",
    is_playing: true,
    position_ms: 65_000,
    duration_ms: 185_000,
    album_art_data_url: null,
    accent_hex: "#30D158",
  },
  sessions: [
    { app_id: "Spotify.exe", title: "Midnight Breeze", artist: "Dhaka Ensemble", is_playing: true },
    { app_id: "msedge.exe", title: "Lo-Fi Radio", artist: "YouTube", is_playing: false },
  ],
  volume_percent: 64,
  muted: false,
};

describe("MusicWidget", () => {
  it("renders empty SMTC ready card when no track is playing", () => {
    render(
      <MusicWidget
        media={null}
        lyricsOpen={false}
        onToggleLyrics={vi.fn()}
        onCommand={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onSelectSession={vi.fn()}
      />,
    );
    expect(screen.getByText("Not Playing")).toBeInTheDocument();
  });

  it("renders metadata, timestamps, session switcher, and triggers playback commands", () => {
    const onCommand = vi.fn();
    const onSelectSession = vi.fn();
    render(
      <MusicWidget
        media={SAMPLE_MEDIA}
        lyricsOpen={false}
        onToggleLyrics={vi.fn()}
        onCommand={onCommand}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onSelectSession={onSelectSession}
      />,
    );

    expect(screen.getByTitle("Midnight Breeze")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText("-2:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onCommand).toHaveBeenCalledWith("play_pause");

    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    expect(onCommand).toHaveBeenCalledWith("next");

    fireEvent.change(screen.getByLabelText("Switch active media player"), {
      target: { value: "msedge.exe" },
    });
    expect(onSelectSession).toHaveBeenCalledWith("msedge.exe");
  });

  it("renders waveform scrubber, two-line synced lyrics, shuffle, and lyrics toggle", () => {
    const onToggleLyrics = vi.fn();
    render(
      <MusicWidget
        media={SAMPLE_MEDIA}
        lyricsOpen
        lyricsLines={[
          { time_ms: 0, text: "Current lyric line plays in sync" },
          { time_ms: 90_000, text: "Next line fades in softly" },
        ]}
        onToggleLyrics={onToggleLyrics}
        onCommand={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onSelectSession={vi.fn()}
      />,
    );
    expect(screen.getByText("Current lyric line plays in sync")).toBeInTheDocument();
    expect(screen.getByText("Next line fades in softly")).toBeInTheDocument();
    expect(screen.getByLabelText("Seek track position")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle shuffle" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle lyrics" }));
    expect(onToggleLyrics).toHaveBeenCalled();
  });
});

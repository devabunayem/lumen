import { motion, useReducedMotion } from "motion/react";
import {
  MessageSquareIcon,
  MusicNoteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "../../design/icons";
import { getMotionTransition } from "../../design/motion";
import type { LyricLine, MediaStateSnapshot } from "../../lib/ipc";

export interface MusicWidgetProps {
  media: MediaStateSnapshot | null;
  lyricsOpen: boolean;
  lyricsLines?: LyricLine[];
  onToggleLyrics: () => void;
  onCommand: (cmd: "play_pause" | "next" | "previous" | "toggle_mute") => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volumePercent: number) => void;
  onSelectSession: (appId: string) => void;
}

function formatDurationMs(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MusicWidget({
  media,
  lyricsOpen,
  lyricsLines = [],
  onToggleLyrics,
  onCommand,
  onSeek,
  onVolumeChange,
  onSelectSession,
}: MusicWidgetProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const active = media?.active ?? null;
  const accent = active?.accent_hex || "var(--accent-blue)";

  if (!active) {
    return (
      <div
        className="flex h-full w-full items-center gap-3.5 px-4"
        style={{
          borderRadius: "var(--card-radius)",
        }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "var(--surface-raised)",
            border: "1px solid var(--hairline)",
            color: "var(--text-tertiary)",
          }}
        >
          <MusicNoteIcon size={24} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="type-body font-semibold" style={{ color: "var(--text-primary)" }}>
            Not Playing
          </span>
          <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
            Play Spotify, YouTube, or any media player
          </span>
        </div>
      </div>
    );
  }

  const duration = Math.max(active.duration_ms, 1);
  const clampedPos = Math.min(active.position_ms, duration);
  const progressPct = Math.min(100, Math.max(0, (clampedPos / duration) * 100));
  const remainingMs = Math.max(0, duration - clampedPos);

  const activeLyricIdx = lyricsLines.reduce((acc, line, idx) => {
    return line.time_ms <= clampedPos ? idx : acc;
  }, -1);

  return (
    <div className="flex h-full w-full flex-col justify-between px-1 py-0.5">
      {/* Top row: Artwork on Left, Song Title & Controls on Right */}
      <div className="flex items-center gap-3.5">
        {/* Album Artwork */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "var(--surface-raised)",
            border: "1px solid var(--hairline)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          }}
        >
          {active.album_art_data_url ? (
            <img src={active.album_art_data_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span style={{ color: accent }}>
              <MusicNoteIcon size={22} />
            </span>
          )}
        </div>

        {/* Track Title and Artist / Session Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center justify-between gap-2">
            <span
              className="type-body truncate font-semibold leading-tight"
              style={{ color: "var(--text-primary)" }}
              title={active.title}
            >
              {active.title || "Unknown Title"}
            </span>
            {media && media.sessions.length > 1 && (
              <select
                aria-label="Switch active media player"
                value={active.app_id}
                onChange={(e) => onSelectSession(e.target.value)}
                className="type-caption max-w-[90px] cursor-pointer truncate rounded-full border-0 px-2 py-0.5"
                style={{
                  backgroundColor: "var(--surface-raised)",
                  color: "var(--text-secondary)",
                }}
              >
                {media.sessions.map((s) => (
                  <option key={s.app_id} value={s.app_id}>
                    {s.title || s.app_id}
                  </option>
                ))}
              </select>
            )}
          </div>
          <span
            className="type-caption truncate"
            style={{ color: "var(--text-secondary)" }}
            title={active.artist || active.app_id}
          >
            {active.artist || active.app_id || "Unknown Artist"}
          </span>
        </div>
      </div>

      {/* Synced Lyrics drawer if enabled */}
      {lyricsOpen && (
        <div className="flex h-10 flex-col justify-center overflow-hidden px-1">
          {lyricsLines.length === 0 ? (
            <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
              No synced lyrics available.
            </span>
          ) : (
            <div className="type-caption truncate font-medium" style={{ color: accent }}>
              {lyricsLines[Math.max(0, activeLyricIdx)]?.text ?? ""}
            </div>
          )}
        </div>
      )}

      {/* Progress timeline bar */}
      <div className="flex items-center gap-2 px-0.5">
        <span
          className="type-caption w-8 shrink-0 tabular-nums text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {formatDurationMs(clampedPos)}
        </span>
        <div className="relative flex flex-1 items-center">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.14)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "#ffffff" }}
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={getMotionTransition("progressSpring", prefersReducedMotion)}
            />
          </div>
          <input
            type="range"
            aria-label="Seek track position"
            min={0}
            max={duration}
            value={clampedPos}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <span
          className="type-caption w-9 shrink-0 text-right tabular-nums text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          -{formatDurationMs(remainingMs)}
        </span>
      </div>

      {/* Bottom Controls Row: Lyrics icon, Previous, Play/Pause, Next, Volume */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <button
          type="button"
          aria-label="Toggle lyrics"
          aria-pressed={lyricsOpen}
          onClick={onToggleLyrics}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 transition-colors"
          style={{
            backgroundColor: lyricsOpen ? "rgba(255,255,255,0.2)" : "transparent",
            color: lyricsOpen ? "#ffffff" : "var(--text-secondary)",
          }}
        >
          <MessageSquareIcon size={16} />
        </button>

        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-5">
          <button
            type="button"
            aria-label="Previous track"
            onClick={() => onCommand("previous")}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white transition-transform active:scale-90"
          >
            <PrevIcon size={18} />
          </button>
          <button
            type="button"
            aria-label={active.is_playing ? "Pause" : "Play"}
            onClick={() => onCommand("play_pause")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white transition-transform active:scale-90"
          >
            {active.is_playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <button
            type="button"
            aria-label="Next track"
            onClick={() => onCommand("next")}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white transition-transform active:scale-90"
          >
            <NextIcon size={18} />
          </button>
        </div>

        {/* Volume button and subtle hover popover or toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={media?.muted ? "Unmute system volume" : "Mute system volume"}
            onClick={() => onCommand("toggle_mute")}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/80 transition-colors hover:text-white"
          >
            {media?.muted ? <VolumeOffIcon size={16} /> : <VolumeOnIcon size={16} />}
          </button>
          <input
            type="range"
            aria-label="System volume"
            min={0}
            max={100}
            value={media?.volume_percent ?? 50}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-14 cursor-pointer accent-white opacity-60 hover:opacity-100"
          />
        </div>
      </div>
    </div>
  );
}

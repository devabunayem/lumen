import { motion, useReducedMotion } from "motion/react";
import {
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
        className="flex h-full w-full items-center justify-between px-4 py-3"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderRadius: "var(--card-radius)",
          border: "1px solid var(--hairline)",
        }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="type-body" style={{ color: "var(--text-primary)" }}>
            Nothing playing
          </span>
          <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
            Play Spotify, YouTube, or any media app to control it here
          </span>
        </div>
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--text-tertiary)" }}
        />
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
    <div
      className="flex h-full w-full items-center gap-3 px-3.5 py-2.5"
      style={{
        backgroundColor: "var(--surface-raised)",
        borderRadius: "var(--card-radius)",
        border: "1px solid var(--hairline)",
      }}
    >
      {/* Album art left (FR-MUS-3) */}
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden"
        style={{
          borderRadius: "calc(var(--card-radius) - 6px)",
          backgroundColor: "var(--surface-button)",
          border: "1px solid var(--hairline)",
        }}
      >
        {active.album_art_data_url ? (
          <img
            src={active.album_art_data_url}
            alt={`${active.title} album art`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span style={{ color: accent }}>
            <MusicNoteIcon size={20} />
          </span>
        )}
      </div>

      {/* Track metadata or Synced Lyrics view (FR-MUS-3, FR-MUS-4) */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        {lyricsOpen ? (
          <div className="flex h-16 flex-col justify-center gap-1 overflow-y-auto pr-1">
            {lyricsLines.length === 0 ? (
              <span className="type-caption" style={{ color: "var(--text-secondary)" }}>
                No synced lyrics found on LRCLIB for this track.
              </span>
            ) : (
              lyricsLines
                .slice(Math.max(0, activeLyricIdx), Math.max(0, activeLyricIdx) + 3)
                .map((line, i) => (
                  <div
                    key={`${line.time_ms}-${i}`}
                    className={
                      i === 0 ? "type-body truncate font-semibold" : "type-caption truncate"
                    }
                    style={{
                      color: i === 0 ? accent : "var(--text-secondary)",
                    }}
                  >
                    {line.text}
                  </div>
                ))
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div
                  className="type-body truncate"
                  style={{ color: "var(--text-primary)" }}
                  title={active.title}
                >
                  {active.title}
                </div>
                <div
                  className="type-caption truncate"
                  style={{ color: "var(--text-secondary)" }}
                  title={active.artist}
                >
                  {active.artist || active.app_id}
                </div>
              </div>

              {media && media.sessions.length > 1 && (
                <select
                  aria-label="Switch active media player"
                  value={active.app_id}
                  onChange={(e) => onSelectSession(e.target.value)}
                  className="type-caption max-w-[110px] cursor-pointer truncate rounded-full border-0 px-2 py-0.5"
                  style={{
                    backgroundColor: "var(--surface-button)",
                    color: "var(--text-primary)",
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

            <div className="flex items-center gap-2">
              <span
                className="type-caption w-9 shrink-0 tabular-nums"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatDurationMs(clampedPos)}
              </span>
              <div className="relative flex flex-1 items-center">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--surface-button)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: accent }}
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
                className="type-caption w-10 shrink-0 text-right tabular-nums"
                style={{ color: "var(--text-secondary)" }}
              >
                -{formatDurationMs(remainingMs)}
              </span>
            </div>
          </>
        )}

        {/* Controls row: lyrics, prev, play/pause, next, system volume (FR-MUS-2, FR-MUS-3) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Toggle lyrics"
              aria-pressed={lyricsOpen}
              onClick={onToggleLyrics}
              className="type-caption cursor-pointer rounded-full border-0 px-2.5 py-1"
              style={{
                backgroundColor: lyricsOpen ? accent : "var(--surface-button)",
                color: "var(--text-primary)",
              }}
            >
              Lyrics
            </button>
            <button
              type="button"
              aria-label="Previous track"
              onClick={() => onCommand("previous")}
              className="type-caption flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0"
              style={{ backgroundColor: "var(--surface-button)", color: "var(--text-primary)" }}
            >
              <PrevIcon size={13} />
            </button>
            <button
              type="button"
              aria-label={active.is_playing ? "Pause" : "Play"}
              onClick={() => onCommand("play_pause")}
              className="type-caption flex h-7 w-8 cursor-pointer items-center justify-center rounded-full border-0 font-semibold"
              style={{ backgroundColor: accent, color: "#000000" }}
            >
              {active.is_playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>
            <button
              type="button"
              aria-label="Next track"
              onClick={() => onCommand("next")}
              className="type-caption flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0"
              style={{ backgroundColor: "var(--surface-button)", color: "var(--text-primary)" }}
            >
              <NextIcon size={13} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={media?.muted ? "Unmute system volume" : "Mute system volume"}
              onClick={() => onCommand("toggle_mute")}
              className="type-caption flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0"
              style={{ backgroundColor: "var(--surface-button)", color: "var(--text-secondary)" }}
            >
              {media?.muted ? <VolumeOffIcon size={13} /> : <VolumeOnIcon size={13} />}
            </button>
            <input
              type="range"
              aria-label="System volume"
              min={0}
              max={100}
              value={media?.volume_percent ?? 50}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-16 cursor-pointer accent-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

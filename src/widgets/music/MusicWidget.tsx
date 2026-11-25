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
import { type LyricLine, type MediaStateSnapshot, shelfOpen } from "../../lib/ipc";

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
    const lastSession = media?.sessions?.[0] ?? null;
    return (
      <div
        role="region"
        aria-label="No media playing"
        className="flex h-full w-full items-center justify-between gap-3 px-2"
        style={{
          borderRadius: "var(--card-radius)",
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(10, 132, 255, 0.22), rgba(28, 28, 30, 0.95))",
              border: "1px solid var(--hairline)",
              color: "var(--text-secondary)",
            }}
          >
            <MusicNoteIcon size={18} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className="type-body truncate font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Not Playing
            </span>
            {lastSession ? (
              <span className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
                {lastSession.title} · {lastSession.artist}
              </span>
            ) : (
              <span className="type-caption truncate" style={{ color: "var(--text-secondary)" }}>
                Nothing playing
              </span>
            )}
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          onClick={() => {
            if (lastSession) {
              onSelectSession(lastSession.app_id);
              onCommand("play_pause");
            } else {
              void shelfOpen("spotify:").catch(() => {
                window.open("spotify:", "_self");
              });
            }
          }}
          aria-label={lastSession ? `Resume ${lastSession.title}` : "Open Spotify"}
          className="type-caption flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
          style={{
            height: "var(--capsule-height)",
            backgroundColor: "var(--surface-button)",
            border: "1px solid var(--hairline-strong)",
            color: "var(--text-primary)",
          }}
        >
          <PlayIcon size={12} />
          <span>{lastSession ? "Resume" : "Open Spotify"}</span>
        </motion.button>
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
    <div className="flex h-full w-full flex-col justify-between overflow-hidden px-1">
      {/* Top row: Artwork on Left, Song Title & Controls on Right */}
      <div className="flex items-center gap-3">
        {/* Album Artwork */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
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
        <div className="flex h-5 flex-col justify-center overflow-hidden px-1">
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

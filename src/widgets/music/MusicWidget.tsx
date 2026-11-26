import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  HeadphonesIcon,
  MessageSquareIcon,
  MusicNoteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  ShuffleIcon,
  VolumeOffIcon,
  VolumeOnIcon,
} from "../../design/icons";
import { COLOR_TOKENS } from "../../design/tokens";
import {
  type LyricLine,
  type MediaSessionInfo,
  type MediaStateSnapshot,
  shelfOpen,
} from "../../lib/ipc";

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

const WAVE_ENVELOPE = [
  0.34, 0.56, 0.42, 0.78, 0.62, 0.92, 0.48, 0.84, 0.36, 0.7, 0.96, 0.54, 0.82, 0.44, 0.66, 0.9,
  0.52, 0.76, 0.4, 0.86, 0.6, 0.94, 0.46, 0.72, 0.38, 0.8, 0.58, 0.88, 0.44, 0.68, 0.92, 0.5, 0.74,
  0.36, 0.82, 0.6, 0.48, 0.86, 0.52, 0.7, 0.42, 0.78, 0.56, 0.64, 0.4, 0.5,
] as const;

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
  const rawActive = media?.active ?? null;
  const [heldActive, setHeldActive] = useState<MediaSessionInfo | null>(rawActive);
  const [trackDirection, setTrackDirection] = useState<1 | -1>(1);
  const [shuffleActive, setShuffleActive] = useState(false);
  const [displayPosMs, setDisplayPosMs] = useState<number>(rawActive?.position_ms ?? 0);
  const syncRef = useRef({
    posMs: rawActive?.position_ms ?? 0,
    syncedAt: 0,
  });

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setHeldActive(rawActive);
      },
      rawActive ? 0 : 1200,
    );
    return () => window.clearTimeout(timer);
  }, [rawActive]);

  const active = rawActive ?? heldActive;
  const accent = active?.accent_hex || COLOR_TOKENS.musicDefaultFrom;

  useEffect(() => {
    const pos = active?.position_ms ?? 0;
    syncRef.current = {
      posMs: pos,
      syncedAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    };
    const timer = window.setTimeout(() => {
      setDisplayPosMs(pos);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active?.app_id, active?.title, active?.position_ms, active?.is_playing]);

  useEffect(() => {
    if (!active?.is_playing) {
      return;
    }
    const duration = Math.max(active.duration_ms, 1);
    const id = window.setInterval(() => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = Math.max(0, now - syncRef.current.syncedAt);
      setDisplayPosMs(Math.min(duration, syncRef.current.posMs + elapsed));
    }, 200);
    return () => window.clearInterval(id);
  }, [active?.is_playing, active?.duration_ms]);

  if (!active) {
    const lastSession = media?.sessions?.[0] ?? null;
    return (
      <div
        role="region"
        aria-label="No media playing"
        className="flex h-full w-full items-center justify-between gap-3 px-2"
        style={{ borderRadius: "var(--card-radius)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${COLOR_TOKENS.musicDefaultFrom}, ${COLOR_TOKENS.musicDefaultTo})`,
              boxShadow: "0 6px 20px rgba(130, 60, 255, 0.35)",
              color: COLOR_TOKENS.textPrimary,
            }}
          >
            <MusicNoteIcon size={22} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className="type-body truncate font-semibold"
              style={{ color: COLOR_TOKENS.textPrimary }}
            >
              Not Playing
            </span>
            <span className="type-caption truncate" style={{ color: COLOR_TOKENS.textSecondary }}>
              {lastSession ? `${lastSession.title} · ${lastSession.artist}` : "Nothing playing"}
            </span>
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
          className="type-caption flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 font-semibold transition-opacity hover:opacity-90"
          style={{
            height: "var(--capsule-height)",
            backgroundColor: COLOR_TOKENS.surfaceButton,
            border: `1px solid ${COLOR_TOKENS.hairlineStrong}`,
            color: COLOR_TOKENS.textPrimary,
          }}
        >
          <PlayIcon size={12} />
          <span>{lastSession ? "Resume" : "Open Spotify"}</span>
        </motion.button>
      </div>
    );
  }

  const duration = Math.max(active.duration_ms, 1);
  const clampedPos = Math.min(displayPosMs, duration);
  const progressPct = Math.min(100, Math.max(0, (clampedPos / duration) * 100));
  const remainingMs = Math.max(0, duration - clampedPos);
  const trackKey = `${active.app_id}:${active.title}:${active.artist}`;

  const activeLyricIdx = lyricsLines.reduce((acc, line, idx) => {
    return line.time_ms <= clampedPos ? idx : acc;
  }, -1);
  const currentLyric =
    lyricsLines.length > 0 ? (lyricsLines[Math.max(0, activeLyricIdx)]?.text ?? "") : null;
  const nextLyric =
    lyricsLines.length > 0 ? (lyricsLines[Math.max(0, activeLyricIdx) + 1]?.text ?? null) : null;

  return (
    <div className="relative flex h-full w-full items-stretch gap-3.5 overflow-hidden px-1">
      {/* Album-tinted multi-stop background wash matching the screenshot */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 z-0"
        style={{
          background: active.album_art_data_url
            ? `radial-gradient(240px 170px at 16% 52%, ${accent}44, transparent 72%), radial-gradient(200px 130px at 88% 82%, ${accent}24, transparent 72%)`
            : `radial-gradient(240px 170px at 16% 52%, rgba(168, 85, 247, 0.36), transparent 72%), radial-gradient(200px 130px at 88% 82%, rgba(214, 51, 108, 0.24), transparent 72%)`,
        }}
      />

      {/* Left Large Squircle Artwork */}
      <div className="relative z-10 flex shrink-0 items-center">
        <AnimatePresence custom={trackDirection} initial={false} mode="popLayout">
          <motion.div
            key={trackKey}
            custom={trackDirection}
            initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.94 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="flex h-[96px] w-[96px] items-center justify-center overflow-hidden rounded-[20px]"
            style={{
              background: active.album_art_data_url
                ? COLOR_TOKENS.surfaceRaised
                : `linear-gradient(135deg, ${COLOR_TOKENS.musicDefaultFrom}, ${COLOR_TOKENS.musicDefaultTo})`,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            {active.album_art_data_url ? (
              <img src={active.album_art_data_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span style={{ color: COLOR_TOKENS.textPrimary }}>
                <MusicNoteIcon size={32} />
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right Side: Metadata + Source Badge + Synced Lyrics + Waveform Scrubber + White Circle Play Controls */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-0.5">
        {/* Top Metadata Row + Headphones / Source Switcher Pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[14.5px] font-bold leading-tight text-white"
              title={active.title}
            >
              {active.title || "Unknown Title"}
            </div>
            <div
              className="truncate text-[11px] leading-tight"
              style={{ color: COLOR_TOKENS.textSecondary }}
              title={active.artist || active.app_id}
            >
              {active.artist || active.app_id || "Unknown Artist"}
            </div>
          </div>

          <div className="relative shrink-0">
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                color: COLOR_TOKENS.textPrimary,
              }}
            >
              <HeadphonesIcon size={11} />
              <span className="max-w-[82px] truncate">{active.app_id || "Headphones"}</span>
            </div>
            {media && media.sessions.length > 1 && (
              <select
                aria-label="Switch active media player"
                value={active.app_id}
                onChange={(e) => onSelectSession(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {media.sessions.map((s) => (
                  <option key={s.app_id} value={s.app_id}>
                    {s.title || s.app_id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 2-Line Synced Lyrics Preview */}
        {(currentLyric !== null || lyricsOpen) && (
          <div className="min-h-[24px] leading-tight">
            {currentLyric !== null ? (
              <>
                <div className="truncate text-[11px] font-semibold text-white">{currentLyric}</div>
                {nextLyric && (
                  <div className="truncate text-[10.5px] text-white/55">{nextLyric}</div>
                )}
              </>
            ) : (
              <div className="truncate text-[10.5px]" style={{ color: COLOR_TOKENS.textSecondary }}>
                No synced lyrics available
              </div>
            )}
          </div>
        )}

        {/* Full-Width Waveform Scrubber + Timestamps */}
        <div className="w-full">
          <div className="relative flex h-[22px] w-full items-center justify-between gap-[2px]">
            {WAVE_ENVELOPE.map((amp, i) => {
              const barPct = (i / (WAVE_ENVELOPE.length - 1)) * 100;
              const passed = barPct <= progressPct;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className="flex-1 rounded-full transition-colors duration-100"
                  style={{
                    height: `${Math.round(amp * 20)}px`,
                    minWidth: "2px",
                    backgroundColor: passed ? "#ffffff" : "rgba(255, 255, 255, 0.24)",
                  }}
                />
              );
            })}
            <input
              type="range"
              aria-label="Seek track position"
              min={0}
              max={duration}
              value={clampedPos}
              onChange={(e) => {
                const next = Number(e.target.value);
                syncRef.current = {
                  posMs: next,
                  syncedAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
                };
                setDisplayPosMs(next);
                onSeek(next);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <div
            className="mt-0.5 flex items-center justify-between text-[10px] tabular-nums leading-none"
            style={{ color: COLOR_TOKENS.textSecondary }}
          >
            <span>{formatDurationMs(clampedPos)}</span>
            <span>-{formatDurationMs(remainingMs)}</span>
          </div>
        </div>

        {/* Bottom Controls: Shuffle | Prev, White Circle Play/Pause, Next | Volume + Lyrics */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            aria-label="Toggle shuffle"
            aria-pressed={shuffleActive}
            onClick={() => setShuffleActive((s) => !s)}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-colors"
            style={{
              color: shuffleActive ? COLOR_TOKENS.textPrimary : COLOR_TOKENS.textSecondary,
            }}
          >
            <ShuffleIcon size={13} />
          </button>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Previous track"
              onClick={() => {
                setTrackDirection(-1);
                onCommand("previous");
              }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/90 transition-transform hover:text-white active:scale-90"
            >
              <PrevIcon size={15} />
            </button>

            <button
              type="button"
              aria-label={active.is_playing ? "Pause" : "Play"}
              onClick={() => onCommand("play_pause")}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-white text-black shadow-md transition-transform active:scale-90"
            >
              {active.is_playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
            </button>

            <button
              type="button"
              aria-label="Next track"
              onClick={() => {
                setTrackDirection(1);
                onCommand("next");
              }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/90 transition-transform hover:text-white active:scale-90"
            >
              <NextIcon size={15} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={media?.muted ? "Unmute system volume" : "Mute system volume"}
              onClick={() => onCommand("toggle_mute")}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-white/80 hover:text-white"
            >
              {media?.muted ? <VolumeOffIcon size={13} /> : <VolumeOnIcon size={13} />}
            </button>

            <div className="relative flex h-4 w-12 items-center">
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${media?.muted ? 0 : (media?.volume_percent ?? 50)}%` }}
                />
              </div>
              <input
                type="range"
                aria-label="System volume"
                min={0}
                max={100}
                value={media?.volume_percent ?? 50}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>

            <button
              type="button"
              aria-label="Toggle lyrics"
              aria-pressed={lyricsOpen}
              onClick={onToggleLyrics}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border-0 transition-colors"
              style={{
                backgroundColor: lyricsOpen ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)",
                color: lyricsOpen ? "#ffffff" : COLOR_TOKENS.textSecondary,
              }}
            >
              <MessageSquareIcon size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

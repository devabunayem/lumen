import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";
import {
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "../../design/icons";
import { COLOR_TOKENS } from "../../design/tokens";
import { getMessages, type AppLanguage } from "../../i18n";
import { formatDigits } from "../../i18n/digits";
import type { MediaStateSnapshot } from "../../lib/ipc";

export interface MusicCardProps {
  media: MediaStateSnapshot;
  lastPlayedTrack?: { title: string; artist: string } | null;
  language?: AppLanguage;
  banglaDigits: boolean;
  reduceMotion: boolean;
  onOpenMusicPage: () => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMuteToggle: () => void;
  onVolumeDelta: (nextPct: number) => void;
}

function formatTrackTime(ms: number, banglaDigits: boolean): string {
  const secs = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return formatDigits(`${m}:${String(s).padStart(2, "0")}`, banglaDigits);
}

export function MusicCard({
  media,
  lastPlayedTrack = null,
  language = "en",
  banglaDigits,
  reduceMotion,
  onOpenMusicPage,
  onPlayPause,
  onPrev,
  onNext,
  onMuteToggle,
  onVolumeDelta,
}: MusicCardProps) {
  const msg = getMessages(language);
  const [volumeHudPct, setVolumeHudPct] = useState<number | null>(null);
  const session = media.active;
  const [livePosMs, setLivePosMs] = useState<number>(session?.position_ms ?? 0);
  const syncRef = useRef({
    posMs: session?.position_ms ?? 0,
    syncedAt: 0,
  });

  useEffect(() => {
    const pos = session?.position_ms ?? 0;
    syncRef.current = {
      posMs: pos,
      syncedAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
    };
    const syncTimer = window.setTimeout(() => setLivePosMs(pos), 0);
    return () => window.clearTimeout(syncTimer);
  }, [session?.app_id, session?.title, session?.position_ms, session?.is_playing]);

  useEffect(() => {
    if (!session?.is_playing) {
      return;
    }
    const maxDur = Math.max(1, session.duration_ms ?? 1);
    const id = window.setInterval(() => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = Math.max(0, now - syncRef.current.syncedAt);
      setLivePosMs(Math.min(maxDur, syncRef.current.posMs + elapsed));
    }, 250);
    return () => window.clearInterval(id);
  }, [session?.is_playing, session?.duration_ms]);

  const duration = Math.max(1, session?.duration_ms ?? 1);
  const position = Math.min(duration, livePosMs);
  const pct = session ? Math.round((position / duration) * 100) : 0;
  const remaining = Math.max(0, (session?.duration_ms ?? 0) - position);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const step = e.deltaY < 0 ? 5 : -5;
    const nextPct = Math.max(0, Math.min(100, (media.volume_percent ?? 50) + step));
    setVolumeHudPct(nextPct);
    onVolumeDelta(nextPct);
    window.setTimeout(() => {
      setVolumeHudPct((cur) => (cur === nextPct ? null : cur));
    }, 1100);
  };

  const handleAuxClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onMuteToggle();
    }
  };

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      onPlayPause();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpenMusicPage();
    }
  };

  return (
    <div
      data-testid="home-music-card"
      role="button"
      tabIndex={0}
      aria-label={
        session ? `${session.title} — ${msg.home.music.openPlayer}` : msg.home.music.nothingPlaying
      }
      onClick={onOpenMusicPage}
      onWheel={handleWheel}
      onAuxClick={handleAuxClick}
      onKeyDown={handleCardKeyDown}
      className={`home-glass-card relative flex h-[94px] cursor-pointer items-center gap-2.5 overflow-hidden px-[12px] py-[10px] text-left ${
        reduceMotion ? "" : "transition-transform duration-100 active:scale-[0.985]"
      }`}
    >
      {/* 60px artwork square (radius 14) */}
      <div
        className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
        style={{
          background: session?.album_art_data_url
            ? COLOR_TOKENS.surfaceRaised
            : `linear-gradient(135deg, ${COLOR_TOKENS.musicDefaultFrom}, ${COLOR_TOKENS.musicDefaultTo})`,
        }}
      >
        {session?.album_art_data_url ? (
          <img
            src={session.album_art_data_url}
            alt={session.album_title || session.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <MusicNoteIcon size={22} className="text-white/90" />
        )}
      </div>

      {session ? (
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          <div className="min-w-0">
            <div className="type-home-card-title truncate leading-tight text-white">
              {session.title}
            </div>
            <div
              className="type-home-micro truncate leading-tight"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              {session.artist || session.app_id}
            </div>
          </div>

          <div className="w-full">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div
              className="type-home-micro mt-0.5 flex items-center justify-between leading-none tabular-nums"
              style={{ color: COLOR_TOKENS.textSecondary }}
            >
              <span>{formatTrackTime(position, banglaDigits)}</span>
              <span>-{formatTrackTime(remaining, banglaDigits)}</span>
            </div>
          </div>

          <div
            className="flex items-center justify-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label={msg.home.music.prev}
              onClick={onPrev}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-white/85 hover:text-white"
            >
              <SkipBackIcon size={13} />
            </button>
            <button
              type="button"
              aria-label={session.is_playing ? msg.home.music.pause : msg.home.music.play}
              onClick={onPlayPause}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full"
            >
              <span className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-white text-black">
                {session.is_playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
              </span>
            </button>
            <button
              type="button"
              aria-label={msg.home.music.next}
              onClick={onNext}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-white/85 hover:text-white"
            >
              <SkipForwardIcon size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5"
          data-testid="music-empty-state"
        >
          <div className="min-w-0">
            <div className="type-home-card-title truncate text-white">
              {msg.home.music.nothingPlaying}
            </div>
            <div className="type-home-micro truncate" style={{ color: COLOR_TOKENS.textSecondary }}>
              {lastPlayedTrack
                ? `${lastPlayedTrack.title} · ${lastPlayedTrack.artist}`
                : msg.home.music.lastPlayed}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onPlayPause}
              className="home-glass-chip type-home-micro inline-flex min-h-[26px] items-center gap-1.5 px-2.5 font-semibold text-white"
            >
              <PlayIcon size={10} />
              <span>{msg.home.music.play}</span>
            </button>
          </div>
        </div>
      )}

      {/* 64 px inline mini volume HUD on wheel */}
      {volumeHudPct !== null && (
        <div
          data-testid="music-volume-hud"
          className="type-home-micro absolute top-2 right-2 flex w-[64px] items-center justify-center rounded-full px-2 py-0.5 font-semibold text-white"
          style={{
            background: COLOR_TOKENS.arcTooltipBg,
            border: `1px solid ${COLOR_TOKENS.chipGlassBorder}`,
          }}
        >
          {formatDigits(`${volumeHudPct}%`, banglaDigits)}
        </div>
      )}
    </div>
  );
}

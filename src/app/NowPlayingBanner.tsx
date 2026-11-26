import { motion, useReducedMotion } from "motion/react";
import { MusicNoteIcon } from "../design/icons";
import { getMotionTransition } from "../design/motion";
import { LiveWaveform } from "../widgets/music/LiveWaveform";

export interface NowPlayingBannerItem {
  title: string;
  artist: string;
  appName: string;
  albumArtDataUrl: string | null;
  accentHex: string;
}

export interface NowPlayingBannerProps {
  item: NowPlayingBannerItem;
  language?: "en" | "bn";
  onOpenPlayer: () => void;
  onDismiss: () => void;
}

/**
 * Compact brief banner shown briefly when YouTube / Media playback starts or switches track.
 */
export function NowPlayingBanner({
  item,
  language = "en",
  onOpenPlayer,
  onDismiss,
}: NowPlayingBannerProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const accent = item.accentHex || "var(--accent-blue)";
  const isBn = language === "bn";

  return (
    <motion.div
      data-testid="now-playing-banner"
      drag={prefersReducedMotion ? false : "x"}
      dragConstraints={{ left: -100, right: 100 }}
      dragElastic={0.4}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 50) {
          onDismiss();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpenPlayer();
      }}
      transition={getMotionTransition("collapse", prefersReducedMotion)}
      className="flex h-full w-full cursor-pointer items-center justify-between gap-3 px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{
            backgroundColor: "var(--surface-button)",
            border: "1px solid var(--hairline-top)",
            color: accent,
          }}
        >
          {item.albumArtDataUrl ? (
            <img
              src={item.albumArtDataUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <MusicNoteIcon size={16} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-semibold tracking-wide uppercase"
              style={{ color: accent }}
            >
              {isBn ? "এখন চলছে" : "Now Playing"}
            </span>
            {item.appName && (
              <span className="truncate text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                · {item.appName}
              </span>
            )}
          </div>
          <div
            className="truncate text-[12.5px] font-semibold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {item.title}
          </div>
          {item.artist && (
            <div className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {item.artist}
            </div>
          )}
        </div>
      </div>

      <LiveWaveform playing accentColor={accent} />
    </motion.div>
  );
}

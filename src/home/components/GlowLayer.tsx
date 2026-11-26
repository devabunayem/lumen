import { MOTION_PRESETS } from "../../design/motion";
import type { AmbientPalette } from "../hooks/useAmbientPalette";

export interface GlowLayerProps {
  palette: AmbientPalette;
  reduceMotion: boolean;
  isVisible: boolean;
  parallaxOffset: { x: number; y: number };
}

/**
 * Three-layer transform-only Living Ambient Glow behind Home content inside the island clip.
 * Respects Reduce Transparency (solid static ambient washes) and Reduce Motion (no drift/parallax).
 */
export function GlowLayer({ palette, reduceMotion, isVisible }: GlowLayerProps) {
  if (!palette.glowEnabled) {
    return null;
  }

  const shouldDrift = isVisible && !reduceMotion && !palette.reduceTransparency;
  const crossfadeStyle = {
    transition: `background ${MOTION_PRESETS.glowCrossfade.duration}s ease-in-out, opacity ${MOTION_PRESETS.glowCrossfade.duration}s ease-in-out`,
  };

  return (
    <div
      aria-hidden="true"
      data-testid="living-glow-layer"
      data-phase={palette.timePhase}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        opacity: palette.glowOpacityScale,
        filter: palette.reduceTransparency ? undefined : "saturate(1)",
        ...crossfadeStyle,
      }}
    >
      <div className={shouldDrift ? "lumen-glow-drift absolute -inset-10" : "absolute -inset-10"}>
        {/* (a) Sun / Time-of-day glow: ellipse 360x200 at 78% / 22% */}
        <div
          className="absolute inset-0"
          style={{
            background: palette.reduceTransparency
              ? `radial-gradient(360px 200px at 78% 22%, ${palette.sunGlowColor}, transparent 75%)`
              : `radial-gradient(360px 200px at 78% 22%, ${palette.sunGlowColor}, transparent 70%)`,
            ...crossfadeStyle,
          }}
        />
        {/* (b) Album art glow: ellipse 400x230 at 18% / 100% */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(400px 230px at 18% 100%, ${palette.albumGlowColor}, transparent 72%)`,
            ...crossfadeStyle,
          }}
        />
        {/* (c) Cool accent glow: ellipse 300x180 at 96% / 100% */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(300px 180px at 96% 100%, ${palette.accentGlowColor}, transparent 72%)`,
            ...crossfadeStyle,
          }}
        />
      </div>

      {/* Low battery (< 10%) subtle red edge wash */}
      {palette.lowBatteryGlowColor && (
        <div
          data-testid="low-battery-glow"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 95% 24% at 50% 100%, ${palette.lowBatteryGlowColor}, transparent 70%)`,
            ...crossfadeStyle,
          }}
        />
      )}
    </div>
  );
}

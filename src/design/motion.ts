import type { Transition } from "motion/react";

/**
 * Critically-damped, zero-overshoot springs and smooth crossfade curves.
 */
export const MOTION_PRESETS = {
  snappy: {
    type: "spring",
    stiffness: 420,
    damping: 34,
  },
  smooth: {
    type: "spring",
    stiffness: 300,
    damping: 32,
  },
  bouncy: {
    type: "spring",
    stiffness: 520,
    damping: 22,
  },
  gentle: {
    type: "spring",
    stiffness: 180,
    damping: 26,
  },
  expand: {
    type: "spring",
    stiffness: 380,
    damping: 38,
    mass: 0.7,
  },
  collapse: {
    type: "spring",
    stiffness: 400,
    damping: 40,
    mass: 0.7,
  },
  pageSwitch: {
    type: "spring",
    stiffness: 300,
    damping: 32,
  },
  shapeMorph: {
    type: "spring",
    stiffness: 340,
    damping: 35,
    mass: 0.9,
  },
  pillHover: {
    duration: 0.14,
    ease: [0.22, 1, 0.36, 1],
  },
  hideFullscreen: {
    duration: 0.24,
    ease: [0.22, 1, 0.36, 1],
  },
  progressSpring: {
    type: "spring",
    stiffness: 300,
    damping: 32,
  },
  homeContentEnter: {
    duration: 0.2,
    delay: 0.06,
    ease: [0.22, 1, 0.36, 1],
  },
  homeContentExit: {
    duration: 0.1,
    ease: "easeOut",
  },
  toggleCrossfade: {
    duration: 0.16,
    ease: "easeOut",
  },
  pressFeedback: {
    duration: 0.08,
    ease: "easeOut",
  },
  glowCrossfade: {
    duration: 0.6,
    ease: "easeInOut",
  },
  reducedMotionFade: {
    duration: 0.12,
    ease: "easeOut",
  },
  lumiEnter: {
    type: "spring",
    stiffness: 440,
    damping: 28,
  },
  lumiExit: {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1],
  },
  auroraFade: {
    duration: 0.35,
    ease: "easeInOut",
  },
  trackFlip: {
    duration: 0.28,
    ease: [0.22, 1, 0.36, 1],
  },
  waqtRailDraw: {
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1],
  },
  waqtBlurEnter: {
    duration: 0.2,
    delay: 0.06,
    ease: [0.22, 1, 0.36, 1],
  },
  lumiTransition: {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1],
  },
  lumiLook: {
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1],
  },
  lumiHeadphones: {
    duration: 0.2,
    ease: "easeOut",
  },
  lumiBeatNod: {
    duration: 0.12,
    ease: [0.22, 1, 0.36, 1],
  },
} as const satisfies Record<string, Transition>;

export const CONTENT_STAGGER = {
  expandDelayMs: 60,
  expandStaggerMs: 30,
  markerStaggerMs: 40,
  arcDrawDurationSec: 0.7,
  firstOpenSunDurationSec: 0.9,
  collapseFadeMs: 100,
  digitRollMs: 220,
  digitRollOffsetPx: 12,
  haloBreathSec: 4,
  glowDriftSec: 60,
  errorShakeX: [0, -4, 4, -4, 4, 0] as readonly number[],
  togglePulseScale: [1, 1.1, 1] as readonly number[],
} as const;

export function getMotionTransition(
  preset: keyof typeof MOTION_PRESETS,
  prefersReducedMotion: boolean,
): Transition {
  return prefersReducedMotion ? MOTION_PRESETS.reducedMotionFade : MOTION_PRESETS[preset];
}

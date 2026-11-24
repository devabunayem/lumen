import type { Transition } from "motion/react";

/**
 * Physics-based spring and fade presets (SRS Section 3.6).
 */
export const MOTION_PRESETS = {
  expand: {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 1,
  },
  collapse: {
    type: "spring",
    stiffness: 420,
    damping: 34,
  },
  pageSwitch: {
    type: "spring",
    stiffness: 300,
    damping: 32,
  },
  shapeMorph: {
    type: "spring",
    duration: 0.45,
    bounce: 0.2,
  },
  pillHover: {
    duration: 0.15,
    ease: "easeOut",
  },
  hideFullscreen: {
    duration: 0.3,
    ease: "easeInOut",
  },
  progressSpring: {
    type: "spring",
    stiffness: 260,
    damping: 28,
  },
  reducedMotionFade: {
    duration: 0.12,
    ease: "easeOut",
  },
} as const satisfies Record<string, Transition>;

export const CONTENT_STAGGER = {
  expandDelayMs: 80,
  expandStaggerMs: 30,
  collapseFadeMs: 100,
} as const;

export function getMotionTransition(
  preset: keyof typeof MOTION_PRESETS,
  prefersReducedMotion: boolean,
): Transition {
  return prefersReducedMotion ? MOTION_PRESETS.reducedMotionFade : MOTION_PRESETS[preset];
}

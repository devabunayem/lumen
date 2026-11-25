import type { Transition } from "motion/react";

/**
 * Critically-damped, zero-overshoot springs and smooth crossfade curves.
 */
export const MOTION_PRESETS = {
  expand: {
    type: "spring",
    stiffness: 240,
    damping: 26,
    mass: 0.8,
  },
  collapse: {
    type: "spring",
    stiffness: 260,
    damping: 28,
    mass: 0.8,
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
    stiffness: 260,
    damping: 28,
  },
  reducedMotionFade: {
    duration: 0.12,
    ease: "easeOut",
  },
} as const satisfies Record<string, Transition>;

export const CONTENT_STAGGER = {
  expandDelayMs: 35,
  expandStaggerMs: 20,
  collapseFadeMs: 80,
} as const;

export function getMotionTransition(
  preset: keyof typeof MOTION_PRESETS,
  prefersReducedMotion: boolean,
): Transition {
  return prefersReducedMotion ? MOTION_PRESETS.reducedMotionFade : MOTION_PRESETS[preset];
}

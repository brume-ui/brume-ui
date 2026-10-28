/**
 * Motion scale (柔霧動效). See MOTION.md for which token to use where.
 * Durations collapse to 0ms under prefers-reduced-motion, except `fade`, which stays short so
 * opacity cross-fades can remain (reduced motion means gentler, not none).
 */
export const duration = {
  instant: '100ms',
  fast: '150ms',
  base: '200ms',
  slow: '280ms',
  /** Opacity-only fades; the one duration kept under reduced motion. */
  fade: '150ms',
} as const;

/** The reduced-motion value of every duration. */
export const reducedDuration: Record<keyof typeof duration, string> = {
  instant: '0ms',
  fast: '0ms',
  base: '0ms',
  slow: '0ms',
  fade: '100ms',
};

/** No ease-in: UI motion starts fast and settles. */
export const easing = {
  /** Enter / exit / most UI: strong ease-out. */
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  /** Things that move or morph on screen (indicators, width, stacks): iOS-drawer curve. */
  emphasized: 'cubic-bezier(0.32, 0.72, 0, 1)',
  /** Spring-like settle with ~4% overshoot, for small confirmations (check, press release). */
  spring: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
} as const;

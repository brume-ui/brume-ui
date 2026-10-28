import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user asked for reduced motion. Safe outside the browser (returns false). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Live `prefers-reduced-motion: reduce`. Use it only for motion CSS can't switch off by itself
 * (JS-driven sequences, View Transitions); token durations already collapse in CSS.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

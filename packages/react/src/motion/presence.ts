import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './reduced-motion';

export interface Presence {
  /** Render the content at all. Stays true through the exit transition. */
  mounted: boolean;
  /** Apply the open styles. Flips one frame after mount so a CSS transition runs from closed. */
  shown: boolean;
  /** Open and finished transitioning (e.g. drop `overflow: hidden` so focus rings are not clipped). */
  settled: boolean;
}

/**
 * Mount/unmount around a CSS transition of `durationMs`. Content that starts open renders shown
 * and settled immediately (no animation on first paint). Under reduced motion nothing waits.
 */
export function usePresence(open: boolean, durationMs: number): Presence {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  const [settled, setSettled] = useState(open);

  useEffect(() => {
    const wait = prefersReducedMotion() ? 0 : durationMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outer = 0;
    let inner = 0;
    if (open) {
      setMounted(true);
      // Two frames: the first paints the closed state, the second starts the transition.
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          setShown(true);
          timer = setTimeout(() => setSettled(true), wait);
        });
      });
    } else {
      setSettled(false);
      setShown(false);
      timer = setTimeout(() => setMounted(false), wait);
    }
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(timer);
    };
  }, [open, durationMs]);

  return { mounted: mounted || open, shown: shown && open, settled: settled && open };
}

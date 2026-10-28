import {
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';
import { usePrefersReducedMotion } from '../motion/reduced-motion';

/** Width used before (or without) layout, e.g. on the server and in jsdom. */
export const FALLBACK_WIDTH = 640;

/**
 * Live content width of `ref` via ResizeObserver. The chart's height is fixed by props, so a
 * width change only re-lays the SVG out inside the same box (no layout shift).
 */
export function useChartWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Whether to play enter animations: never under reduced motion or when switched off. */
export function useEnterAnimation(animate: boolean | undefined): boolean {
  const reduced = usePrefersReducedMotion();
  return animate !== false && !reduced;
}

/** Stagger between neighbouring marks so the whole entrance stays under ~500ms. */
export function enterDelay(index: number, count: number, budgetMs = 220): number {
  if (count <= 1) return 0;
  return Math.round(index * Math.min(40, budgetMs / (count - 1)));
}

/**
 * Pure toggle for legend visibility: hides/shows `key`, but never hides the last visible one.
 */
export function toggleHidden(
  hidden: ReadonlySet<string>,
  key: string,
  keys: readonly string[],
): Set<string> {
  const next = new Set(hidden);
  if (next.has(key)) {
    next.delete(key);
    return next;
  }
  const visible = keys.filter((k) => !next.has(k));
  if (visible.length <= 1 && visible.includes(key)) return next;
  next.add(key);
  return next;
}

export function useHiddenKeys(keys: readonly string[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggle = useCallback(
    (key: string) => setHidden((prev) => toggleHidden(prev, key, keys)),
    [keys],
  );
  return { hidden, toggle };
}

export type ActiveSource = 'pointer' | 'keyboard';

/**
 * The highlighted datum, driven by pointer or keyboard. Arrow keys step through `count` items
 * (Left/Up back, Right/Down forward), Home/End jump, Escape clears; focusing the plot shows the
 * first item so keyboard users get the same tooltip as hover.
 */
export function useActiveIndex(count: number) {
  const [active, setActiveState] = useState<{ index: number; source: ActiveSource } | null>(null);
  const index = active && active.index < count ? active.index : null;

  const setActive = useCallback((i: number | null, source: ActiveSource = 'pointer') => {
    setActiveState((prev) =>
      i === null
        ? null
        : prev && prev.index === i && prev.source === source
          ? prev
          : { index: i, source },
    );
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (count === 0) return;
      const current = index ?? -1;
      let next: number | null = current;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = Math.min(count - 1, current + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = Math.max(0, current - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        case 'Escape':
          next = null;
          break;
        default:
          return;
      }
      e.preventDefault();
      setActive(next, 'keyboard');
    },
    [count, index, setActive],
  );

  const onFocus = useCallback(
    (e: FocusEvent) => {
      // Only the plot itself: focus moving inside (none today) must not reset the position.
      if (e.target === e.currentTarget && count > 0) setActive(index ?? 0, 'keyboard');
    },
    [count, index, setActive],
  );

  const onBlur = useCallback(() => setActive(null), [setActive]);

  return { index, source: active?.source ?? null, setActive, onKeyDown, onFocus, onBlur };
}

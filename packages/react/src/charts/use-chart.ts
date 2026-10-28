import {
  type KeyboardEvent,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePrefersReducedMotion } from '../motion/reduced-motion';

/**
 * Live content width of `ref` via ResizeObserver; null until the box has been measured (on the
 * server, before layout), when charts draw nothing inside their fixed-height box rather than
 * guess a width that could overflow it. The height is fixed by props, so a width change only
 * re-lays the SVG out inside the same box (no layout shift).
 */
export function useChartWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
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

/**
 * Hidden legend keys, pruned to the current `keys` (stale keys from earlier `series` are dropped)
 * and never covering every key that `counts`, so new data can't leave a blank chart without a
 * legend. `counts` (default: all keys) are the items that keep the chart from going blank; a
 * donut passes only its non-zero slices.
 */
export function useHiddenKeys(keys: readonly string[], counts: readonly string[] = keys) {
  const [stored, setStored] = useState<Set<string>>(() => new Set());
  const hidden = useMemo(() => pruneHidden(stored, keys, counts), [stored, keys, counts]);
  const toggle = useCallback(
    (key: string) =>
      setStored((prev) => toggleHidden(pruneHidden(prev, keys, counts), key, counts)),
    [keys, counts],
  );
  return { hidden, toggle };
}

export function pruneHidden(
  hidden: ReadonlySet<string>,
  keys: readonly string[],
  counts: readonly string[],
): Set<string> {
  const next = new Set([...hidden].filter((k) => keys.includes(k)));
  if (counts.length > 0 && counts.every((k) => next.has(k))) {
    for (const k of counts) next.delete(k);
  }
  return next;
}

export type ActiveSource = 'pointer' | 'keyboard';

/**
 * The highlighted datum, driven by pointer or keyboard. Arrow keys step through `count` items
 * (Left/Up back, Right/Down forward), Home/End jump, Escape clears. Keyboard focus shows the
 * first item so keyboard users get the same tooltip as hover; a tap or click (which also focuses
 * the plot) shows the item under the pointer instead and is never announced as a keyboard move.
 * `pointer(pick)` gives the pointer handlers, where `pick` maps an event to the item under it.
 */
export function useActiveIndex(count: number) {
  const pointerFocus = useRef(false);
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
    (e: ReactFocusEvent) => {
      // Pointer-driven focus: the pointerdown already chose the item.
      if (pointerFocus.current) {
        pointerFocus.current = false;
        return;
      }
      // Only the plot itself: focus moving inside (none today) must not reset the position.
      if (e.target === e.currentTarget && count > 0) setActive(index ?? 0, 'keyboard');
    },
    [count, index, setActive],
  );

  const onBlur = useCallback(() => {
    pointerFocus.current = false;
    setActive(null);
  }, [setActive]);

  const pointer = (pick: (e: ReactPointerEvent<HTMLElement>) => number | null) => ({
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      pointerFocus.current = true;
      setActive(pick(e), 'pointer');
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      setActive(pick(e), 'pointer');
    },
    // A finger "leaves" as it lifts: keep the tapped item until the next tap or blur.
    onPointerLeave(e: ReactPointerEvent<HTMLElement>) {
      if (e.pointerType !== 'touch') setActive(null);
    },
  });

  return {
    index,
    source: active?.source ?? null,
    setActive,
    keyboard: { onKeyDown, onFocus, onBlur },
    pointer,
  };
}

import { type CSSProperties, type RefObject, useLayoutEffect, useRef, useState } from 'react';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Position of `el` inside `container` from offset* (unaffected by transforms, so a scaling popover
 * or a dialog mid-animation measures its final layout). `container` must be positioned.
 */
export function boxWithin(el: HTMLElement, container: HTMLElement): Box | null {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node !== container) return null;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export interface IndicatorState {
  /** Inline style for the absolutely positioned indicator element. */
  style: CSSProperties;
  /** True once the indicator has a measured position (the item's own fallback styling can drop). */
  ready: boolean;
}

/** Inline style that places an indicator on `box`; `animate: false` jumps without a transition. */
export function indicatorStyle(box: Box | null, animate: boolean): CSSProperties {
  if (!box) return { opacity: 0, transform: 'translate(0, 0)', width: 0, height: 0 };
  return {
    opacity: 1,
    transform: `translate(${box.x}px, ${box.y}px)`,
    width: box.w,
    height: box.h,
    ...(animate ? null : { transitionProperty: 'opacity' }),
  };
}

/** Attributes that mark a current item; changes to them re-measure the indicator. */
const MARKERS = ['aria-current', 'data-nav-current'];

/**
 * A sliding "current item" indicator (sidebar, pagination). Re-measures when `key` changes and
 * when the container resizes; the first placement and re-appearances jump, moves animate.
 */
export function useActiveIndicator(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
  key: unknown,
): IndicatorState {
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);
  const had = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the deliberate re-measure trigger
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const el = container.querySelector<HTMLElement>(selector);
      const next = el ? boxWithin(el, container) : null;
      setAnimate(had.current && next !== null);
      had.current = next !== null && next.w > 0;
      setBox((prev) =>
        prev &&
        next &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.w === next.w &&
        prev.h === next.h
          ? prev
          : next,
      );
    };
    measure();
    // Size changes (collapse, expanding groups) and the current marker moving between elements.
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(container);
    const mutations =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure);
    mutations?.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: MARKERS,
    });
    return () => {
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [containerRef, selector, key]);

  return { style: indicatorStyle(box, animate), ready: box !== null && box.w > 0 };
}

/**
 * Highlight that glides between Radix menu/select items (`[data-highlighted]`). Attach `ref` to the
 * positioned element that contains the items and render an indicator element with `style`.
 */
export function useHighlightIndicator(): IndicatorState & {
  ref(node: HTMLElement | null): void;
} {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    if (!node || typeof MutationObserver === 'undefined') return;
    let visible = false;
    const update = () => {
      const el = node.querySelector<HTMLElement>('[data-highlighted]');
      const next = el ? boxWithin(el, node) : null;
      // Glide only from a visible highlight; a fresh one appears in place.
      setAnimate(visible && next !== null);
      visible = next !== null;
      setBox(next);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(node, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-highlighted'],
    });
    return () => observer.disconnect();
  }, [node]);

  return { ref: setNode, style: indicatorStyle(box, animate), ready: box !== null };
}

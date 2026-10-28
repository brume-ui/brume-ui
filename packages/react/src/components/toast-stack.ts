/**
 * Pure layout/gesture math for the toast stack (Sonner-like; technique after Emil Kowalski's
 * Sonner, MIT: collapsed depth, expand on hover, swipe threshold with a velocity escape).
 */

/** Toasts drawn at once; older ones wait (invisible, inert) until a front one leaves. */
export const VISIBLE_TOASTS = 3;
/** Collapsed: how far each toast behind peeks out above the one in front. */
export const PEEK_PX = 12;
/** Collapsed: each step back shrinks by this much. */
export const DEPTH_SCALE_STEP = 0.05;
/** Expanded: space between toasts. */
export const GAP_PX = 10;
/** Swipe distance that dismisses. */
export const SWIPE_THRESHOLD_PX = 45;
/** Or a flick faster than this (px/ms) in the dismiss direction... */
export const SWIPE_VELOCITY = 0.11;
/** ...that still travelled at least this far (a click's jitter is not a flick). */
export const FLICK_MIN_PX = 12;

export interface StackSlot {
  /** translateY in px (negative = up from the bottom edge). */
  y: number;
  scale: number;
  visible: boolean;
  /** Collapsed toasts behind the front one take the front's height and hide their content. */
  height: number | undefined;
  front: boolean;
}

/**
 * Slots for live toasts ordered newest first (`heights[0]` is the front toast).
 * Missing heights (not measured yet) count as the front's height.
 */
export function stackLayout(heights: number[], expanded: boolean): StackSlot[] {
  const front = heights[0] ?? 0;
  let offset = 0;
  return heights.map((h, i) => {
    const visible = i < VISIBLE_TOASTS;
    if (expanded) {
      const slot = {
        y: offset === 0 ? 0 : -offset,
        scale: 1,
        visible,
        height: undefined,
        front: i === 0,
      };
      offset += (h || front) + GAP_PX;
      return slot;
    }
    return {
      y: i === 0 ? 0 : -i * PEEK_PX,
      scale: 1 - Math.min(i, VISIBLE_TOASTS) * DEPTH_SCALE_STEP,
      visible,
      height: i === 0 ? undefined : front,
      front: i === 0,
    };
  });
}

/** Height the stack occupies (keeps hover alive across gaps while expanded). */
export function stackHeight(heights: number[], expanded: boolean): number {
  const shown = heights.slice(0, VISIBLE_TOASTS);
  if (shown.length === 0) return 0;
  const front = shown[0] ?? 0;
  if (!expanded) return front + (shown.length - 1) * PEEK_PX;
  return shown.reduce((sum, h) => sum + (h || front), 0) + (shown.length - 1) * GAP_PX;
}

/** Rightward drag offset to draw: free to the right, resisted to the left. */
export function swipeOffset(dx: number): number {
  return dx >= 0 ? dx : -Math.sqrt(-dx) * 2;
}

/** Whether a swipe released after `dx` px over `ms` dismisses the toast. */
export function shouldDismiss(dx: number, ms: number): boolean {
  if (dx >= SWIPE_THRESHOLD_PX) return true;
  return dx >= FLICK_MIN_PX && dx / Math.max(ms, 1) > SWIPE_VELOCITY;
}

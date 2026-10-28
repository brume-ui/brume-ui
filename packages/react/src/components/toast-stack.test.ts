import { describe, expect, it } from 'vitest';
import {
  DEPTH_SCALE_STEP,
  GAP_PX,
  PEEK_PX,
  SWIPE_THRESHOLD_PX,
  shouldDismiss,
  stackHeight,
  stackLayout,
  swipeOffset,
  VISIBLE_TOASTS,
} from './toast-stack';

describe('stackLayout', () => {
  it('collapsed: front at rest, older toasts peek above, smaller, at the front height', () => {
    const [front, second, third] = stackLayout([60, 90, 50], false);
    expect(front).toEqual({ y: 0, scale: 1, visible: true, height: undefined, front: true });
    expect(second).toMatchObject({ y: -PEEK_PX, scale: 1 - DEPTH_SCALE_STEP, height: 60 });
    expect(third).toMatchObject({ y: -2 * PEEK_PX, scale: 1 - 2 * DEPTH_SCALE_STEP, height: 60 });
  });

  it('expanded: toasts sit on top of each other at full size with a gap', () => {
    const slots = stackLayout([60, 90, 50], true);
    expect(slots.map((s) => s.y)).toEqual([0, -(60 + GAP_PX), -(60 + 90 + 2 * GAP_PX)]);
    expect(slots.every((s) => s.scale === 1 && s.height === undefined)).toBe(true);
  });

  it(`shows at most ${VISIBLE_TOASTS} toasts`, () => {
    const slots = stackLayout([40, 40, 40, 40, 40], false);
    expect(slots.map((s) => s.visible)).toEqual([true, true, true, false, false]);
  });

  it('stack height covers what is drawn in both states', () => {
    expect(stackHeight([], false)).toBe(0);
    expect(stackHeight([60, 90], false)).toBe(60 + PEEK_PX);
    expect(stackHeight([60, 90], true)).toBe(60 + 90 + GAP_PX);
    expect(stackHeight([60, 60, 60, 60], true)).toBe(3 * 60 + 2 * GAP_PX);
  });
});

describe('swipe', () => {
  it('dismisses past the distance threshold', () => {
    expect(shouldDismiss(SWIPE_THRESHOLD_PX, 2000)).toBe(true);
    expect(shouldDismiss(SWIPE_THRESHOLD_PX - 1, 2000)).toBe(false);
  });

  it('dismisses a quick flick that is shorter than the threshold', () => {
    expect(shouldDismiss(30, 100)).toBe(true);
    expect(shouldDismiss(30, 1000)).toBe(false);
  });

  it('never dismisses a jitter or a leftward drag', () => {
    expect(shouldDismiss(4, 5)).toBe(false);
    expect(shouldDismiss(-200, 50)).toBe(false);
  });

  it('follows the pointer to the right and resists to the left', () => {
    expect(swipeOffset(30)).toBe(30);
    expect(swipeOffset(-100)).toBe(-20);
  });
});

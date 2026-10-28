import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boxWithin, indicatorStyle } from './indicator';
import { usePresence } from './presence';
import { prefersReducedMotion, usePrefersReducedMotion } from './reduced-motion';
import { mockReducedMotion } from './test-utils';

function fakeLayout(
  el: HTMLElement,
  box: { left: number; top: number; w?: number; h?: number },
  parent: HTMLElement | null,
) {
  Object.defineProperties(el, {
    offsetLeft: { value: box.left, configurable: true },
    offsetTop: { value: box.top, configurable: true },
    offsetWidth: { value: box.w ?? 0, configurable: true },
    offsetHeight: { value: box.h ?? 0, configurable: true },
    offsetParent: { value: parent, configurable: true },
  });
}

afterEach(() => vi.useRealTimers());

describe('boxWithin', () => {
  it('sums offsets up to the container', () => {
    const container = document.createElement('nav');
    const group = document.createElement('div');
    const link = document.createElement('a');
    fakeLayout(group, { left: 4, top: 100 }, container);
    fakeLayout(link, { left: 8, top: 20, w: 200, h: 44 }, group);
    expect(boxWithin(link, container)).toEqual({ x: 12, y: 120, w: 200, h: 44 });
  });

  it('returns null when the element is outside the container', () => {
    const link = document.createElement('a');
    fakeLayout(link, { left: 0, top: 0 }, null);
    expect(boxWithin(link, document.createElement('nav'))).toBeNull();
  });
});

describe('indicatorStyle', () => {
  it('hides without a box and jumps (opacity-only transition) when not animating', () => {
    expect(indicatorStyle(null, true).opacity).toBe(0);
    const jump = indicatorStyle({ x: 1, y: 2, w: 3, h: 4 }, false);
    expect(jump).toMatchObject({ transform: 'translate(1px, 2px)', width: 3, height: 4 });
    expect(jump.transitionProperty).toBe('opacity');
    expect(indicatorStyle({ x: 1, y: 2, w: 3, h: 4 }, true).transitionProperty).toBeUndefined();
  });
});

describe('reduced motion', () => {
  it('reads the media query', () => {
    mockReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
    mockReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('usePresence', () => {
  it('starts shown when initially open', () => {
    const { result } = renderHook(() => usePresence(true, 200));
    expect(result.current).toEqual({ mounted: true, shown: true, settled: true });
  });

  it('mounts at once, shows after two frames, unmounts after the exit duration', async () => {
    mockReducedMotion(false);
    const { result, rerender } = renderHook(({ open }) => usePresence(open, 200), {
      initialProps: { open: false },
    });
    expect(result.current.mounted).toBe(false);
    rerender({ open: true });
    expect(result.current).toMatchObject({ mounted: true, shown: false });
    await act(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
    expect(result.current.shown).toBe(true);
    vi.useFakeTimers();
    rerender({ open: false });
    expect(result.current).toEqual({ mounted: true, shown: false, settled: false });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.mounted).toBe(false);
  });

  it('unmounts immediately under reduced motion', () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ open }) => usePresence(open, 200), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.mounted).toBe(false);
  });
});

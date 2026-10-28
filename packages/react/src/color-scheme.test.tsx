import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COLOR_SCHEME_STORAGE_KEY,
  THEME_SWITCH_ATTR,
  useColorScheme,
  withThemeTransition,
} from './color-scheme';
import { mockReducedMotion } from './motion/test-utils';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  vi.restoreAllMocks();
});

describe('useColorScheme', () => {
  it('dark sets attribute and storage; system removes attribute', () => {
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current.setScheme('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark');
    expect(result.current.resolved).toBe('dark');
    act(() => result.current.setScheme('system'));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('reads the stored scheme initially', () => {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current.scheme).toBe('dark');
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useColorScheme());
    expect(() => act(() => result.current.setScheme('dark'))).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('withThemeTransition', () => {
  it('applies the change immediately without the View Transitions API', () => {
    const update = vi.fn();
    withThemeTransition(update);
    expect(update).toHaveBeenCalledOnce();
  });

  it('runs the change inside a view transition, scoped by an attribute while it runs', async () => {
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const start = vi.fn((cb: () => void) => {
      cb();
      return { finished };
    });
    Object.assign(document, { startViewTransition: start });
    mockReducedMotion(false);
    const update = vi.fn();
    withThemeTransition(update);
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.hasAttribute(THEME_SWITCH_ATTR)).toBe(true);
    finish();
    await finished;
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(THEME_SWITCH_ATTR)).toBe(false);
  });

  it('skips the cross-fade under prefers-reduced-motion', () => {
    const start = vi.fn((cb: () => void) => cb());
    Object.assign(document, { startViewTransition: start });
    mockReducedMotion(true);
    const update = vi.fn();
    withThemeTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });
});

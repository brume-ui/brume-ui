import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLOR_SCHEME_STORAGE_KEY, useColorScheme } from './color-scheme';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
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

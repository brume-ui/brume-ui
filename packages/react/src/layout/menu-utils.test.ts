import { Circle, House, icons, LayoutDashboard, Trash } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveIcon } from './menu-utils';

afterEach(() => vi.restoreAllMocks());

describe('resolveIcon', () => {
  it('resolves kebab-case names', () => {
    expect(resolveIcon('layout-dashboard')).toBe(LayoutDashboard);
    expect(resolveIcon('trash')).toBe(Trash);
  });

  it('resolves the common older names lucide keeps as aliases (trash-2, home)', () => {
    // lucide 1.x renamed these; Laravel code still writes the names from the docs it learnt.
    expect((icons as Record<string, unknown>).Trash2).toBeUndefined();
    expect(resolveIcon('trash-2')).toBe(Trash);
    expect(resolveIcon('home')).toBe(House);
  });

  it('falls back to Circle and warns (once per name) for an unknown name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveIcon('no-such-icon')).toBe(Circle);
    expect(resolveIcon('no-such-icon')).toBe(Circle);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('no-such-icon');
  });

  it('never resolves a non-icon export such as the generic Icon', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveIcon('icon')).toBe(Circle);
  });
});

import { router } from '@inertiajs/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeLocale, LOCALE_COOKIE } from './locale';

afterEach(() => vi.restoreAllMocks());

describe('changeLocale', () => {
  it('writes the brume_locale cookie then reloads', () => {
    const cookie = vi.spyOn(document, 'cookie', 'set');
    const reload = vi.spyOn(router, 'reload').mockImplementation(() => {});
    changeLocale('en');
    expect(LOCALE_COOKIE).toBe('brume_locale');
    expect(cookie).toHaveBeenCalledWith('brume_locale=en; path=/; max-age=31536000; SameSite=Lax');
    expect(reload).toHaveBeenCalledOnce();
    expect(cookie.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0] as number,
    );
  });
});

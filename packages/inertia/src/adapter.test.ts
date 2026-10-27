import { router } from '@inertiajs/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInertiaAdapter } from './adapter';

afterEach(() => vi.restoreAllMocks());

describe('createInertiaAdapter', () => {
  it('visit forwards url and options to router.visit', () => {
    const visit = vi.spyOn(router, 'visit').mockImplementation(() => {});
    createInertiaAdapter().visit('/a', { preserveScroll: true });
    expect(visit).toHaveBeenCalledWith('/a', expect.objectContaining({ preserveScroll: true }));
  });

  it('reload forwards only', () => {
    const reload = vi.spyOn(router, 'reload').mockImplementation(() => {});
    createInertiaAdapter().reload({ only: ['envelope'] });
    expect(reload).toHaveBeenCalledWith(expect.objectContaining({ only: ['envelope'] }));
  });

  it('submit uses the method and flattens array errors to strings', () => {
    const visit = vi.spyOn(router, 'visit').mockImplementation((_url, options) => {
      options?.onError?.({ name: ['名稱必填', '其他'], email: 'Email 格式錯誤' } as never);
      options?.onFinish?.({} as never);
    });
    const onError = vi.fn();
    const onFinish = vi.fn();
    createInertiaAdapter().submit('put', '/admin/users/1', { name: '' }, { onError, onFinish });
    expect(visit).toHaveBeenCalledWith(
      '/admin/users/1',
      expect.objectContaining({ method: 'put', data: { name: '' } }),
    );
    expect(onError).toHaveBeenCalledWith({ name: '名稱必填', email: 'Email 格式錯誤' });
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('currentUrl returns path + search + hash', () => {
    window.history.replaceState(null, '', '/admin/users?page=2#top');
    expect(createInertiaAdapter().currentUrl()).toBe('/admin/users?page=2#top');
  });
});

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

describe('createInertiaAdapter request', () => {
  it('delegates to fetchJson (fetch with CSRF-aware JSON headers)', async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":1}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await createInertiaAdapter().request({
        method: 'patch',
        url: '/cell',
        body: { v: 1 },
      });
      expect(res).toEqual({ status: 200, data: { ok: 1 } });
      expect(fetchMock).toHaveBeenCalledWith(
        '/cell',
        expect.objectContaining({ method: 'PATCH', credentials: 'same-origin' }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createInertiaAdapter guardNavigation', () => {
  type Before = (event: {
    detail: { visit: { method: string; url: URL } };
    preventDefault(): void;
  }) => void;

  function setup(allow: (url: string) => boolean) {
    const off = vi.fn();
    let before: Before | undefined;
    const on = vi.spyOn(router, 'on').mockImplementation(((name: string, cb: Before) => {
      if (name === 'before') before = cb;
      return off;
    }) as never);
    const remove = vi.spyOn(window, 'removeEventListener');
    const unregister = createInertiaAdapter().guardNavigation(allow);
    const fire = (method: string, href: string) => {
      const event = {
        detail: { visit: { method, url: new URL(href, 'http://localhost') } },
        preventDefault: vi.fn(),
      };
      before?.(event);
      return event;
    };
    return { on, off, remove, unregister, fire };
  }

  it('prevents a GET visit when the guard refuses, passing the path', () => {
    const allow = vi.fn(() => false);
    const { fire, unregister } = setup(allow);
    const event = fire('get', '/admin/users?page=2#top');
    expect(allow).toHaveBeenCalledWith('/admin/users?page=2#top');
    expect(event.preventDefault).toHaveBeenCalledOnce();
    unregister();
  });

  it('lets a GET visit through when the guard allows it', () => {
    const { fire, unregister } = setup(() => true);
    expect(fire('get', '/a').preventDefault).not.toHaveBeenCalled();
    unregister();
  });

  it('never asks the guard about POST/PUT visits', () => {
    const allow = vi.fn(() => false);
    const { fire, unregister } = setup(allow);
    for (const method of ['post', 'put', 'patch', 'delete']) {
      expect(fire(method, '/save').preventDefault).not.toHaveBeenCalled();
    }
    expect(allow).not.toHaveBeenCalled();
    unregister();
  });

  it('blocks tab close while the guard refuses', () => {
    const { unregister } = setup(() => false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    unregister();
  });

  it('does not block tab close when allowed', () => {
    const { unregister } = setup(() => true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    unregister();
  });

  it('the unregister function removes both the router listener and beforeunload', () => {
    const { off, unregister } = setup(() => false);
    unregister();
    expect(off).toHaveBeenCalledOnce();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

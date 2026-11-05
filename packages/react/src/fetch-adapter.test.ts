import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchAdapter, type PageChange } from './fetch-adapter';
import type { HttpRequest, HttpResponse } from './http';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

function respondWith(res: HttpResponse) {
  return vi.fn(async (_req: HttpRequest) => res);
}

describe('createFetchAdapter navigation', () => {
  it('visit pushes the url and tells subscribers', () => {
    const a = createFetchAdapter();
    const changes: PageChange[] = [];
    a.subscribe((change) => changes.push(change));
    a.visit('/users?page=2');
    expect(a.currentUrl()).toBe('/users?page=2');
    expect(changes).toEqual([{ kind: 'visit', url: '/users?page=2', options: {} }]);
  });

  it('replace uses replaceState and a custom navigate wins', () => {
    const navigate = vi.fn();
    const a = createFetchAdapter({ navigate, currentUrl: () => '/now' });
    a.visit('/next', { replace: true });
    expect(navigate).toHaveBeenCalledWith('/next', { replace: true });
    expect(a.currentUrl()).toBe('/now');
  });

  it('reload keeps state and scroll and passes only through', () => {
    window.history.replaceState(null, '', '/list?page=3');
    const a = createFetchAdapter();
    const changes: PageChange[] = [];
    a.subscribe((change) => changes.push(change));
    a.reload({ only: ['envelope'] });
    expect(changes).toEqual([
      {
        kind: 'reload',
        url: '/list?page=3',
        options: { only: ['envelope'], preserveState: true, preserveScroll: true },
      },
    ]);
  });

  it('back/forward is reported as pop until the last listener leaves', () => {
    const a = createFetchAdapter();
    const listener = vi.fn();
    const off = a.subscribe(listener);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledWith({ kind: 'pop', url: '/', options: {} });
    off();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createFetchAdapter guardNavigation', () => {
  it('a refusing guard cancels a page change but not a same-page or partial visit', () => {
    window.history.replaceState(null, '', '/form');
    const a = createFetchAdapter();
    const listener = vi.fn();
    a.subscribe(listener);
    const allow = vi.fn(() => false);
    const off = a.guardNavigation(allow);
    a.visit('/elsewhere');
    expect(a.currentUrl()).toBe('/form');
    expect(allow).toHaveBeenCalledWith({ url: '/elsewhere' });
    a.visit('/form#section');
    a.visit('/other', { only: ['envelope'] });
    expect(allow).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    a.visit('/elsewhere');
    expect(a.currentUrl()).toBe('/elsewhere');
  });

  it('asks the guard before the tab unloads, until unregistered', () => {
    const a = createFetchAdapter();
    const off = a.guardNavigation(() => false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    off();
    const later = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });
});

describe('createFetchAdapter submit and request', () => {
  it('request goes through the custom sender', async () => {
    const request = respondWith({ status: 200, data: { ok: true } });
    const a = createFetchAdapter({ request });
    expect(await a.request({ method: 'get', url: '/x' })).toEqual({
      status: 200,
      data: { ok: true },
    });
    expect(request).toHaveBeenCalledWith({ method: 'get', url: '/x' });
  });

  it('submit reports the first message of each 422 error', async () => {
    const request = respondWith({
      status: 422,
      data: {
        message: 'bad',
        errors: { name: ['required', 'too short'], 'meta.color': 'invalid' },
      },
    });
    const a = createFetchAdapter({ request });
    const onError = vi.fn();
    const onSuccess = vi.fn();
    await new Promise<void>((resolve) =>
      a.submit('post', '/save', { name: '' }, { onError, onSuccess, onFinish: resolve }),
    );
    expect(request).toHaveBeenCalledWith({ method: 'post', url: '/save', body: { name: '' } });
    expect(onError).toHaveBeenCalledWith({ name: 'required', 'meta.color': 'invalid' });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('submit succeeds and follows a safe feedback redirect', async () => {
    const a = createFetchAdapter({
      request: respondWith({ status: 200, data: { feedback: { redirect: '/login' } } }),
    });
    const onSuccess = vi.fn();
    await new Promise<void>((resolve) =>
      a.submit('post', '/logout', {}, { onSuccess, onFinish: resolve }),
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(a.currentUrl()).toBe('/login');
  });

  it('submit ignores an unsafe redirect and other failures only finish', async () => {
    const unsafe = createFetchAdapter({
      request: respondWith({ status: 200, data: { redirect: 'javascript:alert(1)' } }),
    });
    await new Promise<void>((resolve) => unsafe.submit('post', '/x', {}, { onFinish: resolve }));
    expect(unsafe.currentUrl()).toBe('/');

    const failing = createFetchAdapter({ request: respondWith({ status: 500, data: {} }) });
    const onError = vi.fn();
    const onSuccess = vi.fn();
    await new Promise<void>((resolve) =>
      failing.submit('post', '/x', {}, { onError, onSuccess, onFinish: resolve }),
    );
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

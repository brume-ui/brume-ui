import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessage, fetchJson } from './http';
import { createTranslator } from './i18n';

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  // biome-ignore lint/suspicious/noDocumentCookie: tests seed the XSRF cookie directly
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('fetchJson', () => {
  it('sends the XSRF header from the cookie', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: tests seed the XSRF cookie directly
    document.cookie = `XSRF-TOKEN=${encodeURIComponent('a=b/c')}`;
    const fetchMock = stubFetch(async () => new Response('{"ok":true}', { status: 200 }));
    const res = await fetchJson({ method: 'post', url: '/x', body: { a: 1 } });
    expect(res).toEqual({ status: 200, data: { ok: true } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('same-origin');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': 'a=b/c',
      'Content-Type': 'application/json',
    });
  });

  it('omits the XSRF header and body for GET without a cookie', async () => {
    const fetchMock = stubFetch(async () => new Response('', { status: 200 }));
    const res = await fetchJson({ method: 'get', url: '/x', body: { a: 1 } });
    expect(res).toEqual({ status: 200, data: {} });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('X-XSRF-TOKEN');
  });

  it('serializes array query params with brackets', async () => {
    const fetchMock = stubFetch(async () => new Response('{}'));
    await fetchJson({ method: 'get', url: '/o?z=1', query: { q: 'a b', id: ['1', '2'] } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/o?z=1&q=a%20b&id[]=1&id[]=2');
  });

  it('fetchJson maps 419 and network errors', async () => {
    const t = createTranslator('zh-TW');
    stubFetch(async () => new Response('{"message":"expired"}', { status: 419 }));
    const r419 = await fetchJson({ method: 'post', url: '/x' });
    expect(r419.status).toBe(419);

    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const r0 = await fetchJson({ method: 'post', url: '/x' });
    expect(r0.status).toBe(0);
    expect(r0.data).toEqual({ message: 'Failed to fetch' });

    expect(errorMessage(r419, t)).toBe('頁面已過期，請重新整理後再試一次。');
    expect(errorMessage(r0, t)).toBe('連不上伺服器，請檢查網路後再試一次。');
    expect(errorMessage({ status: 401, data: {} }, t)).toBe('登入已逾時，請重新登入。');
    expect(errorMessage({ status: 422, data: { message: '名稱必填' } }, t)).toBe('名稱必填');
  });
});

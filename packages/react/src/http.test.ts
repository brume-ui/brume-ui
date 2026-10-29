import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorMessage, failureMessage, fetchJson, isSafeHref } from './http';
import { createTranslator } from './i18n';

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

function sentHeaders(fetchMock: ReturnType<typeof stubFetch>): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return init.headers as Record<string, string>;
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

  it('sends PUT with a JSON body', async () => {
    const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));
    await fetchJson({ method: 'put', url: '/x/1', body: { a: 1 } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"a":1}');
  });

  it('custom headers are sent but cannot replace the CSRF header', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: tests seed the XSRF cookie directly
    document.cookie = 'XSRF-TOKEN=real';
    const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));
    await fetchJson({
      method: 'get',
      url: '/x',
      headers: {
        'X-Brume-Form': '1',
        'x-xsrf-token': 'forged',
        'X-XSRF-TOKEN': 'forged',
        accept: 'text/html',
        'X-Requested-With': 'evil',
      },
    });
    const headers = sentHeaders(fetchMock);
    expect(headers).toEqual({
      'X-Brume-Form': '1',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': 'real',
    });
  });

  it('does not let a custom CSRF header through when there is no cookie', async () => {
    const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));
    await fetchJson({ method: 'get', url: '/x', headers: { 'X-XSRF-TOKEN': 'forged' } });
    const headers = sentHeaders(fetchMock);
    expect(headers['X-XSRF-TOKEN']).toBeUndefined();
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

  it('sends a FormData body as multipart and passes the abort signal', async () => {
    const fetchMock = stubFetch(async () => new Response('{}'));
    const body = new FormData();
    body.append('field', 'avatar');
    const controller = new AbortController();
    await fetchJson({ method: 'post', url: '/u', body, signal: controller.signal });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(body);
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.signal).toBe(controller.signal);
  });
});

describe('failureMessage', () => {
  const t = createTranslator('zh-TW');
  it('wraps a server message, and says network/expired/signed-out errors as they are', () => {
    expect(failureMessage({ status: 500, data: { message: '庫存不足' } }, t)).toBe(
      '操作沒有完成：庫存不足',
    );
    expect(failureMessage({ status: 0, data: {} }, t)).toBe('連不上伺服器，請檢查網路後再試一次。');
  });
});

describe('isSafeHref', () => {
  it.each([
    ['/admin/orders/1', true],
    ['orders?x=1', true],
    ['https://cdn.example.com/a.xlsx', true],
    ['HTTP://example.com', true],
    ['javascript:alert(1)', false],
    [' java\tscript:alert(1)', false],
    ['data:text/html,x', false],
    ['vbscript:x', false],
  ])('%s → %s', (url, safe) => {
    expect(isSafeHref(url)).toBe(safe);
  });
});

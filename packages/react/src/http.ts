import type { ErrorResponse } from '@brume-ui/brume-schema';
import type { Translate } from './i18n';

export interface HttpRequest {
  method: 'get' | 'post' | 'patch' | 'delete';
  url: string;
  /** Sent as JSON; a `FormData` body (an upload) is sent as multipart instead. */
  body?: unknown;
  query?: Record<string, string | string[]>;
  /** Aborts the request (e.g. a stale search); an aborted request resolves with status 0. */
  signal?: AbortSignal;
}

/** status 0 = 網路錯誤，此時 data = { message }。 */
export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
}

function readXsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const entry = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='));
  if (!entry) return undefined;
  const raw = entry.slice('XSRF-TOKEN='.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function buildUrl(url: string, query?: HttpRequest['query']): string {
  if (!query) return url;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value)
        parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  if (parts.length === 0) return url;
  return url + (url.includes('?') ? '&' : '?') + parts.join('&');
}

/** 帶 CSRF 的 JSON 請求。不論狀態碼都 resolve；網路錯誤回 status 0。 */
export async function fetchJson<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const token = readXsrfToken();
  if (token) headers['X-XSRF-TOKEN'] = token;
  const init: RequestInit = {
    method: req.method.toUpperCase(),
    credentials: 'same-origin',
    headers,
  };
  if (req.signal) init.signal = req.signal;
  if (req.method !== 'get' && req.body !== undefined) {
    if (typeof FormData !== 'undefined' && req.body instanceof FormData) {
      // The browser sets the multipart Content-Type with its boundary.
      init.body = req.body;
    } else {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(req.body);
    }
  }
  try {
    const res = await fetch(buildUrl(req.url, req.query), init);
    const text = await res.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }
    return { status: res.status, data: data as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 0, data: { message } as T };
  }
}

/**
 * The toast for a failed request (an action, a cell save or a form submit). Network, expired and
 * signed-out errors say it all; anything else is 「操作沒有完成：{message}」, or the generic copy
 * without one.
 */
export function failureMessage(res: HttpResponse, t: Translate): string {
  const message = errorMessage(res, t);
  if (res.status === 0 || res.status === 401 || res.status === 419) return message;
  return message ? t('action.failed', { message }) : t('action.failedUnknown');
}

/** Whether `url` is safe to put in a DOM `href` by hand: relative, `http:` or `https:` only. */
export function isSafeHref(url: string): boolean {
  // Browsers ignore control characters and spaces in a scheme (「java\tscript:」), so drop them first.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point.
  const compact = url.replace(/[\u0000-\u0020]/g, '');
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(compact);
  if (!scheme) return true;
  const name = (scheme[1] as string).toLowerCase();
  return name === 'http' || name === 'https';
}

export function errorMessage(res: HttpResponse, t: Translate): string {
  if (res.status === 0) return t('http.networkError');
  if (res.status === 419) return t('http.expired');
  if (res.status === 401) return t('http.unauthorized');
  const message = (res.data as Partial<ErrorResponse> | null | undefined)?.message;
  return typeof message === 'string' ? message : '';
}

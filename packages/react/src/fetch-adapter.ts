import type { BrumeAdapter, NavigationTarget, VisitOptions } from './adapter';
import { fetchJson, type HttpRequest, type HttpResponse, isSafeHref } from './http';

/** Why the page should be (re)loaded: a `visit`, a `reload`, or the browser's back/forward. */
export interface PageChange {
  kind: 'visit' | 'reload' | 'pop';
  /** The url the page should now show (path, query and hash). */
  url: string;
  /** The visit's options (`preserveState`, `preserveScroll`, `only`…); empty for back/forward. */
  options: VisitOptions;
}

export interface FetchAdapterOptions {
  /** Sends every protocol request (options, uploads, saves, actions). Defaults to `fetchJson`. */
  request?(req: HttpRequest): Promise<HttpResponse>;
  /**
   * Changes the browser url, e.g. React Router's `navigate`. Defaults to `history.pushState` (or
   * `replaceState` for `replace: true`). Called before the adapter's listeners hear the change.
   */
  navigate?(url: string, options: { replace: boolean }): void;
  /** The current url (path, query and hash). Defaults to `window.location`. */
  currentUrl?(): string;
}

/** A `BrumeAdapter` for any backend, plus `subscribe` so a page loader hears every page change. */
export interface FetchAdapter extends BrumeAdapter {
  /** Listens for page changes; returns the unsubscribe function. */
  subscribe(listener: (change: PageChange) => void): () => void;
}

type ValidationErrors = Record<string, string | string[] | undefined>;

function flattenErrors(errors: ValidationErrors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    const message = Array.isArray(value) ? value[0] : value;
    if (typeof message === 'string') out[key] = message;
  }
  return out;
}

const windowUrl = () => window.location.pathname + window.location.search + window.location.hash;
const pathAndQuery = (url: string) => url.split('#')[0];

function historyNavigate(url: string, { replace }: { replace: boolean }) {
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

/** Reads `feedback.redirect` (or a bare `redirect`) from a successful `submit` response. */
function redirectOf(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as { redirect?: unknown; feedback?: { redirect?: unknown } };
  const redirect = record.feedback?.redirect ?? record.redirect;
  return typeof redirect === 'string' ? redirect : undefined;
}

/**
 * A `BrumeAdapter` that talks to any backend over `fetch`, for apps without Inertia. It keeps the
 * same navigation rules as the Inertia adapter (a visit that stays on the current page, a partial
 * reload and a reload are never guarded) and leaves loading the page to whoever `subscribe`s,
 * usually `<BrumeRemotePage>` from `@brume-ui/brume-renderer`.
 *
 * Back/forward cannot be cancelled by the browser, so a dirty form's guard is not asked for it.
 */
export function createFetchAdapter(opts: FetchAdapterOptions = {}): FetchAdapter {
  const send = opts.request ?? fetchJson;
  const navigate = opts.navigate ?? historyNavigate;
  const currentUrl = opts.currentUrl ?? windowUrl;
  const guards: Array<{ allow: (target: NavigationTarget) => boolean }> = [];
  const listeners = new Set<(change: PageChange) => void>();
  const notify = (change: PageChange) => {
    for (const listener of [...listeners]) listener(change);
  };
  const onPopState = () => notify({ kind: 'pop', url: currentUrl(), options: {} });

  const adapter: FetchAdapter = {
    visit(url, options = {}) {
      const samePage =
        Boolean(options.only?.length) || pathAndQuery(url) === pathAndQuery(currentUrl());
      if (!samePage) {
        for (const guard of [...guards]) if (!guard.allow({ url })) return;
      }
      navigate(url, { replace: options.replace ?? false });
      notify({ kind: 'visit', url, options });
    },
    reload(options = {}) {
      notify({
        kind: 'reload',
        url: currentUrl(),
        options: { ...options, preserveState: true, preserveScroll: true },
      });
    },
    submit(method, url, data, options = {}) {
      void send({ method, url, body: data })
        .then((res) => {
          if (res.status === 422) {
            const errors = (res.data as { errors?: ValidationErrors } | null)?.errors ?? {};
            options.onError?.(flattenErrors(errors));
            return;
          }
          if (res.status < 200 || res.status >= 300) return;
          options.onSuccess?.();
          const redirect = redirectOf(res.data);
          if (redirect && isSafeHref(redirect)) adapter.visit(redirect);
        })
        .finally(() => options.onFinish?.());
    },
    currentUrl,
    guardNavigation(allow) {
      const guard = { allow };
      guards.push(guard);
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (allow({ unload: true })) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => {
        const index = guards.indexOf(guard);
        if (index >= 0) guards.splice(index, 1);
        window.removeEventListener('beforeunload', onBeforeUnload);
      };
    },
    request: <T>(req: HttpRequest) => send(req) as Promise<HttpResponse<T>>,
    subscribe(listener) {
      if (listeners.size === 0) window.addEventListener('popstate', onPopState);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('popstate', onPopState);
      };
    },
  };
  return adapter;
}

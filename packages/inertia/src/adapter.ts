import { type BrumeAdapter, fetchJson } from '@brume-ui/brume-react';
import { router } from '@inertiajs/react';

type InertiaErrors = Record<string, string | string[] | undefined>;

function flattenErrors(errors: InertiaErrors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    const message = Array.isArray(value) ? value[0] : value;
    if (message !== undefined) out[key] = message;
  }
  return out;
}

const currentUrl = () => window.location.pathname + window.location.search + window.location.hash;

/** BrumeAdapter backed by the Inertia router. Stateless, so one instance can be shared. */
export function createInertiaAdapter(): BrumeAdapter {
  return {
    visit: (url, options = {}) => router.visit(url, { ...options }),
    reload: (options = {}) => router.reload({ ...options }),
    submit: (method, url, data, options = {}) =>
      router.visit(url, {
        method,
        data: data as Record<string, never>,
        preserveScroll: options.preserveScroll,
        onSuccess: () => options.onSuccess?.(),
        onError: (errors) => options.onError?.(flattenErrors(errors as InertiaErrors)),
        onFinish: () => options.onFinish?.(),
      }),
    guardNavigation(allow) {
      // Only GET visits are checked, so the form's own POST/PUT saves pass through.
      const offBefore = router.on('before', (event) => {
        const { method, url, only, prefetch } = event.detail.visit;
        // Only a real page change is guarded: not a POST/PUT, a prefetch, a partial reload, or a
        // GET to the current page (`router.reload()`, a hash-only change).
        if (method !== 'get' || prefetch || only.length > 0) return;
        if (url.pathname + url.search === window.location.pathname + window.location.search) return;
        if (!allow({ url: url.pathname + url.search + url.hash })) event.preventDefault();
      });
      // Closing or reloading the tab has no target url, so it is its own kind of target.
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (allow({ unload: true })) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => {
        offBefore();
        window.removeEventListener('beforeunload', onBeforeUnload);
      };
    },
    request: (req) => fetchJson(req),
    currentUrl,
  };
}

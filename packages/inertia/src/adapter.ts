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
        const { method, url } = event.detail.visit;
        if (method !== 'get') return;
        if (!allow(url.pathname + url.search + url.hash)) event.preventDefault();
      });
      // Closing or reloading the tab has no target url, so ask about the current one.
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (allow(currentUrl())) return;
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

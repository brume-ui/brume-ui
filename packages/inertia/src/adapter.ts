import type { BrumeAdapter } from '@brume-ui/brume-react';
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
    currentUrl: () => window.location.pathname + window.location.search + window.location.hash,
  };
}

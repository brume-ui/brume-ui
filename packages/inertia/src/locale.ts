import type { Locale } from '@brume-ui/brume-schema';
import { router } from '@inertiajs/react';

export const LOCALE_COOKIE = 'brume_locale';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Persists the chosen locale for the server to read, then reloads the current page. */
export function changeLocale(locale: Locale): void {
  // biome-ignore lint/suspicious/noDocumentCookie: a plain cookie the server reads on the next request
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  router.reload();
}

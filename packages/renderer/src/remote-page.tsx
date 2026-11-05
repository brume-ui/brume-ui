import {
  Alert,
  errorMessage,
  type FetchAdapter,
  type PageChange,
  useBrume,
} from '@brume-ui/brume-react';
import { type PageEnvelope, validateEnvelope } from '@brume-ui/brume-schema';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BrumePageView } from './render-page';

export interface BrumeRemotePageProps {
  /**
   * The url that returns the page's `PageEnvelope` JSON for a browser url. Defaults to the same
   * url (the request sends `Accept: application/json`), e.g. `(url) => '/api' + url` for an API
   * mounted elsewhere.
   */
  pageUrl?(url: string): string;
  /** Shown until the first page arrives. Defaults to nothing. */
  loading?: ReactNode;
  /** Called with every page shown, e.g. to set `document.title`. */
  onPage?(envelope: PageEnvelope): void;
}

type Shown =
  | { kind: 'loading' }
  | { kind: 'page'; envelope: PageEnvelope; generation: number }
  | { kind: 'failed'; message: string };

function isFetchAdapter(adapter: unknown): adapter is FetchAdapter {
  return typeof (adapter as Partial<FetchAdapter>).subscribe === 'function';
}

/**
 * Loads and shows the Brume page for the current url, without Inertia: it fetches the page's
 * envelope on mount and again on every visit, reload and back/forward of the `createFetchAdapter`
 * in `<BrumeProvider>`. Like an Inertia visit, the previous page stays until the next one arrives,
 * a visit without `preserveState` starts the page fresh, and one without `preserveScroll` scrolls
 * to the top. A response that is not a valid envelope (any status) is shown as an error; an
 * error page envelope (404, 403…) is shown as the page.
 */
export function BrumeRemotePage({ pageUrl, loading = null, onPage }: BrumeRemotePageProps) {
  const { adapter, t } = useBrume();
  if (!isFetchAdapter(adapter)) {
    throw new Error(
      'BrumeRemotePage needs the adapter from createFetchAdapter in <BrumeProvider>.',
    );
  }
  const [shown, setShown] = useState<Shown>({ kind: 'loading' });
  const latest = useRef({ pageUrl, onPage, t });
  latest.current = { pageUrl, onPage, t };

  useEffect(() => {
    let controller: AbortController | null = null;
    let generation = 0;
    async function load(change: PageChange) {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const { pageUrl: toPageUrl, t: translate } = latest.current;
      const url = toPageUrl ? toPageUrl(change.url) : change.url;
      const res = await adapter.request<unknown>({ method: 'get', url, signal: current.signal });
      if (current.signal.aborted) return;
      if (validateEnvelope(res.data).ok) {
        const envelope = res.data as PageEnvelope;
        if (!change.options.preserveState) generation += 1;
        setShown({ kind: 'page', envelope, generation });
        if (change.kind === 'visit' && !change.options.preserveScroll) window.scrollTo(0, 0);
        latest.current.onPage?.(envelope);
        return;
      }
      const message = res.status >= 200 && res.status < 300 ? '' : errorMessage(res, translate);
      setShown({ kind: 'failed', message: message || translate('renderer.load.invalid') });
    }
    const unsubscribe = adapter.subscribe((change) => void load(change));
    void load({ kind: 'visit', url: adapter.currentUrl(), options: { preserveScroll: true } });
    return () => {
      unsubscribe();
      controller?.abort();
    };
  }, [adapter]);

  if (shown.kind === 'loading') return <>{loading}</>;
  if (shown.kind === 'failed') {
    return (
      <Alert tone="danger" title={t('renderer.version.title')}>
        <p>{shown.message}</p>
      </Alert>
    );
  }
  return <BrumePageView key={shown.generation} envelope={shown.envelope} />;
}

import { failureMessage, isSafeHref, useBrume } from '@brume-ui/brume-react';
import {
  FORM_HEADER,
  type FormPage,
  type PageEnvelope,
  SCHEMA_VERSION,
} from '@brume-ui/brume-schema';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Last request wins, including clear/unmount. Adapters need not support abort to be safe. */
export function useFormLoader() {
  const { adapter, t } = useBrume();
  const [page, setPage] = useState<FormPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      active.current?.abort();
    },
    [],
  );
  const clear = useCallback(() => {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setPage(null);
    setError(null);
  }, []);
  const load = useCallback(
    async (url: string) => {
      const ticket = ++generation.current;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setPage(null);
      setError(null);
      try {
        if (!isSafeHref(url)) throw new Error('unsafe');
        const res = await adapter.request<PageEnvelope>({
          method: 'get',
          signal: controller.signal,
          url,
          headers: { [FORM_HEADER]: '1' },
        });
        if (ticket !== generation.current) return;
        if (res.status < 200 || res.status >= 300) {
          setError(failureMessage(res, t));
          return;
        }
        const data = res.data;
        if (
          !data ||
          typeof data.schemaVersion !== 'string' ||
          data.schemaVersion.split('.')[0] !== SCHEMA_VERSION.split('.')[0] ||
          data.page?.type !== 'form'
        ) {
          setError(t('http.networkError'));
          return;
        }
        setPage(data.page);
      } catch {
        if (ticket === generation.current) setError(t('http.networkError'));
      }
    },
    [adapter, t],
  );
  return { page, error, load, clear };
}

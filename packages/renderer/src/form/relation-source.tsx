import { RelationPicker, type RelationPickerProps, useBrume } from '@brume-ui/brume-react';
import type { OptionItem, PickerSearchResponse } from '@brume-ui/brume-schema';
import { useEffect, useRef, useState } from 'react';
import type { RemoteOptionsSource } from './use-remote-options';

type Props = Pick<
  RelationPickerProps,
  | 'value'
  | 'onChange'
  | 'multiple'
  | 'label'
  | 'disabled'
  | 'renderSelection'
  | 'commitDisabled'
  | 'onOpenChange'
> & {
  source: RemoteOptionsSource;
  blockedValues?: ReadonlySet<string>;
  authorityPending?: boolean;
  onHydratedAuthority?(items: PickerSearchResponse['data']): void;
};

/** A scope replacement closes the draft; ordinary search/page/section requests preserve it. */
export function RemoteRelationPicker(props: Props) {
  const [scope, setScope] = useState({ key: props.source.scopeKey, version: 0 });
  if (scope.key !== props.source.scopeKey)
    setScope({ key: props.source.scopeKey, version: scope.version + 1 });
  return <SourcePicker key={scope.version} {...props} />;
}
function SourcePicker({
  source,
  blockedValues,
  authorityPending = false,
  onHydratedAuthority,
  ...props
}: Props) {
  const { t } = useBrume();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [section, setSection] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<PickerSearchResponse>({
    data: [],
    pagination: { page: 1, perPage: 20, hasMore: false },
  });
  const [labelFailure, setLabelFailure] = useState(false);
  const [labelRetry, setLabelRetry] = useState(0);
  const authorityRef = useRef({ pending: authorityPending, accept: onHydratedAuthority });
  authorityRef.current = { pending: authorityPending, accept: onHydratedAuthority };
  const [labels, setLabels] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const selectedKey = JSON.stringify(props.value.map((item) => item.id));
  const request = source.request;
  const resolveLabels = source.resolveLabels;
  const cancel = source.cancel;
  const latestIds = useRef(selectedKey);
  latestIds.current = selectedKey;
  // biome-ignore lint/correctness/useExhaustiveDependencies: labelRetry explicitly retries the same selected IDs.
  useEffect(() => {
    let alive = true;
    const ids: string[] = JSON.parse(selectedKey);
    setLabels([]);
    setLabelFailure(false);
    if (ids.length && source.enabled)
      void resolveLabels(ids)
        .then((options) => {
          if (!alive || latestIds.current !== selectedKey) return;
          const hydrated: PickerSearchResponse['data'] = options;
          if (
            authorityRef.current.pending &&
            ids.some((id) => !hydrated.find((item) => item.value === id)?.authority)
          )
            throw new Error('Missing declared picker authority');
          authorityRef.current.accept?.(options);
          setLabels(options);
        })
        .catch(() => {
          if (alive) setLabelFailure(true);
        });
    return () => {
      alive = false;
      cancel('labels');
    };
  }, [selectedKey, resolveLabels, cancel, source.enabled, labelRetry]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly restarts the same query.
  useEffect(() => {
    if (!open || !source.enabled) return;
    let alive = true;
    setLoading(true);
    setError(undefined);
    void request<PickerSearchResponse>({ q: query, page, perPage: 20, section })
      .then((next) => {
        if (alive) setResponse(next);
      })
      .catch(() => {
        if (alive) setError(t('combobox.loadFailed'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      cancel('search');
    };
  }, [open, request, cancel, query, page, section, retry, source.enabled, t]);
  return (
    <>
      {authorityPending ? (
        <p role="status">{labelFailure ? t('combobox.loadFailed') : t('common.loading')}</p>
      ) : null}
      {authorityPending && labelFailure ? (
        <button type="button" onClick={() => setLabelRetry((value) => value + 1)}>
          {t('combobox.retry')}
        </button>
      ) : null}
      <RelationPicker
        {...props}
        items={response.data.map((item) => ({
          ...item,
          disabled: item.disabled || blockedValues?.has(item.value),
        }))}
        pagination={response.pagination}
        columns={response.columns}
        sections={response.sections}
        selectedOptions={labels}
        loading={loading}
        error={error}
        query={query}
        section={section}
        disabled={props.disabled || !source.enabled}
        onQueryChange={(next) => {
          setQuery(next);
          setPage(1);
        }}
        onPageChange={setPage}
        onSectionChange={(next) => {
          setSection(next);
          setPage(1);
        }}
        onRetry={() => setRetry((version) => version + 1)}
        onOpenChange={(next) => {
          setOpen(next);
          props.onOpenChange?.(next);
        }}
      />
    </>
  );
}

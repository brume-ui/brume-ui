import { Field, useBrume } from '@brume-ui/brume-react';
import type {
  PickerAuthority,
  PickerSearchResponse,
  RelationFieldDef,
  RelationItem,
} from '@brume-ui/brume-schema';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { resolveConditionPath } from '../conditions';
import type { FieldProps } from '../contract';
import { excludedChoiceValues } from '../exclusions';
import { FieldIdPrefixContext, FieldRevealContext } from '../field-navigation';
import { Nodes } from '../layout/nodes';
import { RemoteRelationPicker } from '../relation-source';
import { useRelationDraft } from '../use-relation-draft';
import { useRemoteOptions } from '../use-remote-options';

export function RelationField(props: FieldProps<unknown, RelationFieldDef>) {
  const { t } = useBrume();
  const root = useRef<HTMLFieldSetElement>(null);
  const navigation = useContext(FieldRevealContext);
  useLayoutEffect(
    () =>
      navigation?.register(props.path, () => {
        const trigger = root.current?.querySelector<HTMLButtonElement>('button[aria-expanded]');
        if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click();
      }),
    [navigation, props.path],
  );
  const [authorityPending, setAuthorityPending] = useState(new Set<symbol>());
  const snapshots = useRef(new Map<string, PickerAuthority>());
  const [pending, setPending] = useState(new Map<symbol, number>());
  const onPending = useCallback(
    (id: symbol, count: number) =>
      setPending((previous) => {
        if ((previous.get(id) ?? 0) === count) return previous;
        const next = new Map(previous);
        if (count) next.set(id, count);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const source = useRemoteOptions({
    remote: props.def.remote,
    form: props.form,
    path: props.path,
    rowContext: props.rowContext,
  });
  const value: RelationItem[] = Array.isArray(props.value)
    ? props.value
    : props.value && typeof props.value === 'object'
      ? [props.value as RelationItem]
      : [];
  const excluded = excludedChoiceValues(props.form.fields, props.form.values, props.path);
  const blocked = new Set([...excluded].filter((id) => !value.some((item) => item.id === id)));
  return (
    <Field
      label={props.def.label}
      group
      description={props.def.help}
      error={props.errors['']?.[0]}
      required={props.def.required}
    >
      <fieldset ref={root} id={props.id} className="br:min-w-0">
        <RemoteRelationPicker
          label={props.def.label}
          value={value}
          multiple={props.def.multiple}
          source={source}
          blockedValues={blocked}
          authorityPending={
            props.def.hydrateAuthority === true &&
            props.form.fields.some(
              (field) =>
                field.path.startsWith(`${props.path}.`) && !props.form.getAuthority(field).known,
            )
          }
          onHydratedAuthority={(items) => {
            const container = props.form.getField(props.path);
            if (!container || props.def.hydrateAuthority !== true) return;
            for (const item of items) {
              if (item.authority && value.some((selected) => selected.id === item.value)) {
                const row = [
                  ...container.rowContext,
                  { path: container.templatePath, key: item.value, id: item.value },
                ];
                const unknown = props.form.fields.some(
                  (field) =>
                    field.path.startsWith(`${props.path}.`) &&
                    field.rowContext.some(
                      (owner) => owner.path === container.templatePath && owner.id === item.value,
                    ) &&
                    !props.form.getAuthority(field).known,
                );
                if (unknown) props.form.setRowAuthority(row, item.authority);
              }
            }
          }}
          disabled={props.disabled || props.readOnly}
          commitDisabled={pending.size > 0 || authorityPending.size > 0}
          onChange={(next) => {
            props.onChange(props.def.multiple ? next : (next[0] ?? null));
            const container = props.form.getField(props.path);
            if (container)
              for (const item of next) {
                const snapshot = snapshots.current.get(item.id);
                if (snapshot)
                  props.form.setRowAuthority(
                    [
                      ...container.rowContext,
                      { path: container.templatePath, key: item.id, id: item.id },
                    ],
                    snapshot,
                    Object.values(props.def.remote.dependsOn ?? {}).map((dependency) =>
                      resolveConditionPath(dependency, container.rowPath),
                    ),
                  );
              }
            props.onBlur();
          }}
          renderSelection={(item, index, onChange, _draft, getDraft, getDraftIdentity) => (
            <SelectionFields
              key={item.id}
              {...props}
              item={item}
              index={index}
              getDraft={getDraft}
              getDraftIdentity={getDraftIdentity}
              update={onChange}
              onPending={onPending}
              onAuthority={(id, snapshot) => {
                if (snapshot) snapshots.current.set(id, snapshot);
                else snapshots.current.delete(id);
              }}
              onAuthorityPending={(id, loading) =>
                setAuthorityPending((previous) => {
                  if (previous.has(id) === loading) return previous;
                  const next = new Set(previous);
                  if (loading) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
            />
          )}
        />
        {authorityPending.size ? <p role="status">{t('common.loading')}</p> : null}
        {pending.size ? <p role="status">{t('form.pendingUploads')}</p> : null}
      </fieldset>
    </Field>
  );
}
function SelectionFields(
  props: FieldProps<unknown, RelationFieldDef> & {
    item: RelationItem;
    index: number;
    getDraft(): readonly RelationItem[];
    getDraftIdentity?(id: string): number | undefined;
    update(next: RelationItem): void;
    onPending(id: symbol, count: number): void;
    onAuthority(id: string, snapshot: PickerAuthority | undefined): void;
    onAuthorityPending(id: symbol, pending: boolean): void;
  },
) {
  const idPrefix = useContext(FieldIdPrefixContext) ?? props.id;
  const prefix = props.def.multiple ? `${props.path}.${props.index}` : props.path;
  const { t } = useBrume();
  const source = useRemoteOptions({
    remote: props.def.remote,
    form: props.form,
    path: props.path,
    rowContext: props.rowContext,
  });
  const [resolved, setResolved] = useState<{ scope: object; snapshot: PickerAuthority }>();
  const [failure, setFailure] = useState(false);
  const [retry, setRetry] = useState(0);
  const container = props.form.getField(props.path);
  const authorityRow = [
    ...(container?.rowContext ?? []),
    { path: container?.templatePath ?? props.path, key: props.item.id, id: props.item.id },
  ];
  const authority = resolved?.scope === source.scopeKey ? resolved.snapshot : undefined;
  const api = useRelationDraft({
    parent: props.form,
    path: props.path,
    prefix,
    multiple: props.def.multiple,
    item: props.item,
    getDraft: props.getDraft,
    getDraftIdentity: props.getDraftIdentity,
    onChange: props.update,
    onPending: props.onPending,
    authority,
    authorityRow,
  });
  const needsAuthority =
    props.def.hydrateAuthority === true &&
    api.fields.some(
      (field) => field.path.startsWith(`${prefix}.`) && !props.form.getAuthority(field).known,
    );
  const pending = needsAuthority && !authority;
  const token = useRef(Symbol('picker-authority'));
  const latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    latest.current.onAuthorityPending(token.current, pending);
    return () => latest.current.onAuthorityPending(token.current, false);
  }, [pending]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly restarts the same declared hydration.
  useEffect(() => {
    if (!needsAuthority || authority) return;
    let alive = true;
    const identity = props.getDraftIdentity?.(props.item.id);
    setFailure(false);
    latest.current.onAuthority(props.item.id, undefined);
    void source
      .request<PickerSearchResponse>({ values: [props.item.id] })
      .then((response) => {
        const snapshot = response.data.find((item) => item.value === props.item.id)?.authority;
        if (!snapshot) throw new Error('Missing declared picker authority');
        if (
          !alive ||
          !latest.current.getDraft().some((item) => item.id === props.item.id) ||
          latest.current.getDraftIdentity?.(props.item.id) !== identity
        )
          return;
        setResolved({ scope: source.scopeKey, snapshot });
        latest.current.onAuthority(props.item.id, snapshot);
      })
      .catch(() => {
        if (alive) setFailure(true);
      });
    return () => {
      alive = false;
      source.cancel('labels');
    };
  }, [
    needsAuthority,
    authority,
    source.request,
    source.cancel,
    source.scopeKey,
    props.item.id,
    props.getDraftIdentity,
    retry,
  ]);
  return (
    <>
      {pending ? (
        <p role="status">{failure ? t('combobox.loadFailed') : t('common.loading')}</p>
      ) : null}
      {pending && failure ? (
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          {t('combobox.retry')}
        </button>
      ) : null}
      <Nodes
        nodes={props.def.fields ?? []}
        api={api}
        idPrefix={idPrefix}
        prefix={prefix}
        layout="stacked"
        uploadUrl={props.uploadUrl}
      />
    </>
  );
}

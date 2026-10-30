import { Field, useBrume } from '@brume-ui/brume-react';
import type { RelationFieldDef, RelationItem } from '@brume-ui/brume-schema';
import { useCallback, useState } from 'react';
import type { FieldProps } from '../contract';
import { excludedChoiceValues } from '../exclusions';
import { Nodes } from '../layout/nodes';
import { RemoteRelationPicker } from '../relation-source';
import { useRelationDraft } from '../use-relation-draft';
import { useRemoteOptions } from '../use-remote-options';

export function RelationField(props: FieldProps<unknown, RelationFieldDef>) {
  const { t } = useBrume();
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
      <fieldset className="br:min-w-0">
        <RemoteRelationPicker
          label={props.def.label}
          value={value}
          multiple={props.def.multiple}
          source={source}
          blockedValues={blocked}
          disabled={props.disabled || props.readOnly}
          commitDisabled={pending.size > 0}
          onChange={(next) => {
            props.onChange(props.def.multiple ? next : (next[0] ?? null));
            props.onBlur();
          }}
          renderSelection={(item, index, onChange, _draft, getDraft) => (
            <SelectionFields
              key={item.id}
              {...props}
              item={item}
              index={index}
              getDraft={getDraft}
              update={onChange}
              onPending={onPending}
            />
          )}
        />
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
    update(next: RelationItem): void;
    onPending(id: symbol, count: number): void;
  },
) {
  const prefix = props.def.multiple ? `${props.path}.${props.index}` : props.path;
  const api = useRelationDraft({
    parent: props.form,
    path: props.path,
    prefix,
    multiple: props.def.multiple,
    item: props.item,
    getDraft: props.getDraft,
    onChange: props.update,
    onPending: props.onPending,
  });
  return (
    <Nodes
      nodes={props.def.fields ?? []}
      api={api}
      idPrefix={props.id}
      prefix={prefix}
      layout="stacked"
      uploadUrl={props.uploadUrl}
    />
  );
}

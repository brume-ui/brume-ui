import {
  CheckboxTree,
  Field,
  KeyValueInput,
  type KeyValuePair,
  ListInput,
} from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';
import { KEY_VALUE_MAX_PAIRS, LIST_MAX_ITEMS, type StructuralDef, trimText } from '../structural';
import { ReadOnlyField } from './misc';

const isPair = (row: unknown): row is KeyValuePair =>
  row !== null &&
  typeof row === 'object' &&
  typeof (row as KeyValuePair).key === 'string' &&
  typeof (row as KeyValuePair).value === 'string';

/** Errors arrive in the submitted (post-drop) index space; these are the visible rows that survive. */
function keptRows(def: StructuralDef, rows: readonly unknown[]): number[] {
  return rows.flatMap((row, index) => {
    if (def.type === 'keyValue')
      return isPair(row) && !(trimText(row.key) === '' && row.value === '') ? [index] : [];
    return typeof row === 'string' && trimText(row) !== '' ? [index] : [];
  });
}

/** `0.key` / `3` style relative error paths to the visible row they belong to. */
function rowErrors(def: StructuralDef, rows: readonly unknown[], errors: FieldProps['errors']) {
  const kept = keptRows(def, rows);
  const byRow: Record<number, { key?: string; value?: string }> = {};
  const byItem: Record<number, string> = {};
  const stray: string[] = [];
  for (const [path, messages] of Object.entries(errors)) {
    if (path === '' || !messages[0]) continue;
    const [index, cell, ...rest] = path.split('.');
    const row = /^(0|[1-9]\d*)$/.test(index ?? '') ? kept[Number(index)] : undefined;
    if (row === undefined || rest.length > 0) stray.push(messages[0]);
    else if (def.type === 'list' && cell === undefined) byItem[row] = messages[0];
    else if (def.type === 'keyValue' && (cell === 'key' || cell === 'value'))
      byRow[row] = { ...byRow[row], [cell]: messages[0] };
    else stray.push(messages[0]);
  }
  return { byRow, byItem, stray };
}

export function KeyValueField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  if (def.type !== 'keyValue') return null;
  const rows = Array.isArray(value) ? value.filter(isPair) : [];
  if (props.readOnly)
    return (
      <ReadOnlyField {...props} value={rows.map((row) => `${row.key}: ${row.value}`).join('、')} />
    );
  const { byRow, stray } = rowErrors(def, rows, errors);
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0] ?? stray[0]}
      required={def.required}
      group
    >
      <KeyValueInput
        id={id}
        label={def.label}
        keyLabel={def.keyLabel}
        valueLabel={def.valueLabel}
        value={rows}
        max={Math.min(def.max ?? KEY_VALUE_MAX_PAIRS, KEY_VALUE_MAX_PAIRS)}
        errors={byRow}
        disabled={disabled}
        // Row errors mark their own cell; only a field-level error marks the whole control.
        invalid={invalid && Object.keys(byRow).length === 0}
        onBlur={onBlur}
        aria-describedby={describedBy}
        onChange={onChange}
      />
    </Field>
  );
}

export function ListField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  if (def.type !== 'list') return null;
  const items = Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  if (props.readOnly) return <ReadOnlyField {...props} value={items.join('、')} />;
  const { byItem, stray } = rowErrors(def, items, errors);
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0] ?? stray[0]}
      required={def.required}
      group
    >
      <ListInput
        id={id}
        label={def.label}
        value={items}
        min={def.min}
        max={Math.min(def.max ?? LIST_MAX_ITEMS, LIST_MAX_ITEMS)}
        maxLength={def.maxLength}
        sortable={def.sortable === true}
        errors={byItem}
        disabled={disabled}
        invalid={invalid && Object.keys(byItem).length === 0}
        onBlur={onBlur}
        aria-describedby={describedBy}
        onChange={onChange}
      />
    </Field>
  );
}

export function TreeField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  if (def.type !== 'tree') return null;
  const ids = Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  if (props.readOnly)
    return (
      <ReadOnlyField
        {...props}
        value={ids
          .map((v) => def.options.find((option) => option.value === v)?.label ?? v)
          .join('、')}
      />
    );
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0]}
      required={def.required}
      group
    >
      <CheckboxTree
        id={id}
        label={def.label}
        mode={def.mode}
        options={def.options}
        defaultExpanded={def.expanded}
        value={ids}
        disabled={disabled}
        invalid={invalid}
        onBlur={onBlur}
        aria-describedby={describedBy}
        onChange={onChange}
      />
    </Field>
  );
}

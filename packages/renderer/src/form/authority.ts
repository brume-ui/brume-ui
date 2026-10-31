import type { FieldDef, PickerAuthority, RowContext } from '@brume-ui/brume-schema';
import { getAt, setAt } from './paths';
import type { ValueField } from './traversal';

export interface AuthorityValue {
  known: boolean;
  value: unknown;
}
export interface AuthorityRow {
  row: RowContext;
  snapshot: PickerAuthority;
  lifetime?: number;
  dependencies?: string[];
}
export const rowKey = (row: RowContext) => JSON.stringify(row);

/** Resolve the server snapshot by declared row identity, never the current numeric position. */
function read(
  values: Record<string, unknown>,
  field: ValueField,
  skip = 0,
): { found: boolean; value: unknown; missing?: RowContext[number] } {
  const origin = field.rowContext[skip - 1];
  let template = field.templatePath;
  if (origin) {
    const prefix = origin.path + (template.startsWith(`${origin.path}.*.`) ? '.*' : '');
    template = template.slice(prefix.length + 1);
  }
  let value: unknown = values;
  let path = origin
    ? field.templatePath.slice(0, field.templatePath.length - template.length - 1)
    : '';
  const rows = field.rowContext.slice(skip);
  for (const part of template.split('.')) {
    if (part === '*') {
      const identity = rows.find((row) => row.path === path);
      if (!identity || !Array.isArray(value))
        return { found: false, value: undefined, missing: identity };
      value = value.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item._brume
            ? item._brume.key === identity.key && (item._brume.id ?? null) === (identity.id ?? null)
            : item.id === identity.key),
      );
      if (value === undefined) return { found: false, value, missing: identity };
    } else {
      value = getAt(value, part);
    }
    path = path ? `${path}.${part}` : part;
    const single = rows.find((row) => row.path === path);
    if (single && !Array.isArray(value) && (!value || getAt(value, 'id') !== single.key))
      return { found: false, value: undefined, missing: single };
  }
  return { found: true, value };
}

export function authoritativeValue(
  baseline: Record<string, unknown>,
  field: ValueField,
  snapshots: readonly AuthorityRow[] = [],
): AuthorityValue {
  const stored = read(baseline, field);
  if (stored.found)
    return { known: true, value: stored.value === undefined ? fallback(field.def) : stored.value };
  for (const entry of [...snapshots].sort((a, b) => b.row.length - a.row.length)) {
    if (rowKey(field.rowContext.slice(0, entry.row.length)) !== rowKey(entry.row)) continue;
    const resolved = read(entry.snapshot.values, field, entry.row.length);
    if (resolved.found) return { known: true, value: resolved.value };
    // A descendant not present in the source snapshot is a new row too.
    if (resolved.missing?.id) return { known: false, value: undefined };
  }
  // Picker IDs identify existing source storage whose declared values require a scoped read.
  if (field.authorityRequired && stored.missing?.id && !stored.missing.key.startsWith('record:'))
    return { known: false, value: undefined };
  return { known: true, value: fallback(field.def) };
}
function fallback(def: FieldDef): unknown {
  if (Object.hasOwn(def, 'defaultValue')) return def.defaultValue;
  if (def.type === 'repeater' || (def.type === 'relation' && def.multiple)) return [];
  return null;
}

/** Whole effective roots preserve inactive collection membership/order as well as scalar authority. */
export function effectiveTree(
  fields: readonly ValueField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  let tree = values;
  for (const field of fields) {
    if (
      fields.some(
        (ancestor) =>
          (ancestor.def.type === 'repeater' || ancestor.def.type === 'relation') &&
          field.path.startsWith(`${ancestor.path}.`),
      )
    )
      continue;
    tree = setAt(tree, field.path, field.effectiveValue);
  }
  return tree;
}

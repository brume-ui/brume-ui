import type { RowContext } from '@brume-ui/brume-schema';
import type { ValueField } from './traversal';
import type { FormApi } from './use-form-state';

export interface RowLifetimes {
  sequence: number;
  live: Map<string, number>;
}
const instances = new WeakMap<FormApi, RowLifetimes>();
export const createRowLifetimes = (): RowLifetimes => ({ sequence: 0, live: new Map() });
export function bindRowLifetimes(form: FormApi, rows: RowLifetimes): FormApi {
  instances.set(form, rows);
  return form;
}
/** Include declared collection rows even when the collection has no child fields. */
export function collectionRowContexts(field: ValueField, value: unknown): RowContext[] {
  if (field.def.type !== 'repeater' && field.def.type !== 'relation') return [];
  const rows = field.def.type === 'relation' && !field.def.multiple ? [value] : value;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const identity = field.def.type === 'relation' ? { key: row.id, id: row.id } : row._brume;
    if (!identity || typeof identity.key !== 'string' || !identity.key) return [];
    return [
      [
        ...field.rowContext,
        {
          path: field.templatePath,
          key: identity.key,
          ...(typeof identity.id === 'string' ? { id: identity.id } : {}),
        },
      ],
    ];
  });
}

/** Called synchronously at mutation boundaries, including intermediate removals in one event. */
export function syncRowLifetimes(
  rows: RowLifetimes,
  fields: readonly ValueField[],
  reset = false,
  valueAt?: (path: string) => unknown,
): void {
  const next = new Map<string, number>();
  const retain = (context: RowContext) => {
    for (let depth = 1; depth <= context.length; depth++) {
      const key = JSON.stringify(context.slice(0, depth));
      if (!next.has(key)) next.set(key, (!reset && rows.live.get(key)) || ++rows.sequence);
    }
  };
  for (const field of fields) {
    retain(field.rowContext);
    for (const context of collectionRowContexts(field, valueAt?.(field.path))) retain(context);
  }
  rows.live = next;
}
/** Private client lifetime; never included in wire identities and never a persistence authority. */
export function rowLifetime(form: FormApi, context: RowContext = []): number | undefined {
  if (!context.length) return 0;
  return instances.get(form)?.live.get(JSON.stringify(context));
}

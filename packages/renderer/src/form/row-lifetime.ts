import type { RowContext } from '@brume-ui/brume-schema';
import type { ValueField } from './traversal';
import type { FormApi } from './use-form-state';

export interface RowLifetimes {
  sequence: number;
  live: Map<string, number>;
  drafts: Set<DraftLifetimeGroup>;
}
interface DraftLifetimeGroup {
  key: string;
  rows: RowLifetimes;
  readers: Map<symbol, () => readonly unknown[]>;
}

type RowLifetime = number | string | undefined;
type LifetimeResolver = (context: RowContext, local: number | undefined) => RowLifetime;
const instances = new WeakMap<FormApi, { rows: RowLifetimes; resolve?: LifetimeResolver }>();
export const createRowLifetimes = (): RowLifetimes => ({
  sequence: 0,
  live: new Map(),
  drafts: new Set(),
});
export function bindRowLifetimes(
  form: FormApi,
  rows: RowLifetimes,
  resolve?: LifetimeResolver,
): FormApi {
  instances.set(form, { rows, resolve });
  return form;
}
/** One tracker for a live picker view, acquired during render before either peer's effects.
 * The primitive returns the same live array to its selected owners. Compare that view, never
 * mutable item objects or public IDs; separate picker sessions/components therefore stay isolated.
 */
export function draftRowLifetimes(
  parent: FormApi,
  key: string,
  id: symbol,
  read: () => readonly unknown[],
  fallback: RowLifetimes,
) {
  const groups = (instances.get(parent)?.rows ?? fallback).drafts;
  const view = read();
  let group = [...groups].find(
    (candidate) =>
      candidate.key === key && [...candidate.readers.values()].some((reader) => reader() === view),
  );
  if (!group) group = { key, rows: createRowLifetimes(), readers: new Map() };
  const current = group;
  const attach = () => {
    groups.add(current);
    current.readers.set(id, read);
  };
  const release = () => {
    current.readers.delete(id);
    if (!current.readers.size) groups.delete(current);
  };
  attach();
  return { group: current, rows: current.rows, attach, release };
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
  reset: boolean | ((context: RowContext) => boolean) = false,
  valueAt?: (path: string) => unknown,
): void {
  const next = new Map<string, number>();
  const retain = (context: RowContext) => {
    for (let depth = 1; depth <= context.length; depth++) {
      const key = JSON.stringify(context.slice(0, depth));
      const replace = typeof reset === 'function' ? reset(context.slice(0, depth)) : reset;
      if (!next.has(key)) next.set(key, (!replace && rows.live.get(key)) || ++rows.sequence);
    }
  };
  for (const field of fields) {
    retain(field.rowContext);
    for (const context of collectionRowContexts(field, valueAt?.(field.path))) retain(context);
  }
  rows.live = next;
}
/** Private client lifetime; never included in wire identities and never a persistence authority. */
export function rowLifetime(form: FormApi, context: RowContext = []): RowLifetime {
  if (!context.length) return 0;
  const instance = instances.get(form);
  const local = instance?.rows.live.get(JSON.stringify(context));
  return instance?.resolve ? instance.resolve(context, local) : local;
}

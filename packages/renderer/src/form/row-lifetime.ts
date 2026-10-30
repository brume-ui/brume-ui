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
/** Called synchronously at mutation boundaries, including intermediate removals in one event. */
export function syncRowLifetimes(
  rows: RowLifetimes,
  fields: readonly ValueField[],
  reset = false,
): void {
  const next = new Map<string, number>();
  for (const field of fields)
    for (let depth = 1; depth <= field.rowContext.length; depth++) {
      const key = JSON.stringify(field.rowContext.slice(0, depth));
      if (!next.has(key)) next.set(key, (!reset && rows.live.get(key)) || ++rows.sequence);
    }
  rows.live = next;
}
/** Private client lifetime; never included in wire identities and never a persistence authority. */
export function rowLifetime(form: FormApi, context: RowContext = []): number | undefined {
  if (!context.length) return 0;
  return instances.get(form)?.live.get(JSON.stringify(context));
}

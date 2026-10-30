import type { RowContext, RowIdentity } from '@brume-ui/brume-schema';

import type { FormApi } from './use-form-state';

/** Invalid server metadata is diagnosed, never repaired into a new persisted identity. */
export function repeaterIdentities(
  value: unknown,
  mode: 'json' | 'relation',
): RowIdentity[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const identities: RowIdentity[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const identity = row._brume;
    if (
      !identity ||
      typeof identity !== 'object' ||
      Array.isArray(identity) ||
      typeof identity.key !== 'string' ||
      !identity.key.trim() ||
      seen.has(identity.key) ||
      Object.keys(identity).some((key) => key !== 'key' && key !== 'id') ||
      (identity.id !== undefined &&
        (mode === 'json' || typeof identity.id !== 'string' || !identity.id.trim()))
    )
      return null;
    seen.add(identity.key);
    identities.push(identity);
  }
  return identities;
}

/** Verifies the complete client declaration chain. The server must still authorize every id. */
export function verifiedRowContext(
  form: FormApi,
  path: string,
  supplied?: RowContext,
): RowContext | undefined {
  const field = form.getField(path);
  if (!field) return supplied?.length ? undefined : [];
  const context = field.rowContext;
  if (
    supplied &&
    (supplied.length !== context.length ||
      supplied.some(
        (entry, index) =>
          entry.path !== context[index]?.path ||
          entry.key !== context[index]?.key ||
          entry.id !== context[index]?.id,
      ))
  )
    return undefined;
  const parents = form.fields.filter(
    (parent) =>
      path.startsWith(`${parent.path}.`) &&
      (parent.def.type === 'repeater' || parent.def.type === 'relation'),
  );
  if (parents.length !== context.length) return undefined;
  for (const [index, parent] of parents.entries()) {
    const entry = context[index];
    if (entry?.path !== parent.templatePath) return undefined;
    if (parent.def.type === 'repeater') {
      const rows = repeaterIdentities(form.getValue(parent.path), parent.def.mode);
      const position = Number(path.slice(parent.path.length + 1).split('.')[0]);
      const identity = rows?.[position];
      if (!identity || identity.key !== entry.key || identity.id !== entry.id) return undefined;
    }
  }
  return context;
}

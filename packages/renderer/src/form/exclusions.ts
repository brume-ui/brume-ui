import type { ExclusionPath } from '@brume-ui/brume-schema';
import { canonicalizeFieldValue } from './conditions';
import { assertSafePath, getAt, joinPath } from './paths';
import type { ValueField } from './traversal';

/** Resolve exclusions only against declared current fields, never arbitrary draft object keys. */
export function excludedChoiceValues(
  fields: readonly ValueField[],
  values: Record<string, unknown>,
  path: string,
): Set<string> {
  const field = fields.find((item) => item.path === path);
  const result = new Set<string>();
  if (!field || !('excludeSelectedIn' in field.def)) return result;
  for (const target of (field.def.excludeSelectedIn ?? []) as ExclusionPath[]) {
    assertSafePath(target.path, true);
    if (target.scope === 'row' && !field.rowPath)
      throw new Error('Row exclusion requires an explicit row path');
    const pattern = (
      target.scope === 'row' ? joinPath(field.rowPath ?? '', target.path) : target.path
    ).split('.');
    for (const sibling of fields) {
      const parts = sibling.path.split('.');
      if (
        sibling.path === path ||
        parts.length !== pattern.length ||
        !pattern.every(
          (part, i) => part === parts[i] || (part === '*' && /^\d+$/.test(parts[i] ?? '')),
        )
      )
        continue;
      const canonical = canonicalizeFieldValue(sibling.def, getAt(values, sibling.path));
      if (!canonical.valid) continue;
      const items = Array.isArray(canonical.value) ? canonical.value : [canonical.value];
      for (const item of items) {
        const value = sibling.def.type === 'relation' ? getAt(item, 'id') : item;
        if (
          value !== null &&
          value !== undefined &&
          value !== '' &&
          ['string', 'number', 'boolean'].includes(typeof value)
        )
          result.add(String(value));
      }
    }
  }
  return result;
}

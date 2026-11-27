import { canonicalTreeValue, type createTranslator } from '@brume-ui/brume-react';
import type { FieldDef } from '@brume-ui/brume-schema';
import { getAt, setAt } from './paths';

/**
 * Wire rules of `keyValue`, `list` and `tree` shared by validation, condition evaluation and
 * submit. The PHP server mirrors these exactly (see packages/schema/docs/forms.md).
 */
type Translate = ReturnType<typeof createTranslator>;

export const KEY_VALUE_MAX_PAIRS = 200;
export const KEY_MAX_LENGTH = 255;
export const VALUE_MAX_LENGTH = 65_535;
export const LIST_MAX_ITEMS = 500;
export const LIST_ITEM_MAX_LENGTH = 255;

/**
 * Whitespace is exactly the Unicode White_Space property (U+0009-000D, 0020, 0085, 00A0, 1680,
 * 2000-200A, 2028, 2029, 202F, 205F, 3000), never U+FEFF or any other format character.
 */
const EDGE_SPACE = /^\p{White_Space}+|\p{White_Space}+$/gu;
const BLANK = /^\p{White_Space}*$/u;

export const trimText = (text: string): string => text.replace(EDGE_SPACE, '');
const isBlankText = (text: string): boolean => BLANK.test(text);
const length = (text: string): number => [...text].length;

export type StructuralDef = Extract<FieldDef, { type: 'keyValue' | 'list' | 'tree' }>;
export const isStructural = (def: FieldDef | undefined): def is StructuralDef =>
  def?.type === 'keyValue' || def?.type === 'list' || def?.type === 'tree';

type Pair = { key: string; value: string };
const isPair = (row: unknown): row is Pair =>
  row !== null &&
  typeof row === 'object' &&
  !Array.isArray(row) &&
  typeof (row as Pair).key === 'string' &&
  typeof (row as Pair).value === 'string';

/** Whether the value has the wire shape of the type (a wrong shape is a generic field error). */
export function hasStructuralShape(def: StructuralDef, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return def.type === 'keyValue'
    ? value.every(isPair)
    : value.every((item) => typeof item === 'string');
}

/**
 * The value as it is validated and submitted. keyValue: keys trimmed, rows with an empty key and
 * an empty value dropped. list: items kept as typed (never trimmed), whitespace-only items
 * dropped. tree: canonical for its mode. A value of the wrong shape is returned unchanged.
 */
export function normalizeStructural(def: StructuralDef, value: unknown): unknown {
  if (!hasStructuralShape(def, value)) return value;
  if (def.type === 'keyValue')
    return (value as Pair[])
      .map(({ key, value: text }) => ({ key: trimText(key), value: text }))
      .filter((row) => !(row.key === '' && row.value === ''));
  if (def.type === 'list') return (value as string[]).filter((item) => !isBlankText(item));
  return canonicalTreeValue(def.options, value as string[], def.mode);
}

export interface StructuralItemError {
  /** Relative to the field: '' is the field, `2` a list item, `1.key` a keyValue cell. */
  suffix: string;
  message: string;
}

/**
 * Errors of a structural value in the SUBMITTED (post-normalisation) index space, which is also
 * the server's. Field-level count errors come first.
 */
export function structuralErrors(
  def: StructuralDef,
  value: unknown,
  t: Translate,
): StructuralItemError[] {
  if (def.type === 'tree' || !hasStructuralShape(def, value)) return [];
  const rows = normalizeStructural(def, value) as unknown[];
  const errors: StructuralItemError[] = [];
  if (def.type === 'list') {
    const items = rows as string[];
    const max = Math.min(def.max ?? LIST_MAX_ITEMS, LIST_MAX_ITEMS);
    if (def.min !== undefined && items.length < def.min)
      errors.push({ suffix: '', message: t('validation.list.min', { min: def.min }) });
    else if (items.length > max)
      errors.push({ suffix: '', message: t('validation.list.max', { max }) });
    const limit = def.maxLength ?? LIST_ITEM_MAX_LENGTH;
    items.forEach((item, index) => {
      if (length(item) > limit)
        errors.push({
          suffix: String(index),
          message: t('validation.list.itemLength', { max: limit }),
        });
    });
    return errors;
  }
  const pairs = rows as Pair[];
  const max = Math.min(def.max ?? KEY_VALUE_MAX_PAIRS, KEY_VALUE_MAX_PAIRS);
  if (pairs.length > max)
    errors.push({ suffix: '', message: t('validation.keyValue.max', { max }) });
  const seen = new Set<string>();
  pairs.forEach(({ key, value: text }, index) => {
    if (key === '')
      errors.push({ suffix: `${index}.key`, message: t('validation.keyValue.keyRequired') });
    else if (length(key) > KEY_MAX_LENGTH)
      errors.push({
        suffix: `${index}.key`,
        message: t('validation.keyValue.keyLength', { max: KEY_MAX_LENGTH }),
      });
    else if (seen.has(key))
      errors.push({ suffix: `${index}.key`, message: t('validation.keyValue.keyDuplicate') });
    seen.add(key);
    if (length(text) > VALUE_MAX_LENGTH)
      errors.push({
        suffix: `${index}.value`,
        message: t('validation.keyValue.valueLength', { max: VALUE_MAX_LENGTH }),
      });
  });
  return errors;
}

/**
 * The values to send: every active keyValue, list and tree field in its normalised form. Hidden,
 * disabled and read-only fields keep their draft untouched (the server ignores them).
 */
export function submitValues(
  fields: ReadonlyArray<{ path: string; def: FieldDef; active: boolean }>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  let next = values;
  for (const { path, def, active } of fields) {
    if (!active || !isStructural(def)) continue;
    const raw = getAt(next, path);
    const normalized = normalizeStructural(def, raw);
    if (JSON.stringify(normalized) !== JSON.stringify(raw)) next = setAt(next, path, normalized);
  }
  return next;
}

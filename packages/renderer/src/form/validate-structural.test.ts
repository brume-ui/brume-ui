import { createTranslator } from '@brume-ui/brume-react';
import type { FieldDef } from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { canonicalizeFieldValue, evaluateCondition } from './conditions';
import { normalizeStructural, type StructuralDef, submitValues, trimText } from './structural';
import { validateField } from './validate';

const t = createTranslator('zh-TW');
const def = (type: string, extra: Record<string, unknown> = {}): FieldDef =>
  ({ type, name: 'v', label: 'V', ...extra }) as unknown as FieldDef;
const kv = (extra: Record<string, unknown> = {}) => def('keyValue', extra);
const list = (extra: Record<string, unknown> = {}) => def('list', extra);
const required = { rules: [{ rule: 'required', message: '必填' }] };
const pair = (key: string, value = 'x') => ({ key, value });
/** path -> message for every error of the field (the field itself is ''). */
const errors = (d: FieldDef, value: unknown) => {
  const result = validateField(d, value, t);
  if (!result) return {};
  return Object.fromEntries(
    (result.items ?? [{ suffix: '', message: result.message }]).map((i) => [i.suffix, i.message]),
  );
};

describe('keyValue', () => {
  it('trims keys, drops completely empty rows, then validates', () => {
    expect(errors(kv(), [pair(' a '), pair('', ''), pair('  ', '')])).toEqual({});
    expect(
      normalizeStructural(kv() as StructuralDef, [pair(' a '), pair('', ''), pair('  ', '')]),
    ).toEqual([pair('a')]);
  });
  it('an empty key with a value is an error on that row key; only the post-drop index counts', () => {
    expect(errors(kv(), [pair('', ''), pair('a'), pair('', 'v')])).toEqual({
      '1.key': t('validation.keyValue.keyRequired'),
    });
  });
  it('a duplicate key (after trimming) errors on the second and later occurrence only', () => {
    expect(errors(kv(), [pair('a'), pair('b'), pair(' a '), pair('a')])).toEqual({
      '2.key': t('validation.keyValue.keyDuplicate'),
      '3.key': t('validation.keyValue.keyDuplicate'),
    });
    // case-sensitive, and numeric-looking or odd keys are plain keys
    expect(
      errors(kv(), [pair('A'), pair('a'), pair('1'), pair('0'), pair('__proto__'), pair('a.b')]),
    ).toEqual({});
  });
  it('limits: key 255, value 65535 code points, 200 pairs (max lowers it)', () => {
    expect(errors(kv(), [pair('k'.repeat(255))])).toEqual({});
    expect(errors(kv(), [pair('k'.repeat(256))])).toEqual({
      '0.key': t('validation.keyValue.keyLength', { max: 255 }),
    });
    expect(errors(kv(), [pair('a', 'v'.repeat(65_535))])).toEqual({});
    expect(errors(kv(), [pair('a', 'v'.repeat(65_536))])).toEqual({
      '0.value': t('validation.keyValue.valueLength', { max: 65_535 }),
    });
    // an astral character is one code point
    expect(errors(kv(), [pair('😀'.repeat(255))])).toEqual({});
    const many = (n: number) => Array.from({ length: n }, (_, i) => pair(`k${i}`));
    expect(errors(kv(), many(200))).toEqual({});
    expect(errors(kv(), many(201))).toEqual({ '': t('validation.keyValue.max', { max: 200 }) });
    expect(errors(kv({ max: 2 }), many(3))).toEqual({
      '': t('validation.keyValue.max', { max: 2 }),
    });
  });
  it('required means at least one pair after the drop', () => {
    expect(errors(kv(required), [])).toEqual({ '': '必填' });
    expect(errors(kv(required), [pair('', '')])).toEqual({ '': '必填' });
    expect(errors(kv(required), [pair('a', '')])).toEqual({});
    expect(errors(kv(), [])).toEqual({});
  });
  it('an empty value is kept and valid', () => {
    expect(errors(kv(), [pair('a', '')])).toEqual({});
  });
  it('a wrong shape is not this validator (canonical validity reports it)', () => {
    expect(canonicalizeFieldValue(kv(), { a: 'b' }).valid).toBe(false);
    expect(canonicalizeFieldValue(kv(), [{ key: 'a', value: 1 }]).valid).toBe(false);
    expect(canonicalizeFieldValue(kv(), [pair(' a '), pair('', '')])).toEqual({
      valid: true,
      value: [pair('a')],
    });
  });
});

describe('list', () => {
  it('drops whitespace-only items (including U+3000) before min/max, never trims the rest', () => {
    expect(normalizeStructural(list() as StructuralDef, ['', '  ', '　', ' a '])).toEqual([' a ']);
    expect(errors(list({ min: 2 }), ['a', '  ', ''])).toEqual({
      '': t('validation.list.min', { min: 2 }),
    });
    expect(errors(list({ max: 1 }), ['a', '  ', 'b'])).toEqual({
      '': t('validation.list.max', { max: 1 }),
    });
    expect(errors(list({ max: 2 }), ['a', '  ', 'b'])).toEqual({});
  });
  it('min applies to an empty list too', () => {
    expect(errors(list({ min: 1 }), [])).toEqual({ '': t('validation.list.min', { min: 1 }) });
  });
  it('maxLength (default 255, code points) errors at the post-drop index', () => {
    const long = 'x'.repeat(256);
    expect(errors(list(), ['', 'a', '  ', long])).toEqual({
      '1': t('validation.list.itemLength', { max: 255 }),
    });
    expect(errors(list({ maxLength: 3 }), ['abc', 'abcd'])).toEqual({
      '1': t('validation.list.itemLength', { max: 3 }),
    });
    expect(errors(list(), ['x'.repeat(255), '😀'.repeat(255)])).toEqual({});
  });
  it('more than 500 kept items is a field-level error; blank ones do not count', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => `i${i}`);
    expect(errors(list(), items(500))).toEqual({});
    expect(errors(list(), [...items(500), '', ' '])).toEqual({});
    expect(errors(list(), items(501))).toEqual({ '': t('validation.list.max', { max: 500 }) });
  });
  it('required means at least one kept item; duplicates are allowed', () => {
    expect(errors(list(required), ['', ' '])).toEqual({ '': '必填' });
    expect(errors(list(required), ['a', 'a'])).toEqual({});
  });
  it('a non-string item is a shape error, not trimmed or dropped', () => {
    expect(canonicalizeFieldValue(list(), ['a', 3]).valid).toBe(false);
  });
});

describe('tree', () => {
  const options = [
    { value: 'p', label: 'P', depth: 0 },
    { value: 'a', label: 'A', depth: 1 },
    { value: 'b', label: 'B', depth: 1 },
  ];
  const tree = (mode: string, extra = {}) => def('tree', { mode, options, ...extra });
  it('canonicalises to the mode (parent expands to leaves, unknown ids dropped)', () => {
    expect(canonicalizeFieldValue(tree('leaves'), ['p', 'zzz'])).toEqual({
      valid: true,
      value: ['a', 'b'],
    });
    expect(canonicalizeFieldValue(tree('all'), ['b', 'a'])).toEqual({
      valid: true,
      value: ['p', 'a', 'b'],
    });
    expect(canonicalizeFieldValue(tree('independent'), ['b', 'p'])).toEqual({
      valid: true,
      value: ['p', 'b'],
    });
  });
  it('required means at least one canonical id', () => {
    expect(errors(tree('leaves', required), ['zzz'])).toEqual({ '': '必填' });
    expect(errors(tree('leaves', required), ['a'])).toEqual({});
  });
  it('a non-string id is a shape error', () => {
    expect(canonicalizeFieldValue(tree('leaves'), ['a', 1]).valid).toBe(false);
  });
});

describe('canonical validity of structural values', () => {
  it('null and undefined are a valid empty value; a string, even empty, is a wrong shape', () => {
    for (const d of [kv(), list(), def('tree', { mode: 'leaves', options: [] })]) {
      expect(canonicalizeFieldValue(d, null).valid).toBe(true);
      expect(canonicalizeFieldValue(d, undefined).valid).toBe(true);
      expect(canonicalizeFieldValue(d, '').valid).toBe(false);
      expect(canonicalizeFieldValue(d, 'x').valid).toBe(false);
      expect(canonicalizeFieldValue(d, {}).valid).toBe(false);
    }
  });
});

describe('autocomplete behaves as text', () => {
  it('blank is empty, minLength/maxLength apply, a string value is canonical', () => {
    const d = def('autocomplete', {
      minLength: 2,
      maxLength: 4,
      rules: [
        { rule: 'minLength', value: 2, message: 'short' },
        { rule: 'maxLength', value: 4, message: 'long' },
      ],
    });
    expect(validateField(d, '', t)).toBeNull();
    expect(validateField(d, 'a', t)?.message).toBe('short');
    expect(validateField(d, 'abcde', t)?.message).toBe('long');
    expect(validateField(d, 'abc', t)).toBeNull();
    expect(canonicalizeFieldValue(d, 'x')).toEqual({ valid: true, value: 'x' });
    expect(canonicalizeFieldValue(d, 3).valid).toBe(false);
  });
});

describe('conditions on the new types', () => {
  const lookup = (d: FieldDef, raw: unknown) => ({
    getField: () => d,
    getValue: () => raw,
  });
  const empty = { op: 'empty', field: { scope: 'root', path: 'v' } } as const;
  it('empty on keyValue and list counts only kept rows/items', () => {
    for (const [d, raw, expected] of [
      [kv(), [], true],
      [kv(), [pair('', '')], true],
      [kv(), [pair('a', '')], false],
      [list(), ['', '  '], true],
      [list(), ['a'], false],
    ] as const)
      expect(evaluateCondition(empty, {}, undefined, lookup(d, raw))).toBe(expected);
  });
  it('empty on tree is the canonical value', () => {
    const d = def('tree', { mode: 'leaves', options: [{ value: 'a', label: 'A', depth: 0 }] });
    expect(evaluateCondition(empty, {}, undefined, lookup(d, ['zzz']))).toBe(true);
    expect(evaluateCondition(empty, {}, undefined, lookup(d, ['a']))).toBe(false);
  });
});

describe('submitValues', () => {
  it('normalises active structural fields only', () => {
    const fields = [
      { path: 'a', def: kv(), active: true },
      { path: 'b', def: list(), active: true },
      { path: 'c', def: list(), active: false },
      { path: 'rows.0.d', def: kv(), active: true },
    ];
    const values = {
      a: [pair(' k '), pair('', '')],
      b: ['', ' x '],
      c: ['', 'keep'],
      rows: [{ d: [pair(' z ')] }],
    };
    expect(submitValues(fields, values)).toEqual({
      a: [pair('k')],
      b: [' x '],
      c: ['', 'keep'],
      rows: [{ d: [pair('z')] }],
    });
  });
  it('returns the same object when nothing changes', () => {
    const values = { a: [pair('k')] };
    expect(submitValues([{ path: 'a', def: kv(), active: true }], values)).toBe(values);
  });
});

describe('trimText', () => {
  it('is JS trim(): U+FEFF is whitespace, U+0085 is not', () => {
    expect(trimText('\u3000\u00a0 a b \t\n')).toBe('a b');
    expect(trimText('\ufeffa\ufeff')).toBe('a');
    expect(trimText('\u0085a')).toBe('\u0085a');
  });
  it('a U+FEFF-only key or item is blank, a U+0085-only one is not', () => {
    expect(normalizeStructural(kv() as StructuralDef, [pair('\ufeff', '')])).toEqual([]);
    expect(normalizeStructural(kv() as StructuralDef, [pair('\u0085', '')])).toEqual([
      pair('\u0085', ''),
    ]);
    expect(normalizeStructural(list() as StructuralDef, ['\ufeff', '\u0085'])).toEqual(['\u0085']);
  });
});

describe('required on structural fields and listbox', () => {
  const tree = def('tree', {
    mode: 'leaves',
    options: [{ value: 'a', label: 'A', depth: 0 }],
    ...required,
  });
  const listbox = def('multipleSelect', { appearance: 'listbox', options: [], ...required });
  it.each([
    ['keyValue', kv(required), [pair('', ''), pair('\ufeff', '')]],
    ['list', list(required), [' ', '\ufeff']],
    ['tree', tree, ['gone']],
  ])('%s fails for null, undefined, [] and a value that normalises to empty', (_n, d, empty) => {
    for (const value of [null, undefined, [], empty])
      expect(validateField(d, value, t)?.message, JSON.stringify(value)).toBe('必填');
  });
  it('listbox fails for null, undefined and []', () => {
    for (const value of [null, undefined, []])
      expect(validateField(listbox, value, t)?.message).toBe('必填');
  });
});

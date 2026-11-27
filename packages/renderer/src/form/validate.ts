import { createTranslator, isEmptyHtml, isIp } from '@brume-ui/brume-react';
import type { ClientRule, FieldDef, FormNode } from '@brume-ui/brume-schema';
import { assertSafePath, joinPath } from './paths';
import { isStructural, normalizeStructural, structuralErrors } from './structural';

function isEmpty(value: unknown): boolean {
  return (
    value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (
    typeof value !== 'string' ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function passes(rule: ClientRule, value: unknown, def: FieldDef): boolean {
  switch (rule.rule) {
    case 'required':
      return def.type === 'richText' && typeof value === 'string'
        ? !isEmptyHtml(value)
        : !isEmpty(value);
    case 'minLength':
      return typeof value === 'string' && [...value].length >= rule.value;
    case 'maxLength':
      return typeof value === 'string' && [...value].length <= rule.value;
    case 'min': {
      const number = numeric(value);
      return number !== null && number >= rule.value;
    }
    case 'max': {
      const number = numeric(value);
      return number !== null && number <= rule.value;
    }
    case 'numeric':
      return numeric(value) !== null;
    case 'integer':
      return (
        (typeof value === 'number' && Number.isInteger(value)) ||
        (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim()))
      );
    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
    case 'url': {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
      } catch {
        return false;
      }
    }
    case 'pattern': {
      if (typeof value !== 'string') return false;
      try {
        return new RegExp(rule.pattern, 'u').test(value);
      } catch {
        return false;
      }
    }
    case 'maxFiles':
      return Array.isArray(value) && value.length <= rule.value;
  }
}

type Translate = ReturnType<typeof createTranslator>;
const defaultTranslate = createTranslator('zh-TW');

export interface FieldValidationError {
  message: string;
  /** Set for two-bound fields (`range`, `timeRange`): the error belongs to that bound's input. */
  bound?: 'start' | 'end';
  /**
   * Set for `keyValue` and `list`: every error with its path relative to the field ('' is the
   * field itself, `2` an item, `1.key` a cell), in the submitted index space; `message` is the first.
   */
  items?: Array<{ suffix: string; message: string }>;
}

const isBoundsField = (def: FieldDef) => def.type === 'range' || def.type === 'timeRange';

function bounds(value: unknown): { start?: unknown; end?: unknown } | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/** Like isEmpty, plus a range whose bounds are both absent (`{}` is what the inputs emit). */
function isEmptyFor(def: FieldDef, value: unknown): boolean {
  if (isEmpty(value)) return true;
  if (!isBoundsField(def)) return false;
  const record = bounds(value);
  return record !== null && isEmpty(record.start) && isEmpty(record.end);
}

const TIME = /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;
const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DECIMAL = /^-?[0-9]+(?:\.[0-9]+)?$/;

/** Exact decimal comparison on the wire strings, so long decimals never meet float rounding. */
function compareDecimal(a: string, b: string): number {
  const parts = (text: string) => {
    const negative = text.startsWith('-');
    const [int = '', frac = ''] = text.replace(/^-/, '').split('.');
    return { int: int.replace(/^0+(?=[0-9])/, ''), frac: frac.replace(/0+$/, ''), negative };
  };
  const x = parts(a);
  const y = parts(b);
  const zero = (p: ReturnType<typeof parts>) => p.int === '0' && p.frac === '';
  const sign = (p: ReturnType<typeof parts>) => (zero(p) ? 0 : p.negative ? -1 : 1);
  if (sign(x) !== sign(y)) return sign(x) < sign(y) ? -1 : 1;
  const length = Math.max(x.frac.length, y.frac.length);
  const width = Math.max(x.int.length, y.int.length);
  const key = (p: ReturnType<typeof parts>) =>
    p.int.padStart(width, '0') + p.frac.padEnd(length, '0');
  const ka = key(x);
  const kb = key(y);
  const magnitude = ka < kb ? -1 : ka > kb ? 1 : 0;
  return sign(x) < 0 ? -magnitude : magnitude;
}

/** Whether `value - min` is a whole number of steps, ignoring float noise (0.3 on a 0.1 grid). */
function onGrid(value: number, min: number, step: number): boolean {
  const k = Number(((value - min) / step).toFixed(9));
  return k === Math.round(k);
}

/**
 * Checks every built-in field type carries on the wire (the same rules as the server's implied
 * rules), independent of the schema's `rules`. Empty values are never reported here.
 */
export function builtInError(
  def: FieldDef,
  value: unknown,
  t: Translate = defaultTranslate,
): FieldValidationError | null {
  if (isEmptyFor(def, value)) return null;
  const invalid = () => ({ message: `${def.label}${t('common.hasError')}` });
  switch (def.type) {
    case 'ip': {
      if (typeof value !== 'string') return invalid();
      const text = value.trim();
      if (isIp(text, def.version)) return null;
      return {
        message: t(
          def.version === 4
            ? 'validation.ip4'
            : def.version === 6
              ? 'validation.ip6'
              : 'validation.ip',
        ),
      };
    }
    case 'slider': {
      const number = numeric(value);
      if (number === null) return invalid();
      if (number < def.min) return { message: t('validation.min', { min: def.min }) };
      if (number > def.max) return { message: t('validation.max', { max: def.max }) };
      return onGrid(number, def.min, def.step)
        ? null
        : { message: t('validation.step', { step: def.step, min: def.min }) };
    }
    case 'icon':
      return typeof value === 'string' &&
        value.length <= 64 &&
        ICON_NAME.test(value) &&
        (!def.icons || def.icons.includes(value))
        ? null
        : { message: t('validation.icon') };
    case 'time':
      return typeof value === 'string' && TIME.test(value)
        ? null
        : { message: t('validation.time') };
    case 'range':
    case 'timeRange': {
      const record = bounds(value);
      if (!record) return invalid();
      const range = def.type === 'range';
      for (const bound of ['start', 'end'] as const) {
        const item = record[bound];
        if (item === undefined || item === null || item === '') continue;
        if (typeof item !== 'string') return { ...invalid(), bound };
        if (range) {
          const fraction = item.split('.')[1]?.length ?? 0;
          if (!DECIMAL.test(item) || fraction > def.decimals) return { ...invalid(), bound };
        } else if (!TIME.test(item)) return { message: t('validation.time'), bound };
      }
      if (
        range &&
        typeof record.start === 'string' &&
        typeof record.end === 'string' &&
        record.start !== '' &&
        record.end !== '' &&
        compareDecimal(record.start, record.end) > 0
      )
        return { message: t('validation.range.order'), bound: 'end' };
      return null;
    }
    default:
      return null;
  }
}

/** The first failing rule or built-in check of an editable field, with the bound it belongs to. */
export function validateField(
  def: FieldDef,
  value: unknown,
  t: Translate = defaultTranslate,
): FieldValidationError | null {
  if (
    def.readOnly ||
    def.disabled ||
    def.type === 'display' ||
    def.type === 'hidden' ||
    (def.type === 'custom' && def.displayOnly)
  )
    return null;
  if (isStructural(def)) {
    // Rules are judged on the normalised value; only "required" is meaningful for these shapes.
    const normalized = normalizeStructural(def, value);
    if (
      (def.rules ?? []).some((rule) => rule.rule === 'required') &&
      Array.isArray(normalized) &&
      normalized.length === 0
    )
      return { message: (def.rules ?? []).find((rule) => rule.rule === 'required')?.message ?? '' };
    const items = structuralErrors(def, value, t);
    const [first] = items;
    return first ? { message: first.message, items } : null;
  }
  const empty = isEmptyFor(def, value);
  for (const rule of def.rules ?? []) {
    if (rule.rule !== 'required' && empty) continue;
    // Range-like values are objects; only "required" is meaningful for them (shape: builtInError).
    if (isBoundsField(def) && rule.rule !== 'required') continue;
    const failed =
      rule.rule === 'required' && isBoundsField(def) ? empty : !passes(rule, value, def);
    if (failed) return { message: rule.message };
  }
  return builtInError(def, value, t);
}

export function validateValue(
  def: FieldDef,
  value: unknown,
  t: Translate = defaultTranslate,
): string | null {
  return validateField(def, value, t)?.message ?? null;
}

/** Walks schema state, including sections that are not currently visible. */
export function collectFields(
  nodes: FormNode[],
  base = '',
): Array<{ path: string; def: FieldDef }> {
  return nodes.flatMap((node) => {
    switch (node.type) {
      case 'field':
        assertSafePath(node.field.name);
        return [{ path: joinPath(base, node.field.name), def: node.field }];
      case 'divider':
      case 'html':
      case 'button':
        return [];
      case 'columns':
        return node.columns.flatMap((column) => collectFields(column.children, base));
      case 'embeds':
        assertSafePath(node.name);
        return collectFields(node.children, joinPath(base, node.name));
      default:
        return collectFields(node.children, base);
    }
  });
}

export { collectValueFields, type ValueField } from './traversal';

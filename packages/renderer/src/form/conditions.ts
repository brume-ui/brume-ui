import { canonicalDecimal } from '@brume-ui/brume-react';
import type { Condition, ConditionPath, FieldDef } from '@brume-ui/brume-schema';
import { assertSafePath, getAt, joinPath } from './paths';

export function conditionPaths(condition: Condition): ConditionPath[] {
  if ('conditions' in condition) return condition.conditions.flatMap(conditionPaths);
  if (condition.op === 'not') return conditionPaths(condition.condition);
  return [condition.field];
}

export function resolveConditionPath(field: ConditionPath, rowPath?: string): string {
  assertSafePath(field.path);
  if (field.scope === 'root') return field.path;
  if (!rowPath) throw new Error('Row condition requires an explicit row path');
  assertSafePath(rowPath);
  return joinPath(rowPath, field.path);
}

export type CanonicalFieldValue = { valid: boolean; value: unknown };
/** Only number controls coerce numeric strings. Codes/IDs and boolean operands remain typed. */
export function canonicalizeFieldValue(
  def: FieldDef | undefined,
  value: unknown,
): CanonicalFieldValue {
  if (value == null || value === '') return { valid: true, value };
  if (def?.type === 'decimal' || def?.type === 'currency') {
    // Field validity is checked on the raw value, before display/paste rounding. This matches
    // the server's declared decimal scale; canonicalDecimal itself remains a rounding utility.
    const withinScale =
      typeof value === 'string' &&
      /^[+-]?\d+(?:\.\d*)?$(?![\s\S])/.test(value) &&
      (value.split('.')[1]?.length ?? 0) <= def.decimals;
    const canonical = withinScale ? canonicalDecimal(value.replace(/^\+/, ''), def.decimals) : null;
    return { valid: canonical !== null, value: canonical };
  }
  if (def?.type === 'number') {
    const valid =
      typeof value === 'number'
        ? Number.isFinite(value)
        : typeof value === 'string' &&
          /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) &&
          Number.isFinite(Number(value));
    return { valid, value: valid ? Number(value) : value };
  }
  if (def?.type === 'switch') return { valid: typeof value === 'boolean', value };
  const record = (item: unknown): item is Record<string, unknown> =>
    item !== null && typeof item === 'object' && !Array.isArray(item);
  if (def?.type === 'repeater')
    return { valid: Array.isArray(value) && value.every(record), value };
  if (def?.type === 'relation') {
    const selected = (item: unknown) =>
      record(item) && typeof getAt(item, 'id') === 'string' && getAt(item, 'id') !== '';
    return {
      valid: def.multiple ? Array.isArray(value) && value.every(selected) : selected(value),
      value,
    };
  }
  if (def && ['multipleSelect', 'checkbox', 'tags'].includes(def.type))
    return {
      valid: Array.isArray(value) && value.every((item) => typeof item === 'string'),
      value,
    };
  if (
    def &&
    [
      'text',
      'textarea',
      'email',
      'url',
      'mobile',
      'password',
      'select',
      'radio',
      'date',
      'datetime',
    ].includes(def.type)
  )
    return { valid: typeof value === 'string', value };
  return { valid: true, value };
}

export interface ConditionEvaluationOptions {
  getField?(path: string): FieldDef | undefined;
  /** Invalid dependencies conservatively activate the entire AST, including not/all/any. */
  isInvalid?(path: string): boolean;
}

/** Pure AST evaluation. Three arguments give strict JSON semantics; metadata adds field-aware values. */
export function evaluateCondition(
  condition: Condition,
  values: Record<string, unknown>,
  rowPath?: string,
  options: ConditionEvaluationOptions = {},
): boolean {
  // Resolve every path before short-circuiting, so invalid configurations cannot hide in a branch.
  const dependencies = conditionPaths(condition).map((field) =>
    resolveConditionPath(field, rowPath),
  );
  if (
    dependencies.some(
      (path) =>
        options.isInvalid?.(path) ||
        !canonicalizeFieldValue(options.getField?.(path), getAt(values, path)).valid,
    )
  )
    return true;
  const evaluate = (node: Condition): boolean => {
    if ('conditions' in node)
      return node.op === 'all' ? node.conditions.every(evaluate) : node.conditions.some(evaluate);
    if (node.op === 'not') return !evaluate(node.condition);
    const path = resolveConditionPath(node.field, rowPath);
    const def = options.getField?.(path);
    const raw = getAt(values, path);
    if (node.op === 'empty')
      return raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0);
    const value = canonicalizeFieldValue(def, raw).value;
    const operand = (expected: unknown) =>
      (def?.type === 'decimal' || def?.type === 'currency') && typeof expected === 'string'
        ? (canonicalizeFieldValue(def, expected).value ?? expected)
        : expected;
    if (node.op === 'in') return node.values.some((expected) => value === operand(expected));
    return node.op === 'eq' ? value === operand(node.value) : value !== operand(node.value);
  };
  return evaluate(condition);
}

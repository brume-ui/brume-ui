import type { ClientRule, FieldDef, FormNode } from '@brume-ui/brume-schema';
import { assertSafePath, joinPath } from './paths';

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

function passes(rule: ClientRule, value: unknown): boolean {
  switch (rule.rule) {
    case 'required':
      return !isEmpty(value);
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

export function validateValue(def: FieldDef, value: unknown): string | null {
  if (
    def.readOnly ||
    def.disabled ||
    def.type === 'display' ||
    def.type === 'hidden' ||
    (def.type === 'custom' && def.displayOnly)
  )
    return null;
  for (const rule of def.rules ?? []) {
    if (rule.rule !== 'required' && isEmpty(value)) continue;
    if (!passes(rule, value)) return rule.message;
  }
  return null;
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

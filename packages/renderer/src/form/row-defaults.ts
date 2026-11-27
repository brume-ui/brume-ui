import type { FormNode } from '@brume-ui/brume-schema';
import { getAt, setAt } from './paths';
import { hasStructuralShape, normalizeStructural } from './structural';

/**
 * The values a new repeater row starts with: every `defaultValue` declared in its template, at the
 * field's path (under `embeds` names too). A nested repeater or relation starts empty and its own
 * rows get their defaults when added, so this never descends into one.
 */
export function rowDefaults(nodes: FormNode[]): Record<string, unknown> {
  let row: Record<string, unknown> = {};
  const walk = (items: FormNode[], prefix: string) => {
    for (const node of items) {
      if (node.type === 'field') {
        const { field } = node;
        if (field.type === 'slider' && field.required && !field.readOnly && !field.disabled)
          row = setAt(row, prefix + field.name, field.min);
        if (
          field.type !== 'repeater' &&
          field.type !== 'relation' &&
          Object.hasOwn(field, 'defaultValue') &&
          field.defaultValue !== undefined
        )
          // An explicit default wins over the slider minimum.
          row = setAt(row, prefix + field.name, structuredClone(field.defaultValue));
      } else if (node.type === 'columns') {
        for (const column of node.columns) walk(column.children, prefix);
      } else if (node.type === 'embeds') {
        walk(node.children, `${prefix}${node.name}.`);
      } else if (
        node.type === 'section' ||
        node.type === 'block' ||
        node.type === 'fieldset' ||
        node.type === 'group' ||
        node.type === 'row'
      ) {
        walk(node.children, prefix);
      }
    }
  };
  walk(nodes, '');
  return row;
}

const blank = (value: unknown) => value == null || value === '';

/**
 * Values the form seeds into both its draft and its baseline, so showing them is never an edit:
 * - A required, editable slider has no empty state worth keeping: its thumb rests on `min`, and the
 *   browser cannot "move" onto it. It gets `min` when empty.
 * - A `tree` value is canonicalised for its mode (a legacy parent id expands to its leaves, unknown
 *   ids drop), because the control always emits the canonical form.
 * Applies in the root, `embeds`, and existing repeater / relation rows. Returns the same object when
 * nothing needed changing.
 */
export function withRequiredSliderMinimums(
  nodes: FormNode[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  let next = values;
  const walk = (items: FormNode[], prefix: string) => {
    for (const node of items) {
      if (node.type === 'field') {
        const { field } = node;
        const path = prefix + field.name;
        if (field.type === 'slider') {
          if (field.required && !field.readOnly && !field.disabled && blank(getAt(next, path)))
            next = setAt(next, path, field.min);
        } else if (field.type === 'tree') {
          const stored = getAt(next, path);
          if (hasStructuralShape(field, stored)) {
            const canonical = normalizeStructural(field, stored);
            if (JSON.stringify(canonical) !== JSON.stringify(stored))
              next = setAt(next, path, canonical);
          }
        } else if (field.type === 'repeater' || field.type === 'relation') {
          const rows = getAt(next, path);
          const children = field.type === 'repeater' ? field.nodes : (field.fields ?? []);
          if (Array.isArray(rows))
            rows.forEach((row, index) => {
              if (row !== null && typeof row === 'object') walk(children, `${path}.${index}.`);
            });
          else if (field.type === 'relation' && rows !== null && typeof rows === 'object')
            walk(children, `${path}.`);
        }
      } else if (node.type === 'columns') {
        for (const column of node.columns) walk(column.children, prefix);
      } else if (node.type === 'embeds') {
        walk(node.children, `${prefix}${node.name}.`);
      } else if (
        node.type === 'section' ||
        node.type === 'block' ||
        node.type === 'fieldset' ||
        node.type === 'group' ||
        node.type === 'row'
      ) {
        walk(node.children, prefix);
      }
    }
  };
  walk(nodes, '');
  return next;
}

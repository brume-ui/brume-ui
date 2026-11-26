import type { FormNode } from '@brume-ui/brume-schema';
import { getAt, setAt } from './paths';

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
      } else if (node.type === 'section' || node.type === 'block' || node.type === 'row') {
        walk(node.children, prefix);
      }
    }
  };
  walk(nodes, '');
  return row;
}

const blank = (value: unknown) => value == null || value === '';

/**
 * A required, editable slider has no empty state worth keeping: its thumb rests on `min`, and the
 * browser cannot "move" onto it. Fills `min` for every such slider whose value is empty, in the
 * root, `embeds`, and existing repeater / relation rows, so the shown answer is the stored one and
 * the form is not dirty for it. Returns the same object when nothing needed filling.
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
      } else if (node.type === 'section' || node.type === 'block' || node.type === 'row') {
        walk(node.children, prefix);
      }
    }
  };
  walk(nodes, '');
  return next;
}

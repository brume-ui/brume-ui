import type { FormNode } from '@brume-ui/brume-schema';
import { setAt } from './paths';

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
        if (
          field.type !== 'repeater' &&
          field.type !== 'relation' &&
          Object.hasOwn(field, 'defaultValue') &&
          field.defaultValue !== undefined
        )
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

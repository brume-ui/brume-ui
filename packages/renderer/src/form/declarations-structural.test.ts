import type { Condition, FieldDef, FormNode } from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { validateConditionDeclarations } from './traversal';

const field = (type: string, name: string, extra: Record<string, unknown> = {}): FormNode => ({
  type: 'field',
  field: { type, name, label: name, ...extra } as unknown as FieldDef,
});
const eq = (path: string, op: 'eq' | 'ne' | 'in' | 'empty' = 'eq'): Condition =>
  (op === 'in'
    ? { op, field: { scope: 'root', path }, values: ['a'] }
    : op === 'empty'
      ? { op, field: { scope: 'root', path } }
      : { op, field: { scope: 'root', path }, value: 'a' }) as Condition;

describe('operand rule', () => {
  const targets: Array<[string, Record<string, unknown>]> = [
    ['keyValue', {}],
    ['list', {}],
    ['tree', { mode: 'leaves', options: [] }],
  ];
  for (const [type, extra] of targets) {
    const nodes = (condition: Condition): FormNode[] => [
      field(type, 'target', extra),
      field('text', 'dependent', { showWhen: condition }),
    ];
    it(`${type} supports only empty`, () => {
      expect(() => validateConditionDeclarations(nodes(eq('target', 'empty')))).not.toThrow();
      for (const op of ['eq', 'ne', 'in'] as const)
        expect(() => validateConditionDeclarations(nodes(eq('target', op)))).toThrow(
          /only supports "empty"/,
        );
    });
    it(`${type} is rejected inside all/any/not and in enableWhen`, () => {
      const wrapped = [
        { op: 'all', conditions: [eq('target')] },
        { op: 'any', conditions: [eq('target', 'empty'), eq('target', 'ne')] },
        { op: 'not', condition: eq('target', 'in') },
        { op: 'not', condition: { op: 'all', conditions: [eq('target')] } },
      ] as Condition[];
      for (const condition of wrapped)
        expect(() => validateConditionDeclarations(nodes(condition))).toThrow(
          /only supports "empty"/,
        );
      expect(() =>
        validateConditionDeclarations([
          field(type, 'target', extra),
          field('text', 'dependent', { enableWhen: eq('target') }),
        ]),
      ).toThrow(/only supports "empty"/);
    });
  }
  it('autocomplete behaves like text: every operator is allowed', () => {
    for (const op of ['eq', 'ne', 'in', 'empty'] as const)
      expect(() =>
        validateConditionDeclarations([
          field('autocomplete', 'target'),
          field('text', 'dependent', { showWhen: eq('target', op) }),
        ]),
      ).not.toThrow();
  });
  it('applies to row-scoped targets inside a repeater too', () => {
    const rowCondition = {
      op: 'eq',
      field: { scope: 'row', path: 'tags' },
      value: 'a',
    } as Condition;
    expect(() =>
      validateConditionDeclarations([
        field('repeater', 'rows', {
          mode: 'json',
          nodes: [field('list', 'tags'), field('text', 'note', { showWhen: rowCondition })],
        }),
      ]),
    ).toThrow(/only supports "empty"/);
  });
});

describe('list declaration', () => {
  it('rejects min greater than max', () => {
    expect(() => validateConditionDeclarations([field('list', 'l', { min: 3, max: 2 })])).toThrow(
      /min.*max/,
    );
    expect(() =>
      validateConditionDeclarations([field('list', 'l', { min: 2, max: 2 })]),
    ).not.toThrow();
  });
});

describe('repeater table layout', () => {
  const table = (...nodes: FormNode[]) => [
    field('repeater', 'rows', { mode: 'json', layout: 'table', nodes }),
  ];
  it('accepts plain field columns', () => {
    expect(() =>
      validateConditionDeclarations(
        table(
          field('text', 'a'),
          field('select', 'b', { options: [] }),
          field('multipleSelect', 'c', { options: [] }),
          field('switch', 'd'),
          field('autocomplete', 'e'),
        ),
      ),
    ).not.toThrow();
  });
  for (const type of [
    'repeater',
    'relation',
    'upload',
    'richText',
    'keyValue',
    'list',
    'tree',
    'custom',
  ])
    it(`rejects a ${type} column and names it`, () => {
      expect(() =>
        validateConditionDeclarations(table(field(type, 'bad', { nodes: [], mode: 'json' }))),
      ).toThrow(new RegExp(`table.*"bad" \\(type ${type}\\)`));
    });
  it('rejects a multipleSelect listbox column', () => {
    expect(() =>
      validateConditionDeclarations(
        table(field('multipleSelect', 'pick', { appearance: 'listbox', options: [] })),
      ),
    ).toThrow(/"pick".*listbox/);
  });
  for (const node of [
    { type: 'section', key: 's', title: 'S', children: [] },
    { type: 'row', children: [] },
    { type: 'columns', columns: [] },
    { type: 'block', children: [] },
    { type: 'divider' },
    { type: 'html', html: '<p>x</p>' },
    { type: 'embeds', name: 'e', label: 'E', children: [] },
    { type: 'fieldset', key: 'f', title: 'F', children: [] },
    { type: 'group', showWhen: eq('x'), children: [] },
  ] as FormNode[])
    it(`rejects a ${node.type} node as a direct child`, () => {
      expect(() => validateConditionDeclarations(table(node))).toThrow(
        new RegExp(`table.*${node.type}`),
      );
    });
  it('stack layout keeps allowing anything', () => {
    expect(() =>
      validateConditionDeclarations([
        field('repeater', 'rows', {
          mode: 'json',
          nodes: [{ type: 'block', children: [field('list', 'l')] }],
        }),
      ]),
    ).not.toThrow();
  });
});

import type { Condition, FieldDef, FormNode } from '@brume-ui/brume-schema';
import { expect, it } from 'vitest';
import fixtures from '../../../schema/fixtures/conditions/evaluation.json';
import * as publicApi from '../index';

it.each(fixtures)('$name', (fixture) => {
  expect(typeof publicApi.evaluateCondition).toBe('function');
  const defs = fixture.fields as FieldDef[] | undefined;
  expect(
    publicApi.evaluateCondition(fixture.condition as Condition, fixture.values, fixture.rowPath, {
      getField: (path: string) => defs?.find((def) => def.name === path),
      isInvalid: (path: string) => fixture.invalidPaths?.includes(path) ?? false,
    }),
  ).toBe(fixture.expected);
});
const field = (name: string, dependency?: string): FormNode => ({
  type: 'field',
  field: {
    type: 'text',
    name,
    label: name,
    ...(dependency
      ? { showWhen: { op: 'empty', field: { scope: 'root', path: dependency } } }
      : {}),
  },
});
it('rejects unsafe and unknown paths and activity cycles even without current rows', () => {
  expect(typeof publicApi.validateConditionDeclarations).toBe('function');
  for (const path of ['__proto__.a', 'a..b', 'a.*.b', 'a[0]', 'a.constructor', '../a']) {
    expect(() =>
      publicApi.evaluateCondition({ op: 'empty', field: { scope: 'root', path } }, {}),
    ).toThrow(/path/i);
  }
  expect(() =>
    publicApi.evaluateCondition({ op: 'empty', field: { scope: 'row', path: 'name' } }, {}),
  ).toThrow(/row/i);
  expect(() => publicApi.validateConditionDeclarations([field('a', 'missing')])).toThrow(
    /unknown/i,
  );
  expect(() => publicApi.validateConditionDeclarations([field('a', 'b'), field('b', 'a')])).toThrow(
    /cycle/i,
  );
  expect(() =>
    publicApi.validateConditionDeclarations([
      {
        type: 'field',
        field: {
          type: 'repeater',
          name: 'rows',
          label: 'Rows',
          mode: 'json',
          nodes: [field('a', 'unknown')],
        },
      },
    ]),
  ).toThrow(/unknown/i);
});
it('resolves numeric declarations through row templates without treating symmetric exclusions as cycles', () => {
  const nodes: FormNode[] = [
    {
      type: 'field',
      field: {
        type: 'repeater',
        name: 'rows',
        label: 'Rows',
        mode: 'json',
        nodes: [
          {
            type: 'field',
            field: {
              type: 'select',
              name: 'product',
              label: 'Product',
              remote: { url: '/options' },
              excludeSelectedIn: [{ scope: 'root', path: 'rows.*.product' }],
            },
          },
          {
            type: 'field',
            field: {
              type: 'text',
              name: 'note',
              label: 'Note',
              showWhen: {
                op: 'eq',
                field: { scope: 'root', path: 'rows.12.product' },
                value: '007',
              },
            },
          },
        ],
      },
    },
  ];
  expect(typeof publicApi.validateConditionDeclarations).toBe('function');
  expect(() => publicApi.validateConditionDeclarations(nodes)).not.toThrow();
});

it('rejects wildcard field declarations instead of treating them as runtime row arrays', () => {
  expect(() => publicApi.validateConditionDeclarations([field('rows.*.note')])).toThrow(/path/i);
  expect(() =>
    publicApi.validateConditionDeclarations([
      { type: 'embeds', name: 'rows.*', label: 'Rows', children: [field('note')] },
    ]),
  ).toThrow(/path/i);
});

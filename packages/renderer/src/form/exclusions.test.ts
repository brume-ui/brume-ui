import type { FormDef } from '@brume-ui/brume-schema';
import { describe, expect, it } from 'vitest';
import { excludedChoiceValues } from './exclusions';
import { collectValueFields } from './traversal';

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'repeater',
        mode: 'json',
        name: 'rows',
        label: 'Rows',
        nodes: [
          {
            type: 'field',
            field: {
              type: 'multipleSelect',
              name: 'choice',
              label: 'Choice',
              options: [],
              excludeSelectedIn: [{ scope: 'root', path: 'rows.*.choice' }],
            },
          },
        ],
      },
    },
  ],
};
describe('choice exclusions', () => {
  it('expands declared wildcard siblings and ignores only the current resolved field across add/remove/move', () => {
    const values = { rows: [{ choice: ['7'] }, { choice: ['8', '9'] }] };
    const fields = collectValueFields(form.nodes, values);
    expect([...excludedChoiceValues(fields, values, 'rows.0.choice')]).toEqual(['8', '9']);
    const moved = { rows: [values.rows[1], values.rows[0], { choice: ['10'] }] };
    expect([
      ...excludedChoiceValues(collectValueFields(form.nodes, moved), moved, 'rows.1.choice'),
    ]).toEqual(['8', '9', '10']);
    const removed = { rows: [values.rows[0]] };
    expect([
      ...excludedChoiceValues(collectValueFields(form.nodes, removed), removed, 'rows.0.choice'),
    ]).toEqual([]);
  });
  it('uses row origins and field canonicalization without coercing ordinary code strings', () => {
    const def: FormDef = {
      layout: 'stacked',
      nodes: [
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
                  type: 'tags',
                  name: 'choice',
                  label: 'Choice',
                  excludeSelectedIn: [
                    { scope: 'row', path: 'number' },
                    { scope: 'row', path: 'code' },
                    { scope: 'row', path: 'money' },
                    { scope: 'row', path: 'flag' },
                  ],
                },
              },
              { type: 'field', field: { type: 'number', name: 'number', label: 'Number' } },
              { type: 'field', field: { type: 'text', name: 'code', label: 'Code' } },
              {
                type: 'field',
                field: { type: 'currency', name: 'money', label: 'Money', decimals: 2 },
              },
              { type: 'field', field: { type: 'switch', name: 'flag', label: 'Flag' } },
            ],
          },
        },
      ],
    };
    const values = {
      rows: [{ choice: [], number: '007', code: '007', money: '1.2', flag: false }],
    };
    expect([
      ...excludedChoiceValues(collectValueFields(def.nodes, values), values, 'rows.0.choice'),
    ]).toEqual(['7', '007', '1.20', 'false']);
  });
});

it('extracts only declared relation identities from single and multiple sibling selections', () => {
  const definition: FormDef = {
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: {
          type: 'tags',
          name: 'choice',
          label: 'Choice',
          excludeSelectedIn: [
            { scope: 'root', path: 'single' },
            { scope: 'root', path: 'many' },
            { scope: 'root', path: 'opaque' },
          ],
        },
      },
      {
        type: 'field',
        field: {
          type: 'relation',
          name: 'single',
          label: 'Single',
          multiple: false,
          remote: { url: '/options' },
        },
      },
      {
        type: 'field',
        field: {
          type: 'relation',
          name: 'many',
          label: 'Many',
          multiple: true,
          remote: { url: '/options' },
        },
      },
      {
        type: 'field',
        field: {
          type: 'custom',
          name: 'opaque',
          label: 'Opaque',
          component: { type: 'component', name: 'Opaque' },
        },
      },
    ],
  };
  const values = {
    choice: [],
    single: { id: '7', quantity: 2 },
    many: [{ id: '8' }, { id: '9' }],
    opaque: { id: 'foreign' },
  };
  expect([
    ...excludedChoiceValues(collectValueFields(definition.nodes, values), values, 'choice'),
  ]).toEqual(['7', '8', '9']);
});

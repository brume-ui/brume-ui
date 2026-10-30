import type { TSchema } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import * as schemas from '../index';
import { emitJsonSchema, validateEnvelope } from '../index';

const doc = JSON.parse(emitJsonSchema());
const ajv = new Ajv2020({ strict: true });
const check = (name: string, value: unknown) => {
  expect(doc.$defs, `missing public definition ${name}`).toHaveProperty(name);
  const valid = ajv.compile({ $ref: `#/$defs/${name}`, $defs: doc.$defs })(value);
  const schema = (schemas as unknown as Record<string, TSchema>)[`${name}Schema`];
  if (schema)
    expect(
      TypeCompiler.Compile(schema, [schemas.FormNodeSchema]).Check(value),
      `TypeBox parity for ${name}`,
    ).toBe(valid);
  return valid;
};
const custom = {
  type: 'custom',
  name: 'total',
  label: 'Total',
  component: { type: 'component', name: 'Calculator', props: { rate: 2 } },
  displayOnly: true,
};
const upload = {
  type: 'upload',
  name: 'files',
  label: 'Files',
  kind: 'file',
  multiple: true,
  accept: ['application/pdf'],
  maxSize: 1024,
};
const remote = { url: '/options', dependsOn: { category: { scope: 'row', path: 'category' } } };
const remoteSelect = {
  type: 'select',
  name: 'product',
  label: 'Product',
  remote,
  excludeSelectedIn: [{ scope: 'root', path: 'choices.*.product' }],
};
const relation = {
  type: 'relation',
  name: 'products',
  label: 'Products',
  multiple: true,
  remote,
  fields: [{ type: 'field', field: custom }],
};
const repeat = (nodes: unknown[], level: number) => ({
  type: 'field',
  field: {
    type: 'repeater',
    name: `level${level}`,
    label: 'Rows',
    mode: 'relation',
    min: 0,
    max: 20,
    distinct: ['sku'],
    sortable: true,
    nodes,
  },
});
const envelope = (nodes: unknown[]) => ({
  schemaVersion: '0.4.0',
  page: {
    type: 'form',
    title: 'Nested',
    formId: 'nested',
    name: 'Nested',
    mode: 'create',
    after: { options: ['edit'], default: 'edit' },
    presentation: 'page',
    size: 'lg',
    form: { layout: 'stacked', nodes },
    values: {},
    submit: { url: '/save', method: 'post', label: 'Save' },
  },
});

describe('recursive form wire contracts', () => {
  it('accepts four repeater levels with upload, custom and relation fields on both validators', () => {
    let node = repeat(
      [upload, custom, relation, remoteSelect].map((field) => ({ type: 'field', field })),
      4,
    );
    for (let level = 3; level >= 1; level--) node = repeat([node], level);
    const value = envelope([node]);
    expect(validateEnvelope(value)).toEqual({ ok: true });
    expect(check('PageEnvelope', value)).toBe(true);
  });

  it('uses the shared FormNode definition for recursive children without a depth limit', () => {
    for (const [type, prop] of [
      ['repeater', 'nodes'],
      ['relation', 'fields'],
    ] as const) {
      const branches = doc.$defs.FieldDef.anyOf;
      const variant = branches.find(
        (b: { properties?: { type?: { const?: string } } }) => b.properties?.type?.const === type,
      );
      expect(variant?.properties[prop].items).toEqual({ $ref: '#/$defs/FormNode' });
    }
  });

  it('validates the exact recursive condition AST and rejects unsafe scalar paths', () => {
    const condition = {
      op: 'all',
      conditions: [
        { op: 'eq', field: { scope: 'root', path: 'active' }, value: true },
        { op: 'ne', field: { scope: 'row', path: 'code' }, value: '001' },
        { op: 'in', field: { scope: 'row', path: 'category' }, values: [null, 0, false, 'x'] },
        {
          op: 'not',
          condition: {
            op: 'any',
            conditions: [{ op: 'empty', field: { scope: 'row', path: 'files.0.name' } }],
          },
        },
        { op: 'all', conditions: [] },
        { op: 'any', conditions: [] },
      ],
    };
    expect(check('Condition', condition)).toBe(true);
    for (const bad of [
      { op: 'eval', expression: 'x' },
      { op: 'eq', field: { scope: 'root', path: 'x' }, value: {} },
      { op: 'in', field: { scope: 'root', path: 'x' }, values: 'x' },
      ...['../x', 'a..b', 'choices.*.id', '__proto__.x', 'x.constructor', 'x.prototype'].map(
        (path) => ({ op: 'empty', field: { scope: 'row', path } }),
      ),
    ])
      expect(check('Condition', bad), JSON.stringify(bad)).toBe(false);
    expect(
      check('FieldDef', {
        ...custom,
        showWhen: condition,
        enableWhen: { op: 'empty', field: { scope: 'row', path: 'x' } },
      }),
    ).toBe(true);
  });

  it('validates stable row identity and ordered canonical upload context', () => {
    expect(check('RowIdentity', { key: 'uuid', id: '17' })).toBe(true);
    expect(check('RowIdentity', { key: 'new-uuid' })).toBe(true);
    for (const bad of [
      {},
      { key: '' },
      { key: 'x', id: 17 },
      { key: 'x', id: '' },
      { key: 'x', id: '17', index: 0 },
    ])
      expect(check('RowIdentity', bad)).toBe(false);
    expect(
      check('RowContext', [
        { path: 'groups', key: 'g', id: '17' },
        { path: 'groups.*.items', key: 'i' },
      ]),
    ).toBe(true);
    for (const bad of [
      { path: 'groups', key: 'g' },
      [{ path: '../groups', key: 'g' }],
      [{ path: 'groups' }],
    ])
      expect(check('RowContext', bad)).toBe(false);
  });

  it('accepts selection identities with flattened extra fields, never intermediary identity envelopes', () => {
    for (const value of [
      null,
      { id: '10', quantity: 2 },
      [{ id: '10', quantity: 2 }, { id: '11' }],
    ])
      expect(check('RelationValue', value)).toBe(true);
    for (const value of ['10', { quantity: 2 }, { id: 10 }, [{ id: '' }]])
      expect(check('RelationValue', value)).toBe(false);
  });

  it('keeps action, quick-create and upload-extra inputs static and flat', () => {
    for (const value of [custom, relation, repeat([], 1).field, remoteSelect, upload])
      expect(check('PlainFieldDef', value), value.type).toBe(false);
    expect(
      check('PlainFieldDef', { type: 'select', name: 'status', label: 'Status', options: [] }),
    ).toBe(true);
    expect(
      check('PlainFieldDef', {
        type: 'select',
        name: 'status',
        label: 'Status',
        options: [],
        remote,
      }),
    ).toBe(false);
    expect(check('PlainFieldDef', { type: 'text', name: 'x', label: 'X', nodes: [] })).toBe(false);
    expect(
      check('PlainFieldDef', { type: 'text', name: 'x', label: 'X', component: custom.component }),
    ).toBe(false);
    expect(check('FieldDef', remoteSelect)).toBe(true);
    expect(
      check('FieldDef', { type: 'multipleSelect', name: 'products', label: 'Products', remote }),
    ).toBe(true);
    expect(check('FieldDef', { type: 'text', name: '_brume', label: 'Reserved' })).toBe(false);
  });

  it('emits picker filter and custom inline editor variants with the existing display envelope', () => {
    for (const type of ['selectTable', 'multipleSelectTable'])
      expect(check('FilterInput', { type })).toBe(true);
    expect(
      check('InlineEditor', {
        type: 'custom',
        component: custom.component,
        rules: [{ rule: 'required', message: 'Required' }],
      }),
    ).toBe(true);
    expect(check('Display', custom.component)).toBe(true);
    expect(check('InlineEditor', { type: 'custom', name: 'Calculator' })).toBe(false);
    expect(check('FilterInput', { type: 'selectTable', remote: { url: '/other' } })).toBe(false);
  });
});

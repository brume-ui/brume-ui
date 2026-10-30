import type { Static } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import type {
  Condition,
  CustomFieldDef,
  RelationFieldDef,
  RelationValue,
  RelationValueSchema,
  RemoteChoiceFieldDef,
  RepeaterFieldDef,
  RowContext,
  RowIdentity,
} from '../index';
import type { FieldDef, FieldDefRaw, PlainFieldDef, PlainFieldDefRaw } from './field';
import type { FormNode, FormNodeRaw } from './layout';

/**
 * 手寫型別與 schema 推得的型別必須互相可指派，由 `tsc --noEmit`（`pnpm typecheck`）把關。
 * 不用嚴格的 Equals：TypeBox 推得的型別與手寫型別結構相同時，Equals 仍可能判定不同。
 */
type FieldDefInferred = Static<typeof FieldDefRaw>;
type FormNodeInferred = Static<typeof FormNodeRaw>;
type PlainFieldDefInferred = Static<typeof PlainFieldDefRaw>;

const fieldToSchema = (x: FieldDef): FieldDefInferred => x;
const schemaToField = (x: FieldDefInferred): FieldDef => x;
const nodeToSchema = (x: FormNode): FormNodeInferred => x;
const schemaToNode = (x: FormNodeInferred): FormNode => x;
const plainToSchema = (x: PlainFieldDef): PlainFieldDefInferred => x;
const schemaToPlain = (x: PlainFieldDefInferred): PlainFieldDef => x;

// 把關本身會失敗：多一個分支、少一個分支、選填屬性型別不同
type ExtraBranch = FieldDef | { type: 'bogus'; name: string; label: string };
// @ts-expect-error 手寫型別多出 schema 沒有的分支
const extraBranch = (x: ExtraBranch): FieldDefInferred => x;
// @ts-expect-error 手寫型別少了 schema 有的分支
const missingBranch = (x: FieldDefInferred): Exclude<FieldDef, { type: 'switch' }> => x;
type WrongOptional =
  | Exclude<FieldDef, { type: 'text' }>
  | (Omit<Extract<FieldDef, { type: 'text' }>, 'maxLength'> & { maxLength?: string });
// @ts-expect-error 選填屬性的型別不同
const wrongOptional = (x: WrongOptional): FieldDefInferred => x;
type NestedUpload = Omit<Extract<FieldDef, { type: 'upload' }>, 'extra'> & { extra?: FieldDef[] };
// @ts-expect-error upload.extra 不可含 upload
const nestedUpload = (x: NestedUpload): FieldDefInferred => x;

describe('form types agree with their schemas', () => {
  // 真正的檢查是 tsc（pnpm typecheck）；這裡只讓 vitest 載入本檔，通過不代表型別一致。
  it('is a compile-time guard: pnpm typecheck fails on drift, not this test', () => {
    expect([
      fieldToSchema,
      schemaToField,
      nodeToSchema,
      schemaToNode,
      plainToSchema,
      schemaToPlain,
      extraBranch,
      missingBranch,
      wrongOptional,
      nestedUpload,
    ]).toHaveLength(10);
  });
});

// Public aliases must admit arbitrary recursive depth, without widening static action inputs.
const custom: CustomFieldDef = {
  type: 'custom',
  name: 'total',
  label: 'Total',
  component: { type: 'component', name: 'Calculator' },
};
const condition: Condition = {
  op: 'all',
  conditions: [{ op: 'not', condition: { op: 'empty', field: { scope: 'row', path: 'code' } } }],
};
const remoteChoice: RemoteChoiceFieldDef = {
  type: 'select',
  name: 'product',
  label: 'Product',
  remote: { url: '/options' },
  showWhen: condition,
};
const relation: RelationFieldDef = {
  type: 'relation',
  name: 'products',
  label: 'Products',
  multiple: true,
  remote: { url: '/options' },
  fields: [{ type: 'field', field: custom }],
};
const recursive = (nodes: FormNode[]): RepeaterFieldDef => ({
  type: 'repeater',
  name: 'rows',
  label: 'Rows',
  mode: 'json',
  nodes,
});
const deep: FormNode = {
  type: 'field',
  field: recursive([
    {
      type: 'field',
      field: recursive([
        {
          type: 'field',
          field: recursive([
            { type: 'field', field: recursive([{ type: 'field', field: relation }]) },
          ]),
        },
      ]),
    },
  ]),
};
fieldToSchema(custom);
fieldToSchema(remoteChoice);
nodeToSchema(deep);
const row: RowIdentity = { key: 'uuid', id: '7' };
const context: RowContext = [
  { ...row, path: 'groups' },
  { key: 'new', path: 'groups.*.items' },
];
const selected: RelationValue = [{ id: 'product-1', quantity: 2 }];
void context;
void selected;
// @ts-expect-error recursive fields are not flat action fields
plainToSchema(recursive([]));
// @ts-expect-error registered custom fields are form-only
plainToSchema(custom);
// @ts-expect-error remote endpoints are not flat action inputs
plainToSchema(remoteChoice);
const staticWithRemote = {
  type: 'select' as const,
  name: 'x',
  label: 'X',
  options: [],
  remote: { url: '/options' },
};
// @ts-expect-error a static choice with a remote endpoint cannot enter action/quick-create inputs
plainToSchema(staticWithRemote);
// @ts-expect-error wire relation ids are strings
const invalidRow: RowIdentity = { key: 'x', id: 7 };
const invalidCustom: CustomFieldDef = {
  type: 'custom',
  name: 'x',
  label: 'X',
  // @ts-expect-error custom fields require the ComponentRef envelope
  component: 'Calculator',
};
void invalidRow;
void invalidCustom;

// Inferred public schema values also accept declared, flattened selection extras.
const inferredSelection: Static<typeof RelationValueSchema> = { id: 'product-1', quantity: 2 };
void inferredSelection;

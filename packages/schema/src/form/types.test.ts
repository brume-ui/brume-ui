import type { Static } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import type { FieldDef, FieldDefRaw } from './field';
import type { FormNode, FormNodeRaw } from './layout';

/**
 * 手寫型別與 schema 推得的型別必須互相可指派，由 `tsc --noEmit`（`pnpm typecheck`）把關。
 * 不用嚴格的 Equals：TypeBox 推得的型別與手寫型別結構相同時，Equals 仍可能判定不同。
 */
type FieldDefInferred = Static<typeof FieldDefRaw>;
type FormNodeInferred = Static<typeof FormNodeRaw>;

const fieldToSchema = (x: FieldDef): FieldDefInferred => x;
const schemaToField = (x: FieldDefInferred): FieldDef => x;
const nodeToSchema = (x: FormNode): FormNodeInferred => x;
const schemaToNode = (x: FormNodeInferred): FormNode => x;

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
  it('is checked at compile time', () => {
    expect([
      fieldToSchema,
      schemaToField,
      nodeToSchema,
      schemaToNode,
      extraBranch,
      missingBranch,
      wrongOptional,
      nestedUpload,
    ]).toHaveLength(8);
  });
});

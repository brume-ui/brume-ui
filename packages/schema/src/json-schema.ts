import { FieldDefSchema, PlainFieldDefSchema } from './form/field';
import { FormNodeSchema } from './form/layout';
import { PageEnvelopeSchema } from './page';
import { FormSubmitRequestSchema, FormSubmitResponseSchema } from './protocol/form';
import {
  ActionRequestSchema,
  ActionResponseSchema,
  CellUpdateRequestSchema,
  CellUpdateResponseSchema,
  ErrorResponseSchema,
} from './protocol/http';
import { OptionsResponseSchema, PickerSearchResponseSchema } from './protocol/options';
import { UploadTempResponseSchema, UploadValueSchema } from './protocol/upload';
import { MenuItemSchema, SharedPropsSchema } from './shared';

/** 以 `$id` 表示的具名型別（MenuItem、FormNode 為遞迴）；輸出時一律 hoist 到 `$defs`。 */
const RECURSIVE_IDS = new Set(['MenuItem', 'FormNode', 'FieldDef', 'PlainFieldDef']);

/**
 * TypeBox 的遞迴型別用 `$id` 加相對 `$ref` 表示；輸出時把它們（含巢狀出現的整份定義）
 * 改成 `#/$defs/<id>`，這樣換 base URI 也不會壞。
 */
function hoist(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(hoist);
  if (node === null || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  for (const key of ['$id', '$ref'] as const) {
    const id = obj[key];
    if (typeof id === 'string' && RECURSIVE_IDS.has(id)) return { $ref: `#/$defs/${id}` };
  }
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, hoist(v)]));
}

const plain = (schema: unknown): unknown => JSON.parse(JSON.stringify(schema));

/** 具名型別本身的定義：拿掉最外層的 `$id`，內部 hoist。 */
function recursiveDef(schema: unknown): unknown {
  const { $id: _id, ...rest } = plain(schema) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, hoist(v)]));
}

/** v0.json 的內容：JSON Schema 2020-12，根為 PageEnvelope，`$defs` 收錄頁面、共用屬性、請求／回應協定與表單的遞迴型別。 */
export function emitJsonSchema(): string {
  const doc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $ref: '#/$defs/PageEnvelope',
    $defs: {
      PageEnvelope: hoist(plain(PageEnvelopeSchema)),
      SharedProps: hoist(plain(SharedPropsSchema)),
      MenuItem: recursiveDef(MenuItemSchema),
      ActionRequest: plain(ActionRequestSchema),
      ActionResponse: plain(ActionResponseSchema),
      CellUpdateRequest: plain(CellUpdateRequestSchema),
      CellUpdateResponse: plain(CellUpdateResponseSchema),
      ErrorResponse: plain(ErrorResponseSchema),
      OptionsResponse: plain(OptionsResponseSchema),
      PickerSearchResponse: plain(PickerSearchResponseSchema),
      UploadTempResponse: plain(UploadTempResponseSchema),
      UploadValue: plain(UploadValueSchema),
      FormNode: recursiveDef(FormNodeSchema),
      FieldDef: recursiveDef(FieldDefSchema),
      PlainFieldDef: recursiveDef(PlainFieldDefSchema),
      FormSubmitRequest: plain(FormSubmitRequestSchema),
      FormSubmitResponse: plain(FormSubmitResponseSchema),
    },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

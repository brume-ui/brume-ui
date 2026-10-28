import { PageEnvelopeSchema } from './page';
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

const MENU_ITEM_REF = '#/$defs/MenuItem';

/**
 * TypeBox 的遞迴型別用 `$id` 加相對 `$ref` 表示；輸出時改成 `$defs` 加 `#/$defs/...`，
 * 這樣換 base URI 也不會壞。
 */
function hoistMenuItem(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(hoistMenuItem);
  if (node === null || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  if (obj.$id === 'MenuItem' || obj.$ref === 'MenuItem') return { $ref: MENU_ITEM_REF };
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, hoistMenuItem(v)]));
}

const plain = (schema: unknown): unknown => JSON.parse(JSON.stringify(schema));

function menuItemDef(): unknown {
  const { $id: _id, ...rest } = JSON.parse(JSON.stringify(MenuItemSchema)) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, hoistMenuItem(v)]));
}

/** v0.json 的內容：JSON Schema 2020-12，根為 PageEnvelope，`$defs` 收錄頁面、共用屬性與請求／回應協定。 */
export function emitJsonSchema(): string {
  const doc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $ref: '#/$defs/PageEnvelope',
    $defs: {
      PageEnvelope: hoistMenuItem(JSON.parse(JSON.stringify(PageEnvelopeSchema))),
      SharedProps: hoistMenuItem(JSON.parse(JSON.stringify(SharedPropsSchema))),
      MenuItem: menuItemDef(),
      ActionRequest: plain(ActionRequestSchema),
      ActionResponse: plain(ActionResponseSchema),
      CellUpdateRequest: plain(CellUpdateRequestSchema),
      CellUpdateResponse: plain(CellUpdateResponseSchema),
      ErrorResponse: plain(ErrorResponseSchema),
      OptionsResponse: plain(OptionsResponseSchema),
      PickerSearchResponse: plain(PickerSearchResponseSchema),
      UploadTempResponse: plain(UploadTempResponseSchema),
      UploadValue: plain(UploadValueSchema),
    },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

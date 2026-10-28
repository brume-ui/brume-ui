import { type Static, Type } from '@sinclair/typebox';
import { OptionSchema } from './display';

export const OptionItemSchema = Type.Intersect([
  OptionSchema,
  Type.Object({ group: Type.Optional(Type.String()), description: Type.Optional(Type.String()) }),
]);
export type OptionItem = Static<typeof OptionItemSchema>;

const OptionsPaginationSchema = Type.Object({
  page: Type.Integer({ minimum: 1 }),
  perPage: Type.Integer({ minimum: 1 }),
  hasMore: Type.Boolean(),
});

/** 遠端選項與挑選器搜尋的查詢參數名稱（GET `endpoints.options`）。 */
export const OPTIONS_PARAMS = {
  q: 'q',
  page: 'page',
  perPage: 'per_page',
  /** 帶已選的值換回標籤：`value[]=7&value[]=9` */
  value: 'value[]',
  /** 挑選器的分區鍵（`PickerSearchResponse.sections[].key`）；省略時為第一個分區。 */
  section: 'section',
} as const;

/** GET endpoints.options?q=&page=&per_page=&value[]= */
export const OptionsResponseSchema = Type.Object({
  data: Type.Array(OptionItemSchema),
  pagination: OptionsPaginationSchema,
});
export type OptionsResponse = Static<typeof OptionsResponseSchema>;

const LabeledKeySchema = Type.Object({ key: Type.String(), label: Type.String() });

/** 挑選器搜尋：比 OptionsResponse 多 `columns`、`sections`，請求多一個 `section` 參數（`OPTIONS_PARAMS.section`）。 */
export const PickerSearchResponseSchema = Type.Object({
  data: Type.Array(
    Type.Intersect([
      OptionItemSchema,
      Type.Object({ columns: Type.Optional(Type.Record(Type.String(), Type.Unknown())) }),
    ]),
  ),
  pagination: OptionsPaginationSchema,
  columns: Type.Optional(Type.Array(LabeledKeySchema)),
  sections: Type.Optional(Type.Array(LabeledKeySchema)),
});
export type PickerSearchResponse = Static<typeof PickerSearchResponseSchema>;

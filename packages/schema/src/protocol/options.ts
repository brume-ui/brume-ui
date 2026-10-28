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

/** GET endpoints.options?q=&page=&per_page=&value[]= */
export const OptionsResponseSchema = Type.Object({
  data: Type.Array(OptionItemSchema),
  pagination: OptionsPaginationSchema,
});
export type OptionsResponse = Static<typeof OptionsResponseSchema>;

const LabeledKeySchema = Type.Object({ key: Type.String(), label: Type.String() });

/** 挑選器搜尋：比 OptionsResponse 多 `columns`、`sections`，請求多一個 section 參數。 */
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

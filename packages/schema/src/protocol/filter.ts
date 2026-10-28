import { type Static, Type } from '@sinclair/typebox';
import { OptionSchema } from './display';
import type { FilterValue } from './query';

/** 與 `parseGridQuery` 的 `FilterValue` 同形。 */
export const FilterValueSchema = Type.Union([
  Type.String(),
  Type.Array(Type.String()),
  Type.Object({ start: Type.Optional(Type.String()), end: Type.Optional(Type.String()) }),
  Type.Object({ op: Type.String(), value: Type.String() }),
]);

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// 編譯期確認 schema 和 FilterValue 沒有分歧
true satisfies Same<Static<typeof FilterValueSchema>, FilterValue>;

export const FilterInputSchema = Type.Union([
  Type.Object({
    type: Type.Literal('text'),
    inputMode: Type.Optional(Type.Union([Type.Literal('text'), Type.Literal('numeric')])),
    placeholder: Type.Optional(Type.String()),
  }),
  /** remote: 選項走 `endpoints.options`，source 為 filter key */
  Type.Object({
    type: Type.Union([Type.Literal('select'), Type.Literal('multipleSelect')]),
    options: Type.Optional(Type.Array(OptionSchema)),
    remote: Type.Optional(Type.Boolean()),
  }),
  Type.Object({
    type: Type.Union([Type.Literal('radio'), Type.Literal('checkbox')]),
    options: Type.Array(OptionSchema),
  }),
  Type.Object({ type: Type.Literal('date'), withTime: Type.Boolean() }),
  Type.Object({
    type: Type.Literal('range'),
    of: Type.Union([
      Type.Literal('text'),
      Type.Literal('number'),
      Type.Literal('date'),
      Type.Literal('datetime'),
    ]),
  }),
  Type.Object({
    type: Type.Literal('group'),
    of: Type.Union([Type.Literal('text'), Type.Literal('number')]),
    operators: Type.Array(OptionSchema),
  }),
]);
export type FilterInput = Static<typeof FilterInputSchema>;

export const FilterDefSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  input: FilterInputSchema,
  placement: Type.Union([Type.Literal('panel'), Type.Literal('column'), Type.Literal('hidden')]),
  span: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2)])),
});
export type FilterDef = Static<typeof FilterDefSchema>;

export const FilterPanelSchema = Type.Object({
  columns: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3), Type.Literal(4)]),
  items: Type.Array(Type.Union([FilterDefSchema, Type.Object({ type: Type.Literal('newline') })])),
});
export type FilterPanel = Static<typeof FilterPanelSchema>;

export const SelectorDefSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  multiple: Type.Boolean(),
  options: Type.Array(OptionSchema),
});
export type SelectorDef = Static<typeof SelectorDefSchema>;

export const ScopeDefSchema = Type.Object({ key: Type.String(), label: Type.String() });
export type ScopeDef = Static<typeof ScopeDefSchema>;

/** 目前生效的篩選；key 為 filter key、`'scope'` 或 `'q'`。 */
export const AppliedFilterSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  display: Type.String(),
});
export type AppliedFilter = Static<typeof AppliedFilterSchema>;

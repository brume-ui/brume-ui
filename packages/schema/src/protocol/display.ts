import { type Static, Type } from '@sinclair/typebox';
import { ComponentRefSchema } from '../component-ref';
import { ClientRuleSchema } from '../form/rules';

export const ToneSchema = Type.Union([
  Type.Literal('neutral'),
  Type.Literal('accent'),
  Type.Literal('success'),
  Type.Literal('warning'),
  Type.Literal('danger'),
  Type.Literal('info'),
]);
export type Tone = Static<typeof ToneSchema>;

export const OptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
  disabled: Type.Optional(Type.Boolean()),
});
export type Option = Static<typeof OptionSchema>;

const TableColumnsSchema = Type.Array(Type.Object({ key: Type.String(), label: Type.String() }));

/** `expand` / `modal` 顯示器的內容，放在 `row._meta.content[key]`。 */
export const CellContentSchema = Type.Union([
  Type.Object({ type: Type.Literal('text'), text: Type.String() }),
  Type.Object({
    type: Type.Literal('table'),
    columns: TableColumnsSchema,
    rows: Type.Array(Type.Record(Type.String(), Type.Unknown())),
  }),
  ComponentRefSchema,
]);
export type CellContent = Static<typeof CellContentSchema>;

/** 儲存格的顯示方式。 */
export const DisplaySchema = Type.Union([
  Type.Object({ type: Type.Literal('text') }),
  ComponentRefSchema,
  Type.Object({
    type: Type.Literal('label'),
    options: Type.Optional(
      Type.Record(Type.String(), Type.Object({ label: Type.String(), tone: ToneSchema })),
    ),
    tone: Type.Optional(ToneSchema),
  }),
  Type.Object({ type: Type.Literal('badge'), tone: Type.Optional(ToneSchema) }),
  /** href 在 `row._meta.href[key]` */
  Type.Object({
    type: Type.Literal('link'),
    external: Type.Optional(Type.Boolean()),
    style: Type.Optional(Type.Union([Type.Literal('text'), Type.Literal('button')])),
  }),
  /** 值：url 或 url[] */
  Type.Object({
    type: Type.Literal('image'),
    width: Type.Optional(Type.Number()),
    height: Type.Optional(Type.Number()),
  }),
  Type.Object({ type: Type.Literal('limit'), length: Type.Number() }),
  Type.Object({ type: Type.Literal('progress'), max: Type.Number() }),
  Type.Object({ type: Type.Literal('qrcode'), size: Type.Optional(Type.Number()) }),
  Type.Object({ type: Type.Literal('copyable') }),
  /** 值：url、{url,name} 或它們的陣列 */
  Type.Object({ type: Type.Literal('downloadable') }),
  /** 內容在 `row._meta.content[key]` */
  Type.Object({ type: Type.Literal('expand'), label: Type.Optional(Type.String()) }),
  /** 內容在 `row._meta.content[key]` */
  Type.Object({
    type: Type.Literal('modal'),
    label: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
  }),
  /** 值：物件陣列 */
  Type.Object({ type: Type.Literal('table'), columns: TableColumnsSchema }),
]);
export type Display = Static<typeof DisplaySchema>;

/** 行內編輯器。 */
export const InlineEditorSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('custom'),
      component: ComponentRefSchema,
      rules: Type.Optional(Type.Array(ClientRuleSchema)),
    },
    { additionalProperties: false },
  ),
  Type.Object({ type: Type.Literal('text'), maxLength: Type.Optional(Type.Number()) }),
  Type.Object({ type: Type.Literal('textarea') }),
  Type.Object({
    type: Type.Literal('number'),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
    step: Type.Optional(Type.Number()),
  }),
  Type.Object({
    type: Type.Union([Type.Literal('select'), Type.Literal('radio'), Type.Literal('checkbox')]),
    options: Type.Array(OptionSchema),
  }),
  Type.Object({
    type: Type.Literal('switch'),
    onLabel: Type.Optional(Type.String()),
    offLabel: Type.Optional(Type.String()),
  }),
  Type.Object({
    type: Type.Literal('switchGroup'),
    keys: Type.Array(Type.Object({ key: Type.String(), label: Type.String() })),
  }),
  /** 值為 `YYYY-MM-DD`；`withTime` 時為 `YYYY-MM-DDTHH:mm` */
  Type.Object({ type: Type.Literal('date'), withTime: Type.Optional(Type.Boolean()) }),
  /** 值為固定小數位數的字串（例如 `"1280.50"`）或 null */
  Type.Object({
    type: Type.Literal('currency'),
    symbol: Type.String(),
    decimals: Type.Integer({ minimum: 0 }),
  }),
  /** 值為 `string[]`；`options` 是建議值，仍可輸入其他值 */
  Type.Object({ type: Type.Literal('tags'), options: Type.Optional(Type.Array(OptionSchema)) }),
]);
export type InlineEditor = Static<typeof InlineEditorSchema>;

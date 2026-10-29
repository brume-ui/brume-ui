import { type Static, type TProperties, type TSchema, Type } from '@sinclair/typebox';
import { type Option, OptionSchema } from '../protocol/display';
import { type OptionItem, OptionItemSchema } from '../protocol/options';

/** 前端可以先檢查的驗證規則子集。`message` 由伺服器以 422 同一套翻譯產生。 */
export const ClientRuleSchema = Type.Union([
  Type.Object({
    rule: Type.Union([
      Type.Literal('required'),
      Type.Literal('email'),
      Type.Literal('url'),
      Type.Literal('integer'),
      Type.Literal('numeric'),
    ]),
    message: Type.String(),
  }),
  Type.Object({
    rule: Type.Union([
      Type.Literal('minLength'),
      Type.Literal('maxLength'),
      Type.Literal('min'),
      Type.Literal('max'),
      Type.Literal('maxFiles'),
    ]),
    value: Type.Number(),
    message: Type.String(),
  }),
  Type.Object({
    rule: Type.Literal('pattern'),
    /** JS RegExp source，以 `u` flag 執行 */
    pattern: Type.String(),
    message: Type.String(),
  }),
]);
export type ClientRule = Static<typeof ClientRuleSchema>;

/** 1–12 的格數，用於 `row` 內的 `FieldBase.width` 與 `columns[].width`。 */
export const GridWidthSchema = Type.Integer({ minimum: 1, maximum: 12 });

export type FieldBase = {
  /** 相對於所在容器的鍵；`embeds` 會加一層前綴 */
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  span?: 'auto' | 'full';
  /** 1–12，只在 `row` 內有效 */
  width?: number;
  rules?: ClientRule[];
};

const fieldBase: TProperties = {
  name: Type.String(),
  label: Type.String(),
  help: Type.Optional(Type.String()),
  placeholder: Type.Optional(Type.String()),
  required: Type.Optional(Type.Boolean()),
  readOnly: Type.Optional(Type.Boolean()),
  disabled: Type.Optional(Type.Boolean()),
  span: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('full')])),
  width: Type.Optional(GridWidthSchema),
  rules: Type.Optional(Type.Array(ClientRuleSchema)),
};

export type FieldDef = FieldBase &
  (
    | { type: 'text'; maxLength?: number }
    | { type: 'textarea'; rows?: number; maxLength?: number }
    | { type: 'email' }
    | { type: 'url' }
    | { type: 'mobile' }
    | { type: 'password' }
    | { type: 'hidden' }
    | { type: 'display' }
    | { type: 'number'; min?: number; max?: number; step?: number }
    | {
        type: 'decimal' | 'currency';
        decimals: number;
        /** currency 用，例如 `'NT$'` */
        symbol?: string;
        min?: number;
        max?: number;
      }
    | { type: 'date' | 'datetime' | 'dateRange' | 'datetimeRange' }
    | { type: 'select'; options: OptionItem[]; searchable?: boolean; clearable?: boolean }
    | { type: 'multipleSelect'; options: OptionItem[]; max?: number }
    | { type: 'radio' | 'checkbox'; options: Option[]; orientation?: 'horizontal' | 'vertical' }
    | { type: 'switch'; onLabel?: string; offLabel?: string }
    | { type: 'tags'; options?: Option[]; max?: number; maxLength?: number }
    | {
        type: 'upload';
        kind: 'image' | 'file';
        multiple: boolean;
        /** 允許的 MIME */
        accept: string[];
        /** bytes */
        maxSize: number;
        maxFiles?: number;
        sortable?: boolean;
        /** 每個檔案的附加欄位，只能是非 upload 的扁平欄位 */
        extra?: FieldDef[];
      }
  );

const literals = <T extends string>(...values: T[]) =>
  values.length === 1
    ? Type.Literal(values[0] as T)
    : Type.Union(values.map((v) => Type.Literal(v)));

const variant = (type: TSchema, props: TProperties = {}) =>
  Type.Object({ type, ...fieldBase, ...props });

const count = () => Type.Optional(Type.Integer({ minimum: 0 }));

/**
 * 表單欄位，以 `type` 區分的 union。遞迴（`upload.extra`）用 `$id` 表示，
 * 輸出到 v0.json 時是 `#/$defs/FieldDef`。
 */
export const FieldDefSchema = Type.Recursive(
  (This) =>
    Type.Union([
      variant(literals('text'), { maxLength: count() }),
      variant(literals('textarea'), {
        rows: Type.Optional(Type.Integer({ minimum: 1 })),
        maxLength: count(),
      }),
      variant(literals('email')),
      variant(literals('url')),
      variant(literals('mobile')),
      variant(literals('password')),
      variant(literals('hidden')),
      variant(literals('display')),
      variant(literals('number'), {
        min: Type.Optional(Type.Number()),
        max: Type.Optional(Type.Number()),
        step: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
      }),
      variant(literals('decimal', 'currency'), {
        decimals: Type.Integer({ minimum: 0 }),
        symbol: Type.Optional(Type.String()),
        min: Type.Optional(Type.Number()),
        max: Type.Optional(Type.Number()),
      }),
      variant(literals('date', 'datetime', 'dateRange', 'datetimeRange')),
      variant(literals('select'), {
        options: Type.Array(OptionItemSchema),
        searchable: Type.Optional(Type.Boolean()),
        clearable: Type.Optional(Type.Boolean()),
      }),
      variant(literals('multipleSelect'), {
        options: Type.Array(OptionItemSchema),
        max: Type.Optional(Type.Integer({ minimum: 1 })),
      }),
      variant(literals('radio', 'checkbox'), {
        options: Type.Array(OptionSchema),
        orientation: Type.Optional(literals('horizontal', 'vertical')),
      }),
      variant(literals('switch'), {
        onLabel: Type.Optional(Type.String()),
        offLabel: Type.Optional(Type.String()),
      }),
      variant(literals('tags'), {
        options: Type.Optional(Type.Array(OptionSchema)),
        max: Type.Optional(Type.Integer({ minimum: 1 })),
        maxLength: count(),
      }),
      variant(literals('upload'), {
        kind: literals('image', 'file'),
        multiple: Type.Boolean(),
        accept: Type.Array(Type.String()),
        maxSize: Type.Integer({ minimum: 1 }),
        maxFiles: Type.Optional(Type.Integer({ minimum: 1 })),
        sortable: Type.Optional(Type.Boolean()),
        extra: Type.Optional(
          Type.Array(
            Type.Intersect([This, Type.Not(Type.Object({ type: Type.Literal('upload') }))]),
          ),
        ),
      }),
    ]),
  { $id: 'FieldDef' },
) as unknown as TSchema & { static: FieldDef };

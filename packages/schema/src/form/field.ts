import { type TProperties, type TRef, type TSchema, Type } from '@sinclair/typebox';
import { type ComponentRef, ComponentRefSchema } from '../component-ref';
import { type Option, OptionSchema } from '../protocol/display';
import { type OptionItem, OptionItemSchema } from '../protocol/options';
import {
  type Condition,
  ConditionSchema,
  type ExclusionPath,
  ExclusionPathSchema,
  type RemoteOptions,
  RemoteOptionsSchema,
} from './conditions';
import type { FormNode } from './layout';
import { type ClientRule, ClientRuleSchema } from './rules';

export { type ClientRule, ClientRuleSchema } from './rules';
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
  showWhen?: Condition;
  enableWhen?: Condition;
};

const fieldBase = {
  name: Type.String({ pattern: '^(?!_brume$).*$' }),
  label: Type.String(),
  help: Type.Optional(Type.String()),
  placeholder: Type.Optional(Type.String()),
  required: Type.Optional(Type.Boolean()),
  readOnly: Type.Optional(Type.Boolean()),
  disabled: Type.Optional(Type.Boolean()),
  span: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('full')])),
  width: Type.Optional(GridWidthSchema),
  rules: Type.Optional(Type.Array(ClientRuleSchema)),
  showWhen: Type.Optional(ConditionSchema),
  enableWhen: Type.Optional(ConditionSchema),
} satisfies TProperties;

export type PlainFieldDef = FieldBase & { remote?: never; excludeSelectedIn?: never } & (
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
  );

/** Form-only choices resolve through the adapter and a declared endpoint. */
export type RemoteChoiceFieldDef = FieldBase & {
  remote: RemoteOptions;
  options?: never;
  excludeSelectedIn?: ExclusionPath[];
} & (
    | { type: 'select'; searchable?: boolean; clearable?: boolean }
    | { type: 'multipleSelect'; max?: number }
  );

export type RelationFieldDef = FieldBase & {
  type: 'relation';
  multiple: boolean;
  remote: RemoteOptions;
  fields?: FormNode[];
  excludeSelectedIn?: ExclusionPath[];
};
export type RepeaterFieldDef = FieldBase & {
  type: 'repeater';
  mode: 'json' | 'relation';
  nodes: FormNode[];
  min?: number;
  max?: number;
  distinct?: string[];
  sortable?: boolean;
};
export type CustomFieldDef = FieldBase & {
  type: 'custom';
  component: ComponentRef;
  displayOnly?: boolean;
};
export type FieldDef =
  | PlainFieldDef
  | RemoteChoiceFieldDef
  | RelationFieldDef
  | RepeaterFieldDef
  | CustomFieldDef
  | (FieldBase & {
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
      extra?: PlainFieldDef[];
    });

const literals = <T extends string>(...values: T[]) =>
  values.length === 1
    ? Type.Literal(values[0] as T)
    : Type.Union(values.map((v) => Type.Literal(v)));

const variant = <T extends TSchema, P extends TProperties = Record<never, never>>(
  type: T,
  props: P = {} as P,
) => Type.Object({ type, ...fieldBase, ...props });

const staticVariant = <T extends TSchema, P extends TProperties = Record<never, never>>(
  type: T,
  props: P = {} as P,
) =>
  Type.Object(
    {
      type,
      ...fieldBase,
      ...props,
      remote: Type.Optional(Type.Never()),
      excludeSelectedIn: Type.Optional(Type.Never()),
    },
    { additionalProperties: false },
  );

const count = () => Type.Optional(Type.Integer({ minimum: 0 }));

/** 明列靜態扁平欄位，供 Action、quick-create 與 upload.extra 使用。 */
const plainFields = [
  staticVariant(literals('text'), { maxLength: count() }),
  staticVariant(literals('textarea'), {
    rows: Type.Optional(Type.Integer({ minimum: 1 })),
    maxLength: count(),
  }),
  staticVariant(literals('email')),
  staticVariant(literals('url')),
  staticVariant(literals('mobile')),
  staticVariant(literals('password')),
  staticVariant(literals('hidden')),
  staticVariant(literals('display')),
  staticVariant(literals('number'), {
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
    step: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
  }),
  staticVariant(literals('decimal', 'currency'), {
    decimals: Type.Integer({ minimum: 0 }),
    symbol: Type.Optional(Type.String()),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
  }),
  staticVariant(literals('date', 'datetime', 'dateRange', 'datetimeRange')),
  staticVariant(literals('select'), {
    options: Type.Array(OptionItemSchema),
    searchable: Type.Optional(Type.Boolean()),
    clearable: Type.Optional(Type.Boolean()),
  }),
  staticVariant(literals('multipleSelect'), {
    options: Type.Array(OptionItemSchema),
    max: Type.Optional(Type.Integer({ minimum: 1 })),
  }),
  staticVariant(literals('radio', 'checkbox'), {
    options: Type.Array(OptionSchema),
    orientation: Type.Optional(literals('horizontal', 'vertical')),
  }),
  staticVariant(literals('switch'), {
    onLabel: Type.Optional(Type.String()),
    offLabel: Type.Optional(Type.String()),
  }),
  staticVariant(literals('tags'), {
    options: Type.Optional(Type.Array(OptionSchema)),
    max: Type.Optional(Type.Integer({ minimum: 1 })),
    maxLength: count(),
  }),
] as const;

/**
 * 靜態扁平欄位，輸出到 v0.json 時是 `#/$defs/PlainFieldDef`。用於 `upload.extra`、
 * Action 的輸入欄位與快速新增，三者都不經過上傳流程。未轉型，供型別測試比對 `PlainFieldDef`。
 */
export const PlainFieldDefRaw = Type.Union([...plainFields], { $id: 'PlainFieldDef' });

export const PlainFieldDefSchema = PlainFieldDefRaw as unknown as TSchema & {
  static: PlainFieldDef;
};

/**
 * 表單欄位，以 `type` 區分的 union，輸出到 v0.json 時是 `#/$defs/FieldDef`：
 * 含靜態、遠端選項、關聯、repeater、custom 與 upload。`upload.extra` 引用 `PlainFieldDef`，
 * 推得的型別才會與 `FieldDef` 一致。未轉型，供型別測試比對 `FieldDef`。
 */
/** Type-only import avoids a runtime field/layout cycle; the sole wire target is FormNodeRaw. */
const formNodeRef = Type.Ref('FormNode') as TRef & { static: FormNode };

export const FieldDefRaw = Type.Union(
  [
    PlainFieldDefRaw,
    variant(literals('select'), {
      remote: RemoteOptionsSchema,
      options: Type.Optional(Type.Never()),
      searchable: Type.Optional(Type.Boolean()),
      clearable: Type.Optional(Type.Boolean()),
      excludeSelectedIn: Type.Optional(Type.Array(ExclusionPathSchema)),
    }),
    variant(literals('multipleSelect'), {
      remote: RemoteOptionsSchema,
      options: Type.Optional(Type.Never()),
      max: Type.Optional(Type.Integer({ minimum: 1 })),
      excludeSelectedIn: Type.Optional(Type.Array(ExclusionPathSchema)),
    }),
    variant(literals('relation'), {
      multiple: Type.Boolean(),
      remote: RemoteOptionsSchema,
      fields: Type.Optional(Type.Array(formNodeRef)),
      excludeSelectedIn: Type.Optional(Type.Array(ExclusionPathSchema)),
    }),
    variant(literals('repeater'), {
      mode: literals('json', 'relation'),
      nodes: Type.Array(formNodeRef),
      min: count(),
      max: count(),
      distinct: Type.Optional(Type.Array(Type.String())),
      sortable: Type.Optional(Type.Boolean()),
    }),
    variant(literals('custom'), {
      component: ComponentRefSchema,
      displayOnly: Type.Optional(Type.Boolean()),
    }),
    variant(literals('upload'), {
      kind: literals('image', 'file'),
      multiple: Type.Boolean(),
      accept: Type.Array(Type.String()),
      maxSize: Type.Integer({ minimum: 1 }),
      maxFiles: Type.Optional(Type.Integer({ minimum: 1 })),
      sortable: Type.Optional(Type.Boolean()),
      extra: Type.Optional(Type.Array(PlainFieldDefRaw)),
    }),
  ],
  { $id: 'FieldDef' },
);

export const FieldDefSchema = FieldDefRaw as unknown as TSchema & { static: FieldDef };

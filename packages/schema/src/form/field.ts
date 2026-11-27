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
  /** Authoritative new-owner fallback; does not initialize or overwrite the editable draft. */
  defaultValue?: unknown;
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
  defaultValue: Type.Optional(Type.Unknown()),
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
    | { type: 'color'; alpha?: boolean; swatches?: string[] }
    | { type: 'tel' }
    | { type: 'ip'; version?: 4 | 6 }
    | { type: 'rate'; decimals: number; min?: number; max?: number }
    | { type: 'slider'; min: number; max: number; step: number }
    | { type: 'icon'; icons?: string[] }
    | { type: 'time'; seconds?: boolean }
    | { type: 'range'; decimals: number }
    | { type: 'timeRange'; seconds?: boolean }
    /** 靜態建議；建議不限制輸入值，值與 `text` 相同（`string | null`） */
    | { type: 'autocomplete'; options?: string[]; minLength?: number; maxLength?: number }
  );

/** Form-only choices resolve through the adapter and a declared endpoint. */
export type RemoteChoiceFieldDef = FieldBase & {
  remote: RemoteOptions;
  options?: never;
  excludeSelectedIn?: ExclusionPath[];
} & (
    | { type: 'select'; searchable?: boolean; clearable?: boolean }
    | { type: 'multipleSelect'; max?: number; appearance?: never }
    | { type: 'tags'; max?: number; maxLength?: number }
  );

/** `autocomplete` 的遠端建議；建議不限制輸入值。 */
export type RemoteAutocompleteFieldDef = FieldBase & {
  type: 'autocomplete';
  remote: RemoteOptions;
  options?: never;
  minLength?: number;
  maxLength?: number;
};

/** `multipleSelect` 的 listbox 外觀，只接受靜態選項（不是 PlainFieldDef）。 */
export type ListboxFieldDef = FieldBase & {
  type: 'multipleSelect';
  appearance?: 'listbox';
  options: OptionItem[];
  max?: number;
  remote?: never;
  excludeSelectedIn?: never;
};

/** 扁平、深度優先的樹節點；`depth` 0 為根。 */
export type TreeOption = { value: string; label: string; depth: number; disabled?: boolean };

/** Form-only static choices may exclude siblings; flat inputs stay closed. */
type ExclusiveChoice<T> = T extends unknown
  ? Omit<T, 'excludeSelectedIn'> & { excludeSelectedIn?: ExclusionPath[] }
  : never;
export type ExclusiveChoiceFieldDef = ExclusiveChoice<
  Extract<PlainFieldDef, { type: 'select' | 'multipleSelect' | 'tags' | 'radio' | 'checkbox' }>
>;

export type RelationFieldDef = FieldBase & {
  type: 'relation';
  /** Selected-owner authority is available through the declared options endpoint. */
  hydrateAuthority?: true;
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
  /** 省略時為 `'stack'` */
  layout?: 'stack' | 'table';
};
export type CustomFieldDef = FieldBase & {
  type: 'custom';
  component: ComponentRef;
  displayOnly?: boolean;
};
/** Form-page only: the typed answer is validated server-side and never saved. */
export type CaptchaFieldDef = FieldBase & { type: 'captcha'; src: string };
export type FieldDef =
  | Exclude<PlainFieldDef, { type: 'select' | 'multipleSelect' | 'tags' | 'radio' | 'checkbox' }>
  | RemoteChoiceFieldDef
  | RemoteAutocompleteFieldDef
  | ListboxFieldDef
  | ExclusiveChoiceFieldDef
  | RelationFieldDef
  | RepeaterFieldDef
  | CustomFieldDef
  | CaptchaFieldDef
  /** 值是 `{ key, value }[]`（保序的配對） */
  | (FieldBase & {
      type: 'keyValue';
      keyLabel?: string;
      valueLabel?: string;
      max?: number;
    })
  /** 值是 `string[]`，順序保留，可重複 */
  | (FieldBase & {
      type: 'list';
      min?: number;
      max?: number;
      maxLength?: number;
      sortable?: boolean;
    })
  /** 值是節點 id 的 `string[]` */
  | (FieldBase & {
      type: 'tree';
      options: TreeOption[];
      mode: 'leaves' | 'all' | 'independent';
      expanded?: boolean;
    })
  | (FieldBase & {
      type: 'richText';
      /** px，整數 120–2000；省略時由 renderer 決定（預設 500） */
      height?: number;
      /** 編輯 iframe 與唯讀檢視載入的樣式表網址 */
      contentCss?: string[];
      /** 省略表示不開放圖片上傳；`maxSize` 為 bytes */
      images?: { accept: string[]; maxSize: number };
    })
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

/** Canonical lowercase hex: `#rrggbb`, or `#rrggbbaa`. */
const HEX_COLOR_PATTERN = '^#[0-9a-f]{6}(?:[0-9a-f]{2})?$';

/** Lucide icon name in kebab-case. */
const ICON_NAME_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';

/** Wire limits shared with the PHP side. */
const AUTOCOMPLETE_MAX_OPTIONS = 500;
const TREE_MAX_OPTIONS = 2000;
const TREE_MAX_DEPTH = 20;
const KEY_VALUE_MAX_PAIRS = 200;
const LIST_MAX_ITEMS = 500;

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
  // Appended last: entries 11, 12, 13 and 15 are referenced by index in FieldDefRaw.
  staticVariant(literals('color'), {
    alpha: Type.Optional(Type.Boolean()),
    swatches: Type.Optional(
      Type.Array(Type.String({ pattern: HEX_COLOR_PATTERN }), { maxItems: 24 }),
    ),
  }),
  staticVariant(literals('tel')),
  staticVariant(literals('ip'), {
    version: Type.Optional(Type.Union([Type.Literal(4), Type.Literal(6)])),
  }),
  staticVariant(literals('rate'), {
    decimals: Type.Integer({ minimum: 0 }),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
  }),
  staticVariant(literals('slider'), {
    min: Type.Number(),
    max: Type.Number(),
    step: Type.Number({ exclusiveMinimum: 0 }),
  }),
  staticVariant(literals('icon'), {
    icons: Type.Optional(
      Type.Array(Type.String({ pattern: ICON_NAME_PATTERN, maxLength: 64 }), { maxItems: 200 }),
    ),
  }),
  staticVariant(literals('time'), { seconds: Type.Optional(Type.Boolean()) }),
  staticVariant(literals('range'), { decimals: Type.Integer({ minimum: 0 }) }),
  staticVariant(literals('timeRange'), { seconds: Type.Optional(Type.Boolean()) }),
  staticVariant(literals('autocomplete'), {
    options: Type.Optional(Type.Array(Type.String(), { maxItems: AUTOCOMPLETE_MAX_OPTIONS })),
    minLength: count(),
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

const exclusiveVariant = <P extends TProperties>(schema: { properties: P }) => {
  const { excludeSelectedIn: _excluded, ...properties } = schema.properties;
  return Type.Object(
    { ...properties, excludeSelectedIn: Type.Optional(Type.Array(ExclusionPathSchema)) },
    { additionalProperties: false },
  );
};

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
      appearance: Type.Optional(Type.Never()),
      excludeSelectedIn: Type.Optional(Type.Array(ExclusionPathSchema)),
    }),
    variant(literals('tags'), {
      remote: RemoteOptionsSchema,
      options: Type.Optional(Type.Never()),
      max: Type.Optional(Type.Integer({ minimum: 1 })),
      maxLength: count(),
      excludeSelectedIn: Type.Optional(Type.Array(ExclusionPathSchema)),
    }),
    variant(literals('autocomplete'), {
      remote: RemoteOptionsSchema,
      options: Type.Optional(Type.Never()),
      minLength: count(),
      maxLength: count(),
    }),
    Type.Object(
      {
        type: Type.Literal('multipleSelect'),
        ...fieldBase,
        appearance: Type.Optional(Type.Literal('listbox')),
        options: Type.Array(OptionItemSchema),
        max: Type.Optional(Type.Integer({ minimum: 1 })),
        remote: Type.Optional(Type.Never()),
        excludeSelectedIn: Type.Optional(Type.Never()),
      },
      { additionalProperties: false },
    ),
    exclusiveVariant(plainFields[11]),
    exclusiveVariant(plainFields[12]),
    exclusiveVariant(plainFields[13]),
    exclusiveVariant(plainFields[15]),
    variant(literals('relation'), {
      hydrateAuthority: Type.Optional(Type.Literal(true)),
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
      layout: Type.Optional(literals('stack', 'table')),
    }),
    variant(literals('custom'), {
      component: ComponentRefSchema,
      displayOnly: Type.Optional(Type.Boolean()),
    }),
    variant(literals('captcha'), { src: Type.String() }),
    variant(literals('keyValue'), {
      keyLabel: Type.Optional(Type.String()),
      valueLabel: Type.Optional(Type.String()),
      max: Type.Optional(Type.Integer({ minimum: 1, maximum: KEY_VALUE_MAX_PAIRS })),
    }),
    variant(literals('list'), {
      min: count(),
      max: Type.Optional(Type.Integer({ minimum: 0, maximum: LIST_MAX_ITEMS })),
      maxLength: Type.Optional(Type.Integer({ minimum: 1 })),
      sortable: Type.Optional(Type.Boolean()),
    }),
    variant(literals('tree'), {
      options: Type.Array(
        Type.Object({
          value: Type.String(),
          label: Type.String(),
          depth: Type.Integer({ minimum: 0, maximum: TREE_MAX_DEPTH }),
          disabled: Type.Optional(Type.Boolean()),
        }),
        { maxItems: TREE_MAX_OPTIONS },
      ),
      mode: literals('leaves', 'all', 'independent'),
      expanded: Type.Optional(Type.Boolean()),
    }),
    variant(literals('richText'), {
      height: Type.Optional(Type.Integer({ minimum: 120, maximum: 2000 })),
      contentCss: Type.Optional(Type.Array(Type.String())),
      images: Type.Optional(
        Type.Object({
          accept: Type.Array(Type.String()),
          maxSize: Type.Integer({ minimum: 1 }),
        }),
      ),
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

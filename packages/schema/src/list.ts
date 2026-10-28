import { type Static, Type } from '@sinclair/typebox';
import { ActionDefSchema } from './protocol/action';
import { CellContentSchema, DisplaySchema, InlineEditorSchema } from './protocol/display';
import {
  AppliedFilterSchema,
  FilterDefSchema,
  FilterPanelSchema,
  FilterValueSchema,
  ScopeDefSchema,
  SelectorDefSchema,
} from './protocol/filter';

export const ListColumnSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  numeric: Type.Optional(Type.Boolean()),
  width: Type.Optional(Type.String()),
  display: Type.Optional(DisplaySchema),
  editor: Type.Optional(InlineEditorSchema),
  sortable: Type.Optional(Type.Boolean()),
  /** placement 為 column 的 FilterDef.key */
  filter: Type.Optional(Type.String()),
  /** 預設 true */
  hideable: Type.Optional(Type.Boolean()),
  hiddenByDefault: Type.Optional(Type.Boolean()),
  /** 點擊開啟編輯 */
  primary: Type.Optional(Type.Boolean()),
});
export type ListColumn = Static<typeof ListColumnSchema>;

export const RowMetaSchema = Type.Object({
  editUrl: Type.Optional(Type.String()),
  /** 這一列允許的 row action keys；省略 = 全部 */
  actions: Type.Optional(Type.Array(Type.String())),
  href: Type.Optional(Type.Record(Type.String(), Type.String())),
  content: Type.Optional(Type.Record(Type.String(), CellContentSchema)),
  raw: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type RowMeta = Static<typeof RowMetaSchema>;

export const GridRowSchema = Type.Intersect([
  Type.Object({
    id: Type.Union([Type.String(), Type.Number()]),
    _meta: Type.Optional(RowMetaSchema),
  }),
  Type.Record(Type.String(), Type.Unknown()),
]);
export type GridRow = Static<typeof GridRowSchema>;

const LinkSchema = Type.Object({ label: Type.String(), url: Type.String() });

export const ListPageSchema = Type.Object({
  type: Type.Literal('list'),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  gridId: Type.String(),
  columns: Type.Array(ListColumnSchema),
  rows: Type.Array(GridRowSchema),
  pagination: Type.Object({
    page: Type.Integer({ minimum: 1 }),
    perPage: Type.Integer({ minimum: 1 }),
    total: Type.Integer({ minimum: 0 }),
    lastPage: Type.Integer({ minimum: 1 }),
  }),
  query: Type.Object({
    sort: Type.Optional(
      Type.Object({
        key: Type.String(),
        direction: Type.Union([Type.Literal('asc'), Type.Literal('desc')]),
      }),
    ),
    q: Type.Optional(Type.String()),
    scope: Type.Optional(Type.String()),
    perPage: Type.Integer({ minimum: 1 }),
    filters: Type.Record(Type.String(), FilterValueSchema),
  }),
  perPageOptions: Type.Array(Type.Integer({ minimum: 1 })),
  quickSearch: Type.Optional(Type.Object({ placeholder: Type.Optional(Type.String()) })),
  filters: Type.Optional(FilterPanelSchema),
  columnFilters: Type.Optional(Type.Array(FilterDefSchema)),
  selectors: Type.Optional(Type.Array(SelectorDefSchema)),
  scopes: Type.Optional(Type.Array(ScopeDefSchema)),
  appliedFilters: Type.Array(AppliedFilterSchema),
  actions: Type.Object({
    row: Type.Array(ActionDefSchema),
    batch: Type.Array(ActionDefSchema),
    tools: Type.Array(ActionDefSchema),
  }),
  /** GET；前端附加目前的 query 和 export_scope */
  export: Type.Optional(Type.Object({ url: Type.String() })),
  endpoints: Type.Optional(
    Type.Object({
      /** 含 `{action}` */
      action: Type.Optional(Type.String()),
      /** 含 `{id}` */
      cell: Type.Optional(Type.String()),
      /** 含 `{source}`；挑選器搜尋也用它，多帶 `section` 參數 */
      options: Type.Optional(Type.String()),
      /** POST multipart 暫存上傳（`UploadTempResponse`），沒有佔位字 */
      upload: Type.Optional(Type.String()),
    }),
  ),
  empty: Type.Optional(
    Type.Object({
      title: Type.String(),
      description: Type.String(),
      action: Type.Optional(LinkSchema),
    }),
  ),
});
export type ListPage = Static<typeof ListPageSchema>;

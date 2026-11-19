import { type Static, Type } from '@sinclair/typebox';
import { FeedbackSchema, IdSchema } from './http';

/**
 * POST endpoints.reorder（tree 與 list 模式皆可）：移動單一項目。
 * `before` 與 `after` 至多一個，都沒有 = 排到（新）同層最後；互斥由伺服器端驗證，schema 不檢查。
 * 違反規則（循環、超過 maxDepth、項目已不存在）回 409，body 為 `ErrorResponse`。
 */
export const ReorderMoveRequestSchema = Type.Object({
  id: IdSchema,
  /** 新的父項目；null = 頂層；省略 = 不變（list 模式一律省略） */
  parent: Type.Optional(Type.Union([IdSchema, Type.Null()])),
  before: Type.Optional(IdSchema),
  after: Type.Optional(IdSchema),
});
export type ReorderMoveRequest = Static<typeof ReorderMoveRequestSchema>;

/** POST endpoints.reorder：整批依序重排，只限 list 模式。 */
export const ReorderListRequestSchema = Type.Object({ ids: Type.Array(IdSchema) });
export type ReorderListRequest = Static<typeof ReorderListRequestSchema>;

/** 移動成功的回應；`undo` 是把項目移回原位的 `ReorderMoveRequest`。 */
export const ReorderResponseSchema = Type.Object({
  undo: Type.Optional(ReorderMoveRequestSchema),
  feedback: Type.Optional(FeedbackSchema),
});
export type ReorderResponse = Static<typeof ReorderResponseSchema>;

/** GET endpoints.reorder：全部項目（不分頁），供排序對話框使用。 */
export const ReorderItemsResponseSchema = Type.Object({
  items: Type.Array(Type.Object({ id: IdSchema, label: Type.String() })),
});
export type ReorderItemsResponse = Static<typeof ReorderItemsResponseSchema>;

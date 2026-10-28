import { type Static, Type } from '@sinclair/typebox';
import { GridRowSchema } from '../list';

export const ToastTypeSchema = Type.Union([
  Type.Literal('success'),
  Type.Literal('error'),
  Type.Literal('info'),
  Type.Literal('warning'),
]);
export type ToastType = Static<typeof ToastTypeSchema>;

/** 伺服器對 Action 或行內編輯的回饋。前端順序：toast、download，redirect 優先於 refresh。 */
export const FeedbackSchema = Type.Object({
  toast: Type.Optional(Type.Object({ type: ToastTypeSchema, message: Type.String() })),
  refresh: Type.Optional(Type.Boolean()),
  redirect: Type.Optional(Type.String()),
  download: Type.Optional(
    Type.Object({ url: Type.String(), filename: Type.Optional(Type.String()) }),
  ),
});
export type Feedback = Static<typeof FeedbackSchema>;

const IdSchema = Type.Union([Type.String(), Type.Number()]);

/** POST endpoints.action */
export const ActionRequestSchema = Type.Object({
  target: Type.Union([Type.Literal('row'), Type.Literal('batch'), Type.Literal('tool')]),
  ids: Type.Array(IdSchema),
});
export type ActionRequest = Static<typeof ActionRequestSchema>;

export const ActionResponseSchema = Type.Object({ feedback: FeedbackSchema });
export type ActionResponse = Static<typeof ActionResponseSchema>;

/** PATCH endpoints.cell */
export const CellUpdateRequestSchema = Type.Object({
  column: Type.String(),
  value: Type.Unknown(),
});
export type CellUpdateRequest = Static<typeof CellUpdateRequestSchema>;

export const CellUpdateResponseSchema = Type.Object({
  row: GridRowSchema,
  feedback: Type.Optional(FeedbackSchema),
});
export type CellUpdateResponse = Static<typeof CellUpdateResponseSchema>;

/** 4xx / 5xx，與 Laravel 預設 JSON 錯誤相容。 */
export const ErrorResponseSchema = Type.Object({
  message: Type.String(),
  errors: Type.Optional(Type.Record(Type.String(), Type.Array(Type.String()))),
});
export type ErrorResponse = Static<typeof ErrorResponseSchema>;

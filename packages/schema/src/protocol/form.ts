import { type Static, Type } from '@sinclair/typebox';
import { AfterSaveSchema } from '../form/form-page';
import { FeedbackSchema, IdSchema } from './http';

/**
 * 彈窗取得表單時帶的請求標頭，值固定為 `'1'`。伺服器回 `PageEnvelope`（`page.type === 'form'`），
 * 並帶 `Vary: X-Brume-Form`。
 */
export const FORM_HEADER = 'X-Brume-Form';

/** POST（新增）或 PUT（更新）`page.submit.url`；快速新增 POST `quickCreate.submitUrl`。 */
export const FormSubmitRequestSchema = Type.Object({
  /** 巢狀的表單值，格式見 docs/forms.md */
  values: Type.Record(Type.String(), Type.Unknown()),
  /** 使用者選的儲存後去向 */
  after: Type.Optional(AfterSaveSchema),
});
export type FormSubmitRequest = Static<typeof FormSubmitRequestSchema>;

/** 200。儲存後去向由前端依 `after` 和 `urls` 決定，`feedback.redirect` 存在時以它為準。 */
export const FormSubmitResponseSchema = Type.Object({
  id: IdSchema,
  feedback: Type.Optional(FeedbackSchema),
  urls: Type.Object({
    list: Type.Optional(Type.String()),
    edit: Type.String(),
    create: Type.Optional(Type.String()),
    view: Type.Optional(Type.String()),
  }),
});
export type FormSubmitResponse = Static<typeof FormSubmitResponseSchema>;

import { type Static, Type } from '@sinclair/typebox';
import { PlainFieldDefSchema } from '../form/field';

export const ActionDefSchema = Type.Object({
  key: Type.String(),
  label: Type.String(),
  /** lucide 圖示名稱，kebab-case */
  icon: Type.Optional(Type.String()),
  tone: Type.Optional(Type.Union([Type.Literal('default'), Type.Literal('danger')])),
  confirm: Type.Optional(
    Type.Object({
      title: Type.String(),
      description: Type.Optional(Type.String()),
      confirmLabel: Type.String(),
    }),
  ),
  /** 單一字元，或 'Enter' | 'Delete' | 'Backspace' */
  shortcut: Type.Optional(Type.String()),
  exposed: Type.Optional(Type.Boolean()),
  /** 執行前先開彈窗收集輸入，值放在 `ActionRequest.input`。欄位不可含 upload。 */
  form: Type.Optional(
    Type.Object({
      title: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      fields: Type.Array(PlainFieldDefSchema),
      submitLabel: Type.Optional(Type.String()),
    }),
  ),
});
export type ActionDef = Static<typeof ActionDefSchema>;

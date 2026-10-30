import { type Static, Type } from '@sinclair/typebox';

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
  /** `minLength`、`maxLength` 以 Unicode code point 計算；`maxFiles` 用於多檔上傳 */
  Type.Object({
    rule: Type.Union([
      Type.Literal('minLength'),
      Type.Literal('maxLength'),
      Type.Literal('maxFiles'),
    ]),
    /** 整數，≥ 0 */
    value: Type.Integer({ minimum: 0 }),
    message: Type.String(),
  }),
  Type.Object({
    rule: Type.Union([Type.Literal('min'), Type.Literal('max')]),
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

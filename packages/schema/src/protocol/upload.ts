import { type Static, Type } from '@sinclair/typebox';

const ExtraSchema = Type.Optional(Type.Record(Type.String(), Type.Unknown()));

/** POST multipart（`file`、`field`）到 `endpoints.upload` 暫存上傳。 */
export const UploadTempResponseSchema = Type.Object({
  token: Type.String(),
  name: Type.String(),
  size: Type.Integer({ minimum: 0 }),
  mime: Type.String(),
  previewUrl: Type.Optional(Type.String()),
  expiresAt: Type.String(),
});
export type UploadTempResponse = Static<typeof UploadTempResponseSchema>;

/**
 * 剛上傳（token）或已歸檔（path + url）。兩種形狀互斥（不允許其他屬性），
 * 所以 `{ token, path, url }` 兩種都不符合，前端可以只看形狀分辨。
 */
export const UploadValueSchema = Type.Union([
  Type.Object({ token: Type.String(), extra: ExtraSchema }, { additionalProperties: false }),
  Type.Object(
    {
      path: Type.String(),
      url: Type.String(),
      name: Type.Optional(Type.String()),
      size: Type.Optional(Type.Integer({ minimum: 0 })),
      extra: ExtraSchema,
    },
    { additionalProperties: false },
  ),
]);
export type UploadValue = Static<typeof UploadValueSchema>;

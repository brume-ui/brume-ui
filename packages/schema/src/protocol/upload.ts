import { type Static, Type } from '@sinclair/typebox';

const ExtraSchema = Type.Optional(Type.Record(Type.String(), Type.Unknown()));

/** POST multipart（file、field）暫存上傳。 */
export const UploadTempResponseSchema = Type.Object({
  token: Type.String(),
  name: Type.String(),
  size: Type.Integer({ minimum: 0 }),
  mime: Type.String(),
  previewUrl: Type.Optional(Type.String()),
  expiresAt: Type.String(),
});
export type UploadTempResponse = Static<typeof UploadTempResponseSchema>;

/** 剛上傳（token）或已歸檔（path + url）。 */
export const UploadValueSchema = Type.Union([
  Type.Object({ token: Type.String(), extra: ExtraSchema }),
  Type.Object({
    path: Type.String(),
    url: Type.String(),
    name: Type.Optional(Type.String()),
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    extra: ExtraSchema,
  }),
]);
export type UploadValue = Static<typeof UploadValueSchema>;

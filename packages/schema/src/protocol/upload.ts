import { type Static, Type } from '@sinclair/typebox';

const ExtraSchema = Type.Optional(Type.Record(Type.String(), Type.Unknown()));

/** 暫存上傳的 multipart 欄位名稱（POST `page.uploadUrl` 或 `endpoints.upload`）。 */
export const UPLOAD_PARAMS = {
  file: 'file',
  /** 欄位的完整值路徑，例如 `images` 或 `gallery.cover` */
  field: 'field',
  /** JSON-encoded RowContext: canonical repeater paths and stable identities. */
  rowContext: 'rowContext',
  /** JSON-encoded OptionAncestorSourceContext[] for declared picker ancestors. */
  ancestorSources: 'ancestorSources',
} as const;

/** POST multipart（`UPLOAD_PARAMS`）到 `page.uploadUrl` 或 `endpoints.upload` 暫存上傳。 */
export const UploadTempResponseSchema = Type.Object({
  token: Type.String(),
  name: Type.String(),
  size: Type.Integer({ minimum: 0 }),
  mime: Type.String(),
  previewUrl: Type.Optional(Type.String()),
  /** ISO 8601 UTC，例如 `2026-10-29T03:00:00Z` */
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

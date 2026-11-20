import { type Static, Type } from '@sinclair/typebox';

/** 富文字圖片上傳（POST `page.uploadUrl`，參數同 `UPLOAD_PARAMS`）成功的回應；`url` 直接寫進 HTML 的 `<img src>`。 */
export const RichTextImageResponseSchema = Type.Object({
  url: Type.String(),
  name: Type.Optional(Type.String()),
});
export type RichTextImageResponse = Static<typeof RichTextImageResponseSchema>;

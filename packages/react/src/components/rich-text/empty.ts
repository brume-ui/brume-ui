/**
 * True when the HTML carries no content. Rule (the Laravel side must implement the exact same rule):
 *
 *   Empty when, after removing HTML comments (`<!-- ... -->`), there is no text other than
 *   whitespace / `&nbsp;` (U+00A0) and no element among
 *   img, iframe, hr, table, input, video, audio, svg, object, embed.
 *
 * Text means the characters outside tags; the entity `&nbsp;` counts as whitespace. `null`,
 * `undefined` and `''` are empty.
 */
const MEDIA_TAG = /<(img|iframe|hr|table|input|video|audio|svg|object|embed)(?=[\s/>])/i;

export function isEmptyHtml(html: string | null | undefined): boolean {
  if (html == null) return true;
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  if (MEDIA_TAG.test(noComments)) return false;
  const text = noComments
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\s\u00a0]+/g, '');
  return text === '';
}

/**
 * Whether clipboard HTML is nothing but one image (what a browser or an image viewer puts next to the
 * file). Office apps put a whole HTML rendering (tables, text) next to a PNG preview: that HTML wins.
 */
export function isSingleImageHtml(html: string): boolean {
  const s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1\s*>/gi, '');
  if ((s.match(/<img\b/gi) ?? []).length !== 1) return false;
  return (
    s
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;|\s/gi, '') === ''
  );
}

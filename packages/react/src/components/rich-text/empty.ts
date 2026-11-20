/**
 * True when the HTML carries no content. The rule below is exact; the Laravel side implements the same steps.
 *
 *   null, undefined and '' are empty. Otherwise:
 *   a. Remove HTML comments (`<!--` ... `-->`, shortest match).
 *   b. If the remaining string contains `<` immediately followed (case-insensitive) by one of
 *      img, iframe, hr, table, input, video, audio, svg, object, embed, and then by whitespace
 *      (space, tab, LF, CR, FF), `/` or `>`, it is NOT empty.
 *   c. Remove tags matching `<[a-zA-Z/!?][^>]*>` (so a raw `<` followed by a space or digit,
 *      as in `<p>< 5</p>`, stays as text).
 *   d. Remove the whitespace set: ASCII space, \t, \n, \r, \f, \v, the character U+00A0, and the
 *      entities `&nbsp;` (lowercase only), `&#160;`, `&#xA0;` / `&#xa0;` (`x` either case, hex digits either case).
 *   e. Empty iff nothing remains. Nothing else is whitespace: U+FEFF, U+200B, U+2028, `&ensp;`, `&NBSP;`
 *      count as content (not empty), the safe direction. `\s` is not used (it is Unicode-aware in JS).
 */
const MEDIA_TAG = /<(?:img|iframe|hr|table|input|video|audio|svg|object|embed)[ \t\n\r\f/>]/i;
const WHITESPACE = /[ \t\n\r\f\v ]|&nbsp;|&#160;|&#[xX][aA]0;/g;

export function isEmptyHtml(html: string | null | undefined): boolean {
  if (html == null) return true;
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  if (MEDIA_TAG.test(noComments)) return false;
  return noComments.replace(/<[a-zA-Z/!?][^>]*>/g, '').replace(WHITESPACE, '') === '';
}

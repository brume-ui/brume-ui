/**
 * Canonical colour text: trimmed, leading `#`, 3 digits expanded to 6 (and 4 to 8 when `alpha`),
 * lowercase. Returns null for anything else, including 8 digits on a field without alpha.
 */
export function normalizeHex(input: string, alpha: boolean): string | null {
  const body = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(body)) return null;
  const lengths = alpha ? [3, 4, 6, 8] : [3, 6];
  if (!lengths.includes(body.length)) return null;
  const full =
    body.length <= 4
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  return `#${full.toLowerCase()}`;
}

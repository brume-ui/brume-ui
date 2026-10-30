/** The wire value of `text` (digits, one point, maybe a leading minus): no leading zeros, no bare point. */
export function decimalToWire(text: string, decimals: number | undefined, pad: boolean): string {
  if (!/\d/.test(text)) return '';
  const negative = text.startsWith('-');
  const [rawInt = '', rawFrac = ''] = (negative ? text.slice(1) : text).split('.');
  const int = rawInt.replace(/^0+(?=\d)/, '') || '0';
  const frac = pad && decimals !== undefined ? rawFrac.padEnd(decimals, '0') : rawFrac;
  const out = frac ? `${int}.${frac}` : int;
  return negative && /[1-9]/.test(out) ? `-${out}` : out;
}

/** `text` (a wire-shaped number) rounded half away from zero to `decimals`, in string arithmetic. */
export function roundDecimal(text: string, decimals: number): string {
  const negative = text.startsWith('-');
  const [int = '', frac = ''] = (negative ? text.slice(1) : text).split('.');
  if (frac.length <= decimals) return text;
  const digits = (int + frac.slice(0, decimals)).split('').map(Number);
  if (Number(frac[decimals]) >= 5) {
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === 9) digits[i--] = 0;
    if (i >= 0) digits[i] = (digits[i] ?? 0) + 1;
    else digits.unshift(1);
  }
  const all = digits.join('');
  const head = all.slice(0, all.length - decimals) || '0';
  const out = decimals > 0 ? `${head}.${all.slice(all.length - decimals)}` : head;
  return negative ? `-${out}` : out;
}

/** Exact fixed-decimal wire canonicalization; null means invalid, '' means empty.
 * Rounds half away from zero using digits only, folds negative zero, and pads fractions.
 * No trimming, grouping, exponents or number coercion: callers decide their input contract.
 */
export function canonicalDecimal(value: string, decimals: number): string | null {
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error('Invalid decimal precision');
  if (value === '') return '';
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  return decimalToWire(roundDecimal(value, decimals), decimals, true);
}

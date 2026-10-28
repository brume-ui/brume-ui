/** Chart data model, stacking, colour slots and formatting (pure, no React). */

/** One row of chart data: a category / x value plus one numeric field per series. */
export type ChartDatum = Record<string, unknown>;

export interface ChartSeries {
  /** Field of each datum that holds this series' value. */
  key: string;
  /** Shown in the legend, tooltip and data table. */
  label: string;
  /**
   * Categorical colour slot 1–8 (`--br-chart-<n>`). Defaults to the series' position, so a
   * series keeps its colour when others are hidden. Past 8 there is no new hue: fold the tail
   * into "Other" instead.
   */
  color?: number;
}

/** A JSON-friendly formatter (Intl options, so PHP can send it) or a function. */
export type ValueFormat = Intl.NumberFormatOptions | ((value: number) => string);

const SLOTS = 8;

/** CSS colour of a series: its fixed categorical slot, or the muted "Other" grey past slot 8. */
export function seriesColor(series: Pick<ChartSeries, 'color'>, index: number): string {
  const slot = series.color ?? index + 1;
  return Number.isInteger(slot) && slot >= 1 && slot <= SLOTS
    ? `var(--br-chart-${slot})`
    : 'var(--br-chart-muted)';
}

/** Numeric value of a field; null for missing / non-numeric (drawn as a gap, listed as "—"). */
export function readValue(datum: ChartDatum | undefined, key: string): number | null {
  return toNumber(datum?.[key]);
}

/**
 * A number from a number or numeric string (PHP/PDO sends DECIMAL sums as strings); null for
 * anything else.
 */
export function toNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

export type Extent = [number, number];

/**
 * Stacked extents per datum per series key. Positives stack upward from 0 and negatives
 * downward, each in series order, so a mixed-sign stack never overlaps itself. Missing values
 * get no extent.
 */
export function stackData(
  data: readonly ChartDatum[],
  keys: readonly string[],
): Array<Record<string, Extent | undefined>> {
  return data.map((datum) => {
    let up = 0;
    let down = 0;
    const out: Record<string, Extent | undefined> = {};
    for (const key of keys) {
      const v = readValue(datum, key);
      if (v === null) continue;
      if (v >= 0) {
        out[key] = [up, up + v];
        up += v;
      } else {
        out[key] = [down + v, down];
        down += v;
      }
    }
    return out;
  });
}

/** [min, max] of the values a chart must show (stack totals when stacked). */
export function valueExtent(
  data: readonly ChartDatum[],
  keys: readonly string[],
  stacked = false,
): Extent {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  if (stacked) {
    for (const row of stackData(data, keys)) {
      for (const key of keys) {
        const e = row[key];
        if (!e) continue;
        min = Math.min(min, e[0]);
        max = Math.max(max, e[1]);
      }
    }
  } else {
    for (const datum of data) {
      for (const key of keys) {
        const v = readValue(datum, key);
        if (v === null) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  return Number.isFinite(min) ? [min, max] : [0, 0];
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${locale}|${JSON.stringify(options)}`;
  let f = formatterCache.get(id);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formatterCache.set(id, f);
  }
  return f;
}

/** Turns a `ValueFormat` into a function, falling back to `fallback` options. */
export function makeFormatter(
  locale: string,
  format: ValueFormat | undefined,
  fallback: Intl.NumberFormatOptions = {},
): (value: number) => string {
  if (typeof format === 'function') return format;
  const f = numberFormat(locale, format ?? fallback);
  return (value) => f.format(value);
}

/** True when `label` (from `f`) shows `value` exactly, only scaled by a power of ten (萬, K, %). */
function isExact(f: Intl.NumberFormat, value: number): boolean {
  if (value === 0) return true;
  let digits = '';
  for (const part of f.formatToParts(value)) {
    if (part.type === 'integer' || part.type === 'fraction') digits += part.value;
    else if (part.type === 'decimal') digits += '.';
  }
  const shown = Number(digits);
  if (!shown) return false;
  const exponent = Math.log10(Math.abs(value) / shown);
  return Math.abs(exponent - Math.round(exponent)) < 1e-9;
}

/**
 * Axis labels for `ticks`: compact from 1,000 up (1.2K, 1.25萬) in the locale, keeping a currency
 * or percent style. The fraction digits come from the ticks themselves: the fewest (0–3) that show
 * every tick exactly, so 12,500 never reads 「1.3萬」 and two ticks never share a label. Falls back
 * to the full number when no compact form is exact.
 */
export function axisFormatter(
  locale: string,
  format: ValueFormat | undefined,
  ticks: readonly number[] = [],
): (value: number) => string {
  if (typeof format === 'function') return format;
  const base: Intl.NumberFormatOptions = format
    ? {
        style: format.style,
        currency: format.currency,
        currencyDisplay: format.currencyDisplay,
        unit: format.unit,
      }
    : {};
  for (let digits = 0; digits <= 3; digits++) {
    const f = numberFormat(locale, { ...base, notation: 'compact', maximumFractionDigits: digits });
    if (ticks.every((tick) => isExact(f, tick))) return (value) => f.format(value);
  }
  const plain = numberFormat(locale, { ...base, maximumFractionDigits: 3 });
  return (value) => plain.format(value);
}

/** X values: Date, ISO string or epoch ms. */
export type XValue = Date | string | number;

export type DateFormat = Intl.DateTimeFormatOptions | ((value: Date) => string);

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function makeDateFormatter(
  locale: string,
  format: DateFormat | undefined,
  fallback: Intl.DateTimeFormatOptions,
): (value: Date) => string {
  if (typeof format === 'function') return format;
  const f = new Intl.DateTimeFormat(locale, format ?? fallback);
  return (value) => f.format(value);
}

/**
 * Keeps the first `max - 1` slices and folds the rest into one "Other" slice, so a donut never
 * needs more hues than it can tell apart.
 */
export function foldSlices<T extends { label: string; value: number }>(
  slices: readonly T[],
  max: number,
  otherLabel: string,
): Array<T | { label: string; value: number; other: true }> {
  if (slices.length <= max) return [...slices];
  // Keep the largest slices, in their original order (colour follows the entity, not its rank).
  const keep = new Set(
    slices
      .map((s, i) => ({ v: s.value, i }))
      .sort((a, b) => b.v - a.v || a.i - b.i)
      .slice(0, Math.max(1, max - 1))
      .map((x) => x.i),
  );
  const head = slices.filter((_, i) => keep.has(i));
  const rest = slices.filter((_, i) => !keep.has(i)).reduce((sum, s) => sum + s.value, 0);
  return [...head, { label: otherLabel, value: rest, other: true as const }];
}

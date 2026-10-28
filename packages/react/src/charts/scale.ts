/** Pure geometry helpers for the SVG charts (no DOM, no React). */

export interface NiceScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Round a raw step up to 1, 2, 2.5 or 5 × 10^n so tick labels read as clean numbers. */
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Strips float noise (0.30000000000000004) using the step's own precision. */
function clean(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  const v = Number(value.toFixed(decimals));
  return Object.is(v, -0) ? 0 : v;
}

/**
 * A domain covering [min, max], widened to whole steps, with about `count` ticks.
 * `includeZero` keeps the baseline in view (bars must grow from zero).
 */
export function niceScale(min: number, max: number, count = 5, includeZero = true): NiceScale {
  let lo = Number.isFinite(min) ? min : 0;
  let hi = Number.isFinite(max) ? max : 0;
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    if (lo === 0) hi = 1;
    else if (lo > 0) lo = includeZero ? 0 : lo - Math.abs(lo) * 0.5;
    else hi = includeZero ? 0 : hi + Math.abs(hi) * 0.5;
    if (lo === hi) hi = lo + 1;
  }
  const step = niceStep(hi - lo, count);
  const niceMin = clean(Math.floor(lo / step) * step, step);
  const niceMax = clean(Math.ceil(hi / step) * step, step);
  const ticks: number[] = [];
  const n = Math.round((niceMax - niceMin) / step);
  for (let i = 0; i <= n; i++) ticks.push(clean(niceMin + i * step, step));
  return { min: niceMin, max: niceMax, step, ticks };
}

/** Linear map from a domain to a pixel range. */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (value) => r0 + (value - d0) * k;
}

/** How many ticks fit a pixel length, at roughly one per `spacing` px (at least 2). */
export function tickCountFor(length: number, spacing = 48): number {
  return Math.max(2, Math.min(8, Math.floor(length / spacing)));
}

/**
 * Indices of category labels to show so neighbours don't collide: every k-th label, always
 * including the first; `labelWidth` is the widest label in px, `slot` the px per category.
 */
export function thinLabels(count: number, slot: number, labelWidth: number, gap = 8): number[] {
  if (count <= 0) return [];
  const every = Math.max(1, Math.ceil((labelWidth + gap) / Math.max(1, slot)));
  const out: number[] = [];
  for (let i = 0; i < count; i += every) out.push(i);
  return out;
}

/** Rough rendered width of a 12px label: CJK glyphs are full-width, the rest about 0.6em. */
export function textWidth(text: string, fontSize = 12): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    w += code >= 0x2e80 ? fontSize : fontSize * 0.6;
  }
  return Math.ceil(w);
}

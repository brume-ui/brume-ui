import { describe, expect, it } from 'vitest';
import {
  axisFormatter,
  foldSlices,
  makeFormatter,
  readValue,
  seriesColor,
  stackData,
  valueExtent,
} from './data';
import { linearScale, niceScale, niceStep, textWidth, thinLabels } from './scale';

describe('niceScale', () => {
  it('rounds the domain out to clean steps and includes zero', () => {
    expect(niceScale(12, 87, 5)).toEqual({
      min: 0,
      max: 100,
      step: 20,
      ticks: [0, 20, 40, 60, 80, 100],
    });
  });

  it('uses 1 / 2 / 2.5 / 5 × 10^n steps', () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(12, 5)).toBe(2.5);
    expect(niceStep(30, 5)).toBe(10);
    expect(niceStep(1_280_000, 4)).toBe(500_000);
  });

  it('covers negative values', () => {
    const s = niceScale(-35, 60, 5);
    expect(s.min).toBeLessThanOrEqual(-35);
    expect(s.max).toBeGreaterThanOrEqual(60);
    expect(s.ticks).toContain(0);
  });

  it('keeps decimal ticks free of float noise', () => {
    expect(niceScale(0, 0.3, 3).ticks).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('handles an all-zero or single-value series', () => {
    expect(niceScale(0, 0).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceScale(500, 500).max).toBeGreaterThanOrEqual(500);
    expect(niceScale(500, 500, 5, false).min).toBeLessThan(500);
  });

  it('can leave zero out for lines', () => {
    const s = niceScale(940, 1010, 4, false);
    expect(s.min).toBeGreaterThan(0);
    expect(s.min).toBeLessThanOrEqual(940);
  });
});

describe('linearScale', () => {
  it('maps a domain onto an inverted pixel range', () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });
});

describe('labels', () => {
  it('thins category labels that would collide', () => {
    expect(thinLabels(12, 60, 30)).toHaveLength(12);
    expect(thinLabels(12, 20, 30)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('measures CJK glyphs wider than latin ones', () => {
    expect(textWidth('營收')).toBeGreaterThan(textWidth('ab'));
  });
});

describe('stackData', () => {
  it('stacks positives upward and negatives downward in series order', () => {
    const [row] = stackData([{ a: 3, b: -2, c: 4, d: -1 }], ['a', 'b', 'c', 'd']);
    expect(row).toEqual({ a: [0, 3], b: [-2, 0], c: [3, 7], d: [-3, -2] });
  });

  it('skips missing values', () => {
    const [row] = stackData([{ a: 3, b: null, c: '2' }], ['a', 'b', 'c']);
    expect(row).toEqual({ a: [0, 3], c: [3, 5] });
  });

  it('extent uses stack totals when stacked', () => {
    const data = [
      { a: 3, b: 4 },
      { a: 1, b: 9 },
    ];
    expect(valueExtent(data, ['a', 'b'])).toEqual([1, 9]);
    expect(valueExtent(data, ['a', 'b'], true)).toEqual([0, 10]);
    expect(valueExtent([], ['a'])).toEqual([0, 0]);
  });
});

describe('values and colours', () => {
  it('reads numbers and numeric strings, nothing else', () => {
    expect(readValue({ v: '12.5' }, 'v')).toBe(12.5);
    expect(readValue({ v: 'n/a' }, 'v')).toBeNull();
    expect(readValue({}, 'v')).toBeNull();
  });

  it('assigns slots by position and never cycles past eight', () => {
    expect(seriesColor({}, 0)).toBe('var(--br-chart-1)');
    expect(seriesColor({ color: 3 }, 0)).toBe('var(--br-chart-3)');
    expect(seriesColor({}, 8)).toBe('var(--br-chart-muted)');
  });

  it('folds slices past the limit into one "Other" slice', () => {
    const slices = [5, 4, 3, 2, 1].map((value, i) => ({ label: `s${i}`, value }));
    const folded = foldSlices(slices, 3, '其他');
    expect(folded.map((s) => s.label)).toEqual(['s0', 's1', '其他']);
    expect(folded[2]?.value).toBe(6);
  });
});

describe('formatting', () => {
  it('formats with the locale and Intl options or a function', () => {
    expect(
      makeFormatter('en', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })(1280),
    ).toBe('NT$1,280');
    expect(makeFormatter('zh-TW', undefined)(1280)).toBe('1,280');
    expect(makeFormatter('en', (v) => `${v} pcs`)(3)).toBe('3 pcs');
  });

  it('compacts axis labels from 1,000 up in the locale', () => {
    expect(axisFormatter('en', undefined, [0, 1500])(1500)).toBe('1.5K');
    expect(axisFormatter('en', undefined, [0, 800])(800)).toBe('800');
    expect(axisFormatter('zh-TW', undefined, [0, 25000])(25000)).toBe('2.5萬');
    expect(axisFormatter('en', { style: 'currency', currency: 'USD' }, [0, 2e6])(2e6)).toBe('$2M');
  });

  const labels = (locale: string, lo: number, hi: number, includeZero = true) => {
    const { ticks } = niceScale(lo, hi, 5, includeZero);
    const f = axisFormatter(locale, undefined, ticks);
    return ticks.map(f);
  };

  it('takes axis decimals from the tick step so every label is exact and distinct (zh-TW)', () => {
    expect(labels('zh-TW', 0, 12000)).toEqual(['0', '2500', '5000', '7500', '1萬', '1.25萬']);
    const close = labels('zh-TW', 10200, 11300, false);
    expect(new Set(close).size).toBe(close.length);
    expect(close).toContain('1.05萬');
  });

  it('takes axis decimals from the tick step (en)', () => {
    expect(labels('en', 0, 1_200_000)).toEqual(['0', '250K', '500K', '750K', '1M', '1.25M']);
    const close = labels('en', 10200, 11300, false);
    expect(new Set(close).size).toBe(close.length);
    expect(close).toContain('10.5K');
  });

  it('formats very large values compactly and exactly', () => {
    expect(labels('en', 0, 3.2e9)).toEqual(['0', '1B', '2B', '3B', '4B']);
    expect(labels('zh-TW', 0, 3.2e9)).toEqual(['0', '10億', '20億', '30億', '40億']);
    expect(labels('zh-TW', 0, 1.2e8)).toEqual(['0', '2500萬', '5000萬', '7500萬', '1億', '1.25億']);
  });
});

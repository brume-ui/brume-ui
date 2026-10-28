import type { Translate } from '../i18n';
import type { ChartSeries } from './data';
import { readValue } from './data';

/** Shared SVG text style: muted ink, 12px, tabular figures (ticks align). */
export const AXIS_TEXT = {
  fill: 'var(--br-text-muted)',
  fontSize: 12,
  style: { fontVariantNumeric: 'tabular-nums' },
} as const;

/** Hairline gridlines + tick labels along the value axis. */
export function ValueGrid({
  ticks,
  scale,
  orientation,
  start,
  end,
  format,
}: {
  ticks: number[];
  scale(value: number): number;
  /** `vertical`: horizontal gridlines, labels on the left. `horizontal`: vertical gridlines, labels below. */
  orientation: 'vertical' | 'horizontal';
  /** Cross-axis extent of the plot. */
  start: number;
  end: number;
  format(value: number): string;
}) {
  return (
    <g>
      {ticks.map((tick) => {
        const p = Math.round(scale(tick)) + 0.5;
        const stroke = tick === 0 ? 'var(--br-chart-axis)' : 'var(--br-chart-grid)';
        return orientation === 'vertical' ? (
          <g key={tick}>
            <line x1={start} x2={end} y1={p} y2={p} stroke={stroke} strokeWidth={1} />
            <text {...AXIS_TEXT} x={start - 8} y={p} textAnchor="end" dominantBaseline="middle">
              {format(tick)}
            </text>
          </g>
        ) : (
          <g key={tick}>
            <line x1={p} x2={p} y1={start} y2={end} stroke={stroke} strokeWidth={1} />
            <text {...AXIS_TEXT} x={p} y={end + 16} textAnchor="middle">
              {format(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Truncates a label to fit `max` px (the full text stays in the tooltip and data table). */
export function fitLabel(text: string, max: number, measure: (s: string) => number): string {
  if (measure(text) <= max) return text;
  const chars = [...text];
  while (chars.length > 1 && measure(`${chars.join('')}…`) > max) chars.pop();
  return `${chars.join('')}…`;
}

/** Screen-reader summary: point count, lowest and highest value with where they occur. */
export function describeExtremes(
  t: Translate,
  data: readonly Record<string, unknown>[],
  series: readonly ChartSeries[],
  labelAt: (index: number) => string,
  format: (value: number) => string,
): string {
  let min: { v: number; at: string } | null = null;
  let max: { v: number; at: string } | null = null;
  let count = 0;
  data.forEach((datum, i) => {
    for (const s of series) {
      const v = readValue(datum, s.key);
      if (v === null) continue;
      count++;
      const at = series.length > 1 ? `${labelAt(i)} ${s.label}` : labelAt(i);
      if (!min || v < min.v) min = { v, at };
      if (!max || v > max.v) max = { v, at };
    }
  });
  if (!min || !max) return t('chart.empty');
  const lo = min as { v: number; at: string };
  const hi = max as { v: number; at: string };
  return t('chart.summary', {
    count,
    min: format(lo.v),
    minAt: lo.at,
    max: format(hi.v),
    maxAt: hi.at,
  });
}

import { type CSSProperties, type PointerEvent, useMemo, useRef } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { describeExtremes, fitLabel, ValueGrid } from './axis';
import { ChartFrame, ChartLegend, ChartTooltip, PLOT_FOCUS } from './chart-frame';
import {
  axisFormatter,
  type ChartDatum,
  type ChartSeries,
  makeFormatter,
  readValue,
  seriesColor,
  stackData,
  type ValueFormat,
  valueExtent,
} from './data';
import { linearScale, niceScale, textWidth, thinLabels, tickCountFor } from './scale';
import {
  enterDelay,
  useActiveIndex,
  useChartWidth,
  useEnterAnimation,
  useHiddenKeys,
} from './use-chart';

export interface BarChartProps {
  /** Accessible name and visible caption. */
  title: string;
  description?: string;
  /** Keep the title for assistive tech only (e.g. inside a titled Card). */
  hideTitle?: boolean;
  data: ChartDatum[];
  /** Field holding each row's category label. */
  categoryKey: string;
  series: ChartSeries[];
  /** Columns (default) or horizontal bars, which suit many or long category names. */
  orientation?: 'vertical' | 'horizontal';
  /** Side-by-side (default) or stacked series. */
  layout?: 'grouped' | 'stacked';
  /** Tooltip and data-table values. Default: the locale's plain number. */
  valueFormat?: ValueFormat;
  /** Axis tick labels. Default: compact form of `valueFormat` (1.2K, 1.2萬). */
  axisFormat?: ValueFormat;
  /** Plot height in px. Default 240 (vertical) or 36 px per category (horizontal). */
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  /** Bars grow in on mount. Default true; always off under reduced motion. */
  animate?: boolean;
  className?: string;
}

/** Thickest a bar gets; the rest of the band stays air. */
const MAX_BAR = 24;
/** Surface gap between touching bars and stacked segments. */
const GAP = 2;
const RADIUS = 4;

type End = 'top' | 'bottom' | 'left' | 'right' | null;

/** Rect path with the data end rounded (4px) and the baseline end square. */
export function barPath(x: number, y: number, w: number, h: number, end: End): string {
  if (w <= 0 || h <= 0) return '';
  const r = end
    ? Math.min(RADIUS, end === 'top' || end === 'bottom' ? Math.min(w / 2, h) : Math.min(h / 2, w))
    : 0;
  const x2 = x + w;
  const y2 = y + h;
  switch (end) {
    case 'top':
      return `M${x},${y2}V${y + r}Q${x},${y} ${x + r},${y}H${x2 - r}Q${x2},${y} ${x2},${y + r}V${y2}Z`;
    case 'bottom':
      return `M${x},${y}V${y2 - r}Q${x},${y2} ${x + r},${y2}H${x2 - r}Q${x2},${y2} ${x2},${y2 - r}V${y}Z`;
    case 'right':
      return `M${x},${y}H${x2 - r}Q${x2},${y} ${x2},${y + r}V${y2 - r}Q${x2},${y2} ${x2 - r},${y2}H${x}Z`;
    case 'left':
      return `M${x2},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y2 - r}Q${x},${y2} ${x + r},${y2}H${x2}Z`;
    default:
      return `M${x},${y}H${x2}V${y2}H${x}Z`;
  }
}

interface Bar {
  key: string;
  d: string;
  color: string;
}

/**
 * Bar / column chart: grouped or stacked series on one value axis with nice ticks, thin bars
 * with rounded data ends, hover/focus tooltip per category and a clickable legend.
 */
export function BarChart({
  title,
  description,
  hideTitle,
  data,
  categoryKey,
  series,
  orientation = 'vertical',
  layout = 'grouped',
  valueFormat,
  axisFormat,
  height: heightProp,
  loading,
  emptyMessage,
  animate,
  className,
}: BarChartProps) {
  const { t, locale } = useBrume();
  const plotRef = useRef<HTMLDivElement>(null);
  const measured = useChartWidth(plotRef);
  const width = measured ?? 0;
  const play = useEnterAnimation(animate);
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const { hidden, toggle } = useHiddenKeys(keys);
  const visible = series.filter((s) => !hidden.has(s.key));
  const visibleKeys = visible.map((s) => s.key);
  const horizontal = orientation === 'horizontal';
  const stacked = layout === 'stacked';
  const n = data.length;
  const height = heightProp ?? (horizontal ? Math.max(120, n * 36 + 28) : 240);
  const { index: active, source, keyboard, pointer } = useActiveIndex(n);

  const format = useMemo(() => makeFormatter(locale, valueFormat), [locale, valueFormat]);
  const labelAt = (i: number) => String(data[i]?.[categoryKey] ?? '');
  const colorOf = (key: string) => {
    const i = keys.indexOf(key);
    return seriesColor(series[i] ?? {}, i);
  };

  // Layout.
  const [lo, hi] = valueExtent(data, visibleKeys, stacked);
  const valueLength = horizontal ? width : height;
  const scale = niceScale(lo, hi, tickCountFor(valueLength - 32, horizontal ? 80 : 48));
  const tickFormat = axisFormat
    ? makeFormatter(locale, axisFormat)
    : axisFormatter(locale, valueFormat, scale.ticks);
  const tickLabels = scale.ticks.map(tickFormat);
  const categoryLabels = data.map((_, i) => labelAt(i));
  const pad = { top: 8, right: 8, bottom: 24, left: 8 };
  if (horizontal) {
    const widest = Math.max(0, ...categoryLabels.map((l) => textWidth(l)));
    pad.left = Math.min(Math.round(width * 0.35), widest) + 12;
    pad.right = Math.max(8, Math.ceil(textWidth(tickLabels.at(-1) ?? '') / 2));
  } else {
    pad.left = Math.max(...tickLabels.map((l) => textWidth(l))) + 12;
  }
  const plotLeft = pad.left;
  const plotRight = Math.max(plotLeft + 1, width - pad.right);
  const plotTop = pad.top;
  const plotBottom = Math.max(plotTop + 1, height - pad.bottom);
  const value = horizontal
    ? linearScale([scale.min, scale.max], [plotLeft, plotRight])
    : linearScale([scale.min, scale.max], [plotBottom, plotTop]);
  const bandStart = horizontal ? plotTop : plotLeft;
  const bandLength = horizontal ? plotBottom - plotTop : plotRight - plotLeft;
  const slot = n > 0 ? bandLength / n : bandLength;
  const k = stacked ? 1 : Math.max(1, visible.length);
  const thickness = Math.max(
    2,
    Math.min(MAX_BAR, (slot * (stacked ? 0.6 : 0.72) - (k - 1) * GAP) / k),
  );
  const groupSize = k * thickness + (k - 1) * GAP;
  const base = value(0);
  const stacks = stacked ? stackData(data, visibleKeys) : [];

  const bars: Bar[][] = data.map((datum, i) => {
    const center = bandStart + slot * (i + 0.5);
    const out: Bar[] = [];
    if (stacked) {
      const row = stacks[i] ?? {};
      // Segments with height; a zero series stacked on top never takes the rounded end.
      const extent = (key: string) => {
        const e = row[key];
        return e && e[1] > e[0] ? e : undefined;
      };
      const reversed = [...visibleKeys].reverse();
      const lastUp = reversed.find((key) => (extent(key)?.[0] ?? -1) >= 0);
      const lastDown = reversed.find((key) => (extent(key)?.[1] ?? 1) <= 0);
      for (const key of visibleKeys) {
        const e = extent(key);
        if (!e) continue;
        const positive = e[0] >= 0;
        const isEnd = key === (positive ? lastUp : lastDown);
        const baseValue = positive ? e[0] : e[1];
        const far = value(positive ? e[1] : e[0]);
        let near = value(baseValue);
        const dir = Math.sign(far - near);
        // A 2px surface gap at the join with the previous segment; a segment thinner than the
        // gap is dropped rather than flipped.
        if (baseValue !== 0) near += dir * GAP;
        const length = Math.max(0, (far - near) * dir);
        if (length <= 0) continue;
        const start = Math.min(near, far);
        const pos = center - thickness / 2;
        out.push({
          key,
          color: colorOf(key),
          d: horizontal
            ? barPath(start, pos, length, thickness, isEnd ? (positive ? 'right' : 'left') : null)
            : barPath(pos, start, thickness, length, isEnd ? (positive ? 'top' : 'bottom') : null),
        });
      }
    } else {
      visibleKeys.forEach((key, j) => {
        const v = readValue(datum, key);
        if (v === null || v === 0) return;
        const pos = center - groupSize / 2 + j * (thickness + GAP);
        const p = value(v);
        if (horizontal) {
          out.push({
            key,
            color: colorOf(key),
            d: barPath(
              Math.min(base, p),
              pos,
              Math.abs(p - base),
              thickness,
              v > 0 ? 'right' : 'left',
            ),
          });
        } else {
          out.push({
            key,
            color: colorOf(key),
            d: barPath(
              pos,
              Math.min(base, p),
              thickness,
              Math.abs(p - base),
              v > 0 ? 'top' : 'bottom',
            ),
          });
        }
      });
    }
    return out;
  });

  // Category labels: thinned so they never collide.
  const shown = horizontal
    ? new Set(data.map((_, i) => i))
    : new Set(thinLabels(n, slot, Math.max(0, ...categoryLabels.map((l) => textWidth(l)))));

  const pointerIndex = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = horizontal ? e.clientY - rect.top : e.clientX - rect.left;
    const i = Math.floor((p - bandStart) / slot);
    return i >= 0 && i < n ? i : null;
  };

  const rowsFor = (i: number) =>
    visible.map((s) => {
      const v = readValue(data[i], s.key);
      return {
        key: s.key,
        label: s.label,
        value: v === null ? '—' : format(v),
        color: colorOf(s.key),
        shape: 'rect' as const,
      };
    });

  let tooltip = null;
  if (active !== null) {
    const center = bandStart + slot * (active + 0.5);
    if (horizontal) {
      // Beside the end of the row's longest bar (or stack).
      const row = data[active];
      const reach = stacked
        ? visibleKeys.reduce((sum, key) => sum + Math.max(0, readValue(row, key) ?? 0), 0)
        : Math.max(0, ...visibleKeys.map((key) => readValue(row, key) ?? 0));
      const x = value(reach) + 4;
      tooltip = (
        <ChartTooltip
          x={x}
          y={Math.max(0, center - slot / 2)}
          flip={x > width * 0.55}
          title={labelAt(active)}
          rows={rowsFor(active)}
        />
      );
    } else {
      const x = center + groupSize / 2;
      const flip = x > width * 0.6;
      tooltip = (
        <ChartTooltip
          x={flip ? center - groupSize / 2 : x}
          y={plotTop}
          flip={flip}
          title={labelAt(active)}
          rows={rowsFor(active)}
        />
      );
    }
  }

  const announcement =
    active !== null && source === 'keyboard'
      ? `${labelAt(active)}：${rowsFor(active)
          .map((r) => `${r.label} ${r.value}`)
          .join('，')}`
      : undefined;

  const legend =
    series.length > 1 ? (
      <ChartLegend
        hidden={hidden}
        onToggle={toggle}
        items={series.map((s, i) => ({
          key: s.key,
          label: s.label,
          color: seriesColor(s, i),
          shape: 'rect',
        }))}
      />
    ) : null;

  const growClass = horizontal
    ? 'br:animate-[br-chart-grow-x_var(--br-duration-slow)_var(--br-ease-out)_both] br:motion-reduce:animate-none'
    : 'br:animate-[br-chart-grow-y_var(--br-duration-slow)_var(--br-ease-out)_both] br:motion-reduce:animate-none';

  return (
    <ChartFrame
      title={title}
      description={description}
      hideTitle={hideTitle}
      height={height}
      loading={loading}
      empty={n === 0}
      emptyMessage={emptyMessage}
      legend={legend}
      className={className}
      summary={describeExtremes(t, data, visible, labelAt, format)}
      table={{
        head: [t('chart.category'), ...series.map((s) => s.label)],
        rows: data.map((datum, i) => [
          labelAt(i),
          ...series.map((s) => {
            const v = readValue(datum, s.key);
            return v === null ? '—' : format(v);
          }),
        ]),
      }}
      announcement={announcement}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable group is the keyboard entry to the plot */}
      <div
        ref={plotRef}
        role="group"
        aria-label={`${title}：${t('chart.keyboardHint')}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys step through the data from here
        tabIndex={0}
        className={cn(PLOT_FOCUS, 'br:touch-pan-y br:select-none')}
        style={{ height }}
        {...keyboard}
        {...pointer(pointerIndex)}
        data-chart="bar"
      >
        {/* Nothing until measured: a guessed width could overflow the box. */}
        {measured === null ? null : (
          <>
            <svg
              width={width}
              height={height}
              aria-hidden="true"
              className="br:block br:overflow-visible"
            >
              {active !== null ? (
                <rect
                  x={horizontal ? plotLeft : bandStart + slot * active}
                  y={horizontal ? bandStart + slot * active : plotTop}
                  width={horizontal ? plotRight - plotLeft : slot}
                  height={horizontal ? slot : plotBottom - plotTop}
                  rx={6}
                  fill="var(--br-surface-canvas)"
                  opacity={0.7}
                />
              ) : null}
              <ValueGrid
                ticks={scale.ticks}
                scale={value}
                orientation={orientation}
                start={horizontal ? plotTop : plotLeft}
                end={horizontal ? plotBottom : plotRight}
                format={tickFormat}
              />
              {data.map((_, i) => {
                const center = bandStart + slot * (i + 0.5);
                const label = labelAt(i);
                if (!shown.has(i)) return null;
                return horizontal ? (
                  <text
                    // biome-ignore lint/suspicious/noArrayIndexKey: one label per row
                    key={i}
                    x={plotLeft - 12}
                    y={center}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="var(--br-text-muted)"
                    fontSize={12}
                  >
                    {fitLabel(label, pad.left - 12, (s) => textWidth(s))}
                  </text>
                ) : (
                  <text
                    // biome-ignore lint/suspicious/noArrayIndexKey: one label per column
                    key={i}
                    x={center}
                    y={plotBottom + 17}
                    textAnchor="middle"
                    fill="var(--br-text-muted)"
                    fontSize={12}
                  >
                    {label}
                  </text>
                );
              })}
              {bars.map((group, i) => (
                <g
                  // biome-ignore lint/suspicious/noArrayIndexKey: bars follow the data order
                  key={i}
                  data-bar-group={i}
                  className={cn(
                    'br:transition-opacity br:duration-fast br:ease-out',
                    play && growClass,
                  )}
                  style={
                    {
                      opacity: active !== null && active !== i ? 0.6 : 1,
                      transformOrigin: horizontal ? `${base}px 0px` : `0px ${base}px`,
                      animationDelay: play ? `${enterDelay(i, n)}ms` : undefined,
                    } as CSSProperties
                  }
                >
                  {group.map((bar) => (
                    <path key={bar.key} d={bar.d} fill={bar.color} data-series={bar.key} />
                  ))}
                </g>
              ))}
            </svg>
            {tooltip}
          </>
        )}
      </div>
    </ChartFrame>
  );
}

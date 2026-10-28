import { type CSSProperties, type PointerEvent, useMemo, useRef } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { AXIS_TEXT, describeExtremes, ValueGrid } from './axis';
import { ChartFrame, ChartLegend, ChartTooltip, PLOT_FOCUS } from './chart-frame';
import { linePath, monotonePath, type Point, segments } from './curve';
import {
  axisFormatter,
  type ChartDatum,
  type ChartSeries,
  type DateFormat,
  makeDateFormatter,
  makeFormatter,
  readValue,
  seriesColor,
  toDate,
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

export interface LineChartProps {
  /** Accessible name and visible caption. */
  title: string;
  description?: string;
  hideTitle?: boolean;
  data: ChartDatum[];
  /** Field holding each row's x value (a date for `xType="time"`, any label otherwise). */
  xKey: string;
  /** `time`: x is a Date / ISO string / epoch ms, spaced by time. `category` (default): evenly spaced labels. */
  xType?: 'time' | 'category';
  /** Date format for time x labels and the tooltip. Default: month/day in the locale. */
  xFormat?: DateFormat;
  series: ChartSeries[];
  /** Soft 10% wash under each line. */
  area?: boolean;
  /** `smooth` (default) is monotone, so it never overshoots the data; `linear` is straight segments. */
  curve?: 'smooth' | 'linear';
  /** Keep 0 on the value axis. Default true. */
  includeZero?: boolean;
  valueFormat?: ValueFormat;
  axisFormat?: ValueFormat;
  /** Plot height in px. Default 240. */
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  /** Lines draw in on mount. Default true; always off under reduced motion. */
  animate?: boolean;
  className?: string;
}

/**
 * Line (or soft area) chart for one or more series over time or categories: nice value ticks,
 * a crosshair that snaps to the nearest x, one tooltip listing every series there, and a
 * clickable legend.
 */
export function LineChart({
  title,
  description,
  hideTitle,
  data,
  xKey,
  xType = 'category',
  xFormat,
  series,
  area = false,
  curve = 'smooth',
  includeZero = true,
  valueFormat,
  axisFormat,
  height = 240,
  loading,
  emptyMessage,
  animate,
  className,
}: LineChartProps) {
  const { t, locale } = useBrume();
  const plotRef = useRef<HTMLDivElement>(null);
  const width = useChartWidth(plotRef);
  const play = useEnterAnimation(animate);
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const { hidden, toggle } = useHiddenKeys(keys);
  const visible = series.filter((s) => !hidden.has(s.key));
  const n = data.length;
  const { index: active, source, setActive, onKeyDown, onFocus, onBlur } = useActiveIndex(n);

  const format = useMemo(() => makeFormatter(locale, valueFormat), [locale, valueFormat]);
  const tickFormat = useMemo(
    () => (axisFormat ? makeFormatter(locale, axisFormat) : axisFormatter(locale, valueFormat)),
    [locale, axisFormat, valueFormat],
  );
  const dateFormat = useMemo(
    () => makeDateFormatter(locale, xFormat, { month: 'numeric', day: 'numeric' }),
    [locale, xFormat],
  );
  const dates = xType === 'time' ? data.map((d) => toDate(d[xKey])) : [];
  const labelAt = (i: number): string => {
    if (xType === 'time') {
      const d = dates[i];
      return d ? dateFormat(d) : '';
    }
    return String(data[i]?.[xKey] ?? '');
  };
  const colorOf = (s: ChartSeries) => {
    const i = keys.indexOf(s.key);
    return seriesColor(s, i);
  };

  const [lo, hi] = valueExtent(
    data,
    visible.map((s) => s.key),
  );
  const scale = niceScale(lo, hi, tickCountFor(height - 32), includeZero);
  const tickLabels = scale.ticks.map(tickFormat);
  const labels = data.map((_, i) => labelAt(i));
  const widestX = Math.max(0, ...labels.map((l) => textWidth(l)));
  const plotLeft = Math.max(...tickLabels.map((l) => textWidth(l))) + 12;
  // Room for the last x label, which is centred on the right edge.
  const plotRight = Math.max(plotLeft + 1, width - Math.max(8, Math.ceil(widestX / 2)));
  const plotTop = 8;
  const plotBottom = Math.max(plotTop + 1, height - 24);
  const y = linearScale([scale.min, scale.max], [plotBottom, plotTop]);

  // x positions: evenly spaced, or by time.
  const times = dates.map((d) => d?.getTime() ?? Number.NaN);
  const finiteTimes = times.filter(Number.isFinite);
  const tMin = Math.min(...finiteTimes);
  const tMax = Math.max(...finiteTimes);
  const xs: number[] =
    xType === 'time' && finiteTimes.length > 1 && tMax > tMin
      ? times.map((tm) =>
          Number.isFinite(tm) ? linearScale([tMin, tMax], [plotLeft, plotRight])(tm) : Number.NaN,
        )
      : data.map((_, i) =>
          n <= 1 ? (plotLeft + plotRight) / 2 : plotLeft + ((plotRight - plotLeft) * i) / (n - 1),
        );
  const spacing = n > 1 ? (plotRight - plotLeft) / (n - 1) : plotRight - plotLeft;
  const shownLabels = thinLabels(n, spacing, widestX, 12);
  const baseline = y(includeZero ? Math.max(scale.min, Math.min(0, scale.max)) : scale.min);

  const lines = visible.map((s, j) => {
    const pts = data.map((datum, i) => {
      const v = readValue(datum, s.key);
      const x = xs[i] as number;
      return v === null || !Number.isFinite(x) ? null : ([x, y(v)] as Point);
    });
    const runs = segments(pts);
    const draw = curve === 'smooth' ? monotonePath : linePath;
    return {
      series: s,
      color: colorOf(s),
      delay: enterDelay(j, visible.length, 160),
      pts,
      line: runs.map(draw).join(''),
      area: area
        ? runs
            .filter((r) => r.length > 1)
            .map(
              (r) =>
                `${draw(r)}L${(r.at(-1) as Point)[0]},${baseline}L${(r[0] as Point)[0]},${baseline}Z`,
            )
            .join('')
        : '',
      singles: runs.filter((r) => r.length === 1).map((r) => r[0] as Point),
    };
  });

  const nearest = (px: number): number | null => {
    let best: number | null = null;
    let dist = Number.POSITIVE_INFINITY;
    xs.forEach((x, i) => {
      const d = Math.abs(x - px);
      if (Number.isFinite(d) && d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActive(nearest(e.clientX - rect.left));
  };

  const rowsFor = (i: number) =>
    visible.map((s) => {
      const v = readValue(data[i], s.key);
      return {
        key: s.key,
        label: s.label,
        value: v === null ? '—' : format(v),
        color: colorOf(s),
        shape: 'line' as const,
      };
    });

  const activeX = active !== null ? (xs[active] ?? Number.NaN) : Number.NaN;
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
          shape: area ? 'rect' : 'line',
        }))}
      />
    ) : null;

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
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        data-chart="line"
      >
        <svg
          width={width}
          height={height}
          aria-hidden="true"
          className="br:block br:overflow-visible"
        >
          <ValueGrid
            ticks={scale.ticks}
            scale={y}
            orientation="vertical"
            start={plotLeft}
            end={plotRight}
            format={tickFormat}
          />
          {shownLabels.map((i) => (
            <text key={i} {...AXIS_TEXT} x={xs[i]} y={plotBottom + 17} textAnchor="middle">
              {labels[i]}
            </text>
          ))}
          {Number.isFinite(activeX) ? (
            <line
              x1={Math.round(activeX) + 0.5}
              x2={Math.round(activeX) + 0.5}
              y1={plotTop}
              y2={plotBottom}
              stroke="var(--br-chart-axis)"
              strokeWidth={1}
            />
          ) : null}
          {lines.map((l) =>
            l.area ? (
              <path
                key={`${l.series.key}-area`}
                d={l.area}
                fill={l.color}
                fillOpacity={0.1}
                className={cn(
                  play &&
                    'br:animate-[br-fade-in_var(--br-duration-slow)_var(--br-ease-out)_both] br:motion-reduce:animate-none',
                )}
                style={play ? { animationDelay: `${l.delay + 120}ms` } : undefined}
              />
            ) : null,
          )}
          {lines.map((l) => (
            <g key={l.series.key} data-series={l.series.key}>
              <path
                d={l.line}
                pathLength={1}
                fill="none"
                stroke={l.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={cn(
                  play &&
                    'br:animate-[br-chart-draw_calc(var(--br-duration-slow)*1.6)_var(--br-ease-out)_both] br:motion-reduce:animate-none',
                )}
                style={play ? ({ animationDelay: `${l.delay}ms` } as CSSProperties) : undefined}
              />
              {l.singles.map(([cx, cy]) => (
                <circle key={`${cx}`} cx={cx} cy={cy} r={3} fill={l.color} />
              ))}
            </g>
          ))}
          {active !== null
            ? lines.map((l) => {
                const p = l.pts[active];
                return p ? (
                  <circle
                    key={l.series.key}
                    data-active-point={l.series.key}
                    cx={p[0]}
                    cy={p[1]}
                    r={4}
                    fill={l.color}
                    stroke="var(--br-surface)"
                    strokeWidth={2}
                  />
                ) : null;
              })
            : null}
        </svg>
        {active !== null && Number.isFinite(activeX) ? (
          <ChartTooltip
            x={activeX + (activeX > width * 0.6 ? -4 : 4)}
            y={plotTop}
            flip={activeX > width * 0.6}
            title={labelAt(active)}
            rows={rowsFor(active)}
          />
        ) : null}
      </div>
    </ChartFrame>
  );
}

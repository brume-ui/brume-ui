import { type CSSProperties, type PointerEvent, useMemo, useRef } from 'react';
import { cn } from '../cn';
import { RollingNumber } from '../components/rolling-number';
import { useBrume } from '../provider';
import { ChartFrame, ChartLegend, ChartTooltip, PLOT_FOCUS } from './chart-frame';
import { foldSlices, makeFormatter, seriesColor, toNumber, type ValueFormat } from './data';
import { enterDelay, useActiveIndex, useEnterAnimation, useHiddenKeys } from './use-chart';

export interface DonutSlice {
  label: string;
  /** A number or numeric string (PHP DECIMAL sums arrive as strings). */
  value: number | string;
  /** Stable id for the legend; defaults to the label. */
  key?: string;
  /** Categorical slot 1–8; defaults to the slice's position. */
  color?: number;
}

export interface DonutChartProps {
  /** Accessible name and visible caption. */
  title: string;
  description?: string;
  hideTitle?: boolean;
  data: DonutSlice[];
  /** Text under the centre total. Default 「總計」. */
  centerLabel?: string;
  /** Slices past this fold into 「其他」 (part-to-whole reads at a glance only up to ~6). */
  maxSlices?: number;
  valueFormat?: ValueFormat;
  /** Diameter in px. Default 200. */
  size?: number;
  loading?: boolean;
  emptyMessage?: string;
  /** Arcs sweep in on mount. Default true; always off under reduced motion. */
  animate?: boolean;
  className?: string;
}

const GAP = 2;

interface Arc {
  key: string;
  label: string;
  value: number;
  share: number;
  color: string;
  start: number;
  end: number;
}

function polar(c: number, r: number, angle: number): [number, number] {
  return [c + r * Math.cos(angle), c + r * Math.sin(angle)];
}

/** Arc along radius `r` from `a0` to `a1` (radians, clockwise from 3 o'clock). */
export function arcPath(c: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(c, r, a0);
  const [x1, y1] = polar(c, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}`;
}

/**
 * Donut for part-to-whole at a glance: up to six slices (the rest fold into 「其他」), the
 * total in the centre, a legend with each share that toggles slices, and a tooltip per slice.
 */
export function DonutChart({
  title,
  description,
  hideTitle,
  data,
  centerLabel,
  maxSlices = 6,
  valueFormat,
  size = 200,
  loading,
  emptyMessage,
  animate,
  className,
}: DonutChartProps) {
  const { t, locale } = useBrume();
  const play = useEnterAnimation(animate);
  const plotRef = useRef<HTMLDivElement>(null);
  const format = useMemo(() => makeFormatter(locale, valueFormat), [locale, valueFormat]);
  const percent = useMemo(
    () => makeFormatter(locale, { style: 'percent', maximumFractionDigits: 1 }),
    [locale],
  );

  const slices = useMemo(
    () =>
      foldSlices(
        data.map((d) => ({
          ...d,
          key: d.key ?? d.label,
          value: Math.max(0, toNumber(d.value) ?? 0),
        })),
        maxSlices,
        t('chart.other'),
      ).map((s, i) => ({
        key: 'other' in s ? '__other' : s.key,
        label: s.label,
        value: s.value,
        color: 'other' in s ? 'var(--br-chart-muted)' : seriesColor(s, i),
      })),
    [data, maxSlices, t],
  );
  const keys = useMemo(() => slices.map((s) => s.key), [slices]);
  // Only slices with a value keep the ring from going blank.
  const counted = useMemo(() => slices.filter((s) => s.value > 0).map((s) => s.key), [slices]);
  const { hidden, toggle } = useHiddenKeys(keys, counted);
  const shown = slices.filter((s) => !hidden.has(s.key));
  const total = shown.reduce((sum, s) => sum + s.value, 0);
  const grandTotal = slices.reduce((sum, s) => sum + s.value, 0);

  const c = size / 2;
  const thickness = Math.max(14, Math.round(size * 0.12));
  const r = c - 4 - thickness / 2;
  const gapAngle = shown.length > 1 ? GAP / r : 0;
  const arcs: Arc[] = [];
  let angle = -Math.PI / 2;
  for (const s of shown) {
    const share = total > 0 ? s.value / total : 0;
    const span = share * Math.PI * 2;
    arcs.push({ ...s, share, start: angle, end: angle + span });
    angle += span;
  }
  const drawn = arcs.filter((a) => a.value > 0);

  const { index: active, source, keyboard, pointer } = useActiveIndex(drawn.length);
  // The slice under the pointer, from the path's data-index (the hole picks nothing).
  const pickSlice = (e: PointerEvent<HTMLElement>): number | null => {
    const raw = (e.target as Element).closest?.('[data-index]')?.getAttribute('data-index');
    return raw == null ? null : Number(raw);
  };
  const activeArc = active !== null ? drawn[active] : undefined;

  let tooltip = null;
  if (activeArc) {
    const mid = (activeArc.start + activeArc.end) / 2;
    const [tx, ty] = polar(c, r, mid);
    tooltip = (
      <ChartTooltip
        x={tx}
        y={Math.max(0, ty - 24)}
        // Open toward the centre: a titled Card clips anything outside it.
        flip={tx > c}
        title={activeArc.label}
        rows={[
          {
            key: activeArc.key,
            label: percent(activeArc.share),
            value: format(activeArc.value),
            color: activeArc.color,
            shape: 'rect',
          },
        ]}
      />
    );
  }

  const top = [...shown].sort((a, b) => b.value - a.value)[0];
  const summary =
    top && total > 0
      ? t('chart.summaryDonut', {
          count: shown.length,
          total: format(total),
          top: top.label,
          share: percent(top.value / total),
        })
      : t('chart.empty');

  return (
    <ChartFrame
      title={title}
      description={description}
      hideTitle={hideTitle}
      height={size}
      loading={loading}
      empty={slices.length === 0 || grandTotal === 0}
      emptyMessage={emptyMessage}
      className={className}
      summary={summary}
      table={{
        head: [t('chart.category'), t('chart.value'), t('chart.share')],
        rows: slices.map((s) => [
          s.label,
          format(s.value),
          grandTotal > 0 ? percent(s.value / grandTotal) : '—',
        ]),
      }}
      announcement={
        activeArc && source === 'keyboard'
          ? `${activeArc.label}：${format(activeArc.value)}，${percent(activeArc.share)}`
          : undefined
      }
    >
      <div className="br:flex br:flex-wrap br:items-center br:gap-x-8 br:gap-y-4">
        {/* biome-ignore lint/a11y/useSemanticElements: a focusable group is the keyboard entry to the plot */}
        <div
          ref={plotRef}
          role="group"
          aria-label={`${title}：${t('chart.keyboardHint')}`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys step through the slices from here
          tabIndex={0}
          className={cn(PLOT_FOCUS, 'br:shrink-0 br:rounded-full')}
          style={{ width: size, height: size }}
          {...keyboard}
          {...pointer(pickSlice)}
          data-chart="donut"
        >
          <svg
            width={size}
            height={size}
            aria-hidden="true"
            className="br:block br:overflow-visible"
          >
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="var(--br-chart-grid)"
              strokeWidth={thickness}
            />
            {drawn.map((arc, i) => {
              const whole = drawn.length === 1;
              const d = whole
                ? `${arcPath(c, r, -Math.PI / 2, Math.PI / 2)}${arcPath(c, r, Math.PI / 2, (3 * Math.PI) / 2).replace(/^M[^A]+/, '')}`
                : arcPath(c, r, arc.start + gapAngle / 2, arc.end - gapAngle / 2);
              const dimmed = active !== null && active !== i;
              return (
                <path
                  key={arc.key}
                  d={d}
                  pathLength={1}
                  fill="none"
                  stroke={arc.color}
                  data-series={arc.key}
                  data-index={i}
                  className={cn(
                    'br:transition-[opacity,stroke-width] br:duration-fast br:ease-out',
                    play &&
                      'br:animate-[br-chart-draw_var(--br-duration-slow)_var(--br-ease-out)_both] br:motion-reduce:animate-none',
                  )}
                  style={
                    {
                      strokeWidth: active === i ? thickness + 4 : thickness,
                      opacity: dimmed ? 0.6 : 1,
                      animationDelay: play ? `${enterDelay(i, drawn.length)}ms` : undefined,
                    } as CSSProperties
                  }
                />
              );
            })}
          </svg>
          <div className="br:pointer-events-none br:absolute br:inset-0 br:flex br:flex-col br:items-center br:justify-center br:text-center">
            <span className="br:text-2xl br:font-semibold br:leading-tight br:text-text">
              {typeof valueFormat === 'function' ? (
                format(total)
              ) : (
                <RollingNumber value={total} format={valueFormat} animateOnMount={play} />
              )}
            </span>
            <span className="br:text-xs br:text-text-muted">{centerLabel ?? t('chart.total')}</span>
          </div>
          {tooltip}
        </div>
        <ChartLegend
          className="br:flex-col br:items-start"
          hidden={hidden}
          onToggle={toggle}
          items={slices.map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            shape: 'rect',
            empty: s.value <= 0,
            detail: hidden.has(s.key) || total === 0 ? undefined : percent(s.value / total),
          }))}
        />
      </div>
    </ChartFrame>
  );
}

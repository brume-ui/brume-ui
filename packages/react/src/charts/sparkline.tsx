import { useMemo, useRef } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { monotonePath } from './curve';
import { makeFormatter, seriesColor, type ValueFormat } from './data';
import { linearScale } from './scale';
import { useChartWidth, useEnterAnimation } from './use-chart';

export interface SparklineProps {
  data: number[];
  /**
   * What the trend is of (「營收」). Gives the sparkline an accessible description (first, last,
   * low, high); without it the sparkline is decorative and hidden from assistive tech.
   */
  label?: string;
  /** Categorical slot 1–8. Default 1. */
  color?: number;
  /** Soft wash under the line. Default true. */
  area?: boolean;
  valueFormat?: ValueFormat;
  /** Height in px; width follows the container. Default 36. */
  height?: number;
  animate?: boolean;
  className?: string;
}

/** A tiny trend line without axes, ending in a dot on the latest value. */
export function Sparkline({
  data,
  label,
  color,
  area = true,
  valueFormat,
  height = 36,
  animate,
  className,
}: SparklineProps) {
  const { t, locale } = useBrume();
  const ref = useRef<HTMLDivElement>(null);
  const width = useChartWidth(ref);
  const play = useEnterAnimation(animate);
  const format = useMemo(() => makeFormatter(locale, valueFormat), [locale, valueFormat]);
  const values = data.filter(Number.isFinite);
  const stroke = seriesColor({ color }, 0);

  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = linearScale([0, Math.max(1, values.length - 1)], [pad, width - pad]);
  const y = linearScale(min === max ? [min - 1, max + 1] : [min, max], [height - pad, pad]);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = monotonePath(pts);
  const last = pts.at(-1);

  const description =
    label && values.length > 0
      ? t('stat.trend', {
          label,
          first: format(values[0] as number),
          last: format(values.at(-1) as number),
          min: format(min),
          max: format(max),
        })
      : undefined;

  return (
    <div
      ref={ref}
      className={cn('br:min-w-0', className)}
      style={{ height }}
      {...(description ? { role: 'img', 'aria-label': description } : { 'aria-hidden': true })}
      data-sparkline=""
    >
      {values.length > 1 ? (
        <svg
          width={width}
          height={height}
          aria-hidden="true"
          className="br:block br:overflow-visible"
        >
          {area ? (
            <path
              d={`${line}L${last?.[0]},${height}L${pts[0]?.[0]},${height}Z`}
              fill={stroke}
              fillOpacity={0.1}
              className={cn(
                play &&
                  'br:animate-[br-fade-in_var(--br-duration-slow)_var(--br-ease-out)_both] br:motion-reduce:animate-none',
              )}
            />
          ) : null}
          <path
            d={line}
            pathLength={1}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className={cn(
              play &&
                'br:animate-[br-chart-draw_calc(var(--br-duration-slow)*1.6)_var(--br-ease-out)_both] br:motion-reduce:animate-none',
            )}
          />
          {last ? (
            <circle
              cx={last[0]}
              cy={last[1]}
              r={3.5}
              fill={stroke}
              stroke="var(--br-surface)"
              strokeWidth={2}
            />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { type ReactNode, useId, useMemo } from 'react';
import { cn } from '../cn';
import { RollingNumber } from '../components/rolling-number';
import { Skeleton } from '../components/skeleton';
import { useBrume } from '../provider';
import { makeFormatter } from './data';
import { Sparkline } from './sparkline';
import { useEnterAnimation } from './use-chart';

export interface StatDelta {
  /** Change vs the previous period as a fraction: 0.124 is +12.4%. */
  value: number;
  /** How to show the change. Default: signed percent with one decimal. */
  format?: Intl.NumberFormatOptions;
  /** The period compared against (「上月」). Default 「上期」. */
  period?: string;
  /**
   * Which direction is good news: `up` (default, revenue), `down` (refunds, churn) or `none`
   * (neutral colour either way).
   */
  good?: 'up' | 'down' | 'none';
}

export interface StatCardProps {
  /** Sentence-case label, no trailing colon (「本月營收」). */
  label: string;
  value: number;
  /** Intl options for the value (currency, percent, compact…). */
  format?: Intl.NumberFormatOptions;
  delta?: StatDelta;
  /** Recent values for a sparkline, oldest first (e.g. the last 12 periods). */
  trend?: number[];
  /** Small footer line (「統計至 10/28 12:00」). */
  hint?: ReactNode;
  /** Skeleton placeholders in the same layout, so the card does not jump when data arrives. */
  loading?: boolean;
  /** Value rolls in and the sparkline draws on mount. Default true; off under reduced motion. */
  animate?: boolean;
  className?: string;
}

/** Below this the change reads as 0% at one decimal, so it is shown as flat. */
const FLAT = 0.0005;

export type DeltaDirection = 'up' | 'down' | 'flat';

export function deltaDirection(value: number): DeltaDirection {
  return Math.abs(value) < FLAT ? 'flat' : value > 0 ? 'up' : 'down';
}

const ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

/**
 * Dashboard figure: label, a rolling value, an optional change vs the previous period (icon +
 * sign + words, never colour alone), an optional sparkline and footer hint.
 */
export function StatCard({
  label,
  value,
  format,
  delta,
  trend,
  hint,
  loading = false,
  animate,
  className,
}: StatCardProps) {
  const { t, locale } = useBrume();
  const labelId = useId();
  const play = useEnterAnimation(animate);
  const deltaFormat = useMemo(
    () => makeFormatter(locale, delta?.format ?? { style: 'percent', maximumFractionDigits: 1 }),
    [locale, delta?.format],
  );

  let deltaNode: ReactNode = null;
  if (delta && !loading) {
    const direction = deltaDirection(delta.value);
    const Icon = ICONS[direction];
    const period = delta.period ?? t('stat.previousPeriod');
    const magnitude = deltaFormat(Math.abs(delta.value));
    const signed =
      direction === 'up' ? `+${magnitude}` : direction === 'down' ? `−${magnitude}` : magnitude;
    const good = delta.good ?? 'up';
    const tone =
      direction === 'flat' || good === 'none'
        ? 'neutral'
        : (direction === 'up') === (good === 'up')
          ? 'good'
          : 'bad';
    const spoken =
      direction === 'up'
        ? t('stat.deltaUp', { period, value: magnitude })
        : direction === 'down'
          ? t('stat.deltaDown', { period, value: magnitude })
          : t('stat.deltaFlat', { period });
    deltaNode = (
      <p className="br:m-0 br:flex br:flex-wrap br:items-center br:gap-x-2 br:gap-y-1 br:text-sm">
        <span className="br:sr-only">{spoken}</span>
        <span
          aria-hidden="true"
          data-delta={direction}
          data-tone={tone}
          className={cn(
            'br:inline-flex br:items-center br:gap-1 br:rounded-pill br:px-2 br:py-0.5 br:font-semibold br:tabular-nums',
            tone === 'good' &&
              'br:bg-[color-mix(in_oklab,var(--br-success)_8%,var(--br-surface))] br:text-success',
            tone === 'bad' &&
              'br:bg-[color-mix(in_oklab,var(--br-danger)_8%,var(--br-surface))] br:text-danger',
            tone === 'neutral' && 'br:bg-surface-canvas br:text-text-muted',
          )}
        >
          <Icon className="br:size-3.5" strokeWidth={2.25} />
          {signed}
        </span>
        <span aria-hidden="true" className="br:text-text-muted">
          {t('stat.vs', { period })}
        </span>
      </p>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a figure group, not a form fieldset
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      className={cn(
        'br:flex br:min-w-0 br:flex-col br:gap-3 br:rounded-card br:bg-surface br:p-5 br:shadow-flat br:transition-shadow br:duration-base br:ease-out br:hover:shadow-row',
        className,
      )}
      data-stat-card=""
    >
      <p id={labelId} className="br:m-0 br:text-sm br:text-text-muted">
        {label}
      </p>
      <div className="br:min-w-0 br:text-[1.75rem] br:font-semibold br:leading-9 br:text-text">
        {loading ? (
          <>
            <span className="br:sr-only">{t('common.loading')}</span>
            <Skeleton className="br:my-1.5 br:h-6 br:w-32" />
          </>
        ) : (
          <RollingNumber value={value} format={format} animateOnMount={play} />
        )}
      </div>
      {delta || trend ? (
        <div className="br:flex br:min-h-9 br:items-end br:justify-between br:gap-4">
          <div className="br:min-w-0">
            {delta ? loading ? <Skeleton className="br:my-0.5 br:h-5 br:w-36" /> : deltaNode : null}
          </div>
          {trend ? (
            loading ? (
              <Skeleton className="br:h-9 br:w-24 br:shrink-0 br:rounded-input!" />
            ) : (
              <Sparkline
                data={trend}
                label={label}
                valueFormat={format}
                animate={play}
                className="br:w-24 br:shrink-0"
              />
            )
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <p className="br:m-0 br:border-t br:border-border br:pt-3 br:text-xs br:text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

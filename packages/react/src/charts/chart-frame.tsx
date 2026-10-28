import { type ReactNode, useId } from 'react';
import { cn } from '../cn';
import { Skeleton } from '../components/skeleton';
import { useBrume } from '../provider';

export interface ChartTable {
  /** Header row; the first column names the category. */
  head: string[];
  rows: string[][];
}

export interface ChartFrameProps {
  title: string;
  description?: string;
  hideTitle?: boolean;
  /** Plot height in px; loading and empty states keep it, so nothing shifts. */
  height: number;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  /** Legend row above the plot (omitted for a single series: the title names it). */
  legend?: ReactNode;
  /** One-sentence description of the data for screen readers. */
  summary: string;
  table: ChartTable;
  /** Polite announcement of the keyboard-highlighted datum. */
  announcement?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Shared chart container: a `<figure>` named by its caption, described by a summary, with a
 * visually hidden data table (the chart's accessible twin), fixed-height plot area and the
 * loading / empty states in the same box.
 */
export function ChartFrame({
  title,
  description,
  hideTitle = false,
  height,
  loading = false,
  empty = false,
  emptyMessage,
  legend,
  summary,
  table,
  announcement,
  className,
  children,
}: ChartFrameProps) {
  const { t } = useBrume();
  const summaryId = useId();
  const titleId = useId();
  const busy = loading;
  return (
    <figure
      className={cn('br:m-0 br:flex br:min-w-0 br:flex-col br:gap-3', className)}
      aria-labelledby={titleId}
      aria-describedby={busy || empty ? undefined : summaryId}
      aria-busy={busy || undefined}
      data-chart-state={busy ? 'loading' : empty ? 'empty' : 'ready'}
    >
      <figcaption className={cn(hideTitle && 'br:sr-only')}>
        <span id={titleId} className="br:block br:text-base br:font-semibold br:text-text">
          {title}
        </span>
        {description ? (
          <span className="br:mt-0.5 br:block br:text-sm br:text-text-muted">{description}</span>
        ) : null}
      </figcaption>
      {legend && !busy && !empty ? legend : null}
      {busy ? (
        <div className="br:flex br:flex-col br:justify-end br:gap-3" style={{ height }}>
          <span className="br:sr-only">{t('chart.loading')}</span>
          <Skeleton className="br:h-full br:w-full br:rounded-input!" />
        </div>
      ) : empty ? (
        <div
          className="br:flex br:items-center br:justify-center br:rounded-input br:bg-surface-canvas br:text-sm br:text-text-muted"
          style={{ height }}
        >
          {emptyMessage ?? t('chart.empty')}
        </div>
      ) : (
        <>
          {children}
          <div className="br:sr-only">
            <p id={summaryId}>{summary}</p>
            <table>
              <caption>{t('chart.dataTable', { title })}</caption>
              <thead>
                <tr>
                  {table.head.map((h, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: header labels may repeat
                    <th key={i} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, r) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows mirror the data order
                  <tr key={r}>
                    {row.map((cell, c) =>
                      c === 0 ? (
                        // biome-ignore lint/suspicious/noArrayIndexKey: cells mirror the columns
                        <th key={c} scope="row">
                          {cell}
                        </th>
                      ) : (
                        // biome-ignore lint/suspicious/noArrayIndexKey: cells mirror the columns
                        <td key={c}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="br:sr-only" aria-live="polite" aria-atomic="true">
            {announcement ?? ''}
          </div>
        </>
      )}
    </figure>
  );
}

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  /** Mirrors the mark: a bar/slice swatch or a line key. */
  shape: 'rect' | 'line';
  /** Optional secondary text (a donut slice's share). */
  detail?: string;
  /** Draws nothing (a zero slice): doesn't count toward the one item that must stay visible. */
  empty?: boolean;
}

/**
 * Clickable legend: each item toggles its series. The last visible item cannot be hidden
 * (it reports `aria-disabled` and says why), so the chart never goes blank.
 */
export function ChartLegend({
  items,
  hidden,
  onToggle,
  className,
}: {
  items: LegendItem[];
  hidden: ReadonlySet<string>;
  onToggle(key: string): void;
  className?: string;
}) {
  const { t } = useBrume();
  const visibleCount = items.filter((i) => !hidden.has(i.key) && !i.empty).length;
  return (
    <ul
      aria-label={t('chart.legend')}
      className={cn(
        'br:m-0 br:flex br:list-none br:flex-wrap br:gap-x-1 br:gap-y-1 br:p-0',
        className,
      )}
    >
      {items.map((item) => {
        const off = hidden.has(item.key);
        const locked = !off && !item.empty && visibleCount <= 1;
        return (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={!off}
              aria-disabled={locked || undefined}
              title={locked ? t('chart.legendLastVisible') : undefined}
              onClick={() => {
                if (!locked) onToggle(item.key);
              }}
              className={cn(
                'br:inline-flex br:min-h-7 br:items-center br:gap-2 br:rounded-pill br:px-2.5 br:py-1 br:text-sm br:text-text br:transition-[background-color,opacity] br:duration-fast br:ease-out br:hover:bg-surface-canvas',
                'br:outline-none br:focus-visible:outline-solid br:focus-visible:outline-2 br:focus-visible:outline-offset-2 br:focus-visible:outline-focus-ring',
                off && 'br:text-text-muted',
                locked && 'br:cursor-default br:hover:bg-transparent',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'br:inline-block br:shrink-0 br:transition-opacity br:duration-fast',
                  item.shape === 'rect'
                    ? 'br:size-2.5 br:rounded-[3px]'
                    : 'br:h-0.5 br:w-3.5 br:rounded-pill',
                  off && 'br:opacity-30',
                )}
                style={{ background: item.color }}
              />
              <span className={cn(off && 'br:line-through br:decoration-text-muted')}>
                {item.label}
              </span>
              {item.detail ? <span className="br:text-text-muted">{item.detail}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface TooltipRow {
  key: string;
  label: string;
  value: string;
  color: string;
  shape: 'rect' | 'line';
}

/**
 * Hover / focus readout. Values lead, labels follow; it glides between neighbouring data
 * (CSS transition on transform) and pops in only when it first appears. Purely visual: the
 * live region and the data table carry the same values for assistive tech.
 */
export function ChartTooltip({
  x,
  y,
  flip,
  title,
  rows,
}: {
  x: number;
  y: number;
  /** Place on the left of `x` (near the right edge). */
  flip: boolean;
  title: string;
  rows: TooltipRow[];
}) {
  return (
    <div
      aria-hidden="true"
      data-chart-tooltip=""
      className="br:pointer-events-none br:absolute br:top-0 br:left-0 br:z-10 br:transition-transform br:duration-fast br:ease-out br:motion-reduce:transition-none"
      style={{ transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)` }}
    >
      <div
        className={cn(
          'br:min-w-28 br:whitespace-nowrap br:rounded-input br:border br:border-border br:bg-surface br:px-3 br:py-2 br:text-xs br:shadow-overlay br:origin-top-left br:animate-[br-pop-in_var(--br-duration-fast)_var(--br-ease-out)]',
          flip ? 'br:-translate-x-[calc(100%+12px)]' : 'br:translate-x-3',
        )}
      >
        <div className="br:mb-1 br:text-text-muted">{title}</div>
        <div className="br:flex br:flex-col br:gap-1">
          {rows.map((row) => (
            <div key={row.key} className="br:flex br:items-center br:gap-2">
              <span
                className={cn(
                  'br:inline-block br:shrink-0',
                  row.shape === 'rect'
                    ? 'br:size-2 br:rounded-[2px]'
                    : 'br:h-0.5 br:w-3 br:rounded-pill',
                )}
                style={{ background: row.color }}
              />
              <span className="br:font-semibold br:text-text br:tabular-nums">{row.value}</span>
              <span className="br:text-text-muted">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Classes for the focusable plot area: 2px focus ring, no outline on pointer focus. */
export const PLOT_FOCUS =
  'br:relative br:rounded-input br:outline-none br:focus-visible:outline-solid br:focus-visible:outline-2 br:focus-visible:outline-offset-4 br:focus-visible:outline-focus-ring';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible name (e.g. the column label). */
  label: string;
}

/**
 * A thin bar with its percentage beside it. The fill is ink, not the accent (one-accent rule).
 * Values outside 0…max are clamped, for the bar and for assistive tech alike.
 */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const bounded = Math.min(Math.max(value, 0), Math.max(max, 0));
  const percent = max > 0 ? Math.round((bounded / max) * 100) : 0;
  return (
    <span className="br:inline-flex br:w-full br:max-w-48 br:items-center br:gap-2">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuenow={bounded}
        aria-valuemin={0}
        aria-valuemax={max}
        className="br:h-1.5 br:min-w-0 br:flex-1 br:overflow-hidden br:rounded-pill br:bg-surface-canvas"
      >
        <span
          className="br:block br:h-full br:rounded-pill br:bg-text-muted"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span
        aria-hidden="true"
        className="br:w-10 br:shrink-0 br:text-right br:text-xs br:tabular-nums br:text-text-muted"
      >
        {percent}%
      </span>
    </span>
  );
}

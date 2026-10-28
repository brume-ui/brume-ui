import type { Tone } from '@brume-ui/brume-schema';
import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface BadgeProps {
  /** Default 'neutral'. */
  tone?: Tone;
  /** A number (a count): a smaller pill with tabular digits. */
  count?: boolean;
  /** What screen readers hear instead of the (terse) visible text, e.g. 「還有 2 張」 for 「+2」. */
  spokenLabel?: string;
  children: ReactNode;
}

/** Semantic tones on a light wash of the same colour (as StatCard's delta); accent uses its tint pair. */
const TONES: Record<Tone, string> = {
  neutral: 'br:bg-surface-canvas br:text-text-muted',
  accent: 'br:bg-accent-tint br:text-accent-tint-text',
  success: 'br:bg-[color-mix(in_oklab,var(--br-success)_8%,var(--br-surface))] br:text-success',
  warning: 'br:bg-[color-mix(in_oklab,var(--br-warning)_8%,var(--br-surface))] br:text-warning',
  danger: 'br:bg-[color-mix(in_oklab,var(--br-danger)_8%,var(--br-surface))] br:text-danger',
  info: 'br:bg-[color-mix(in_oklab,var(--br-info)_8%,var(--br-surface))] br:text-info',
};

/** A status pill (a label) or, with `count`, a small number pill. */
export function Badge({ tone = 'neutral', count = false, spokenLabel, children }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'br:inline-flex br:max-w-full br:items-center br:truncate br:rounded-pill br:text-xs br:font-semibold',
        count
          ? 'br:h-5 br:min-w-5 br:justify-center br:px-1.5 br:tabular-nums'
          : 'br:h-6 br:px-2.5',
        TONES[tone],
      )}
    >
      {spokenLabel ? (
        <>
          <span aria-hidden="true">{children}</span>
          <span className="br:sr-only">{spokenLabel}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

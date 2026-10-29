import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface ActionBarProps {
  /** Bold text before the actions, e.g. 「已選取 3 筆」. */
  label?: ReactNode;
  children: ReactNode;
  /** Keeps the bar in view while the page scrolls. */
  sticky?: 'top' | 'bottom';
  'aria-label'?: string;
}

/** A raised strip of actions about the current context: the selected rows, an unsaved form. */
export function ActionBar({ label, children, sticky, 'aria-label': ariaLabel }: ActionBarProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'br:flex br:flex-wrap br:items-center br:gap-2 br:rounded-card br:bg-surface br:px-4 br:py-2 br:shadow-row',
        sticky && 'br:sticky br:z-10',
        sticky === 'top' && 'br:top-0',
        sticky === 'bottom' && 'br:bottom-0',
      )}
    >
      {label != null ? (
        <p className="br:mr-2 br:text-sm br:font-semibold br:text-text">{label}</p>
      ) : null}
      {children}
    </section>
  );
}

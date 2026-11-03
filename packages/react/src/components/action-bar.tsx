import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface ActionBarProps {
  /** Bold text before the actions, e.g. 「已選取 3 筆」. */
  label?: ReactNode;
  children: ReactNode;
  /** Keeps the bar in view while the page scrolls. */
  sticky?: 'top' | 'bottom';
  formFooter?: boolean;
  'aria-label'?: string;
}

/** A raised strip of actions about the current context: the selected rows, an unsaved form. */
export function ActionBar({
  label,
  children,
  sticky,
  formFooter,
  'aria-label': ariaLabel,
}: ActionBarProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'br:flex br:flex-wrap br:items-center br:gap-2 br:bg-surface br:px-4 br:py-3',
        formFooter
          ? 'br:[&_label]:text-[13px] br:[&_label]:text-text-muted br:rounded-card br:border br:border-border br:shadow-overlay'
          : 'br:rounded-card br:shadow-row',
        sticky && 'br:sticky br:z-10',
        sticky === 'top' && 'br:top-0',
        sticky === 'bottom' && 'br:bottom-0',
      )}
    >
      {label != null ? (
        <p
          className={
            formFooter
              ? 'br:mr-2 br:flex br:items-center br:gap-2 br:text-[13px] br:text-text-muted'
              : 'br:mr-2 br:text-sm br:font-semibold br:text-text'
          }
        >
          {formFooter ? (
            <span
              aria-hidden="true"
              className="br:size-1.5 br:shrink-0 br:rounded-full br:bg-warning"
            />
          ) : null}
          {label}
        </p>
      ) : null}
      {children}
    </section>
  );
}

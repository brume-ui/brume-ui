import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from './focus';

export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

export interface AlertProps {
  tone: AlertTone;
  /** Bold first line. */
  title?: string;
  children?: ReactNode;
  /** 'alert' (default) is announced at once; 'status' waits for the screen reader to be idle. */
  role?: 'alert' | 'status';
  id?: string;
  /** -1 lets a script move focus here (an error summary after a failed save). */
  tabIndex?: number;
}

const TONES: Record<AlertTone, string> = {
  danger:
    'br:border-[color-mix(in_oklab,var(--br-danger)_25%,var(--br-danger-tint))] br:bg-danger-tint br:text-text',
  warning: 'br:border-warning br:text-warning',
  info: 'br:border-info br:text-info',
  success: 'br:border-success br:text-success',
};

/** A boxed message in a semantic tone: a page-level error, a warning, a summary. */
export function Alert({ tone, title, children, role = 'alert', id, tabIndex }: AlertProps) {
  return (
    <div
      role={role}
      id={id}
      tabIndex={tabIndex}
      data-tone={tone}
      className={cn(
        'br:rounded-card br:border br:px-4 br:py-3 br:text-sm',
        // Links and buttons inside (an error summary's field index) read as quiet underlined text.
        'br:[&_:is(a,button)]:underline br:[&_:is(a,button)]:decoration-[color-mix(in_oklab,currentColor_40%,transparent)] br:[&_:is(a,button)]:underline-offset-2 br:[&_:is(a,button):hover]:decoration-current',
        tone !== 'danger' && 'br:bg-surface',
        TONES[tone],
        FOCUS_RING,
      )}
    >
      <div className="br:flex br:items-start br:gap-3">
        {tone === 'danger' ? (
          <CircleAlert
            aria-hidden="true"
            className="br:mt-0.5 br:size-4 br:shrink-0 br:text-danger"
          />
        ) : null}
        <div className="br:min-w-0 br:grid br:gap-1">
          {title ? <p className="br:font-medium">{title}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

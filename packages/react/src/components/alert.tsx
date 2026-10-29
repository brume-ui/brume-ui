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
  danger: 'br:border-danger br:text-danger',
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
        'br:rounded-card br:border br:bg-surface br:px-4 br:py-3 br:text-sm',
        TONES[tone],
        FOCUS_RING,
      )}
    >
      {title ? <p className="br:font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from './focus';

export interface CellEditButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> {
  /** A save is in flight: announced with aria-busy and dimmed. */
  pending?: boolean;
  /**
   * 'text' (default): the value with a dashed underline. 'badge': the value is a pill (a label
   * or badge display), which is the affordance itself; a ring shows on hover instead.
   */
  variant?: 'text' | 'badge';
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

/**
 * The value of an editable table cell, as a button that opens its editor: plain cell text with a
 * dashed underline, so it reads as data first and as editable on a second look.
 */
export function CellEditButton({
  pending,
  variant = 'text',
  children,
  ...rest
}: CellEditButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      aria-busy={pending || undefined}
      className={cn(
        'br:inline-flex br:max-w-full br:min-h-6 br:min-w-8 br:items-center br:gap-1 br:text-left br:text-text',
        variant === 'badge'
          ? 'br:cursor-pointer br:rounded-pill br:transition-opacity br:duration-fast br:ease-out br:hover:outline-solid br:hover:outline-1 br:hover:outline-offset-2 br:hover:outline-border-strong'
          : 'br:cursor-text br:rounded-[4px] br:underline br:decoration-border-strong br:decoration-dashed br:underline-offset-4 br:transition-[text-decoration-color,opacity] br:duration-fast br:ease-out br:hover:decoration-text',
        'br:aria-busy:opacity-70',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

export interface CellErrorProps extends Omit<HTMLAttributes<HTMLParagraphElement>, 'className'> {
  /** Point the cell's control at it with aria-describedby. */
  id: string;
  children: ReactNode;
}

/**
 * A save error shown under its cell; announced at once (role="alert"). One line, so the row grows
 * by a line at most: a long message ends in an ellipsis, with the whole text in `title` (and in
 * the DOM, which the cell's aria-describedby reads).
 */
export function CellError({ children, ...rest }: CellErrorProps) {
  return (
    <p
      role="alert"
      title={typeof children === 'string' ? children : undefined}
      {...rest}
      className="br:max-w-full br:truncate br:text-xs br:leading-snug br:text-danger br:animate-[br-drop-in_var(--br-duration-base)_var(--br-ease-out)]"
    >
      {children}
    </p>
  );
}

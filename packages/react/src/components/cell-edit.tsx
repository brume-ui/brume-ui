import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from './focus';

export interface CellEditButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'> {
  /** A save is in flight: announced with aria-busy and dimmed. */
  pending?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

/**
 * The value of an editable table cell, as a button that opens its editor: plain cell text with a
 * dashed underline, so it reads as data first and as editable on a second look.
 */
export function CellEditButton({ pending, children, ...rest }: CellEditButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      aria-busy={pending || undefined}
      className={cn(
        'br:inline-flex br:max-w-full br:min-h-6 br:min-w-8 br:cursor-text br:items-center br:gap-1 br:rounded-[4px] br:text-left br:text-text',
        'br:underline br:decoration-border-strong br:decoration-dashed br:underline-offset-4 br:transition-[text-decoration-color,opacity] br:duration-fast br:ease-out br:hover:decoration-text',
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

/** A save error shown next to its cell; announced at once (role="alert"). */
export function CellError({ children, ...rest }: CellErrorProps) {
  return (
    <p
      role="alert"
      {...rest}
      className="br:text-xs br:leading-snug br:whitespace-normal br:text-danger br:animate-[br-drop-in_var(--br-duration-base)_var(--br-ease-out)]"
    >
      {children}
    </p>
  );
}

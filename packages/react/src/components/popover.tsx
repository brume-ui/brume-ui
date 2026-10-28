import * as RadixPopover from '@radix-ui/react-popover';
import { type ReactElement, type ReactNode, useId } from 'react';
import { cn } from '../cn';
import { POPOVER_MOTION } from '../motion/classes';

export interface PopoverProps {
  trigger: ReactElement;
  /** Shown as the panel heading and used as its accessible name. */
  title?: string;
  children: ReactNode;
  align?: 'start' | 'end';
  open?: boolean;
  onOpenChange?(open: boolean): void;
}

/** A small non-modal panel (filters, column toggles). Esc or an outside click closes it. */
export function Popover({
  trigger,
  title,
  children,
  align = 'start',
  open,
  onOpenChange,
}: PopoverProps) {
  const titleId = useId();
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          aria-labelledby={title ? titleId : undefined}
          className={cn(
            'br:z-50 br:w-[min(20rem,calc(100vw-2rem))] br:rounded-card br:border br:border-border br:bg-surface br:p-4 br:text-sm br:text-text br:shadow-overlay br:outline-none br:[--br-origin:var(--radix-popover-content-transform-origin)]',
            POPOVER_MOTION,
          )}
        >
          {title ? (
            <h2 id={titleId} className="br:mb-3 br:text-sm br:font-semibold br:text-text">
              {title}
            </h2>
          ) : null}
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

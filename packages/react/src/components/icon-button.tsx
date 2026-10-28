import * as Tooltip from '@radix-ui/react-tooltip';
import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';
import { POPOVER_MOTION, PRESS } from '../motion/classes';
import { FOCUS_RING } from './focus';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: LucideIcon;
  /** Required: becomes the aria-label and the tooltip text. */
  label: string;
}

export function IconButton({
  icon: Icon,
  label,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type={type}
            {...rest}
            aria-label={label}
            className={cn(
              'br:inline-flex br:size-10 br:items-center br:justify-center br:rounded-pill br:text-text br:hover:bg-surface-canvas br:disabled:opacity-50 br:disabled:cursor-not-allowed',
              PRESS,
              FOCUS_RING,
              className,
            )}
          >
            <Icon aria-hidden="true" className="br:size-5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className={cn(
              'br:z-50 br:rounded-input br:bg-text br:px-2 br:py-1 br:text-xs br:text-surface br:shadow-overlay br:[--br-origin:var(--radix-tooltip-content-transform-origin)]',
              POPOVER_MOTION,
            )}
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

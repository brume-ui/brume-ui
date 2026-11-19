import * as Tooltip from '@radix-ui/react-tooltip';
import { GripVertical } from 'lucide-react';
import { type ButtonHTMLAttributes, type Ref, useId } from 'react';
import { cn } from '../cn';
import { POPOVER_MOTION } from '../motion/classes';
import { FOCUS_RING } from './focus';

export interface DragHandleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children' | 'disabled'> {
  /** Becomes the aria-label, e.g. "拖曳排序：甲". */
  label: string;
  /** Shown greyed out: aria-disabled, no dragging; `disabledReason` explains why. */
  disabled?: boolean;
  disabledReason?: string;
  /** Pass dnd-kit's `setActivatorNodeRef`. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The grip button that starts a drag. Spread dnd-kit's `attributes` and `listeners` onto it
 * (only when not disabled, so a disabled handle can neither be dragged nor lifted by keyboard).
 */
export function DragHandle({
  label,
  disabled = false,
  disabledReason,
  className,
  ref,
  ...rest
}: DragHandleProps) {
  const reasonId = useId();
  const reason = disabled ? disabledReason : undefined;
  const button = (
    <button
      type="button"
      {...rest}
      ref={ref}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-describedby={reason ? reasonId : rest['aria-describedby']}
      className={cn(
        'br:inline-flex br:size-7 br:touch-none br:items-center br:justify-center br:rounded-input br:text-text-muted',
        disabled
          ? 'br:cursor-not-allowed br:opacity-40'
          : 'br:cursor-grab br:hover:bg-surface-canvas br:hover:text-text br:active:cursor-grabbing',
        FOCUS_RING,
        className,
      )}
    >
      <GripVertical aria-hidden="true" className="br:pointer-events-none br:size-4" />
    </button>
  );
  if (!reason) return button;
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className={cn(
              'br:z-50 br:rounded-input br:bg-text br:px-2 br:py-1 br:text-xs br:text-surface br:shadow-overlay br:[--br-origin:var(--radix-tooltip-content-transform-origin)]',
              POPOVER_MOTION,
            )}
          >
            {reason}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <span id={reasonId} className="br:sr-only">
        {reason}
      </span>
    </Tooltip.Provider>
  );
}

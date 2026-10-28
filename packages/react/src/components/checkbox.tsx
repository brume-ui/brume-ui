import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { type ReactNode, useId } from 'react';
import { cn } from '../cn';
import { FOCUS_RING } from './focus';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  label: ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn('br:inline-flex br:items-center br:gap-2', className)}>
      <RadixCheckbox.Root
        id={inputId}
        {...rest}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className={cn(
          'br:group br:flex br:size-5 br:shrink-0 br:items-center br:justify-center br:rounded-[6px] br:border br:border-border-strong br:bg-surface br:data-[state=checked]:border-accent br:data-[state=checked]:bg-accent br:disabled:opacity-50 br:disabled:cursor-not-allowed',
          // Press sinks a little; release settles with the spring curve.
          'br:transition-[background-color,border-color,scale] br:duration-fast br:ease-spring br:enabled:active:scale-90 br:motion-reduce:enabled:active:scale-100',
          FOCUS_RING,
        )}
      >
        {/* Always mounted so the tick can draw in and out (stroke-dashoffset over pathLength 1). */}
        <RadixCheckbox.Indicator forceMount className="br:flex">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="br:size-3.5 br:text-text-on-accent"
          >
            <path
              d="M4.5 12.5l5 5L19.5 7"
              pathLength={1}
              stroke="currentColor"
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="br:[stroke-dasharray:1] br:[stroke-dashoffset:1] br:opacity-0 br:transition-[stroke-dashoffset,opacity] br:duration-instant br:ease-out br:group-data-[state=checked]:[stroke-dashoffset:0] br:group-data-[state=checked]:opacity-100 br:group-data-[state=checked]:duration-base"
            />
          </svg>
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={inputId} className="br:text-sm br:text-text">
        {label}
      </label>
    </div>
  );
}

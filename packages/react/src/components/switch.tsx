import * as RadixSwitch from '@radix-ui/react-switch';
import type { FocusEventHandler } from 'react';
import { cn } from '../cn';
import { ariaOn, type FieldControlProps } from './field';
import { FOCUS_RING } from './focus';

export interface SwitchProps extends FieldControlProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  /** Accessible name (the switch has no visible label, e.g. inside a grid cell). */
  label: string;
  /** A save is in flight: announced with aria-busy and dimmed. Toggles still go through (latest wins). */
  pending?: boolean;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
}

/** 30×17 switch; on is the accent colour. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  pending,
  disabled,
  onBlur,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: SwitchProps) {
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      onBlur={onBlur}
      id={id}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={isInvalid || undefined}
      aria-required={ariaOn(ariaRequired) || undefined}
      aria-busy={pending || undefined}
      className={cn(
        'br:group br:relative br:inline-flex br:h-[17px] br:w-[30px] br:shrink-0 br:items-center br:rounded-pill br:bg-border-strong br:transition-[background-color,opacity] br:duration-fast br:ease-out br:data-[state=checked]:bg-accent br:disabled:cursor-not-allowed br:disabled:opacity-50 br:aria-busy:opacity-70',
        isInvalid && 'br:ring-2 br:ring-danger',
        FOCUS_RING,
      )}
    >
      <RadixSwitch.Thumb className="br:block br:size-[13px] br:translate-x-[2px] br:rounded-full br:bg-surface br:shadow-sm br:transition-[translate,background-color] br:duration-base br:ease-spring br:data-[state=checked]:translate-x-[15px] br:data-[state=checked]:bg-text-on-accent" />
    </RadixSwitch.Root>
  );
}

import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '../cn';
import { FOCUS_RING } from './focus';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  /** Accessible name (the switch has no visible label, e.g. inside a grid cell). */
  label: string;
  /** A save is in flight: announced with aria-busy and dimmed. Toggles still go through (latest wins). */
  pending?: boolean;
  disabled?: boolean;
}

/** 30×17 switch; on is the accent colour. */
export function Switch({ checked, onCheckedChange, label, pending, disabled }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      aria-busy={pending || undefined}
      className={cn(
        'br:group br:relative br:inline-flex br:h-[17px] br:w-[30px] br:shrink-0 br:items-center br:rounded-pill br:bg-border-strong br:transition-[background-color,opacity] br:duration-fast br:ease-out br:data-[state=checked]:bg-accent br:disabled:cursor-not-allowed br:disabled:opacity-50 br:aria-busy:opacity-70',
        FOCUS_RING,
      )}
    >
      <RadixSwitch.Thumb className="br:block br:size-[13px] br:translate-x-[2px] br:rounded-full br:bg-surface br:shadow-sm br:transition-[translate,background-color] br:duration-base br:ease-spring br:data-[state=checked]:translate-x-[15px] br:data-[state=checked]:bg-text-on-accent" />
    </RadixSwitch.Root>
  );
}

import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
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
          'br:flex br:size-5 br:shrink-0 br:items-center br:justify-center br:rounded-[6px] br:border br:border-border-strong br:bg-surface br:transition-colors br:motion-reduce:transition-none br:data-[state=checked]:border-accent br:data-[state=checked]:bg-accent br:disabled:opacity-50 br:disabled:cursor-not-allowed',
          FOCUS_RING,
        )}
      >
        <RadixCheckbox.Indicator>
          <Check
            aria-hidden="true"
            className="br:size-3.5 br:text-text-on-accent"
            strokeWidth={3}
          />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <label htmlFor={inputId} className="br:text-sm br:text-text">
        {label}
      </label>
    </div>
  );
}

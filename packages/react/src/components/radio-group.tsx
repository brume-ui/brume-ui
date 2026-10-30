import type { Option } from '@brume-ui/brume-schema';
import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { useId } from 'react';
import { cn } from '../cn';
import { ariaOn, type FieldControlProps } from './field';
import { FOCUS_RING } from './focus';

export interface RadioGroupProps extends FieldControlProps {
  options: Option[];
  onBlur?(): void;
  value: string;
  onChange(value: string): void;
  /** Accessible name of the group. */
  label: string;
  /** Default 'horizontal' (options wrap on narrow widths). */
  orientation?: 'horizontal' | 'vertical';
  name?: string;
  disabled?: boolean;
}

/** Single choice from a few options. Arrow keys move and select (Radix roving focus). */
export function RadioGroup({
  options,
  onBlur,
  value,
  onChange,
  label,
  orientation = 'horizontal',
  name,
  disabled,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: RadioGroupProps) {
  const baseId = useId();
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  return (
    <RadixRadioGroup.Root
      id={id}
      onBlur={onBlur}
      value={value}
      onValueChange={onChange}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      // The APG radio group carries the description, error and required state on the group.
      aria-describedby={describedBy}
      aria-invalid={isInvalid || undefined}
      required={ariaOn(ariaRequired)}
      // Not passed to Radix as `orientation`: that would limit arrows to one axis, while the APG
      // radio group moves with all four arrow keys in any layout.
      aria-orientation={orientation}
      name={name}
      disabled={disabled}
      className={cn(
        'br:flex br:gap-x-5 br:gap-y-2',
        orientation === 'horizontal' ? 'br:flex-row br:flex-wrap' : 'br:flex-col',
      )}
    >
      {options.map((o, i) => {
        const itemId = `${baseId}-${i}`;
        return (
          <div key={o.value} className="br:inline-flex br:items-center br:gap-2">
            <RadixRadioGroup.Item
              id={itemId}
              value={o.value}
              disabled={o.disabled}
              className={cn(
                'br:group br:flex br:size-5 br:shrink-0 br:items-center br:justify-center br:rounded-full br:border br:bg-surface br:data-[state=checked]:border-accent br:disabled:cursor-not-allowed br:disabled:opacity-50',
                'br:transition-[border-color,scale] br:duration-fast br:ease-spring br:enabled:active:scale-90 br:motion-reduce:enabled:active:scale-100',
                isInvalid ? 'br:border-danger' : 'br:border-border-strong',
                FOCUS_RING,
              )}
            >
              {/* Always mounted so the dot can grow in and shrink out. */}
              <RadixRadioGroup.Indicator
                forceMount
                className="br:size-2.5 br:scale-0 br:rounded-full br:bg-accent br:opacity-0 br:transition-[scale,opacity] br:duration-instant br:ease-out br:group-data-[state=checked]:scale-100 br:group-data-[state=checked]:opacity-100 br:group-data-[state=checked]:duration-base br:group-data-[state=checked]:ease-spring"
              />
            </RadixRadioGroup.Item>
            <label
              htmlFor={itemId}
              className={cn(
                'br:text-sm br:text-text',
                (o.disabled || disabled) && 'br:cursor-not-allowed br:opacity-50',
              )}
            >
              {o.label}
            </label>
          </div>
        );
      })}
    </RadixRadioGroup.Root>
  );
}

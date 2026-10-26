import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { CONTROL_BASE, FOCUS_RING } from './focus';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onValueChange(value: string): void;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean;
  className?: string;
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder,
  invalid,
  id,
  name,
  disabled,
  className,
  ...aria
}: SelectProps) {
  const isInvalid = invalid || aria['aria-invalid'] === true || aria['aria-invalid'] === 'true';
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} name={name} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        {...aria}
        aria-invalid={isInvalid || undefined}
        className={cn(
          CONTROL_BASE,
          'br:inline-flex br:w-full br:items-center br:justify-between br:gap-2 br:data-[placeholder]:text-text-muted',
          isInvalid ? 'br:border-danger' : 'br:border-border-strong',
          FOCUS_RING,
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown aria-hidden="true" className="br:size-4" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="br:z-50 br:min-w-(--radix-select-trigger-width) br:rounded-card br:border br:border-border br:bg-surface br:p-1 br:shadow-overlay"
        >
          <RadixSelect.Viewport>
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="br:relative br:flex br:h-9 br:cursor-default br:items-center br:rounded-input br:pr-3 br:pl-8 br:text-sm br:text-text br:select-none br:data-[disabled]:opacity-50 br:data-[highlighted]:bg-surface-selected br:data-[highlighted]:outline-none"
              >
                <RadixSelect.ItemIndicator className="br:absolute br:left-2">
                  <Check aria-hidden="true" className="br:size-4 br:text-accent" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { POPOVER_MOTION } from '../motion/classes';
import { HighlightIndicator, useHighlightIndicator } from '../motion/highlight';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

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
  /** Accessible name when no visible label (Field) points at the trigger. */
  'aria-label'?: string;
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
          'br:group br:inline-flex br:w-full br:items-center br:justify-between br:gap-2 br:data-[placeholder]:text-text-muted',
          isInvalid ? 'br:border-danger' : CONTROL_BORDER,
          FOCUS_RING,
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown
            aria-hidden="true"
            className="br:size-4 br:transition-[rotate] br:duration-base br:ease-out br:group-data-[state=open]:rotate-180"
          />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <SelectContent options={options} />
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function SelectContent({ options }: { options: SelectOption[] }) {
  const highlight = useHighlightIndicator();
  return (
    <RadixSelect.Content
      position="popper"
      sideOffset={4}
      className={cn(
        'br:z-50 br:min-w-(--radix-select-trigger-width) br:rounded-card br:border br:border-border br:bg-surface br:p-1 br:shadow-overlay br:[--br-origin:var(--radix-select-content-transform-origin)]',
        POPOVER_MOTION,
      )}
    >
      <RadixSelect.Viewport ref={highlight.ref}>
        <HighlightIndicator state={highlight} />
        {options.map((o) => (
          <RadixSelect.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className="br:relative br:flex br:h-9 br:cursor-default br:items-center br:rounded-input br:pr-3 br:pl-8 br:text-sm br:text-text br:select-none br:data-[disabled]:opacity-50 br:data-[highlighted]:outline-2 br:data-[highlighted]:-outline-offset-2 br:data-[highlighted]:outline-focus-ring"
          >
            <RadixSelect.ItemIndicator className="br:absolute br:left-2">
              <Check aria-hidden="true" className="br:size-4 br:text-accent" />
            </RadixSelect.ItemIndicator>
            <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
          </RadixSelect.Item>
        ))}
      </RadixSelect.Viewport>
    </RadixSelect.Content>
  );
}

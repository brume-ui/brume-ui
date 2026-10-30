import type { Option } from '@brume-ui/brume-schema';
import { cn } from '../cn';
import { Checkbox } from './checkbox';
import { ariaOn, type FieldControlProps } from './field';

export interface CheckboxGroupProps extends FieldControlProps {
  options: Option[];
  onBlur?(): void;
  disabled?: boolean;
  value: string[];
  /** The new selection, in option order. */
  onChange(value: string[]): void;
  /** Accessible name of the group. */
  label: string;
  /** Default 'horizontal' (options wrap on narrow widths). */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Several independent choices; each option is a Checkbox, Tab moves between them. The group
 * carries the description and error (`aria-describedby`); `aria-invalid` goes on each checkbox,
 * since `group` does not support it. `group` has no required state either (ARIA), so a required
 * group shows it in its caption only.
 */
export function CheckboxGroup({
  options,
  onBlur,
  disabled,
  value,
  onChange,
  label,
  orientation = 'horizontal',
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  invalid,
}: CheckboxGroupProps) {
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const selected = new Set(value);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      onBlur={onBlur}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        'br:flex br:gap-x-5 br:gap-y-2',
        orientation === 'horizontal' ? 'br:flex-row br:flex-wrap' : 'br:flex-col',
      )}
    >
      {options.map((o) => (
        <Checkbox
          key={o.value}
          label={o.label}
          disabled={disabled || o.disabled}
          invalid={isInvalid}
          checked={selected.has(o.value)}
          onCheckedChange={(checked) => {
            const next = new Set(selected);
            if (checked) next.add(o.value);
            else next.delete(o.value);
            onChange(options.map((x) => x.value).filter((v) => next.has(v)));
          }}
        />
      ))}
    </div>
  );
}

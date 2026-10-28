import type { Option } from '@brume-ui/brume-schema';
import { cn } from '../cn';
import { Checkbox } from './checkbox';

export interface CheckboxGroupProps {
  options: Option[];
  value: string[];
  /** The new selection, in option order. */
  onChange(value: string[]): void;
  /** Accessible name of the group. */
  label: string;
  /** Default 'horizontal' (options wrap on narrow widths). */
  orientation?: 'horizontal' | 'vertical';
  id?: string;
}

/** Several independent choices; each option is a Checkbox, Tab moves between them. */
export function CheckboxGroup({
  options,
  value,
  onChange,
  label,
  orientation = 'horizontal',
  id,
}: CheckboxGroupProps) {
  const selected = new Set(value);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      role="group"
      aria-label={label}
      className={cn(
        'br:flex br:gap-x-5 br:gap-y-2',
        orientation === 'horizontal' ? 'br:flex-row br:flex-wrap' : 'br:flex-col',
      )}
    >
      {options.map((o) => (
        <Checkbox
          key={o.value}
          label={o.label}
          disabled={o.disabled}
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

import { cn } from '../cn';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

export interface RangeValue {
  start?: string;
  end?: string;
}

export interface RangeInputProps extends FieldControlProps {
  of: 'text' | 'number' | 'date' | 'datetime';
  value: RangeValue;
  /** Only the filled bounds are present: `{ start }` when just the start is set. */
  onChange(value: RangeValue): void;
  /** Accessible name of the group; each field is 「{label}（起）」/「{label}（迄）」. */
  label: string;
}

const INPUT_TYPE = {
  text: 'text',
  number: 'number',
  date: 'date',
  datetime: 'datetime-local',
} as const;

/**
 * Two fields, start – end, for range filters. The group carries the description and error
 * (`aria-describedby`); the invalid and required states go on both fields, which support them.
 */
export function RangeInput({
  of,
  value,
  onChange,
  label,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  invalid,
}: RangeInputProps) {
  const { t } = useBrume();
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const type = INPUT_TYPE[of];
  const field = (bound: 'start' | 'end') => (
    <input
      type={type}
      inputMode={of === 'number' ? 'decimal' : undefined}
      aria-label={t(bound === 'start' ? 'range.start' : 'range.end', { label })}
      aria-invalid={isInvalid || undefined}
      aria-required={ariaOn(ariaRequired) || undefined}
      value={value[bound] ?? ''}
      onChange={(e) => {
        const next: RangeValue = { ...value, [bound]: e.target.value };
        const out: RangeValue = {};
        if (next.start) out.start = next.start;
        if (next.end) out.end = next.end;
        onChange(out);
      }}
      className={cn(
        CONTROL_BASE,
        isInvalid ? 'br:border-danger' : CONTROL_BORDER,
        FOCUS_RING,
        'br:w-full br:min-w-0',
      )}
    />
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="br:flex br:items-center br:gap-2"
    >
      {field('start')}
      <span aria-hidden="true" className="br:shrink-0 br:text-text-muted">
        –
      </span>
      {field('end')}
    </div>
  );
}

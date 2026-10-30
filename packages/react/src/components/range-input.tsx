import { useId } from 'react';
import { cn } from '../cn';
import { useBrume } from '../provider';
import { ariaOn, type FieldControlProps } from './field';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

export interface RangeValue {
  start?: string;
  end?: string;
}

export interface RangeInputProps extends FieldControlProps {
  disabled?: boolean;
  onBlur?(): void;
  /** Per-bound messages are rendered and linked to only that bound. */
  errors?: Partial<Record<'start' | 'end', string>>;
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
 * (`aria-describedby`); native date/time bounds stack until the container can fit their editing segments.
 * The invalid and required states go on both fields, which support them.
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
  disabled,
  onBlur,
  errors,
}: RangeInputProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const { t } = useBrume();
  const isInvalid = Boolean(invalid) || ariaOn(ariaInvalid);
  const type = INPUT_TYPE[of];
  const temporal = of === 'date' || of === 'datetime';
  const field = (bound: 'start' | 'end') => (
    <div className="br:flex br:min-w-0 br:flex-1 br:flex-col br:gap-1.5">
      <input
        id={`${baseId}-${bound}`}
        disabled={disabled}
        onBlur={onBlur}
        aria-describedby={
          [describedBy, errors?.[bound] ? `${baseId}-${bound}-error` : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        type={type}
        inputMode={of === 'number' ? 'decimal' : undefined}
        aria-label={t(bound === 'start' ? 'range.start' : 'range.end', { label })}
        aria-invalid={isInvalid || Boolean(errors?.[bound]) || undefined}
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
          isInvalid || errors?.[bound] ? 'br:border-danger' : CONTROL_BORDER,
          FOCUS_RING,
          'br:w-full br:min-w-0',
        )}
      />
      {errors?.[bound] ? (
        <p id={`${baseId}-${bound}-error`} className="br:text-sm br:text-danger">
          {errors[bound]}
        </p>
      ) : null}
    </div>
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div
      id={id}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn('br:min-w-0', temporal && 'br:@container')}
    >
      <div
        className={cn(
          'br:items-center br:gap-2',
          temporal ? 'br:grid br:grid-cols-1' : 'br:flex',
          of === 'date' && 'br:@min-[400px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
          of === 'datetime' && 'br:@min-[560px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
        )}
      >
        {field('start')}
        <span
          aria-hidden="true"
          className={cn(
            'br:shrink-0 br:text-text-muted',
            temporal && 'br:hidden',
            of === 'date' && 'br:@min-[400px]:block',
            of === 'datetime' && 'br:@min-[560px]:block',
          )}
        >
          –
        </span>
        {field('end')}
      </div>
    </div>
  );
}

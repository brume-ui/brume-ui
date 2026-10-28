import { cn } from '../cn';
import { useBrume } from '../provider';
import { CONTROL_BASE, CONTROL_BORDER, FOCUS_RING } from './focus';

export interface RangeValue {
  start?: string;
  end?: string;
}

export interface RangeInputProps {
  of: 'text' | 'number' | 'date' | 'datetime';
  value: RangeValue;
  /** Only the filled bounds are present: `{ start }` when just the start is set. */
  onChange(value: RangeValue): void;
  /** Accessible name of the group; each field is 「{label}（起）」/「{label}（迄）」. */
  label: string;
  id?: string;
}

const INPUT_TYPE = {
  text: 'text',
  number: 'number',
  date: 'date',
  datetime: 'datetime-local',
} as const;

/** Two fields, start – end, for range filters. */
export function RangeInput({ of, value, onChange, label, id }: RangeInputProps) {
  const { t } = useBrume();
  const type = INPUT_TYPE[of];
  const field = (bound: 'start' | 'end') => (
    <input
      type={type}
      inputMode={of === 'number' ? 'decimal' : undefined}
      aria-label={t(bound === 'start' ? 'range.start' : 'range.end', { label })}
      value={value[bound] ?? ''}
      onChange={(e) => {
        const next: RangeValue = { ...value, [bound]: e.target.value };
        const out: RangeValue = {};
        if (next.start) out.start = next.start;
        if (next.end) out.end = next.end;
        onChange(out);
      }}
      className={cn(CONTROL_BASE, CONTROL_BORDER, FOCUS_RING, 'br:w-full br:min-w-0')}
    />
  );
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would need a visible legend; the group is named by aria-label.
    <div id={id} role="group" aria-label={label} className="br:flex br:items-center br:gap-2">
      {field('start')}
      <span aria-hidden="true" className="br:shrink-0 br:text-text-muted">
        –
      </span>
      {field('end')}
    </div>
  );
}

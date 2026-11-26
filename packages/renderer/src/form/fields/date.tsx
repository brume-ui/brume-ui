import { DateInput, Field, RangeInput, type RangeValue, TimeInput } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

/** Without `seconds` a loaded `HH:mm:ss` shows as `HH:mm`; the stored value changes only on edit. */
function shownTime(value: unknown, seconds: boolean | undefined): string {
  if (typeof value !== 'string') return '';
  return !seconds && /^[0-9]{2}:[0-9]{2}:[0-9]{2}$/.test(value) ? value.slice(0, 5) : value;
}

export function DateField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const range =
    def.type === 'dateRange' || def.type === 'datetimeRange' || def.type === 'timeRange';
  const seconds = def.type === 'time' || def.type === 'timeRange' ? def.seconds : undefined;
  const raw = value !== null && typeof value === 'object' ? (value as RangeValue) : {};
  const bounds: RangeValue =
    def.type === 'timeRange'
      ? {
          ...(raw.start ? { start: shownTime(raw.start, seconds) } : {}),
          ...(raw.end ? { end: shownTime(raw.end, seconds) } : {}),
        }
      : raw;
  if (props.readOnly) {
    return (
      <ReadOnlyField
        {...props}
        value={
          range
            ? [bounds.start, bounds.end].filter(Boolean).join(' – ')
            : def.type === 'time'
              ? shownTime(value, seconds)
              : value
        }
      />
    );
  }
  const common = {
    id,
    disabled,
    invalid: invalid && (!range || (!errors.start && !errors.end) || Boolean(errors['']?.length)),
    onBlur,
    'aria-describedby': describedBy,
  };
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0]}
      required={def.required}
      group={range}
    >
      {range ? (
        <RangeInput
          {...common}
          of={
            def.type === 'datetimeRange' ? 'datetime' : def.type === 'timeRange' ? 'time' : 'date'
          }
          seconds={seconds}
          label={def.label}
          value={bounds}
          onChange={onChange}
          errors={{ start: errors.start?.[0], end: errors.end?.[0] }}
        />
      ) : def.type === 'time' ? (
        <TimeInput
          {...common}
          label={def.label}
          seconds={seconds}
          value={shownTime(value, seconds)}
          // Cleared means nothing is stored (null), like every other empty field.
          onChange={(next) => onChange(next === '' ? null : next)}
        />
      ) : (
        <DateInput
          {...common}
          label={def.label}
          withTime={def.type === 'datetime'}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      )}
    </Field>
  );
}

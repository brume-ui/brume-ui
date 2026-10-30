import { DateInput, Field, RangeInput, type RangeValue } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

export function DateField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const range = def.type === 'dateRange' || def.type === 'datetimeRange';
  const bounds = (value ?? {}) as RangeValue;
  if (props.readOnly) {
    return (
      <ReadOnlyField
        {...props}
        value={range ? [bounds.start, bounds.end].filter(Boolean).join(' – ') : value}
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
          of={def.type === 'datetimeRange' ? 'datetime' : 'date'}
          label={def.label}
          value={bounds}
          onChange={onChange}
          errors={{ start: errors.start?.[0], end: errors.end?.[0] }}
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

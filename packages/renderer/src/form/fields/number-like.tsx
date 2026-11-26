import { Field, RangeInput, type RangeValue, Slider } from '@brume-ui/brume-react';
import { useEffect } from 'react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

export function SliderField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const editable = !props.readOnly && !disabled;
  const required = def.type === 'slider' && def.required === true;
  // The thumb of an empty slider rests on `min`, and the browser cannot "move" it there. A required
  // slider therefore adopts `min` as its value, so the answer shown is the answer stored.
  useEffect(() => {
    if (required && editable && def.type === 'slider' && (value == null || value === ''))
      onChange(def.min);
  }, [required, editable, def, value, onChange]);
  if (props.readOnly) return <ReadOnlyField {...props} />;
  if (def.type !== 'slider') return null;
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      <Slider
        id={id}
        label={def.label}
        // A non-number (corrupt data) rests at min like an empty value.
        value={typeof value === 'number' && Number.isFinite(value) ? value : null}
        min={def.min}
        max={def.max}
        step={def.step}
        disabled={disabled}
        invalid={invalid}
        onChange={onChange}
        onBlur={onBlur}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

export function RangeField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const raw = value !== null && typeof value === 'object' ? (value as RangeValue) : {};
  if (props.readOnly) {
    return <ReadOnlyField {...props} value={[raw.start, raw.end].filter(Boolean).join(' – ')} />;
  }
  if (def.type !== 'range') return null;
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0]}
      required={def.required}
      group
    >
      <RangeInput
        id={id}
        of="number"
        decimals={def.decimals}
        label={def.label}
        value={raw}
        disabled={disabled}
        invalid={invalid && ((!errors.start && !errors.end) || Boolean(errors['']?.length))}
        onBlur={onBlur}
        aria-describedby={describedBy}
        onChange={onChange}
        errors={{ start: errors.start?.[0], end: errors.end?.[0] }}
      />
    </Field>
  );
}

import { Field, IconInput } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

export function IconField(props: FieldProps) {
  if (props.readOnly) return <ReadOnlyField {...props} />;
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  if (def.type !== 'icon') return null;
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      <IconInput
        id={id}
        label={def.label}
        // An unknown or no-longer-existing name is kept as stored; only non-strings read as empty.
        value={typeof value === 'string' ? value : ''}
        icons={def.icons}
        placeholder={def.placeholder}
        disabled={disabled}
        invalid={invalid}
        onChange={(next) => onChange(next.trim() === '' ? null : next)}
        onBlur={onBlur}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

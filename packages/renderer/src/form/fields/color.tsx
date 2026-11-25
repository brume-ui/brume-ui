import { ColorInput, Field } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

export function ColorField(props: FieldProps) {
  if (props.readOnly) return <ReadOnlyField {...props} />;
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  if (def.type !== 'color') return null;
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      <ColorInput
        id={id}
        label={def.label}
        // A non-string value (corrupt data) is shown as empty.
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
        onBlur={onBlur}
        alpha={def.alpha}
        swatches={def.swatches}
        placeholder={def.placeholder}
        disabled={disabled}
        invalid={invalid}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

import { Field, StaticValue, Switch } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';

export function ReadOnlyField({ def, value, id, errors, describedBy }: FieldProps) {
  let text = value === null || value === undefined || value === '' ? '—' : String(value);
  if (def.type === 'switch' && typeof value === 'boolean') {
    text = value ? (def.onLabel ?? '開啟') : (def.offLabel ?? '關閉');
  }
  if (def.type === 'password' && text !== '—') text = '••••••••';
  if (def.type === 'currency' && text !== '—') text = `${def.symbol ?? 'NT$'} ${text}`;
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0]}
      required={def.required}
      group
    >
      <StaticValue id={id} aria-describedby={describedBy}>
        {text}
      </StaticValue>
    </Field>
  );
}

export function HiddenField() {
  return null;
}

export function SwitchField(props: FieldProps) {
  if (props.readOnly) return <ReadOnlyField {...props} />;
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      <Switch
        onBlur={onBlur}
        id={id}
        label={def.label}
        checked={value === true}
        onCheckedChange={onChange}
        disabled={disabled}
        invalid={invalid}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

import { ColorChip, Field, IconGlyph, StaticValue, Switch } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';

export function ReadOnlyField({ def, value, id, errors, describedBy }: FieldProps) {
  let text = value === null || value === undefined || value === '' ? '—' : String(value);
  // Corrupt (non-string) colour data reads as empty rather than "[object Object]".
  if ((def.type === 'color' || def.type === 'icon') && typeof value !== 'string') text = '—';
  if (def.type === 'switch' && typeof value === 'boolean') {
    text = value ? (def.onLabel ?? '開啟') : (def.offLabel ?? '關閉');
  }
  if (def.type === 'password' && text !== '—') text = '••••••••';
  if (def.type === 'currency' && text !== '—') text = `${def.symbol ?? 'NT$'} ${text}`;
  if (def.type === 'rate' && text !== '—') text = `${text}%`;
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0]}
      required={def.required}
      group
    >
      <StaticValue id={id} aria-describedby={describedBy}>
        {def.type === 'color' && text !== '—' ? <ColorChip value={value} /> : null}
        {def.type === 'icon' && text !== '—' ? (
          // The renderer may not pass className to brume-react parts, so the glyph is sized from a wrapper.
          <span className="br:mr-1.5 br:inline-flex br:size-4 br:[&_svg]:size-4">
            <IconGlyph name={text} />
          </span>
        ) : null}
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
        onLabel={def.type === 'switch' ? def.onLabel : undefined}
        offLabel={def.type === 'switch' ? def.offLabel : undefined}
        checked={value === true}
        onCheckedChange={onChange}
        disabled={disabled}
        invalid={invalid}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

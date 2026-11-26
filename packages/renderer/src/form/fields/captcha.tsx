import { CaptchaInput, Field } from '@brume-ui/brume-react';
import type { FieldProps } from '../contract';

export function CaptchaField(props: FieldProps) {
  // The answer is typed for one submit and never saved, so there is nothing to show read-only.
  if (props.readOnly) return null;
  const { def, value, id, errors, describedBy, invalid, disabled, form, onChange, onBlur } = props;
  if (def.type !== 'captcha') return null;
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      <CaptchaInput
        id={id}
        label={def.label}
        src={def.src}
        // A failed submit bumps the form's captcha version, which reloads the image.
        refreshKey={form.captchaVersion ?? 0}
        value={typeof value === 'string' ? value : ''}
        placeholder={def.placeholder}
        disabled={disabled}
        invalid={invalid}
        onChange={(next) => onChange(next === '' ? null : next)}
        onBlur={onBlur}
        aria-describedby={describedBy}
      />
    </Field>
  );
}

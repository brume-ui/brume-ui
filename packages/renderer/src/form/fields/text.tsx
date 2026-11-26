import { Field, NumberInput, PasswordInput, Textarea, TextInput } from '@brume-ui/brume-react';
import type { ReactElement } from 'react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

export function TextField(props: FieldProps) {
  if (props.readOnly) return <ReadOnlyField {...props} />;
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const common = {
    id,
    value: value == null ? '' : String(value),
    disabled,
    invalid,
    onBlur,
    placeholder: def.placeholder,
    'aria-describedby': describedBy,
  };
  const phone = def.type === 'mobile' || def.type === 'tel';
  let control: ReactElement<Record<string, unknown>>;
  if (
    def.type === 'number' ||
    def.type === 'decimal' ||
    def.type === 'currency' ||
    def.type === 'rate'
  ) {
    control = (
      <NumberInput
        {...common}
        announcePrefix={false}
        min={def.min}
        suffix={def.type === 'rate' ? '%' : undefined}
        step={def.type === 'number' ? def.step : undefined}
        decimals={
          def.type === 'number'
            ? def.step === undefined || Number.isInteger(def.step)
              ? 0
              : undefined
            : def.decimals
        }
        prefix={def.type === 'currency' ? (def.symbol ?? 'NT$') : undefined}
        aria-label={def.label}
        grouping={def.type === 'currency'}
        onChange={(next) =>
          onChange(next === '' ? null : def.type === 'number' ? Number(next) : next)
        }
      />
    );
  } else if (def.type === 'ip') {
    control = (
      <TextInput
        {...common}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => {
          // The wire value is trimmed, and a blank box stores nothing.
          const text = event.target.value.trim();
          onChange(text === '' ? null : text);
        }}
      />
    );
  } else {
    const textProps = {
      ...common,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange(event.target.value),
    };
    control =
      def.type === 'textarea' ? (
        <Textarea {...textProps} rows={def.rows} maxLength={def.maxLength} />
      ) : def.type === 'password' ? (
        <PasswordInput {...textProps} />
      ) : (
        <TextInput
          {...textProps}
          maxLength={def.type === 'text' ? def.maxLength : undefined}
          type={phone ? 'tel' : def.type}
          inputMode={phone ? 'tel' : def.type === 'url' ? 'url' : undefined}
          autoComplete={def.type === 'email' ? 'email' : phone ? 'tel' : undefined}
        />
      );
  }
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      {control}
    </Field>
  );
}

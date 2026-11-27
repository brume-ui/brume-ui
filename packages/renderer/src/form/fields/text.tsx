import {
  AutocompleteInput,
  type AutocompleteSuggestion,
  Field,
  NumberInput,
  PasswordInput,
  Textarea,
  TextInput,
} from '@brume-ui/brume-react';
import { type ReactElement, useCallback } from 'react';
import type { FieldProps } from '../contract';
import { useRemoteOptions } from '../use-remote-options';
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

/** A text value with suggestions: static `options`, or the remote loader of a remote select. */
export function AutocompleteField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const remote = def.type === 'autocomplete' ? def.remote : undefined;
  const source = useRemoteOptions({
    remote,
    form: props.form,
    path: props.path,
    rowContext: props.rowContext,
  });
  const { enabled, load: loadOptions, cancel } = source;
  const load = useCallback(
    async (q: string, signal: AbortSignal): Promise<AutocompleteSuggestion[]> => {
      // Dependencies that are not ready (or a row that is gone) offer nothing, as a remote select does.
      if (!enabled) return [];
      signal.addEventListener('abort', () => cancel('search'), { once: true });
      const { options } = await loadOptions({ q, page: 1 });
      return options.map((option) => ({ label: option.label, group: option.group }));
    },
    [enabled, loadOptions, cancel],
  );
  if (props.readOnly) return <ReadOnlyField {...props} />;
  if (def.type !== 'autocomplete') return null;
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} required={def.required}>
      <AutocompleteInput
        id={id}
        label={def.label}
        value={typeof value === 'string' ? value : ''}
        options={remote ? undefined : def.options}
        load={remote ? load : undefined}
        maxLength={def.maxLength}
        placeholder={def.placeholder}
        disabled={disabled}
        invalid={invalid}
        onBlur={onBlur}
        aria-describedby={describedBy}
        onChange={(next) => onChange(next === '' ? null : next)}
      />
    </Field>
  );
}

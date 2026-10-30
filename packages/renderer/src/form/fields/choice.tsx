import {
  CheckboxGroup,
  Combobox,
  Field,
  RadioGroup,
  Select,
  TagsInput,
} from '@brume-ui/brume-react';
import type { ReactElement } from 'react';
import type { FieldProps } from '../contract';
import { ReadOnlyField } from './misc';

export function ChoiceField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  if (!('options' in def) && def.type !== 'tags') return null;
  const options = 'options' in def ? (def.options ?? []) : [];
  const values = Array.isArray(value) ? (value as string[]) : [];
  if (props.readOnly) {
    const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
    return (
      <ReadOnlyField
        {...props}
        value={
          Array.isArray(value)
            ? values.map(labelOf).join(', ')
            : value
              ? labelOf(String(value))
              : ''
        }
      />
    );
  }
  const common = {
    id,
    disabled,
    invalid,
    onBlur,
    label: def.label,
    'aria-describedby': describedBy,
  };
  let control: ReactElement<Record<string, unknown>>;
  switch (def.type) {
    case 'select':
      control =
        options.length <= 10 && !def.searchable ? (
          <Select
            {...common}
            aria-label={def.label}
            options={options}
            value={typeof value === 'string' ? value : ''}
            onValueChange={onChange}
            placeholder={def.placeholder}
            clearable={def.clearable}
            onClear={() => onChange(null)}
          />
        ) : (
          <Combobox
            {...common}
            options={options}
            value={typeof value === 'string' ? value : ''}
            onChange={(next) => onChange(next === '' ? null : next)}
            placeholder={def.placeholder}
            clearable={def.clearable ?? false}
          />
        );
      break;
    case 'multipleSelect':
      control = (
        <Combobox
          {...common}
          multiple
          value={values}
          onChange={onChange}
          placeholder={def.placeholder}
          options={options.map((o) => ({
            ...o,
            disabled:
              o.disabled ||
              (def.max !== undefined && values.length >= def.max && !values.includes(o.value)),
          }))}
        />
      );
      break;
    case 'radio':
      control = (
        <RadioGroup
          {...common}
          options={options}
          orientation={def.orientation}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      );
      break;
    case 'checkbox':
      control = (
        <CheckboxGroup
          {...common}
          options={options}
          orientation={def.orientation}
          value={values}
          onChange={onChange}
        />
      );
      break;
    case 'tags':
      control = (
        <TagsInput
          {...common}
          options={def.options}
          max={def.max}
          maxLength={def.maxLength}
          placeholder={def.placeholder}
          value={values}
          onChange={onChange}
        />
      );
      break;
    default:
      return null;
  }
  return (
    <Field
      label={def.label}
      description={def.help}
      error={errors['']?.[0]}
      required={def.required}
      group={def.type === 'radio' || def.type === 'checkbox'}
    >
      {control}
    </Field>
  );
}

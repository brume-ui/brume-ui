import { Field, StaticValue, TextInput } from '@brume-ui/brume-react';
import { createRegistry, type DisplayProps, type FieldProps } from '@brume-ui/brume-renderer';
import type { CustomFieldDef } from '@brume-ui/brume-schema';

export interface AddressValue {
  country: string;
  city: string;
  postalCode: string;
  street: string;
}
const parts = [
  ['country', 'Country'],
  ['city', 'City'],
  ['postalCode', 'Postal code'],
  ['street', 'Street'],
] as const;

/** One public field works at the root, in an embeds, in a repeater or in a picker draft. */
export function AddressField({
  def,
  value,
  onChange,
  onBlur,
  errors,
  id,
  describedBy,
  invalid,
  readOnly,
  disabled,
}: FieldProps<AddressValue | undefined, CustomFieldDef>) {
  const address: AddressValue = { country: '', city: '', postalCode: '', street: '', ...value };
  return (
    <Field label={def.label} description={def.help} error={errors['']?.[0]} group>
      <fieldset
        id={id}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="br:grid br:min-w-0 br:gap-3"
      >
        {parts.map(([key, label]) => (
          <Field key={key} label={label} error={errors[key]?.[0]}>
            <TextInput
              id={`${id}-${key}`}
              value={address[key]}
              readOnly={readOnly}
              onBlur={onBlur}
              placeholder={
                key === 'country' ? String(def.component.props?.country ?? '') : undefined
              }
              onChange={(event) => onChange({ ...address, [key]: event.target.value })}
            />
          </Field>
        ))}
      </fieldset>
    </Field>
  );
}

export function AddressDisplay({ value }: DisplayProps) {
  const address = value as Partial<AddressValue> | null | undefined;
  return (
    <StaticValue>
      {parts
        .map(([key]) => address?.[key])
        .filter(Boolean)
        .join(', ') || '—'}
    </StaticValue>
  );
}

// A composite field stays form-only unless its author explicitly opts into inline editing.
export const addressRegistry = createRegistry({
  mode: 'vite',
  fields: { Address: AddressField },
  displays: { Address: AddressDisplay },
});

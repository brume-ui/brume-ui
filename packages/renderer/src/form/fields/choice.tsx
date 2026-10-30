import {
  CheckboxGroup,
  Combobox,
  Field,
  RadioGroup,
  Select,
  TagsInput,
  useBrume,
} from '@brume-ui/brume-react';
import type { OptionItem } from '@brume-ui/brume-schema';
import { type ReactElement, useEffect, useState } from 'react';
import type { FieldProps } from '../contract';
import { excludedChoiceValues } from '../exclusions';
import { useRemoteOptions } from '../use-remote-options';
import { ReadOnlyField } from './misc';

export function ChoiceField(props: FieldProps) {
  const { def, value, id, errors, describedBy, invalid, disabled, onChange, onBlur } = props;
  const remote = 'remote' in def ? def.remote : undefined;
  const source = useRemoteOptions({
    remote,
    form: props.form,
    path: props.path,
    rowContext: props.rowContext,
  });
  const excluded = excludedChoiceValues(props.form.fields, props.form.values, props.path);
  const selection = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const blocked = (v: string) => excluded.has(v) && !selection.includes(v);
  const remoteProps = remote
    ? {
        load: source.load,
        resolveLabels: source.resolveLabels,
        scopeKey: source.scopeKey,
        cancelLabels: () => source.cancel('labels'),
        cancelLoad: () => source.cancel('search'),
      }
    : {};
  if (!('options' in def) && !remote && def.type !== 'tags') return null;
  const options = ('options' in def ? (def.options ?? []) : []).map((o) => ({
    ...o,
    disabled: o.disabled || blocked(o.value),
  }));
  const values = Array.isArray(value) ? (value as string[]) : [];
  if (props.readOnly && remote) return <RemoteReadOnlyChoice {...props} source={source} />;
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
        !remote && options.length <= 10 && !def.searchable ? (
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
            {...remoteProps}
            optionDisabled={blocked}
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
          {...remoteProps}
          optionDisabled={(v) =>
            blocked(v) || (def.max !== undefined && values.length >= def.max && !values.includes(v))
          }
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
          {...remoteProps}
          blockedValues={[...excluded]}
          options={remote || !('options' in def) || def.options === undefined ? undefined : options}
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

function RemoteReadOnlyChoice(props: FieldProps & { source: ReturnType<typeof useRemoteOptions> }) {
  const { t } = useBrume();
  const { source, value } = props;
  const values = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string' && value
      ? [value]
      : [];
  const valuesKey = JSON.stringify(values);
  const [labels, setLabels] = useState<{
    scope: unknown;
    key: string;
    items: OptionItem[];
    missing: string[];
  }>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit scope and selected IDs own hydration.
  useEffect(() => {
    let current = true;
    setFailed(false);
    setLoading(values.length > 0);
    if (values.length)
      source.resolveLabels(values).then(
        (items) => {
          if (current) {
            setLoading(false);
            setLabels({
              scope: source.scopeKey,
              key: valuesKey,
              items,
              missing: values.filter((v) => !items.some((item) => item.value === v)),
            });
          }
        },
        () => {
          if (current) {
            setLoading(false);
            setFailed(true);
          }
        },
      );
    return () => {
      current = false;
      source.cancel('labels');
    };
  }, [source.scopeKey, valuesKey, retry]);
  const labelOf = (id: string) =>
    labels?.scope === source.scopeKey && labels.key === valuesKey
      ? (labels.items.find((item) => item.value === id)?.label ??
        t('combobox.unavailable', { value: id }))
      : id;
  return (
    <>
      <ReadOnlyField {...props} value={values.map(labelOf).join(', ')} />
      {loading ? <div role="status">{t('common.loading')}</div> : null}
      {failed ? (
        <div role="status">
          {t('combobox.loadFailed')}{' '}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            {t('combobox.retry')}
          </button>
        </div>
      ) : null}
      {labels?.scope === source.scopeKey && labels.key === valuesKey && labels.missing.length ? (
        <div role="status">{labels.missing.map(labelOf).join(', ')}</div>
      ) : null}
    </>
  );
}

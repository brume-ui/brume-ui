import {
  type BrumeAdapter,
  CheckboxGroup,
  Combobox,
  type ComboboxLoader,
  DateInput,
  RadioGroup,
  RangeInput,
  Select,
  TextInput,
  useBrume,
} from '@brume-ui/brume-react';
import type { FilterDef, FilterValue, OptionItem, OptionsResponse } from '@brume-ui/brume-schema';
import { useMemo, useState } from 'react';
import { RemoteRelationPicker } from '../../form/relation-source';
import { useRemoteOptions } from '../../form/use-remote-options';
import { useGrid } from '../grid-context';

/** Remote options come 20 at a time. */
const OPTIONS_PER_PAGE = 20;

function optionsUrl(endpoint: string, source: string): string {
  return endpoint.replaceAll('{source}', () => encodeURIComponent(source));
}

async function requestOptions(
  adapter: BrumeAdapter,
  url: string,
  query: Record<string, string | string[]>,
): Promise<OptionsResponse> {
  const res = await adapter.request<OptionsResponse>({ method: 'get', url, query });
  if (res.status !== 200) throw new Error(`Options request failed (${res.status}).`);
  return res.data;
}

/** Combobox loader for a remote filter: `GET {options}?q=&page=&per_page=20`, via the adapter. */
export function remoteLoader(
  endpoint: string,
  source: string,
  adapter: BrumeAdapter,
): ComboboxLoader {
  const url = optionsUrl(endpoint, source);
  return async ({ q, page }) => {
    const data = await requestOptions(adapter, url, {
      q,
      page: String(page),
      per_page: String(OPTIONS_PER_PAGE),
    });
    return { options: data.data, hasMore: data.pagination.hasMore };
  };
}

/** Labels of values already chosen (from the URL): `GET {options}?value[]=…`. */
export function remoteLabels(
  endpoint: string,
  source: string,
  adapter: BrumeAdapter,
): (values: string[]) => Promise<OptionItem[]> {
  const url = optionsUrl(endpoint, source);
  return async (values) => (await requestOptions(adapter, url, { value: values })).data;
}

// A filter value read from the URL may not have the shape its input expects; read it leniently.
export const filterText = (v: FilterValue | undefined): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : '';
export const filterList = (v: FilterValue | undefined): string[] =>
  Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
const filterRange = (v: FilterValue | undefined): { start?: string; end?: string } =>
  v && typeof v === 'object' && !Array.isArray(v) && !('op' in v) ? v : {};
const filterCondition = (v: FilterValue | undefined): { op: string; value: string } | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) && 'op' in v ? v : undefined;

/** `filters` with `key` set to `value`, or without `key` when `value` is undefined. */
export function withFilter(
  filters: Record<string, FilterValue>,
  key: string,
  value: FilterValue | undefined,
): Record<string, FilterValue> {
  const next = { ...filters };
  delete next[key];
  if (value !== undefined) next[key] = value;
  return next;
}

export interface FilterInputControlProps {
  def: FilterDef;
  value: FilterValue | undefined;
  /** `undefined` when the input is empty (the filter is off). */
  onChange(value: FilterValue | undefined): void;
  /** Set by Field so its label points at the control. */
  id?: string;
  'aria-describedby'?: string;
  /** Set by Field (with `group`) for radio, checkbox and range inputs. */
  'aria-labelledby'?: string;
}

/** The input for one filter, chosen by `def.input.type`. */
export function FilterInputControl({
  def,
  value,
  onChange,
  id,
  'aria-describedby': describedBy,
  'aria-labelledby': labelledBy,
}: FilterInputControlProps) {
  const { input, label } = def;
  switch (input.type) {
    case 'text':
      return (
        <TextInput
          id={id}
          aria-describedby={describedBy}
          aria-label={label}
          inputMode={input.inputMode === 'numeric' ? 'numeric' : undefined}
          placeholder={input.placeholder}
          value={filterText(value)}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    case 'select':
    case 'multipleSelect':
      return (
        <SelectFilter
          def={def}
          value={value}
          onChange={onChange}
          id={id}
          describedBy={describedBy}
        />
      );
    case 'selectTable':
    case 'multipleSelectTable':
      return (
        <fieldset
          id={id}
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className="br:min-w-0"
        >
          <TableFilter def={def} value={value} onChange={onChange} />
        </fieldset>
      );
    case 'radio':
      return (
        <RadioGroup
          id={id}
          aria-labelledby={labelledBy}
          label={label}
          options={input.options}
          value={filterText(value)}
          onChange={(v) => onChange(v || undefined)}
        />
      );
    case 'checkbox':
      return (
        <CheckboxGroup
          id={id}
          aria-labelledby={labelledBy}
          label={label}
          options={input.options}
          value={filterList(value)}
          onChange={(v) => onChange(v.length > 0 ? v : undefined)}
        />
      );
    case 'date':
      return (
        <DateInput
          id={id}
          aria-describedby={describedBy}
          label={label}
          withTime={input.withTime}
          value={filterText(value)}
          onChange={(v) => onChange(v || undefined)}
        />
      );
    case 'range':
      return (
        <RangeInput
          id={id}
          aria-labelledby={labelledBy}
          of={input.of}
          label={label}
          value={filterRange(value)}
          onChange={(v) => onChange(v.start || v.end ? v : undefined)}
        />
      );
    case 'group':
      return (
        <ConditionFilter
          def={def}
          value={value}
          onChange={onChange}
          id={id}
          describedBy={describedBy}
        />
      );
  }
}

interface PartProps {
  def: FilterDef;
  value: FilterValue | undefined;
  onChange(value: FilterValue | undefined): void;
  id?: string;
  describedBy?: string;
}

/** Local options filtered as you type, or remote ones through `endpoints.options`. */
function SelectFilter({ def, value, onChange, id, describedBy }: PartProps) {
  const { page } = useGrid();
  const { adapter } = useBrume();
  const input = def.input as Extract<FilterDef['input'], { type: 'select' | 'multipleSelect' }>;
  const multiple = input.type === 'multipleSelect';
  const endpoint = input.remote ? page.endpoints?.options : undefined;
  const remote = useMemo(
    () =>
      endpoint
        ? {
            load: remoteLoader(endpoint, def.key, adapter),
            resolveLabels: remoteLabels(endpoint, def.key, adapter),
          }
        : undefined,
    [endpoint, def.key, adapter],
  );
  return (
    <Combobox
      id={id}
      aria-describedby={describedBy}
      label={def.label}
      multiple={multiple}
      options={remote ? undefined : (input.options ?? [])}
      load={remote?.load}
      resolveLabels={remote?.resolveLabels}
      value={multiple ? filterList(value) : filterText(value)}
      onChange={(v) => onChange(Array.isArray(v) ? (v.length > 0 ? v : undefined) : v || undefined)}
    />
  );
}

/** An operator (e.g. 大於) and a value; the filter is on only while the value is filled. */
function ConditionFilter({ def, value, onChange, id, describedBy }: PartProps) {
  const { t } = useBrume();
  const input = def.input as Extract<FilterDef['input'], { type: 'group' }>;
  const condition = filterCondition(value);
  // The chosen operator survives an empty value, so picking it first and typing second works.
  const [pickedOp, setPickedOp] = useState(input.operators[0]?.value ?? '');
  const op = condition?.op ?? pickedOp;
  return (
    <div className="br:flex br:gap-2">
      <div className="br:w-32 br:shrink-0">
        <Select
          aria-label={t('grid.filterOperator', { label: def.label })}
          options={input.operators}
          value={op}
          onValueChange={(next) => {
            setPickedOp(next);
            if (condition) onChange({ op: next, value: condition.value });
          }}
        />
      </div>
      <div className="br:min-w-0 br:flex-1">
        <TextInput
          id={id}
          aria-describedby={describedBy}
          aria-label={def.label}
          inputMode={input.of === 'number' ? 'decimal' : undefined}
          value={condition?.value ?? ''}
          onChange={(e) => onChange(e.target.value ? { op, value: e.target.value } : undefined)}
        />
      </div>
    </div>
  );
}

/** Picker filters use the server-declared filter key and the shared standalone source. */
function TableFilter({ def, value, onChange }: PartProps) {
  const { page } = useGrid();
  const endpoint = page.endpoints?.options;
  const source = useRemoteOptions({
    remote: endpoint ? { url: optionsUrl(endpoint, def.key) } : undefined,
    ownerKey: `${page.gridId}:${def.key}`,
    resetKey: JSON.stringify(page.query.filters),
  });
  const multiple = def.input.type === 'multipleSelectTable';
  const ids = multiple ? filterList(value) : filterText(value) ? [filterText(value)] : [];
  return (
    <RemoteRelationPicker
      label={def.label}
      multiple={multiple}
      source={source}
      value={ids.map((id) => ({ id }))}
      onChange={(next) =>
        onChange(multiple ? (next.length ? next.map((item) => item.id) : undefined) : next[0]?.id)
      }
    />
  );
}

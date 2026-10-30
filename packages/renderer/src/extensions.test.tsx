import { TextInput, Toaster } from '@brume-ui/brume-react';
import type { CustomFieldDef, FormDef, ListPage } from '@brume-ui/brume-schema';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, memo } from 'react';
import { describe, expect, it } from 'vitest';
import type { FieldProps } from './form/contract';
import { Nodes } from './form/layout/nodes';
import { type FormApi, useFormState } from './form/use-form-state';
import { GridView } from './grid/grid-view';
import { createRegistry, type DisplayProps } from './registry';
import { RegistryProvider } from './registry-context';
import { renderWithBrume } from './test-utils';

type AddressProps = FieldProps<{ city?: string; country?: string } | undefined, CustomFieldDef>;
function Address({
  value,
  onChange,
  onBlur,
  errors,
  id,
  def,
  form,
  readOnly,
  disabled,
}: AddressProps) {
  return (
    <div>
      <TextInput
        id={id}
        aria-label={def.label}
        value={value?.city ?? ''}
        readOnly={readOnly}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => onChange({ city: event.target.value, country: 'TW' })}
      />
      <span>{errors.city?.[0] ?? errors['']?.[0]}</span>
      <output>
        {form.definition.nodes.length}:{String(def.component.props?.country)}
      </output>
    </div>
  );
}
const Memo = memo(Address);
const Ref = forwardRef<HTMLInputElement, FieldProps>((props, ref) => (
  <input ref={ref} aria-label={props.def.label} />
));
const Text = forwardRef<HTMLInputElement, FieldProps<string | undefined, CustomFieldDef>>(
  ({ value, onChange, errors, def, disabled, form }, ref) => (
    <>
      <input
        ref={ref}
        aria-label={def.label}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <span>{errors['']?.[0]}</span>
      <output>{form.getValue('id') as number}</output>
    </>
  ),
);
const Display = ({ value, row, column, props }: DisplayProps) => (
  <span>{`${(value as { city: string }).city}:${row.id}:${column}:${props.country}`}</span>
);
const Legacy = ({
  prefix,
  context,
}: {
  prefix: string;
  context: { row: { id: number }; column: string };
}) => <span>{`${prefix}:${context.row.id}:${context.column}`}</span>;
let oldChange: AddressProps['onChange'];
function DelayedAddress(props: AddressProps) {
  if (props.value?.city === 'B') oldChange = props.onChange;
  return <Address {...props} />;
}
const component = { type: 'component' as const, name: 'Address', props: { country: 'TW' } };
const form: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'repeater',
        mode: 'json',
        name: 'rows',
        label: 'Rows',
        sortable: true,
        nodes: [
          {
            type: 'field',
            field: { type: 'custom', name: 'address', label: 'Address', component },
          },
        ],
      },
    },
  ],
};
let api: FormApi;
function Harness({ definition = form }: { definition?: FormDef }) {
  api = useFormState(definition, {
    rows: [
      { _brume: { key: 'a' }, address: { city: 'A' } },
      { _brume: { key: 'b' }, address: { city: 'B' } },
    ],
  });
  return <Nodes nodes={definition.nodes} api={api} idPrefix="test" layout="stacked" />;
}
const page: ListPage = {
  type: 'list',
  title: 'List',
  gridId: 'list',
  columns: [{ key: 'address', label: 'Address', editor: { type: 'custom', component } }],
  rows: [{ id: 1, address: { city: 'Taipei', country: 'TW' } }],
  pagination: { page: 1, perPage: 20, total: 1, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  endpoints: { cell: '/cells/{id}' },
};

describe('public extensions', () => {
  it('normalizes explicit metadata and exotic components without inheriting registrations', () => {
    const registry = createRegistry({
      mode: 'vite',
      fields: { Address, Memo, Ref, Eligible: { component: Address, inlineEditable: true } },
    });
    expect(registry.getField('Address')).toEqual({ component: Address, inlineEditable: false });
    expect(registry.getField('Memo')?.component).toBe(Memo);
    expect(registry.getField('Ref')?.component).toBe(Ref);
    expect(registry.getField('Eligible')?.inlineEditable).toBe(true);
    const inherited = createRegistry({
      mode: 'vite',
      fields: Object.create({ Address }),
      displays: Object.create({ Address: Display }),
    });
    expect(inherited.getField('Address')).toBeUndefined();
    expect(inherited.getDisplay('Address')).toBeUndefined();
    expect(createRegistry({ mode: 'vite' }).getDisplay('Address')).toBeUndefined();
    for (const name of ['toString', 'constructor', '__proto__']) {
      expect(registry.getField(name)).toBeUndefined();
      expect(registry.getDisplay(name)).toBeUndefined();
    }
  });
  it('renders one registration inside a real repeater with relative errors and current-owner writes', () => {
    renderWithBrume(<Harness />, {
      registry: createRegistry({ mode: 'vite', fields: { Address: Memo } }),
    });
    act(() => api.setServerErrors({ 'rows.1.address.city': ['City is unavailable'] }));
    const b = screen.getByDisplayValue('B');
    expect(screen.getByText('City is unavailable')).toBeTruthy();
    act(() => {
      api.moveRow('rows', 1, 0);
      fireEvent.change(b, { target: { value: 'Moved' } });
    });
    expect(api.getValue('rows.0.address')).toEqual({ city: 'Moved', country: 'TW' });
    expect(api.getValue('rows.1.address')).toEqual({ city: 'A' });
    expect(screen.getAllByText('1:TW')).toHaveLength(2);
  });
  it('isolates provider registrations and diagnoses missing custom fields', () => {
    renderWithBrume(
      <>
        <section aria-label="registered">
          <Harness />
        </section>
        <RegistryProvider registry={createRegistry({ mode: 'precompiled' })}>
          <section aria-label="missing">
            <Harness />
          </section>
        </RegistryProvider>
      </>,
      { registry: createRegistry({ mode: 'vite', fields: { Address } }) },
    );
    expect(
      within(screen.getByRole('region', { name: 'registered' })).getAllByRole('textbox'),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole('region', { name: 'missing' })).getAllByRole('alert'),
    ).toHaveLength(2);
  });
  it('resolves new display props while retaining legacy spread props and context', () => {
    const displayPage = {
      ...page,
      columns: [
        { key: 'address', label: 'Address', display: component },
        {
          key: 'legacy',
          label: 'Legacy',
          display: { type: 'component' as const, name: 'Legacy', props: { prefix: 'old' } },
        },
      ],
    };
    renderWithBrume(<GridView page={displayPage} />, {
      registry: createRegistry({
        mode: 'vite',
        displays: {
          Address: Display,
        },
        components: {
          Legacy,
        },
      }),
    });
    expect(screen.getByText('Taipei:1:address:TW')).toBeTruthy();
    expect(screen.getByText('old:1:legacy')).toBeTruthy();
  });
  it('requires explicit eligibility and submits the exact custom wire value with relative 422 errors', async () => {
    const registry = createRegistry({
      mode: 'vite',
      fields: { Address: { component: Address, inlineEditable: true } },
    });
    let attempts = 0;
    const result = renderWithBrume(<GridView page={page} />, {
      registry,
      respond: (request) => {
        attempts++;
        return attempts === 1
          ? { status: 422, data: { errors: { 'address.city': ['Choose another city'] } } }
          : {
              status: 200,
              data: { row: { id: 1, address: (request.body as { value: unknown }).value } },
            };
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /編輯Address/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'Tainan' },
    });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    expect(await screen.findByText('Choose another city')).toBeTruthy();
    expect(screen.getByDisplayValue('Tainan')).toBeTruthy();
    expect(result.adapter.calls.filter((call) => call.fn === 'request')[0]?.args[0]).toMatchObject({
      method: 'patch',
      url: '/cells/1',
      body: { column: 'address', value: { city: 'Tainan', country: 'TW' } },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'Kaohsiung' },
    });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await screen.findByRole('button', { name: /編輯Address/ });
    expect(result.adapter.calls.filter((call) => call.fn === 'request')[1]?.args[0]).toMatchObject({
      body: { column: 'address', value: { city: 'Kaohsiung', country: 'TW' } },
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /編輯Address/ }));
  });
  it('does not edit plain registrations', () => {
    renderWithBrume(<GridView page={page} />, {
      registry: createRegistry({ mode: 'vite', fields: { Address } }),
    });
    expect(screen.queryByRole('button', { name: /編輯Address/ })).toBeNull();
  });
  it('cancels a draft with Escape, restores focus and starts the next session from the confirmed value', () => {
    const registry = createRegistry({
      mode: 'vite',
      fields: { Address: { component: Address, inlineEditable: true } },
    });
    const { adapter } = renderWithBrume(<GridView page={page} />, { registry });
    fireEvent.click(screen.getByRole('button', { name: /編輯Address/ }));
    const input = screen.getByRole('textbox', { name: 'Address' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Unsaved' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /編輯Address/ }));
    fireEvent.click(screen.getByRole('button', { name: /編輯Address/ }));
    expect(screen.getByDisplayValue('Taipei')).toBeTruthy();
  });
  it('validates declared rules and prevents duplicate saves while the actual form session is submitting', async () => {
    const registry = createRegistry({
      mode: 'vite',
      fields: { Address: { component: Text, inlineEditable: true } },
    });
    const textPage: ListPage = {
      ...page,
      rows: [{ id: 1, address: '12' }],
      columns: [
        {
          key: 'address',
          label: 'Address',
          editor: {
            type: 'custom',
            component,
            rules: [{ rule: 'numeric', message: 'Use a number' }],
          },
        },
      ],
    };
    let finish!: (value: {
      status: number;
      data: { row: { id: number; address: string } };
    }) => void;
    const { adapter } = renderWithBrume(<GridView page={textPage} />, {
      registry,
      respond: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    fireEvent.click(screen.getByRole('button', { name: /編輯Address/ }));
    const input = screen.getByRole('textbox', { name: 'Address' });
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    expect(screen.getByText('Use a number')).toBeTruthy();
    expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(0);
    fireEvent.change(input, { target: { value: '25' } });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '儲存' }).hasAttribute('disabled')).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(true);
    await act(async () => finish({ status: 200, data: { row: { id: 1, address: '25' } } }));
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });
  it('rejects a removed custom owner callback even when the same row key returns in the same event', () => {
    renderWithBrume(<Harness />, {
      registry: createRegistry({ mode: 'vite', fields: { Address: DelayedAddress } }),
    });
    act(() => {
      api.removeRow('rows', 1);
      api.setValue('rows', [
        ...(api.getValue('rows') as unknown[]),
        { _brume: { key: 'b' }, address: { city: 'Replacement' } },
      ]);
      oldChange({ city: 'Late response' });
    });
    expect(api.getValue('rows.1.address')).toEqual({ city: 'Replacement' });
  });
  it('keeps display-only custom calculations outside persisted state even if they emit onChange', () => {
    const definition: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'custom',
            name: 'address',
            label: 'Address',
            component,
            displayOnly: true,
          },
        },
      ],
    };
    renderWithBrume(<Harness definition={definition} />, {
      registry: createRegistry({ mode: 'vite', fields: { Address } }),
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'Calculation' },
    });
    expect(api.getValue('address')).toBeUndefined();
    expect(api.dirty).toBe(false);
  });
  it.each(['en', 'zh-TW', 'zh-CN'] as const)(
    'explains the project registration/build path in %s without resolving inherited component names',
    (locale) => {
      const definition: FormDef = {
        layout: 'stacked',
        nodes: [
          {
            type: 'field',
            field: {
              type: 'custom',
              name: 'address',
              label: 'Address',
              component: { type: 'component', name: 'constructor' },
            },
          },
        ],
      };
      const result = renderWithBrume(<Harness definition={definition} />, {
        locale,
        registry: createRegistry({ mode: 'vite' }),
      });
      expect(screen.getByRole('alert').textContent).toContain('createRegistry');
      expect(screen.queryByRole('textbox')).toBeNull();
      result.rerender(
        <RegistryProvider registry={createRegistry({ mode: 'precompiled' })}>
          <Harness definition={definition} />
        </RegistryProvider>,
      );
      expect(screen.getByRole('alert').textContent).toContain(
        'php artisan brume:install --frontend',
      );
    },
  );
  it('keeps mixed 422 request errors visible without trapping an otherwise corrected field draft', async () => {
    let attempts = 0;
    const registry = createRegistry({
      mode: 'vite',
      fields: { Address: { component: Address, inlineEditable: true } },
    });
    const result = renderWithBrume(
      <>
        <GridView page={page} />
        <Toaster />
      </>,
      {
        registry,
        respond: () => {
          attempts++;
          return attempts === 1
            ? {
                status: 422,
                data: {
                  message: 'Request invalid',
                  errors: { 'address.city': ['Invalid city'], value: ['Invalid envelope'] },
                },
              }
            : { status: 200, data: { row: { id: 1, address: { city: 'Fixed' } } } };
        },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /編輯Address/ }));
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    expect(await screen.findByText('Invalid city')).toBeTruthy();
    expect(await screen.findByText('操作沒有完成：Request invalid')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'Fixed' },
    });
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await screen.findByRole('button', { name: /編輯Address/ });
    expect(result.adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(2);
  });
  it.each(['value', 'column', 'other'])(
    'retains the draft and request feedback for an unrelated-only 422 on %s',
    async (key) => {
      let attempts = 0;
      const registry = createRegistry({
        mode: 'vite',
        fields: { Address: { component: Address, inlineEditable: true } },
      });
      const { adapter } = renderWithBrume(
        <>
          <GridView page={page} />
          <Toaster />
        </>,
        {
          registry,
          respond: () => {
            attempts++;
            return attempts === 1
              ? {
                  status: 422,
                  data: {
                    message: `Invalid envelope ${key}`,
                    errors: { [key]: ['Rejected request'] },
                  },
                }
              : { status: 200, data: { row: { id: 1, address: { city: 'Draft' } } } };
          },
        },
      );
      fireEvent.click(screen.getByRole('button', { name: /編輯Address/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
        target: { value: 'Draft' },
      });
      fireEvent.click(screen.getByRole('button', { name: '儲存' }));
      expect(await screen.findByText(`操作沒有完成：Invalid envelope ${key}`)).toBeTruthy();
      expect(screen.getByDisplayValue('Draft')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '儲存' }));
      await screen.findByRole('button', { name: /編輯Address/ });
      expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(2);
    },
  );
  it('allows keyboard activation of Cancel without treating its Enter as a save', async () => {
    const user = userEvent.setup();
    const registry = createRegistry({
      mode: 'vite',
      fields: { Address: { component: Address, inlineEditable: true } },
    });
    const { adapter } = renderWithBrume(<GridView page={page} />, { registry });
    await user.click(screen.getByRole('button', { name: /編輯Address/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Address' }), {
      target: { value: 'Cancelled' },
    });
    screen.getByRole('button', { name: '取消' }).focus();
    await user.keyboard('{Enter}');
    expect(adapter.calls.filter((call) => call.fn === 'request')).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /編輯Address/ }));
  });
});

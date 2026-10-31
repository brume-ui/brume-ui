import { BrumeProvider, Button, createMemoryAdapter, useBrume } from '@brume-ui/brume-react';
import { FormView, GridView, RegistryProvider, useFormState } from '@brume-ui/brume-renderer';
import type { FieldDef, FormDef, ListPage } from '@brume-ui/brume-schema';
import { useMemo, useState } from 'react';
import { addressRegistry } from './custom-address';
import { Page, Panel } from './page';

const field = (field: FieldDef) => ({ type: 'field' as const, field });
const form: FormDef = {
  layout: 'stacked',
  nodes: [
    field({
      type: 'custom',
      name: 'address',
      label: 'Delivery address',
      component: { type: 'component', name: 'TaiwanAddress' },
    }),
    field({ type: 'switch', name: 'delivery', label: 'Delivery required' }),
    field({
      type: 'text',
      name: 'instructions',
      label: 'Delivery instructions',
      rules: [{ rule: 'required', message: 'Required' }],
      showWhen: { op: 'eq', field: { scope: 'root', path: 'delivery' }, value: true },
    }),
    field({
      type: 'select',
      name: 'category',
      label: 'Composition category',
      options: [
        { value: 'A', label: 'Category A' },
        { value: 'B', label: 'Category B' },
      ],
    }),
    field({
      type: 'select',
      name: 'choice',
      label: 'Dependent choice',
      remote: {
        url: '/composition/options',
        dependsOn: { category: { scope: 'root', path: 'category' } },
      },
    }),
    field({
      type: 'repeater',
      name: 'notes',
      label: 'JSON notes',
      mode: 'json',
      sortable: true,
      nodes: [
        field({
          type: 'text',
          name: 'message',
          label: 'JSON message',
          rules: [{ rule: 'required', message: 'Required' }],
        }),
        field({
          type: 'repeater',
          name: 'labels',
          label: 'JSON labels',
          mode: 'json',
          sortable: true,
          nodes: [field({ type: 'text', name: 'text', label: 'JSON label' })],
        }),
      ],
    }),
    field({
      type: 'repeater',
      name: 'tiers',
      label: 'Tiers',
      mode: 'relation',
      sortable: true,
      nodes: [
        field({ type: 'text', name: 'name', label: 'Tier name' }),
        field({
          type: 'repeater',
          name: 'thresholds',
          label: 'Thresholds',
          mode: 'relation',
          sortable: true,
          nodes: [
            field({ type: 'currency', name: 'amount', label: 'Threshold amount', decimals: 2 }),
            field({
              type: 'relation',
              name: 'gifts',
              label: 'Composition gifts',
              multiple: true,
              remote: { url: '/composition/picker' },
              fields: [field({ type: 'number', name: 'quantity', label: 'Gift quantity' })],
            }),
          ],
        }),
      ],
    }),
  ],
};
const initial = {
  address: { zipcode: '100', county: 'Taipei', district: 'Zhongzheng', address: 'Example road' },
  delivery: false,
  instructions: '',
  category: 'A',
  choice: '7',
  notes: [
    {
      _brume: { key: 'n1' },
      message: 'Original JSON',
      labels: [{ _brume: { key: 'l1' }, text: 'Original label' }],
    },
  ],
  tiers: [
    {
      _brume: { key: 't1', id: '1' },
      name: 'First tier',
      thresholds: [
        { _brume: { key: 'h1', id: '1' }, amount: '100.00', gifts: [{ id: '1', quantity: 2 }] },
      ],
    },
  ],
};
const grid: ListPage = {
  type: 'list',
  title: 'Composition Grid picker filters',
  gridId: 'composition-grid',
  columns: [{ key: 'name', label: 'Name' }],
  rows: [{ id: 1, name: 'Composition' }],
  pagination: { page: 1, perPage: 20, total: 1, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  filters: {
    columns: 1,
    items: [
      {
        key: 'one',
        label: 'Single product filter',
        placement: 'panel',
        input: { type: 'selectTable' },
      },
      {
        key: 'many',
        label: 'Multiple product filter',
        placement: 'panel',
        input: { type: 'multipleSelectTable' },
      },
    ],
  },
  endpoints: { options: '/composition/{source}' },
};
export function FormCompositionPage() {
  const { locale } = useBrume();
  const [visited, setVisited] = useState('');
  const adapter = useMemo(() => {
    const base = createMemoryAdapter('/composition', {
      respond: async (request) => {
        const category = JSON.parse(String(request.query?.depends ?? '{}')).category ?? 'A';
        await new Promise((resolve) => setTimeout(resolve, category === 'A' ? 200 : 20));
        const options = Array.from({ length: 24 }, (_, i) => ({
          value: String(i + 1),
          label: `${category} product ${i + 1}`,
        }));
        const ids = request.query?.value;
        const page = Number(request.query?.page ?? 1);
        return {
          status: 200,
          data: {
            data: Array.isArray(ids)
              ? options.filter((item) => ids.includes(item.value))
              : options.slice((page - 1) * 20, page * 20),
            pagination: { page, perPage: 20, hasMore: !Array.isArray(ids) && page === 1 },
          },
        };
      },
    });
    return {
      ...base,
      visit(url: string) {
        base.visit(url);
        setVisited(url);
      },
    };
  }, []);
  return (
    <BrumeProvider locale={locale} adapter={adapter}>
      <RegistryProvider registry={addressRegistry}>
        <Composition />
        <output data-testid="composition-url" style={{ overflowWrap: 'anywhere' }}>
          {visited}
        </output>
      </RegistryProvider>
    </BrumeProvider>
  );
}
function Composition() {
  const api = useFormState(form, initial);
  const [saved, setSaved] = useState('');
  return (
    <Page
      name="form-composition"
      title="Composition acceptance"
      lead="JSON notes, model-owned nested tiers, picker extras and custom fields use the public renderer."
    >
      <Panel>
        <FormView form={form} api={api} />
        <Button
          onClick={() => {
            if (api.validateAll()) setSaved(JSON.stringify(api.values));
          }}
        >
          Save composition
        </Button>
        <p role="status">{saved ? 'Composition saved' : ''}</p>
        <details>
          <summary>Saved values (diagnostic)</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <output data-testid="composition-saved">{saved}</output>
          </pre>
        </details>
      </Panel>
      <Panel>
        <GridView page={grid} />
      </Panel>
    </Page>
  );
}

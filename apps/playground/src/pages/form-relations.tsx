import {
  BrumeProvider,
  Button,
  createMemoryAdapter,
  type HttpRequest,
  useBrume,
} from '@brume-ui/brume-react';
import {
  FormDialog,
  FormView,
  GridView,
  resolveField,
  useFormState,
} from '@brume-ui/brume-renderer';
import type {
  FieldDef,
  FormDef,
  FormPage,
  ListPage,
  OptionItem,
  OptionsResponse,
  PickerSearchResponse,
} from '@brume-ui/brume-schema';
import { useMemo, useRef, useState } from 'react';
import { Page, Panel } from './page';

const categories = [
  { value: 'A', label: 'Category A' },
  { value: 'B', label: 'Category B' },
  { value: 'C', label: 'Category C (7 unavailable)' },
];
const picker: FieldDef = {
  type: 'relation',
  name: 'selection',
  label: 'Related products',
  multiple: true,
  remote: {
    url: '/demo/options/picker',
    dependsOn: { category: { scope: 'root', path: 'category' } },
  },
  fields: [
    { type: 'field', field: { type: 'text', name: 'quantity', label: 'Quantity' } },
    { type: 'field', field: { type: 'text', name: 'note', label: 'Selection note' } },
  ],
};
const rootFields: FieldDef[] = [
  picker,
  { type: 'select', name: 'category', label: 'Category', options: categories },
  {
    type: 'select',
    name: 'parent',
    label: 'Remote parent category',
    clearable: true,
    remote: {
      url: '/demo/options/categories',
      dependsOn: { category: { scope: 'root', path: 'category' } },
    },
  },
  {
    type: 'multipleSelect',
    name: 'products',
    label: 'Remote child products',
    remote: {
      url: '/demo/options/products',
      dependsOn: {
        category: { scope: 'root', path: 'category' },
        parent: { scope: 'root', path: 'parent' },
      },
    },
  },
  {
    type: 'tags',
    name: 'tags',
    label: 'Remote tag suggestions (free text)',
    remote: {
      url: '/demo/options/products',
      dependsOn: { category: { scope: 'root', path: 'category' } },
    },
  },
];
const rowChoice: FieldDef = {
  type: 'select',
  name: 'product',
  label: 'Exclusive row product',
  clearable: true,
  excludeSelectedIn: [{ scope: 'root', path: 'rows.*.product' }],
  remote: {
    url: '/demo/options/products',
    dependsOn: { category: { scope: 'root', path: 'category' } },
  },
};
const form: FormDef = {
  layout: 'stacked',
  nodes: [
    ...rootFields.map((field) => ({ type: 'field' as const, field })),
    {
      type: 'field',
      field: {
        type: 'repeater',
        mode: 'json',
        name: 'rows',
        label: 'Fixture rows',
        nodes: [{ type: 'field', field: rowChoice }],
      },
    },
  ],
};
const initial = {
  selection: [{ id: '1', quantity: '2', note: 'Original' }],
  category: 'A',
  parent: '7',
  products: ['7'],
  tags: ['7'],
  rows: [
    { _brume: { key: 'fixture-a' }, product: '8' },
    { _brume: { key: 'fixture-b' }, product: '' },
  ],
};

/** Focused MemoryAdapter acceptance fixture; these fixed row controls are not a repeater renderer. */
export function FormRelationsPage() {
  const { locale } = useBrume();
  const [slow, setSlow] = useState(true);
  const [failure, setFailure] = useState(false);
  const controls = useRef({ slow, failure });
  controls.current = { slow, failure };
  const adapter = useMemo(
    () =>
      createMemoryAdapter('/demo/relations', {
        respond: async (req: HttpRequest) => {
          const depends = JSON.parse(String(req.query?.depends ?? '{}')) as {
            category?: string;
            parent?: string;
          };
          const state = controls.current;
          await new Promise((resolve) =>
            setTimeout(resolve, state.slow && depends.category === 'A' ? 1800 : 100),
          );
          if (state.failure)
            return { status: 503, data: { message: 'Fixture source unavailable' } };
          if (req.url === '/demo/options/picker') {
            const ids = req.query?.value;
            const q = String(req.query?.q ?? '').toLowerCase();
            const section = String(req.query?.section ?? 'all');
            const options = Array.from({ length: 6 }, (_, index) => ({
              value: String(index + 1),
              label: `Product ${index + 1}`,
              disabled: index === 5,
              columns: { sku: `SKU-${index + 1}` },
            }));
            const filtered = options.filter((item) =>
              Array.isArray(ids)
                ? ids.includes(item.value)
                : item.label.toLowerCase().includes(q) &&
                  (section === 'all' || Number(item.value) <= 3),
            );
            const page = Number(req.query?.page ?? 1);
            const response: PickerSearchResponse = {
              data: Array.isArray(ids) ? filtered : filtered.slice((page - 1) * 2, page * 2),
              pagination: {
                page,
                perPage: 2,
                hasMore: !Array.isArray(ids) && filtered.length > page * 2,
              },
              columns: [{ key: 'sku', label: 'SKU' }],
              sections: [
                { key: 'all', label: 'All products' },
                { key: 'featured', label: 'Featured' },
              ],
            };
            return { status: 200, data: response };
          }
          const prefix = `${depends.category ?? 'A'}${depends.parent ? ` / ${depends.parent}` : ''}`;
          const options: OptionItem[] = [
            ...(depends.category === 'C'
              ? []
              : [{ value: '7', label: `${prefix} seven`, depth: 0 }]),
            { value: '8', label: `${prefix} eight`, depth: 1 },
            { value: '9', label: `${prefix} nine`, depth: 2 },
          ];
          const ids = req.query?.value;
          const q = String(req.query?.q ?? '').toLowerCase();
          const data = options.filter((item) =>
            Array.isArray(ids) ? ids.includes(item.value) : item.label.toLowerCase().includes(q),
          );
          const response: OptionsResponse = {
            data,
            pagination: { page: Number(req.query?.page ?? 1), perPage: 20, hasMore: false },
          };
          return { status: 200, data: response };
        },
      }),
    [],
  );
  return (
    <BrumeProvider locale={locale} adapter={adapter}>
      <Page name="form-relations" title="Dependent remote choices">
        <Panel>
          <h2>Source controls</h2>
          <label>
            <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />{' '}
            Delay Category A by 1.8 seconds (B responds in 0.1 seconds)
          </label>
          <label>
            <input
              type="checkbox"
              checked={failure}
              onChange={(e) => setFailure(e.target.checked)}
            />{' '}
            Fail source requests (toggle off, then retry)
          </label>
        </Panel>
        <Choices />
      </Page>
    </BrumeProvider>
  );
}
function Choices() {
  const api = useFormState(form, initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const Choice = resolveField('select');
  return (
    <>
      <Panel>
        <h2>Hierarchy and selected label hydration</h2>
        <FormView form={{ ...form, nodes: form.nodes.slice(0, rootFields.length) }} api={api} />
        <Button onClick={() => api.reset()}>Reset draft</Button>
      </Panel>
      <Panel>
        <h2>Picker surface and committed values</h2>
        <output data-testid="picker-values">{JSON.stringify(api.values.selection)}</output>
        <Button onClick={() => setDialogOpen(true)}>Open relation dialog</Button>
        <FormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          page={pickerPage}
          onSaved={() => setDialogOpen(false)}
        />
      </Panel>
      <Panel>
        <GridView page={pickerGrid} />
      </Panel>
      <Panel>
        <h2>Two fixed sibling choice rows</h2>
        {(api.values.rows as typeof initial.rows).map((row, index) => {
          const path = `rows.${index}.product`;
          return Choice ? (
            <Choice
              key={row._brume.key}
              def={rowChoice}
              value={row.product}
              path={path}
              id={`fixture-product-${row._brume.key}`}
              rowContext={api.getField(path)?.rowContext}
              form={api}
              errors={{}}
              invalid={false}
              readOnly={false}
              disabled={false}
              onChange={(value) => api.setValue(path, value)}
              onBlur={() => api.touch(path)}
            />
          ) : null;
        })}
        <Button onClick={() => api.moveRow('rows', 0, 1)}>Swap fixed rows</Button>
      </Panel>
    </>
  );
}

const pickerPage: FormPage = {
  type: 'form',
  title: 'Relation dialog',
  name: 'Order',
  formId: 'picker-orders',
  mode: 'edit',
  form: {
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: { type: 'select', name: 'category', label: 'Category', options: categories },
      },
      { type: 'field', field: picker },
    ],
  },
  values: initial,
  submit: { method: 'put', url: '/demo/save', label: 'Save order' },
  after: { options: ['edit'], default: 'edit' },
  presentation: 'modal',
  size: 'lg',
};
const pickerGrid: ListPage = {
  type: 'list',
  title: 'Picker filters',
  gridId: 'picker-grid',
  columns: [{ key: 'name', label: 'Name' }],
  rows: [{ id: 1, name: 'Order 1' }],
  pagination: { page: 1, perPage: 20, total: 1, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  filters: {
    columns: 1,
    items: [
      {
        key: 'picker',
        label: 'Filter products',
        placement: 'panel',
        input: { type: 'multipleSelectTable' },
      },
    ],
  },
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  endpoints: { options: '/demo/options/{source}' },
};

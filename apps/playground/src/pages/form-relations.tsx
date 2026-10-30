import {
  BrumeProvider,
  Button,
  createMemoryAdapter,
  type HttpRequest,
  useBrume,
} from '@brume-ui/brume-react';
import { FormView, resolveField, useFormState } from '@brume-ui/brume-renderer';
import type { FieldDef, FormDef, OptionItem, OptionsResponse } from '@brume-ui/brume-schema';
import { useMemo, useRef, useState } from 'react';
import { Page, Panel } from './page';

const categories = [
  { value: 'A', label: 'Category A' },
  { value: 'B', label: 'Category B' },
  { value: 'C', label: 'Category C (7 unavailable)' },
];
const rootFields: FieldDef[] = [
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
  const Choice = resolveField('select');
  return (
    <>
      <Panel>
        <h2>Hierarchy and selected label hydration</h2>
        <FormView form={{ ...form, nodes: form.nodes.slice(0, rootFields.length) }} api={api} />
        <Button onClick={() => api.reset()}>Reset draft</Button>
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

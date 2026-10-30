import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import type { FormDef, FormNode } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { Nodes } from '../layout/nodes';
import { type FormApi, useFormState } from '../use-form-state';

const leaf: FormNode[] = [
  { type: 'field', field: { type: 'text', name: 'name', label: 'Name' } },
  { type: 'field', field: { type: 'currency', name: 'amount', label: 'Amount', decimals: 2 } },
  {
    type: 'field',
    field: {
      type: 'custom',
      name: 'custom',
      label: 'Custom',
      component: { type: 'component', name: 'test-custom' },
    },
  },
  {
    type: 'field',
    field: {
      type: 'upload',
      name: 'file',
      label: 'File',
      kind: 'file',
      multiple: false,
      accept: [],
      maxSize: 1000,
    },
  },
];
function definition(depth = 1): FormDef {
  let nodes = leaf;
  for (let i = depth - 1; i >= 0; i--)
    nodes = [
      {
        type: 'field',
        field: {
          type: 'repeater',
          mode: i % 2 ? 'relation' : 'json',
          name: `rows${i}`,
          label: `Rows ${i}`,
          nodes,
          sortable: true,
          min: 1,
          max: 3,
          distinct: i === depth - 1 ? ['amount'] : undefined,
        },
      },
    ];
  return { layout: 'stacked', nodes };
}
const row = (key: string, rest = {}) => ({ _brume: { key }, ...rest });
let api: FormApi;
function Harness({
  form = definition(),
  values = { rows0: [row('a'), row('b')] },
}: {
  form?: FormDef;
  values?: Record<string, unknown>;
}) {
  api = useFormState(form, values);
  return (
    <Nodes nodes={form.nodes} api={api} idPrefix="test" layout="stacked" uploadUrl="/upload" />
  );
}
const success = {
  status: 200,
  data: { token: 'uploaded', name: 'f.txt', size: 1, mime: 'text/plain', expiresAt: 'tomorrow' },
};

describe('recursive repeaters', () => {
  it('initializes UUID metadata only for newly added rows, preserves existing metadata and input/error ownership on move', () => {
    const existing = { key: 'saved', id: '42' };
    const form = definition();
    if (form.nodes[0]?.type === 'field' && form.nodes[0].field.type === 'repeater')
      form.nodes[0].field.mode = 'relation';
    renderWithBrume(
      <Harness
        form={form}
        values={{ rows0: [{ _brume: existing, name: 'A' }, row('b', { name: 'B' })] }}
      />,
      { locale: 'en' },
    );
    const input = screen.getByDisplayValue('B');
    act(() => api.setServerErrors({ 'rows0.1.name': ['B error'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Move up Rows 0 2' }));
    expect(screen.getByDisplayValue('B')).toBe(input);
    expect(api.errors['rows0.0.name']).toEqual(['B error']);
    expect(input.id).toBe('test-field-rows0.0.name');
    expect(api.resetVersion).toBe(0);
    expect(api.getValue('rows0.1._brume')).toEqual(existing);
    fireEvent.click(screen.getByRole('button', { name: 'Add Rows 0' }));
    expect(screen.getByDisplayValue('B')).toBe(input);
    expect(api.getValue('rows0.2._brume')).toEqual({
      key: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
    expect((screen.getByRole('button', { name: 'Add Rows 0' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
  it('validates min/max and canonical money duplicates at every offending row', () => {
    renderWithBrume(
      <Harness
        values={{
          rows0: [
            row('a', { amount: '500' }),
            row('b', { amount: '500.0' }),
            row('c', { amount: '500.00' }),
          ],
        }}
      />,
    );
    act(() => {
      expect(api.validateAll()).toBe(false);
    });
    for (let i = 0; i < 3; i++) expect(api.errors[`rows0.${i}.amount`]).toBeDefined();
    act(() => {
      api.setValue('rows0', []);
      api.validateAll();
    });
    expect(api.errors.rows0).toBeDefined();
    act(() => {
      api.setValue(
        'rows0',
        ['a', 'b', 'c', 'd'].map((key) => row(key)),
      );
      api.validateAll();
    });
    expect(api.errors.rows0).toBeDefined();
  });
  it.each([
    [row('a'), row('a')],
    [{ _brume: { key: '' } }],
    [{ _brume: { key: 'a', id: 12 } }],
    [{}],
  ])('diagnoses invalid metadata without silently repairing it: %j', (...rows) => {
    renderWithBrume(<Harness values={{ rows0: rows }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/row identity/i);
    expect(api.getValue('rows0')).toEqual(rows);
    act(() => {
      expect(api.validateAll()).toBe(false);
    });
  });
  it.each([false, true])(
    'keeps a four-depth upload on the surviving owner and includes canonical context (StrictMode=%s)',
    async (strict) => {
      let respond!: (value: HttpResponse) => void;
      let request!: HttpRequest;
      const form = definition(4);
      const values = {
        rows0: [
          row('outer-a'),
          row('outer-b', {
            rows1: [
              {
                _brume: { key: 'middle', id: '42' },
                rows2: [row('inner', { rows3: [row('leaf', { name: 'deep' })] })],
              },
            ],
          }),
        ],
      };
      const element = <Harness form={form} values={values} />;
      const { container } = renderWithBrume(strict ? <StrictMode>{element}</StrictMode> : element, {
        respond: (req) => {
          request = req;
          return new Promise((resolve) => {
            respond = resolve;
          });
        },
      });
      expect(screen.getByText('Unknown field type: custom')).toBeTruthy();
      const input = container.querySelector('input[type=file]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['a'], 'f.txt')] } });
      expect(api.pendingUploads).toBe(1);
      const body = request.body as FormData;
      expect(body.get('field')).toBe('rows0.1.rows1.0.rows2.0.rows3.0.file');
      expect(JSON.parse(body.get('rowContext') as string)).toEqual([
        { path: 'rows0', key: 'outer-b' },
        { path: 'rows0.*.rows1', key: 'middle', id: '42' },
        { path: 'rows0.*.rows1.*.rows2', key: 'inner' },
        { path: 'rows0.*.rows1.*.rows2.*.rows3', key: 'leaf' },
      ]);
      act(() => api.removeRow('rows0', 0));
      expect(container.querySelector('input[type=file]')).toBe(input);
      expect(request.signal?.aborted).toBe(false);
      await act(async () => respond(success));
      expect(api.getValue('rows0.0.rows1.0.rows2.0.rows3.0.file')).toEqual({ token: 'uploaded' });
      expect(api.pendingUploads).toBe(0);
    },
  );
  it.each(['remove', 'readd', 'reset'])(
    'aborts %s and rejects late noncooperative responses exactly once',
    async (action) => {
      let respond!: (value: HttpResponse) => void;
      let signal: AbortSignal | undefined;
      const { container } = renderWithBrume(<Harness />, {
        respond: (req) => {
          signal = req.signal;
          return new Promise((resolve) => {
            respond = resolve;
          });
        },
      });
      const input = container.querySelector('input[type=file]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['a'], 'f.txt')] } });
      act(() => {
        if (action === 'reset') api.reset();
        else {
          api.removeRow('rows0', 0);
          if (action === 'readd') api.setValue('rows0', [row('a'), row('b')]);
        }
      });
      expect(signal?.aborted).toBe(true);
      expect(api.pendingUploads).toBe(0);
      await act(async () => respond(success));
      expect(api.pendingUploads).toBe(0);
      expect(api.getValue('rows0.0.file')).toBeUndefined();
      if (action === 'readd') expect(container.querySelector('input[type=file]')).not.toBe(input);
    },
  );
});

it('routes completion to the moved row even before React commits the numeric path', async () => {
  let respond!: (value: HttpResponse) => void;
  const { container } = renderWithBrume(<Harness />, {
    respond: () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  });
  const input = container.querySelector('input[type=file]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['a'], 'f.txt')] } });
  await act(async () => {
    api.moveRow('rows0', 0, 1);
    respond(success);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
  expect(api.getValue('rows0.1.file')).toEqual({ token: 'uploaded' });
  expect(api.getValue('rows0.0.file')).toBeUndefined();
});

it('composes picker selected extras and nested repeaters while retaining a pending owner', async () => {
  let respond!: (value: HttpResponse) => void;
  let upload!: HttpRequest;
  const form: FormDef = {
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: {
          type: 'relation',
          name: 'products',
          label: 'Products',
          multiple: true,
          remote: { url: '/products' },
          fields: definition().nodes,
        },
      },
    ],
  };
  const values = {
    products: [
      { id: 'a', rows0: [row('first')] },
      { id: 'b', rows0: [row('before'), row('target')] },
    ],
  };
  const { container } = renderWithBrume(<Harness form={form} values={values} />, {
    locale: 'en',
    respond: (req) => {
      if (req.url === '/upload') {
        upload = req;
        return new Promise((resolve) => {
          respond = resolve;
        });
      }
      return {
        status: 200,
        data: {
          data: [
            { value: 'a', label: 'Apple' },
            { value: 'b', label: 'Banana' },
          ],
          pagination: { page: 1, perPage: 20, hasMore: false },
        },
      };
    },
  });
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  await screen.findByRole('button', { name: 'Remove “Apple”' });
  const input = container.querySelectorAll('input[type=file]')[2] as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['a'], 'f.txt')] } });
  expect(JSON.parse((upload.body as FormData).get('rowContext') as string)).toEqual([
    { path: 'products', key: 'b', id: 'b' },
    { path: 'products.*.rows0', key: 'target' },
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove “Apple”' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move up Rows 0 2' }));
  expect(container.querySelector('input[type=file]')).toBe(input);
  expect(upload.signal?.aborted).toBe(false);
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
  await act(async () => respond(success));
  expect(api.values).toEqual(values);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(api.getValue('products.0.id')).toBe('b');
  expect(api.getValue('products.0.rows0.0.file')).toEqual({ token: 'uploaded' });
});

it('keeps distinct text identifiers typed and respects conditional activity', () => {
  const form: FormDef = {
    layout: 'stacked',
    nodes: [
      { type: 'field', field: { type: 'switch', name: 'active', label: 'Active' } },
      {
        type: 'field',
        field: {
          type: 'repeater',
          name: 'rows0',
          label: 'Rows',
          mode: 'json',
          min: 1,
          distinct: ['code'],
          enableWhen: { field: { scope: 'root', path: 'active' }, op: 'eq', value: true },
          nodes: [{ type: 'field', field: { type: 'text', name: 'code', label: 'Code' } }],
        },
      },
    ],
  };
  renderWithBrume(
    <Harness
      form={form}
      values={{ active: true, rows0: [row('a', { code: '01' }), row('b', { code: '1' })] }}
    />,
    { locale: 'en' },
  );
  act(() => {
    expect(api.validateAll()).toBe(true);
    api.setValue('rows0.1.code', '01');
    expect(api.validateAll()).toBe(false);
  });
  expect(api.errors['rows0.0.code']).toBeDefined();
  expect(api.errors['rows0.1.code']).toBeDefined();
  act(() => {
    api.setValue('active', false);
    expect(api.validateAll()).toBe(true);
  });
  expect(screen.getByRole('button', { name: 'Add Rows' })).toHaveProperty('disabled', true);
  expect(
    screen.getAllByRole('textbox').every((input) => (input as HTMLInputElement).disabled),
  ).toBe(true);
});

it.each(['readOnly', 'disabled'] as const)('disables structural edits for %s repeaters', (flag) => {
  const form = definition();
  const field = form.nodes[0];
  if (field?.type === 'field') field.field[flag] = true;
  renderWithBrume(<Harness form={form} />, { locale: 'en' });
  expect(
    screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled),
  ).toBe(true);
  act(() => {
    expect(api.validateAll()).toBe(true);
  });
});

it.each([undefined, false])(
  'suppresses renderer sorting when schema sortable is %s',
  (sortable) => {
    const form = definition();
    const node = form.nodes[0];
    if (node?.type === 'field' && node.field.type === 'repeater') node.field.sortable = sortable;
    renderWithBrume(<Harness form={form} />, { locale: 'en' });
    expect(screen.queryByRole('button', { name: /Reorder Rows/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move up Rows/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Move down Rows/ })).toBeNull();
  },
);

it.each(['move', 'remove-readd', 'reset'])(
  'fences a picker draft upload when its outer repeater performs %s before React commits',
  async (action) => {
    let respond!: (value: HttpResponse) => void;
    const form: FormDef = {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'repeater',
            name: 'rows0',
            label: 'Rows',
            mode: 'json',
            sortable: true,
            nodes: [
              {
                type: 'field',
                field: {
                  type: 'relation',
                  name: 'products',
                  label: 'Products',
                  multiple: true,
                  remote: { url: '/products' },
                  fields: [leaf[3] as FormNode],
                },
              },
            ],
          },
        },
      ],
    };
    const { container } = renderWithBrume(
      <Harness
        form={form}
        values={{
          rows0: [row('a', { products: [{ id: 'selected' }] }), row('b', { products: [] })],
        }}
      />,
      {
        locale: 'en',
        respond: (req) =>
          req.url === '/upload'
            ? new Promise((resolve) => {
                respond = resolve;
              })
            : {
                status: 200,
                data: {
                  data: [{ value: 'selected', label: 'Selected' }],
                  pagination: { page: 1, perPage: 20, hasMore: false },
                },
              },
      },
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Products/ })[0] as HTMLElement);
    await screen.findByRole('button', { name: 'Remove “Selected”' });
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['a'], 'f.txt')] } });
    await act(async () => {
      if (action === 'move') api.moveRow('rows0', 0, 1);
      else if (action === 'reset') api.reset();
      else {
        const rows = api.getValue('rows0');
        api.removeRow('rows0', 0);
        api.setValue('rows0', rows);
      }
      respond(success);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });
    if (action === 'move') {
      expect(container.querySelector('input[type=file]')).toBe(input);
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(api.getValue('rows0.1.products.0.file')).toEqual({ token: 'uploaded' });
      expect(api.getValue('rows0.0.products')).toEqual([]);
    } else {
      expect(container.querySelector('input[type=file]')).toBeNull();
      expect(api.getValue('rows0.0.products.0.file')).toBeUndefined();
    }
  },
);

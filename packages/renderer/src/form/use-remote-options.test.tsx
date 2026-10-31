import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import type { FieldDef, FormDef, PickerSearchResponse } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { type FormApi, useFormState } from './use-form-state';
import { useRemoteOptions } from './use-remote-options';

const remote = {
  url: '/products',
  dependsOn: { amount: { scope: 'row' as const, path: 'amount' } },
};
const choice: FieldDef = { type: 'select', name: 'product', label: 'Product', remote };
const formDef: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'repeater',
        name: 'rows',
        label: 'Rows',
        mode: 'relation',
        nodes: [
          {
            type: 'field',
            field: { type: 'currency', name: 'amount', label: 'Amount', decimals: 2 },
          },
          { type: 'field', field: choice },
        ],
      },
    },
  ],
};
const response: HttpResponse<PickerSearchResponse> = {
  status: 200,
  data: {
    data: [{ value: '7', label: 'Seven', columns: { price: '2' } }],
    pagination: { page: 2, perPage: 5, hasMore: true },
    sections: [{ key: 'all', label: 'All' }],
  },
};
function Harness({
  capture,
  single = false,
}: {
  capture: (source: ReturnType<typeof useRemoteOptions>, form: FormApi) => void;
  single?: boolean;
}) {
  const form = useFormState(formDef, {
    rows: [
      { _brume: { key: 'stable-a', id: 'child-31' }, amount: '1.2', product: '7' },
      { _brume: { key: 'stable-b', id: 'child-32' }, amount: '2.4', product: '' },
    ].slice(0, single ? 1 : 2),
  });
  const index = (form.values.rows as Array<{ _brume: { key: string } }>).findIndex(
    (row) => row._brume.key === 'stable-a',
  );
  const source = useRemoteOptions({
    remote,
    form,
    path: `rows.${Math.max(index, 0)}.product`,
    rowContext: [{ path: 'rows', key: 'stable-a', id: 'child-31' }],
    active: index >= 0,
  });
  capture(source, form);
  return (
    <>
      <button type="button" onClick={() => form.moveRow('rows', 0, 1)}>
        Move
      </button>
      <button type="button" onClick={() => form.removeRow('rows', index)}>
        Remove
      </button>
    </>
  );
}
describe('shared remote request ownership', () => {
  it('transports canonical dependencies and stable row context separately and exposes complete picker responses', async () => {
    let source!: ReturnType<typeof useRemoteOptions>;
    const requests: HttpRequest[] = [];
    renderWithBrume(
      <Harness
        capture={(next) => {
          source = next;
        }}
      />,
      {
        respond: (req) => {
          requests.push(req);
          return response;
        },
      },
    );
    let result!: PickerSearchResponse;
    await act(async () => {
      result = await source.request<PickerSearchResponse>({
        q: 'book',
        page: 2,
        perPage: 5,
        section: 'all',
      });
    });
    expect(result.sections).toEqual([{ key: 'all', label: 'All' }]);
    expect(requests[0]?.query).toEqual({
      depends: '{"amount":"1.20"}',
      dependencyContexts: '{"amount":[{"id":"child-31","key":"stable-a","path":"rows"}]}',
      rowContext: '[{"id":"child-31","key":"stable-a","path":"rows"}]',
      q: 'book',
      page: '2',
      per_page: '5',
      section: 'all',
    });
    const scope = source.scopeKey;
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(source.scopeKey).toBe(scope);
    await act(async () => {
      await source.request({ values: ['7'] });
    });
    expect(requests[1]?.query).toEqual({
      depends: '{"amount":"1.20"}',
      dependencyContexts: '{"amount":[{"id":"child-31","key":"stable-a","path":"rows"}]}',
      rowContext: '[{"id":"child-31","key":"stable-a","path":"rows"}]',
      value: ['7'],
    });
    expect(requests[0]?.signal?.aborted).toBe(false); // hydration does not abort search
  });
  it('aborts removed row requests and rejects a late noncooperative adapter response', async () => {
    let source!: ReturnType<typeof useRemoteOptions>;
    let finish!: (value: HttpResponse) => void;
    const requests: HttpRequest[] = [];
    renderWithBrume(
      <Harness
        capture={(next) => {
          source = next;
        }}
      />,
      {
        respond: (req) => {
          requests.push(req);
          return new Promise((resolve) => {
            finish = resolve;
          });
        },
      },
    );
    const pending = source.request({ q: '', page: 1 });
    const check = expect(pending).rejects.toThrow('Obsolete');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(requests[0]?.signal?.aborted).toBe(true);
    await act(async () => {
      finish(response);
      await check;
    });
  });
});

it('removing the final row invalidates its relative dependencies without throwing', () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  renderWithBrume(
    <Harness
      single
      capture={(next) => {
        source = next;
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(source.enabled).toBe(false);
});

it('supports a real standalone Grid declaration with explicit reset ownership and no FormApi', async () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  let finish!: (value: HttpResponse) => void;
  const requests: HttpRequest[] = [];
  const { rerender } = renderWithBrume(
    <GridSource
      version={0}
      capture={(next) => {
        source = next;
      }}
    />,
    {
      respond: (req) => {
        requests.push(req);
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  );
  const original = source.scopeKey;
  const pending = source.request<PickerSearchResponse>({ q: 'book', page: 2, section: 'all' });
  const rejected = expect(pending).rejects.toThrow('Obsolete');
  rerender(
    <GridSource
      version={0}
      capture={(next) => {
        source = next;
      }}
    />,
  );
  expect(source.scopeKey).toBe(original);
  rerender(
    <GridSource
      version={1}
      capture={(next) => {
        source = next;
      }}
    />,
  );
  expect(source.scopeKey).not.toBe(original);
  expect(requests[0]?.query).toEqual({
    depends: '{"warehouse":"TW"}',
    q: 'book',
    page: '2',
    section: 'all',
  });
  expect(requests[0]?.signal?.aborted).toBe(true);
  await act(async () => {
    finish(response);
    await rejected;
  });
});

function GridSource({
  version,
  capture,
}: {
  version: number;
  capture: (source: ReturnType<typeof useRemoteOptions>) => void;
}) {
  capture(
    useRemoteOptions({
      remote: { url: '/grid/options/products' },
      ownerKey: 'product-filter',
      resolvedDepends: { warehouse: 'TW' },
      resetKey: version,
    }),
  );
  return null;
}

function ImmediateFormSource({
  capture,
}: {
  capture: (source: ReturnType<typeof useRemoteOptions>, form: FormApi) => void;
}) {
  const form = useFormState(
    {
      layout: 'stacked',
      nodes: [
        { type: 'field', field: { type: 'text', name: 'category', label: 'Category' } },
        {
          type: 'field',
          field: {
            type: 'select',
            name: 'product',
            label: 'Product',
            remote: {
              url: '/options',
              dependsOn: { category: { scope: 'root', path: 'category' } },
            },
          },
        },
      ],
    },
    { category: 'A', product: '7' },
  );
  const source = useRemoteOptions({
    remote: { url: '/options', dependsOn: { category: { scope: 'root', path: 'category' } } },
    form,
    path: 'product',
  });
  capture(source, form);
  return null;
}
it.each(['reset', 'dependency'] as const)(
  'rejects a late reply after synchronous %s before React commits a new scope',
  async (change) => {
    let source!: ReturnType<typeof useRemoteOptions>;
    let form!: FormApi;
    let finish!: (value: HttpResponse) => void;
    renderWithBrume(
      <ImmediateFormSource
        capture={(next, state) => {
          source = next;
          form = state;
        }}
      />,
      {
        respond: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    );
    const pending = source.request({ q: '', page: 1 });
    const rejected = expect(pending).rejects.toThrow('Obsolete');
    await act(async () => {
      if (change === 'reset') form.reset();
      else form.setValue('category', 'B');
      finish(response);
      await rejected;
    });
  },
);

it.each(['remove', 'move'] as const)(
  'checks live stable row ownership across synchronous %s',
  async (change) => {
    let source!: ReturnType<typeof useRemoteOptions>;
    let form!: FormApi;
    let finish!: (value: HttpResponse) => void;
    renderWithBrume(
      <Harness
        capture={(next, state) => {
          source = next;
          form = state;
        }}
      />,
      {
        respond: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    );
    const pending = source.request({ q: '', page: 1 });
    const result =
      change === 'remove'
        ? expect(pending).rejects.toThrow('Obsolete')
        : expect(pending).resolves.toEqual(response.data);
    await act(async () => {
      if (change === 'remove') form.removeRow('rows', 0);
      else form.moveRow('rows', 0, 1);
      finish(response);
      await result;
    });
  },
);

it('aborts both request channels on true unmount and rejects late replies and new stale-owner requests', async () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  const requests: HttpRequest[] = [];
  const finish: Array<(value: HttpResponse) => void> = [];
  const { unmount } = renderWithBrume(
    <GridSource
      version={0}
      capture={(next) => {
        source = next;
      }}
    />,
    {
      respond: (request) => {
        requests.push(request);
        return new Promise((resolve) => {
          finish.push(resolve);
        });
      },
    },
  );
  const search = source.request({ q: '', page: 1 });
  const labels = source.request({ values: ['7'] });
  const rejected = Promise.all([
    expect(search).rejects.toThrow('Obsolete'),
    expect(labels).rejects.toThrow('Obsolete'),
  ]);
  unmount();
  expect(requests).toHaveLength(2);
  expect(requests.every((request) => request.signal?.aborted)).toBe(true);
  await expect(source.request({ values: ['7'] })).rejects.toThrow('Obsolete');
  expect(requests).toHaveLength(2);
  await act(async () => {
    for (const resolve of finish) resolve(response);
    await rejected;
  });
});

it('rejects a same-event removed and re-added row lifetime before React renders', async () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  let form!: FormApi;
  let finish!: (value: HttpResponse) => void;
  renderWithBrume(
    <Harness
      capture={(next, api) => {
        source = next;
        form = api;
      }}
    />,
    {
      respond: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  );
  const old = source;
  const pending = source.request({ q: 'old' });
  const rejected = expect(pending).rejects.toThrow('Obsolete');
  await act(async () => {
    const rows = form.getValue('rows');
    form.removeRow('rows', 0);
    form.setValue('rows', rows);
    finish(response);
    await rejected;
    await expect(old.request({ q: 'obsolete' })).rejects.toThrow('Obsolete');
  });
  expect(source.scopeKey).not.toBe(old.scopeKey);
});

function CrossRowSource({
  capture,
}: {
  capture: (source: ReturnType<typeof useRemoteOptions>, form: FormApi) => void;
}) {
  const crossRemote = {
    url: '/cross-options',
    dependsOn: { amount: { scope: 'root' as const, path: 'rows.0.amount' } },
  };
  const form = useFormState(
    {
      ...formDef,
      nodes: [
        ...formDef.nodes,
        {
          type: 'field',
          field: { type: 'select', name: 'choice', label: 'Choice', remote: crossRemote },
        },
      ],
    },
    {
      rows: [
        { _brume: { key: 'a', id: '31' }, amount: '1.2' },
        { _brume: { key: 'b', id: '32' }, amount: '1.2' },
      ],
      choice: '7',
    },
  );
  capture(useRemoteOptions({ remote: crossRemote, form, path: 'choice' }), form);
  return null;
}

it.each(['move', 'replace'] as const)(
  'fences same-valued cross-row dependency identity and lifetime on synchronous %s',
  async (change) => {
    let source!: ReturnType<typeof useRemoteOptions>;
    let form!: FormApi;
    const requests: HttpRequest[] = [];
    const finish: Array<(response: HttpResponse) => void> = [];
    renderWithBrume(
      <CrossRowSource
        capture={(next, api) => {
          source = next;
          form = api;
        }}
      />,
      {
        respond: (request) => {
          requests.push(request);
          return new Promise((resolve) => {
            finish.push(resolve);
          });
        },
      },
    );
    const old = source;
    const search = old.request({ q: 'old' });
    const labels = old.request({ values: ['7'] });
    const rejected = Promise.all([
      expect(search).rejects.toThrow('Obsolete'),
      expect(labels).rejects.toThrow('Obsolete'),
    ]);
    expect(requests[0]?.query?.dependencyContexts).toBe(
      '{"amount":[{"id":"31","key":"a","path":"rows"}]}',
    );
    expect(requests[1]?.query?.dependencyContexts).toBe(requests[0]?.query?.dependencyContexts);
    await act(async () => {
      if (change === 'move') form.moveRow('rows', 0, 1);
      else {
        const rows = form.getValue('rows');
        form.removeRow('rows', 0);
        form.setValue('rows', rows);
      }
      for (const resolve of finish) resolve(response);
      await rejected;
      await expect(old.request({ q: 'stale' })).rejects.toThrow('Obsolete');
    });
    expect(source.scopeKey).not.toBe(old.scopeKey);
  },
);

function AncestorSource({
  capture,
  cycle = false,
}: {
  capture: (source: ReturnType<typeof useRemoteOptions>, form: FormApi) => void;
  cycle?: boolean;
}) {
  const childRemote = {
    url: '/children',
    dependsOn: { note: { scope: 'root' as const, path: 'rows.1.products.0.note' } },
  };
  const form = useFormState(
    {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'repeater',
            name: 'rows',
            label: 'Rows',
            mode: 'json',
            nodes: [
              { type: 'field', field: { type: 'text', name: 'category', label: 'Category' } },
              {
                type: 'field',
                field: {
                  type: 'relation',
                  name: 'products',
                  label: 'Products',
                  multiple: true,
                  remote: {
                    url: '/products',
                    dependsOn: {
                      category: { scope: 'row', path: cycle ? 'products.0.note' : 'category' },
                    },
                  },
                  fields: [
                    { type: 'field', field: { type: 'text', name: 'note', label: 'Note' } },
                    {
                      type: 'field',
                      field: { type: 'select', name: 'child', label: 'Child', remote: childRemote },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
    {
      rows: [
        { _brume: { key: 'a' }, category: 'A', products: [{ id: '7', note: 'same' }] },
        { _brume: { key: 'b' }, category: 'B', products: [{ id: '8', note: 'same' }] },
      ],
    },
  );
  capture(useRemoteOptions({ remote: childRemote, form, path: 'rows.0.products.0.child' }), form);
  return null;
}

it('transports distinct ancestor picker instances and fences their dependency changes before React commits', async () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  let form!: FormApi;
  const requests: HttpRequest[] = [];
  const finish: Array<(response: HttpResponse) => void> = [];
  renderWithBrume(
    <AncestorSource
      capture={(next, api) => {
        source = next;
        form = api;
      }}
    />,
    {
      respond: (request) => {
        requests.push(request);
        return new Promise((resolve) => {
          finish.push(resolve);
        });
      },
    },
  );
  const search = source.request({ q: '' });
  const labels = source.request({ values: ['7'] });
  const rejected = Promise.all([
    expect(search).rejects.toThrow('Obsolete'),
    expect(labels).rejects.toThrow('Obsolete'),
  ]);
  expect(JSON.parse(requests[0]?.query?.ancestorSources as string)).toEqual([
    {
      path: 'rows.*.products',
      rowContext: [{ path: 'rows', key: 'a' }],
      depends: { category: 'A' },
      dependencyContexts: { category: [{ path: 'rows', key: 'a' }] },
    },
    {
      path: 'rows.*.products',
      rowContext: [{ path: 'rows', key: 'b' }],
      depends: { category: 'B' },
      dependencyContexts: { category: [{ path: 'rows', key: 'b' }] },
    },
  ]);
  expect(requests[1]?.query?.ancestorSources).toBe(requests[0]?.query?.ancestorSources);
  await act(async () => {
    form.setValue('rows.1.category', 'Changed');
    for (const resolve of finish) resolve(response);
    await rejected;
  });
});

it('disables a cyclic ancestor source context without a render exception', async () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  renderWithBrume(
    <AncestorSource
      cycle
      capture={(next) => {
        source = next;
      }}
    />,
  );
  expect(source.enabled).toBe(false);
  await expect(source.request({ q: '' })).rejects.toThrow('Obsolete');
});

function WholeCollectionSource({
  capture,
}: {
  capture: (source: ReturnType<typeof useRemoteOptions>, form: FormApi) => void;
}) {
  const remote = {
    url: '/dependent',
    dependsOn: { products: { scope: 'root' as const, path: 'products' } },
  };
  const form = useFormState(
    {
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
            fields: [],
          },
        },
        { type: 'field', field: { type: 'select', name: 'choice', label: 'Choice', remote } },
      ],
    },
    { products: [{ id: '7' }] },
  );
  capture(useRemoteOptions({ remote, form, path: 'choice' }), form);
  return null;
}

it('collects whole picker eligibility with no extras and fences remove-readd of the same dependency payload', async () => {
  let source!: ReturnType<typeof useRemoteOptions>;
  let form!: FormApi;
  let request!: HttpRequest;
  let finish!: (response: HttpResponse) => void;
  renderWithBrume(
    <WholeCollectionSource
      capture={(next, api) => {
        source = next;
        form = api;
      }}
    />,
    {
      respond: (req) => {
        request = req;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  );
  const pending = source.request({ q: '' });
  const rejected = expect(pending).rejects.toThrow('Obsolete');
  expect(JSON.parse(request.query?.ancestorSources as string)).toEqual([
    { path: 'products', rowContext: [], depends: {} },
  ]);
  await act(async () => {
    form.setValue('products', []);
    form.setValue('products', [{ id: '7' }]);
    finish(response);
    await rejected;
  });
});

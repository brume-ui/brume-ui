import { type HttpResponse, RelationPicker } from '@brume-ui/brume-react';
import type { FieldDef, FormDef, RelationItem } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { fieldOwnershipKey } from './field-ownership';
import { type FormApi, useFormState } from './use-form-state';
import { useRelationDraft } from './use-relation-draft';
import { type RemoteOptionsSource, useRemoteOptions } from './use-remote-options';

const response: HttpResponse = {
  status: 200,
  data: {
    data: [{ value: 'fresh', label: 'Fresh' }],
    pagination: { page: 1, perPage: 20, hasMore: false },
  },
};
type Mode = 'leaf' | 'collection';
interface Fixture {
  depth: number;
  mode: Mode;
  outer?: boolean;
  auto?: boolean;
}
const apis = new Map<string, FormApi>();
function draft(id: string): FormApi {
  const api = apis.get(id);
  if (!api) throw new Error(`Missing draft ${id}`);
  return api;
}
let source: RemoteOptionsSource;
let automatic: Promise<unknown>[] = [];
const base = (outer: boolean) => (outer ? 'groups.0.products' : 'products');
const rowsPath = (outer: boolean, depth: number) =>
  `${base(outer)}.1.rows${'.0.children'.repeat(depth - 1)}`;
function rowField(depth: number, name = 'rows'): FieldDef {
  return {
    type: 'repeater',
    mode: 'json',
    name,
    label: name,
    nodes:
      depth === 1
        ? [{ type: 'field', field: { type: 'text', name: 'name', label: 'Name' } }]
        : [{ type: 'field', field: rowField(depth - 1, 'children') }],
  };
}
function rowValues(depth: number): unknown[] {
  if (depth > 1) return [{ _brume: { key: `level-${depth}` }, children: rowValues(depth - 1) }];
  return [
    { _brume: { key: 'first' }, name: 'same' },
    { _brume: { key: 'second' }, name: 'other' },
    { _brume: { key: 'third' }, name: 'third' },
  ];
}

function target(fixture: Fixture) {
  return fixture.mode === 'collection'
    ? `${base(!!fixture.outer)}.1.rows`
    : `${rowsPath(!!fixture.outer, fixture.depth)}.0.name`;
}
function remote(fixture: Fixture) {
  return {
    url: '/children',
    dependsOn: { target: { scope: 'root' as const, path: target(fixture) } },
  };
}
function definition(fixture: Fixture): FormDef {
  const products: FieldDef = {
    type: 'relation',
    name: 'products',
    label: 'Products',
    multiple: true,
    remote: { url: '/products' },
    fields: [
      { type: 'field', field: rowField(fixture.depth) },
      { type: 'field', field: { type: 'text', name: 'unrelated', label: 'Unrelated' } },
      {
        type: 'field',
        field: { type: 'select', name: 'choice', label: 'Choice', remote: remote(fixture) },
      },
    ],
  };
  return {
    layout: 'stacked',
    nodes: [
      {
        type: 'field',
        field: fixture.outer
          ? {
              type: 'relation',
              name: 'groups',
              label: 'Groups',
              multiple: true,
              remote: { url: '/groups' },
              fields: [{ type: 'field', field: products }],
            }
          : products,
      },
    ],
  };
}
interface DraftProps {
  parent: FormApi;
  path: string;
  item: RelationItem;
  index: number;
  read(): readonly RelationItem[];
  identity?: (id: string) => number | undefined;
  update(item: RelationItem): void;
  fixture: Fixture;
  group?: boolean;
}
function Draft({ parent, path, item, index, read, identity, update, fixture, group }: DraftProps) {
  const api = useRelationDraft({
    parent,
    path,
    prefix: `${path}.${index}`,
    multiple: true,
    item,
    getDraft: read,
    getDraftIdentity: identity,
    onChange: update,
    onPending: () => {},
  });
  return group ? (
    <Picker parent={api} path={`${path}.${index}.products`} fixture={fixture} />
  ) : (
    <Source api={api} item={item} path={`${path}.${index}`} fixture={fixture} />
  );
}
function Source({
  api,
  item,
  path,
  fixture,
}: {
  api: FormApi;
  item: RelationItem;
  path: string;
  fixture: Fixture;
}) {
  apis.set(item.id, api);
  const current = useRemoteOptions({ remote: remote(fixture), form: api, path: `${path}.choice` });
  if (item.id === 'b') source = current;
  useEffect(() => {
    if (fixture.auto && item.id === 'b')
      automatic = [current.request({ q: '' }), current.request({ values: ['fresh'] })];
  }, [current.request, fixture.auto, item.id]);
  return null;
}
function Picker({
  parent,
  path,
  fixture,
  group = false,
}: {
  parent: FormApi;
  path: string;
  fixture: Fixture;
  group?: boolean;
}) {
  return (
    <RelationPicker
      label={group ? 'Groups' : 'Products'}
      value={parent.getValue(path) as RelationItem[]}
      multiple
      onChange={() => {}}
      items={
        group
          ? [{ value: 'g', label: 'Group' }]
          : [
              { value: 'a', label: 'Apple' },
              { value: 'b', label: 'Banana' },
            ]
      }
      pagination={{ page: 1, perPage: 20, hasMore: false }}
      query=""
      loading={false}
      onQueryChange={() => {}}
      onPageChange={() => {}}
      onSectionChange={() => {}}
      onRetry={() => {}}
      renderSelection={(item, index, update, _draft, read, identity) => (
        <Draft
          key={item.id}
          parent={parent}
          path={path}
          item={item}
          index={index}
          read={read}
          identity={identity}
          update={update}
          fixture={fixture}
          group={group}
        />
      )}
    />
  );
}
function Harness(fixture: Fixture) {
  const products = [
    { id: 'b', rows: rowValues(fixture.depth) },
    { id: 'a', rows: rowValues(fixture.depth) },
  ];
  const parent = useFormState(
    definition(fixture),
    fixture.outer ? { groups: [{ id: 'g', products }] } : { products },
  );
  return (
    <Picker
      parent={parent}
      path={fixture.outer ? 'groups' : 'products'}
      fixture={fixture}
      group={fixture.outer}
    />
  );
}
function open(outer: boolean) {
  if (outer) fireEvent.click(screen.getByRole('button', { name: /^Groups/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Products/ }));
}

it.each([
  { depth: 1, mode: 'leaf' },
  { depth: 1, mode: 'collection' },
  { depth: 3, mode: 'leaf', outer: true },
  { depth: 3, mode: 'collection', outer: true },
] as const)(
  'fences actual sibling descendant replacement at $depth levels for $mode in both channels',
  async (fixture) => {
    const finish: Array<(response: HttpResponse) => void> = [];
    renderWithBrume(<Harness {...fixture} />, {
      locale: 'en',
      respond: () =>
        new Promise((resolve) => {
          finish.push(resolve);
        }),
    });
    open('outer' in fixture);
    const pending = [source.request({ q: '' }), source.request({ values: ['fresh'] })];
    const rejected = Promise.all(
      pending.map((promise) => expect(promise).rejects.toThrow('Obsolete')),
    );
    await act(async () => {
      const a = draft('a');
      const path = rowsPath('outer' in fixture, fixture.depth);
      const rows = a.getValue(path);
      a.removeRow(path, 0);
      a.setValue(path, rows);
      for (const resolve of finish) resolve(response);
      await rejected;
    });
  },
);

it('initial auto search and hydration work when observing B mounts before target A', async () => {
  automatic = [];
  const finish: Array<(response: HttpResponse) => void> = [];
  renderWithBrume(<Harness depth={2} mode="leaf" auto />, {
    locale: 'en',
    respond: () =>
      new Promise((resolve) => {
        finish.push(resolve);
      }),
  });
  open(false);
  expect(finish).toHaveLength(2);
  await act(async () => {
    for (const resolve of finish) resolve(response);
    await expect(Promise.all(automatic)).resolves.toEqual([response.data, response.data]);
  });
});

it('shares descendant mutations without resetting or unmounting a peer lifetime', () => {
  renderWithBrume(<Harness depth={2} mode="leaf" />, { locale: 'en' });
  open(false);
  const a = draft('a');
  const b = draft('b');
  act(() => {
    b.setValue('products.0.unrelated', 'kept');
  });
  const bBefore = fieldOwnershipKey(b, 'products.0.rows.0.children.0.name');
  const aBefore = fieldOwnershipKey(a, 'products.1.rows.0.children.0.name');
  act(() => {
    a.reset();
  });
  expect(fieldOwnershipKey(a, 'products.1.rows.0.children.0.name')).not.toBe(aBefore);
  expect(fieldOwnershipKey(b, 'products.0.rows.0.children.0.name')).toBe(bBefore);
  fireEvent.click(screen.getByRole('button', { name: 'Remove “Apple”' }));
  expect(fieldOwnershipKey(draft('b'), 'products.0.rows.0.children.0.name')).toBe(bBefore);
  expect(apis.get('b')?.getValue('products.0.unrelated')).toBe('kept');
});

it('keeps requests valid across an unrelated sibling edit and movement that retains the target row', async () => {
  let finish!: (response: HttpResponse) => void;
  renderWithBrume(<Harness depth={2} mode="leaf" />, {
    locale: 'en',
    respond: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  open(false);
  const pending = source.request({ q: '' });
  await act(async () => {
    const a = draft('a');
    a.setValue('products.1.unrelated', 'edit');
    a.moveRow('products.1.rows.0.children', 1, 2);
    finish(response);
    await expect(pending).resolves.toEqual(response.data);
  });
});

it('rejects nested draft requests when the outer picker session closes', async () => {
  let finish!: (response: HttpResponse) => void;
  renderWithBrume(<Harness depth={2} mode="leaf" outer />, {
    locale: 'en',
    respond: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  open(true);
  const pending = source.request({ values: ['fresh'] });
  const rejected = expect(pending).rejects.toThrow('Obsolete');
  await act(async () => {
    const cancel = screen.getAllByRole('button', { name: 'Cancel' }).at(-1);
    if (!cancel) throw new Error('Missing outer picker Cancel');
    fireEvent.click(cancel);
    finish(response);
    await rejected;
  });
});

import { type HttpResponse, RelationPicker } from '@brume-ui/brume-react';
import type { FormDef, RelationItem } from '@brume-ui/brume-schema';
import { act, fireEvent, screen } from '@testing-library/react';
import { useCallback, useRef, useState } from 'react';
import { expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { fieldOwnershipKey } from './field-ownership';
import { type FormApi, useFormState } from './use-form-state';
import { useRelationDraft } from './use-relation-draft';
import { type RemoteOptionsSource, useRemoteOptions } from './use-remote-options';

const remote = { url: '/choices' };
const definition: FormDef = {
  layout: 'stacked',
  nodes: [
    {
      type: 'field',
      field: {
        type: 'relation',
        name: 'selection',
        label: 'Selection',
        multiple: true,
        remote,
        fields: [
          {
            type: 'field',
            field: {
              type: 'repeater',
              mode: 'json',
              name: 'rows',
              label: 'Rows',
              nodes: [
                {
                  type: 'field',
                  field: { type: 'select', name: 'choice', label: 'Choice', remote },
                },
              ],
            },
          },
        ],
      },
    },
  ],
};
const initial = { id: 'selected', rows: [{ _brume: { key: 'a' } }, { _brume: { key: 'b' } }] };
let api: FormApi;
let source: RemoteOptionsSource;
function DraftHarness() {
  const parent = useFormState(definition, { selection: [initial] });
  const current = useRef<RelationItem[]>([initial]);
  const [, refresh] = useState(0);
  const getDraft = useCallback(() => current.current, []);
  api = useRelationDraft({
    parent,
    path: 'selection',
    prefix: 'selection.0',
    multiple: true,
    item: current.current[0] as RelationItem,
    getDraft,
    onChange: (item) => {
      current.current = [item];
      refresh((value) => value + 1);
    },
    onPending: () => {},
  });
  const rows = api.getValue('selection.0.rows') as typeof initial.rows;
  const index = rows.findIndex((row) => row._brume.key === 'a');
  source = useRemoteOptions({
    remote,
    form: api,
    path: `selection.0.rows.${Math.max(0, index)}.choice`,
    active: index >= 0,
  });
  return null;
}
it.each(['move', 'remove-readd', 'reset'])(
  'draft row lifetimes fence %s without changing public identity',
  async (action) => {
    let finish!: (res: HttpResponse) => void;
    renderWithBrume(<DraftHarness />, {
      respond: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const before = fieldOwnershipKey(api, 'selection.0.rows.0.choice');
    const pending = source.request({ q: '' });
    const response = {
      status: 200,
      data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
    };
    const result =
      action === 'move'
        ? expect(pending).resolves.toEqual(response.data)
        : expect(pending).rejects.toThrow('Obsolete');
    await act(async () => {
      if (action === 'move') api.moveRow('selection.0.rows', 0, 1);
      else if (action === 'reset') api.reset();
      else {
        const rows = api.getValue('selection.0.rows');
        api.removeRow('selection.0.rows', 0);
        api.setValue('selection.0.rows', rows);
      }
      finish(response);
      await result;
    });
    const after = fieldOwnershipKey(api, `selection.0.rows.${action === 'move' ? 1 : 0}.choice`);
    if (action === 'move') expect(after).toBe(before);
    else expect(after).not.toBe(before);
    expect(
      api.getField(`selection.0.rows.${action === 'move' ? 1 : 0}.choice`)?.rowContext,
    ).toEqual([
      { path: 'selection', key: 'selected', id: 'selected' },
      { path: 'selection.*.rows', key: 'a' },
    ]);
  },
);

type ExternalDependency = 'leaf' | 'collection' | 'ancestor';
let externalParent: FormApi;
let externalSource: RemoteOptionsSource;
function ExternalDraftHarness({ dependency }: { dependency: ExternalDependency }) {
  const target = {
    scope: 'root' as const,
    path: dependency === 'collection' ? 'rows' : 'rows.0.name',
  };
  const childRemote = {
    url: '/choices',
    ...(dependency === 'ancestor' ? {} : { dependsOn: { target } }),
  };
  const pickerRemote = {
    url: '/products',
    ...(dependency === 'ancestor' ? { dependsOn: { target } } : {}),
  };
  externalParent = useFormState(
    {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'repeater',
            mode: 'json',
            name: 'rows',
            label: 'Rows',
            nodes: [{ type: 'field', field: { type: 'text', name: 'name', label: 'Name' } }],
          },
        },
        {
          type: 'field',
          field: {
            type: 'relation',
            name: 'selection',
            label: 'Selection',
            multiple: true,
            remote: pickerRemote,
            fields: [
              {
                type: 'field',
                field: { type: 'select', name: 'choice', label: 'Choice', remote: childRemote },
              },
            ],
          },
        },
      ],
    },
    {
      rows: [
        { _brume: { key: 'a' }, name: 'same' },
        { _brume: { key: 'b' }, name: 'other' },
        { _brume: { key: 'c' }, name: 'third' },
      ],
      selection: [{ id: '7' }],
    },
  );
  const current = useRef<RelationItem[]>([{ id: '7' }]);
  const getDraft = useCallback(() => current.current, []);
  const draft = useRelationDraft({
    parent: externalParent,
    path: 'selection',
    prefix: 'selection.0',
    multiple: true,
    item: current.current[0] as RelationItem,
    getDraft,
    onChange: (item) => {
      current.current = [item];
    },
    onPending: () => {},
  });
  externalSource = useRemoteOptions({
    remote: childRemote,
    form: draft,
    path: 'selection.0.choice',
  });
  return null;
}

it.each(['leaf', 'collection', 'ancestor'] as const)(
  'draft search and hydration observe actual parent %s dependency lifetimes synchronously',
  async (dependency) => {
    const finish: Array<(response: HttpResponse) => void> = [];
    renderWithBrume(<ExternalDraftHarness dependency={dependency} />, {
      respond: () =>
        new Promise((resolve) => {
          finish.push(resolve);
        }),
    });
    const search = externalSource.request({ q: '' });
    const hydration = externalSource.request({ values: ['stale'] });
    const rejected = Promise.all([
      expect(search).rejects.toThrow('Obsolete'),
      expect(hydration).rejects.toThrow('Obsolete'),
    ]);
    await act(async () => {
      const rows = externalParent.getValue('rows');
      externalParent.removeRow('rows', 0);
      externalParent.setValue('rows', rows);
      for (const resolve of finish)
        resolve({
          status: 200,
          data: {
            data: [{ value: 'stale', label: 'Stale' }],
            pagination: { page: 1, perPage: 20, hasMore: false },
          },
        });
      await rejected;
    });
  },
);

it('keeps a draft request valid when unrelated parent rows move', async () => {
  let finish!: (response: HttpResponse) => void;
  renderWithBrume(<ExternalDraftHarness dependency="leaf" />, {
    respond: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const pending = externalSource.request({ q: '' });
  const response = {
    status: 200,
    data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
  };
  await act(async () => {
    externalParent.moveRow('rows', 1, 2);
    finish(response);
    await expect(pending).resolves.toEqual(response.data);
  });
});

const siblingRemote = {
  url: '/choices',
  dependsOn: { note: { scope: 'root' as const, path: 'selection.1.note' } },
};
const siblingApis = new Map<string, FormApi>();
let siblingSource: RemoteOptionsSource;
function SiblingDraft({
  parent,
  item,
  index,
  getDraft,
  getDraftIdentity,
  update,
}: {
  parent: FormApi;
  item: RelationItem;
  index: number;
  getDraft(): readonly RelationItem[];
  getDraftIdentity?: (id: string) => number | undefined;
  update(item: RelationItem): void;
}) {
  const draft = useRelationDraft({
    parent,
    path: 'selection',
    prefix: `selection.${index}`,
    multiple: true,
    item,
    getDraft,
    getDraftIdentity,
    onChange: update,
    onPending: () => {},
  });
  siblingApis.set(item.id, draft);
  const source = useRemoteOptions({
    remote: siblingRemote,
    form: draft,
    path: `selection.${index}.choice`,
  });
  if (item.id === 'b') siblingSource = source;
  return null;
}
function SiblingPickerHarness() {
  const parent = useFormState(
    {
      layout: 'stacked',
      nodes: [
        {
          type: 'field',
          field: {
            type: 'relation',
            name: 'selection',
            label: 'Selection',
            multiple: true,
            remote: { url: '/products' },
            fields: [
              { type: 'field', field: { type: 'text', name: 'note', label: 'Note' } },
              { type: 'field', field: { type: 'text', name: 'unrelated', label: 'Unrelated' } },
              {
                type: 'field',
                field: { type: 'select', name: 'choice', label: 'Choice', remote: siblingRemote },
              },
            ],
          },
        },
      ],
    },
    { selection: [{ id: 'b' }, { id: 'a' }] },
  );
  return (
    <RelationPicker
      label="Products"
      value={[{ id: 'b' }, { id: 'a' }]}
      onChange={() => {}}
      multiple
      items={[
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ]}
      pagination={{ page: 1, perPage: 20, hasMore: false }}
      query=""
      loading={false}
      onQueryChange={() => {}}
      onPageChange={() => {}}
      onSectionChange={() => {}}
      onRetry={() => {}}
      renderSelection={(
        item,
        index,
        update,
        _items,
        getDraft,
        getDraftIdentity?: (id: string) => number | undefined,
      ) => (
        <SiblingDraft
          key={item.id}
          parent={parent}
          item={item}
          index={index}
          getDraft={getDraft}
          getDraftIdentity={getDraftIdentity}
          update={update}
        />
      )}
    />
  );
}

it('fences both channels when a surviving real picker draft depends on a removed and readded sibling', async () => {
  const finish: Array<(response: HttpResponse) => void> = [];
  renderWithBrume(<SiblingPickerHarness />, {
    locale: 'en',
    respond: () =>
      new Promise((resolve) => {
        finish.push(resolve);
      }),
  });
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  const search = siblingSource.request({ q: '' });
  const hydration = siblingSource.request({ values: ['stale'] });
  const rejected = Promise.all([
    expect(search).rejects.toThrow('Obsolete'),
    expect(hydration).rejects.toThrow('Obsolete'),
  ]);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Remove “Apple”' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Apple' }));
    for (const resolve of finish)
      resolve({
        status: 200,
        data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
      });
    await rejected;
  });
});

it('retains a surviving picker draft and requests through an unrelated sibling edit', async () => {
  let finish!: (response: HttpResponse) => void;
  renderWithBrume(<SiblingPickerHarness />, {
    locale: 'en',
    respond: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  fireEvent.click(screen.getByRole('button', { name: /Products/ }));
  act(() => {
    siblingApis.get('b')?.setValue('selection.0.unrelated', 'kept');
  });
  const pending = siblingSource.request({ q: '' });
  const response = {
    status: 200,
    data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
  };
  await act(async () => {
    siblingApis.get('a')?.setValue('selection.1.unrelated', 'changed');
    finish(response);
    await expect(pending).resolves.toEqual(response.data);
  });
  expect(siblingApis.get('b')?.getValue('selection.0.unrelated')).toBe('kept');
});

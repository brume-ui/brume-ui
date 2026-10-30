import type { HttpResponse } from '@brume-ui/brume-react';
import type { FormDef, RelationItem } from '@brume-ui/brume-schema';
import { act } from '@testing-library/react';
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

import type { HttpRequest, HttpResponse } from '@brume-ui/brume-react';
import type { FormDef, PickerAuthority } from '@brume-ui/brume-schema';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { Nodes } from './layout/nodes';
import { type FormApi, useFormState } from './use-form-state';

const form: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'field', field: { type: 'text', name: 'title', label: 'Title' } },
    { type: 'field', field: { type: 'text', name: 'scope', label: 'Scope' } },
    {
      type: 'field',
      field: {
        type: 'relation',
        name: 'items',
        label: 'Items',
        multiple: true,
        hydrateAuthority: true,
        remote: { url: '/items', dependsOn: { scope: { scope: 'root', path: 'scope' } } },
        fields: [
          { type: 'field', field: { type: 'switch', name: 'visible', label: 'Visible' } },
          {
            type: 'field',
            field: {
              type: 'text',
              name: 'kind',
              label: 'Kind',
              showWhen: { op: 'eq', field: { scope: 'row', path: 'visible' }, value: true },
            },
          },
          {
            type: 'field',
            field: {
              type: 'text',
              name: 'note',
              label: 'Note',
              rules: [{ rule: 'required', message: 'Required' }],
              showWhen: { op: 'eq', field: { scope: 'row', path: 'kind' }, value: 'B' },
            },
          },
        ],
      },
    },
  ],
};
const authority = (kind = 'A'): PickerAuthority => ({
  values: { visible: true, kind, note: 'stored' },
});
const response = (snapshot?: PickerAuthority): HttpResponse => ({
  status: 200,
  data: {
    data: [{ value: '1', label: 'First', ...(snapshot ? { authority: snapshot } : {}) }],
    pagination: { page: 1, perPage: 20, hasMore: false },
  },
});
let api!: FormApi;
function Harness() {
  api = useFormState(form, { scope: 'A', items: [] });
  return (
    <>
      <button type="button" onClick={() => api.reset()}>
        Reset
      </button>
      <button type="button" onClick={() => api.setValue('scope', 'B')}>
        Change scope
      </button>
      <Nodes nodes={form.nodes} api={api} idPrefix="authority" layout="stacked" />
    </>
  );
}
async function select() {
  fireEvent.click(screen.getByRole('button', { name: /Items/ }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select First' }));
}
it('blocks unknown owner authority, hydrates without draft writes, and uses stored inactive values after commit and reactivation', async () => {
  let finish!: (response: HttpResponse) => void;
  renderWithBrume(<Harness />, {
    locale: 'en',
    respond: (request) =>
      request.query?.value
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : response(),
  });
  await select();
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
  expect(screen.getByLabelText('Note')).toHaveProperty('disabled', true);
  expect(api.getValue('items')).toEqual([]);
  await act(async () => finish(response(authority())));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', false),
  );
  expect(screen.queryByLabelText('Note')).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
  fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'B' } });
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'new note' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
  expect(screen.queryByLabelText('Kind')).toBeNull();
  expect(screen.queryByLabelText('Note')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() =>
    expect(api.getValue('items')).toEqual([
      { id: '1', visible: false, kind: 'B', note: 'new note' },
    ]),
  );
  expect(api.getField('items.0.note')?.active).toBe(false);
  expect(api.getEffectiveValue('items.0.kind')).toBe('A');
  fireEvent.click(screen.getByRole('button', { name: /Items/ }));
  fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
  expect(screen.getByLabelText('Kind')).toHaveProperty('value', 'B');
  expect(screen.getByLabelText('Note')).toHaveProperty('value', 'new note');
});
it('keeps a promised missing snapshot blocked and retries the existing declared endpoint', async () => {
  let attempts = 0;
  renderWithBrume(<Harness />, {
    locale: 'en',
    respond: (request) =>
      request.query?.value ? response(++attempts > 1 ? authority() : undefined) : response(),
  });
  await select();
  await screen.findByRole('button', { name: 'Retry' });
  expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', false),
  );
  expect(attempts).toBe(2);
  expect(api.getValue('items')).toEqual([]);
});
for (const invalidation of ['Cancel', 'Reset', 'Change scope']) {
  it(`rejects a late selected-owner snapshot after ${invalidation}`, async () => {
    const pending: { request: HttpRequest; finish(response: HttpResponse): void }[] = [];
    renderWithBrume(<Harness />, {
      locale: 'en',
      respond: (request) =>
        request.query?.value
          ? new Promise((finish) => {
              pending.push({ request, finish });
            })
          : response(),
    });
    await select();
    fireEvent.click(screen.getByRole('button', { name: invalidation }));
    await act(async () => pending[0]?.finish(response(authority('B'))));
    expect(api.getValue('items')).toEqual([]);
    expect(pending[0]?.request.signal?.aborted).toBe(true);
    await select();
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', true);
    await act(async () => pending.at(-1)?.finish(response(authority('A'))));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', false),
    );
    expect(screen.queryByLabelText('Note')).toBeNull();
  });
}

it('retains fetched authority across unrelated writes and automatically refreshes committed owners after a source dependency edit', async () => {
  const requests: { request: HttpRequest; finish(response: HttpResponse): void }[] = [];
  renderWithBrume(<Harness />, {
    locale: 'en',
    respond: (request) =>
      request.query?.value
        ? new Promise((finish) => {
            requests.push({ request, finish });
          })
        : response(),
  });
  act(() => api.setValue('items', [{ id: '1', visible: false, kind: 'B', note: 'draft note' }]));
  expect(api.getField('items.0.note')?.ready).toBe(false);
  await act(async () => requests.at(-1)?.finish(response(authority('A'))));
  await waitFor(() => expect(api.getEffectiveValue('items.0.kind')).toBe('A'));
  act(() => api.setValue('title', 'unrelated edit'));
  expect(api.getField('items.0.note')?.ready).toBe(true);
  expect(api.getEffectiveValue('items.0.kind')).toBe('A');
  act(() => api.setValue('scope', 'B'));
  expect(api.getField('items.0.note')?.ready).toBe(false);
  expect(requests.at(-1)?.request.query?.depends).toBe('{"scope":"B"}');
  await act(async () => requests.at(-1)?.finish(response(authority('B'))));
  await waitFor(() => expect(api.getField('items.0.note')?.ready).toBe(true));
  expect(api.getField('items.0.note')?.active).toBe(true);
  expect(api.getValue('items.0.note')).toBe('draft note');
});

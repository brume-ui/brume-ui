import type { FieldDef, FormDef, FormNode, RowContext } from '@brume-ui/brume-schema';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { Nodes } from './layout/nodes';
import { type FormApi, useFormState } from './use-form-state';

const node = (field: FieldDef): FormNode => ({ type: 'field', field });
const eq = (scope: 'root' | 'row', path: string, value: string | boolean) => ({
  op: 'eq' as const,
  field: { scope, path },
  value,
});
const required = [{ rule: 'required' as const, message: 'Required' }];
function definition(
  container: 'showWhen' | 'enableWhen',
  dependent: 'showWhen' | 'enableWhen',
  nested = false,
): FormDef {
  const scope = nested ? 'row' : 'root';
  const nodes = [
    node({ type: 'switch', name: 'visible', label: 'Visible' }),
    node({
      type: 'relation',
      name: 'items',
      label: 'Items',
      multiple: true,
      hydrateAuthority: true,
      remote: { url: '/items', dependsOn: { visible: { scope, path: 'visible' } } },
      [container]: eq(scope, 'visible', true),
      fields: [node({ type: 'text', name: 'kind', label: 'Kind', readOnly: true })],
    }),
    node({
      type: 'text',
      name: 'note',
      label: 'Note',
      rules: required,
      [dependent]: eq(scope, 'items.0.kind', 'B'),
    }),
  ];
  return {
    layout: 'stacked',
    nodes: nested
      ? [node({ type: 'repeater', name: 'rows', label: 'Rows', mode: 'relation', nodes })]
      : nodes,
  };
}
for (const container of ['showWhen', 'enableWhen'] as const) {
  for (const dependent of ['showWhen', 'enableWhen'] as const) {
    for (const nested of [false, true]) {
      for (const retained of [false, true]) {
        it(`${container}/${dependent}, nested=${nested}, retained=${retained}: readiness follows inactive authoritative membership and reactivation still requires the draft owner's authority`, () => {
          const form = definition(container, dependent, nested);
          const owner = {
            visible: true,
            items: retained ? [{ id: '2', kind: 'B' }] : [],
            note: '',
          };
          const { result } = renderHook(() =>
            useFormState(
              form,
              nested ? { rows: [{ _brume: { key: 'record:10', id: '10' }, ...owner }] } : owner,
            ),
          );
          const prefix = nested ? 'rows.0.' : '';
          const context: RowContext = [
            ...(nested ? [{ path: 'rows', key: 'record:10', id: '10' }] : []),
            { path: nested ? 'rows.*.items' : 'items', key: '1', id: '1' },
          ];
          act(() => {
            result.current.setValue(`${prefix}items`, [{ id: '1' }]);
            result.current.setRowAuthority(context, { values: { kind: 'A' } });
          });
          expect(result.current.getField(`${prefix}note`)?.ready).toBe(true);
          act(() => result.current.setValue(`${prefix}visible`, false));
          expect(result.current.getValue(`${prefix}items`)).toEqual([{ id: '1' }]);
          expect(result.current.getEffectiveValue(`${prefix}items`)).toEqual(owner.items);
          expect(result.current.getField(`${prefix}note`)).toMatchObject({
            ready: true,
            active: retained,
          });
          if (!retained)
            expect(result.current.getField(`${prefix}note`)).toMatchObject(
              dependent === 'showWhen' ? { visible: false } : { enabled: false },
            );
          act(() => expect(result.current.validateAll()).toBe(!retained));
          if (retained) {
            expect(result.current.errors[`${prefix}note`]).toEqual(['Required']);
            act(() => result.current.setValue(`${prefix}note`, 'ordinary note'));
            act(() => expect(result.current.validateAll()).toBe(true));
          }
          act(() => result.current.setValue(`${prefix}visible`, true));
          expect(result.current.getValue(`${prefix}items`)).toEqual([{ id: '1' }]);
          expect(result.current.getField(`${prefix}note`)?.ready).toBe(false);
          act(() => expect(result.current.validateAll()).toBe(false));
          act(() => result.current.setRowAuthority(context, { values: { kind: 'A' } }));
          expect(result.current.getField(`${prefix}note`)?.ready).toBe(true);
          act(() => expect(result.current.validateAll()).toBe(true));
        });
      }
    }
  }
}

it('keeps an actual unknown readonly container blocking even when its draft has no descendant owner', () => {
  const form: FormDef = {
    layout: 'stacked',
    nodes: [
      node({
        type: 'relation',
        name: 'owners',
        label: 'Owners',
        multiple: true,
        hydrateAuthority: true,
        remote: { url: '/owners' },
        fields: [
          node({
            type: 'relation',
            name: 'items',
            label: 'Items',
            multiple: true,
            readOnly: true,
            hydrateAuthority: true,
            remote: { url: '/items' },
            fields: [node({ type: 'text', name: 'kind', label: 'Kind', readOnly: true })],
          }),
        ],
      }),
      node({
        type: 'text',
        name: 'note',
        label: 'Note',
        rules: required,
        showWhen: eq('root', 'owners.0.items.0.kind', 'B'),
      }),
    ],
  };
  const { result } = renderHook(() => useFormState(form, { owners: [], note: '' }));
  act(() => result.current.setValue('owners', [{ id: '9', items: [] }]));
  expect(result.current.getField('note')?.ready).toBe(false);
  act(() => expect(result.current.validateAll()).toBe(false));
  act(() =>
    result.current.setRowAuthority([{ path: 'owners', key: '9', id: '9' }], {
      values: { items: [{ id: '1', kind: 'B' }] },
    }),
  );
  expect(result.current.getField('note')).toMatchObject({ ready: true, active: true });
  act(() => expect(result.current.validateAll()).toBe(false));
  expect(result.current.errors.note).toEqual(['Required']);
});

for (const condition of ['showWhen', 'enableWhen'] as const) {
  it(`allows the ordinary mounted picker ${condition} save path after discarded authority is invalidated`, async () => {
    const form = definition(condition, 'showWhen');
    let api!: FormApi;
    // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
    function Harness() {
      api = useFormState(form, { visible: true, items: [], note: '' });
      return <Nodes nodes={form.nodes} api={api} idPrefix="readiness" layout="stacked" />;
    }
    renderWithBrume(<Harness />, {
      locale: 'en',
      respond: (request) => ({
        status: 200,
        data: {
          data: [
            {
              value: '1',
              label: 'First',
              ...(request.query?.value ? { authority: { values: { kind: 'A' } } } : {}),
            },
          ],
          pagination: { page: 1, perPage: 20, hasMore: false },
        },
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: /Items/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select First' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Apply' })).toHaveProperty('disabled', false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Visible' }));
    expect(api.getValue('items')).toEqual([{ id: '1' }]);
    expect(api.getEffectiveValue('items')).toEqual([]);
    expect(screen.queryByLabelText('Note')).toBeNull();
    act(() => expect(api.validateAll()).toBe(true));
    if (condition === 'showWhen')
      expect(screen.queryByRole('button', { name: /Items/ })).toBeNull();
    else expect(screen.getByRole('button', { name: /Items/ })).toHaveProperty('disabled', true);
  });
}

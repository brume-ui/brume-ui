import type { HttpRequest } from '@brume-ui/brume-react';
import type { FieldDef, FormDef } from '@brume-ui/brume-schema';
import { act, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { Nodes } from './layout/nodes';
import { type FormApi, useFormState } from './use-form-state';

let api!: FormApi;
function Harness({ field, initial }: { field: FieldDef; initial: unknown }) {
  const form: FormDef = { layout: 'stacked', nodes: [{ type: 'field', field }] };
  api = useFormState(form, { selection: initial });
  return <Nodes nodes={form.nodes} api={api} idPrefix="hydration" layout="stacked" />;
}
for (const type of ['multipleSelect', 'relation'] as const) {
  it(`fresh-mounts 101 saved ${type} labels under the real protocol's request bound`, async () => {
    const ids = Array.from({ length: 101 }, (_, i) => String(i + 1));
    const field: FieldDef =
      type === 'relation'
        ? {
            type,
            name: 'selection',
            label: 'Selection',
            multiple: true,
            remote: { url: '/options' },
          }
        : { type, name: 'selection', label: 'Selection', remote: { url: '/options' } };
    const requests: HttpRequest[] = [];
    renderWithBrume(
      <Harness field={field} initial={type === 'relation' ? ids.map((id) => ({ id })) : ids} />,
      {
        locale: 'en',
        respond: (request) => {
          requests.push(request);
          const values = (request.query?.value ?? []) as string[];
          if (values.length > 100) return { status: 422, data: {} };
          return {
            status: 200,
            data: {
              data: values.map((value) => ({ value, label: `Saved ${value}` })),
              pagination: { page: 1, perPage: Math.max(1, values.length), hasMore: false },
            },
          };
        },
      },
    );
    await waitFor(() => expect(screen.getByText('Saved 101')).toBeTruthy());
    expect(screen.getByText('Saved 1')).toBeTruthy();
    expect(screen.queryByText(/Unavailable|Couldn.t load/)).toBeNull();
    expect(requests.map((request) => (request.query?.value ?? []).length)).toEqual([100, 1]);
    expect(api.getValue('selection')).toHaveLength(101);
  });
}
it('fresh-mounts later-section picker labels without imposing the browsing partition on hydration', async () => {
  const requests: HttpRequest[] = [];
  renderWithBrume(
    <Harness
      field={{
        type: 'relation',
        name: 'selection',
        label: 'Selection',
        multiple: true,
        remote: { url: '/options' },
      }}
      initial={[{ id: '23', note: 'saved extra' }]}
    />,
    {
      locale: 'en',
      respond: (request) => {
        requests.push(request);
        return {
          status: 200,
          data: {
            data:
              request.query?.value && request.query?.section === undefined
                ? [{ value: '23', label: 'Archived selection' }]
                : [],
            sections: [
              { key: 'current', label: 'Current' },
              { key: 'archived', label: 'Archived' },
            ],
            pagination: { page: 1, perPage: 20, hasMore: false },
          },
        };
      },
    },
  );
  await screen.findByText('Archived selection');
  expect(requests[0]?.query?.section).toBeUndefined();
  expect(api.getValue('selection')).toEqual([{ id: '23', note: 'saved extra' }]);
});
it('fresh-mounts mixed numeric suggestions and free literals and refreshes both after a dependency change', async () => {
  const requests: HttpRequest[] = [];
  // biome-ignore lint/correctness/noComponentHookFactories: this test mounts one stable harness instance.
  function TagsHarness() {
    const form: FormDef = {
      layout: 'stacked',
      nodes: [
        { type: 'field', field: { type: 'text', name: 'scope', label: 'Scope' } },
        {
          type: 'field',
          field: {
            type: 'tags',
            name: 'tags',
            label: 'Tags',
            remote: { url: '/tags', dependsOn: { scope: { scope: 'root', path: 'scope' } } },
          },
        },
      ],
    };
    api = useFormState(form, { scope: 'A', tags: ['1', 'free text'] });
    return <Nodes nodes={form.nodes} api={api} idPrefix="tags" layout="stacked" />;
  }
  renderWithBrume(<TagsHarness />, {
    locale: 'en',
    respond: (request) => {
      requests.push(request);
      return {
        status: 200,
        data: {
          data: [
            {
              value: '1',
              label: request.query?.depends === '{"scope":"B"}' ? 'B suggestion' : 'A suggestion',
            },
            { value: 'free text', label: 'free text' },
          ],
          pagination: { page: 1, perPage: 2, hasMore: false },
        },
      };
    },
  });
  await screen.findByText('A suggestion');
  expect(screen.getByText('free text')).toBeTruthy();
  act(() => api.setValue('scope', 'B'));
  await screen.findByText('B suggestion');
  expect(screen.getByText('free text')).toBeTruthy();
  expect(screen.queryByText(/Unavailable|Couldn.t load/)).toBeNull();
  expect(
    requests.every((request) => JSON.stringify(request.query?.value) === '["1","free text"]'),
  ).toBe(true);
});

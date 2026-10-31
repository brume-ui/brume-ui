import type { HttpRequest } from '@brume-ui/brume-react';
import type { FormDef } from '@brume-ui/brume-schema';
import { act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { type FormApi, useFormState } from './use-form-state';
import { useRemoteOptions } from './use-remote-options';

const remote = { url: '/options', dependsOn: { rows: { scope: 'root' as const, path: 'rows' } } };
const definition: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'field', field: { type: 'switch', name: 'visible', label: 'Visible' } },
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
            field: {
              type: 'text',
              name: 'kind',
              label: 'Kind',
              showWhen: { op: 'eq', field: { scope: 'root', path: 'visible' }, value: true },
            },
          },
        ],
      },
    },
    { type: 'field', field: { type: 'select', name: 'choice', label: 'Choice', remote } },
  ],
};

it('reads a bounded number of effective snapshots per remote operation as dependency rows grow, and refreshes after a synchronous edit', async () => {
  const reads: number[] = [];
  for (const count of [1, 12]) {
    let form!: FormApi;
    let source!: ReturnType<typeof useRemoteOptions>;
    let effective!: ReturnType<typeof vi.spyOn>;
    const requests: HttpRequest[] = [];
    // biome-ignore lint/correctness/noComponentHookFactories: each measurement owns one stable mounted harness.
    function Harness() {
      form = useFormState(definition, {
        visible: true,
        rows: Array.from({ length: count }, (_, i) => ({ _brume: { key: String(i) }, kind: 'A' })),
        choice: '',
      });
      effective = vi.spyOn(form, 'effectiveFields', 'get');
      source = useRemoteOptions({ form, path: 'choice', remote });
      return null;
    }
    const mounted = renderWithBrume(<Harness />, {
      respond: (request) => {
        requests.push(request);
        return {
          status: 200,
          data: { data: [], pagination: { page: 1, perPage: 20, hasMore: false } },
        };
      },
    });
    act(() => {
      form.setValue(
        'rows',
        Array.from({ length: count }, (_, i) => ({ _brume: { key: String(i) }, kind: 'B' })),
      );
      form.setValue('visible', false);
    });
    effective.mockClear();
    await act(async () => {
      await source.request({ q: '' });
    });
    reads.push(effective.mock.calls.length);
    const first = JSON.parse(String(requests.at(-1)?.query?.depends));
    expect(first.rows).toHaveLength(count);
    expect(first.rows.every((row: { kind: string }) => row.kind === 'A')).toBe(true);
    act(() => form.setValue('visible', true));
    await act(async () => {
      await source.request({ q: '' });
    });
    const next = JSON.parse(String(requests.at(-1)?.query?.depends));
    expect(next.rows.every((row: { kind: string }) => row.kind === 'B')).toBe(true);
    mounted.unmount();
  }
  expect(reads[0]).toBeGreaterThan(0);
  expect(reads[1]).toBe(reads[0]);
});

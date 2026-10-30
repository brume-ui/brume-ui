import {
  BrumeProvider,
  createMemoryAdapter,
  type HttpRequest,
  type HttpResponse,
} from '@brume-ui/brume-react';
import type { FieldDef, FormDef } from '@brume-ui/brume-schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { useFormState } from '../use-form-state';
import { ChoiceField } from './choice';

const remote = {
  url: '/options',
  dependsOn: { category: { scope: 'root' as const, path: 'category' } },
};
const field: FieldDef = {
  type: 'select',
  name: 'product',
  label: 'Product',
  remote,
  clearable: true,
};
const formDef: FormDef = {
  layout: 'stacked',
  nodes: [
    { type: 'field', field: { type: 'text', name: 'category', label: 'Category' } },
    { type: 'field', field },
  ],
};
function Harness({ def = field, readOnly = false }: { def?: FieldDef; readOnly?: boolean }) {
  const form = useFormState(
    { ...formDef, nodes: [...formDef.nodes.slice(0, 1), { type: 'field', field: def }] },
    { category: 'A', product: def.type === 'select' ? '7' : ['7'] },
  );
  return (
    <>
      <button type="button" onClick={() => form.setValue('category', 'B')}>
        Scope B
      </button>
      <button type="button" onClick={() => form.reset()}>
        Reset
      </button>
      <button
        type="button"
        onClick={() => form.setValue('product', def.type === 'select' ? null : [])}
      >
        Clear
      </button>
      <button
        type="button"
        onClick={() => form.setValue('product', def.type === 'select' ? '7' : ['7'])}
      >
        Reselect
      </button>
      <ChoiceField
        def={def}
        value={form.getValue('product')}
        onChange={(v) => form.setValue('product', v)}
        onBlur={() => {}}
        errors={{}}
        path="product"
        id="product"
        invalid={false}
        readOnly={readOnly}
        disabled={false}
        form={form}
      />
    </>
  );
}
function deferred() {
  let resolve!: (response: HttpResponse) => void;
  const promise = new Promise<HttpResponse>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const reply = (label?: string): HttpResponse => ({
  status: 200,
  data: {
    data: label ? [{ value: '7', label }] : [],
    pagination: { page: 1, perPage: 20, hasMore: false },
  },
});
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });

describe('remote form choices', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('replaces displayed selected labels and unchanged open query when dependencies change, ignoring late A', async () => {
    const old = deferred();
    const requests: HttpRequest[] = [];
    renderWithBrume(<Harness />, {
      respond: (req) => {
        requests.push(req);
        if (req.query?.depends === '{"category":"A"}' && req.query?.value) return old.promise;
        return reply(req.query?.depends === '{"category":"B"}' ? 'Scope B seven' : 'Scope A seven');
      },
    });
    const input = screen.getByRole('combobox', { name: 'Product' }) as HTMLInputElement;
    fireEvent.click(input);
    await tick();
    expect(screen.getByRole('option', { name: 'Scope A seven' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scope B' }));
    await tick();
    expect(input.value).toBe('Scope B seven');
    expect(screen.queryByRole('option', { name: 'Scope A seven' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Scope B seven' })).toBeTruthy();
    await act(async () => {
      old.resolve(reply('Late A'));
    });
    expect(input.value).toBe('Scope B seven');
    expect(
      requests.some((r) => r.query?.value?.[0] === '7' && !('value[]' in (r.query ?? {}))),
    ).toBe(true);
  });
  it('forgets hydrated A label when B omits the same ID and announces unavailable', async () => {
    renderWithBrume(<Harness />, {
      respond: (req) => reply(req.query?.depends === '{"category":"A"}' ? 'A label' : undefined),
    });
    await tick();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('A label');
    fireEvent.click(screen.getByRole('button', { name: 'Scope B' }));
    await tick();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).not.toBe('A label');
    expect(screen.getByText(/無法使用.*7/)).toBeTruthy();
  });
  it('clear/reselect and reset fence hydration even with the same ID', async () => {
    const old = deferred();
    let hydration = 0;
    const requests: HttpRequest[] = [];
    renderWithBrume(<Harness />, {
      respond: (req) => {
        requests.push(req);
        if (req.query?.value && ++hydration === 1) return old.promise;
        return reply(`Fresh ${hydration}`);
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reselect' }));
    await tick();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Fresh 2');
    await act(async () => {
      old.resolve(reply('Obsolete'));
    });
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Fresh 2');
    expect(requests[0]?.signal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await tick();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Fresh 3');
  });
  it.each(['select', 'multipleSelect', 'tags'] as const)(
    '%s hydrates separately from search and keeps drafts on failure',
    async (type) => {
      const def = { ...field, type } as FieldDef;
      renderWithBrume(<Harness def={def} />, {
        respond: (req) => (req.query?.value ? reply('Selected label') : { status: 500, data: {} }),
      });
      await tick();
      const input = screen.getByRole('combobox', { name: 'Product' });
      fireEvent.change(input, { target: { value: 'query' } });
      await tick();
      expect(screen.getByRole('button', { name: '重試' })).toBeTruthy();
      expect(screen.getAllByRole('status').some((el) => el.textContent?.includes('載入失敗'))).toBe(
        true,
      );
      fireEvent.blur(input);
      expect(
        type === 'select'
          ? (input as HTMLInputElement).value
          : screen.getByText('Selected label').textContent,
      ).toBe('Selected label');
    },
  );
});

it('hydrates remote read-only text without exposing editable controls', async () => {
  renderWithBrume(<Harness readOnly />, { respond: () => reply('Read-only label') });
  await act(async () => {});
  expect(screen.getByText('Read-only label').tagName).toBe('P');
  expect(screen.queryByRole('combobox')).toBeNull();
});

it.each(['select', 'multipleSelect', 'tags'] as const)(
  'resets %s caches on endpoint changes with unchanged selection and query',
  async (type) => {
    vi.useFakeTimers();
    try {
      const old = deferred();
      const def = { ...field, type } as FieldDef;
      const { rerender } = renderWithBrume(<Harness def={def} />, {
        respond: (req) => {
          if (req.url === '/new-options')
            return req.query?.value
              ? reply('New endpoint label')
              : {
                  status: 200,
                  data: {
                    data: [{ value: '8', label: 'New endpoint result' }],
                    pagination: { page: 1, perPage: 20, hasMore: false },
                  },
                };
          if (req.query?.value) return reply('Old endpoint label');
          return old.promise;
        },
      });
      await tick();
      const input = screen.getByRole('combobox') as HTMLInputElement;
      fireEvent.click(input);
      await tick();
      rerender(
        <Harness def={{ ...def, remote: { ...remote, url: '/new-options' } } as FieldDef} />,
      );
      await tick();
      expect(screen.getByRole('option', { name: 'New endpoint result' })).toBeTruthy();
      await act(async () => {
        old.resolve(reply('Obsolete old page'));
      });
      expect(screen.queryByRole('option', { name: 'Obsolete old page' })).toBeNull();
      fireEvent.blur(input);
      expect(
        type === 'select' ? input.value : screen.getByText('New endpoint label').textContent,
      ).toBe('New endpoint label');
    } finally {
      vi.useRealTimers();
    }
  },
);

it.each([
  ['zh-TW', '載入中', '沒有符合的選項', '選項載入失敗，請再試一次。', '重試'],
  ['zh-CN', '加载中', '没有符合的选项', '选项加载失败，请再试一次。', '重试'],
  ['en', 'Loading', 'No matching options', 'Couldn’t load the options. Try again.', 'Retry'],
] as const)(
  'announces loading, empty and failure with retry in %s',
  async (locale, loading, empty, failure, retry) => {
    vi.useFakeTimers();
    try {
      let fail = false;
      renderWithBrume(<Harness />, {
        locale,
        respond: (req) =>
          req.query?.value ? reply('Selected') : fail ? { status: 500, data: {} } : reply(),
      });
      await tick();
      const input = screen.getByRole('combobox');
      fireEvent.click(input);
      expect(screen.getByRole('status').textContent).toBe(loading);
      await tick();
      expect(screen.getByRole('status').textContent).toBe(empty);
      fail = true;
      fireEvent.change(input, { target: { value: 'new' } });
      await tick();
      expect(screen.getByRole('status').textContent).toBe(failure);
      fail = false;
      fireEvent.click(screen.getByRole('button', { name: retry }));
      await tick();
      expect(screen.getByRole('status').textContent).toBe(empty);
    } finally {
      vi.useRealTimers();
    }
  },
);

it('aborts search on clear before a noncooperative response returns', async () => {
  vi.useFakeTimers();
  try {
    const pending = deferred();
    let search!: HttpRequest;
    renderWithBrume(<Harness />, {
      respond: (req) => {
        if (req.query?.value) return reply('Selected');
        search = req;
        return pending.promise;
      },
    });
    await tick();
    fireEvent.click(screen.getByRole('combobox'));
    await tick();
    expect(search.signal?.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(search.signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve(reply('Obsolete result'));
    });
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('option')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

// Wrap the provider too: root StrictMode replays the parent request owner and child hydration effects.
it.each([
  { type: 'select', readOnly: false },
  { type: 'multipleSelect', readOnly: false },
  { type: 'tags', readOnly: false },
  { type: 'select', readOnly: true },
  { type: 'multipleSelect', readOnly: true },
  { type: 'tags', readOnly: true },
] as const)(
  '$type readOnly=$readOnly hydrates on normal mount and root StrictMode replay',
  async ({ type, readOnly }) => {
    for (const strict of [false, true]) {
      const def = { ...field, type } as FieldDef;
      const adapter = createMemoryAdapter('/', { respond: () => reply('Hydrated seven') });
      const content = (
        <BrumeProvider adapter={adapter}>
          <Harness def={def} readOnly={readOnly} />
        </BrumeProvider>
      );
      const { unmount } = render(strict ? <StrictMode>{content}</StrictMode> : content);
      await act(async () => {});
      if (readOnly) expect(screen.getByText('Hydrated seven').tagName).toBe('P');
      else if (type === 'select')
        expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('Hydrated seven');
      else expect(screen.getByText('Hydrated seven')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '重試' })).toBeNull();
      unmount();
    }
  },
);

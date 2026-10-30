import type { HttpRequest } from '@brume-ui/brume-react';
import type { FormPage, ListPage } from '@brume-ui/brume-schema';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ListPageView } from '../../list-page';
import { renderWithBrume } from '../../test-utils';

const form: FormPage = {
  type: 'form',
  title: '新增訂單',
  name: '訂單',
  formId: 'orders',
  mode: 'create',
  form: {
    layout: 'stacked',
    nodes: [{ type: 'field', field: { type: 'text', name: 'name', label: 'Name' } }],
  },
  values: { name: '' },
  submit: { method: 'post', url: '/orders', label: 'Save' },
  after: { default: 'create', options: ['create', 'list'] },
  presentation: 'modal',
  size: 'sm',
};
const page: ListPage = {
  type: 'list',
  title: 'Orders',
  gridId: 'orders',
  columns: [{ key: 'name', label: 'Name', primary: true }],
  rows: [
    { id: 7, name: 'Ada' },
    { id: 'a/b', name: 'Bo' },
  ],
  pagination: { page: 1, perPage: 20, total: 2, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  resource: {
    name: '訂單',
    createUrl: '/admin/orders/create',
    editUrl: '/admin/orders/{id}/edit',
    presentation: 'modal',
  },
};
it('loads create with form header and keeps dialog for create after save', async () => {
  const respond = vi.fn((req) => ({
    status: 200,
    data:
      req.method === 'get'
        ? { schemaVersion: '0.3.0', page: form }
        : { id: 8, urls: { edit: '/orders/8/edit' } },
  }));
  const { adapter } = renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  await screen.findByRole('dialog', { name: '新增訂單' });
  expect(respond.mock.calls[0]?.[0]).toMatchObject({
    method: 'get',
    url: '/admin/orders/create',
    headers: { 'X-Brume-Form': '1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(3));
  expect(adapter.calls.some((c) => c.fn === 'reload')).toBe(true);
});
it('loads row and next encoded id, disables next at boundary', async () => {
  const respond = vi.fn((_req: HttpRequest) => ({
    status: 200,
    data: { schemaVersion: '0.3.0', page: { ...form, title: '編輯訂單', mode: 'edit' } },
  }));
  renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: 'Ada' }));
  await screen.findByRole('dialog', { name: '編輯訂單' });
  expect(respond.mock.calls[0]?.[0]).toMatchObject({ url: '/admin/orders/7/edit' });
  fireEvent.click(screen.getByRole('button', { name: '下一筆' }));
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(2));
  expect(respond.mock.calls[1]?.[0]).toMatchObject({ url: '/admin/orders/a%2Fb/edit' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '下一筆' }).hasAttribute('disabled')).toBe(true),
  );
});
it('page presentation visits without loading', () => {
  const { adapter } = renderWithBrume(
    <ListPageView
      page={{
        ...page,
        resource: { name: '訂單', createUrl: '/admin/orders/create', presentation: 'page' },
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  expect(adapter.calls.find((c) => c.fn === 'visit')?.args[0]).toBe('/admin/orders/create');
  expect(adapter.calls.some((c) => c.fn === 'request')).toBe(false);
});
it('failed loading offers retry', async () => {
  const respond = vi.fn((_req: HttpRequest) => ({ status: 500, data: {} }));
  renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '重試' }));
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(2));
});
it('quick create ignores composing Enter, sends values, resets and refreshes', async () => {
  const respond = vi.fn((_req: HttpRequest) => ({
    status: 200,
    data: { id: 9, urls: { edit: '/orders/9/edit' } },
  }));
  const { adapter } = renderWithBrume(
    <ListPageView
      page={{
        ...page,
        quickCreate: {
          label: 'Quick',
          fields: [{ type: 'text', name: 'name', label: 'Quick name' }],
          submitUrl: '/admin/orders/_brume/quick-create',
        },
      }}
    />,
    { respond },
  );
  fireEvent.click(screen.getByRole('button', { name: '快速新增' }));
  const input = screen.getByLabelText('Quick name');
  fireEvent.change(input, { target: { value: 'New' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(respond).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
  expect(respond.mock.calls[0]?.[0]).toMatchObject({
    method: 'post',
    url: '/admin/orders/_brume/quick-create',
    body: { values: { name: 'New' } },
  });
  await waitFor(() =>
    expect((screen.getByLabelText('Quick name') as HTMLInputElement).value).toBe(''),
  );
  expect(adapter.calls.some((c) => c.fn === 'reload')).toBe(true);
});

it('ignores a late load after closing and opening another record', async () => {
  let finish!: (value: import('@brume-ui/brume-react').HttpResponse) => void;
  const respond = vi.fn((req: HttpRequest) =>
    req.url.includes('create')
      ? new Promise<import('@brume-ui/brume-react').HttpResponse>((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({
          status: 200,
          data: { schemaVersion: '0.3.0', page: { ...form, title: 'Editing' } },
        }),
  );
  renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  await screen.findByRole('dialog');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(respond.mock.calls[0]?.[0].signal?.aborted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Ada' }));
  await screen.findByRole('dialog', { name: 'Editing' });
  await import('@testing-library/react').then(({ act }) =>
    act(async () => finish({ status: 200, data: { schemaVersion: '0.3.0', page: form } })),
  );
  expect(screen.getByRole('dialog', { name: 'Editing' })).toBeTruthy();
});
it('rejects nonform and incompatible loader envelopes and unsafe schema urls', async () => {
  const respond = vi.fn(() => ({ status: 200, data: { schemaVersion: '1.0.0', page: form } }));
  const { rerender, adapter } = renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  await screen.findByRole('alert');
  rerender(
    <ListPageView
      page={{
        ...page,
        gridId: 'unsafe',
        resource: {
          name: '訂單',
          presentation: 'modal',
          createUrl: 'javascript:alert(1)',
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  expect(respond).toHaveBeenCalledTimes(1);
  expect(adapter.calls.some((c) => c.fn === 'visit')).toBe(false);
});
it('cancelled quick create keeps values and never takes the saved refresh path', async () => {
  const respond = vi.fn((_req: HttpRequest) => ({
    status: 200,
    data: { cancelled: true, feedback: {} },
  }));
  const { adapter } = renderWithBrume(
    <ListPageView
      page={{
        ...page,
        quickCreate: {
          label: 'Quick',
          fields: [{ type: 'text', name: 'name', label: 'Quick name' }],
          submitUrl: '/quick',
        },
      }}
    />,
    { respond },
  );
  fireEvent.click(screen.getByRole('button', { name: '快速新增' }));
  fireEvent.change(screen.getByLabelText('Quick name'), { target: { value: 'Keep' } });
  fireEvent.keyDown(screen.getByLabelText('Quick name'), { key: 'Enter' });
  await waitFor(() => expect(respond).toHaveBeenCalledTimes(1));
  expect((screen.getByLabelText('Quick name') as HTMLInputElement).value).toBe('Keep');
  expect(adapter.calls.some((c) => c.fn === 'reload')).toBe(false);
});

it('quick create retains 422 input and prevents duplicate in-flight submissions', async () => {
  let finish!: (res: import('@brume-ui/brume-react').HttpResponse) => void;
  const respond = vi.fn(
    (_req: HttpRequest) =>
      new Promise<import('@brume-ui/brume-react').HttpResponse>((resolve) => {
        finish = resolve;
      }),
  );
  renderWithBrume(
    <ListPageView
      page={{
        ...page,
        quickCreate: {
          label: 'Quick',
          fields: [{ type: 'text', name: 'name', label: 'Quick name' }],
          submitUrl: '/quick',
        },
      }}
    />,
    { respond },
  );
  fireEvent.click(screen.getByRole('button', { name: '快速新增' }));
  fireEvent.change(screen.getByLabelText('Quick name'), { target: { value: 'Keep' } });
  fireEvent.keyDown(screen.getByLabelText('Quick name'), { key: 'Enter' });
  fireEvent.keyDown(screen.getByLabelText('Quick name'), { key: 'Enter' });
  expect(respond).toHaveBeenCalledTimes(1);
  await import('@testing-library/react').then(({ act }) =>
    act(async () => finish({ status: 422, data: { errors: { name: ['Name rejected'] } } })),
  );
  expect(screen.getAllByText('Name rejected').length).toBeGreaterThan(0);
  expect((screen.getByLabelText('Quick name') as HTMLInputElement).value).toBe('Keep');
});
it('feedback redirect takes precedence over after-create and refresh', async () => {
  const respond = vi.fn((req: HttpRequest) => ({
    status: 200,
    data:
      req.method === 'get'
        ? { schemaVersion: '0.3.0', page: form }
        : { id: 1, urls: { edit: '/edit' }, feedback: { redirect: '/welcome', refresh: true } },
  }));
  const { adapter } = renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  await screen.findByRole('button', { name: 'Save' });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(adapter.calls.some((c) => c.fn === 'visit' && c.args[0] === '/welcome')).toBe(true),
  );
  expect(respond).toHaveBeenCalledTimes(2);
  expect(adapter.calls.some((c) => c.fn === 'reload')).toBe(false);
});

it('modal list after-save closes and refreshes without navigating or dropping filters', async () => {
  const respond = vi.fn((req: HttpRequest) => ({
    status: 200,
    data:
      req.method === 'get'
        ? {
            schemaVersion: '0.3.0',
            page: { ...form, after: { default: 'list', options: ['list'] } },
          }
        : { id: 1, urls: { edit: '/edit' } },
  }));
  const { adapter } = renderWithBrume(<ListPageView page={page} />, {
    respond,
    url: '/orders?q=ada&scope=open',
  });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(adapter.calls.find((c) => c.fn === 'reload')?.args[0]).toEqual({ only: ['envelope'] });
  expect(adapter.currentUrl()).toBe('/orders?q=ada&scope=open');
  expect(adapter.calls.some((c) => c.fn === 'visit')).toBe(false);
});
it('refuses a compatible envelope containing a non-form page', async () => {
  const respond = vi.fn(() => ({ status: 200, data: { schemaVersion: '0.3.0', page } }));
  renderWithBrume(<ListPageView page={page} />, { respond });
  fireEvent.click(screen.getByRole('button', { name: '新增訂單' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: '重試' })).toBeTruthy();
});

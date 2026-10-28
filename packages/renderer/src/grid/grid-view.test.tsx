import { type ListPage, parseGridQuery } from '@brume-ui/brume-schema';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { GridView } from './grid-view';

const orders: ListPage = {
  type: 'list',
  title: '訂單',
  gridId: 'orders',
  columns: [
    { key: 'customer', label: '客戶' },
    { key: 'amount', label: '金額', numeric: true, sortable: true },
  ],
  rows: [
    { id: 1, customer: 'Ada', amount: 120 },
    { id: 2, customer: 'Bo', amount: 80 },
  ],
  pagination: { page: 1, perPage: 20, total: 2, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20, 50],
  quickSearch: {},
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
};

const ENVELOPE_ONLY = { preserveScroll: true, preserveState: true, only: ['envelope'] };

type Adapter = ReturnType<typeof renderWithBrume>['adapter'];
const visits = (adapter: Adapter) => adapter.calls.filter((c) => c.fn === 'visit');
const lastVisit = (adapter: Adapter) => visits(adapter).at(-1);
const lastUrl = (adapter: Adapter) => new URL(String(lastVisit(adapter)?.args[0]), 'http://x');

describe('GridView navigation', () => {
  it('cycles a sortable header through asc, desc and unsorted via the URL', async () => {
    const user = userEvent.setup();
    const { adapter, rerender } = renderWithBrume(<GridView page={orders} />, {
      url: '/admin/orders?page=3',
    });
    // The server answers each visit with a page whose query reflects the new URL.
    const serve = () => {
      const { sort } = parseGridQuery(new URL(adapter.currentUrl(), 'http://x').search);
      rerender(<GridView page={{ ...orders, query: { ...orders.query, sort } }} />);
    };
    const sortButton = () =>
      within(screen.getByRole('columnheader', { name: /金額/ })).getByRole('button');

    await user.click(sortButton());
    expect(lastUrl(adapter).searchParams.get('sort')).toBe('amount');
    expect(lastUrl(adapter).searchParams.has('page')).toBe(false);
    expect(lastVisit(adapter)?.args[1]).toEqual(ENVELOPE_ONLY);
    serve();
    expect(screen.getByRole('columnheader', { name: /金額/ }).getAttribute('aria-sort')).toBe(
      'ascending',
    );

    await user.click(sortButton());
    expect(lastUrl(adapter).searchParams.get('sort')).toBe('-amount');
    serve();

    await user.click(sortButton());
    expect(lastUrl(adapter).searchParams.has('sort')).toBe(false);
    expect(visits(adapter)).toHaveLength(3);
  });

  it('does not make unsortable headers clickable', () => {
    renderWithBrume(<GridView page={orders} />);
    const th = screen.getByRole('columnheader', { name: '客戶' });
    expect(within(th).queryByRole('button')).toBeNull();
  });

  it('quick search submits q and drops page', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={orders} />, {
      url: '/admin/orders?page=4&per_page=50',
    });
    await user.type(screen.getByRole('searchbox', { name: '搜尋' }), 'ada{Enter}');
    expect(lastUrl(adapter).searchParams.get('q')).toBe('ada');
    expect(lastUrl(adapter).searchParams.has('page')).toBe(false);
    expect(lastUrl(adapter).searchParams.get('per_page')).toBe('50');
    expect(lastVisit(adapter)?.args[1]).toEqual(ENVELOPE_ONLY);
  });

  it('hides quick search when the page does not offer it', () => {
    renderWithBrume(<GridView page={{ ...orders, quickSearch: undefined }} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('per-page select visits with per_page', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={orders} />, {
      url: '/admin/orders?page=2',
    });
    const select = screen.getByRole('combobox', { name: '每頁筆數' });
    expect(select.textContent).toContain('每頁 20 筆');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: '每頁 50 筆' }));
    expect(lastUrl(adapter).searchParams.get('per_page')).toBe('50');
    expect(lastUrl(adapter).searchParams.has('page')).toBe(false);
    expect(lastVisit(adapter)?.args[1]).toEqual(ENVELOPE_ONLY);
  });

  it('refresh reloads only the envelope', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={orders} />);
    await user.click(screen.getByRole('button', { name: '重新整理' }));
    const reload = adapter.calls.find((c) => c.fn === 'reload');
    expect(reload?.args[0]).toEqual({ only: ['envelope'] });
    expect(visits(adapter)).toHaveLength(0);
  });

  it('pagination visits the page with the envelope-only options and keeps the query', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(
      <GridView
        page={{ ...orders, pagination: { page: 1, perPage: 20, total: 60, lastPage: 3 } }}
      />,
      { url: '/admin/orders?q=ada&filter[status]=paid' },
    );
    await user.click(screen.getByRole('link', { name: '第 2 頁' }));
    expect(String(lastVisit(adapter)?.args[0])).toBe(
      '/admin/orders?page=2&q=ada&filter[status]=paid',
    );
    expect(lastVisit(adapter)?.args[1]).toEqual(ENVELOPE_ONLY);
  });
});

describe('GridView empty states', () => {
  const none = { rows: [], pagination: { page: 1, perPage: 20, total: 0, lastPage: 1 } };

  it('filtered empty state offers clearing filters', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(
      <GridView
        page={{
          ...orders,
          ...none,
          query: { ...orders.query, q: 'zzz', scope: 'vip', filters: { status: 'paid' } },
          appliedFilters: [{ key: 'status', label: '狀態', display: '已付款' }],
        }}
      />,
      { url: '/admin/orders?q=zzz&scope=vip&filter[status]=paid&filter[tags][]=a&page=2&ref=nav' },
    );
    expect(screen.getByText('沒有符合條件的資料')).toBeTruthy();
    expect(screen.getByText('換個關鍵字或移除部分篩選條件再試一次。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '清除所有篩選' }));
    const url = String(lastVisit(adapter)?.args[0]);
    expect(url).not.toContain('filter[');
    // A bare filter= keeps the backend's filter defaults off (R28).
    expect(url).toBe('/admin/orders?ref=nav&filter=');
    expect(lastVisit(adapter)?.args[1]).toEqual(ENVELOPE_ONLY);
  });

  it('clearing a defaulted filter does not loop back to the same empty page', async () => {
    const user = userEvent.setup();
    // The server applied a default (no filter param in the URL) and nothing matched.
    const defaulted = {
      ...orders,
      ...none,
      query: { ...orders.query, filters: { status: 'paid' } },
      appliedFilters: [{ key: 'status', label: '狀態', display: '已付款' }],
    };
    const { adapter, rerender } = renderWithBrume(<GridView page={defaulted} />, {
      url: '/admin/orders',
    });
    await user.click(screen.getByRole('button', { name: '清除所有篩選' }));
    expect(String(lastVisit(adapter)?.args[0])).toBe('/admin/orders?filter=');
    // The server answers filter= without its default: the unfiltered empty state, no clear button.
    rerender(<GridView page={{ ...orders, ...none }} />);
    expect(screen.getByText('目前沒有資料')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '清除所有篩選' })).toBeNull();
  });

  it('treats a search term alone as filtered', () => {
    renderWithBrume(<GridView page={{ ...orders, ...none, query: { ...orders.query, q: 'x' } }} />);
    expect(screen.getByRole('button', { name: '清除所有篩選' })).toBeTruthy();
  });

  it('unfiltered empty state shows the next-step action as a real link', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(
      <GridView
        page={{
          ...orders,
          ...none,
          empty: {
            title: '還沒有訂單',
            description: '建立第一筆訂單後會顯示在這裡。',
            action: { label: '新增訂單', url: '/admin/orders/create' },
          },
        }}
      />,
    );
    expect(screen.getByText('還沒有訂單')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '清除所有篩選' })).toBeNull();
    const link = screen.getByRole('link', { name: '新增訂單' });
    expect(link.getAttribute('href')).toBe('/admin/orders/create');
    await user.click(link);
    expect(lastVisit(adapter)?.args[0]).toBe('/admin/orders/create');
  });

  it('falls back to the default copy without page.empty', () => {
    renderWithBrume(<GridView page={{ ...orders, ...none }} />);
    expect(screen.getByText('目前沒有資料')).toBeTruthy();
    expect(screen.getByText('新增第一筆後會顯示在這裡。')).toBeTruthy();
  });
});

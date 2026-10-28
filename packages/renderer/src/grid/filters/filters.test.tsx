import { createMemoryAdapter, type HttpRequest } from '@brume-ui/brume-react';
import { type ListPage, type OptionsResponse, parseGridQuery } from '@brume-ui/brume-schema';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { GridView } from '../grid-view';
import { remoteLoader } from './filter-input';

const OPTIONS = '/admin/orders/_brume/options/{source}';

const orders: ListPage = {
  type: 'list',
  title: '訂單',
  gridId: 'orders',
  columns: [
    { key: 'customer', label: '客戶', filter: 'customer_name' },
    { key: 'amount', label: '金額', numeric: true },
  ],
  rows: [
    { id: 1, customer: 'Ada', amount: 120 },
    { id: 2, customer: 'Bo', amount: 80 },
  ],
  pagination: { page: 1, perPage: 20, total: 2, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  filters: {
    columns: 2,
    items: [
      {
        key: 'status',
        label: '狀態',
        placement: 'panel',
        input: {
          type: 'select',
          options: [
            { value: 'paid', label: '已付款' },
            { value: 'pending', label: '待付款' },
          ],
        },
      },
      { type: 'newline' },
      {
        key: 'amount',
        label: '金額',
        placement: 'panel',
        span: 2,
        input: { type: 'range', of: 'number' },
      },
      {
        key: 'customer',
        label: '客戶',
        placement: 'panel',
        input: { type: 'select', remote: true },
      },
      { key: 'secret', label: '內部代碼', placement: 'hidden', input: { type: 'text' } },
    ],
  },
  columnFilters: [
    { key: 'customer_name', label: '客戶名稱', placement: 'column', input: { type: 'text' } },
  ],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  endpoints: { options: OPTIONS },
};

type Adapter = ReturnType<typeof renderWithBrume>['adapter'];
const visits = (adapter: Adapter) => adapter.calls.filter((c) => c.fn === 'visit');
const lastHref = (adapter: Adapter) => String(visits(adapter).at(-1)?.args[0]);
const requests = (adapter: Pick<Adapter, 'calls'>) =>
  adapter.calls.filter((c) => c.fn === 'request').map((c) => c.args[0] as HttpRequest);

/** 「篩選」, followed by the applied count when there is one. */
const filterToggle = () => screen.getByRole('button', { name: /^篩選\d*$/ });

const customers: OptionsResponse = {
  data: [{ value: '7', label: 'Ada Lovelace' }],
  pagination: { page: 1, perPage: 20, hasMore: false },
};

/** Re-renders with the page the server would answer for the adapter's current URL. */
function serve(adapter: Adapter, rerender: (ui: React.ReactNode) => void, base: ListPage) {
  const parsed = parseGridQuery(new URL(adapter.currentUrl(), 'http://x').search);
  rerender(
    <GridView
      page={{
        ...base,
        query: { ...base.query, filters: parsed.filters, scope: parsed.scope },
      }}
    />,
  );
}

describe('filter panel', () => {
  it('expands under the toolbar and visits only on 「套用篩選」', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={orders} />, { url: '/admin/orders' });
    const toggle = filterToggle();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const panel = document.getElementById(String(toggle.getAttribute('aria-controls')));
    expect(panel?.hidden).toBe(true);
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hidden).toBe(false);
    // Inline, not a dialog.
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('combobox', { name: '狀態' }));
    await user.click(await screen.findByRole('option', { name: '已付款' }));
    await user.type(screen.getByRole('spinbutton', { name: '金額（起）' }), '100');
    expect(visits(adapter)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '套用篩選' }));
    expect(visits(adapter)).toHaveLength(1);
    expect(lastHref(adapter)).toBe('/admin/orders?filter[status]=paid&filter[amount][start]=100');
    expect(visits(adapter)[0]?.args[1]).toEqual({
      preserveScroll: true,
      preserveState: true,
      only: ['envelope'],
    });
  });

  it('lays items on a CSS grid: newline starts a new row, span 2 takes two columns', async () => {
    const user = userEvent.setup();
    renderWithBrume(<GridView page={orders} />);
    await user.click(filterToggle());
    const cell = (name: string) =>
      screen.getByText(name, { selector: 'label' }).closest('[data-filter-item]') as HTMLElement;
    expect(cell('狀態').style.gridRow).toBe('1');
    expect(cell('金額').style.gridRow).toBe('2');
    expect(cell('金額').style.gridColumn).toBe('1 / span 2');
    expect(cell('客戶').style.gridRow).toBe('3');
    const grid = cell('狀態').parentElement as HTMLElement;
    expect(grid.style.getPropertyValue('--br-filter-columns')).toBe('2');
  });

  it('leaves hidden filters out of the panel', async () => {
    const user = userEvent.setup();
    renderWithBrume(<GridView page={orders} />);
    await user.click(filterToggle());
    expect(screen.queryByText('內部代碼')).toBeNull();
  });

  it('「重設」 clears the draft without visiting; the button counts applied panel filters', async () => {
    const user = userEvent.setup();
    const page: ListPage = {
      ...orders,
      query: { ...orders.query, filters: { status: 'paid', amount: { start: '100' } } },
      appliedFilters: [
        { key: 'status', label: '狀態', display: '已付款' },
        { key: 'amount', label: '金額', display: '100 起' },
      ],
    };
    const { adapter } = renderWithBrume(<GridView page={page} />);
    const toggle = filterToggle();
    expect(toggle.querySelector('[data-count]')?.textContent).toBe('2');
    await user.click(toggle);
    const from = screen.getByRole('spinbutton', { name: '金額（起）' }) as HTMLInputElement;
    expect(from.value).toBe('100');
    await user.click(screen.getByRole('button', { name: '重設' }));
    expect(from.value).toBe('');
    expect(visits(adapter)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '套用篩選' }));
    expect(lastHref(adapter)).toBe('/admin/users');
  });

  it('loads remote options through adapter.request with q, page and per_page=20', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={orders} />, {
      url: '/admin/orders',
      respond: () => ({ status: 200, data: customers }),
    });
    await user.click(filterToggle());
    await user.type(screen.getByRole('combobox', { name: '客戶' }), 'ad');
    await screen.findByRole('option', { name: 'Ada Lovelace' });
    expect(requests(adapter).at(-1)).toEqual({
      method: 'get',
      url: '/admin/orders/_brume/options/customer',
      query: { q: 'ad', page: '1', per_page: '20' },
    });
  });

  it('turns an applied remote value back into its label with value[] once the panel opens', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(
      <GridView page={{ ...orders, query: { ...orders.query, filters: { customer: '7' } } }} />,
      { respond: () => ({ status: 200, data: customers }) },
    );
    expect(requests(adapter)).toHaveLength(0);
    await user.click(filterToggle());
    await waitFor(() =>
      expect(requests(adapter)).toContainEqual({
        method: 'get',
        url: '/admin/orders/_brume/options/customer',
        query: { value: ['7'] },
      }),
    );
    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: '客戶' }) as HTMLInputElement).value).toBe(
        'Ada Lovelace',
      ),
    );
  });
});

describe('remoteLoader', () => {
  it('encodes the source, asks for 20 per page and throws on a failed response', async () => {
    const adapter = createMemoryAdapter('/', {
      respond: (req) =>
        req.query?.page === '2'
          ? { status: 500, data: { message: 'boom' } }
          : {
              status: 200,
              data: { ...customers, pagination: { ...customers.pagination, hasMore: true } },
            },
    });
    const load = remoteLoader(OPTIONS, 'a/b', adapter);
    await expect(load({ q: '', page: 1 })).resolves.toEqual({
      options: customers.data,
      hasMore: true,
    });
    expect(requests(adapter)[0]?.url).toBe('/admin/orders/_brume/options/a%2Fb');
    await expect(load({ q: '', page: 2 })).rejects.toThrow();
  });
});

describe('applied-filter chips', () => {
  const applied: ListPage = {
    ...orders,
    query: {
      ...orders.query,
      scope: 'vip',
      q: 'ada',
      filters: { status: 'paid', amount: { start: '100' } },
    },
    appliedFilters: [
      { key: 'status', label: '狀態', display: '已付款' },
      { key: 'scope', label: '範圍', display: 'VIP' },
      { key: 'q', label: '搜尋', display: 'ada' },
    ],
  };
  const url = '/admin/orders?q=ada&scope=vip&filter[status]=paid&filter[amount][start]=100';

  it('removes one filter key through navigate', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={applied} />, { url });
    await user.click(screen.getByRole('button', { name: '移除篩選：狀態' }));
    const href = lastHref(adapter);
    expect(href).not.toContain('filter[status]');
    expect(href).toContain('filter[amount][start]=100');
    expect(href).toContain('scope=vip');
  });

  it('removes scope and q like any other key', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={applied} />, { url });
    await user.click(screen.getByRole('button', { name: '移除篩選：範圍' }));
    expect(lastHref(adapter)).not.toContain('scope=');
    await user.click(screen.getByRole('button', { name: '移除篩選：搜尋' }));
    expect(lastHref(adapter)).not.toContain('q=');
  });

  it('offers 「清除所有篩選」 only with more than one chip', async () => {
    const user = userEvent.setup();
    const { adapter, rerender } = renderWithBrume(<GridView page={applied} />, { url });
    const chips = screen.getByRole('group', { name: '已套用的篩選' });
    await user.click(within(chips).getByRole('button', { name: '清除所有篩選' }));
    expect(lastHref(adapter)).toBe('/admin/orders');
    rerender(
      <GridView page={{ ...applied, appliedFilters: applied.appliedFilters.slice(0, 1) }} />,
    );
    expect(
      within(screen.getByRole('group', { name: '已套用的篩選' })).queryByRole('button', {
        name: '清除所有篩選',
      }),
    ).toBeNull();
  });
});

describe('column header filters', () => {
  it('opens a popover with just that input and applies it', async () => {
    const user = userEvent.setup();
    const { adapter } = renderWithBrume(<GridView page={orders} />, { url: '/admin/orders' });
    const th = screen.getByRole('columnheader', { name: /客戶/ });
    const funnel = within(th).getByRole('button', { name: '篩選「客戶名稱」' });
    expect(funnel.className).not.toContain('br:bg-accent-tint');
    await user.click(funnel);
    const dialog = await screen.findByRole('dialog', { name: '客戶名稱' });
    await user.type(within(dialog).getByRole('textbox', { name: '客戶名稱' }), 'Ada');
    expect(visits(adapter)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: '套用' }));
    expect(lastHref(adapter)).toBe('/admin/orders?filter[customer_name]=Ada');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('tints the funnel while the filter has a value; 「清除」 removes it', async () => {
    const user = userEvent.setup();
    const page: ListPage = {
      ...orders,
      query: { ...orders.query, filters: { customer_name: 'Ada', status: 'paid' } },
    };
    const { adapter } = renderWithBrume(<GridView page={page} />, {
      url: '/admin/orders?filter[customer_name]=Ada&filter[status]=paid',
    });
    const funnel = screen.getByRole('button', { name: '篩選「客戶名稱」' });
    expect(funnel.className).toContain('br:bg-accent-tint');
    await user.click(funnel);
    await user.click(await screen.findByRole('button', { name: '清除' }));
    expect(lastHref(adapter)).toBe('/admin/orders?filter[status]=paid');
  });
});

describe('selectors', () => {
  const page: ListPage = {
    ...orders,
    selectors: [
      {
        key: 'category',
        label: '分類',
        multiple: true,
        options: [
          { value: 'a', label: '書籍' },
          { value: 'b', label: '文具' },
        ],
      },
      {
        key: 'state',
        label: '狀況',
        multiple: false,
        options: [
          { value: 'new', label: '新品' },
          { value: 'used', label: '二手' },
        ],
      },
    ],
  };

  it('multiple: toggles several options into filter[key][]', async () => {
    const user = userEvent.setup();
    const { adapter, rerender } = renderWithBrume(<GridView page={page} />, {
      url: '/admin/orders',
    });
    const group = screen.getByRole('group', { name: '分類' });
    await user.click(within(group).getByRole('button', { name: '書籍' }));
    serve(adapter, rerender, page);
    await user.click(within(group).getByRole('button', { name: '文具' }));
    expect(lastHref(adapter)).toBe('/admin/orders?filter[category][]=a&filter[category][]=b');
  });

  it('single: a click applies, clicking the chosen option clears it', async () => {
    const user = userEvent.setup();
    const { adapter, rerender } = renderWithBrume(<GridView page={page} />, {
      url: '/admin/orders',
    });
    const group = screen.getByRole('group', { name: '狀況' });
    await user.click(within(group).getByRole('button', { name: '新品' }));
    expect(lastHref(adapter)).toBe('/admin/orders?filter[state]=new');
    serve(adapter, rerender, page);
    const chosen = within(group).getByRole('button', { name: '新品' });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    await user.click(chosen);
    expect(lastHref(adapter)).toBe('/admin/orders');
  });
});

describe('scopes', () => {
  const page: ListPage = {
    ...orders,
    scopes: [
      { key: 'vip', label: 'VIP' },
      { key: 'month', label: '本月' },
    ],
  };

  it('is a radiogroup led by 「全部」; picking sets scope, 「全部」 removes it', async () => {
    const user = userEvent.setup();
    const { adapter, rerender } = renderWithBrume(<GridView page={page} />, {
      url: '/admin/orders',
    });
    const group = screen.getByRole('radiogroup', { name: '範圍' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['全部', 'VIP', '本月']);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    await user.click(within(group).getByRole('radio', { name: 'VIP' }));
    expect(lastHref(adapter)).toBe('/admin/orders?scope=vip');
    serve(adapter, rerender, page);
    await user.click(within(group).getByRole('radio', { name: '全部' }));
    expect(lastHref(adapter)).toBe('/admin/orders');
  });
});

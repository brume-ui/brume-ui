import {
  ConfirmHost,
  createMemoryAdapter,
  type HttpRequest,
  type HttpResponse,
  toast,
} from '@brume-ui/brume-react';
import type { ActionDef, GridRow, ListPage } from '@brume-ui/brume-schema';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { ListPageView } from '../../list-page';
import { renderWithBrume } from '../../test-utils';
import { useGrid } from '../grid-context';
import { GridView } from '../grid-view';
import { exportHref } from '../toolbar';
import { applyFeedback } from './feedback';

const ship: ActionDef = { key: 'ship', label: '標記出貨', exposed: true };
const remind: ActionDef = { key: 'remind', label: '寄送提醒', exposed: true };
const archive: ActionDef = { key: 'archive', label: '封存', exposed: true };
const del: ActionDef = {
  key: 'delete',
  label: '刪除',
  tone: 'danger',
  shortcut: 'Delete',
  confirm: { title: '刪除這筆資料？', description: '刪除後無法復原。', confirmLabel: '刪除' },
};
const batchDelete: ActionDef = {
  ...del,
  confirm: { title: '刪除所選的 {count} 筆資料？', confirmLabel: '刪除 {count} 筆' },
};
const sync: ActionDef = { key: 'sync', label: '同步庫存' };

const rows: GridRow[] = [
  { id: 1, no: 'ORD-1', customer: 'Ada', _meta: { editUrl: '/admin/orders/1/edit' } },
  { id: 2, no: 'ORD-2', customer: 'Bo', _meta: { actions: ['ship'] } },
  { id: 3, no: 'ORD-3', customer: 'Cy' },
];

const orders: ListPage = {
  type: 'list',
  title: '訂單',
  gridId: 'orders',
  columns: [
    { key: 'no', label: '編號', primary: true },
    { key: 'customer', label: '客戶' },
  ],
  rows,
  pagination: { page: 1, perPage: 20, total: 3, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [del, ship, remind, archive], batch: [ship, batchDelete], tools: [sync] },
  export: { url: '/admin/orders/_brume/export' },
  endpoints: { action: '/admin/orders/_brume/actions/{action}' },
};

type Adapter = ReturnType<typeof renderWithBrume>['adapter'];
const requests = (adapter: Adapter) =>
  adapter.calls.filter((c) => c.fn === 'request').map((c) => c.args[0] as HttpRequest);
const ok = (feedback: object = {}): HttpResponse => ({ status: 200, data: { feedback } });

function setup(
  page: ListPage = orders,
  opts: {
    onEdit?(row: GridRow): void;
    respond?(req: HttpRequest): HttpResponse | Promise<HttpResponse>;
  } = {},
) {
  const user = userEvent.setup();
  const view = (p: ListPage) => (
    <>
      <GridView page={p} onEdit={opts.onEdit} />
      <ConfirmHost />
    </>
  );
  const result = renderWithBrume(view(page), {
    url: '/admin/orders?q=ada&sort=-no',
    respond: opts.respond ?? (() => ok()),
  });
  return { user, ...result, rerenderPage: (p: ListPage) => result.rerender(view(p)) };
}

const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });
const menuItems = () => screen.getAllByRole('menuitem').map((el) => el.textContent);

let toasts: { success: MockInstance; error: MockInstance };
let clicked: HTMLAnchorElement[];
beforeEach(() => {
  toasts = {
    success: vi.spyOn(toast, 'success').mockImplementation(() => {}),
    error: vi.spyOn(toast, 'error').mockImplementation(() => {}),
  };
  clicked = [];
  // jsdom cannot navigate; record which <a> got clicked instead.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});
afterEach(() => vi.restoreAllMocks());

describe('row actions (B + C)', () => {
  it('shows two exposed buttons, the rest in ⋯ with danger last, and the same menu on right click', async () => {
    const { user } = setup();
    const first = row('ORD-1');
    expect(within(first).getByRole('button', { name: '標記出貨' })).toBeTruthy();
    expect(within(first).getByRole('button', { name: '寄送提醒' })).toBeTruthy();
    expect(within(first).queryByRole('button', { name: '封存' })).toBeNull();

    await user.click(within(first).getByRole('button', { name: 'ORD-1 的更多操作' }));
    const dropdown = menuItems();
    expect(dropdown).toEqual(['編輯E', '標記出貨', '寄送提醒', '封存', '刪除⌫']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());

    fireEvent.contextMenu(within(first).getByText('Ada'));
    expect(menuItems()).toEqual(dropdown);
  });

  it('the primary link and the open ⋯ dropdown keep the browser menu', async () => {
    const { user } = setup();
    const first = row('ORD-1');
    // fireEvent returns false when the native menu was prevented.
    expect(fireEvent.contextMenu(within(first).getByRole('link', { name: 'ORD-1' }))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(within(first).getByRole('button', { name: 'ORD-1 的更多操作' }));
    const dropdown = await screen.findByRole('menu');
    // The dropdown is portaled out of the row but still inside it in the React tree.
    expect(fireEvent.contextMenu(within(dropdown).getByRole('menuitem', { name: /封存/ }))).toBe(
      true,
    );
    expect(screen.getAllByRole('menu')).toHaveLength(1);
  });

  it('a row with _meta.actions only offers those actions', async () => {
    const { user } = setup();
    const second = row('ORD-2');
    expect(within(second).getByRole('button', { name: '標記出貨' })).toBeTruthy();
    expect(within(second).queryByRole('button', { name: '寄送提醒' })).toBeNull();
    await user.click(within(second).getByRole('button', { name: 'ORD-2 的更多操作' }));
    expect(menuItems()).toEqual(['標記出貨']);
  });

  it('delete asks first: cancel sends nothing, confirm posts the row id', async () => {
    const { user, adapter } = setup();
    const open = async () => {
      fireEvent.contextMenu(within(row('ORD-1')).getByText('Ada'));
      await user.click(screen.getByRole('menuitem', { name: /刪除/ }));
    };
    await open();
    const dialog = await screen.findByRole('alertdialog', { name: '刪除這筆資料？' });
    expect(within(dialog).getByText('刪除後無法復原。')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(requests(adapter)).toEqual([]);

    await open();
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '刪除' }),
    );
    await waitFor(() => expect(requests(adapter)).toHaveLength(1));
    expect(requests(adapter)[0]).toEqual({
      method: 'post',
      url: '/admin/orders/_brume/actions/delete',
      body: { target: 'row', ids: [1] },
    });
  });

  it('an exposed action without feedback toasts the default success and refreshes', async () => {
    const { user, adapter } = setup(orders, { respond: () => ({ status: 200, data: {} }) });
    await user.click(within(row('ORD-1')).getByRole('button', { name: '標記出貨' }));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('已完成「標記出貨」'));
    expect(adapter.calls.at(-1)).toEqual({ fn: 'reload', args: [{ only: ['envelope'] }] });
  });

  it('encodes the action key into the endpoint placeholder', async () => {
    const odd: ActionDef = { key: 'a/b c', label: '怪', exposed: true };
    const { user, adapter } = setup({ ...orders, actions: { ...orders.actions, row: [odd] } });
    await user.click(within(row('ORD-1')).getByRole('button', { name: '怪' }));
    await waitFor(() => expect(requests(adapter)).toHaveLength(1));
    expect(requests(adapter)[0]?.url).toBe('/admin/orders/_brume/actions/a%2Fb%20c');
  });

  it('a failure with no usable message falls back to the generic error', async () => {
    const { user } = setup(orders, { respond: () => ({ status: 500, data: {} }) });
    await user.click(within(row('ORD-1')).getByRole('button', { name: '標記出貨' }));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('操作沒有完成，請稍後再試一次。'),
    );
  });

  it('a failure with a message names it', async () => {
    const { user } = setup(orders, {
      respond: () => ({ status: 422, data: { message: '已經出貨了' } }),
    });
    await user.click(within(row('ORD-1')).getByRole('button', { name: '標記出貨' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('操作沒有完成：已經出貨了'));
  });

  it('one run per row: buttons, ⋯ and the right-click menu are disabled while it runs', async () => {
    let finish: (res: HttpResponse) => void = () => {};
    const { user, adapter } = setup(orders, {
      respond: () => new Promise<HttpResponse>((resolve) => (finish = resolve)),
    });
    const isDisabled = (name: string) =>
      screen.getByRole('menuitem', { name }).getAttribute('aria-disabled') === 'true';

    // Started from the right-click menu…
    fireEvent.contextMenu(within(row('ORD-1')).getByText('Ada'));
    await user.click(screen.getByRole('menuitem', { name: '標記出貨' }));
    await waitFor(() => expect(requests(adapter)).toHaveLength(1));
    // …the exposed button of the same row shows it and cannot send it again,
    const button = within(row('ORD-1')).getByRole('button', { name: '標記出貨' });
    expect(button.hasAttribute('disabled')).toBe(true);
    // the ⋯ menu and the right-click menu have the item disabled,
    await user.click(within(row('ORD-1')).getByRole('button', { name: 'ORD-1 的更多操作' }));
    expect(isDisabled('標記出貨')).toBe(true);
    expect(isDisabled('寄送提醒')).toBe(false);
    await user.click(screen.getByRole('menuitem', { name: '標記出貨' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.contextMenu(within(row('ORD-1')).getByText('Ada'));
    expect(isDisabled('標記出貨')).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    // and another row is not affected.
    const other = within(row('ORD-2')).getByRole('button', { name: '標記出貨' });
    expect(other.hasAttribute('disabled')).toBe(false);
    expect(requests(adapter)).toHaveLength(1);

    finish(ok());
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    await user.click(within(row('ORD-1')).getByRole('button', { name: 'ORD-1 的更多操作' }));
    expect(isDisabled('標記出貨')).toBe(false);
  });

  it('a run already in flight is not sent again, even within the same tick', async () => {
    const { user, adapter } = setup(orders, { respond: () => new Promise<HttpResponse>(() => {}) });
    const button = within(row('ORD-1')).getByRole('button', { name: '標記出貨' });
    // Two clicks before React re-renders the button as disabled.
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.contextMenu(within(row('ORD-1')).getByText('Ada'));
    await user.click(screen.getByRole('menuitem', { name: '標記出貨' }));
    await waitFor(() => expect(requests(adapter)).toHaveLength(1));
  });

  it('hides row actions when the page has no action endpoint', () => {
    setup({ ...orders, endpoints: undefined, rows: [{ id: 3, no: 'ORD-3', customer: 'Cy' }] });
    expect(screen.queryByRole('button', { name: /更多操作/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '標記出貨' })).toBeNull();
  });
});

describe('edit entry', () => {
  it('clicking the primary cell calls onEdit', async () => {
    const onEdit = vi.fn();
    const { user, adapter } = setup(orders, { onEdit });
    await user.click(screen.getByRole('link', { name: 'ORD-1' }));
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
    // A row without editUrl is still editable through onEdit (a link-styled button).
    await user.click(screen.getByRole('button', { name: 'ORD-3' }));
    expect(onEdit).toHaveBeenLastCalledWith(rows[2]);
    expect(adapter.calls.filter((c) => c.fn === 'visit')).toEqual([]);
  });

  it('without onEdit visits editUrl (the cell and the 「編輯」 item)', async () => {
    const { user, adapter } = setup();
    const link = screen.getByRole('link', { name: 'ORD-1' });
    expect(link.getAttribute('href')).toBe('/admin/orders/1/edit');
    await user.click(link);
    expect(adapter.calls.at(-1)).toEqual({ fn: 'visit', args: ['/admin/orders/1/edit'] });
    // No editUrl and no onEdit: plain text, and no 「編輯」 item.
    expect(screen.queryByRole('link', { name: 'ORD-3' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ORD-3' })).toBeNull();

    await user.click(within(row('ORD-1')).getByRole('button', { name: 'ORD-1 的更多操作' }));
    await user.click(screen.getByRole('menuitem', { name: /編輯/ }));
    expect(adapter.calls.at(-1)).toEqual({ fn: 'visit', args: ['/admin/orders/1/edit'] });
  });
});

describe('batch actions', () => {
  const check = (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.click(screen.getByRole('checkbox', { name: `選取 ${name}` }));

  it('announces the count from a live region that is there before the first selection', async () => {
    const { user } = setup();
    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live.textContent).toBe('');
    await check(user, 'ORD-1');
    expect(document.querySelector('[aria-live="polite"]')).toBe(live);
    expect(live.textContent).toBe('已選取 1 筆');
  });

  it('shows the bar while rows are selected and clears the selection after a run', async () => {
    const { user, adapter } = setup();
    expect(screen.queryByRole('region', { name: '批次操作' })).toBeNull();
    await check(user, 'ORD-1');
    await check(user, 'ORD-2');
    const bar = screen.getByRole('region', { name: '批次操作' });
    expect(within(bar).getByText('已選取 2 筆')).toBeTruthy();

    await user.click(within(bar).getByRole('button', { name: '標記出貨' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '批次操作' })).toBeNull());
    expect(requests(adapter)[0]?.body).toEqual({ target: 'batch', ids: [1, 2] });
  });

  it('batch confirms fill in {count}', async () => {
    const { user, adapter } = setup();
    await check(user, 'ORD-1');
    await check(user, 'ORD-3');
    await user.click(
      within(screen.getByRole('region', { name: '批次操作' })).getByRole('button', {
        name: '刪除',
      }),
    );
    const dialog = await screen.findByRole('alertdialog', { name: '刪除所選的 2 筆資料？' });
    await user.click(within(dialog).getByRole('button', { name: '刪除 2 筆' }));
    await waitFor(() =>
      expect(requests(adapter)[0]?.body).toEqual({ target: 'batch', ids: [1, 3] }),
    );
  });

  it('「取消選取」 empties the selection', async () => {
    const { user } = setup();
    await check(user, 'ORD-1');
    await user.click(screen.getByRole('button', { name: '取消選取' }));
    expect(screen.queryByRole('region', { name: '批次操作' })).toBeNull();
  });

  it('selection is pruned to rows still present', async () => {
    const { user, rerenderPage } = setup();
    await check(user, 'ORD-1');
    await check(user, 'ORD-2');
    rerenderPage({ ...orders, rows: [rows[1] as GridRow] });
    expect(
      within(screen.getByRole('region', { name: '批次操作' })).getByText('已選取 1 筆'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('checkbox', { name: '選取 ORD-2' }) as HTMLButtonElement).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
  });

  it('a new view of the list (sort, filter, search, page) or grid starts with no selection', async () => {
    const { user, rerenderPage } = setup();
    await check(user, 'ORD-1');
    rerenderPage({ ...orders, query: { ...orders.query, q: 'bo' } });
    expect(screen.queryByRole('region', { name: '批次操作' })).toBeNull();

    await check(user, 'ORD-1');
    rerenderPage({
      ...orders,
      query: { ...orders.query, q: 'bo' },
      pagination: { ...orders.pagination, page: 2 },
    });
    expect(screen.queryByRole('region', { name: '批次操作' })).toBeNull();

    await check(user, 'ORD-1');
    rerenderPage({
      ...orders,
      gridId: 'orders-2',
      query: { ...orders.query, q: 'bo' },
      pagination: { ...orders.pagination, page: 2 },
    });
    expect(screen.queryByRole('region', { name: '批次操作' })).toBeNull();
  });

  it('419 shows the expired-page toast and keeps the selection', async () => {
    const { user } = setup(orders, { respond: () => ({ status: 419, data: {} }) });
    await check(user, 'ORD-1');
    await user.click(
      within(screen.getByRole('region', { name: '批次操作' })).getByRole('button', {
        name: '標記出貨',
      }),
    );
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('頁面已過期，請重新整理後再試一次。'),
    );
    expect(
      within(screen.getByRole('region', { name: '批次操作' })).getByText('已選取 1 筆'),
    ).toBeTruthy();
  });
});

describe('tool actions', () => {
  it('a throwing adapter is a network error toast, not an unhandled rejection', async () => {
    const { user } = setup(orders, {
      respond: () => {
        throw new TypeError('boom');
      },
    });
    await user.click(screen.getByRole('button', { name: '同步庫存' }));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('連不上伺服器，請檢查網路後再試一次。'),
    );
    expect(screen.getByRole('button', { name: '同步庫存' }).hasAttribute('disabled')).toBe(false);
  });

  it('post with target tool and no ids', async () => {
    const { user, adapter } = setup();
    await user.click(screen.getByRole('button', { name: '同步庫存' }));
    await waitFor(() => expect(requests(adapter)).toHaveLength(1));
    expect(requests(adapter)[0]?.body).toEqual({ target: 'tool', ids: [] });
  });
});

describe('export', () => {
  it('offers all / this page, plus the selection once rows are selected', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: '匯出 Excel' }));
    expect(menuItems()).toEqual(['符合條件的全部資料', '目前這一頁']);
    await user.click(screen.getByRole('menuitem', { name: '符合條件的全部資料' }));
    expect(clicked.at(-1)?.getAttribute('href')).toBe(
      '/admin/orders/_brume/export?q=ada&sort=-no&export_scope=all',
    );
    expect(clicked.at(-1)?.hasAttribute('download')).toBe(true);

    await user.click(screen.getByRole('checkbox', { name: '選取 ORD-1' }));
    await user.click(screen.getByRole('checkbox', { name: '選取 ORD-2' }));
    await user.click(screen.getByRole('button', { name: '匯出 Excel' }));
    await user.click(screen.getByRole('menuitem', { name: '已選取的 2 筆' }));
    expect(clicked.at(-1)?.getAttribute('href')).toBe(
      '/admin/orders/_brume/export?q=ada&sort=-no&export_scope=selected&ids[]=1&ids[]=2',
    );
  });

  it('exportHref keeps the current query and adds the scope', () => {
    expect(exportHref('/x', '/admin/orders?page=2', 'page')).toBe('/x?page=2&export_scope=page');
    expect(exportHref('/x?a=1', '/admin/orders', 'all')).toBe('/x?a=1&export_scope=all');
    expect(exportHref('/x', '/o?export_scope=all', 'selected', ['a b'])).toBe(
      '/x?export_scope=selected&ids[]=a%20b',
    );
  });
});

describe('applyFeedback', () => {
  const deps = () => {
    const adapter = createMemoryAdapter('/admin/orders');
    const refresh = vi.fn();
    return { adapter, refresh };
  };

  it('toasts before the download starts', () => {
    const order: string[] = [];
    toasts.success.mockImplementation(() => order.push('toast'));
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      order.push(`download ${this.getAttribute('href')} ${this.getAttribute('download')}`);
    });
    applyFeedback(
      {
        toast: { type: 'success', message: '好了' },
        download: { url: '/f.xlsx', filename: 'f.xlsx' },
      },
      deps(),
    );
    expect(order).toEqual(['toast', 'download /f.xlsx f.xlsx']);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('a redirect wins over refresh', () => {
    const d = deps();
    applyFeedback({ redirect: '/admin/orders/9', refresh: true }, d);
    expect(d.adapter.calls).toEqual([{ fn: 'visit', args: ['/admin/orders/9'] }]);
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it('does not follow an unsafe download URL', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    applyFeedback({ download: { url: 'javascript:alert(1)' } }, deps());
    expect(clicked).toEqual([]);
    expect(error).toHaveBeenCalledOnce();
  });

  it('refreshes only when asked', () => {
    const d = deps();
    applyFeedback({}, d);
    expect(d.refresh).not.toHaveBeenCalled();
    applyFeedback({ refresh: true }, d);
    expect(d.refresh).toHaveBeenCalledOnce();
  });
});

it('action input dialog submits input, retains 422 errors, skips confirmation', async () => {
  const reason: ActionDef = {
    key: 'reason',
    label: 'Explain',
    exposed: true,
    confirm: { title: 'Must not open', confirmLabel: 'Confirm' },
    form: { title: 'Reason', fields: [{ type: 'text', name: 'reason', label: 'Reason text' }] },
  };
  let count = 0;
  const { user, adapter } = setup(
    { ...orders, actions: { ...orders.actions, row: [reason] } },
    {
      respond: () =>
        ++count === 1
          ? { status: 422, data: { errors: { reason: ['Required by server'] } } }
          : ok(),
    },
  );
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  await screen.findByRole('dialog', { name: 'Reason' });
  await user.type(screen.getByLabelText('Reason text'), 'because');
  fireEvent.keyDown(screen.getByLabelText('Reason text'), { key: 'Enter', isComposing: true });
  fireEvent.keyDown(screen.getByLabelText('Reason text'), { key: 'Enter', keyCode: 229 });
  expect(requests(adapter)).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  await screen.findAllByText('Required by server');
  expect(screen.getByRole('dialog', { name: 'Reason' })).toBeTruthy();
  expect(requests(adapter)[0]?.body).toMatchObject({
    target: 'row',
    ids: [1],
    input: { reason: 'because' },
  });
  await user.type(screen.getByLabelText('Reason text'), ' updated');
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reason' })).toBeNull());
});

it('action input locks repeated Enter and click until the response settles', async () => {
  let finish!: (res: HttpResponse) => void;
  const def: ActionDef = {
    key: 'explain',
    label: 'Explain',
    exposed: true,
    form: { fields: [{ type: 'text', name: 'reason', label: 'Reason text' }] },
  };
  const { user, adapter } = setup(
    { ...orders, actions: { ...orders.actions, row: [def] } },
    {
      respond: () =>
        new Promise<HttpResponse>((resolve) => {
          finish = resolve;
        }),
    },
  );
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  const input = screen.getByLabelText('Reason text');
  fireEvent.change(input, { target: { value: 'because' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
  expect(requests(adapter)).toHaveLength(1);
  await import('@testing-library/react').then(({ act }) => act(async () => finish(ok())));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

const inputAction: ActionDef = {
  key: 'explain',
  label: 'Explain',
  exposed: true,
  form: { fields: [{ type: 'text', name: 'reason', label: 'Reason text' }] },
};
const inputOrders: ListPage = { ...orders, actions: { ...orders.actions, row: [inputAction] } };
const otherInputList: ListPage = {
  ...inputOrders,
  gridId: 'invoices',
  endpoints: { action: '/admin/invoices/actions/{action}' },
};

it('cancels an open action input when a preserved plain list changes resource', async () => {
  const user = userEvent.setup();
  const { adapter, rerender } = renderWithBrume(<ListPageView page={inputOrders} />, {
    respond: () => ok(),
  });
  const rerenderPage = (page: ListPage) => rerender(<ListPageView page={page} />);
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  await user.type(screen.getByLabelText('Reason text'), 'old resource input');
  rerenderPage(otherInputList);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(requests(adapter)).toHaveLength(0);
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  expect((screen.getByLabelText('Reason text') as HTMLInputElement).value).toBe('');
  await user.type(screen.getByLabelText('Reason text'), 'new resource input');
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  await waitFor(() => expect(requests(adapter)).toHaveLength(1));
  expect(requests(adapter)[0]).toMatchObject({
    url: '/admin/invoices/actions/explain',
    body: { target: 'row', ids: [1], input: { reason: 'new resource input' } },
  });
});

it('does not retarget retained action input when the same grid changes its endpoint', async () => {
  const { user, rerenderPage } = setup(inputOrders);
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  rerenderPage({ ...inputOrders, endpoints: otherInputList.endpoints });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('preserves action input and usability across ordinary same-grid envelope updates', async () => {
  const { user, adapter, rerenderPage } = setup(inputOrders);
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  await user.type(screen.getByLabelText('Reason text'), 'keep input');
  rerenderPage({
    ...inputOrders,
    rows: inputOrders.rows.map((item) => ({ ...item })),
    query: { ...inputOrders.query, q: 'updated' },
  });
  expect((screen.getByLabelText('Reason text') as HTMLInputElement).value).toBe('keep input');
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  await waitFor(() => expect(requests(adapter)).toHaveLength(1));
  expect(requests(adapter)[0]?.url).toBe('/admin/orders/_brume/actions/explain');
});

it('ignores an obsolete action response after navigation while a new dialog is open', async () => {
  let finish!: (res: HttpResponse) => void;
  const { user, adapter, rerenderPage } = setup(inputOrders, {
    respond: () =>
      new Promise<HttpResponse>((resolve) => {
        finish = resolve;
      }),
  });
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  await user.type(screen.getByLabelText('Reason text'), 'old input');
  await user.click(screen.getByRole('button', { name: 'Explain' }));
  expect(requests(adapter)[0]?.url).toBe('/admin/orders/_brume/actions/explain');
  rerenderPage(otherInputList);
  await user.click(within(row('ORD-1')).getByRole('button', { name: 'Explain' }));
  await user.type(screen.getByLabelText('Reason text'), 'new input');
  await import('@testing-library/react').then(({ act }) =>
    act(async () =>
      finish({
        status: 200,
        data: {
          feedback: {
            toast: { type: 'success', message: 'obsolete' },
            redirect: '/obsolete',
            refresh: true,
          },
        },
      }),
    ),
  );
  expect((screen.getByLabelText('Reason text') as HTMLInputElement).value).toBe('new input');
  expect(adapter.calls.some((call) => call.fn === 'visit' || call.fn === 'reload')).toBe(false);
  expect(toasts.success).not.toHaveBeenCalled();
});

function ActionOwnerProbe({ finished }: { finished(value: boolean): void }) {
  const { runFormAction } = useGrid();
  return (
    <button
      type="button"
      onClick={() => void runFormAction?.(inputAction, { target: 'row', ids: [1] }).then(finished)}
    >
      Open probe
    </button>
  );
}

it('settles the open action promise when its endpoint disappears and permits reopening', async () => {
  const finished = vi.fn();
  const view = (page: ListPage) => (
    <GridView page={page} toolbarStart={<ActionOwnerProbe finished={finished} />} />
  );
  const result = renderWithBrume(view(inputOrders));
  fireEvent.click(screen.getByRole('button', { name: 'Open probe' }));
  await screen.findByRole('dialog');
  result.rerender(view({ ...inputOrders, endpoints: undefined }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(finished).toHaveBeenCalledWith(false));
  result.rerender(view(inputOrders));
  fireEvent.click(screen.getByRole('button', { name: 'Open probe' }));
  await screen.findByRole('dialog');
});

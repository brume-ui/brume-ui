import { type HttpRequest, type HttpResponse, toast } from '@brume-ui/brume-react';
import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { GridView } from '../grid-view';

const rows: GridRow[] = [
  {
    id: 1,
    no: 'ORD-1',
    customer: 'Ann',
    note: '第一行',
    qty: 2,
    price: 'NT$1,200',
    status: 'paid',
    tags: ['gift'],
    published: false,
    flags: { hot: false, new: true },
    _meta: { raw: { price: 1200 } },
  },
  { id: 'a/b', no: 'ORD-2', customer: 'Bo', published: true },
];

const orders: ListPage = {
  type: 'list',
  title: '訂單',
  gridId: 'orders',
  columns: [
    { key: 'no', label: '編號' },
    { key: 'customer', label: '客戶', editor: { type: 'text', maxLength: 20 } },
    { key: 'note', label: '備註', editor: { type: 'textarea' } },
    { key: 'qty', label: '數量', editor: { type: 'number', min: 0 } },
    { key: 'price', label: '價格', editor: { type: 'number' } },
    {
      key: 'status',
      label: '狀態',
      editor: {
        type: 'select',
        options: [
          { value: 'paid', label: '已付款' },
          { value: 'pending', label: '待付款' },
        ],
      },
    },
    {
      key: 'tags',
      label: '標籤',
      editor: {
        type: 'checkbox',
        options: [
          { value: 'gift', label: '禮品' },
          { value: 'rush', label: '急件' },
        ],
      },
    },
    { key: 'published', label: '上架', editor: { type: 'switch' } },
    {
      key: 'flags',
      label: '標記',
      editor: {
        type: 'switchGroup',
        keys: [
          { key: 'hot', label: '熱門' },
          { key: 'new', label: '新品' },
        ],
      },
    },
  ],
  rows,
  pagination: { page: 1, perPage: 20, total: 2, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  endpoints: { cell: '/admin/orders/_brume/cells/{id}' },
};

type Respond = (req: HttpRequest) => HttpResponse | Promise<HttpResponse>;
type Adapter = ReturnType<typeof renderWithBrume>['adapter'];
const requests = (adapter: Adapter) =>
  adapter.calls.filter((c) => c.fn === 'request').map((c) => c.args[0] as HttpRequest);

/** 200 with row 1 after the request's change (switchGroup values merge into the object). */
const saved =
  (extra: Partial<GridRow> = {}): Respond =>
  (req) => {
    const { column, value } = req.body as { column: string; value: unknown };
    const merged =
      column === 'flags'
        ? { ...(rows[0]?.flags as object), ...(value as object) }
        : column === 'price'
          ? `NT$${Number(value).toLocaleString('en')}`
          : value;
    return { status: 200, data: { row: { ...rows[0], [column]: merged, ...extra } } };
  };

function setup(respond: Respond = saved(), page: ListPage = orders) {
  const user = userEvent.setup();
  const result = renderWithBrume(<GridView page={page} />, { url: '/admin/orders', respond });
  return { user, ...result, rerenderPage: (p: ListPage) => result.rerender(<GridView page={p} />) };
}

/** A promise per request, settled by the test. */
function deferred() {
  const pending: Array<(res: HttpResponse) => void> = [];
  const respond: Respond = () => new Promise((resolve) => pending.push(resolve));
  return { respond, settle: (i: number, res: HttpResponse) => pending[i]?.(res) };
}

const row1 = () => within(screen.getByRole('row', { name: /ORD-1/ }));

let toasts: { success: MockInstance; error: MockInstance };
beforeEach(() => {
  toasts = {
    success: vi.spyOn(toast, 'success').mockImplementation(() => {}),
    error: vi.spyOn(toast, 'error').mockImplementation(() => {}),
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('text editors', () => {
  it('Enter saves through PATCH endpoints.cell, optimistically, then shows the returned row', async () => {
    const { respond, settle } = deferred();
    const { user, adapter } = setup(respond);
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    const input = row1().getByRole('textbox', { name: '客戶' });
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('Ann');
    expect(input.getAttribute('maxlength')).toBe('20');
    await user.clear(input);
    await user.type(input, 'Ada{Enter}');

    expect(requests(adapter)).toEqual([
      {
        method: 'patch',
        url: '/admin/orders/_brume/cells/1',
        body: { column: 'customer', value: 'Ada' },
      },
    ]);
    // Before the response: the new value, busy, and focus back on the cell.
    const cell = row1().getByRole('button', { name: '編輯客戶：Ada' });
    expect(cell.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(cell);

    // The response row replaces the whole row (display results included).
    await act(async () =>
      settle(0, {
        status: 200,
        data: { row: { ...rows[0], customer: 'Ada', no: 'ORD-1 ✓' } },
      }),
    );
    expect(row1().getByText('ORD-1 ✓')).toBeTruthy();
    expect(row1().getByRole('button', { name: '編輯客戶：Ada' }).hasAttribute('aria-busy')).toBe(
      false,
    );
  });

  it('Enter on the cell opens the editor; Esc cancels without a request and refocuses the cell', async () => {
    const { user, adapter } = setup();
    row1().getByRole('button', { name: '編輯客戶：Ann' }).focus();
    await user.keyboard('{Enter}');
    const input = row1().getByRole('textbox', { name: '客戶' });
    await user.type(input, 'xyz{Escape}');
    expect(row1().queryByRole('textbox', { name: '客戶' })).toBeNull();
    const cell = row1().getByRole('button', { name: '編輯客戶：Ann' });
    expect(document.activeElement).toBe(cell);
    expect(requests(adapter)).toEqual([]);
  });

  it('leaving the cell saves; an unchanged value sends nothing', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.tab();
    expect(requests(adapter)).toEqual([]);
    expect(row1().queryByRole('textbox', { name: '客戶' })).toBeNull();

    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.type(row1().getByRole('textbox', { name: '客戶' }), '!');
    await user.click(document.body);
    expect(requests(adapter).map((r) => r.body)).toEqual([{ column: 'customer', value: 'Ann!' }]);
  });

  it('Enter during IME composition does not save', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    const input = row1().getByRole('textbox', { name: '客戶' });
    fireEvent.change(input, { target: { value: 'ㄚ' } });
    // Choosing a candidate: isComposing, and Safari's keyCode 229 without it.
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(requests(adapter)).toEqual([]);
    expect(row1().getByRole('textbox', { name: '客戶' })).toBe(input);

    fireEvent.change(input, { target: { value: '阿' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(requests(adapter).map((r) => r.body)).toEqual([{ column: 'customer', value: '阿' }]);
  });

  it('textarea: Enter is a newline, ⌘/Ctrl+Enter saves', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯備註：第一行' }));
    const box = row1().getByRole('textbox', { name: '備註' });
    expect(box.tagName).toBe('TEXTAREA');
    await user.type(box, '{Enter}第二行');
    expect(requests(adapter)).toEqual([]);
    expect((box as HTMLTextAreaElement).value).toBe('第一行\n第二行');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(requests(adapter).map((r) => r.body)).toEqual([
      { column: 'note', value: '第一行\n第二行' },
    ]);
  });

  it('a numeric column keeps its editable value on the end edge, like its header', () => {
    setup(saved(), {
      ...orders,
      columns: orders.columns.map((c) => (c.key === 'qty' ? { ...c, numeric: true } : c)),
    });
    const button = row1().getByRole('button', { name: '編輯數量：2' });
    expect((button.parentElement as HTMLElement).className).toContain('br:items-end');
    const text = row1().getByRole('button', { name: '編輯客戶：Ann' });
    expect((text.parentElement as HTMLElement).className).toContain('br:items-start');
  });

  it('number sends a number (an empty one sends null)', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯數量：2' }));
    const input = row1().getByRole('spinbutton', { name: '數量' });
    expect(input.getAttribute('min')).toBe('0');
    await user.clear(input);
    await user.type(input, '5{Enter}');
    await waitFor(() => expect(row1().queryByRole('spinbutton')).toBeNull());
    await user.click(row1().getByRole('button', { name: '編輯數量：5' }));
    await user.clear(row1().getByRole('spinbutton', { name: '數量' }));
    await user.keyboard('{Enter}');
    expect(requests(adapter).map((r) => r.body)).toEqual([
      { column: 'qty', value: 5 },
      { column: 'qty', value: null },
    ]);
  });

  it('starts from raw, so the display string is never sent as the value', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯價格：NT$1,200' }));
    const input = row1().getByRole('spinbutton', { name: '價格' });
    expect((input as HTMLInputElement).value).toBe('1200');
    await user.keyboard('{Enter}');
    expect(requests(adapter)).toEqual([]);

    await user.click(row1().getByRole('button', { name: '編輯價格：NT$1,200' }));
    await user.clear(row1().getByRole('spinbutton', { name: '價格' }));
    await user.type(row1().getByRole('spinbutton', { name: '價格' }), '1300{Enter}');
    expect(requests(adapter).map((r) => r.body)).toEqual([{ column: 'price', value: 1300 }]);
    await waitFor(() =>
      expect(row1().getByRole('button', { name: '編輯價格：NT$1,300' })).toBeTruthy(),
    );
  });

  it('encodes the row id into the {id} placeholder', async () => {
    const { user, adapter } = setup();
    const second = within(screen.getByRole('row', { name: /ORD-2/ }));
    await user.click(second.getByRole('button', { name: '編輯客戶：Bo' }));
    await user.type(second.getByRole('textbox', { name: '客戶' }), 'b{Enter}');
    expect(requests(adapter)[0]?.url).toBe('/admin/orders/_brume/cells/a%2Fb');
  });
});

describe('errors', () => {
  const invalid: HttpResponse = {
    status: 422,
    data: { message: '資料有誤', errors: { customer: ['客戶不能超過 5 個字'] } },
  };

  it('422 reverts and shows errors[column][0] next to the cell until the next successful save', async () => {
    let answer: HttpResponse = invalid;
    const { user } = setup((req) => (answer.status === 422 ? answer : saved()(req)));
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.type(row1().getByRole('textbox', { name: '客戶' }), 'Lovelace{Enter}');

    const alert = await row1().findByRole('alert');
    expect(alert.textContent).toBe('客戶不能超過 5 個字');
    // Room above and below, so the cell's focus ring never touches the row edge.
    expect((alert.parentElement as HTMLElement).className).toContain('br:py-1.5');
    const cell = row1().getByRole('button', { name: '編輯客戶：Ann' });
    expect(cell.getAttribute('aria-describedby')).toBe(alert.id);
    expect(toasts.error).not.toHaveBeenCalled();

    answer = { status: 200, data: {} };
    await user.click(cell);
    await user.type(row1().getByRole('textbox', { name: '客戶' }), 'e{Enter}');
    await waitFor(() => expect(row1().queryByRole('alert')).toBeNull());
    const after = row1().getByRole('button', { name: '編輯客戶：Anne' });
    expect(after.hasAttribute('aria-describedby')).toBe(false);
  });

  it('other errors revert and toast: the message, or the session copy for 419', async () => {
    let answer: HttpResponse = { status: 500, data: { message: '資料庫忙碌' } };
    const { user } = setup(() => answer);
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.type(row1().getByRole('textbox', { name: '客戶' }), 'x{Enter}');
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('操作沒有完成：資料庫忙碌'));
    expect(row1().getByRole('button', { name: '編輯客戶：Ann' })).toBeTruthy();
    expect(row1().queryByRole('alert')).toBeNull();

    answer = { status: 419, data: {} };
    await user.click(row1().getByRole('switch', { name: '上架' }));
    await waitFor(() =>
      expect(toasts.error).toHaveBeenLastCalledWith('頁面已過期，請重新整理後再試一次。'),
    );
    expect(row1().getByRole('switch', { name: '上架' }).getAttribute('aria-checked')).toBe('false');
  });

  it('a 422 without an error for the column toasts instead', async () => {
    const { user } = setup(() => ({ status: 422, data: { message: '這一列已鎖定' } }));
    await user.click(row1().getByRole('switch', { name: '上架' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('操作沒有完成：這一列已鎖定'));
  });

  it('a switch error is described on the switch', async () => {
    const { user } = setup(() => ({
      status: 422,
      data: { message: '資料有誤', errors: { published: ['缺貨商品不能上架'] } },
    }));
    await user.click(row1().getByRole('switch', { name: '上架' }));
    const alert = await row1().findByRole('alert');
    expect(row1().getByRole('switch', { name: '上架' }).getAttribute('aria-describedby')).toBe(
      alert.id,
    );
  });
});

describe('success feedback and row overrides', () => {
  it('a toast in the feedback is shown; overrides are dropped when page.rows changes', async () => {
    const { user, rerenderPage } = setup((req) => {
      const res = saved()(req) as HttpResponse;
      return {
        ...res,
        data: {
          ...(res.data as object),
          feedback: { toast: { type: 'success', message: '已上架' } },
        },
      };
    });
    await user.click(row1().getByRole('switch', { name: '上架' }));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('已上架'));
    expect(row1().getByRole('switch', { name: '上架' }).getAttribute('aria-checked')).toBe('true');

    // A refresh brings new rows: they win over the earlier response.
    rerenderPage({ ...orders, rows: [{ ...rows[0], published: false } as GridRow] });
    expect(row1().getByRole('switch', { name: '上架' }).getAttribute('aria-checked')).toBe('false');
  });

  it('a response that lands after the rows changed keeps the saved value and refreshes', async () => {
    const { respond, settle } = deferred();
    const { user, adapter, rerenderPage } = setup(respond);
    const sw = () => row1().getByRole('switch', { name: '上架' });
    const reloads = () => adapter.calls.filter((c) => c.fn === 'reload').length;
    await user.click(sw());
    const fresh = { ...rows[0], no: 'ORD-1 新' } as GridRow;
    rerenderPage({ ...orders, rows: [fresh] });
    // A save on the new rows…
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.type(row1().getByRole('textbox', { name: '客戶' }), 'e{Enter}');
    await act(async () =>
      settle(1, { status: 200, data: { row: { ...fresh, customer: 'Anne' } } }),
    );
    expect(row1().getByRole('button', { name: '編輯客戶：Anne' })).toBeTruthy();
    expect(reloads()).toBe(0);
    // …then the old response lands: it neither replaces the row nor drops the newer save,
    await act(async () =>
      settle(0, { status: 200, data: { row: { ...rows[0], published: true, no: 'ORD-1 舊' } } }),
    );
    expect(row1().getByText('ORD-1 新')).toBeTruthy();
    expect(row1().queryByText('ORD-1 舊')).toBeNull();
    expect(row1().getByRole('button', { name: '編輯客戶：Anne' })).toBeTruthy();
    // the switch keeps the saved value (not the older rows' false) and the server is asked again.
    expect(sw().getAttribute('aria-checked')).toBe('true');
    expect(sw().hasAttribute('aria-busy')).toBe(false);
    expect(reloads()).toBe(1);
    // The refreshed rows decide.
    rerenderPage({ ...orders, rows: [{ ...fresh, published: true } as GridRow] });
    expect(sw().getAttribute('aria-checked')).toBe('true');
    rerenderPage({ ...orders, rows: [{ ...fresh, published: false } as GridRow] });
    expect(sw().getAttribute('aria-checked')).toBe('false');
  });

  describe('two cells of one row answered out of order', () => {
    /** Saves customer (request 0), then toggles published (request 1) before either answers. */
    async function saveBoth() {
      const { respond, settle } = deferred();
      const { user, adapter } = setup(respond);
      await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
      await user.type(row1().getByRole('textbox', { name: '客戶' }), 'e{Enter}');
      await user.click(row1().getByRole('switch', { name: '上架' }));
      const answer = (i: number, row: Partial<GridRow>, no: string) =>
        act(async () => settle(i, { status: 200, data: { row: { ...rows[0], ...row, no } } }));
      const values = () => ({
        customer: row1().getByRole('button', { name: /^編輯客戶：/ }).textContent,
        published: row1().getByRole('switch', { name: '上架' }).getAttribute('aria-checked'),
        no: row1().getByText(/^ORD-1/).textContent,
      });
      const reloads = () => adapter.calls.filter((c) => c.fn === 'reload').length;
      return { answer, values, reloads };
    }

    it('server ran customer first; the customer response arrives last', async () => {
      const { answer, values, reloads } = await saveBoth();
      await answer(1, { customer: 'Anne', published: true }, 'ORD-1 #2');
      expect(reloads()).toBe(0);
      // Its row was computed before the switch was saved: published false is stale.
      await answer(0, { customer: 'Anne', published: false }, 'ORD-1 #1');
      expect(values()).toEqual({ customer: 'Anne', published: 'true', no: 'ORD-1 #2' });
      // The saves overlapped: once both settled, the server's rows decide the rest.
      expect(reloads()).toBe(1);
    });

    it('server ran the switch first; the switch response arrives last', async () => {
      const { answer, values, reloads } = await saveBoth();
      await answer(0, { customer: 'Anne', published: true }, 'ORD-1 #1');
      // Its row was computed before the customer was saved: customer Ann is stale.
      await answer(1, { customer: 'Ann', published: true }, 'ORD-1 #2');
      expect(values()).toEqual({ customer: 'Anne', published: 'true', no: 'ORD-1 #2' });
      expect(reloads()).toBe(1);
    });

    it('server ran the switch first; the customer response arrives last', async () => {
      const { answer, values, reloads } = await saveBoth();
      await answer(1, { customer: 'Ann', published: true }, 'ORD-1 #2');
      await answer(0, { customer: 'Anne', published: true }, 'ORD-1 #1');
      // Both saved cells are right; `no` may be the older server state until the refresh.
      expect(values()).toEqual({ customer: 'Anne', published: 'true', no: 'ORD-1 #2' });
      expect(reloads()).toBe(1);
    });

    it('a failed overlapping save still lets the server decide once both settle', async () => {
      const { respond, settle } = deferred();
      const { user, adapter } = setup(respond);
      await user.click(row1().getByRole('switch', { name: '上架' }));
      await user.click(row1().getByRole('switch', { name: '熱門' }));
      await act(async () => settle(0, { status: 500, data: {} }));
      await act(async () =>
        settle(
          1,
          saved()({
            body: { column: 'flags', value: { hot: true } },
          } as HttpRequest) as HttpResponse,
        ),
      );
      expect(adapter.calls.filter((c) => c.fn === 'reload')).toHaveLength(1);
    });
  });

  it('an adapter that rejects still ends the save: the overlap settles, the cell reverts', async () => {
    const pending: Array<{ resolve(res: HttpResponse): void; reject(error: Error): void }> = [];
    const respond: Respond = () =>
      new Promise((resolve, reject) => pending.push({ resolve, reject }));
    const { user, adapter } = setup(respond);
    await user.click(row1().getByRole('switch', { name: '上架' }));
    await user.click(row1().getByRole('switch', { name: '熱門' }));
    await act(async () => pending[0]?.reject(new Error('socket closed')));
    // Treated as a network error: the toast, and the switch goes back.
    expect(toasts.error).toHaveBeenCalledWith('連不上伺服器，請檢查網路後再試一次。');
    expect(row1().getByRole('switch', { name: '上架' }).getAttribute('aria-checked')).toBe('false');
    await act(async () =>
      pending[1]?.resolve(
        saved()({ body: { column: 'flags', value: { hot: true } } } as HttpRequest) as HttpResponse,
      ),
    );
    // The rejected save counted as settled, so the last of the two lets the server decide.
    expect(adapter.calls.filter((c) => c.fn === 'reload')).toHaveLength(1);
  });

  it('a later save that did not overlap brings the whole server row, cascades included', async () => {
    const { user, adapter } = setup((req) => {
      const { column, value } = req.body as { column: string; value: unknown };
      // Archiving (status pending here) also takes the product off the shelf.
      if (column === 'status') {
        return { status: 200, data: { row: { ...rows[0], status: value, published: false } } };
      }
      return saved()(req);
    });
    const sw = () => row1().getByRole('switch', { name: '上架' });
    await user.click(sw());
    await waitFor(() => expect(sw().hasAttribute('aria-busy')).toBe(false));
    expect(sw().getAttribute('aria-checked')).toBe('true');

    await user.click(row1().getByRole('button', { name: '編輯狀態：已付款' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('radio', { name: '待付款' }),
    );
    await waitFor(() =>
      expect(row1().getByRole('button', { name: '編輯狀態：待付款' })).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        row1().getByRole('button', { name: '編輯狀態：待付款' }).hasAttribute('aria-busy'),
      ).toBe(false),
    );
    expect(sw().getAttribute('aria-checked')).toBe('false');
    // Nothing overlapped, so nothing to reload.
    expect(adapter.calls.filter((c) => c.fn === 'reload')).toHaveLength(0);
  });

  it('a 422 on a list value survives new row objects with the same list', async () => {
    let n = 0;
    const { user } = setup((req) =>
      n++ === 0
        ? { status: 422, data: { message: '資料有誤', errors: { tags: ['最多選一個'] } } }
        : saved({ tags: ['gift'] })(req),
    );
    await user.click(row1().getByRole('button', { name: '編輯標籤：禮品' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('checkbox', { name: '急件' }),
    );
    await user.click(document.body);
    expect((await row1().findByRole('alert')).textContent).toBe('最多選一個');
    // Another cell's save replaces the row object; tags is a new array with the same content.
    await user.click(row1().getByRole('switch', { name: '上架' }));
    await waitFor(() =>
      expect(row1().getByRole('switch', { name: '上架' }).hasAttribute('aria-busy')).toBe(false),
    );
    expect(row1().getByRole('alert').textContent).toBe('最多選一個');
  });

  it('a 422 error goes away when new rows bring another value', async () => {
    const { user, rerenderPage } = setup(() => ({
      status: 422,
      data: { message: '資料有誤', errors: { customer: ['客戶不能超過 5 個字'] } },
    }));
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.type(row1().getByRole('textbox', { name: '客戶' }), 'Lovelace{Enter}');
    await row1().findByRole('alert');
    // Same value after a refresh: still relevant.
    rerenderPage({ ...orders, rows: [{ ...rows[0] } as GridRow] });
    expect(row1().getByRole('alert')).toBeTruthy();
    rerenderPage({ ...orders, rows: [{ ...rows[0], customer: 'Ada' } as GridRow] });
    expect(row1().queryByRole('alert')).toBeNull();
    expect(
      row1().getByRole('button', { name: '編輯客戶：Ada' }).hasAttribute('aria-describedby'),
    ).toBe(false);
  });

  it('an open editor keeps its starting value when an earlier save of the cell settles', async () => {
    const { respond, settle } = deferred();
    const { user, adapter } = setup(respond);
    await user.click(row1().getByRole('button', { name: '編輯客戶：Ann' }));
    await user.clear(row1().getByRole('textbox', { name: '客戶' }));
    await user.type(row1().getByRole('textbox', { name: '客戶' }), 'ann{Enter}');
    // Reopened while 'ann' is pending; the server answers with a normalised value.
    await user.click(row1().getByRole('button', { name: '編輯客戶：ann' }));
    await act(async () =>
      settle(0, { status: 200, data: { row: { ...rows[0], customer: 'Ann' } } }),
    );
    await user.keyboard('{Enter}');
    expect(requests(adapter)).toHaveLength(1);
  });
});

describe('choices in a popover', () => {
  it('select saves the chosen option and closes', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯狀態：已付款' }));
    const dialog = await screen.findByRole('dialog', { name: '狀態' });
    await user.click(within(dialog).getByRole('radio', { name: '待付款' }));
    expect(requests(adapter).map((r) => r.body)).toEqual([{ column: 'status', value: 'pending' }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(row1().getByRole('button', { name: '編輯狀態：待付款' })).toBeTruthy();
  });

  it('select from the keyboard: arrows choose, Enter saves, Esc cancels', async () => {
    const { user, adapter } = setup();
    // Radix moves focus a tick after keydown and selects only while the arrow is still down.
    const arrowDown = async () => {
      await user.keyboard('{ArrowDown>}');
      await new Promise((r) => setTimeout(r, 0));
      await user.keyboard('{/ArrowDown}');
    };
    const cell = row1().getByRole('button', { name: '編輯狀態：已付款' });
    cell.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: '狀態' });
    await arrowDown();
    expect(screen.getByRole('radio', { name: '待付款' }).getAttribute('aria-checked')).toBe('true');
    expect(requests(adapter)).toEqual([]);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requests(adapter)).toEqual([]);
    expect(document.activeElement).toBe(cell);

    await user.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: '狀態' });
    expect(screen.getByRole('radio', { name: '已付款' }).getAttribute('aria-checked')).toBe('true');
    await arrowDown();
    expect(requests(adapter)).toEqual([]);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requests(adapter).map((r) => r.body)).toEqual([{ column: 'status', value: 'pending' }]);
    expect(row1().getByRole('button', { name: '編輯狀態：待付款' })).toBeTruthy();
  });

  it('checkbox saves the new set when the popover closes; Esc cancels', async () => {
    const { user, adapter } = setup();
    await user.click(row1().getByRole('button', { name: '編輯標籤：禮品' }));
    let dialog = await screen.findByRole('dialog', { name: '標籤' });
    await user.click(within(dialog).getByRole('checkbox', { name: '急件' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requests(adapter)).toEqual([]);

    await user.click(row1().getByRole('button', { name: '編輯標籤：禮品' }));
    dialog = await screen.findByRole('dialog', { name: '標籤' });
    expect(
      within(dialog).getByRole('checkbox', { name: '急件' }).getAttribute('aria-checked'),
    ).toBe('false');
    await user.click(within(dialog).getByRole('checkbox', { name: '急件' }));
    expect(requests(adapter)).toEqual([]);
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requests(adapter).map((r) => r.body)).toEqual([
      { column: 'tags', value: ['gift', 'rush'] },
    ]);
    expect(row1().getByRole('button', { name: '編輯標籤：禮品、急件' })).toBeTruthy();
  });
});

describe('switches', () => {
  it('switchGroup sends { [key]: boolean } and keeps the other keys', async () => {
    const { user, adapter } = setup();
    expect(row1().getByRole('switch', { name: '新品' }).getAttribute('aria-checked')).toBe('true');
    await user.click(row1().getByRole('switch', { name: '熱門' }));
    expect(requests(adapter).map((r) => r.body)).toEqual([
      { column: 'flags', value: { hot: true } },
    ]);
    expect(row1().getByRole('switch', { name: '熱門' }).getAttribute('aria-checked')).toBe('true');
    expect(row1().getByRole('switch', { name: '新品' }).getAttribute('aria-checked')).toBe('true');
  });

  describe('stale responses never overwrite a newer value', () => {
    const DELAYS = [300, 100, 200];

    /** Three quick toggles answered after 300ms, 100ms and 200ms; `fail` lists failing calls. */
    function clickThrice(fail: number[] = []) {
      vi.useFakeTimers();
      let n = 0;
      const { adapter } = setup((req) => {
        const i = n++;
        const res = fail.includes(i)
          ? { status: 500, data: { message: `第 ${i + 1} 次失敗` } }
          : (saved({ no: `ORD-1 #${i + 1}` })(req) as HttpResponse);
        return new Promise((resolve) => setTimeout(() => resolve(res), DELAYS[i]));
      });
      const sw = () => row1().getByRole('switch', { name: '上架' });
      fireEvent.click(sw()); // → true
      fireEvent.click(sw()); // → false
      fireEvent.click(sw()); // → true
      return { adapter, sw };
    }
    const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

    it('the last toggle wins over earlier late responses', async () => {
      const { adapter, sw } = clickThrice();
      expect(requests(adapter).map((r) => r.body)).toEqual([
        { column: 'published', value: true },
        { column: 'published', value: false },
        { column: 'published', value: true },
      ]);
      expect(sw().getAttribute('aria-checked')).toBe('true');
      await advance(100); // #2 (false) answers first
      expect(sw().getAttribute('aria-checked')).toBe('true');
      await advance(100); // #3 (true)
      expect(sw().getAttribute('aria-checked')).toBe('true');
      expect(row1().getByText('ORD-1 #3')).toBeTruthy();
      await advance(100); // #1 arrives last and is ignored
      expect(sw().getAttribute('aria-checked')).toBe('true');
      expect(row1().getByText('ORD-1 #3')).toBeTruthy();
      expect(sw().hasAttribute('aria-busy')).toBe(false);
    });

    it('a failure of the middle toggle does not undo the third', async () => {
      const { sw } = clickThrice([1]);
      await advance(100); // #2 fails
      expect(sw().getAttribute('aria-checked')).toBe('true');
      expect(toasts.error).not.toHaveBeenCalled();
      await advance(200);
      expect(sw().getAttribute('aria-checked')).toBe('true');
      expect(row1().getByText('ORD-1 #3')).toBeTruthy();
    });

    it('a failure of the last toggle reverts to the last confirmed value', async () => {
      const { sw } = clickThrice([2]);
      await advance(100); // #2 confirms false
      expect(sw().getAttribute('aria-checked')).toBe('true');
      await advance(100); // #3 fails: back to #2's confirmed false
      expect(sw().getAttribute('aria-checked')).toBe('false');
      expect(toasts.error).toHaveBeenCalledWith('操作沒有完成：第 3 次失敗');
      await advance(100); // #1 is older than #2: ignored
      expect(sw().getAttribute('aria-checked')).toBe('false');
      expect(row1().getByText('ORD-1 #2')).toBeTruthy();
    });
  });
});

describe('displays inside the edit button', () => {
  it('a display with its own controls (limit) shows as text, so no control is nested', () => {
    setup(saved(), {
      ...orders,
      columns: orders.columns.map((c) =>
        c.key === 'note' ? { ...c, display: { type: 'limit', length: 2 } } : c,
      ),
      rows: [{ ...(rows[0] as GridRow), note: '一段很長的備註文字' }, rows[1] as GridRow],
    });
    const button = row1().getByRole('button', { name: '編輯備註：一段很長的備註文字' });
    expect(button.querySelector('button, a, [tabindex]')).toBeNull();
    expect(button.textContent).toBe('一段很長的備註文字');
  });

  it('a static display (label) still renders inside it', () => {
    setup(saved(), {
      ...orders,
      columns: orders.columns.map((c) =>
        c.key === 'status'
          ? {
              ...c,
              display: { type: 'label', options: { paid: { label: '已付款', tone: 'success' } } },
            }
          : c,
      ),
    });
    const button = row1().getByRole('button', { name: '編輯狀態：已付款' });
    expect(button.querySelector('[data-tone="success"]')).not.toBeNull();
    // The pill is the affordance: no dashed underline under it.
    expect(button.className).not.toContain('br:decoration-dashed');
  });
});

describe('without endpoints.cell', () => {
  it('editable columns render their display only; switches are disabled', () => {
    setup(saved(), { ...orders, endpoints: undefined });
    expect(row1().queryByRole('button', { name: /編輯/ })).toBeNull();
    expect(row1().getByText('Ann')).toBeTruthy();
    expect(row1().getByRole('switch', { name: '上架' }).hasAttribute('disabled')).toBe(true);
    expect(row1().getByRole('switch', { name: '熱門' }).hasAttribute('disabled')).toBe(true);
  });
});

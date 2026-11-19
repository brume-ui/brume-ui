import { type HttpRequest, type HttpResponse, toast } from '@brume-ui/brume-react';
import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { GridView } from '../grid-view';

const rows: GridRow[] = [
  { id: 1, name: '甲' },
  { id: 2, name: '乙' },
  { id: 'c/3', name: '丙' },
];

const page: ListPage = {
  type: 'list',
  title: '分類',
  gridId: 'categories',
  columns: [{ key: 'name', label: '名稱' }],
  rows,
  pagination: { page: 1, perPage: 20, total: 3, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
  ordering: { mode: 'list', column: 'position', direction: 'asc' },
  endpoints: { reorder: '/admin/categories/_brume/reorder' },
};

type Respond = (req: HttpRequest) => HttpResponse | Promise<HttpResponse>;
type Adapter = ReturnType<typeof renderWithBrume>['adapter'];
const requests = (adapter: Adapter) =>
  adapter.calls.filter((c) => c.fn === 'request').map((c) => c.args[0] as HttpRequest);
const reloads = (adapter: Adapter) => adapter.calls.filter((c) => c.fn === 'reload').length;

function setup(p: ListPage = page, respond?: Respond) {
  const user = userEvent.setup();
  return { user, ...renderWithBrume(<GridView page={p} />, { url: '/admin/categories', respond }) };
}

const handle = (name: string) => screen.getByRole('button', { name: `拖曳排序：${name}` });
const originalRect = Element.prototype.getBoundingClientRect;
let toasts: { success: MockInstance; error: MockInstance };

beforeEach(() => {
  toasts = {
    success: vi.spyOn(toast, 'success').mockImplementation(() => {}),
    error: vi.spyOn(toast, 'error').mockImplementation(() => {}),
  };
  // jsdom lays nothing out: give each body row its own 40px slot so dnd-kit can step between them.
  Element.prototype.getBoundingClientRect = function rect(this: Element) {
    const parent = this.parentElement;
    const index =
      this.tagName === 'TR' && parent?.tagName === 'TBODY'
        ? Array.from(parent.children).indexOf(this)
        : 0;
    return {
      x: 0,
      y: index * 40,
      top: index * 40,
      bottom: index * 40 + 40,
      left: 0,
      right: 400,
      width: 400,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect;
  };
  window.scrollTo = vi.fn() as never;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  vi.restoreAllMocks();
});

/** Lifts 甲 and drops it one slot down (after 乙). */
async function dropFirstDown(user: ReturnType<typeof userEvent.setup>) {
  handle('甲').focus();
  await user.keyboard(' ');
  await user.keyboard('{ArrowDown}');
  await user.keyboard(' ');
}

describe('list ordering', () => {
  it('handles are enabled on the default view', () => {
    setup();
    expect(handle('甲').getAttribute('aria-disabled')).toBeNull();
  });

  it('a column sort disables handles with the reason', () => {
    setup({ ...page, query: { ...page.query, sort: { key: 'name', direction: 'asc' } } });
    expect(handle('甲').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText('請先清除排序／篩選，或使用「調整順序」').length).toBeGreaterThan(0);
  });

  it('a filter disables handles', () => {
    setup({ ...page, appliedFilters: [{ key: 'q', label: '搜尋', value: 'x' }] as never });
    expect(handle('甲').getAttribute('aria-disabled')).toBe('true');
  });

  it('search and scope disable handles too', () => {
    const { unmount } = setup({ ...page, query: { ...page.query, q: 'x' } });
    expect(handle('甲').getAttribute('aria-disabled')).toBe('true');
    unmount();
    setup({ ...page, query: { ...page.query, scope: 'vip' } });
    expect(handle('甲').getAttribute('aria-disabled')).toBe('true');
  });

  it('dropping posts the move and refreshes', async () => {
    const { user, adapter } = setup(page, () => ({
      status: 200,
      data: { undo: { id: 1, before: 2 } },
    }));
    await dropFirstDown(user);
    await waitFor(() => expect(reloads(adapter)).toBe(1));
    expect(requests(adapter)).toEqual([
      { method: 'post', url: '/admin/categories/_brume/reorder', body: { id: 1, after: 2 } },
    ]);
    expect(toasts.success).toHaveBeenCalledWith(
      '已更新順序',
      expect.objectContaining({ action: expect.objectContaining({ label: '復原' }) }),
    );
  });

  it("maps string ids back to the row's original id", async () => {
    const { user, adapter } = setup(page, () => ({ status: 200, data: {} }));
    handle('丙').focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowUp}');
    await user.keyboard(' ');
    await waitFor(() => expect(requests(adapter)).toHaveLength(1));
    expect(requests(adapter)[0]?.body).toEqual({ id: 'c/3', after: 1 });
  });

  it("undo posts the server's undo move", async () => {
    const { user, adapter } = setup(page, () => ({
      status: 200,
      data: { undo: { id: 1, before: 2 } },
    }));
    await dropFirstDown(user);
    await waitFor(() => expect(toasts.success).toHaveBeenCalled());
    const options = toasts.success.mock.calls[0]?.[1] as { action: { onClick(): void } };
    const action = options.action;
    await act(async () => action.onClick());
    await waitFor(() => expect(requests(adapter)).toHaveLength(2));
    expect(requests(adapter)[1]).toEqual({
      method: 'post',
      url: '/admin/categories/_brume/reorder',
      body: { id: 1, before: 2 },
    });
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('已復原'));
    expect(reloads(adapter)).toBe(2);
  });

  it('reorder conflict refreshes the grid', async () => {
    const { user, adapter } = setup(page, () => ({
      status: 409,
      data: { message: '項目已不存在' },
    }));
    await dropFirstDown(user);
    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(String(toasts.error.mock.calls[0]?.[0])).toContain('項目已不存在');
    expect(reloads(adapter)).toBe(1);
  });

  it('other failures toast and refresh too', async () => {
    const { user, adapter } = setup(page, () => ({ status: 500, data: {} }));
    await dropFirstDown(user);
    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(reloads(adapter)).toBe(1);
  });

  it('the dialog loads every item and saves the full order', async () => {
    const respond: Respond = (req) =>
      req.method === 'get'
        ? {
            status: 200,
            data: {
              items: [
                { id: 1, label: '甲' },
                { id: 2, label: '乙' },
                { id: 'c/3', label: '丙' },
                { id: 4, label: '丁（第二頁）' },
              ],
            },
          }
        : { status: 200, data: {} };
    const { user, adapter } = setup(page, respond);
    await user.click(screen.getByRole('button', { name: '調整順序' }));
    expect(requests(adapter)[0]).toEqual({
      method: 'get',
      url: '/admin/categories/_brume/reorder',
    });
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.textContent).toContain('丁（第二頁）'));
    await user.click(screen.getByRole('button', { name: '置頂：丁（第二頁）' }));
    await user.click(screen.getByRole('button', { name: '儲存' }));
    await waitFor(() => expect(requests(adapter)).toHaveLength(2));
    expect(requests(adapter)[1]).toEqual({
      method: 'post',
      url: '/admin/categories/_brume/reorder',
      body: { ids: [4, 1, 2, 'c/3'] },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toasts.success).toHaveBeenCalledWith('已更新順序');
    expect(reloads(adapter)).toBe(1);
  });

  it('the dialog button stays available while handles are disabled', () => {
    setup({ ...page, query: { ...page.query, sort: { key: 'name', direction: 'asc' } } });
    expect(screen.getByRole('button', { name: '調整順序' })).toBeTruthy();
  });

  it('no ordering block means no handles and no button', () => {
    const { ordering: _o, endpoints: _e, ...plain } = page;
    setup(plain as ListPage);
    expect(screen.queryByRole('button', { name: /^拖曳排序：/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '調整順序' })).toBeNull();
  });
});

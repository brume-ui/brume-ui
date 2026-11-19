import type { HttpRequest } from '@brume-ui/brume-react';
import type { GridRow, ListPage } from '@brume-ui/brume-schema';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithBrume } from '../../test-utils';
import { GridView } from '../grid-view';

const rows: GridRow[] = [
  { id: 1, name: '服飾', slug: 'apparel', _meta: { parent: null, editUrl: '/admin/cats/1/edit' } },
  { id: 2, name: '上衣', slug: 'tops', _meta: { parent: 1, editUrl: '/admin/cats/2/edit' } },
  { id: 3, name: '配件', slug: 'extras', _meta: { parent: null, editUrl: '/admin/cats/3/edit' } },
];

const page: ListPage = {
  type: 'list',
  title: '分類',
  gridId: 'cats',
  columns: [
    { key: 'name', label: '名稱', primary: true },
    { key: 'slug', label: '代稱' },
  ],
  rows,
  pagination: { page: 1, perPage: 100, total: 3, lastPage: 1 },
  query: { perPage: 100, filters: {} },
  perPageOptions: [100],
  appliedFilters: [],
  actions: {
    row: [{ key: 'addChild', label: '新增子項', type: 'link' } as never],
    batch: [],
    tools: [],
  },
  ordering: { mode: 'tree', column: 'position', direction: 'asc' },
  endpoints: { reorder: '/admin/cats/_brume/reorder', action: '/admin/cats/_brume/action' },
};

type Adapter = ReturnType<typeof renderWithBrume>['adapter'];
const requests = (adapter: Adapter) =>
  adapter.calls.filter((c) => c.fn === 'request').map((c) => c.args[0] as HttpRequest);

function setup(p: ListPage = page, onEdit?: (row: GridRow) => void) {
  const user = userEvent.setup();
  return {
    user,
    ...renderWithBrume(<GridView page={p} onEdit={onEdit} />, { url: '/admin/cats' }),
  };
}

beforeEach(() => {
  window.scrollTo = vi.fn() as never;
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('tree view', () => {
  it('renders rows as a nested tree from _meta.parent', () => {
    setup();
    expect(screen.queryByRole('table')).toBeNull();
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('aria-level'))).toEqual(['1', '2', '1']);
    expect(within(items[1] as HTMLElement).getByText('上衣')).toBeTruthy();
    // Secondary columns show as content, headers do not.
    expect(within(items[1] as HTMLElement).getByText('tops')).toBeTruthy();
    expect(screen.queryByText('代稱')).toBeNull();
    expect(screen.queryByRole('button', { name: '調整順序' })).toBeNull();
  });

  it('primary column opens the edit form', async () => {
    const onEdit = vi.fn();
    const { user } = setup(page, onEdit);
    const link = screen.getByRole('link', { name: '上衣' });
    expect(link.getAttribute('href')).toBe('/admin/cats/2/edit');
    await user.click(link);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  });

  it('row actions render on each node', () => {
    setup();
    expect(screen.getAllByRole('button', { name: /更多操作|More actions/ })).toHaveLength(3);
  });

  it('a keyboard nest posts parent and position', async () => {
    const { user, adapter } = setup();
    screen.getByRole('button', { name: '拖曳排序：配件' }).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowRight}');
    await user.keyboard(' ');
    const [req] = requests(adapter);
    // Numeric ids go back as numbers; nesting after 上衣 (id 2) under 服飾 (id 1).
    expect(req?.body).toEqual({ id: 3, parent: 1, after: 2 });
    expect(req?.url).toBe('/admin/cats/_brume/reorder');
  });

  it('collapse all hides children and is remembered per gridId', async () => {
    const first = setup();
    expect(screen.getByText('上衣')).toBeTruthy();
    await first.user.click(screen.getByRole('button', { name: '全部收合' }));
    expect(screen.queryByText('上衣')).toBeNull();
    first.unmount();

    setup();
    expect(screen.queryByText('上衣')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '全部展開' }));
    expect(screen.getByText('上衣')).toBeTruthy();
  });

  it('maxDepth from the schema is enforced', async () => {
    const { user, adapter } = setup({
      ...page,
      ordering: { mode: 'tree', column: 'position', direction: 'asc', maxDepth: 2 },
    });
    screen.getByRole('button', { name: '拖曳排序：配件' }).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowRight}'); // under 服飾 (level 2)
    await user.keyboard('{ArrowRight}'); // under 上衣 would be level 3
    expect(screen.getAllByRole('status').some((el) => el.textContent?.includes('最多 2 層'))).toBe(
      true,
    );
    await user.keyboard('{Escape}');
    expect(requests(adapter)).toHaveLength(0);
  });
});

import type { ListPage } from '@brume-ui/brume-schema';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { hrefForPage, ListPageView } from './list-page';
import { createRegistry } from './registry';
import { renderWithBrume } from './test-utils';

const page: ListPage = {
  type: 'list',
  title: 'Users',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'orders', label: 'Orders', numeric: true },
    { key: 'meta', label: 'Meta' },
    { key: 'note', label: 'Note' },
  ],
  rows: [
    { id: 1, name: 'Ada', orders: 12, meta: { a: 1 }, note: null },
    { id: 2, name: 'Bo', orders: 3, meta: [1, 2], note: 'x' },
  ],
  pagination: { page: 2, perPage: 2, total: 10, lastPage: 5 },
};

const Badge = (p: { tone: string; context?: { row: { name: string }; column: string } }) => (
  <span>{`${p.tone}/${p.context?.row.name}/${p.context?.column}`}</span>
);

describe('ListPageView', () => {
  it('renders headers, rows, JSON for objects, and right-aligns numeric columns', () => {
    renderWithBrume(<ListPageView page={page} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('{"a":1}')).toBeTruthy();
    expect(screen.getByText('[1,2]')).toBeTruthy();
    expect(screen.queryByText('null')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Orders' }).className).toContain('text-right');
    expect(screen.getByText('12').closest('td')?.className).toContain('text-right');
  });

  it('pagination click visits with preserveScroll and keeps other query params', async () => {
    const { adapter } = renderWithBrume(<ListPageView page={page} />, {
      url: '/admin/users?q=ada&page=2#top',
    });
    await userEvent.click(screen.getByRole('link', { name: '第 3 頁' }));
    const call = adapter.calls.find((c) => c.fn === 'visit');
    expect(call?.args[0]).toBe('/admin/users?q=ada&page=3#top');
    expect(call?.args[1]).toMatchObject({ preserveScroll: true, preserveState: true });
  });

  it('shows the empty state when there are no rows', () => {
    renderWithBrume(
      <ListPageView
        page={{ ...page, rows: [], pagination: { page: 1, perPage: 2, total: 0, lastPage: 1 } }}
      />,
    );
    expect(screen.getByText('目前沒有資料')).toBeTruthy();
  });

  it('renders component display columns through the registry with row context', () => {
    renderWithBrume(
      <ListPageView
        page={{
          ...page,
          columns: [
            {
              key: 'name',
              label: 'Name',
              display: { type: 'component', name: 'Badge', props: { tone: 'ok' } },
            },
          ],
        }}
      />,
      { registry: createRegistry({ mode: 'vite', components: { Badge } }) },
    );
    expect(screen.getByText('ok/Ada/name')).toBeTruthy();
  });
});

describe('hrefForPage', () => {
  it('adds page to a bare path', () => {
    expect(hrefForPage('/a', 3)).toBe('/a?page=3');
  });
});

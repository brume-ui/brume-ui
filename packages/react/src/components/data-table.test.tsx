import { render as rtlRender, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { DataTable } from './data-table';

const render = (ui: ReactNode) =>
  rtlRender(<BrumeProvider adapter={createMemoryAdapter()}>{ui}</BrumeProvider>);

interface Row {
  id: string;
  name: string;
  count: number;
}
const columns = [
  { key: 'name', header: '名稱' },
  { key: 'count', header: '數量', numeric: true },
];
const empty = { title: '還沒有資料', description: '新增第一筆資料後會顯示在這裡。' };

describe('DataTable', () => {
  it('shows the empty title and description when rows is empty', () => {
    render(<DataTable<Row> columns={columns} rows={[]} getRowId={(r) => r.id} empty={empty} />);
    expect(screen.getByText('還沒有資料')).toBeTruthy();
    expect(screen.getByText('新增第一筆資料後會顯示在這裡。')).toBeTruthy();
  });

  it('renders rows as table semantics with numeric columns right-aligned and tabular', () => {
    render(
      <DataTable<Row>
        columns={columns}
        rows={[{ id: 'a', name: '甲', count: 3 }]}
        getRowId={(r) => r.id}
        empty={empty}
        caption="項目清單"
      />,
    );
    expect(screen.getByRole('table', { name: '項目清單' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '數量' }).className).toContain('br:text-right');
    const cell = screen.getByRole('cell', { name: '3' });
    expect(cell.className).toContain('br:tabular-nums');
    expect(cell.className).toContain('br:text-right');
  });

  it('uses the cell renderer when given', () => {
    render(
      <DataTable<Row>
        columns={[{ key: 'name', header: '名稱', cell: (r) => <b>{`#${r.name}`}</b> }]}
        rows={[{ id: 'a', name: '甲', count: 1 }]}
        getRowId={(r) => r.id}
        empty={empty}
      />,
    );
    expect(screen.getByText('#甲').tagName).toBe('B');
  });

  it('loading shows 5 skeleton rows, no data rows and no empty state', () => {
    render(
      <DataTable<Row>
        columns={columns}
        rows={[{ id: 'a', name: '甲', count: 3 }]}
        getRowId={(r) => r.id}
        empty={empty}
        loading
      />,
    );
    const table = screen.getByRole('table');
    expect(table.getAttribute('aria-busy')).toBe('true');
    const body = table.querySelectorAll('tbody tr');
    expect(body.length).toBe(5);
    expect(within(table).queryByText('甲')).toBeNull();
    expect(screen.queryByText('還沒有資料')).toBeNull();
    expect(table.querySelector('.br\\:motion-reduce\\:animate-none')).toBeTruthy();
    // header stays so column widths do not jump
    expect(screen.getByRole('columnheader', { name: '名稱' })).toBeTruthy();
  });

  it('uses the same fixed layout and col widths when loading and loaded', () => {
    const cols = [
      { key: 'name', header: '名稱', width: '12rem' },
      { key: 'count', header: '數量', numeric: true },
    ];
    const rows = [{ id: 'a', name: '甲', count: 3 }];
    const widths = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('col')).map((c) => c.style.width);
    const { unmount } = render(
      <DataTable<Row> columns={cols} rows={rows} getRowId={(r) => r.id} empty={empty} loading />,
    );
    const loadingTable = screen.getByRole('table');
    expect(loadingTable.className).toContain('br:table-fixed');
    const loadingWidths = widths(loadingTable);
    unmount();
    render(<DataTable<Row> columns={cols} rows={rows} getRowId={(r) => r.id} empty={empty} />);
    const table = screen.getByRole('table');
    expect(table.className).toContain('br:table-fixed');
    expect(widths(table)).toEqual(loadingWidths);
    expect(loadingWidths).toEqual(['12rem', '']);
  });

  it('keeps a minimum width from the columns and scrolls horizontally instead of squeezing', () => {
    render(
      <DataTable<Row>
        columns={[
          { key: 'name', header: '名稱', width: '6rem' },
          { key: 'count', header: '數量', numeric: true },
          { key: 'pct', header: '比例', width: '20%' },
        ]}
        rows={[{ id: 'a', name: '甲', count: 3 }]}
        getRowId={(r) => r.id}
        empty={empty}
      />,
    );
    const table = screen.getByRole('table');
    expect(table.style.minWidth).toBe('calc(26rem)');
    expect(table.parentElement?.className).toContain('br:overflow-x-auto');
    expect(screen.getByRole('cell', { name: '甲' }).className).toContain('br:truncate');
  });

  describe('when the table is wider than its container', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('becomes a focusable, labelled scroll region', () => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        },
      );
      const scrollWidth = vi
        .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
        .mockReturnValue(600);
      const clientWidth = vi
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(300);
      render(
        <DataTable<Row>
          columns={columns}
          rows={[{ id: 'a', name: '甲', count: 3 }]}
          getRowId={(r) => r.id}
          empty={empty}
        />,
      );
      const region = screen.getByRole('region', { name: '資料表格（可左右捲動）' });
      expect(region.tabIndex).toBe(0);
      scrollWidth.mockRestore();
      clientWidth.mockRestore();
    });

    it('is not a tab stop when nothing overflows', () => {
      render(
        <DataTable<Row>
          columns={columns}
          rows={[{ id: 'a', name: '甲', count: 3 }]}
          getRowId={(r) => r.id}
          empty={empty}
        />,
      );
      expect(screen.queryByRole('region')).toBeNull();
    });
  });
});

import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import { cloneElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { type DataColumn, DataTable } from './data-table';

const render = (ui: ReactNode) =>
  rtlRender(<BrumeProvider adapter={createMemoryAdapter()}>{ui}</BrumeProvider>);

interface Row {
  id: string;
  name: string;
  count: number;
}
const columns: DataColumn<Row>[] = [
  { key: 'name', header: '名稱' },
  { key: 'count', header: '數量', numeric: true },
];
const [nameCol, countCol] = columns as [DataColumn<Row>, DataColumn<Row>];
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

  it('staggers row fade-in through a delay variable that reduced motion zeroes', () => {
    rtlRender(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <DataTable
          columns={[{ key: 'name', header: '名稱' }]}
          rows={[{ name: 'a' }, { name: 'b' }]}
          getRowId={(r) => r.name}
          empty={{ title: '空', description: '沒有資料' }}
        />
      </BrumeProvider>,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => r.style.getPropertyValue('--br-row-delay'))).toEqual(['0ms', '30ms']);
    expect(rows[0]?.className).toContain('br:motion-reduce:[animation-delay:0ms]');
  });
  describe('extensions', () => {
    const rows: Row[] = [
      { id: 'a', name: '甲', count: 1 },
      { id: 'b', name: '乙', count: 2 },
    ];
    const base = { rows, getRowId: (r: Row) => r.id, empty };

    it('aria-sort reflects the sort direction', () => {
      const onToggle = vi.fn();
      const make = (direction: 'asc' | 'desc' | null) => (
        <DataTable<Row>
          {...base}
          columns={[{ key: 'name', header: '名稱', sort: { direction, onToggle } }, countCol]}
        />
      );
      const { rerender } = render(make('asc'));
      const th = () => screen.getByRole('columnheader', { name: /名稱/ });
      expect(th().getAttribute('aria-sort')).toBe('ascending');
      rerender(<BrumeProvider adapter={createMemoryAdapter()}>{make('desc')}</BrumeProvider>);
      expect(th().getAttribute('aria-sort')).toBe('descending');
      rerender(<BrumeProvider adapter={createMemoryAdapter()}>{make(null)}</BrumeProvider>);
      expect(th().getAttribute('aria-sort')).toBe('none');
      expect(screen.getByRole('columnheader', { name: '數量' }).hasAttribute('aria-sort')).toBe(
        false,
      );
      fireEvent.click(within(th()).getByRole('button'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('selects the whole page and shows mixed state when partially selected', () => {
      const onChange = vi.fn();
      const sel = (selected: string[]) => ({
        selected: new Set(selected),
        onChange,
        rowLabel: (r: Row) => r.name,
      });
      const { rerender } = render(
        <DataTable<Row> {...base} columns={columns} selection={sel(['z'])} />,
      );
      fireEvent.click(screen.getByRole('checkbox', { name: '全選這一頁' }));
      expect([...(onChange.mock.calls[0]?.[0] ?? [])].sort()).toEqual(['a', 'b', 'z']);
      expect(screen.getByRole('checkbox', { name: '選取 甲' })).toBeTruthy();
      rerender(
        <BrumeProvider adapter={createMemoryAdapter()}>
          <DataTable<Row> {...base} columns={columns} selection={sel(['a'])} />
        </BrumeProvider>,
      );
      expect(
        screen.getByRole('checkbox', { name: '全選這一頁' }).getAttribute('aria-checked'),
      ).toBe('mixed');
      fireEvent.click(screen.getByRole('checkbox', { name: '選取 乙' }));
      expect([...(onChange.mock.lastCall?.[0] ?? [])].sort()).toEqual(['a', 'b']);
    });

    it('marks selected rows with aria-selected and centres the checkbox column', () => {
      render(
        <DataTable<Row>
          {...base}
          columns={columns}
          selection={{ selected: new Set(['b']), onChange: () => {}, rowLabel: (r) => r.name }}
        />,
      );
      const [, rowA, rowB] = screen.getAllByRole('row') as HTMLElement[];
      expect(rowA?.getAttribute('aria-selected')).toBe('false');
      expect(rowB?.getAttribute('aria-selected')).toBe('true');
      // 44px column, 20px checkbox: 12px either side.
      const selectTh = screen.getAllByRole('columnheader')[0] as HTMLElement;
      expect(selectTh.className).toContain('br:px-3');
      const selectTd = within(rowB as HTMLElement).getAllByRole('cell')[0] as HTMLElement;
      expect(selectTd.className).toContain('br:px-3');
      expect(selectTd.className).not.toContain('br:px-4');
      expect(selectTd.className).toContain('br:group-aria-selected/row:bg-surface-selected');
    });

    it('keeps the actions column sticky with a background in header and skeleton rows', () => {
      const { container } = render(
        <DataTable<Row> {...base} columns={columns} rowActions={() => null} loading />,
      );
      const th = container.querySelector('thead th:last-child') as HTMLElement;
      expect(th.className).toContain('br:sticky');
      expect(th.className).toContain('br:bg-surface-canvas');
      const td = container.querySelector('tbody tr td:last-child') as HTMLElement;
      expect(td.className).toContain('br:sticky');
      expect(td.className).toContain('br:right-0');
    });

    it('does not render hidden columns', () => {
      render(<DataTable<Row> {...base} columns={[nameCol, { ...countCol, hidden: true }]} />);
      expect(screen.queryByRole('columnheader', { name: '數量' })).toBeNull();
      expect(screen.getAllByRole('columnheader')).toHaveLength(1);
    });

    it('caption is the first child of table', () => {
      render(<DataTable<Row> {...base} columns={columns} caption="項目清單" />);
      expect(screen.getByRole('table').firstElementChild?.tagName).toBe('CAPTION');
    });

    it('puts rowActions in the last cell of each row and wraps rows with rowWrapper', () => {
      render(
        <DataTable<Row>
          {...base}
          columns={columns}
          rowActions={(r) => <button type="button">操作{r.name}</button>}
          rowWrapper={(r, tr) => cloneElement(tr, { 'data-wrapped': r.id } as never)}
        />,
      );
      const rowEls = screen.getAllByRole('row').slice(1);
      expect(rowEls).toHaveLength(2);
      expect(rowEls.map((tr) => tr.getAttribute('data-wrapped'))).toEqual(['a', 'b']);
      const cells = within(rowEls[0] as HTMLElement).getAllByRole('cell');
      expect(
        within(cells[cells.length - 1] as HTMLElement).getByRole('button', { name: '操作甲' }),
      ).toBeTruthy();
    });
  });
});

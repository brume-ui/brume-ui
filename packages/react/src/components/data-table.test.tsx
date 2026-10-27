import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from './data-table';

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
});

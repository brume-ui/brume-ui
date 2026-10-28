import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompactTable } from './compact-table';

describe('CompactTable', () => {
  it('renders header cells and formats values', () => {
    render(
      <CompactTable
        caption="品項"
        columns={[
          { key: 'name', label: '品名' },
          { key: 'qty', label: '數量' },
        ]}
        rows={[
          { name: '茶葉', qty: 2 },
          { name: '茶杯', qty: null },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: '品項' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['品名', '數量']);
    expect(
      within(table)
        .getAllByRole('cell')
        .map((td) => td.textContent),
    ).toEqual(['茶葉', '2', '茶杯', '']);
  });
});

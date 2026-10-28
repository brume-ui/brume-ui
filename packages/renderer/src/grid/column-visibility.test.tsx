import type { ListPage } from '@brume-ui/brume-schema';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithBrume } from '../test-utils';
import { COLUMN_VISIBILITY_KEY, readHiddenColumns, writeHiddenColumns } from './column-visibility';
import { GridView } from './grid-view';

const page: ListPage = {
  type: 'list',
  title: '訂單',
  gridId: 'orders',
  columns: [
    { key: 'no', label: '編號', hideable: false },
    { key: 'customer', label: '客戶' },
    { key: 'amount', label: '金額', numeric: true },
    { key: 'note', label: '備註', hiddenByDefault: true },
  ],
  rows: [{ id: 1, no: 'A-1', customer: 'Ada', amount: 120, note: '急件' }],
  pagination: { page: 1, perPage: 20, total: 1, lastPage: 1 },
  query: { perPage: 20, filters: {} },
  perPageOptions: [20],
  appliedFilters: [],
  actions: { row: [], batch: [], tools: [] },
};

const header = (name: string) => screen.queryByRole('columnheader', { name });

afterEach(() => vi.restoreAllMocks());

describe('readHiddenColumns / writeHiddenColumns', () => {
  it('uses hiddenByDefault when nothing is stored', () => {
    expect([...readHiddenColumns(page)]).toEqual(['note']);
  });

  it('round-trips through localStorage under the gridId key', () => {
    writeHiddenColumns('orders', new Set(['amount']));
    expect(COLUMN_VISIBILITY_KEY('orders')).toBe('brume.grid.orders.hidden');
    expect(JSON.parse(localStorage.getItem('brume.grid.orders.hidden') ?? '')).toEqual(['amount']);
    expect([...readHiddenColumns(page)]).toEqual(['amount']);
  });

  it('an empty stored list shows every column, including hiddenByDefault ones', () => {
    writeHiddenColumns('orders', new Set());
    expect(readHiddenColumns(page).size).toBe(0);
  });

  it.each([
    ['broken JSON', '{nope'],
    ['not an array', '{"amount":true}'],
    ['non-string entries', '[1]'],
    ['an unknown column key', '["amount","gone"]'],
  ])('falls back to hiddenByDefault on %s', (_, stored) => {
    localStorage.setItem('brume.grid.orders.hidden', stored);
    expect([...readHiddenColumns(page)]).toEqual(['note']);
  });

  it('never hides a column that is not hideable', () => {
    localStorage.setItem('brume.grid.orders.hidden', '["no","amount"]');
    expect([...readHiddenColumns(page)]).toEqual(['amount']);
  });

  it('survives a throwing localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect([...readHiddenColumns(page)]).toEqual(['note']);
    expect(() => writeHiddenColumns('orders', new Set(['amount']))).not.toThrow();
  });
});

describe('GridView column toggle', () => {
  it('hidden columns persist per gridId', async () => {
    const user = userEvent.setup();
    const first = renderWithBrume(<GridView page={page} />);
    expect(header('備註')).toBeNull();
    expect(header('金額')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '顯示欄位' }));
    const group = await screen.findByRole('group', { name: '顯示欄位' });
    await user.click(screen.getByRole('checkbox', { name: '金額' }));
    await user.click(screen.getByRole('checkbox', { name: '備註' }));
    expect(group).toBeTruthy();
    expect(header('金額')).toBeNull();
    expect(header('備註')).toBeTruthy();
    first.unmount();

    renderWithBrume(<GridView page={page} />);
    expect(header('金額')).toBeNull();
    expect(header('備註')).toBeTruthy();

    // Another grid keeps its own setting.
    renderWithBrume(<GridView page={{ ...page, gridId: 'invoices' }} />);
    expect(screen.getAllByRole('columnheader', { name: '金額' })).toHaveLength(1);
  });

  it('re-reads the setting when the same GridView switches to another gridId', () => {
    writeHiddenColumns('orders', new Set(['amount']));
    const { rerender } = renderWithBrume(<GridView page={page} />);
    expect(header('金額')).toBeNull();
    rerender(<GridView page={{ ...page, gridId: 'invoices' }} />);
    expect(header('金額')).toBeTruthy();
    expect(header('備註')).toBeNull();
  });

  it('shows all columns as usual when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const user = userEvent.setup();
    renderWithBrume(<GridView page={{ ...page, columns: page.columns.slice(0, 3) }} />);
    expect(header('編號')).toBeTruthy();
    expect(header('客戶')).toBeTruthy();
    expect(header('金額')).toBeTruthy();
    // Toggling still works for this visit.
    await user.click(screen.getByRole('button', { name: '顯示欄位' }));
    await user.click(await screen.findByRole('checkbox', { name: '客戶' }));
    expect(header('客戶')).toBeNull();
  });

  it('a column with hideable: false cannot be unchecked', async () => {
    const user = userEvent.setup();
    renderWithBrume(<GridView page={page} />);
    await user.click(screen.getByRole('button', { name: '顯示欄位' }));
    const locked = await screen.findByRole('checkbox', { name: '編號' });
    expect(locked.hasAttribute('disabled')).toBe(true);
    expect(locked.getAttribute('aria-checked')).toBe('true');
    await user.click(locked);
    expect(locked.getAttribute('aria-checked')).toBe('true');
    expect(header('編號')).toBeTruthy();
    expect(localStorage.getItem('brume.grid.orders.hidden')).toBeNull();
  });
});

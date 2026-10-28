import { Toaster } from '@brume-ui/brume-react';
import type { GridRow, ListColumn, ListPage } from '@brume-ui/brume-schema';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createRegistry } from '../../registry';
import { renderWithBrume } from '../../test-utils';
import { GridView } from '../grid-view';

function Timeline({ context }: { context: { row: GridRow; column: string } }) {
  return (
    <p>
      timeline:{String(context.row.id)}:{context.column}
    </p>
  );
}

function page(columns: ListColumn[], rows: GridRow[]): ListPage {
  return {
    type: 'list',
    title: '訂單',
    gridId: 'orders-displays',
    columns,
    rows,
    pagination: { page: 1, perPage: 20, total: rows.length, lastPage: 1 },
    query: { perPage: 20, filters: {} },
    perPageOptions: [20],
    quickSearch: {},
    appliedFilters: [],
    actions: { row: [], batch: [], tools: [] },
  };
}

function renderGrid(
  columns: ListColumn[],
  rows: GridRow[],
  opts: Parameters<typeof renderWithBrume>[1] = {},
) {
  return renderWithBrume(
    <>
      <GridView page={page(columns, rows)} />
      <Toaster />
    </>,
    opts,
  );
}

/** The data cell of `column` in the first data row. */
function cell(columnIndex = 0, rowIndex = 0): HTMLElement {
  const rows = screen.getAllByRole('row').slice(1);
  const cells = within(rows[rowIndex] as HTMLElement).getAllByRole('cell');
  return cells[columnIndex] as HTMLElement;
}

describe('grid displays', () => {
  it('without a display falls back to the formatted value', () => {
    renderGrid([{ key: 'meta', label: '資料' }], [{ id: 1, meta: { a: 1 } }]);
    expect(cell().textContent).toBe('{"a":1}');
  });

  describe('label', () => {
    const status: ListColumn = {
      key: 'status',
      label: '狀態',
      display: {
        type: 'label',
        options: {
          paid: { label: '已付款', tone: 'success' },
          refunded: { label: '已退款', tone: 'danger' },
        },
      },
    };

    it('shows the option label in its tone', () => {
      renderGrid([status], [{ id: 1, status: 'paid' }]);
      const pill = within(cell()).getByText('已付款');
      expect(pill.getAttribute('data-tone')).toBe('success');
      expect(pill.className).toContain('br:text-success');
    });

    it('shows an unknown value as is, in the neutral tone', () => {
      renderGrid([status], [{ id: 1, status: 'pending' }]);
      const pill = within(cell()).getByText('pending');
      expect(pill.getAttribute('data-tone')).toBe('neutral');
    });

    it('with options, an unknown value is neutral even when the column has a tone', () => {
      renderGrid(
        [{ ...status, display: { ...status.display, tone: 'warning' } as ListColumn['display'] }],
        [
          { id: 1, status: 'paid' },
          { id: 2, status: 'pending' },
        ],
      );
      expect(within(cell(0, 0)).getByText('已付款').getAttribute('data-tone')).toBe('success');
      expect(within(cell(0, 1)).getByText('pending').getAttribute('data-tone')).toBe('neutral');
    });

    it('without options uses the display tone; arrays become one pill each', () => {
      renderGrid(
        [{ key: 'tags', label: '標籤', display: { type: 'label', tone: 'info' } }],
        [{ id: 1, tags: ['禮品', '急件'] }],
      );
      expect(within(cell()).getByText('禮品').getAttribute('data-tone')).toBe('info');
      expect(within(cell()).getByText('急件').getAttribute('data-tone')).toBe('info');
    });
  });

  it('badge: a count pill', () => {
    renderGrid(
      [{ key: 'unread', label: '未讀', display: { type: 'badge', tone: 'danger' } }],
      [{ id: 1, unread: 3 }],
    );
    const pill = within(cell()).getByText('3');
    expect(pill.getAttribute('data-tone')).toBe('danger');
    expect(pill.className).toContain('br:tabular-nums');
  });

  describe('link', () => {
    it('external: new tab with rel and the sr-only hint', () => {
      renderGrid(
        [
          {
            key: 'site',
            label: '網站',
            display: { type: 'link', external: true, style: 'button' },
          },
        ],
        [{ id: 1, site: 'example.com', _meta: { href: { site: 'https://example.com' } } }],
      );
      const link = within(cell()).getByRole('link', { name: 'example.com（另開新分頁）' });
      expect(link.getAttribute('href')).toBe('https://example.com');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      // style: 'button' is the pill outline.
      expect(link.className).toContain('br:rounded-pill');
    });

    it('internal: a plain click visits through the adapter', async () => {
      const user = userEvent.setup();
      const { adapter } = renderGrid(
        [{ key: 'customer', label: '客戶', display: { type: 'link' } }],
        [{ id: 1, customer: 'Ada', _meta: { href: { customer: '/admin/customers/9' } } }],
      );
      await user.click(within(cell()).getByRole('link', { name: 'Ada' }));
      expect(adapter.calls.filter((c) => c.fn === 'visit').map((c) => c.args[0])).toEqual([
        '/admin/customers/9',
      ]);
    });

    it('without an href is plain text', () => {
      renderGrid(
        [{ key: 'customer', label: '客戶', display: { type: 'link' } }],
        [{ id: 1, customer: 'Ada' }],
      );
      expect(within(cell()).queryByRole('link')).toBeNull();
      expect(cell().textContent).toBe('Ada');
    });
  });

  describe('image', () => {
    const photo: ListColumn = { key: 'photo', label: '照片', display: { type: 'image' } };

    it('shows at most 3 thumbnails and +N for the rest', () => {
      renderGrid([photo], [{ id: 1, photo: ['/1.png', '/2.png', '/3.png', '/4.png', '/5.png'] }]);
      const thumbs = within(cell()).getAllByRole('button');
      expect(thumbs).toHaveLength(3);
      expect(within(cell()).getByText('+2')).toBeTruthy();
      expect(within(cell()).getByText('還有 2 張')).toBeTruthy();
      expect(within(cell()).getAllByRole('img', { hidden: true })[0]?.getAttribute('alt')).toBe(
        '照片',
      );
    });

    it('fits a default-width cell: thumbnails shrink, +N keeps its size', () => {
      renderGrid([photo], [{ id: 1, photo: ['/1.png', '/2.png', '/3.png', '/4.png'] }]);
      // jsdom has no layout: check the flex contract that keeps 3 thumbnails and +N inside the
      // 128px a fluid column leaves (3 × 24px minimum + gaps + pill fit; 40px each shrink).
      const strip = cell().querySelector('[data-images]') as HTMLElement;
      expect(strip.className).toContain('br:min-w-0');
      expect(strip.className).toContain('br:max-w-full');
      expect(strip.className).toContain('br:flex');
      for (const thumb of within(cell()).getAllByRole('button')) {
        expect(thumb.className).toContain('br:shrink');
        expect(thumb.className).toContain('br:min-w-6');
      }
      const more = cell().querySelector('[data-more]') as HTMLElement;
      expect(more.className).toContain('br:shrink-0');
      expect(more.textContent).toContain('+1');
    });

    it('opens the full image in a dialog', async () => {
      const user = userEvent.setup();
      renderGrid([photo], [{ id: 1, photo: '/a.png' }]);
      await user.click(within(cell()).getByRole('button', { name: '查看第 1 張照片' }));
      const dialog = await screen.findByRole('dialog', { name: '照片' });
      expect(within(dialog).getByRole('img', { name: '照片' }).getAttribute('src')).toBe('/a.png');
    });
  });

  it('limit: truncates and shows the full text in a popover', async () => {
    const user = userEvent.setup();
    renderGrid(
      [{ key: 'note', label: '備註', display: { type: 'limit', length: 5 } }],
      [{ id: 1, note: '請在下午送達，謝謝' }],
    );
    expect(cell().textContent).toContain('請在下午送');
    expect(cell().textContent).not.toContain('謝謝');
    await user.click(within(cell()).getByRole('button', { name: '顯示完整的備註' }));
    const panel = await screen.findByRole('dialog', { name: '備註' });
    expect(within(panel).getByText('請在下午送達，謝謝')).toBeTruthy();
  });

  it('limit: short values have no button', () => {
    renderGrid(
      [{ key: 'note', label: '備註', display: { type: 'limit', length: 20 } }],
      [{ id: 1, note: '短' }],
    );
    expect(within(cell()).queryByRole('button')).toBeNull();
  });

  it('progress: a progressbar with value and max', () => {
    renderGrid(
      [{ key: 'amount', label: '金額', display: { type: 'progress', max: 10000 } }],
      [{ id: 1, amount: 1200 }],
    );
    const bar = within(cell()).getByRole('progressbar', { name: '金額' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1200');
    expect(bar.getAttribute('aria-valuemax')).toBe('10000');
  });

  it('qrcode: the QR button opens a popover with the code', async () => {
    const user = userEvent.setup();
    renderGrid(
      [{ key: 'code', label: '取貨碼', display: { type: 'qrcode', size: 96 } }],
      [{ id: 1, code: 'PICK-001' }],
    );
    await user.click(within(cell()).getByRole('button', { name: '顯示取貨碼的 QR Code' }));
    const panel = await screen.findByRole('dialog', { name: '取貨碼' });
    const svg = within(panel).getByRole('img', { name: '取貨碼的 QR Code' });
    expect(svg.getAttribute('width')).toBe('96');
  });

  it('copyable: copies the value and toasts 「已複製」', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    renderGrid(
      [{ key: 'tracking', label: '物流單號', display: { type: 'copyable' } }],
      [{ id: 1, tracking: 'TW123456' }],
    );
    expect(within(cell()).getByText('TW123456')).toBeTruthy();
    await user.click(within(cell()).getByRole('button', { name: '複製物流單號' }));
    expect(write).toHaveBeenCalledWith('TW123456');
    expect(await screen.findByText('已複製')).toBeTruthy();
  });

  it('downloadable: one download link per file', () => {
    renderGrid(
      [{ key: 'invoice', label: '發票', display: { type: 'downloadable' } }],
      [
        {
          id: 1,
          invoice: ['https://example.com/files/a.pdf', { url: '/inv/2', name: 'inv-2.pdf' }],
        },
      ],
    );
    const links = within(cell()).getAllByRole('link');
    expect(
      links.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('download')]),
    ).toEqual([
      ['a.pdf', 'https://example.com/files/a.pdf', 'a.pdf'],
      ['inv-2.pdf', '/inv/2', 'inv-2.pdf'],
    ]);
  });

  it('expand: toggles aria-expanded and a full-width content row', async () => {
    const user = userEvent.setup();
    renderGrid(
      [
        { key: 'customer', label: '客戶' },
        { key: 'detail', label: '明細', display: { type: 'expand', label: '展開' } },
      ],
      [
        {
          id: 1,
          customer: 'Ada',
          _meta: { content: { detail: { type: 'text', text: '兩件茶葉，一件茶杯' } } },
        },
      ],
    );
    const toggle = within(cell(1)).getByRole('button', { name: '展開「明細」' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // A quiet ghost pill: one per row, so it must not repeat the accent down the column.
    expect(toggle.className).toContain('br:bg-transparent');
    expect(toggle.className).not.toContain('br:text-accent-tint-text');
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    const detail = within(rows[2] as HTMLElement).getByRole('cell');
    expect(detail.getAttribute('colspan')).toBe('2');
    expect(detail.textContent).toContain('兩件茶葉，一件茶杯');
    const controls = toggle.getAttribute('aria-controls');
    expect(controls && document.getElementById(controls)).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('expand: another view of the list starts with everything collapsed', async () => {
    const user = userEvent.setup();
    const columns: ListColumn[] = [{ key: 'detail', label: '明細', display: { type: 'expand' } }];
    const rows: GridRow[] = [
      { id: 1, _meta: { content: { detail: { type: 'text', text: '茶葉' } } } },
    ];
    const { rerender } = renderGrid(columns, rows);
    await user.click(within(cell(0)).getByRole('button'));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    // A refresh of the same view keeps it open…
    rerender(<GridView page={page(columns, [...rows])} />);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    // …another page does not.
    const next = page(columns, [...rows]);
    rerender(<GridView page={{ ...next, pagination: { ...next.pagination, page: 2 } }} />);
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('modal: opens a dialog with the row content', async () => {
    const user = userEvent.setup();
    renderGrid(
      [{ key: 'history', label: '紀錄', display: { type: 'modal', title: '訂單紀錄' } }],
      [
        {
          id: 1,
          _meta: {
            content: {
              history: {
                type: 'table',
                columns: [{ key: 'at', label: '時間' }],
                rows: [{ at: '10:00' }],
              },
            },
          },
        },
      ],
    );
    await user.click(within(cell()).getByRole('button', { name: '查看「紀錄」' }));
    const dialog = await screen.findByRole('dialog', { name: '訂單紀錄' });
    expect(within(dialog).getByRole('columnheader', { name: '時間' })).toBeTruthy();
    expect(within(dialog).getByRole('cell', { name: '10:00' })).toBeTruthy();
  });

  it('table: a mini table inside the cell', () => {
    renderGrid(
      [
        {
          key: 'items',
          label: '品項',
          display: {
            type: 'table',
            columns: [
              { key: 'name', label: '品名' },
              { key: 'qty', label: '數量' },
            ],
          },
        },
      ],
      [{ id: 1, items: [{ name: '茶葉', qty: 2 }] }],
    );
    const mini = within(cell()).getByRole('table', { name: '品項' });
    expect(within(mini).getByRole('cell', { name: '茶葉' })).toBeTruthy();
    expect(within(mini).getByRole('cell', { name: '2' })).toBeTruthy();
  });

  it('component content renders through ComponentSlot with the row', async () => {
    const user = userEvent.setup();
    renderGrid(
      [{ key: 'history', label: '紀錄', display: { type: 'expand' } }],
      [{ id: 'o-2', _meta: { content: { history: { type: 'component', name: 'Timeline' } } } }],
      { registry: createRegistry({ mode: 'vite', components: { Timeline } }) },
    );
    await user.click(within(cell()).getByRole('button', { name: '展開「紀錄」' }));
    await waitFor(() => expect(screen.getByText('timeline:o-2:history')).toBeTruthy());
  });
});

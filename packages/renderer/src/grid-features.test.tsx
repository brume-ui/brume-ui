import { ConfirmHost } from '@brume-ui/brume-react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GridFeaturesPage } from '../../../apps/playground/src/pages/grid-features';
import { renderWithBrume } from './test-utils';

const mount = (id: string) => {
  window.location.hash = `/grid-features?example=${id}`;
  return renderWithBrume(
    <>
      <GridFeaturesPage />
      <ConfirmHost />
    </>,
  );
};
const output = (id: string) => screen.getByTestId(id).textContent ?? '';
describe('focused Grid through the public renderer', () => {
  it('makes action input visible and supports cancellation, field422 and retry', async () => {
    mount('grid.behavior.action-input');
    const row = screen
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('ORD-2610024')) as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '註記原因' }));
    let dialog = screen.getByRole('dialog', { name: '註記訂單' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '原因' }), {
      target: { value: '取消草稿' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(output('grid-records')).not.toContain('取消草稿');
    await waitFor(() =>
      expect(
        (within(row).getByRole('button', { name: '註記原因' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(within(row).getByRole('button', { name: '註記原因' }));
    dialog = screen.getByRole('dialog', { name: '註記訂單' });
    expect((within(dialog).getByRole('textbox', { name: '原因' }) as HTMLInputElement).value).toBe(
      '',
    );
    fireEvent.change(within(dialog).getByRole('textbox', { name: '原因' }), {
      target: { value: '短' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '套用註記' }));
    await screen.findByText('原因至少 3 個字。');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '原因' }), {
      target: { value: '客服已確認' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '套用註記' }));
    await waitFor(() => expect(output('grid-records')).toContain('客服已確認'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('applies and clears the actual range through Grid panel controls', async () => {
    mount('grid.input.range-text');
    fireEvent.click(screen.getByRole('button', { name: '篩選' }));
    fireEvent.change(screen.getByLabelText('聚焦篩選（起）'), { target: { value: 'ORD-2610010' } });
    fireEvent.change(screen.getByLabelText('聚焦篩選（迄）'), { target: { value: 'ORD-2610015' } });
    fireEvent.click(screen.getByRole('button', { name: '套用篩選' }));
    await waitFor(() => expect(output('grid-result-count')).toContain('符合 6 筆'));
    fireEvent.click(screen.getByRole('button', { name: '移除篩選：聚焦篩選' }));
    await waitFor(() => expect(output('grid-result-count')).toContain('符合 24 筆'));
  });
  it('navigates resource page and returns to the actual shared Grid record', async () => {
    mount('grid.behavior.resource-page');
    fireEvent.click(screen.getByRole('button', { name: 'ORD-2610024' }));
    await screen.findByRole('button', { name: '返回聚焦列表' });
    fireEvent.change(screen.getByRole('textbox', { name: '客戶' }), {
      target: { value: '獨立頁修改' },
    });
    fireEvent.click(screen.getByRole('button', { name: '返回聚焦列表' }));
    const guard = await screen.findByRole('alertdialog', { name: '放棄未儲存的變更？' });
    expect(screen.getByRole('textbox', { name: '客戶', hidden: true })).toBeTruthy();
    fireEvent.click(within(guard).getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '儲存' }));
    await waitFor(() => expect(output('grid-records')).toContain('獨立頁修改'));
    fireEvent.click(screen.getByRole('button', { name: '返回聚焦列表' }));
    await screen.findByRole('button', { name: '編輯客戶：獨立頁修改' });
    fireEvent.click(screen.getByRole('button', { name: '編輯客戶：獨立頁修改' }));
    const customer = screen.getByRole('textbox', { name: '客戶' });
    fireEvent.change(customer, { target: { value: '新的客戶' } });
    fireEvent.keyDown(customer, { key: 'Enter' });
    await waitFor(() => {
      const rows = JSON.parse(output('grid-rows')) as { id: number; customer: string }[];
      expect(rows.find((row) => row.id === 24)?.customer).toBe('新的客戶');
    });
    fireEvent.click(screen.getByRole('button', { name: '重新整理' }));
    await screen.findByRole('button', { name: '編輯客戶：新的客戶' });
    const row = (
      JSON.parse(output('grid-rows')) as {
        id: number;
        customer: string;
        _meta: { raw: Record<string, unknown> };
      }[]
    ).find((row) => row.id === 24);
    expect(row?.customer).toBe('新的客戶');
    expect(row?._meta.raw).not.toHaveProperty('customer');
    expect(
      (JSON.parse(output('grid-records')) as { id: number; customer: string }[]).find(
        (row) => row.id === 24,
      )?.customer,
    ).toBe('新的客戶');
  });
  it('passes the active focused example into the native download bridge', async () => {
    mount('grid.input.range-text');
    fireEvent.click(screen.getByRole('button', { name: '篩選' }));
    fireEvent.change(screen.getByLabelText('聚焦篩選（起）'), { target: { value: 'ORD-2610010' } });
    fireEvent.change(screen.getByLabelText('聚焦篩選（迄）'), { target: { value: 'ORD-2610015' } });
    fireEvent.click(screen.getByRole('button', { name: '套用篩選' }));
    await waitFor(() => expect(output('grid-result-count')).toContain('符合 6 筆'));
    const OriginalURL = URL;
    vi.stubGlobal(
      'URL',
      class extends OriginalURL {
        static createObjectURL() {
          return 'blob:https://demo.invalid/focused-export';
        }
        static revokeObjectURL() {}
      },
    );
    vi.useFakeTimers();
    const link = document.createElement('a');
    link.href =
      '/admin/orders/export?filter[focus][start]=ORD-2610010&filter[focus][end]=ORD-2610015&sort=no&export_scope=all';
    link.download = '';
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.append(link);
    try {
      // Native Grid exports click an anchor outside the React tree; use that exact bridge.
      fireEvent.click(link);
      const events = JSON.parse(output('grid-events')) as { ids?: number[] }[];
      expect(events.at(-1)?.ids).toEqual([10, 11, 12, 13, 14, 15]);
      expect(link.download).toBe('orders-all.csv');
      vi.runOnlyPendingTimers();
    } finally {
      link.remove();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

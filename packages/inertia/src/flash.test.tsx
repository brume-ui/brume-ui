import { createRegistry } from '@herb09638/brume-renderer';
import type { SharedProps } from '@herb09638/brume-schema';
import { usePage } from '@inertiajs/react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrumeLayout } from './brume-layout';
import { makeShared } from './test-fixtures';

vi.mock('@inertiajs/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@inertiajs/react')>()),
  usePage: vi.fn(),
}));

const registry = createRegistry({ mode: 'precompiled' });

function setPage(flash: SharedProps['brume']['flash'], url = '/admin/users') {
  vi.mocked(usePage).mockReturnValue({
    url,
    props: { brume: makeShared({ flash }) },
  } as unknown as ReturnType<typeof usePage>);
}

const ui = () => (
  <BrumeLayout registry={registry}>
    <p>內容</p>
  </BrumeLayout>
);

beforeEach(() => vi.mocked(usePage).mockReset());

describe('BrumeLayout flash', () => {
  it('toasts once per flash id', () => {
    setPage({ id: 'f1', type: 'success', message: '已儲存 A' });
    const { rerender } = render(ui());
    setPage({ id: 'f1', type: 'success', message: '已儲存 A' });
    rerender(ui());
    expect(screen.getAllByText('已儲存 A')).toHaveLength(1);

    setPage({ id: 'f2', type: 'success', message: '已儲存 A' });
    rerender(ui());
    expect(screen.getAllByText('已儲存 A')).toHaveLength(2);
  });

  it('maps flash type to the toast kind and ignores null', () => {
    setPage(null);
    const { rerender } = render(ui());
    const before = screen.queryAllByRole('status').length;
    rerender(ui());
    expect(screen.queryAllByRole('status')).toHaveLength(before);
    setPage({ id: 'e1', type: 'error', message: '刪除失敗 B' });
    rerender(ui());
    const item = screen.getByText('刪除失敗 B').closest('[role="status"]');
    expect(item?.querySelector('svg')?.getAttribute('class')).toContain('br:text-danger');
  });

  it('wires AppShell from shared props and keeps the shell mounted across pages', () => {
    setPage(null, '/admin/users');
    const { rerender } = render(ui());
    const mount = document.querySelector('[data-shell-mount]')?.getAttribute('data-shell-mount');
    expect(screen.getByText('內容')).toBeTruthy();
    expect(screen.getByRole('link', { name: '儀表板' })).toBeTruthy();
    setPage(null, '/admin');
    rerender(ui());
    expect(screen.getByRole('link', { name: '儀表板' }).getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('[data-shell-mount]')?.getAttribute('data-shell-mount')).toBe(
      mount,
    );
  });
});

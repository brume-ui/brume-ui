import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MenuAction } from './action-menu';
import { RowContextMenu } from './row-context-menu';

const items = (edit = vi.fn(), del = vi.fn()): MenuAction[] => [
  { key: 'delete', label: '刪除', shortcut: 'Delete', tone: 'danger', onSelect: del },
  { key: 'edit', label: '編輯', shortcut: 'E', onSelect: edit },
];

describe('RowContextMenu', () => {
  it('opens on contextmenu with the same ordered items as ActionMenu', async () => {
    render(
      <RowContextMenu items={items()}>
        <div data-testid="row">頭皮淨化精華 30ml</div>
      </RowContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('row'));
    const menu = await screen.findByRole('menu');
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['編輯E', '刪除⌫']);
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  it('runs items by click and by shortcut', async () => {
    const edit = vi.fn();
    const del = vi.fn();
    const user = userEvent.setup();
    render(
      <RowContextMenu items={items(edit, del)}>
        <div data-testid="row">列</div>
      </RowContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('row'));
    await user.click(await screen.findByRole('menuitem', { name: /編輯/ }));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.contextMenu(screen.getByTestId('row'));
    await screen.findByRole('menu');
    await user.keyboard('{Delete}');
    expect(del).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

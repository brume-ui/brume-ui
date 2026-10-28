import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuAction } from './action-menu';
import { RowContextMenu } from './row-context-menu';

const items = (edit = vi.fn(), del = vi.fn()): MenuAction[] => [
  { key: 'delete', label: '刪除', shortcut: 'Delete', tone: 'danger', onSelect: del },
  { key: 'edit', label: '編輯', shortcut: 'E', onSelect: edit },
];

/** A row with a link, two text fields and content portaled out of it. */
function Row() {
  return (
    <RowContextMenu items={items()}>
      <div data-testid="row">
        <span data-testid="text">ORD-0001</span>
        <a href="/orders/1">ORD-0001</a>
        <input aria-label="名稱" />
        <textarea aria-label="備註" />
        {createPortal(<div data-testid="portaled">彈出內容</div>, document.body)}
      </div>
    </RowContextMenu>
  );
}

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

  describe('keeps the native menu', () => {
    afterEach(() => window.getSelection()?.removeAllRanges());

    it.each([
      ['an input', () => screen.getByRole('textbox', { name: '名稱' })],
      ['a textarea', () => screen.getByRole('textbox', { name: '備註' })],
      ['a link', () => screen.getByRole('link')],
      ['content portaled out of the row', () => screen.getByTestId('portaled')],
    ])('on %s', (_name, target) => {
      render(<Row />);
      // fireEvent returns false when the default (the native menu) was prevented.
      expect(fireEvent.contextMenu(target())).toBe(true);
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('on selected text, judged by the selection before the press', async () => {
      render(<Row />);
      const text = screen.getByTestId('text');
      const range = document.createRange();
      range.selectNodeContents(text);
      window.getSelection()?.addRange(range);
      fireEvent.pointerDown(text, { button: 2 });
      expect(fireEvent.contextMenu(text)).toBe(true);
      expect(screen.queryByRole('menu')).toBeNull();

      // A selection made by the press itself does not count.
      window.getSelection()?.removeAllRanges();
      fireEvent.pointerDown(text, { button: 2 });
      window.getSelection()?.addRange(range);
      expect(fireEvent.contextMenu(text)).toBe(false);
      expect(await screen.findByRole('menu')).toBeTruthy();
    });

    it('but plain row content still opens the row menu', async () => {
      render(<Row />);
      expect(fireEvent.contextMenu(screen.getByTestId('text'))).toBe(false);
      expect(await screen.findByRole('menu')).toBeTruthy();
    });

    it('and does not start the touch long-press on a link', () => {
      vi.useFakeTimers();
      try {
        render(<Row />);
        fireEvent.pointerDown(screen.getByRole('link'), { pointerType: 'touch' });
        vi.advanceTimersByTime(800);
        expect(screen.queryByRole('menu')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

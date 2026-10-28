import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu, formatShortcut, type MenuAction, orderMenuItems } from './action-menu';

function actions(over: Partial<Record<string, () => void>> = {}): MenuAction[] {
  return [
    {
      key: 'delete',
      label: '刪除',
      icon: Trash2,
      shortcut: 'Delete',
      tone: 'danger',
      onSelect: over.delete ?? vi.fn(),
    },
    { key: 'edit', label: '編輯', icon: Pencil, shortcut: 'E', onSelect: over.edit ?? vi.fn() },
    { key: 'copy', label: '複製一份', icon: Copy, shortcut: 'D', onSelect: over.copy ?? vi.fn() },
    {
      key: 'view',
      label: '查看詳情',
      icon: Eye,
      shortcut: 'Enter',
      onSelect: over.view ?? vi.fn(),
    },
  ];
}

describe('orderMenuItems', () => {
  it('moves danger items last, after one separator, keeping relative order', () => {
    const a = (key: string, tone?: 'danger'): MenuAction => ({
      key,
      label: key,
      tone,
      onSelect() {},
    });
    const ordered = orderMenuItems([a('x', 'danger'), a('b'), a('y', 'danger'), a('c')]);
    expect(ordered.map((i) => (i === 'separator' ? '|' : i.key))).toEqual([
      'b',
      'c',
      '|',
      'x',
      'y',
    ]);
  });

  it('adds no separator when there is nothing on one side', () => {
    const a = (key: string, tone?: 'danger'): MenuAction => ({
      key,
      label: key,
      tone,
      onSelect() {},
    });
    expect(orderMenuItems([a('b'), a('c')])).not.toContain('separator');
    expect(orderMenuItems([a('x', 'danger')])).not.toContain('separator');
  });
});

describe('formatShortcut', () => {
  it('shows Enter as ↵ and Delete / Backspace as ⌫', () => {
    expect(formatShortcut('Enter')).toBe('↵');
    expect(formatShortcut('Delete')).toBe('⌫');
    expect(formatShortcut('Backspace')).toBe('⌫');
    expect(formatShortcut('e')).toBe('E');
  });
});

describe('ActionMenu', () => {
  it('opens with Enter, moves with ArrowDown and selects with Enter', async () => {
    const copy = vi.fn();
    const user = userEvent.setup();
    render(<ActionMenu label="王小明 的更多操作" items={actions({ copy })} />);
    const trigger = screen.getByRole('button', { name: '王小明 的更多操作' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    // Danger last, after a separator; shortcuts shown as <kbd>.
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      '編輯E',
      '複製一份D',
      '查看詳情↵',
      '刪除⌫',
    ]);
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: /刪除/ }).querySelector('kbd')?.textContent).toBe(
      '⌫',
    );
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(copy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs an item by its shortcut while open and returns focus to the trigger', async () => {
    const edit = vi.fn();
    const user = userEvent.setup();
    render(<ActionMenu label="更多操作" items={actions({ edit })} />);
    const trigger = screen.getByRole('button', { name: '更多操作' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('e');
    expect(edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('runs a Delete shortcut with Backspace too, but never a disabled item', async () => {
    const del = vi.fn();
    const user = userEvent.setup();
    const items = actions({ delete: del });
    render(<ActionMenu label="更多操作" items={items} />);
    screen.getByRole('button', { name: '更多操作' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('{Backspace}');
    expect(del).toHaveBeenCalledTimes(1);

    const off = vi.fn();
    render(
      <ActionMenu
        label="停用"
        items={[{ key: 'e', label: '編輯', shortcut: 'E', disabled: true, onSelect: off }]}
      />,
    );
    screen.getByRole('button', { name: '停用' }).focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('e');
    expect(off).not.toHaveBeenCalled();
  });
});

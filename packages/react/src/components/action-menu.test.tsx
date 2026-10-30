import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Copy, Eye, Pencil, Trash2 } from 'lucide-react';
import { StrictMode, useState } from 'react';
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

function ValidatingForm({ selected }: { selected(): void }) {
  const [error, setError] = useState(false);
  return (
    <>
      <input aria-label="Quick customer" onBlur={() => setError(true)} />
      {error ? <p role="alert">Customer required</p> : null}
      <ActionMenu
        label="Order actions"
        items={[{ key: 'cancel', label: 'Cancel order', onSelect: selected }]}
      />
    </>
  );
}

describe('ActionMenu', () => {
  it('does not select an item moved under the opening pointer by blur validation', async () => {
    const user = userEvent.setup();
    const selected = vi.fn();
    render(<ValidatingForm selected={selected} />);
    screen.getByRole('textbox', { name: 'Quick customer' }).focus();
    const trigger = screen.getByRole('button', { name: 'Order actions' });
    await user.pointer({
      target: trigger,
      keys: '[MouseLeft>]',
      coords: { clientX: 120, clientY: 80 },
    });
    expect(screen.getByRole('alert', { hidden: true }).textContent).toBe('Customer required');
    const item = screen.getByRole('menuitem', { name: 'Cancel order' });
    // The browser trace retargets the release after blur inserts an error above the row.
    await user.pointer({
      target: item,
      keys: '[/MouseLeft]',
      coords: { clientX: 120, clientY: 80 },
    });
    expect(selected).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.click(item);
    await waitFor(() => expect(selected).toHaveBeenCalledTimes(1));
  });

  it('still selects a menu item after a deliberate drag from the opening trigger', async () => {
    const user = userEvent.setup();
    const selected = vi.fn();
    render(<ActionMenu label="Drag actions" items={actions({ copy: selected })} />);
    await user.pointer({
      target: screen.getByRole('button', { name: 'Drag actions' }),
      keys: '[MouseLeft>]',
      coords: { clientX: 120, clientY: 80 },
    });
    await user.pointer({
      target: screen.getByRole('menuitem', { name: '複製一份' }),
      keys: '[/MouseLeft]',
      coords: { clientX: 140, clientY: 140 },
    });
    await waitFor(() => expect(selected).toHaveBeenCalledTimes(1));
  });

  it.each(['{Enter}', ' '])('opens and selects with %s, moving with ArrowDown', async (key) => {
    const copy = vi.fn();
    const user = userEvent.setup();
    render(<ActionMenu label="王小明 的更多操作" items={actions({ copy })} />);
    const trigger = screen.getByRole('button', { name: '王小明 的更多操作' });
    trigger.focus();
    await user.keyboard(key);
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
    const keys = (name: RegExp) =>
      screen.getByRole('menuitem', { name }).getAttribute('aria-keyshortcuts');
    expect(keys(/編輯/)).toBe('E');
    expect(keys(/刪除/)).toBe('Delete Backspace');
    // Enter activates the highlighted item inside the menu, so it is not announced as a shortcut.
    expect(keys(/查看詳情/)).toBeNull();
    await user.keyboard('{ArrowDown}');
    await user.keyboard(key);
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

it('runs a selected action after restoring the connected menu trigger', async () => {
  const user = userEvent.setup();
  let focusedAtSelect: Element | null = null;
  const selected = vi.fn(() => {
    focusedAtSelect = document.activeElement;
  });
  render(<ActionMenu label="Edit actions" items={actions({ edit: selected })} />);
  const trigger = screen.getByRole('button', { name: 'Edit actions' });
  await user.click(trigger);
  await user.keyboard('e');
  await waitFor(() => expect(selected).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('menu')).toBeNull();
  expect(focusedAtSelect).toBe(trigger);
});

function UnmountOnAction({ selected }: { selected(): void }) {
  const [visible, setVisible] = useState(true);
  return visible ? (
    <ActionMenu
      label="Strict actions"
      items={actions({
        edit: () => {
          selected();
          setVisible(false);
        },
      })}
    />
  ) : (
    <p>Action completed</p>
  );
}

it('does not select on Escape or outside dismissal, and consumes selection once before unmount in StrictMode', async () => {
  const user = userEvent.setup();
  const selected = vi.fn();
  render(
    <StrictMode>
      <UnmountOnAction selected={selected} />
    </StrictMode>,
  );
  const trigger = screen.getByRole('button', { name: 'Strict actions' });
  await user.click(trigger);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(selected).not.toHaveBeenCalled();
  await user.click(trigger);
  fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(selected).not.toHaveBeenCalled();
  await user.click(trigger);
  await user.keyboard('e');
  await screen.findByText('Action completed');
  expect(selected).toHaveBeenCalledTimes(1);
});

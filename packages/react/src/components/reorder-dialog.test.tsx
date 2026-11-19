import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ReorderDialog, type ReorderDialogProps } from './reorder-dialog';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const ITEMS = [
  { id: 'a', label: '甲' },
  { id: 'b', label: '乙' },
  { id: 'c', label: '丙' },
];

function mount(props: Partial<ReorderDialogProps> = {}) {
  const onSave = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <ReorderDialog
        open
        onOpenChange={onOpenChange}
        title="調整順序"
        items={ITEMS}
        onSave={onSave}
        {...props}
      />
    </BrumeProvider>,
  );
  return { onSave, onOpenChange };
}

const order = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => ITEMS.find((i) => li.textContent?.includes(i.label))?.label);

describe('ReorderDialog', () => {
  const originalRect = Element.prototype.getBoundingClientRect;
  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalRect;
  });

  it('shows a skeleton while items are null', () => {
    mount({ items: null });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByRole('dialog').querySelector('[aria-busy="true"]')).toBeTruthy();
    expect((screen.getByRole('button', { name: '儲存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('move to top and bottom reorder the list', async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.queryByRole('button', { name: '置頂：甲' })).toBeNull();
    expect(screen.queryByRole('button', { name: '置底：丙' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '置頂：丙' }));
    expect(order()).toEqual(['丙', '甲', '乙']);
    await user.click(screen.getByRole('button', { name: '置底：丙' }));
    expect(order()).toEqual(['甲', '乙', '丙']);
  });

  it('keyboard drag reorders', async () => {
    // jsdom lays nothing out: give each list item its own 40px slot so dnd-kit can step between them.
    Element.prototype.getBoundingClientRect = function rect(this: Element) {
      const parent = this.parentElement;
      const index =
        this.tagName === 'LI' && parent?.tagName === 'OL'
          ? Array.from(parent.children).indexOf(this)
          : 0;
      return {
        x: 0,
        y: index * 40,
        top: index * 40,
        bottom: index * 40 + 40,
        left: 0,
        right: 400,
        width: 400,
        height: 40,
        toJSON: () => ({}),
      } as DOMRect;
    };
    window.scrollTo = vi.fn() as never;
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    mount();
    screen.getByRole('button', { name: '拖曳排序：甲' }).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard(' ');
    await waitFor(() => expect(order()).toEqual(['乙', '甲', '丙']));
  });

  it('save sends the ids in the new order', async () => {
    const user = userEvent.setup();
    const { onSave } = mount();
    await user.click(screen.getByRole('button', { name: '置底：甲' }));
    await user.click(screen.getByRole('button', { name: '儲存' }));
    expect(onSave).toHaveBeenCalledWith(['b', 'c', 'a']);
  });

  it('save is disabled until the order changes', async () => {
    const user = userEvent.setup();
    mount();
    const save = screen.getByRole('button', { name: '儲存' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '置頂：乙' }));
    expect((save as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: '置頂：甲' }));
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancel closes without saving', async () => {
    const user = userEvent.setup();
    const { onSave, onOpenChange } = mount();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows the error and keeps the list usable; saving disables save', async () => {
    const user = userEvent.setup();
    mount({ error: '儲存失敗', saving: true });
    expect(screen.getByRole('alert').textContent).toContain('儲存失敗');
    await user.click(screen.getByRole('button', { name: '置底：甲' }));
    expect(order()).toEqual(['乙', '丙', '甲']);
    expect((screen.getByRole('button', { name: /儲存/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

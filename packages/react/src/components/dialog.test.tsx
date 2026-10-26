import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ConfirmHost } from './confirm';
import { Dialog } from './dialog';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function Wrapped({
  dirty,
  onOpenChange,
  onSave,
  maximizable,
  size,
}: {
  dirty?: boolean;
  onOpenChange?: (o: boolean) => void;
  onSave?: () => void;
  maximizable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [open, setOpen] = useState(false);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <button type="button" onClick={() => setOpen(true)}>
        開啟
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          onOpenChange?.(o);
          setOpen(o);
        }}
        title="編輯文章"
        description="修改內容"
        dirty={dirty}
        maximizable={maximizable}
        size={size}
        footer={
          <button type="submit" onClick={onSave}>
            儲存文章
          </button>
        }
      >
        <input aria-label="標題" />
      </Dialog>
      <ConfirmHost />
    </BrumeProvider>
  );
}

describe('Dialog', () => {
  it('moves focus inside, is modal, and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Wrapped />);
    const trigger = screen.getByRole('button', { name: '開啟' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '編輯文章' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('applies size widths and rounded dialog radius', async () => {
    const user = userEvent.setup();
    render(<Wrapped size="lg" />);
    await user.click(screen.getByRole('button', { name: '開啟' }));
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain('br:w-[880px]');
    expect(cls).toContain('br:rounded-dialog');
    expect(cls).toContain('br:shadow-overlay');
  });

  it('maximizes via the IconButton', async () => {
    const user = userEvent.setup();
    render(<Wrapped maximizable />);
    await user.click(screen.getByRole('button', { name: '開啟' }));
    await user.click(screen.getByRole('button', { name: '放大' }));
    expect(screen.getByRole('dialog').className).toContain('br:w-[calc(100vw-48px)]');
    expect(screen.getByRole('button', { name: '還原大小' })).toBeTruthy();
  });

  it('closes immediately when not dirty', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Wrapped onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: '開啟' }));
    await user.click(screen.getByRole('button', { name: '關閉' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('dirty: Esc asks first; cancel keeps it open, discard closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Wrapped dirty onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: '開啟' }));
    onOpenChange.mockClear();

    await user.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog', { name: '放棄未儲存的變更？' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('dialog', { name: '編輯文章' })).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await user.click(await screen.findByRole('button', { name: '放棄變更' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('dirty: the close button also asks first', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Wrapped dirty onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: '開啟' }));
    onOpenChange.mockClear();
    await user.click(screen.getByRole('button', { name: '關閉' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' })); // settle the pending confirm
  });

  it('Ctrl+Enter and Cmd+Enter click the primary footer button', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<Wrapped onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: '開啟' }));
    await user.click(screen.getByLabelText('標題'));
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('hidden inputs do not break initial focus', async () => {
    const user = userEvent.setup();
    render(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <button type="button">外面</button>
        <Dialog open onOpenChange={() => {}} title="表單">
          <input type="hidden" name="_token" />
          <input aria-label="名稱" />
        </Dialog>
      </BrumeProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true),
    );
    expect(document.activeElement).toBe(screen.getByLabelText('名稱'));
    void user;
  });

  it('a dialog with no focusable body focuses the container and closes on first Esc', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <Dialog open onOpenChange={onOpenChange} title="說明">
          <p>只有文字</p>
        </Dialog>
      </BrumeProvider>,
    );
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

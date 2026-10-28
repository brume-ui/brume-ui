import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import { Popover } from './popover';

describe('Popover', () => {
  it('opens from the trigger, is named by its title, and Esc returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<Button variant="secondary">篩選</Button>} title="篩選條件">
        <input aria-label="名稱" />
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: '篩選' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '篩選條件' });
    expect(dialog).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '篩選條件' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('tells onEscapeKeyDown before Esc closes it', async () => {
    const user = userEvent.setup();
    const onEscapeKeyDown = vi.fn();
    render(
      <Popover
        trigger={<Button variant="secondary">篩選</Button>}
        onEscapeKeyDown={onEscapeKeyDown}
      >
        <input aria-label="名稱" />
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: '篩選' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

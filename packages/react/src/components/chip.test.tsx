import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './chip';

describe('Chip', () => {
  it('shows label and value, and the ✕ button is named by removeLabel', async () => {
    const onRemove = vi.fn();
    render(<Chip label="狀態" value="上架" removeLabel="移除篩選：狀態" onRemove={onRemove} />);
    expect(screen.getByText('狀態')).toBeTruthy();
    expect(screen.getByText('上架')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '移除篩選：狀態' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

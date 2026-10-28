import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CellEditButton, CellError } from './cell-edit';

describe('CellEditButton', () => {
  it('is a plain button (not a submit) that announces a pending save', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <CellEditButton aria-label="編輯客戶：Ada" onClick={onClick}>
        Ada
      </CellEditButton>,
    );
    const button = screen.getByRole('button', { name: '編輯客戶：Ada' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('aria-busy')).toBe(false);
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <CellEditButton aria-label="編輯客戶：Ada" pending>
        Ada
      </CellEditButton>,
    );
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});

describe('CellError', () => {
  it('is an alert with the given id', () => {
    render(<CellError id="e1">客戶不能超過 5 個字</CellError>);
    const alert = screen.getByRole('alert');
    expect(alert.id).toBe('e1');
    expect(alert.textContent).toBe('客戶不能超過 5 個字');
  });
});

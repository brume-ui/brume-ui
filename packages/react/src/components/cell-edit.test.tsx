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

  it('a badge value drops the dashed underline: the pill is the affordance, with a hover ring', () => {
    render(
      <CellEditButton aria-label="編輯狀態：已付款" variant="badge">
        已付款
      </CellEditButton>,
    );
    const button = screen.getByRole('button', { name: '編輯狀態：已付款' });
    expect(button.className).not.toContain('br:decoration-dashed');
    expect(button.className).toContain('br:hover:outline-solid');
  });
});

describe('CellError', () => {
  it('is an alert with the given id', () => {
    render(<CellError id="e1">客戶不能超過 5 個字</CellError>);
    const alert = screen.getByRole('alert');
    expect(alert.id).toBe('e1');
    expect(alert.textContent).toBe('客戶不能超過 5 個字');
  });

  it('stays on one line (ellipsis) with the full text in its title and its content', () => {
    render(<CellError id="e1">客戶名稱最多 10 個字，請縮短後再儲存。</CellError>);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('br:truncate');
    expect(alert.getAttribute('title')).toBe('客戶名稱最多 10 個字，請縮短後再儲存。');
  });
});

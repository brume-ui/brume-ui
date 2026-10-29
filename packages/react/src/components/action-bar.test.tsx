import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionBar } from './action-bar';

describe('ActionBar', () => {
  it('renders the label and the actions in a named region', () => {
    render(
      <ActionBar aria-label="批次操作" label="已選取 3 筆">
        <button type="button">刪除</button>
      </ActionBar>,
    );
    const bar = screen.getByRole('region', { name: '批次操作' });
    expect(within(bar).getByText('已選取 3 筆').className).toContain('br:font-semibold');
    expect(within(bar).getByRole('button', { name: '刪除' })).toBeTruthy();
  });

  it('renders without a label', () => {
    render(
      <ActionBar aria-label="操作">
        <button type="button">儲存</button>
      </ActionBar>,
    );
    const bar = screen.getByRole('region', { name: '操作' });
    expect(bar.querySelectorAll('p')).toHaveLength(0);
  });

  it('sticks to the top or the bottom', () => {
    const { rerender } = render(
      <ActionBar aria-label="操作" sticky="bottom">
        x
      </ActionBar>,
    );
    const bar = () => screen.getByRole('region', { name: '操作' });
    expect(bar().className).toContain('br:sticky');
    expect(bar().className).toContain('br:bottom-0');
    rerender(
      <ActionBar aria-label="操作" sticky="top">
        x
      </ActionBar>,
    );
    expect(bar().className).toContain('br:top-0');
    rerender(<ActionBar aria-label="操作">x</ActionBar>);
    expect(bar().className).not.toContain('br:sticky');
  });
});

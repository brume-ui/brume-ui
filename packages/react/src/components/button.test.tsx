import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('loading disables, sets aria-busy and swallows clicks', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        登入
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps label in layout while loading so width does not jump', () => {
    render(<Button loading>登入</Button>);
    expect(screen.getByText('登入').className).toContain('br:opacity-0');
  });

  it('fires onClick when idle and has no aria-busy', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>登入</Button>);
    fireEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps its accessible name while loading', () => {
    render(<Button loading>登入</Button>);
    expect(screen.getByRole('button', { name: '登入' })).toBeTruthy();
  });
});

describe('Button count', () => {
  it('shows a count after the label in the accent colour, only when positive', () => {
    const { rerender } = render(<Button variant="secondary">篩選</Button>);
    expect(screen.getByRole('button').querySelector('[data-count]')).toBeNull();
    rerender(
      <Button variant="secondary" count={0}>
        篩選
      </Button>,
    );
    expect(screen.getByRole('button').querySelector('[data-count]')).toBeNull();
    rerender(
      <Button variant="secondary" count={2}>
        篩選
      </Button>,
    );
    const count = screen.getByRole('button').querySelector('[data-count]');
    expect(count?.textContent).toBe('2');
    expect(count?.className).toContain('br:text-accent');
  });

  it('reads the count through countLabel instead of the bare number', () => {
    render(
      <Button variant="secondary" count={2} countLabel="，已套用 2 個">
        篩選
      </Button>,
    );
    const button = screen.getByRole('button', { name: '篩選，已套用 2 個' });
    expect(button.querySelector('[data-count]')?.getAttribute('aria-hidden')).toBe('true');
  });
});

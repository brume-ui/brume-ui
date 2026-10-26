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
    expect(screen.getByText('登入').className).toContain('br:invisible');
  });

  it('fires onClick when idle and has no aria-busy', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>登入</Button>);
    fireEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').hasAttribute('aria-busy')).toBe(false);
  });
});

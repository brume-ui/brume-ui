import { render, screen } from '@testing-library/react';
import { Trash2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('is findable by its label with no visible text', () => {
    render(<IconButton icon={Trash2} label="刪除" />);
    const btn = screen.getByRole('button', { name: '刪除' });
    expect(btn.textContent).toBe('');
  });
});

describe('IconButton active', () => {
  it('takes the accent tint only while active', () => {
    const { rerender } = render(<IconButton icon={Trash2} label="篩選" />);
    const btn = screen.getByRole('button', { name: '篩選' });
    expect(btn.className).not.toContain('br:bg-accent-tint');
    rerender(<IconButton icon={Trash2} label="篩選" active />);
    expect(btn.className).toContain('br:bg-accent-tint');
    expect(btn.className).toContain('br:text-accent-tint-text');
    expect(btn.hasAttribute('active')).toBe(false);
  });
});

describe('IconButton size', () => {
  it('is 40px by default and 26px when small', () => {
    const { rerender } = render(<IconButton icon={Trash2} label="篩選" />);
    const btn = screen.getByRole('button', { name: '篩選' });
    expect(btn.className).toContain('br:size-10');
    rerender(<IconButton icon={Trash2} label="篩選" size="sm" />);
    expect(btn.className).toContain('br:size-[26px]');
    expect(btn.className).not.toContain('br:size-10');
  });
});

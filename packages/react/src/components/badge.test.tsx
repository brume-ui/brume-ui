import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('maps each tone to its token colours', () => {
    const { rerender } = render(<Badge tone="success">已付款</Badge>);
    const pill = () => screen.getByText('已付款');
    expect(pill().getAttribute('data-tone')).toBe('success');
    expect(pill().className).toContain('br:text-success');
    rerender(<Badge tone="accent">已付款</Badge>);
    expect(pill().className).toContain('br:bg-accent-tint');
    expect(pill().className).toContain('br:text-accent-tint-text');
    rerender(<Badge>已付款</Badge>);
    expect(pill().getAttribute('data-tone')).toBe('neutral');
    expect(pill().className).toContain('br:text-text-muted');
  });

  it('count badges use tabular numbers', () => {
    render(
      <Badge tone="danger" count>
        12
      </Badge>,
    );
    expect(screen.getByText('12').className).toContain('br:tabular-nums');
  });

  it('spokenLabel replaces the visible text for screen readers', () => {
    render(<Badge spokenLabel="還有 2 張">+2</Badge>);
    expect(screen.getByText('+2').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('還有 2 張').className).toContain('br:sr-only');
  });
});

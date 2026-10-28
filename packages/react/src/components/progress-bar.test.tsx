import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('exposes value and max, and shows the percentage', () => {
    render(<ProgressBar value={1200} max={10000} label="金額" />);
    const bar = screen.getByRole('progressbar', { name: '金額' });
    expect(bar.getAttribute('aria-valuenow')).toBe('1200');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('10000');
    expect(screen.getByText('12%')).toBeTruthy();
  });

  it('clamps the value to 0…max for the bar and aria-valuenow', () => {
    const { rerender } = render(<ProgressBar value={150} max={100} label="完成度" />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<ProgressBar value={-5} max={100} label="完成度" />);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });
});

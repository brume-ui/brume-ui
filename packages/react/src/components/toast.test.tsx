import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster, toast } from './toast';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
});

describe('toast', () => {
  it('shows in a polite status region without stealing focus', () => {
    render(
      <>
        <button type="button">其他</button>
        <Toaster />
      </>,
    );
    const other = screen.getByRole('button', { name: '其他' });
    other.focus();
    act(() => toast.success('已儲存'));
    expect(screen.getByRole('status').textContent).toContain('已儲存');
    expect(document.querySelector('[data-brume-toaster]')?.getAttribute('aria-live')).toBe(
      'polite',
    );
    expect(document.activeElement).toBe(other);
  });

  it('shows one toast per id', () => {
    render(<Toaster />);
    act(() => {
      toast.info('第一次', { id: 'same' });
      toast.info('第二次', { id: 'same' });
    });
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain('第一次');
  });

  it('disappears after 4 seconds', () => {
    render(<Toaster />);
    act(() => toast.warning('注意'));
    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('pauses while hovered and resumes after', () => {
    render(<Toaster />);
    act(() => toast.error('失敗'));
    const el = screen.getByRole('status');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => {
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('an id can show again after it has gone', () => {
    render(<Toaster />);
    act(() => toast.info('A', { id: 'x' }));
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    act(() => toast.info('B', { id: 'x' }));
    expect(screen.getByRole('status').textContent).toContain('B');
  });
});

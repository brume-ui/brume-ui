import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { clearToasts, Toaster, toast } from './toast';

const render = (ui: ReactElement) =>
  rtlRender(<BrumeProvider adapter={createMemoryAdapter()}>{ui}</BrumeProvider>);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  act(() => {
    if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
    clearToasts();
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
    act(() => toast.info('資訊'));
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

  it('keeps an error toast until it is dismissed', () => {
    render(<Toaster />);
    act(() => toast.error('失敗'));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('status').textContent).toContain('失敗');
  });

  it('removes a toast with its close button', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => toast.error('失敗', { id: 'close-me' }));
    await user.click(screen.getByRole('button', { name: '關閉' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('has a close button on every kind of toast', () => {
    render(<Toaster />);
    act(() => {
      toast.success('a');
      toast.info('b');
      toast.warning('c');
      toast.error('d');
    });
    expect(screen.getAllByRole('button', { name: '關閉' })).toHaveLength(4);
  });

  it('close button is reachable by keyboard and closes with Enter', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <>
        <button type="button">其他</button>
        <Toaster />
      </>,
    );
    act(() => toast.error('失敗', { id: 'kbd' }));
    await user.tab();
    await user.tab();
    const close = screen.getByRole('button', { name: '關閉' });
    expect(document.activeElement).toBe(close);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('pauses while focus is inside the toast and resumes with the remaining time', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Toaster />);
    act(() => toast.info('資訊'));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '關閉' }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => (document.activeElement as HTMLElement).blur());
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
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

  it('stacks newest in front and pauses every toast while the stack is hovered', () => {
    render(<Toaster />);
    act(() => {
      toast.info('舊的');
      toast.info('新的');
    });
    const [older, newer] = screen.getAllByRole('status');
    expect(newer?.dataset.front).toBe('true');
    expect(older?.dataset.front).toBeUndefined();
    const region = document.querySelector('[data-brume-toaster]') as HTMLElement;
    act(() => {
      older?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(region.dataset.expanded).toBe('true');
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('pauses while the tab is hidden', () => {
    render(<Toaster />);
    act(() => toast.success('背景'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole('status')).not.toBeNull();
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a dismissed toast leaves the accessibility tree at once and the DOM after its exit', () => {
    render(<Toaster />);
    act(() => toast.error('失敗', { id: 'exit' }));
    act(() => screen.getByRole('button', { name: '關閉' }).click());
    expect(screen.queryByRole('status')).toBeNull();
    const leaving = document.querySelector('[data-removing]');
    expect(leaving?.getAttribute('aria-hidden')).toBe('true');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(document.querySelector('[data-removing]')).toBeNull();
  });

  it('dismisses on a swipe and snaps back on a short drag', () => {
    render(<Toaster />);
    act(() => toast.error('滑掉我'));
    const el = screen.getByRole('status');
    const drag = (to: number) => {
      fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 100 });
      fireEvent.pointerMove(el, { pointerId: 1, clientX: 100 + to });
      fireEvent.pointerUp(el, { pointerId: 1, clientX: 100 + to });
    };
    // Below the flick minimum: even an instant release snaps back.
    act(() => drag(8));
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => drag(80));
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('[data-removing="swipe"]')).not.toBeNull();
  });
});

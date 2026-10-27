import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Pagination } from './pagination';

const hrefFor = (n: number) => `/items?page=${n}`;
const wrap = (ui: React.ReactNode) =>
  render(<BrumeProvider adapter={createMemoryAdapter()}>{ui}</BrumeProvider>);

function labels() {
  const nav = screen.getByRole('navigation', { name: '分頁' });
  return Array.from(nav.querySelectorAll('li')).map((li) => li.textContent);
}

describe('Pagination', () => {
  it('collapses to 1 … 9 10 11 … 20 for page 10 of 20', () => {
    wrap(<Pagination page={10} lastPage={20} hrefFor={hrefFor} />);
    const nums = labels().filter((t) => t && t !== '上一頁' && t !== '下一頁');
    expect(nums).toEqual(['1', '…', '9', '10', '11', '…', '20']);
  });

  it('does not collapse a small range and has no ellipsis next to the edges', () => {
    wrap(<Pagination page={2} lastPage={4} hrefFor={hrefFor} />);
    expect(labels().filter((t) => /^\d+$/.test(t ?? ''))).toEqual(['1', '2', '3', '4']);
    expect(screen.queryByText('…')).toBeNull();
  });

  it('marks the current page with aria-current and others are real links', () => {
    wrap(<Pagination page={10} lastPage={20} hrefFor={hrefFor} />);
    const current = screen.getByRole('link', { name: '第 10 頁' });
    expect(current.getAttribute('aria-current')).toBe('page');
    const other = screen.getByRole('link', { name: '第 11 頁' });
    expect(other.getAttribute('href')).toBe('/items?page=11');
    expect(other.hasAttribute('aria-current')).toBe(false);
  });

  it('click calls onNavigate(hrefFor(n)) and prevents default', () => {
    const onNavigate = vi.fn();
    wrap(<Pagination page={10} lastPage={20} hrefFor={hrefFor} onNavigate={onNavigate} />);
    const link = screen.getByRole('link', { name: '第 11 頁' });
    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(onNavigate).toHaveBeenCalledWith('/items?page=11');
  });

  it('previous/next link to neighbours and are disabled at the ends', () => {
    const { unmount } = wrap(<Pagination page={1} lastPage={5} hrefFor={hrefFor} />);
    const prev = screen.getByText('上一頁').closest('[aria-disabled]');
    expect(prev?.getAttribute('aria-disabled')).toBe('true');
    expect(prev?.hasAttribute('href')).toBe(false);
    expect(screen.getByRole('link', { name: '下一頁' }).getAttribute('href')).toBe('/items?page=2');
    unmount();
    wrap(<Pagination page={5} lastPage={5} hrefFor={hrefFor} />);
    expect(screen.getByRole('link', { name: '上一頁' }).getAttribute('href')).toBe('/items?page=4');
    expect(screen.getByText('下一頁').closest('[aria-disabled]')).toBeTruthy();
  });

  it('renders nothing when lastPage <= 1', () => {
    const { container } = wrap(<Pagination page={1} lastPage={1} hrefFor={hrefFor} />);
    expect(container.innerHTML).toBe('');
  });

  it('uses a custom landmark label when given', () => {
    wrap(<Pagination page={1} lastPage={3} hrefFor={hrefFor} label="頁尾分頁" />);
    expect(screen.getByRole('navigation', { name: '頁尾分頁' })).toBeTruthy();
  });
});

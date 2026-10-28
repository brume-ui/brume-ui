import { fireEvent, render, screen } from '@testing-library/react';
import { Download } from 'lucide-react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Link } from './link';

function setup(ui: ReactNode) {
  const adapter = createMemoryAdapter('/admin');
  render(<BrumeProvider adapter={adapter}>{ui}</BrumeProvider>);
  return adapter;
}
const visits = (adapter: ReturnType<typeof createMemoryAdapter>) =>
  adapter.calls.filter((c) => c.fn === 'visit');

describe('Link', () => {
  it('is a real link; a plain left click visits through the adapter', () => {
    const adapter = setup(<Link href="/admin/orders/1">訂單 1</Link>);
    const link = screen.getByRole('link', { name: '訂單 1' });
    expect(link.getAttribute('href')).toBe('/admin/orders/1');
    expect(fireEvent.click(link)).toBe(false);
    expect(visits(adapter).map((c) => c.args[0])).toEqual(['/admin/orders/1']);
  });

  it('leaves modified and middle clicks to the browser', () => {
    const adapter = setup(<Link href="/admin/orders/1">訂單 1</Link>);
    const link = screen.getByRole('link');
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(visits(adapter)).toHaveLength(0);
  });

  it('external links open a new tab, say so to screen readers and skip the adapter', () => {
    const adapter = setup(
      <Link href="https://example.com" external>
        官網
      </Link>,
    );
    const link = screen.getByRole('link', { name: '官網（另開新分頁）' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText('（另開新分頁）').className).toContain('br:sr-only');
    fireEvent.click(link);
    expect(visits(adapter)).toHaveLength(0);
  });

  it('links to another origin are native even when not marked external', () => {
    const adapter = setup(<Link href="https://other.example/x">別站</Link>);
    const link = screen.getByRole('link', { name: '別站' });
    expect(link.hasAttribute('target')).toBe(false);
    expect(fireEvent.click(link)).toBe(true);
    expect(visits(adapter)).toHaveLength(0);
  });

  it('download links are native', () => {
    const adapter = setup(
      <Link href="/files/a.pdf" download="a.pdf" iconStart={Download}>
        a.pdf
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'a.pdf' });
    expect(link.getAttribute('download')).toBe('a.pdf');
    expect(fireEvent.click(link)).toBe(true);
    expect(visits(adapter)).toHaveLength(0);
  });

  it('button variant takes the Button look', () => {
    setup(
      <Link href="/admin/new" variant="button" buttonVariant="primary">
        新增
      </Link>,
    );
    expect(screen.getByRole('link').className).toContain('br:bg-accent');
  });
});

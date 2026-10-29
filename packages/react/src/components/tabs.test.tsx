import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Tabs, type TabsProps } from './tabs';

const ITEMS: TabsProps['items'] = [
  { key: 'basic', label: '基本資料' },
  { key: 'price', label: '價格', badge: 'error' },
  { key: 'stock', label: '庫存' },
];

function Harness({ spy }: { spy?(k: string): void }) {
  const [value, setValue] = useState('basic');
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <Tabs
        label="商品"
        items={ITEMS}
        value={value}
        onValueChange={(k) => {
          setValue(k);
          spy?.(k);
        }}
      >
        {(key) => <p>panel {key}</p>}
      </Tabs>
    </BrumeProvider>
  );
}

describe('Tabs', () => {
  it('follows the WAI-ARIA tabs pattern', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: '商品' })).toBeTruthy();
    const tab = screen.getByRole('tab', { name: '基本資料' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.textContent).toBe('panel basic');
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  });

  it('arrow keys move focus without switching; Enter switches', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const first = screen.getByRole('tab', { name: '基本資料' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = screen.getByRole('tab', { name: /^價格/ });
    // Radix moves roving focus on the next task.
    await waitFor(() => expect(document.activeElement).toBe(second));
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('tabpanel').textContent).toBe('panel basic');
    fireEvent.keyDown(second, { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith('price');
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('panel price');
  });

  it('Space switches too', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const first = screen.getByRole('tab', { name: '基本資料' });
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    const last = screen.getByRole('tab', { name: '庫存' });
    await waitFor(() => expect(document.activeElement).toBe(last));
    expect(spy).not.toHaveBeenCalled();
    fireEvent.keyDown(last, { key: ' ' });
    expect(spy).toHaveBeenLastCalledWith('stock');
    expect(screen.getByRole('tabpanel').textContent).toBe('panel stock');
  });

  it('every panel stays mounted, the others hidden; each tab controls an existing panel', () => {
    render(<Harness />);
    for (const tab of screen.getAllByRole('tab')) {
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.hidden).toBe(tab.getAttribute('aria-selected') !== 'true');
    }
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);
  });

  it('a tab with badge "error" says so in its name', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: '價格（有錯誤）' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '庫存' })).toBeTruthy();
  });
});

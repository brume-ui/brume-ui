import type { OptionItem } from '@brume-ui/brume-schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { Combobox, type ComboboxLoader, type ComboboxProps } from './combobox';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const opts = (...labels: string[]): OptionItem[] =>
  labels.map((label) => ({ value: label.toLowerCase(), label }));

function Harness(
  props: Omit<ComboboxProps, 'value' | 'onChange'> & {
    initial: string | string[];
    spy?(v: string | string[]): void;
  },
) {
  const { initial, spy, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <Combobox
        {...rest}
        value={value}
        onChange={(v) => {
          setValue(v);
          spy?.(v);
        }}
      />
    </BrumeProvider>
  );
}

const flush = () => act(async () => {});

describe('Combobox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('follows the ARIA combobox pattern with local options', async () => {
    const spy = vi.fn();
    render(
      <Harness label="城市" initial="" spy={spy} options={opts('Taipei', 'Tainan', 'Kaohsiung')} />,
    );
    const input = screen.getByRole('combobox', { name: '城市' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.change(input, { target: { value: 'tai' } });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox', { name: '城市' });
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Taipei', 'Tainan']);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const active = input.getAttribute('aria-activedescendant');
    expect(active && document.getElementById(active)?.textContent).toBe('Tainan');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(spy).toHaveBeenCalledWith('tainan');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect((input as HTMLInputElement).value).toBe('Tainan');
  });

  it('remote mode loads page 1 after a 250ms pause, then page 2 from 「載入更多」', async () => {
    const load = vi.fn<ComboboxLoader>(async ({ page }) =>
      page === 1
        ? { options: opts('Ada', 'Adam'), hasMore: true }
        : { options: opts('Adele'), hasMore: false },
    );
    render(<Harness label="使用者" initial="" load={load} />);
    const input = screen.getByRole('combobox', { name: '使用者' });
    fireEvent.change(input, { target: { value: 'a' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: 'ad' } });
    act(() => vi.advanceTimersByTime(249));
    expect(load).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ q: 'ad', page: 1 });
    await flush();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ada', 'Adam']);
    fireEvent.click(screen.getByRole('button', { name: '載入更多' }));
    expect(load).toHaveBeenLastCalledWith({ q: 'ad', page: 2 });
    await flush();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Ada',
      'Adam',
      'Adele',
    ]);
    expect(screen.queryByRole('button', { name: '載入更多' })).toBeNull();
  });

  it('discards a stale response that arrives after a newer one', async () => {
    const first = deferred<{ options: OptionItem[]; hasMore: boolean }>();
    const second = deferred<{ options: OptionItem[]; hasMore: boolean }>();
    const load = vi
      .fn<ComboboxLoader>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<Harness label="使用者" initial="" load={load} />);
    const input = screen.getByRole('combobox', { name: '使用者' });
    fireEvent.change(input, { target: { value: 'a' } });
    act(() => vi.advanceTimersByTime(250));
    fireEvent.change(input, { target: { value: 'ad' } });
    act(() => vi.advanceTimersByTime(250));
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve({ options: opts('Adam'), hasMore: false }));
    await act(async () => first.resolve({ options: opts('Alice', 'Amy'), hasMore: true }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Adam']);
    expect(screen.queryByRole('button', { name: '載入更多' })).toBeNull();
  });

  it('multiple: shows chips, toggles options and Backspace removes the last chip', async () => {
    const spy = vi.fn();
    render(
      <Harness
        label="標籤"
        multiple
        initial={['red', 'blue']}
        spy={spy}
        options={opts('Red', 'Green', 'Blue')}
      />,
    );
    expect(screen.getByRole('button', { name: '移除「Red」' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '移除「Blue」' })).toBeTruthy();
    const input = screen.getByRole('combobox', { name: '標籤' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getByRole('option', { name: 'Red' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Green' }));
    expect(spy).toHaveBeenLastCalledWith(['red', 'blue', 'green']);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(spy).toHaveBeenLastCalledWith(['red', 'blue']);
    expect(screen.queryByRole('button', { name: '移除「Green」' })).toBeNull();
  });

  it('resolves labels of selected values it has not loaded', async () => {
    const resolveLabels = vi.fn(async (values: string[]) =>
      values.map((value) => ({ value, label: `User ${value}` })),
    );
    const load = vi.fn<ComboboxLoader>(async () => ({ options: [], hasMore: false }));
    render(
      <Harness label="使用者" multiple initial={['7']} load={load} resolveLabels={resolveLabels} />,
    );
    await flush();
    expect(resolveLabels).toHaveBeenCalledWith(['7']);
    expect(screen.getByRole('button', { name: '移除「User 7」' })).toBeTruthy();
  });
});

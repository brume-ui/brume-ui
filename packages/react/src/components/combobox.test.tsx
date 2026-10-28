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
    // aria-controls names the popup even while it is closed.
    const controls = input.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    fireEvent.change(input, { target: { value: 'tai' } });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox', { name: '城市' });
    expect(listbox.id).toBe(controls);
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

  it('does not load while an IME is composing, then loads once after compositionend', async () => {
    const load = vi.fn<ComboboxLoader>(async () => ({ options: opts('Ada'), hasMore: false }));
    render(<Harness label="使用者" initial="" load={load} />);
    const input = screen.getByRole('combobox', { name: '使用者' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄕ' } });
    fireEvent.change(input, { target: { value: 'ㄕˇ' } });
    act(() => vi.advanceTimersByTime(1000));
    expect(load).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '使' } });
    fireEvent.compositionEnd(input, { data: '使' });
    act(() => vi.advanceTimersByTime(249));
    expect(load).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith({ q: '使', page: 1 });
  });

  it('a failed page offers 重試, by mouse or keyboard, which asks for the same page again', async () => {
    const load = vi
      .fn<ComboboxLoader>()
      .mockResolvedValueOnce({ options: opts('Ada', 'Adam'), hasMore: true })
      .mockRejectedValueOnce(new Error('500'))
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce({ options: opts('Adele'), hasMore: false });
    render(<Harness label="使用者" initial="" load={load} />);
    const input = screen.getByRole('combobox', { name: '使用者' });
    fireEvent.change(input, { target: { value: 'ad' } });
    act(() => vi.advanceTimersByTime(250));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '載入更多' }));
    await flush();
    expect(screen.getByRole('status').textContent).toBe('選項載入失敗，請再試一次。');
    expect(screen.queryByRole('button', { name: '載入更多' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    expect(load).toHaveBeenLastCalledWith({ q: 'ad', page: 2 });
    await flush();
    // Keyboard: ↓ past the last option retries too.
    fireEvent.keyDown(input, { key: 'End' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(load).toHaveBeenCalledTimes(4);
    expect(load).toHaveBeenLastCalledWith({ q: 'ad', page: 2 });
    await flush();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Ada',
      'Adam',
      'Adele',
    ]);
    expect(screen.queryByRole('button', { name: '重試' })).toBeNull();
  });

  it('loads the next page when the list is scrolled to its end (once per burst) or ↓ passes the last option', async () => {
    const load = vi.fn<ComboboxLoader>(async ({ page }) => ({
      options: opts(`P${page}a`, `P${page}b`),
      hasMore: page < 3,
    }));
    render(<Harness label="使用者" initial="" load={load} />);
    const input = screen.getByRole('combobox', { name: '使用者' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    act(() => vi.advanceTimersByTime(250));
    await flush();
    const listbox = screen.getByRole('listbox');
    Object.defineProperty(listbox, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(listbox, 'clientHeight', { configurable: true, value: 256 });
    listbox.scrollTop = 140;
    fireEvent.scroll(listbox);
    fireEvent.scroll(listbox);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith({ q: '', page: 2 });
    await flush();
    fireEvent.keyDown(input, { key: 'End' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[3]?.id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(load).toHaveBeenLastCalledWith({ q: '', page: 3 });
    await flush();
    expect(screen.getAllByRole('option')).toHaveLength(6);
  });

  it('closing drops remote results, so reopening shows no stale options', async () => {
    const load = vi.fn<ComboboxLoader>(async ({ q }) => ({
      options: opts(`${q}1`),
      hasMore: false,
    }));
    render(<Harness label="使用者" initial="" load={load} />);
    const input = screen.getByRole('combobox', { name: '使用者' });
    fireEvent.change(input, { target: { value: 'zz' } });
    act(() => vi.advanceTimersByTime(250));
    await flush();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['zz1']);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('載入中');
    act(() => vi.advanceTimersByTime(250));
    await flush();
    expect(load).toHaveBeenLastCalledWith({ q: '', page: 1 });
  });

  it('ArrowUp opens on the last option; Home and End jump; an IME Enter (229) does not select', () => {
    const spy = vi.fn();
    render(
      <Harness label="城市" initial="" spy={spy} options={opts('Taipei', 'Tainan', 'Kaohsiung')} />,
    );
    const input = screen.getByRole('combobox', { name: '城市' });
    const activeText = () =>
      document.getElementById(input.getAttribute('aria-activedescendant') ?? '')?.textContent;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(activeText()).toBe('Kaohsiung');
    fireEvent.keyDown(input, { key: 'Home' });
    expect(activeText()).toBe('Taipei');
    fireEvent.keyDown(input, { key: 'End' });
    expect(activeText()).toBe('Kaohsiung');
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(spy).toHaveBeenCalledWith('kaohsiung');
  });

  it('single mode has a 清除 button that clears the selection', () => {
    const spy = vi.fn();
    render(<Harness label="城市" initial="tainan" spy={spy} options={opts('Taipei', 'Tainan')} />);
    const input = screen.getByRole('combobox', { name: '城市' }) as HTMLInputElement;
    expect(input.value).toBe('Tainan');
    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(spy).toHaveBeenCalledWith('');
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
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

  it('keeps its live region mounted while closed, so the first message is announced', async () => {
    render(<Harness label="城市" initial="" spy={vi.fn()} options={opts('Taipei')} />);
    const live = screen.getByRole('status');
    expect(live.textContent).toBe('');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    // The same element announces, rather than one that mounts together with its text.
    expect(screen.getByRole('status')).toBe(live);
    expect(live.textContent).toBe('沒有符合的選項');
  });
});

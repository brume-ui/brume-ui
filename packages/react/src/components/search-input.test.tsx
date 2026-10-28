import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { SearchInput } from './search-input';

function setup(props: Partial<React.ComponentProps<typeof SearchInput>> = {}) {
  const onSearch = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <SearchInput value="" onSearch={onSearch} placeholder="搜尋" label="搜尋商品" {...props} />
    </BrumeProvider>,
  );
  return { onSearch, input: screen.getByRole('searchbox', { name: '搜尋商品' }) };
}

describe('SearchInput', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('SearchInput debounces and fires once', () => {
    const { onSearch, input } = setup();
    fireEvent.change(input, { target: { value: 'a' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: 'ab' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(input, { target: { value: 'abc' } });
    act(() => vi.advanceTimersByTime(299));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('abc');
  });

  it('clear cancels the pending debounce', () => {
    const { onSearch, input } = setup();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: '清除搜尋' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('button', { name: '清除搜尋' })).toBeNull();
  });

  it('Enter emits immediately and cancels the pending debounce', () => {
    const { onSearch, input } = setup();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('abc');
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('SearchInput does not emit while composing', () => {
    const { onSearch, input } = setup();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄓ' } });
    fireEvent.change(input, { target: { value: 'ㄓㄨ' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '豬' } });
    fireEvent.compositionEnd(input, { data: '豬' });
    act(() => vi.advanceTimersByTime(299));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('豬');
  });

  it('keeps what the user typed on when the parent echoes an earlier search', () => {
    const onSearch = vi.fn();
    const ui = (value: string) => (
      <BrumeProvider adapter={createMemoryAdapter()}>
        <SearchInput value={value} onSearch={onSearch} placeholder="搜尋" label="搜尋" />
      </BrumeProvider>
    );
    const { rerender } = render(ui(''));
    const input = screen.getByRole('searchbox', { name: '搜尋' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(input, { target: { value: 'abcd' } });
    rerender(ui('abc'));
    expect(input.value).toBe('abcd');
    rerender(ui(''));
    expect(input.value).toBe('');
  });

  it('follows a new value from the parent and honours debounceMs', () => {
    const onSearch = vi.fn();
    const ui = (value: string) => (
      <BrumeProvider adapter={createMemoryAdapter()}>
        <SearchInput
          value={value}
          onSearch={onSearch}
          placeholder="搜尋"
          label="搜尋"
          debounceMs={50}
        />
      </BrumeProvider>
    );
    const { rerender } = render(ui('x'));
    const input = screen.getByRole('searchbox', { name: '搜尋' }) as HTMLInputElement;
    expect(input.value).toBe('x');
    rerender(ui('y'));
    expect(input.value).toBe('y');
    fireEvent.change(input, { target: { value: 'yz' } });
    act(() => vi.advanceTimersByTime(50));
    expect(onSearch).toHaveBeenCalledWith('yz');
  });
});

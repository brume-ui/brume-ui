import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { AutocompleteInput, type AutocompleteInputProps } from './autocomplete-input';

function Harness(props: Partial<AutocompleteInputProps> & { onSpy?(v: string): void }) {
  const { onSpy, value: initial, ...rest } = props;
  const [value, setValue] = useState(initial ?? '');
  return (
    <AutocompleteInput
      label="城市"
      {...rest}
      value={value}
      onChange={(v) => {
        onSpy?.(v);
        setValue(v);
      }}
    />
  );
}
function setup(props: Parameters<typeof Harness>[0] = {}) {
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <form onSubmit={(e) => e.preventDefault()}>
        <Harness {...props} />
      </form>
    </BrumeProvider>,
  );
  return screen.getByRole('combobox', { name: '城市' }) as HTMLInputElement;
}
const type = (input: HTMLElement, text: string) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
};
const optionNames = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('AutocompleteInput popup landmark', () => {
  it('the portalled list sits in a named region (axe `region`), not a dialog', () => {
    const input = setup({ options: ['Taipei', 'Taichung'] });
    type(input, 'Tai');
    const region = screen.getByRole('region', { name: '城市：建議' });
    expect(region.contains(screen.getByRole('listbox', { name: '城市' }))).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('AutocompleteInput static options', () => {
  const options = ['Taipei', 'Taichung', 'Tainan', 'Kaohsiung'];

  it('filters by case-insensitive substring and is a list-autocomplete combobox', () => {
    const input = setup({ options });
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    type(input, 'AI');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(optionNames()).toEqual(['Taipei', 'Taichung', 'Tainan']);
    type(input, 'pei');
    expect(optionNames()).toEqual(['Taipei']);
  });

  it('arrow keys move, Enter picks and closes', () => {
    const spy = vi.fn();
    const input = setup({ options, onSpy: spy });
    type(input, 'ta');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Taichung' }).id,
    );
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(spy).toHaveBeenLastCalledWith('Taichung');
    expect(input.value).toBe('Taichung');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('Enter without an active suggestion is left to the form', () => {
    const input = setup({ options });
    type(input, 'ta');
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter' });
    expect(notPrevented).toBe(true);
    expect(input.value).toBe('ta');
  });

  it('Escape closes the list; Tab and blur keep the typed text', () => {
    const input = setup({ options });
    type(input, 'ta');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    type(input, 'tai');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.blur(input);
    expect(input.value).toBe('tai');
  });

  it('a click on a suggestion picks it', () => {
    const input = setup({ options });
    type(input, 'kao');
    fireEvent.click(screen.getByRole('option', { name: 'Kaohsiung' }));
    expect(input.value).toBe('Kaohsiung');
  });

  it('free text that matches nothing stays as typed', () => {
    const spy = vi.fn();
    const input = setup({ options, onSpy: spy });
    type(input, 'Zzz');
    expect(optionNames()).toEqual([]);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(spy).toHaveBeenLastCalledWith('Zzz');
  });

  it('renders at most 50 of 500 suggestions', () => {
    const many = Array.from({ length: 500 }, (_, i) => `city-${i}`);
    const input = setup({ options: many });
    type(input, 'city');
    expect(screen.getAllByRole('option')).toHaveLength(50);
  });

  it('Enter during IME composition neither picks nor submits', () => {
    const spy = vi.fn();
    const input = setup({ options: ['台北', '台中'], onSpy: spy });
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '台' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const notPrevented = fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(notPrevented).toBe(false);
    const safari = fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(safari).toBe(false);
    expect(input.value).toBe('台');
    fireEvent.compositionEnd(input);
  });

  it('applies maxLength and the placeholder', () => {
    const input = setup({ options, maxLength: 12, placeholder: '輸入城市' });
    expect(input.maxLength).toBe(12);
    expect(input.placeholder).toBe('輸入城市');
  });

  it('shows invalid state and describedby', () => {
    const input = setup({ options, 'aria-invalid': true, 'aria-describedby': 'err' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('err');
  });

  it('read-only and disabled never open the list', () => {
    const input = setup({ options, readOnly: true, value: 'Ta' });
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.readOnly).toBe(true);
  });

  it('disabled input is disabled', () => {
    const input = setup({ options, disabled: true });
    expect(input.disabled).toBe(true);
  });
});

describe('AutocompleteInput remote load', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces 250 ms, aborts the previous request and groups results', async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn(async (q: string, signal: AbortSignal) => {
      signals.push(signal);
      return [
        { label: `${q}-1`, group: '甲' },
        { label: `${q}-2`, group: '甲' },
        { label: `${q}-3`, group: '乙' },
      ];
    });
    const input = setup({ load });
    type(input, 'a');
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(load).not.toHaveBeenCalled();
    type(input, 'ab');
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(load).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toBe('ab');
    expect(optionNames()).toEqual(['ab-1', 'ab-2', 'ab-3']);
    expect(screen.getByRole('group', { name: '甲' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '乙' })).toBeTruthy();
    // A further keystroke aborts the request that was in flight.
    type(input, 'abc');
    expect(signals[0]?.aborted).toBe(true);
  });

  it('ignores a stale response and reports a failure', async () => {
    let reject: (e: Error) => void = () => {};
    const load = vi.fn(
      (_q: string, _s: AbortSignal) =>
        new Promise<{ label: string }[]>((_res, rej) => {
          reject = rej;
        }),
    );
    const input = setup({ load });
    type(input, 'x');
    await act(() => vi.advanceTimersByTimeAsync(260));
    await act(async () => reject(new Error('boom')));
    expect(screen.getAllByText('選項載入失敗，請再試一次。').length).toBeGreaterThan(0);
    expect(input.value).toBe('x');
  });

  it('does not load while composing', async () => {
    const load = vi.fn(async () => []);
    const input = setup({ load });
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄊ' } });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(load).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    await act(() => vi.advanceTimersByTimeAsync(260));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('drops an aborted request that resolves late', async () => {
    const resolvers: ((v: { label: string }[]) => void)[] = [];
    const load = vi.fn(
      (_q: string, _s: AbortSignal) =>
        new Promise<{ label: string }[]>((res) => {
          resolvers.push(res);
        }),
    );
    const input = setup({ load });
    type(input, 'a');
    await act(() => vi.advanceTimersByTimeAsync(260));
    type(input, 'ab');
    await act(() => vi.advanceTimersByTimeAsync(260));
    await act(async () => resolvers[0]?.([{ label: 'stale' }]));
    expect(optionNames()).toEqual([]);
    await act(async () => resolvers[1]?.([{ label: 'fresh' }]));
    expect(optionNames()).toEqual(['fresh']);
  });

  it('treats a synchronous throw or a non-promise return as a failure', async () => {
    const load = vi.fn((): Promise<{ label: string }[]> => {
      throw new Error('sync');
    });
    const input = setup({ load });
    type(input, 'x');
    await act(() => vi.advanceTimersByTimeAsync(260));
    expect(screen.getAllByText('選項載入失敗，請再試一次。').length).toBeGreaterThan(0);
    expect(input.value).toBe('x');
  });

  it('treats a non-promise return as a failure', async () => {
    const load = vi.fn(() => undefined as unknown as Promise<{ label: string }[]>);
    const input = setup({ load });
    type(input, 'x');
    await act(() => vi.advanceTimersByTimeAsync(260));
    expect(screen.getAllByText('選項載入失敗，請再試一次。').length).toBeGreaterThan(0);
  });
});

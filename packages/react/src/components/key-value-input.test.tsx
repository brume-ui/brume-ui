import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { KeyValueInput, type KeyValueInputProps, type KeyValuePair } from './key-value-input';

function Harness(props: Partial<KeyValueInputProps> & { onSpy?(v: KeyValuePair[]): void }) {
  const { onSpy, value: initial, ...rest } = props;
  const [value, setValue] = useState<KeyValuePair[]>(initial ?? []);
  return (
    <KeyValueInput
      label="標頭"
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
  return render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <Harness {...props} />
    </BrumeProvider>,
  );
}
const pairs = [
  { key: 'a', value: '1' },
  { key: 'b', value: '2' },
];

describe('KeyValueInput', () => {
  it('shows default 「鍵」／「值」 headers and custom ones', () => {
    const { unmount } = setup({ value: pairs });
    expect(screen.getAllByText('鍵').length).toBeGreaterThan(0);
    expect(screen.getAllByText('值').length).toBeGreaterThan(0);
    unmount();
    setup({ value: pairs, keyLabel: '名稱', valueLabel: '內容' });
    expect(screen.getByLabelText('名稱 1')).toBeTruthy();
    expect(screen.getByLabelText('內容 2')).toBeTruthy();
  });

  it('adds and removes rows without trimming or merging anything', () => {
    const spy = vi.fn();
    setup({ value: [{ key: ' a ', value: '' }], onSpy: spy });
    fireEvent.click(screen.getByRole('button', { name: '新增 標頭' }));
    expect(spy).toHaveBeenLastCalledWith([
      { key: ' a ', value: '' },
      { key: '', value: '' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: '移除 標頭 1' }));
    expect(spy).toHaveBeenLastCalledWith([{ key: '', value: '' }]);
  });

  it('keeps the same input element while a key is edited', () => {
    setup({ value: pairs });
    const before = screen.getByLabelText('鍵 1');
    fireEvent.change(before, { target: { value: 'abc' } });
    expect(screen.getByLabelText('鍵 1')).toBe(before);
    expect((before as HTMLInputElement).value).toBe('abc');
  });

  it('keeps row identity when an earlier row is removed', () => {
    setup({ value: pairs });
    const second = screen.getByLabelText('鍵 2');
    fireEvent.click(screen.getByRole('button', { name: '移除 標頭 1' }));
    expect(screen.getByLabelText('鍵 1')).toBe(second);
  });

  it('disables add at max', () => {
    setup({ value: pairs, max: 2 });
    expect((screen.getByRole('button', { name: '新增 標頭' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('adds a row with Enter in the last value cell and focuses its key', () => {
    const spy = vi.fn();
    setup({ value: pairs, onSpy: spy });
    fireEvent.keyDown(screen.getByLabelText('值 1'), { key: 'Enter' });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('值 2'), { key: 'Enter' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByLabelText('鍵 3'));
  });

  it('does not add on Enter at max or during composition', () => {
    const spy = vi.fn();
    setup({ value: pairs, max: 2, onSpy: spy });
    fireEvent.keyDown(screen.getByLabelText('值 2'), { key: 'Enter' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not add on an IME Enter', () => {
    const spy = vi.fn();
    setup({ value: pairs, onSpy: spy });
    const ev = fireEvent.keyDown(screen.getByLabelText('值 2'), { key: 'Enter', keyCode: 229 });
    expect(spy).not.toHaveBeenCalled();
    expect(ev).toBe(false);
  });

  it('renders a duplicate-key error on that cell and ties it to the input', () => {
    setup({ value: pairs, errors: { 1: { key: '鍵不可重複' }, 0: { value: '值太長' } } });
    const key2 = screen.getByLabelText('鍵 2');
    expect(key2.getAttribute('aria-invalid')).toBe('true');
    const id = key2.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(id)?.textContent).toBe('鍵不可重複');
    expect(screen.getByLabelText('鍵 1').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('值 1').getAttribute('aria-invalid')).toBe('true');
  });

  it('is inert when disabled and has no edit controls when read-only', () => {
    const { unmount } = setup({ value: pairs, disabled: true });
    expect((screen.getByLabelText('鍵 1') as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: '移除 標頭 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    unmount();
    setup({ value: pairs, readOnly: true });
    expect((screen.getByLabelText('鍵 1') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('focuses the neighbour key after a remove, then add when none is left', () => {
    setup({ value: pairs });
    fireEvent.click(screen.getByRole('button', { name: '移除 標頭 1' }));
    expect(document.activeElement).toBe(screen.getByLabelText('鍵 1'));
    fireEvent.click(screen.getByRole('button', { name: '移除 標頭 1' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '新增 標頭' }));
  });

  it('keeps rows and focus when the parent replaces value with an equal-length array', () => {
    const view = controlled(pairs);
    const first = screen.getByLabelText('鍵 1') as HTMLInputElement;
    first.focus();
    view.set([
      { key: 'x', value: 'y' },
      { key: 'z', value: 'w' },
    ]);
    expect(screen.getByLabelText('鍵 1')).toBe(first);
    expect(first.value).toBe('x');
    expect(document.activeElement).toBe(first);
  });

  it('renders a replacement of different length without crashing', () => {
    const view = controlled(pairs);
    view.set([{ key: 'p', value: 'q' }]);
    expect((screen.getByLabelText('鍵 1') as HTMLInputElement).value).toBe('p');
    expect(screen.queryByLabelText('鍵 2')).toBeNull();
    view.set([...pairs, { key: 'c', value: '3' }, { key: 'd', value: '4' }]);
    expect((screen.getByLabelText('值 4') as HTMLInputElement).value).toBe('4');
  });
});

function Parent({
  initial,
  setter,
}: {
  initial: KeyValuePair[];
  setter: { current(v: KeyValuePair[]): void };
}) {
  const [v, setV] = useState(initial);
  setter.current = setV;
  return <KeyValueInput label="標頭" value={v} onChange={setV} />;
}

function controlled(initial: KeyValuePair[]) {
  const setter = { current: (_: KeyValuePair[]) => {} };
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <Parent initial={initial} setter={setter} />
    </BrumeProvider>,
  );
  return { set: (v: KeyValuePair[]) => act(() => setter.current(v)) };
}

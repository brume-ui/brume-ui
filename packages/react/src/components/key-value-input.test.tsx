import { fireEvent, render, screen } from '@testing-library/react';
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
});

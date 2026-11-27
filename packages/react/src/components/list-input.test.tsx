import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ListInput, type ListInputProps } from './list-input';

function Harness(props: Partial<ListInputProps> & { onSpy?(v: string[]): void }) {
  const { onSpy, value: initial, ...rest } = props;
  const [value, setValue] = useState<string[]>(initial ?? []);
  return (
    <ListInput
      label="網域"
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
const inputs = () => screen.getAllByRole('textbox').map((el) => (el as HTMLInputElement).value);

describe('ListInput', () => {
  it('adds an empty row and keeps it while typing', () => {
    const spy = vi.fn();
    setup({ value: ['a'], onSpy: spy });
    fireEvent.click(screen.getByRole('button', { name: '新增 網域' }));
    expect(spy).toHaveBeenLastCalledWith(['a', '']);
    expect(document.activeElement).toBe(screen.getByLabelText('網域 2'));
    fireEvent.change(screen.getByLabelText('網域 2'), { target: { value: ' ' } });
    expect(spy).toHaveBeenLastCalledWith(['a', ' ']);
  });

  it('removes a row and respects min', () => {
    setup({ value: ['a', 'b'], min: 1 });
    fireEvent.click(screen.getByRole('button', { name: '移除 網域 1' }));
    expect(inputs()).toEqual(['b']);
    expect(
      (screen.getByRole('button', { name: '移除 網域 1' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('disables add at max', () => {
    setup({ value: ['a', 'b'], max: 2 });
    expect((screen.getByRole('button', { name: '新增 網域' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('puts maxLength on each input', () => {
    setup({ value: ['a'], maxLength: 5 });
    expect((screen.getByLabelText('網域 1') as HTMLInputElement).maxLength).toBe(5);
  });

  it('moves rows with the buttons, keeping row identity and focus', () => {
    setup({ value: ['a', 'b', 'c'] });
    const first = screen.getByLabelText('網域 1');
    fireEvent.click(screen.getByRole('button', { name: '下移 網域 1' }));
    expect(inputs()).toEqual(['b', 'a', 'c']);
    expect(screen.getByLabelText('網域 2')).toBe(first);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '下移 網域 2' }));
  });

  it('moves with ArrowUp/ArrowDown on the grip', () => {
    setup({ value: ['a', 'b'] });
    fireEvent.keyDown(screen.getByRole('button', { name: '排序 網域 2' }), { key: 'ArrowUp' });
    expect(inputs()).toEqual(['b', 'a']);
  });

  it('reorders by drag and drop', () => {
    setup({ value: ['a', 'b', 'c'] });
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), effectAllowed: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: '排序 網域 1' }), { dataTransfer });
    const row = screen.getByLabelText('網域 3').closest('li') as HTMLElement;
    const over = createEvent.dragOver(row);
    fireEvent(row, over);
    expect(over.defaultPrevented).toBe(true);
    fireEvent.drop(row, { dataTransfer });
    expect(inputs()).toEqual(['b', 'c', 'a']);
  });

  it('has no move controls when not sortable', () => {
    setup({ value: ['a', 'b'], sortable: false });
    expect(screen.queryByRole('button', { name: /排序|上移|下移/ })).toBeNull();
  });

  it('ties an error to its row input', () => {
    setup({ value: ['a', 'b'], errors: { 1: '太長' } });
    const input = screen.getByLabelText('網域 2');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      '太長',
    );
    expect(screen.getByLabelText('網域 1').getAttribute('aria-invalid')).toBeNull();
  });

  it('disabled and read-only states', () => {
    const { unmount } = setup({ value: ['a', 'b'], disabled: true });
    for (const b of screen.getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('網域 1') as HTMLInputElement).disabled).toBe(true);
    unmount();
    setup({ value: ['a', 'b'], readOnly: true });
    expect((screen.getByLabelText('網域 1') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

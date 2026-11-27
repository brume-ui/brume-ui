import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { DualListbox, type DualListboxProps } from './dual-listbox';

const OPTIONS = [
  { value: 'a', label: '蘋果', group: '水果' },
  { value: 'b', label: '香蕉', group: '水果' },
  { value: 'c', label: '胡蘿蔔', group: '蔬菜' },
  { value: 'd', label: '停用項', disabled: true, group: '蔬菜' },
  { value: 'e', label: '麵包' },
];

function Harness(props: Partial<DualListboxProps> & { onSpy?(v: string[]): void }) {
  const { onSpy, value: initial, ...rest } = props;
  const [value, setValue] = useState<string[]>(initial ?? []);
  return (
    <DualListbox
      label="食物"
      options={OPTIONS}
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
const avail = () => screen.getByRole('listbox', { name: '食物 可選' });
const chosen = () => screen.getByRole('listbox', { name: '食物 已選' });
const names = (box: HTMLElement) =>
  within(box)
    .queryAllByRole('option')
    .map((o) => o.textContent);

describe('DualListbox', () => {
  it('renders two multiselectable listboxes with labelled filters and group headings', () => {
    setup();
    expect(avail().getAttribute('aria-multiselectable')).toBe('true');
    expect(chosen().getAttribute('aria-multiselectable')).toBe('true');
    expect(screen.getByLabelText('篩選食物 可選')).toBeTruthy();
    expect(screen.getByLabelText('篩選食物 已選')).toBeTruthy();
    expect(screen.getByText('水果')).toBeTruthy();
    expect(screen.getByText('蔬菜')).toBeTruthy();
    expect(names(avail())).toHaveLength(5);
  });

  it('moves selected options by button, in selection order, and back', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    fireEvent.click(within(avail()).getByText('香蕉'));
    fireEvent.click(within(avail()).getByText('蘋果'), { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: '加入選取項目' }));
    expect(spy).toHaveBeenLastCalledWith(['a', 'b']);
    expect(names(chosen())).toEqual(['蘋果水果', '香蕉水果']);
    fireEvent.click(within(chosen()).getByText('蘋果'));
    fireEvent.click(screen.getByRole('button', { name: '移除選取項目' }));
    expect(spy).toHaveBeenLastCalledWith(['b']);
  });

  it('disables move buttons when nothing applicable is selected', () => {
    setup();
    const add = screen.getByRole('button', { name: '加入選取項目' }) as HTMLButtonElement;
    const remove = screen.getByRole('button', { name: '移除選取項目' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(remove.disabled).toBe(true);
    fireEvent.click(within(avail()).getByText('蘋果'));
    expect(add.disabled).toBe(false);
    expect((screen.getByRole('button', { name: '全部移除' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('move all respects the filter and never moves disabled options', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    fireEvent.click(screen.getByRole('button', { name: '全部加入' }));
    expect(spy).toHaveBeenLastCalledWith(['a', 'b', 'c', 'e']);
    fireEvent.click(screen.getByRole('button', { name: '全部移除' }));
    expect(spy).toHaveBeenLastCalledWith([]);
    fireEvent.change(screen.getByLabelText('篩選食物 可選'), { target: { value: '香' } });
    fireEvent.click(screen.getByRole('button', { name: '全部加入' }));
    expect(spy).toHaveBeenLastCalledWith(['b']);
  });

  it('a disabled option cannot be selected or moved by double click or Enter', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    const disabled = within(avail()).getByText('停用項').closest('[role=option]') as HTMLElement;
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(disabled);
    expect(disabled.getAttribute('aria-selected')).toBe('false');
    fireEvent.doubleClick(disabled);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a disabled option already in the value cannot be moved back', () => {
    const spy = vi.fn();
    setup({ value: ['d'], onSpy: spy });
    fireEvent.click(screen.getByRole('button', { name: '全部移除' }));
    expect(spy).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: '全部移除' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('double click moves one option', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    fireEvent.doubleClick(within(avail()).getByText('麵包'));
    expect(spy).toHaveBeenLastCalledWith(['e']);
  });

  it('Arrow keys, Space and Enter work from the keyboard', () => {
    const spy = vi.fn();
    setup({ onSpy: spy });
    const box = avail();
    box.focus();
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: ' ' });
    expect(
      within(box).getByText('香蕉').closest('[role=option]')?.getAttribute('aria-selected'),
    ).toBe('true');
    expect(box.getAttribute('aria-activedescendant')).toBe(
      within(box).getByText('香蕉').closest('[role=option]')?.id,
    );
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['b']);
  });

  it('Shift+Arrow extends the selection and Ctrl+A selects every enabled option', () => {
    setup();
    const box = avail();
    fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true });
    expect(
      within(box)
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(3);
    fireEvent.keyDown(box, { key: 'a', ctrlKey: true });
    expect(
      within(box)
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(4);
  });

  it('Shift+click selects a range', () => {
    setup();
    fireEvent.click(within(avail()).getByText('蘋果'));
    fireEvent.click(within(avail()).getByText('胡蘿蔔'), { shiftKey: true });
    expect(
      within(avail())
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(3);
  });

  it('max disables moving more in and truncates an overshooting move', () => {
    const spy = vi.fn();
    setup({ max: 2, onSpy: spy });
    fireEvent.click(screen.getByRole('button', { name: '全部加入' }));
    expect(spy).toHaveBeenLastCalledWith(['a', 'b']);
    expect((screen.getByRole('button', { name: '全部加入' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(within(avail()).getByText('麵包'));
    expect(
      (screen.getByRole('button', { name: '加入選取項目' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.doubleClick(within(avail()).getByText('麵包'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('disabled and readOnly block every move', () => {
    const spy = vi.fn();
    const { unmount } = setup({ readOnly: true, onSpy: spy });
    expect((screen.getByRole('button', { name: '全部加入' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.doubleClick(within(avail()).getByText('蘋果'));
    expect(spy).not.toHaveBeenCalled();
    unmount();
    setup({ disabled: true, onSpy: spy });
    expect(avail().getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByLabelText('篩選食物 可選') as HTMLInputElement).disabled).toBe(true);
  });

  it('leaves unknown ids in the value alone', () => {
    const spy = vi.fn();
    setup({ value: ['gone'], onSpy: spy });
    fireEvent.doubleClick(within(avail()).getByText('蘋果'));
    expect(spy).toHaveBeenLastCalledWith(['gone', 'a']);
  });
});

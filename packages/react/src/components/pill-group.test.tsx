import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PillRadioGroup, PillToggleGroup } from './pill-group';

const options = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
  { value: 'c', label: '丙' },
];

function RadioHarness({ onChange }: { onChange(v: string): void }) {
  const [value, setValue] = useState('a');
  return (
    <PillRadioGroup
      label="範圍"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('PillRadioGroup', () => {
  it('is a named radiogroup of pills; clicking selects', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RadioHarness onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: '範圍' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '甲' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('radio', { name: '丙' }));
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(screen.getByRole('radio', { name: '丙' }).getAttribute('aria-checked')).toBe('true');
  });

  it('accepts an empty-string value (the 「all」 choice)', () => {
    render(
      <PillRadioGroup
        label="範圍"
        options={[{ value: '', label: '全部' }, ...options]}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: '全部' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('PillToggleGroup', () => {
  it('single: a click picks one, clicking the picked pill clears it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <PillToggleGroup label="狀態" options={options} value={[]} onChange={onChange} />,
    );
    expect(screen.getByRole('group', { name: '狀態' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '乙' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
    rerender(<PillToggleGroup label="狀態" options={options} value={['b']} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '乙' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: '甲' }));
    expect(onChange).toHaveBeenLastCalledWith(['a']);
    await user.click(screen.getByRole('button', { name: '乙' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('multiple: toggles values and keeps option order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PillToggleGroup multiple label="分類" options={options} value={['c']} onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: '甲' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);
    await user.click(screen.getByRole('button', { name: '丙' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows the group label as visible text when asked', () => {
    render(
      <PillToggleGroup showLabel label="狀態" options={options} value={[]} onChange={() => {}} />,
    );
    expect(screen.getByText('狀態')).toBeTruthy();
    expect(screen.getByRole('group', { name: '狀態' })).toBeTruthy();
  });
});

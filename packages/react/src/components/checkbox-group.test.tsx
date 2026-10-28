import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxGroup } from './checkbox-group';

const options = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
  { value: 'c', label: '丙' },
];

describe('CheckboxGroup', () => {
  it('is a named group; toggling adds in option order and removes', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CheckboxGroup label="分類" options={options} value={['c']} onChange={onChange} />,
    );
    expect(screen.getByRole('group', { name: '分類' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '丙' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('checkbox', { name: '甲' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);
    rerender(
      <CheckboxGroup label="分類" options={options} value={['a', 'c']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: '丙' }));
    expect(onChange).toHaveBeenLastCalledWith(['a']);
  });
});

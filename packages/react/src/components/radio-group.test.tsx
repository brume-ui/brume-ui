import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from './radio-group';

const options = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '上架' },
  { value: 'archived', label: '封存', disabled: true },
  { value: 'hidden', label: '隱藏' },
];

function Harness({ onChange }: { onChange(v: string): void }) {
  const [value, setValue] = useState('draft');
  return (
    <RadioGroup
      label="狀態"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('RadioGroup', () => {
  it('is a named radiogroup and arrow keys select (skipping disabled)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: '狀態' })).toBeTruthy();
    const draft = screen.getByRole('radio', { name: '草稿' });
    expect(draft.getAttribute('aria-checked')).toBe('true');
    await user.tab();
    expect(document.activeElement).toBe(draft);
    // Radix moves focus a tick after keydown and selects only while the arrow is still down.
    const arrowRight = async () => {
      await user.keyboard('{ArrowRight>}');
      await new Promise((r) => setTimeout(r, 0));
      await user.keyboard('{/ArrowRight}');
    };
    await arrowRight();
    expect(onChange).toHaveBeenLastCalledWith('published');
    expect(screen.getByRole('radio', { name: '上架' }).getAttribute('aria-checked')).toBe('true');
    await arrowRight();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '隱藏' }));
    expect(onChange).toHaveBeenLastCalledWith('hidden');
  });

  it('marks orientation and selects on click', async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="狀態"
        options={options}
        value=""
        onChange={onChange}
        orientation="vertical"
      />,
    );
    expect(screen.getByRole('radiogroup').getAttribute('aria-orientation')).toBe('vertical');
    await userEvent.click(screen.getByText('上架'));
    expect(onChange).toHaveBeenCalledWith('published');
  });
});

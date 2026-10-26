import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Field } from './field';
import { Select } from './select';

const options = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
];

beforeAll(() => {
  // jsdom lacks these; Radix Select calls them.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('Select', () => {
  it('selects with keyboard (ArrowDown + Enter)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select options={options} onValueChange={onValueChange} placeholder="請選擇" />);
    screen.getByRole('combobox').focus();
    await user.keyboard('{ArrowDown}'); // opens, first option highlighted
    await user.keyboard('{ArrowDown}'); // moves to second option
    await user.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('works inside Field (label + aria-invalid)', () => {
    render(
      <Field label="分類" error="請選一個分類。">
        <Select options={options} onValueChange={() => {}} />
      </Field>,
    );
    const trigger = screen.getByLabelText('分類');
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toContain('-error');
  });
});

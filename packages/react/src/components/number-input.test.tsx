import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './field';
import { NumberInput, type NumberInputProps } from './number-input';

function Harness({
  initial = '',
  spy,
  ...rest
}: Omit<NumberInputProps, 'value' | 'onChange'> & { initial?: string; spy?(v: string): void }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberInput
      aria-label="金額"
      {...rest}
      value={value}
      onChange={(v) => {
        setValue(v);
        spy?.(v);
      }}
    />
  );
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });

describe('NumberInput', () => {
  it('NumberInput keeps the wire format', () => {
    const spy = vi.fn();
    render(<Harness decimals={2} grouping spy={spy} />);
    fireEvent.focus(input());
    type('1280.5');
    expect(spy).toHaveBeenLastCalledWith('1280.5');
    fireEvent.blur(input());
    expect(input().value).toBe('1,280.50');
    expect(spy).toHaveBeenLastCalledWith('1280.50');
    fireEvent.focus(input());
    expect(input().value).toBe('1280.50');
  });

  it('decimals = 0 does not take a decimal point', () => {
    const spy = vi.fn();
    render(<Harness decimals={0} initial="12" spy={spy} />);
    expect(input().inputMode).toBe('numeric');
    fireEvent.focus(input());
    type('12.');
    expect(input().value).toBe('12');
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses letters, a second point and digits past `decimals`', () => {
    const spy = vi.fn();
    render(<Harness decimals={2} initial="1.25" spy={spy} />);
    expect(input().inputMode).toBe('decimal');
    fireEvent.focus(input());
    for (const text of ['1.25a', '1.2.5', '1.255', '-1.25']) type(text);
    expect(input().value).toBe('1.25');
    expect(spy).not.toHaveBeenCalled();
  });

  it('takes a leading minus only when min < 0', () => {
    const spy = vi.fn();
    render(<Harness min={-10} spy={spy} />);
    fireEvent.focus(input());
    type('-');
    expect(input().value).toBe('-');
    // A lone minus is not a number yet: the wire value stays empty.
    expect(spy).not.toHaveBeenCalled();
    type('-3');
    expect(spy).toHaveBeenLastCalledWith('-3');
    type('3-');
    expect(input().value).toBe('-3');
  });

  it('normalises on blur: leading zeros, a bare point, an emptied field', () => {
    const spy = vi.fn();
    render(<Harness decimals={2} spy={spy} />);
    fireEvent.focus(input());
    type('007.');
    fireEvent.blur(input());
    expect(spy).toHaveBeenLastCalledWith('7.00');
    expect(input().value).toBe('7.00');
    fireEvent.focus(input());
    type('');
    fireEvent.blur(input());
    expect(spy).toHaveBeenLastCalledWith('');
    expect(input().value).toBe('');
  });

  it('accepts a pasted grouped number and sends it without separators', () => {
    const spy = vi.fn();
    render(<Harness decimals={2} spy={spy} />);
    fireEvent.focus(input());
    type('1,280.50');
    expect(spy).toHaveBeenLastCalledWith('1280.50');
  });

  it('shows a value set from outside, formatted while not focused', () => {
    render(<Harness decimals={2} grouping initial="1234567.5" />);
    expect(input().value).toBe('1,234,567.50');
  });

  it('shows the prefix and adds it to the accessible name after the label', () => {
    const { container } = render(
      <Field label="售價">
        <NumberInput value="10" onChange={() => {}} decimals={0} prefix="NT$" />
      </Field>,
    );
    expect(screen.getByRole('textbox', { name: '售價 NT$' })).toBeTruthy();
    const visible = [...container.querySelectorAll('[aria-hidden="true"]')].find(
      (el) => el.textContent === 'NT$',
    );
    expect(visible).toBeTruthy();
  });

  it('appends the prefix to an aria-label', () => {
    render(<NumberInput aria-label="金額" value="" onChange={() => {}} prefix="NT$" />);
    expect(screen.getByRole('textbox', { name: '金額 NT$' })).toBeTruthy();
  });

  it('takes Field’s description, error and required state', () => {
    render(
      <Field label="數量" description="最多 99" error="請輸入數量" required>
        <NumberInput value="" onChange={() => {}} decimals={0} />
      </Field>,
    );
    const el = screen.getByRole('textbox', { name: '數量' });
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(el.getAttribute('aria-required')).toBe('true');
    const described = el.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      '最多 99',
      '請輸入數量',
    ]);
  });
});

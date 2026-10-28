import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateInput } from './date-input';

describe('DateInput', () => {
  it('is a native date input by default and datetime-local withTime', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateInput label="建立日期" value="2026-10-28" onChange={onChange} />,
    );
    const input = screen.getByLabelText('建立日期') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-10-28');
    fireEvent.change(input, { target: { value: '2026-11-01' } });
    expect(onChange).toHaveBeenCalledWith('2026-11-01');
    rerender(<DateInput label="建立日期" value="" onChange={onChange} withTime />);
    expect((screen.getByLabelText('建立日期') as HTMLInputElement).type).toBe('datetime-local');
  });

  it('leaves color-scheme to the theme on :root so the native calendar follows the manual switch', () => {
    render(<DateInput label="日期" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('日期');
    expect(input.className).not.toMatch(/color-scheme|scheme-/);
    expect(input.style.colorScheme).toBe('');
  });
});

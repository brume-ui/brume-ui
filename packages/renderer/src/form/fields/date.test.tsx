import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setup } from './test-utils';

describe('date fields', () => {
  it.each([
    ['date', '2026-11-01'],
    ['datetime', '2026-11-01T12:30'],
  ] as const)('%s uses the wire value and forwards blur', (type, value) => {
    const { onChange, onBlur } = setup({ type, name: 'value', label: 'Date', required: true });
    const input = screen.getByLabelText('Date');
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(value);
    expect(onBlur).toHaveBeenCalledOnce();
    expect(input.getAttribute('aria-required')).toBe('true');
  });
  it.each(['dateRange', 'datetimeRange'] as const)(
    '%s omits empty bounds and updates populated values',
    (type) => {
      const start = type === 'dateRange' ? '2026-11-01' : '2026-11-01T12:30';
      const end = type === 'dateRange' ? '2026-11-11' : '2026-11-11T12:30';
      const { onChange, onBlur } = setup(
        { type, name: 'value', label: 'Period' },
        { value: { start } },
      );
      const startInput = screen.getByLabelText('Period（起）');
      const endInput = screen.getByLabelText('Period（迄）');
      fireEvent.change(endInput, { target: { value: end } });
      expect(onChange).toHaveBeenLastCalledWith({ start, end });
      fireEvent.change(startInput, { target: { value: '' } });
      expect(onChange).toHaveBeenLastCalledWith({ end });
      fireEvent.change(endInput, { target: { value: '' } });
      expect(onChange).toHaveBeenLastCalledWith({});
      fireEvent.blur(endInput);
      expect(onBlur).toHaveBeenCalledOnce();
    },
  );
  it('connects each bound error only to its input', () => {
    setup(
      { type: 'dateRange', name: 'value', label: 'Period', help: 'Hint' },
      { invalid: true, errors: { end: ['End required'] } },
    );
    const start = screen.getByLabelText('Period（起）');
    const end = screen.getByLabelText('Period（迄）');
    const error = screen.getByText('End required');
    expect(end?.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(start?.getAttribute('aria-describedby')?.split(' ')).not.toContain(error.id);
    expect(end?.getAttribute('aria-invalid')).toBe('true');
    expect(start?.getAttribute('aria-invalid')).toBeNull();
    expect(error.parentElement?.contains(end)).toBe(true);
  });
  it('disables both bounds', () => {
    setup({ type: 'dateRange', name: 'value', label: 'Period' }, { disabled: true });
    expect(
      screen.getAllByLabelText(/Period（/).every((el) => (el as HTMLInputElement).disabled),
    ).toBe(true);
  });
  it('formats a read-only range', () => {
    setup(
      { type: 'dateRange', name: 'value', label: 'Period' },
      { readOnly: true, value: { start: '2026-11-01', end: '2026-11-11' } },
    );
    expect(screen.getByText('2026-11-01 – 2026-11-11').tagName).toBe('P');
    expect(screen.queryByRole('group', { name: 'Period' })).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeInput } from './time-input';

describe('TimeInput', () => {
  it('is a native time input with a whole-minute step by default', () => {
    const onChange = vi.fn();
    render(<TimeInput label="開始時間" value="09:05" onChange={onChange} />);
    const input = screen.getByLabelText('開始時間') as HTMLInputElement;
    expect(input.type).toBe('time');
    expect(input.getAttribute('step')).toBe('60');
    expect(input.value).toBe('09:05');
    fireEvent.change(input, { target: { value: '10:30' } });
    expect(onChange).toHaveBeenCalledWith('10:30');
  });

  it('steps by one second and keeps the seconds with `seconds`', () => {
    const onChange = vi.fn();
    render(<TimeInput label="時間" value="09:05:30" onChange={onChange} seconds />);
    const input = screen.getByLabelText('時間') as HTMLInputElement;
    expect(input.getAttribute('step')).toBe('1');
    expect(input.value).toBe('09:05:30');
    fireEvent.change(input, { target: { value: '09:05:45' } });
    expect(onChange).toHaveBeenCalledWith('09:05:45');
  });

  it('reports a cleared field as an empty string', () => {
    const onChange = vi.fn();
    render(<TimeInput label="時間" value="09:05" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('時間'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('takes the invalid, required and described-by state', () => {
    render(
      <TimeInput
        label="時間"
        value=""
        onChange={() => {}}
        invalid
        aria-required
        aria-describedby="h"
      />,
    );
    const input = screen.getByLabelText('時間');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('h');
  });

  it('leaves color-scheme to the theme', () => {
    render(<TimeInput label="時間" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('時間').className).not.toMatch(/color-scheme|scheme-/);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Slider, snapSlider } from './slider';

describe('snapSlider', () => {
  it.each([
    // [raw, min, max, step, expected]
    [0.1 + 0.2, 0, 1, 0.1, 0.3],
    [0.30000000000000004, 0, 1, 0.1, 0.3],
    [0.7000000000000001, 0, 1, 0.1, 0.7],
    [0.35, 0, 1, 0.1, 0.4],
    [-1, 0, 1, 0.1, 0],
    [2, 0, 1, 0.1, 1],
    [7, 0, 100, 5, 5],
    [8, 0, 100, 5, 10],
    [3, 1, 10, 2, 3],
    [10, 1, 10, 2, 9],
    [1.15, 1, 2, 0.05, 1.15],
    [0.3, 0.1, 1, 0.1, 0.3],
    [0.0000003, 0, 1, 0.0000001, 0.0000003],
    [5, 0, 100, 1, 5],
  ])('snaps %s within [%s, %s] step %s to %s', (raw, min, max, step, expected) => {
    expect(snapSlider(raw, min, max, step)).toBe(expected);
  });
});

describe('Slider', () => {
  it('shows and announces the snapped value for an off-grid record value', () => {
    render(<Slider label="等級" value={0.35} onChange={() => {}} min={0} max={1} step={0.1} />);
    const input = screen.getByRole('slider', { name: '等級' }) as HTMLInputElement;
    expect(input.getAttribute('aria-valuetext')).toBe('0.4');
    expect(input.value).toBe('0.4');
    expect(screen.getByText('0.4')).toBeTruthy();
  });

  it('is a native range with bounds, step, name and value text', () => {
    render(<Slider label="音量" value={30} onChange={() => {}} min={0} max={100} step={10} />);
    const input = screen.getByRole('slider', { name: '音量' }) as HTMLInputElement;
    expect(input.type).toBe('range');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('10');
    expect(input.value).toBe('30');
    expect(input.getAttribute('aria-valuetext')).toBe('30');
  });

  it('shows the value as a visible readout', () => {
    render(<Slider label="音量" value={30} onChange={() => {}} min={0} max={100} step={10} />);
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('formats the readout and value text with the step decimals', () => {
    render(<Slider label="比例" value={0.5} onChange={() => {}} min={0} max={1} step={0.25} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('0.50');
    expect(screen.getByText('0.50')).toBeTruthy();
  });

  it('snaps what the browser reports to a number without float noise', () => {
    const onChange = vi.fn();
    render(<Slider label="比例" value={0} onChange={onChange} min={0} max={1} step={0.1} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.30000000000000004' } });
    expect(onChange).toHaveBeenCalledWith(0.3);
    expect(typeof onChange.mock.calls[0]?.[0]).toBe('number');
  });

  it('emits numbers within the bounds', () => {
    const onChange = vi.fn();
    render(<Slider label="音量" value={50} onChange={onChange} min={0} max={100} step={1} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } });
    expect(onChange).toHaveBeenLastCalledWith(100);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('puts the thumb at min for null and emits nothing until the user interacts', () => {
    const onChange = vi.fn();
    render(<Slider label="音量" value={null} onChange={onChange} min={10} max={100} step={10} />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.value).toBe('10');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '20' } });
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('takes Field state and is disabled when asked', () => {
    render(
      <Slider
        label="音量"
        value={1}
        onChange={() => {}}
        min={0}
        max={5}
        step={1}
        disabled
        invalid
        aria-describedby="h"
      />,
    );
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('h');
  });

  it('calls onBlur', () => {
    const onBlur = vi.fn();
    render(
      <Slider
        label="音量"
        value={1}
        onChange={() => {}}
        min={0}
        max={5}
        step={1}
        onBlur={onBlur}
      />,
    );
    fireEvent.blur(screen.getByRole('slider'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('uses no hard-coded colours', () => {
    render(<Slider label="音量" value={1} onChange={() => {}} min={0} max={5} step={1} />);
    expect(screen.getByRole('slider').className).not.toMatch(
      /#[0-9a-f]{3,8}|rgb|\[(?:white|black)\]/i,
    );
  });
});

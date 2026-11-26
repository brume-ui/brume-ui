import type { FieldDef } from '@brume-ui/brume-schema';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveField } from '../../index';
import { setup } from './test-utils';

describe('registry', () => {
  it.each([
    ['ip', 'text'],
    ['rate', 'text'],
    ['time', 'date'],
    ['timeRange', 'date'],
  ] as const)('%s shares the %s field component', (type, as) => {
    expect(resolveField(type)).toBe(resolveField(as));
  });
  it.each(['slider', 'range', 'icon', 'captcha'])('%s is registered', (type) => {
    expect(resolveField(type)).toBeTruthy();
  });
});

describe('ip field', () => {
  const def = { type: 'ip', name: 'value', label: '來源 IP' } satisfies FieldDef;
  it('stores the trimmed text and null when blank', () => {
    const { onChange } = setup(def);
    const input = screen.getByRole('textbox', { name: /來源 IP/ });
    fireEvent.change(input, { target: { value: '  10.0.0.1 ' } });
    expect(onChange).toHaveBeenLastCalledWith('10.0.0.1');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('reads as static text when read only', () => {
    setup(def, { readOnly: true, value: '::1' });
    expect(screen.getByText('::1')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('rate field', () => {
  const def = { type: 'rate', name: 'value', label: '稅率', decimals: 2 } satisfies FieldDef;
  it('shows a percent suffix and keeps decimal wire strings', () => {
    const { onChange } = setup(def, { value: '5.5' });
    expect(screen.getByText('%')).not.toBeNull();
    const input = screen.getByRole('textbox', { name: /稅率/ }) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.25' } });
    expect(onChange).toHaveBeenLastCalledWith('12.25');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('refuses more fraction digits than decimals', () => {
    const { onChange } = setup(def, { value: '5.5' });
    const input = screen.getByRole('textbox', { name: /稅率/ });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5.555' } });
    expect(onChange).not.toHaveBeenCalledWith('5.555');
  });
  it('read only appends %', () => {
    setup(def, { readOnly: true, value: '5.50' });
    expect(screen.getByText('5.50%')).not.toBeNull();
  });
});

describe('time field', () => {
  const def = { type: 'time', name: 'value', label: '開店' } satisfies FieldDef;
  it('writes the native value and null when cleared', () => {
    const { onChange } = setup(def);
    const input = screen.getByLabelText('開店') as HTMLInputElement;
    expect(input.type).toBe('time');
    expect(input.step).toBe('60');
    fireEvent.change(input, { target: { value: '09:05' } });
    expect(onChange).toHaveBeenLastCalledWith('09:05');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('shows HH:mm for a loaded HH:mm:ss without writing anything', () => {
    const { onChange } = setup(def, { value: '09:05:00' });
    expect((screen.getByLabelText('開店') as HTMLInputElement).value).toBe('09:05');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('offers seconds and keeps a loaded HH:mm:ss', () => {
    setup({ ...def, seconds: true }, { value: '09:05:30' });
    const input = screen.getByLabelText('開店') as HTMLInputElement;
    expect(input.step).toBe('1');
    expect(input.value).toBe('09:05:30');
  });
  it('read only shows the normalised time', () => {
    setup(def, { readOnly: true, value: '09:05:00' });
    expect(screen.getByText('09:05')).not.toBeNull();
  });
});

describe('timeRange field', () => {
  const def = { type: 'timeRange', name: 'value', label: '營業' } satisfies FieldDef;
  it('keeps an overnight range as typed', () => {
    const { onChange } = setup(def, { value: { start: '22:00' } });
    const end = screen.getByLabelText('營業（迄）') as HTMLInputElement;
    expect(end.type).toBe('time');
    fireEvent.change(end, { target: { value: '06:00' } });
    expect(onChange).toHaveBeenLastCalledWith({ start: '22:00', end: '06:00' });
  });
  it('trims loaded seconds off both bounds unless seconds is set', () => {
    setup(def, { value: { start: '22:00:00', end: '06:00:00' } });
    expect((screen.getByLabelText('營業（起）') as HTMLInputElement).value).toBe('22:00');
    expect((screen.getByLabelText('營業（迄）') as HTMLInputElement).value).toBe('06:00');
  });
  it('passes seconds to both bounds', () => {
    setup({ ...def, seconds: true });
    expect((screen.getByLabelText('營業（起）') as HTMLInputElement).step).toBe('1');
  });
  it('read only joins the bounds', () => {
    setup(def, { readOnly: true, value: { start: '22:00', end: '06:00' } });
    expect(screen.getByText('22:00 – 06:00')).not.toBeNull();
  });
});

describe('slider field', () => {
  const def = { type: 'slider', name: 'value', label: '音量', min: 0, max: 1, step: 0.1 } as const;
  it('moves on the grid with no float noise', () => {
    const { onChange } = setup(def, { value: 0.2 });
    const input = screen.getByRole('slider', { name: '音量' });
    fireEvent.change(input, { target: { value: '0.30000000000000004' } });
    expect(onChange).toHaveBeenLastCalledWith(0.3);
  });
  it('an empty slider stores nothing until moved', () => {
    const { onChange } = setup(def, { value: null });
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0');
    expect(onChange).not.toHaveBeenCalled();
  });
  it('a required empty slider writes nothing itself (the form state fills min)', () => {
    const { onChange } = setup({ ...def, required: true }, { value: null });
    expect(onChange).not.toHaveBeenCalled();
  });
  it('read only shows the number', () => {
    setup(def, { readOnly: true, value: 0.3 });
    expect(screen.getByText('0.3')).not.toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

describe('range field', () => {
  const def = { type: 'range', name: 'value', label: '價格', decimals: 1 } satisfies FieldDef;
  it('emits only the filled bounds', () => {
    const { onChange } = setup(def, { value: {} });
    fireEvent.change(screen.getByLabelText('價格（起）'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ start: '1.5' });
  });
  it('puts a bound error on that bound only', () => {
    setup(def, {
      invalid: true,
      errors: { end: ['結束值不可小於起始值'] },
      value: { start: '3', end: '2' },
    });
    const end = screen.getByLabelText('價格（迄）');
    const start = screen.getByLabelText('價格（起）');
    expect(end.getAttribute('aria-invalid')).toBe('true');
    expect(start.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('結束值不可小於起始值')).not.toBeNull();
  });
  it('read only joins the bounds, one bound alone, or a dash when empty', () => {
    const a = setup(def, { readOnly: true, value: { start: '1.0', end: '2.5' } });
    expect(screen.getByText('1.0 – 2.5')).not.toBeNull();
    a.unmount();
    const b = setup(def, { readOnly: true, value: { start: '1.0' } });
    expect(screen.getByText('1.0')).not.toBeNull();
    b.unmount();
    setup(def, { readOnly: true, value: {} });
    expect(screen.getByText('—')).not.toBeNull();
  });
});

describe('icon field', () => {
  const def = { type: 'icon', name: 'value', label: '圖示' } satisfies FieldDef;
  it('keeps a name lucide no longer has and clears to null', () => {
    const { onChange } = setup(def, { value: 'gone-icon' });
    const input = screen.getByRole('textbox', { name: '圖示' }) as HTMLInputElement;
    expect(input.value).toBe('gone-icon');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('typing a name stores it', () => {
    const { onChange } = setup(def);
    fireEvent.change(screen.getByRole('textbox', { name: '圖示' }), { target: { value: 'star' } });
    expect(onChange).toHaveBeenLastCalledWith('star');
  });
  it('read only shows a glyph and the name', () => {
    const { container } = setup(def, { readOnly: true, value: 'star' });
    expect(screen.getByText('star')).not.toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('read only empty is an em dash', () => {
    setup(def, { readOnly: true, value: null });
    expect(screen.getByText('—')).not.toBeNull();
  });
});

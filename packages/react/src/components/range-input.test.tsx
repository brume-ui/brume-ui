import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { RangeInput, type RangeInputProps } from './range-input';

function setup(props: Partial<RangeInputProps> = {}) {
  const onChange = vi.fn();
  render(
    <BrumeProvider adapter={createMemoryAdapter()}>
      <RangeInput label="價格" of="number" value={{}} onChange={onChange} {...props} />
    </BrumeProvider>,
  );
  return onChange;
}

describe('RangeInput', () => {
  it('returns only { start } when just the start is filled', () => {
    const onChange = setup();
    expect(screen.getByRole('group', { name: '價格' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('價格（起）'), { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith({ start: '100' });
    expect(Object.keys(onChange.mock.calls[0]?.[0] ?? {})).toEqual(['start']);
  });

  it('drops a cleared bound and keeps the other', () => {
    const onChange = setup({ value: { start: '1', end: '9' } });
    fireEvent.change(screen.getByLabelText('價格（起）'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ end: '9' });
  });

  it('maps of to native input types', () => {
    setup({ of: 'datetime' });
    expect((screen.getByLabelText('價格（迄）') as HTMLInputElement).type).toBe('datetime-local');
  });
});

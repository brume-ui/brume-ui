import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setup } from './test-utils';

describe('static and switch fields', () => {
  it.each([
    'text',
    'textarea',
    'email',
    'url',
    'mobile',
    'password',
    'number',
    'decimal',
    'currency',
    'switch',
    'display',
  ] as const)('%s is labelled static text when read only', (type) => {
    const def =
      type === 'decimal' || type === 'currency'
        ? { type, decimals: 2, name: 'value', label: 'Value' }
        : { type, name: 'value', label: 'Value' };
    const value =
      type === 'password'
        ? ''
        : type === 'switch'
          ? true
          : ['number', 'decimal', 'currency'].includes(type)
            ? '1280.50'
            : 'Example';
    setup(def, { readOnly: true, value });
    const text = screen.getByText(
      type === 'password'
        ? '—'
        : type === 'currency'
          ? 'NT$ 1280.50'
          : type === 'switch'
            ? '開啟'
            : String(value),
    );
    expect(text.tagName).toBe('P');
    expect(text.getAttribute('aria-labelledby')).toBe('field-value-label');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });
  it.each(['text', 'display'] as const)('%s uses an em dash for an empty value', (type) => {
    setup({ type, name: 'value', label: 'Value' }, { value: null, readOnly: true });
    expect(screen.getByText('—').getAttribute('aria-labelledby')).toBe('field-value-label');
  });
  it('disabled controls cannot be toggled', () => {
    setup({ type: 'switch', name: 'value', label: 'Value' }, { disabled: true });
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });
  it('hidden renders no elements', () => {
    const { container } = setup({ type: 'hidden', name: 'value', label: 'Value' });
    expect(container.innerHTML).toBe('');
  });
  it('switch emits booleans and links errors', () => {
    const { onChange, onBlur } = setup(
      { type: 'switch', name: 'value', label: 'Value' },
      { value: false, errors: { '': ['Wrong'] } },
    );
    const control = screen.getByRole('switch', { name: 'Value' });
    fireEvent.click(control);
    fireEvent.blur(control);
    expect(onBlur).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toBe('field-value-error');
  });
});

import type { FieldDef } from '@brume-ui/brume-schema';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setup } from './test-utils';

describe('text and number fields', () => {
  it.each(['text', 'textarea', 'email', 'url', 'mobile', 'password'] as const)(
    '%s labels its control and emits strings',
    (type) => {
      const { onChange, onBlur } = setup({
        type,
        name: 'value',
        label: 'Value',
        help: '留空表示不修改',
        required: true,
      });
      const control = screen.getByLabelText(/^Value/);
      fireEvent.change(control, { target: { value: 'hello' } });
      fireEvent.blur(control);
      expect(onChange).toHaveBeenLastCalledWith('hello');
      expect(onBlur).toHaveBeenCalled();
      expect(control.getAttribute('aria-required')).toBe('true');
      expect(screen.getByText('留空表示不修改')).not.toBeNull();
      if (type === 'email') {
        expect(control.getAttribute('type')).toBe('email');
        expect(control.getAttribute('autocomplete')).toBe('email');
      }
      if (type === 'url') {
        expect(control.getAttribute('type')).toBe('url');
        expect(control.getAttribute('inputmode')).toBe('url');
      }
      if (type === 'mobile') {
        expect(control.getAttribute('type')).toBe('tel');
        expect(control.getAttribute('inputmode')).toBe('tel');
        expect(control.getAttribute('autocomplete')).toBe('tel');
      }
    },
  );
  it.each(['number', 'decimal', 'currency'] as const)(
    '%s emits the wire value and null on clear',
    (type) => {
      const def: FieldDef =
        type === 'number'
          ? { type, name: 'value', label: 'Value' }
          : { type, decimals: 2, symbol: 'NT$', name: 'value', label: 'Value' };
      const { onChange } = setup(def);
      const control = screen.getByRole('textbox', { name: 'Value' });
      fireEvent.focus(control);
      fireEvent.change(control, { target: { value: '1280' } });
      fireEvent.blur(control);
      expect(onChange).toHaveBeenLastCalledWith(type === 'number' ? 1280 : '1280.00');
      if (type === 'currency') expect(screen.getByText('NT$')).not.toBeNull();
      fireEvent.focus(control);
      fireEvent.change(control, { target: { value: '' } });
      expect(onChange).toHaveBeenLastCalledWith(null);
    },
  );
  it('connects the first error and inherited description', () => {
    setup(
      { type: 'text', name: 'value', label: 'Value', help: 'Hint' },
      { errors: { '': ['Wrong', 'Second'] }, describedBy: 'external', invalid: true },
    );
    const control = screen.getByLabelText(/^Value/);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(control.getAttribute('aria-describedby')).toBe(
      'external field-value-description field-value-error',
    );
    expect(screen.getByText('Wrong').getAttribute('id')).toBe('field-value-error');
    expect(screen.queryByText('Second')).toBeNull();
  });
});

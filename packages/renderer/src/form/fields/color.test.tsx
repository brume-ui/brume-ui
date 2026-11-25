import type { FieldDef } from '@brume-ui/brume-schema';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveField } from '../../index';
import { validateValue } from '../validate';
import { setup } from './test-utils';

const def = { type: 'color', name: 'value', label: '品牌色' } satisfies FieldDef;

describe('color field', () => {
  it('is registered, as is tel', () => {
    expect(resolveField('color')).toBeTruthy();
    expect(resolveField('tel')).toBe(resolveField('text'));
  });
  it('propagates typed text and the canonical value on blur', () => {
    const { onChange, onBlur } = setup(def);
    const input = screen.getByRole('textbox', { name: /品牌色/ });
    fireEvent.change(input, { target: { value: '#ABC' } });
    expect(onChange).toHaveBeenLastCalledWith('#ABC');
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
    expect(onBlur).toHaveBeenCalled();
  });
  it('clears to null', () => {
    const { onChange } = setup(def, { value: '#aabbcc' });
    const input = screen.getByRole('textbox', { name: /品牌色/ });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('treats a corrupt non-string value as empty', () => {
    setup(def, { value: 42 });
    expect((screen.getByRole('textbox', { name: /品牌色/ }) as HTMLInputElement).value).toBe('');
  });
  it('a pattern rule reports a short value', () => {
    const f = {
      ...def,
      rules: [{ rule: 'pattern', pattern: '^#[0-9a-f]{6}$', message: '格式錯誤' }],
    } as FieldDef;
    expect(validateValue(f, '#12345')).toBe('格式錯誤');
    expect(validateValue(f, '#123456')).toBeNull();
  });
  it('shows the hex and a chip when read only', () => {
    const { container } = setup(def, { readOnly: true, value: '#aabbcc' });
    expect(screen.getByText('#aabbcc').getAttribute('aria-labelledby')).toBe('field-value-label');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('read only empty or corrupt shows an em dash', () => {
    setup(def, { readOnly: true, value: 42 });
    expect(screen.getByText('—')).not.toBeNull();
  });
});

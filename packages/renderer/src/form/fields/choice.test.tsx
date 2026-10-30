import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { setup } from './test-utils';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', depth: 2 },
];
describe('choice fields', () => {
  it.each([10, 11])('select with %i options chooses the expected primitive', (count) => {
    setup({
      type: 'select',
      name: 'value',
      label: 'Choice',
      options: Array.from({ length: count }, (_, i) => ({
        value: String(i),
        label: `Option ${i}`,
      })),
    });
    expect(screen.getByRole('combobox', { name: 'Choice' }).tagName).toBe(
      count === 10 ? 'BUTTON' : 'INPUT',
    );
  });
  it('searches locally, indents depth without altering the name, emits a value and clears to null', () => {
    const { onChange, onBlur } = setup({
      type: 'select',
      name: 'value',
      label: 'Choice',
      options,
      searchable: true,
      clearable: true,
      required: true,
    });
    const input = screen.getByRole('combobox', { name: 'Choice' });
    fireEvent.change(input, { target: { value: 'Bet' } });
    expect(screen.queryByRole('option', { name: 'Alpha' })).toBeNull();
    const beta = screen.getByRole('option', { name: 'Beta' });
    expect(beta.getAttribute('style')).toContain('4rem');
    fireEvent.click(beta);
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect((input as HTMLInputElement).value).toBe('Beta');
    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
    expect(input.getAttribute('aria-required')).toBe('true');
  });
  it('small select supports keyboard selection, option depth and clear to null', async () => {
    const user = userEvent.setup();
    const { onChange, onBlur } = setup({
      type: 'select',
      name: 'value',
      label: 'Choice',
      options,
      clearable: true,
    });
    const trigger = screen.getByRole('combobox', { name: 'Choice' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Beta' }).getAttribute('style')).toContain('4rem');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.blur(trigger);
    expect(onBlur).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '清除' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it.each(['select', 'multipleSelect', 'radio', 'checkbox', 'tags'] as const)(
    '%s links root errors and help',
    (type) => {
      setup(
        { type, name: 'value', label: 'Choice', options, help: 'Hint', required: true },
        { errors: { '': ['Wrong'] }, describedBy: 'external', invalid: true },
      );
      const control =
        type === 'radio'
          ? screen.getByRole('radiogroup')
          : type === 'checkbox'
            ? screen.getByRole('group', { name: 'Choice' })
            : screen.getByRole('combobox', { name: 'Choice' });
      expect(control.getAttribute('aria-describedby')).toBe(
        'external field-value-description field-value-error',
      );
      if (type !== 'checkbox') expect(control.getAttribute('aria-invalid')).toBe('true');
    },
  );
  it.each(['select', 'multipleSelect', 'radio', 'checkbox', 'tags'] as const)(
    '%s honors disabled controls',
    (type) => {
      setup({ type, name: 'value', label: 'Choice', options }, { disabled: true });
      const controls =
        type === 'radio'
          ? screen.getAllByRole('radio')
          : type === 'checkbox'
            ? screen.getAllByRole('checkbox')
            : [screen.getByRole('combobox')];
      expect(controls.every((el) => (el as HTMLInputElement).disabled)).toBe(true);
    },
  );
  it('non-clearable searchable select hides the clear button', () => {
    setup(
      { type: 'select', name: 'value', label: 'Choice', options, searchable: true },
      { value: 'a' },
    );
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
  });
  it('multipleSelect disables unselected options at max and allows removal', () => {
    const { onChange } = setup(
      { type: 'multipleSelect', name: 'value', label: 'Choices', options, max: 1 },
      { value: ['a'] },
    );
    const input = screen.getByRole('combobox', { name: 'Choices' });
    fireEvent.click(input);
    expect(screen.getByRole('option', { name: 'Beta' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });
  it('checkbox emits arrays and honors disabled', () => {
    const { onChange } = setup(
      { type: 'checkbox', name: 'value', label: 'Choices', options },
      { value: ['a'] },
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });
  it('tags emits arrays and forwards blur', () => {
    const { onChange, onBlur } = setup(
      { type: 'tags', name: 'value', label: 'Tags' },
      { value: ['old'] },
    );
    const input = screen.getByRole('textbox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(['old', 'new']);
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });
  it('radio emits a string and forwards blur', () => {
    const { onChange, onBlur } = setup({ type: 'radio', name: 'value', label: 'Choice', options });
    const beta = screen.getByRole('radio', { name: 'Beta' });
    fireEvent.click(beta);
    fireEvent.blur(beta);
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(onBlur).toHaveBeenCalled();
  });
  it.each(['select', 'multipleSelect', 'radio', 'checkbox', 'tags'] as const)(
    '%s displays labels as read-only text',
    (type) => {
      setup(
        { type, name: 'value', label: 'Choice', options },
        {
          value: ['multipleSelect', 'checkbox', 'tags'].includes(type) ? ['b'] : 'b',
          readOnly: true,
        },
      );
      const text = screen.getByText('Beta');
      expect(text.tagName).toBe('P');
      expect(text.getAttribute('aria-labelledby')).toBe('field-value-label');
      expect(screen.queryByRole('combobox')).toBeNull();
    },
  );
});

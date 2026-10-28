import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { TextInput } from './text-input';

describe('Field', () => {
  it('associates label with the input', () => {
    render(
      <Field label="帳號">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText('帳號').tagName).toBe('INPUT');
  });

  it('marks invalid and points aria-describedby at the error text', () => {
    render(
      <Field label="帳號" description="使用 Email" error="這個帳號已被使用，換一個再試。">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText('帳號');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    const error = screen.getByText('這個帳號已被使用，換一個再試。');
    expect(ids).toContain(error.id);
    expect(ids).toContain(screen.getByText('使用 Email').id);
  });

  it('has no aria-invalid without an error', () => {
    render(
      <Field label="帳號">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText('帳號').hasAttribute('aria-invalid')).toBe(false);
  });

  it('keeps invalid on the child when there is no error', () => {
    render(
      <Field label="帳號">
        <TextInput invalid />
      </Field>,
    );
    expect(screen.getByLabelText('帳號').getAttribute('aria-invalid')).toBe('true');
  });

  it('merges the child aria-describedby and keeps aria-required', () => {
    render(
      <>
        <p id="hint">提示</p>
        <Field label="帳號" error="錯了" required>
          <TextInput aria-describedby="hint" aria-required />
        </Field>
      </>,
    );
    const input = screen.getByLabelText(/帳號/);
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toContain('hint');
    expect(ids).toContain(screen.getByText('錯了').id);
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('drops in a hint or error that appears later, not the one present on first render', () => {
    const { rerender } = render(
      <Field label="帳號" description="使用 Email">
        <TextInput />
      </Field>,
    );
    expect(screen.getByText('使用 Email').className).not.toContain('br-drop-in');
    rerender(
      <Field label="帳號" description="至少 8 個字" error="這個帳號已被使用，換一個再試。">
        <TextInput />
      </Field>,
    );
    expect(screen.getByText('至少 8 個字').className).toContain('br-drop-in');
    expect(screen.getByText('這個帳號已被使用，換一個再試。').className).toContain('br-drop-in');
  });
});

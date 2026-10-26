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
});

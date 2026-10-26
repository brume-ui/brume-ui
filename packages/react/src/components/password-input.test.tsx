import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  it('toggles between password and text', () => {
    render(
      <BrumeProvider adapter={createMemoryAdapter()}>
        <PasswordInput aria-label="密碼" />
      </BrumeProvider>,
    );
    const input = screen.getByLabelText('密碼');
    expect(input.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: '顯示密碼' }));
    expect(input.getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: '隱藏密碼' }));
    expect(input.getAttribute('type')).toBe('password');
  });
});

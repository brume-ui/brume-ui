import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextInput } from './text-input';

describe('TextInput', () => {
  it('invalid sets aria-invalid', () => {
    render(<TextInput aria-label="x" invalid />);
    expect(screen.getByLabelText('x').getAttribute('aria-invalid')).toBe('true');
  });
});

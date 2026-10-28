import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('is a three-line textbox; invalid sets aria-invalid', () => {
    render(<Textarea aria-label="備註" invalid />);
    const box = screen.getByRole('textbox', { name: '備註' });
    expect(box.tagName).toBe('TEXTAREA');
    expect(box.getAttribute('rows')).toBe('3');
    expect(box.getAttribute('aria-invalid')).toBe('true');
  });
});

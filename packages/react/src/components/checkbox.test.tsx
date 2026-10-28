import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('toggles via label and reports boolean', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onCheckedChange} label="記住我" />);
    fireEvent.click(screen.getByLabelText('記住我'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('keeps the tick mounted and drives it from the checked state', () => {
    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={() => {}} label="記住我" />,
    );
    const box = screen.getByRole('checkbox', { name: '記住我' });
    expect(box.querySelector('path')).not.toBeNull();
    expect(box.getAttribute('data-state')).toBe('unchecked');
    rerender(<Checkbox checked onCheckedChange={() => {}} label="記住我" />);
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.getAttribute('aria-checked')).toBe('true');
  });
});

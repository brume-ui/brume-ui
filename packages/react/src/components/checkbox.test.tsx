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
});

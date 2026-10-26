import { render, screen } from '@testing-library/react';
import { Trash2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('is findable by its label with no visible text', () => {
    render(<IconButton icon={Trash2} label="刪除" />);
    const btn = screen.getByRole('button', { name: '刪除' });
    expect(btn.textContent).toBe('');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Thumbnail } from './thumbnail';

describe('Thumbnail', () => {
  it('is a button around the image, sized as asked', () => {
    const onClick = vi.fn();
    render(
      <Thumbnail
        src="/a.png"
        alt="照片"
        label="查看第 1 張照片"
        width={48}
        height={32}
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: '查看第 1 張照片' });
    const img = button.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('照片');
    expect(img?.getAttribute('width')).toBe('48');
    expect(img?.getAttribute('height')).toBe('32');
    // It may shrink in a narrow row (the 2px is the border).
    expect(button.className).toContain('br:shrink');
    expect(button.className).toContain('br:min-w-6');
    expect(button.style.width).toBe('50px');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

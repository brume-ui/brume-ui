import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './switch';

function Controlled({ onChange }: { onChange(v: boolean): void }) {
  const [on, setOn] = useState(false);
  return (
    <Switch
      label="上架"
      checked={on}
      onCheckedChange={(v) => {
        onChange(v);
        setOn(v);
      }}
    />
  );
}

describe('Switch', () => {
  it('is a labelled switch whose aria-checked follows checked and Space toggles', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '上架' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    sw.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('marks pending with aria-busy and still forwards every toggle', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch label="上架" checked pending onCheckedChange={onChange} />);
    const sw = screen.getByRole('switch', { name: '上架' });
    expect(sw.getAttribute('aria-busy')).toBe('true');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.click(sw);
    await user.click(sw);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

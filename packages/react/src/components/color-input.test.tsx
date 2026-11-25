import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '../memory-adapter';
import { BrumeProvider } from '../provider';
import { ColorInput, type ColorInputProps } from './color-input';

function Harness(props: Partial<ColorInputProps> & { initial?: string | null }) {
  const { initial = null, onChange, ...rest } = props;
  const [value, setValue] = useState<string | null>(initial);
  return (
    <BrumeProvider adapter={createMemoryAdapter()}>
      <ColorInput
        label="品牌色"
        {...rest}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </BrumeProvider>
  );
}

describe('ColorInput', () => {
  it('passes typed text up unchanged', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: '品牌色' }), {
      target: { value: '#12345' },
    });
    expect(onChange).toHaveBeenLastCalledWith('#12345');
  });

  it('canonicalises on blur and clears an empty box to null', () => {
    const onChange = vi.fn();
    render(<Harness initial="#ABC" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: '品牌色' });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('leaves invalid text alone on blur', () => {
    const onChange = vi.fn();
    render(<Harness initial="red" onChange={onChange} />);
    fireEvent.blur(screen.getByRole('textbox', { name: '品牌色' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits a clicked swatch and marks it pressed', () => {
    const onChange = vi.fn();
    render(<Harness swatches={['#FF0000', '#00ff00']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    fireEvent.click(screen.getByRole('button', { name: '#ff0000' }));
    expect(onChange).toHaveBeenLastCalledWith('#ff0000');
    expect(screen.getByRole('button', { name: '#ff0000' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '#00ff00' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('shows the alpha slider only with alpha', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    expect(document.querySelector('.react-colorful__alpha')).toBeNull();
    expect(document.querySelector('.react-colorful__hue')).not.toBeNull();
    unmount();
    render(<Harness alpha />);
    fireEvent.click(screen.getByRole('button', { name: '品牌色：開啟色盤' }));
    expect(document.querySelector('.react-colorful__alpha')).not.toBeNull();
  });

  it('does not open when disabled and disables the input', () => {
    render(<Harness disabled />);
    const chip = screen.getByRole('button', { name: '品牌色：開啟色盤' }) as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    fireEvent.click(chip);
    expect(document.querySelector('.react-colorful')).toBeNull();
    expect((screen.getByRole('textbox', { name: '品牌色' }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it('closes on Escape and returns focus to the chip', async () => {
    render(<Harness />);
    const chip = screen.getByRole('button', { name: '品牌色：開啟色盤' });
    fireEvent.click(chip);
    expect(document.querySelector('.react-colorful')).not.toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.react-colorful')).toBeNull());
    expect(document.activeElement).toBe(chip);
  });
});
